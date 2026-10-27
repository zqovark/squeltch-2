// Browser-only pitch conversion. Scales and roots are provided by Java.
export function midiToFreq(midi) { return 440 * Math.pow(2, (midi-69)/12); }
export function midiToName(midi) { return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((midi%12)+12)%12] + (Math.floor(midi/12)-1); }
