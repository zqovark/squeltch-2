// Adapted from zqovark/squelch, commit 54b1b4e. See THIRD_PARTY_NOTICES.md.
import { AudioEngine } from "./audio/AudioEngine.js";
import { AcidVoice } from "./audio/AcidVoice.js";
import { Scheduler } from "./sequencer/Scheduler.js";
import { generatePattern, getConfig } from "./api.js";
const { roots: ROOTS, scales: SCALES } = await getConfig();
import { exportPattern } from "./api.js";
import { createDeck } from "./ui/ui.js";
// --- audio graph + transport -------------------------------------------------
const engine = new AudioEngine();
const voice = new AcidVoice(engine.ctx, engine.input);
const gen = {
    root: 33, // A1
    scaleId: "minor",
    steps: 16,
    density: 0.7,
    accentChance: 0.35,
    slideChance: 0.3,
    octaves: 2,
};
let bpm = 130;
let pattern = await generatePattern(gen);
const scheduler = new Scheduler({
    now: () => engine.now,
    getPattern: () => pattern,
    onTrigger: (step, _index, time, legato) => {
        if (step.on)
            voice.noteOn(time, step.note, step.accent, legato);
        else
            voice.noteOff(time);
    },
});
scheduler.setBpm(bpm);
// A 3/16 echo locked to the groove gives that rolling acid space.
const syncDelay = () => engine.setDelayTime(scheduler.secondsPerStep * 3);
syncDelay();
engine.setDelayMix(0.3);
// Browsers start the audio clock suspended; every entry point that should make
// sound resumes it first (we're always inside a user gesture here).
const ensureAudio = () => engine.resume();
let toggling = false;
async function togglePlay() {
    if (toggling)
        return;
    toggling = true;
    try {
        await ensureAudio();
        scheduler.toggle();
        if (!scheduler.isPlaying)
            voice.noteOff(engine.now);
        deck.setPlaying(scheduler.isPlaying);
    }
    catch {
        deck.toast('Não foi possível iniciar o áudio. Tente novamente.');
    }
    finally {
        toggling = false;
    }
}
let generationId = 0;
let pendingGeneration;
async function reroll() {
    const id = ++generationId;
    pendingGeneration?.abort();
    pendingGeneration = new AbortController();
    document.getElementById('generate')?.setAttribute('aria-busy', 'true');
    try {
        const next = await generatePattern({ ...gen }, pendingGeneration.signal);
        if (id !== generationId)
            return;
        pattern = next;
        deck.renderPattern(pattern);
    }
    catch (error) {
        if (id === generationId && error.name !== 'AbortError')
            deck.toast('Falha ao gerar. Verifique se o servidor Java está aberto.');
    }
    finally {
        if (id === generationId)
            document.getElementById('generate')?.setAttribute('aria-busy', 'false');
    }
}
function generate() {
    void ensureAudio().catch(() => { });
    void reroll();
}
function setBpm(v) {
    bpm = v;
    scheduler.setBpm(v);
    syncDelay();
}
async function exportTo(target) {
    try {
        const name = await exportPattern(pattern, bpm, target);
        deck.toast('↓ ' + name + ' — ' + (target === 'ableton' ? 'Ableton' : 'FL Studio'));
    }
    catch {
        deck.toast('Falha ao exportar. Verifique se o servidor Java está aberto.');
    }
}
function applyGen(mutate) {
    mutate();
    void reroll();
}
// --- control specs -----------------------------------------------------------
const pct = (v) => `${Math.round(v * 100)}%`;
const soundControls = [
    { kind: "slider", key: "cutoff", label: "Cutoff", min: 60, max: 4000, step: 1, value: 420, format: (v) => `${Math.round(v)} Hz`, onInput: (v) => voice.setCutoff(v) },
    { kind: "slider", key: "reso", label: "Reso", min: 1, max: 28, step: 0.5, value: 12, format: (v) => v.toFixed(1), onInput: (v) => voice.setResonance(v) },
    { kind: "slider", key: "env", label: "Env Mod", min: 0, max: 1, step: 0.01, value: 0.7, format: pct, onInput: (v) => voice.setEnvMod(v) },
    { kind: "slider", key: "decay", label: "Decay", min: 40, max: 800, step: 5, value: 220, format: (v) => `${Math.round(v)} ms`, onInput: (v) => voice.setDecay(v / 1000) },
    { kind: "slider", key: "accent", label: "Accent", min: 0, max: 1, step: 0.01, value: 0.7, format: pct, onInput: (v) => voice.setAccent(v) },
    { kind: "slider", key: "drive", label: "Drive", min: 0, max: 1, step: 0.01, value: 0.25, format: pct, onInput: (v) => engine.setDrive(v) },
    { kind: "slider", key: "delay", label: "Delay", min: 0, max: 1, step: 0.01, value: 0.3, format: pct, onInput: (v) => engine.setDelayMix(v) },
    { kind: "slider", key: "volume", label: "Volume", min: 0, max: 1, step: 0.01, value: 0.85, format: pct, onInput: (v) => engine.setMasterVolume(v) },
    { kind: "seg", key: "wave", label: "Wave", value: "sawtooth", options: [{ value: "sawtooth", label: "SAW" }, { value: "square", label: "SQR" }], onInput: (v) => voice.setWaveform(v) },
];
const genControls = [
    { kind: "select", key: "scale", label: "Scale", value: gen.scaleId, options: SCALES.map((s) => ({ value: s.id, label: s.name })), onInput: (v) => applyGen(() => (gen.scaleId = v)) },
    { kind: "select", key: "root", label: "Key", value: String(gen.root), options: ROOTS.map((r) => ({ value: String(r.id), label: r.name })), onInput: (v) => applyGen(() => (gen.root = Number(v))) },
    { kind: "select", key: "steps", label: "Steps", value: String(gen.steps), options: [8, 16, 24, 32].map((n) => ({ value: String(n), label: String(n) })), onInput: (v) => applyGen(() => (gen.steps = Number(v))) },
    { kind: "slider", key: "density", label: "Density", min: 0.2, max: 1, step: 0.01, value: gen.density, format: pct, onInput: (v) => applyGen(() => (gen.density = v)) },
    { kind: "slider", key: "accents", label: "Accents", min: 0, max: 1, step: 0.01, value: gen.accentChance, format: pct, onInput: (v) => applyGen(() => (gen.accentChance = v)) },
    { kind: "slider", key: "slides", label: "Slides", min: 0, max: 1, step: 0.01, value: gen.slideChance, format: pct, onInput: (v) => applyGen(() => (gen.slideChance = v)) },
    { kind: "select", key: "octaves", label: "Octaves", value: String(gen.octaves), options: [1, 2, 3].map((n) => ({ value: String(n), label: String(n) })), onInput: (v) => applyGen(() => (gen.octaves = Number(v))) },
];
// --- mount UI ----------------------------------------------------------------
const mount = document.getElementById("app");
const deck = createDeck(mount, {
    soundControls,
    genControls,
    initialBpm: bpm,
    analyser: engine.analyser,
    getPlayhead: () => scheduler.currentStep(),
    onTogglePlay: () => void togglePlay(),
    onGenerate: () => void generate(),
    onBpm: setBpm,
    onExport: exportTo,
});
deck.renderPattern(pattern);
// --- keyboard: space = play/stop, G = new line -------------------------------
window.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey)
        return;
    const target = e.target;
    if (target instanceof HTMLElement && target.matches('input, select, textarea, button, [contenteditable="true"]'))
        return;
    if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
    }
    else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        void generate();
    }
});
