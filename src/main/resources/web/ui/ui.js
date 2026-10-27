// Adapted from zqovark/squelch, commit 54b1b4e. See THIRD_PARTY_NOTICES.md.
import { midiToName } from "../music/scales.js";
const SMILE_SVG = `
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <circle class="face" cx="20" cy="20" r="16" />
    <circle class="eye" cx="14" cy="16" r="2.2" />
    <circle class="eye" cx="26" cy="16" r="2.2" />
    <path class="face" d="M12 24 Q20 32 28 24" />
  </svg>`;
export function createDeck(mount, config) {
    mount.innerHTML = `
    <div class="deck">
      <header class="topbar">
        <div class="brand">
          <h1>squelch</h1>
          <p>acid bassline sketch</p>
        </div>
        <div class="transport">
          <button class="btn play" id="play" aria-label="Play / stop (Space)" aria-pressed="false" title="Play / stop (Space)">▶</button>
          <div class="tempo">
            <label for="bpm">Tempo</label>
            <input type="range" id="bpm" min="80" max="180" step="1" value="${config.initialBpm}" />
            <output id="bpmVal">${config.initialBpm} BPM</output>
          </div>
          <button class="btn generate" id="generate" aria-label="New line (G)" title="New line (G)">${SMILE_SVG}</button>
        </div>
        <div class="hint">SPACE play / stop · G or ☻ new line</div>
      </header>

      <section class="stage">
        <div class="patmeta">
          <span id="patKey">—</span>
          <span id="patLen"></span>
        </div>
        <div class="steps" id="steps"></div>
        <canvas class="scope" id="scope" aria-label="Audio waveform"></canvas>
        <div class="exportbar">
          <span class="exlabel">Export bassline →</span>
          <button class="btn export" id="exportAbleton">Ableton</button>
          <button class="btn export" id="exportFL">FL Studio</button>
          <span class="exhint">Standard MIDI · drop the .mid on a MIDI / instrument track</span>
        </div>
      </section>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>

      <section class="panels">
        <div class="panel">
          <h2>sound</h2>
          <div class="knobs" id="soundKnobs"></div>
        </div>
        <div class="panel">
          <h2>generate</h2>
          <div class="knobs" id="genKnobs"></div>
        </div>
      </section>
    </div>`;
    const $ = (sel) => mount.querySelector(sel);
    const playBtn = $("#play");
    const genBtn = $("#generate");
    const bpmInput = $("#bpm");
    const bpmVal = $("#bpmVal");
    const stepsEl = $("#steps");
    const patKey = $("#patKey");
    const patLen = $("#patLen");
    const scope = $("#scope");
    // Blur after click so the button doesn't keep keyboard focus and re-fire on
    // the next Space/G (which we handle globally).
    playBtn.addEventListener("click", () => {
        config.onTogglePlay();
        playBtn.blur();
    });
    genBtn.addEventListener("click", () => {
        config.onGenerate();
        genBtn.blur();
    });
    const exAbleton = $("#exportAbleton");
    const exFL = $("#exportFL");
    exAbleton.addEventListener("click", () => {
        config.onExport("ableton");
        exAbleton.blur();
    });
    exFL.addEventListener("click", () => {
        config.onExport("fl-studio");
        exFL.blur();
    });
    bpmInput.addEventListener("input", () => {
        const v = Number(bpmInput.value);
        bpmVal.textContent = `${v} BPM`;
        config.onBpm(v);
    });
    renderControls($("#soundKnobs"), config.soundControls);
    renderControls($("#genKnobs"), config.genControls);
    // --- pattern grid ----------------------------------------------------------
    let cells = [];
    let activeIdx = -1;
    function renderPattern(pattern) {
        const ons = pattern.steps.filter((s) => s.on).map((s) => s.note);
        const min = ons.length ? Math.min(...ons) : 0;
        const max = ons.length ? Math.max(...ons) : 1;
        const span = Math.max(1, max - min);
        stepsEl.innerHTML = "";
        cells = pattern.steps.map((step, i) => {
            const cell = document.createElement("div");
            cell.className = "step";
            if (i % 4 === 0)
                cell.classList.add("beat");
            if (!step.on)
                cell.classList.add("rest");
            if (step.on && step.accent)
                cell.classList.add("accent");
            if (step.on && step.slide)
                cell.classList.add("slide");
            const h = step.on ? 30 + ((step.note - min) / span) * 70 : 12;
            cell.innerHTML = `
        <div class="bar" style="height:${h}%"></div>
        <span class="note">${step.on ? midiToName(step.note) : "·"}</span>`;
            stepsEl.appendChild(cell);
            return cell;
        });
        activeIdx = -1;
        patKey.innerHTML = `<b>${pattern.rootName}</b> ${pattern.scaleName}`;
        patLen.textContent = `${pattern.steps.length} steps`;
    }
    function setPlaying(playing) {
        playBtn.classList.toggle("playing", playing);
        playBtn.setAttribute("aria-pressed", String(playing));
        playBtn.textContent = playing ? "■" : "▶";
    }
    const toastEl = $("#toast");
    let toastTimer = 0;
    function toast(message) {
        toastEl.textContent = message;
        toastEl.classList.add("show");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 2600);
    }
    // --- animation loop: playhead + oscilloscope -------------------------------
    const ctx2d = scope.getContext("2d");
    const scopeData = new Uint8Array(config.analyser.fftSize);
    function resizeScope() {
        const dpr = window.devicePixelRatio || 1;
        const rect = scope.getBoundingClientRect();
        scope.width = Math.max(1, Math.floor(rect.width * dpr));
        scope.height = Math.max(1, Math.floor(rect.height * dpr));
    }
    resizeScope();
    window.addEventListener("resize", resizeScope);
    function frame() {
        // playhead
        const idx = config.getPlayhead();
        if (idx !== activeIdx) {
            if (cells[activeIdx])
                cells[activeIdx].classList.remove("playing");
            if (idx >= 0 && cells[idx])
                cells[idx].classList.add("playing");
            activeIdx = idx;
        }
        // oscilloscope
        config.analyser.getByteTimeDomainData(scopeData);
        const w = scope.width;
        const h = scope.height;
        ctx2d.clearRect(0, 0, w, h);
        ctx2d.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 1.4);
        ctx2d.strokeStyle = "#c6ff3a";
        ctx2d.shadowColor = "rgba(198,255,58,0.6)";
        ctx2d.shadowBlur = 8;
        ctx2d.beginPath();
        const slice = w / scopeData.length;
        for (let i = 0; i < scopeData.length; i++) {
            const y = (scopeData[i] / 255) * h;
            const x = i * slice;
            i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { renderPattern, setPlaying, toast };
}
function renderControls(container, specs) {
    for (const spec of specs) {
        const wrap = document.createElement("div");
        wrap.className = "knob";
        if (spec.kind === "slider") {
            wrap.innerHTML = `
        <div class="row">
          <label for="control-${spec.key}">${spec.label}</label>
          <span class="val">${spec.format(spec.value)}</span>
        </div>
        <input id="control-${spec.key}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${spec.value}" />`;
            const input = wrap.querySelector("input");
            const val = wrap.querySelector(".val");
            input.addEventListener("input", () => {
                const v = Number(input.value);
                val.textContent = spec.format(v);
                spec.onInput(v);
            });
        }
        else if (spec.kind === "select") {
            wrap.innerHTML = `<label for="control-${spec.key}">${spec.label}</label>`;
            const select = document.createElement("select");
            select.id = `control-${spec.key}`;
            for (const o of spec.options) {
                const opt = document.createElement("option");
                opt.value = o.value;
                opt.textContent = o.label;
                if (o.value === spec.value)
                    opt.selected = true;
                select.appendChild(opt);
            }
            select.addEventListener("change", () => spec.onInput(select.value));
            wrap.appendChild(select);
        }
        else {
            wrap.innerHTML = `<label>${spec.label}</label>`;
            const seg = document.createElement("div");
            seg.className = "seg";
            seg.setAttribute("role", "group");
            seg.setAttribute("aria-label", spec.label);
            for (const o of spec.options) {
                const b = document.createElement("button");
                b.textContent = o.label;
                if (o.value === spec.value)
                    b.classList.add("active");
                b.addEventListener("click", () => {
                    seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
                    b.classList.add("active");
                    spec.onInput(o.value);
                });
                seg.appendChild(b);
            }
            wrap.appendChild(seg);
        }
        container.appendChild(wrap);
    }
}
