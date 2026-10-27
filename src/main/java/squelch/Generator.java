package squelch;

import java.util.*;
import java.util.function.DoubleSupplier;
import squelch.Pattern.Step;

/** Same random walk, probabilities and RNG call order as upstream. */
public final class Generator {
    public record Settings(int root, String scaleId, int steps, double density,
                           double accentChance, double slideChance, int octaves) {
        public Settings {
            if (root<33 || root>44) throw new IllegalArgumentException("Root must be 33..44");
            Music.scale(scaleId);
            if (!List.of(8,16,24,32).contains(steps)) throw new IllegalArgumentException("Steps must be 8, 16, 24 or 32");
            if (!Double.isFinite(density) || density<0.2 || density>1) throw new IllegalArgumentException("Density must be 0.2..1");
            if (!probability(accentChance) || !probability(slideChance)) throw new IllegalArgumentException("Accents/slides must be 0..1");
            if (octaves<1 || octaves>3) throw new IllegalArgumentException("Octaves must be 1..3");
        }
        private static boolean probability(double n) { return Double.isFinite(n) && n>=0 && n<=1; }
    }
    public static Pattern generate(Settings s, DoubleSupplier rng) {
        var scale = Music.scale(s.scaleId());
        var ladder = Music.ladder(s.root(), scale, s.octaves());
        var steps = new ArrayList<Step>();
        int index=0;
        for (int i=0; i<s.steps(); i++) {
            boolean downbeat=i%4==0;
            boolean on=i==0 || rng.getAsDouble()<s.density();
            if (i==0) index=0;
            else if (on) index=next(index,ladder.size(),downbeat,rng);
            boolean accent=on && rng.getAsDouble()<Math.min(1,s.accentChance()+(downbeat?0.18:0));
            boolean slide=on && rng.getAsDouble()<s.slideChance();
            steps.add(new Step(on,ladder.get(index),accent,slide));
        }
        int hits=(int)steps.stream().filter(Step::on).count();
        int minimum=Math.max(3,steps.size()/4), guard=steps.size()*2;
        while (hits<minimum && guard-->0) {
            int i=(int)(rng.getAsDouble()*steps.size());
            if (!steps.get(i).on()) {
                steps.set(i,new Step(true,ladder.get((int)(rng.getAsDouble()*ladder.size())),
                    rng.getAsDouble()<0.3,rng.getAsDouble()<0.3));
                hits++;
            }
        }
        return new Pattern(steps,Music.name(s.root()),scale.name());
    }
    private static int next(int current,int length,boolean downbeat,DoubleSupplier rng) {
        // Preserve upstream's seven-degree heuristic even for the pentatonic scale.
        int degrees=Math.min(7,length);
        double roll=rng.getAsDouble(), snap=downbeat?0.36:0.18;
        if (roll<snap) return degrees<length && rng.getAsDouble()<0.5?degrees:0;
        if (roll<snap+0.16) return clamp(current+(rng.getAsDouble()<0.5?-1:1)*degrees,length);
        int[] deltas={-3,-2,-1,-1,1,1,2,3};
        return clamp(current+deltas[(int)(rng.getAsDouble()*deltas.length)],length);
    }
    private static int clamp(int i,int length) { return Math.max(0,Math.min(length-1,i)); }
    private Generator() {}
}
