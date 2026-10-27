package squelch;

import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import squelch.Pattern.Step;

/** Small local web application; no third-party runtime dependencies. */
public final class App implements AutoCloseable {
    private static final int MAX_BODY=16_384;
    private final HttpServer server;
    private final ExecutorService executor=Executors.newFixedThreadPool(4);
    public App(String host,int port) throws IOException {
        server=HttpServer.create(new InetSocketAddress(host,port),32);
        server.setExecutor(executor);
        server.createContext("/",this::handle);
        server.start();
    }
    public int port() { return server.getAddress().getPort(); }
    public void close() { server.stop(0); executor.shutdownNow(); }
    public static void main(String[] args) throws IOException {
        int port=args.length>0?Integer.parseInt(args[0]):8080;
        String host=args.length>1?args[1]:"127.0.0.1";
        var app=new App(host,port);
        Runtime.getRuntime().addShutdownHook(new Thread(app::close));
        System.out.println("Squelch Java: http://"+host+":"+app.port()+"  (Ctrl+C to stop)");
    }
    private void handle(HttpExchange x) throws IOException {
        try {
            x.getResponseHeaders().set("X-Content-Type-Options","nosniff");
            x.getResponseHeaders().set("Cache-Control","no-store");
            String path=x.getRequestURI().getPath();
            String expected=path.equals("/api/export")?"POST":"GET";
            if (!x.getRequestMethod().equals(expected)) {
                x.getResponseHeaders().set("Allow",expected);
                json(x,405,"{\"error\":\"Method not allowed\"}"); return;
            }
            switch(path) {
                case "/api/health" -> json(x,200,"{\"status\":\"ok\"}");
                case "/api/config" -> json(x,200,config());
                case "/api/generate" -> {
                    var p=form(x.getRequestURI().getRawQuery());
                    var s=new Generator.Settings(integer(p,"root",33),p.getOrDefault("scaleId","minor"),
                        integer(p,"steps",16),decimal(p,"density",0.7),decimal(p,"accentChance",0.35),
                        decimal(p,"slideChance",0.3),integer(p,"octaves",2));
                    json(x,200,Generator.generate(s,ThreadLocalRandom.current()::nextDouble).toJson());
                }
                case "/api/export" -> export(x);
                default -> {
                    if (path.startsWith("/api/")) json(x,404,"{\"error\":\"Not found\"}");
                    else asset(x,path);
                }
            }
        } catch (IllegalArgumentException e) {
            json(x,400,"{\"error\":"+Json.quote(e.getMessage()==null?"Invalid request":e.getMessage())+"}");
        } catch (Exception e) {
            System.err.println("Request failed: "+e.getClass().getSimpleName());
            json(x,500,"{\"error\":\"Internal server error\"}");
        } finally { x.close(); }
    }
    private static void export(HttpExchange x) throws IOException {
        String type=x.getRequestHeaders().getFirst("Content-Type");
        if (type==null || !type.split(";",2)[0].trim().equalsIgnoreCase("application/x-www-form-urlencoded")) {
            json(x,415,"{\"error\":\"Expected URL-encoded form\"}"); return;
        }
        byte[] body=x.getRequestBody().readNBytes(MAX_BODY+1);
        if (body.length>MAX_BODY) { json(x,413,"{\"error\":\"Request too large\"}"); return; }
        var p=form(new String(body,StandardCharsets.UTF_8));
        String[] rows=p.getOrDefault("steps","").split(";",-1);
        if (!List.of(8,16,24,32).contains(rows.length)) throw new IllegalArgumentException("Invalid pattern length");
        var steps=new ArrayList<Step>();
        for (String row:rows) {
            String[] fields=row.split(",",-1);
            if (fields.length!=4) throw new IllegalArgumentException("Invalid step");
            int note=Integer.parseInt(fields[1]);
            if (note<0 || note>127) throw new IllegalArgumentException("Note must be 0..127");
            steps.add(new Step(flag(fields[0]),note,flag(fields[2]),flag(fields[3])));
        }
        var pattern=new Pattern(steps,"","");
        int bpm=integer(p,"bpm",130);
        String target=p.getOrDefault("target","ableton");
        byte[] midi=MidiExporter.encode(pattern,bpm,target);
        x.getResponseHeaders().set("Content-Disposition","attachment; filename=\"squelch_"+bpm+"bpm_"+target+".mid\"");
        send(x,200,"audio/midi",midi);
    }
    private static boolean flag(String s) {
        if (s.equals("1")) return true;
        if (s.equals("0")) return false;
        throw new IllegalArgumentException("Step flags must be 0 or 1");
    }
    private static Map<String,String> form(String raw) {
        var result=new HashMap<String,String>();
        if (raw==null || raw.isEmpty()) return result;
        if (raw.length()>MAX_BODY) throw new IllegalArgumentException("Too many parameters");
        for (String entry:raw.split("&")) {
            String[] pair=entry.split("=",2);
            String key=URLDecoder.decode(pair[0],StandardCharsets.UTF_8);
            String val=pair.length==2?URLDecoder.decode(pair[1],StandardCharsets.UTF_8):"";
            if (result.putIfAbsent(key,val)!=null) throw new IllegalArgumentException("Duplicate parameter");
        }
        return result;
    }
    private static int integer(Map<String,String> p,String key,int fallback) {
        return p.containsKey(key)?Integer.parseInt(p.get(key)):fallback;
    }
    private static double decimal(Map<String,String> p,String key,double fallback) {
        return p.containsKey(key)?Double.parseDouble(p.get(key)):fallback;
    }
    private static String config() {
        var out=new StringBuilder("{\"scales\":[");
        for (int i=0;i<Music.SCALES.size();i++) {
            if(i>0)out.append(',');
            var s=Music.SCALES.get(i);
            out.append("{\"id\":").append(Json.quote(s.id())).append(",\"name\":").append(Json.quote(s.name())).append('}');
        }
        out.append("],\"roots\":[");
        for(int n=33;n<=44;n++) {
            if(n>33)out.append(',');
            out.append("{\"id\":").append(n).append(",\"name\":").append(Json.quote(Music.name(n))).append('}');
        }
        return out.append("]}").toString();
    }
    private static void asset(HttpExchange x,String path) throws IOException {
        if(path.equals("/"))path="/index.html";
        if (!path.matches("/[a-zA-Z0-9_./-]+") || path.contains("..")) {
            json(x,404,"{\"error\":\"Not found\"}"); return;
        }
        try(var in=App.class.getResourceAsStream("/web"+path)) {
            if(in==null) { json(x,404,"{\"error\":\"Not found\"}"); return; }
            String type=path.endsWith(".html")?"text/html; charset=utf-8":
                path.endsWith(".js")?"text/javascript; charset=utf-8":
                path.endsWith(".css")?"text/css; charset=utf-8":"application/octet-stream";
            x.getResponseHeaders().set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
            send(x,200,type,in.readAllBytes());
        }
    }
    private static void json(HttpExchange x,int status,String value) throws IOException {
        send(x,status,"application/json; charset=utf-8",value.getBytes(StandardCharsets.UTF_8));
    }
    private static void send(HttpExchange x,int status,String type,byte[] bytes) throws IOException {
        x.getResponseHeaders().set("Content-Type",type);
        x.sendResponseHeaders(status,bytes.length);
        x.getResponseBody().write(bytes);
    }
}
