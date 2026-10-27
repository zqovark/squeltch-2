package squelch;

import java.util.*;

/** Scale tables and note naming, ported from the original Squelch. */
public final class Music {
    public record Scale(String id, String name, List<Integer> intervals) {}
    public static final List<Scale> SCALES = List.of(
        new Scale("minor", "Minor", List.of(0,2,3,5,7,8,10)),
        new Scale("phrygian", "Phrygian", List.of(0,1,3,5,7,8,10)),
        new Scale("minorPenta", "Minor Pentatonic", List.of(0,3,5,7,10)),
        new Scale("dorian", "Dorian", List.of(0,2,3,5,7,9,10)),
        new Scale("harmonicMinor", "Harmonic Minor", List.of(0,2,3,5,7,8,11)),
        new Scale("major", "Major", List.of(0,2,4,5,7,9,11)));
    private static final String[] NAMES = {"C","C#","D","D#","E","F","F#","G","G#","A","A#","B"};
    public static String name(int midi) { return NAMES[Math.floorMod(midi,12)] + (Math.floorDiv(midi,12)-1); }
    public static Scale scale(String id) {
        return SCALES.stream().filter(s -> s.id().equals(id)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unknown scale"));
    }
    public static List<Integer> ladder(int root, Scale scale, int octaves) {
        var notes = new ArrayList<Integer>();
        for (int o=0; o<octaves; o++) for (int interval: scale.intervals()) notes.add(root+12*o+interval);
        return notes;
    }
    private Music() {}
}
