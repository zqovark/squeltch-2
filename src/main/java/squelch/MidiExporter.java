package squelch;

import javax.sound.midi.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Standard MIDI File type 1: conductor + bassline, PPQ 96, 4/4. */
public final class MidiExporter {
    public static byte[] encode(Pattern pattern, int bpm, String target) {
        if (bpm<40 || bpm>240) throw new IllegalArgumentException("BPM must be 40..240");
        String label=switch(target) {
            case "ableton" -> "Ableton Live";
            case "fl-studio" -> "FL Studio";
            default -> throw new IllegalArgumentException("Unknown DAW target");
        };
        try {
            Sequence sequence=new Sequence(Sequence.PPQ,96);
            Track conductor=sequence.createTrack(), notes=sequence.createTrack();
            int tempo=(int)Math.round(60_000_000.0/bpm);
            meta(conductor,0x51,new byte[]{(byte)(tempo>>16),(byte)(tempo>>8),(byte)tempo},0);
            meta(conductor,0x58,new byte[]{4,2,24,8},0);
            meta(notes,0x03,("squelch acid ("+label+")").getBytes(StandardCharsets.US_ASCII),0);
            notes.add(new MidiEvent(new ShortMessage(ShortMessage.PROGRAM_CHANGE,0,38,0),0));
            long end=pattern.steps().size()*24L;
            for (int i=0; i<pattern.steps().size(); i++) {
                var step=pattern.steps().get(i);
                if (!step.on()) continue;
                long start=i*24L, off=Math.min(start+(step.slide()?32:12),end);
                notes.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_ON,0,step.note(),step.accent()?118:92),start));
                notes.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_OFF,0,step.note(),0),off));
            }
            meta(conductor,0x2f,new byte[0],end);
            meta(notes,0x2f,new byte[0],end);
            var out=new ByteArrayOutputStream();
            MidiSystem.write(sequence,1,out);
            return out.toByteArray();
        } catch (InvalidMidiDataException | IOException e) { throw new IllegalStateException("Cannot encode MIDI",e); }
    }
    private static void meta(Track track,int type,byte[] data,long tick) throws InvalidMidiDataException {
        track.add(new MidiEvent(new MetaMessage(type,data,data.length),tick));
    }
    private MidiExporter() {}
}
