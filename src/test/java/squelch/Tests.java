package squelch;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.sound.midi.*;
import squelch.Pattern.Step;

/** Dependency-free regression suite. Failures always throw, without -ea. */
public final class Tests {
    private static int checks;
    private static void check(boolean ok,String message) {
        checks++;
        if(!ok) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        generatorParity(); midi(); http();
        System.out.println("PASS: "+checks+" checks; 216 upstream generator fixtures, MIDI semantics and HTTP integration.");
    }
    private static void generatorParity() throws Exception {
        try(var input=Tests.class.getResourceAsStream("/generator-fixtures.tsv")) {
            if(input==null)throw new AssertionError("Fixtures missing");
            var lines=new String(input.readAllBytes(),StandardCharsets.UTF_8).lines().toList();
            check(lines.size()==216,"fixture count");
            for(String line:lines) {
                String[] p=line.split("\t");
                var s=new Generator.Settings(Integer.parseInt(p[0]),p[1],Integer.parseInt(p[2]),
                    Double.parseDouble(p[3]),Double.parseDouble(p[4]),Double.parseDouble(p[5]),Integer.parseInt(p[6]));
                long[] state={Long.parseLong(p[7])};
                var pattern=Generator.generate(s,()->{
                    state[0]=(state[0]*1664525L+1013904223L)&0xffffffffL;
                    return state[0]/4294967296.0;
                });
                check(signature(pattern).equals(p[8]),"Original generator mismatch: "+line);
                check(pattern.rootName().equals(Music.name(s.root())),"root name");
                check(pattern.scaleName().equals(Music.scale(s.scaleId()).name()),"scale name");
                check(pattern.steps().get(0).on() && pattern.steps().get(0).note()==s.root(),"root anchor");
                var ladder=Music.ladder(s.root(),Music.scale(s.scaleId()),s.octaves());
                check(pattern.steps().stream().allMatch(n->ladder.contains(n.note())),"scale membership");
            }
        }
    }
    private static String signature(Pattern p) {
        return String.join(";",p.steps().stream().map(s->(s.on()?1:0)+","+s.note()+","+(s.accent()?1:0)+","+(s.slide()?1:0)).toList());
    }
    private static void midi() throws Exception {
        for(int length:new int[]{8,16,24,32}) for(String target:List.of("ableton","fl-studio")) {
            var steps=new ArrayList<Step>();
            for(int i=0;i<length;i++)steps.add(new Step(i%4!=2,33+i%12,i%3==0,i%2==0 || i==length-1));
            var p=new Pattern(steps,"A1","Minor");
            byte[] data=MidiExporter.encode(p,137,target);
            check(new String(data,0,4,StandardCharsets.US_ASCII).equals("MThd"),"MIDI header");
            var format=MidiSystem.getMidiFileFormat(new ByteArrayInputStream(data));
            check(format.getType()==1,"MIDI type 1");
            Sequence seq=MidiSystem.getSequence(new ByteArrayInputStream(data));
            check(seq.getResolution()==96 && seq.getTracks().length==2,"PPQ and tracks");
            check(seq.getTickLength()==length*24L,"exact loop length");
            var conductor=seq.getTracks()[0];
            check(((MetaMessage)conductor.get(0).getMessage()).getType()==0x51,"tempo present");
            byte[] tempo=((MetaMessage)conductor.get(0).getMessage()).getData();
            int micros=((tempo[0]&255)<<16)|((tempo[1]&255)<<8)|(tempo[2]&255);
            check(micros==Math.round(60_000_000.0/137),"tempo value");
            check(Arrays.equals(((MetaMessage)conductor.get(1).getMessage()).getData(),new byte[]{4,2,24,8}),"time signature");
            var actual=new ArrayList<String>();
            Track track=seq.getTracks()[1];
            for(int i=0;i<track.size();i++) {
                MidiEvent e=track.get(i);
                if(e.getMessage() instanceof ShortMessage m && (m.getCommand()==0x90 || m.getCommand()==0x80))
                    actual.add(e.getTick()+":"+m.getCommand()+":"+m.getData1()+":"+m.getData2());
            }
            var expected=new ArrayList<String>();
            for(int i=0;i<length;i++) {
                var s=steps.get(i);
                if(!s.on())continue;
                expected.add((i*24L)+":144:"+s.note()+":"+(s.accent()?118:92));
                expected.add(Math.min(i*24L+(s.slide()?32:12),length*24L)+":128:"+s.note()+":0");
            }
            Collections.sort(actual); Collections.sort(expected);
            check(actual.equals(expected),"notes, rests, accents, slide overlap and final clipping");
        }
    }
    private static void http() throws Exception {
        try(var app=new App("127.0.0.1",0)) {
            var client=HttpClient.newHttpClient();
            String base="http://127.0.0.1:"+app.port();
            check(get(client,base+"/").statusCode()==200,"home");
            check(get(client,base+"/main.js").headers().firstValue("Content-Type").orElse("").startsWith("text/javascript"),"JS MIME");
            check(get(client,base+"/api/config").body().contains("harmonicMinor"),"config");
            check(get(client,base+"/api/generate").body().contains("\"note\":33"),"generation");
            for(String query:List.of("steps=7","root=200","scaleId=no","density=NaN","density=0","accentChance=2","slideChance=-1","octaves=4","root=33&root=34"))
                check(get(client,base+"/api/generate?"+query).statusCode()==400,"invalid query: "+query);
            check(get(client,base+"/api/export").statusCode()==405,"method guard");
            check(get(client,base+"/api/missing").statusCode()==404,"missing API");
            check(get(client,base+"/%2e%2e/App.class").statusCode()==404,"traversal");
            var p=new Pattern(Collections.nCopies(16,new Step(true,45,true,true)),"A2","Minor");
            String form="bpm=130&target=ableton&steps="+URLEncoder.encode(signature(p),StandardCharsets.UTF_8);
            var export=post(client,base+"/api/export",form,"application/x-www-form-urlencoded");
            check(export.statusCode()==200,"export response");
            check(MidiSystem.getSequence(new ByteArrayInputStream(export.body())).getTickLength()==384,"export current pattern");
            check(post(client,base+"/api/export",form.replace("bpm=130","bpm=0"),"application/x-www-form-urlencoded").statusCode()==400,"invalid tempo");
            check(post(client,base+"/api/export",form.replace("ableton","bad"),"application/x-www-form-urlencoded").statusCode()==400,"invalid target");
            check(post(client,base+"/api/export","steps=1,999,1,1","application/x-www-form-urlencoded").statusCode()==400,"invalid pattern");
            check(post(client,base+"/api/export",form,"text/plain").statusCode()==415,"content type guard");
            check(post(client,base+"/api/export","x".repeat(17_000),"application/x-www-form-urlencoded").statusCode()==413,"body limit");
            var futures=new ArrayList<java.util.concurrent.CompletableFuture<HttpResponse<String>>>();
            for(int i=0;i<24;i++)futures.add(client.sendAsync(HttpRequest.newBuilder(URI.create(base+"/api/generate?steps=32")).build(),HttpResponse.BodyHandlers.ofString()));
            for(var f:futures)check(f.join().statusCode()==200,"concurrent requests");
        }
    }
    private static HttpResponse<String> get(HttpClient client,String uri) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(uri)).build(),HttpResponse.BodyHandlers.ofString());
    }
    private static HttpResponse<byte[]> post(HttpClient client,String uri,String data,String type) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(uri)).header("Content-Type",type)
            .POST(HttpRequest.BodyPublishers.ofString(data)).build(),HttpResponse.BodyHandlers.ofByteArray());
    }
}
