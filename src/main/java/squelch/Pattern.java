package squelch;

import java.util.List;

public record Pattern(List<Step> steps, String rootName, String scaleName) {
    public Pattern { steps = List.copyOf(steps); }
    public record Step(boolean on, int note, boolean accent, boolean slide) {}
    public String toJson() {
        var out = new StringBuilder("{\"rootName\":").append(Json.quote(rootName))
            .append(",\"scaleName\":").append(Json.quote(scaleName)).append(",\"steps\":[");
        for (int i=0; i<steps.size(); i++) {
            if (i>0) out.append(',');
            Step s=steps.get(i);
            out.append("{\"on\":").append(s.on()).append(",\"note\":").append(s.note())
                .append(",\"accent\":").append(s.accent()).append(",\"slide\":").append(s.slide()).append('}');
        }
        return out.append("]}").toString();
    }
}
