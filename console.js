"use strict";

/* ==========================================================================
 * Console view for "Pipe & Pedal" — two manuals and a pedalboard drawn under
 * the score, with keys lighting as the notes sound.
 *
 * Two questions have to be answered to draw this, and both have exact answers
 * already sitting in the data — neither is guessed:
 *
 * 1. WHICH STAFF IS THE PEDAL. Every imported entry carries an abcjs
 *    `%%score` directive, and organ engraving puts the manuals inside the
 *    brace and the pedal outside it:
 *        %%score { ( 1 2 ) | ( 3 4 5 6 ) } 7
 *                  \___ manual staves ___/  ^ pedal
 *    So: staves inside a { } or [ ] group are manuals, staves outside one are
 *    the pedal — and a directive with no group at all (or a braced-only two
 *    stave grand staff) is manuals-only, pedalboard dark. `parseScoreLayout`
 *    below is that rule and nothing more. A piece whose engraving disagrees
 *    (a two-stave chorale setting whose lower staff really is the pedal) can
 *    override it with a `console: { manualStaves: 1, pedalStaves: 1 }` field
 *    in data/pieces.js.
 *
 * 2. WHICH PITCHES ARE SOUNDING, ON WHICH STAFF. Do NOT read these off the
 *    TimingCallbacks event: `ev.midiPitches` is concatenated across voices
 *    with no voice tag, so per-manual attribution from it is guesswork. What
 *    is exact is `visualObj.lines[].staff[].voices[][]` — abcjs has already
 *    grouped voices into staves there, honouring %%score, and each element
 *    carries `startChar` and (after audio setup) `midiPitches`. Walking that
 *    once gives startChar -> {staff, voice, pitches}, and the playback event's
 *    `startCharArray` then says which of those are being struck right now. No
 *    time arithmetic, no DOM-class parsing, no assumption about array order.
 *
 * State is kept per voice, not per event, so a held pedal note stays lit while
 * the manuals move above it; a rest clears its own voice only.
 *
 * The map is built from the RAW visualObj, never from
 * REGISTRATION.makeAudioTune() — `expandForStops` clones every track once per
 * stop rank at `pitch + rank.semitones`, so a 16' or 4' stop would light
 * phantom keys an octave away. The console shows written pitch; ranks are an
 * audio concern.
 * ========================================================================== */

window.CONSOLE = (function () {
  /* ---- Keyboard compass ------------------------------------------------- */

  const MANUAL_LOW = 36, MANUAL_HIGH = 96;   // C2–C7, 61 keys (a standard manual)
  const PEDAL_LOW = 36, PEDAL_HIGH = 67;     // C2–G4, 32 keys (AGO pedalboard)

  const BLACK = { 1: true, 3: true, 6: true, 8: true, 10: true };
  const isBlack = (midi) => !!BLACK[((midi % 12) + 12) % 12];

  // Geometry (SVG user units; the whole thing scales fluidly via viewBox).
  const PAD_LEFT = 26;
  const MANUAL = { white: 14, whiteH: 40, black: 8, blackH: 25 };
  const PEDAL = { white: 26, whiteH: 32, black: 12, blackH: 19 };
  const ROW_GAP = 7;
  const BOARD_GAP = 15;

  /* ---- 1. Layout: which staves are manuals, which are pedal -------------- */

  // Count the staves in an abcjs %%score directive, split into those inside a
  // brace/bracket group (manuals) and those outside one (pedal). A `( … )`
  // group is several voices sharing ONE staff; a bare voice id is a staff of
  // its own; `|` only means "draw barlines through", so it is skipped.
  function parseScoreLayout(abc) {
    const line = /^%%score[ \t]+(.+)$/m.exec(abc || "");
    if (!line) return { manualStaves: 0, pedalStaves: 0, staves: 0, source: "none" };

    const spec = line[1];
    let depth = 0, grouped = 0, free = 0, i = 0;
    while (i < spec.length) {
      const c = spec[i];
      if (c === "{" || c === "[") { depth++; i++; }
      else if (c === "}" || c === "]") { depth = Math.max(0, depth - 1); i++; }
      else if (c === "(") {                       // one staff, several voices
        const close = spec.indexOf(")", i);
        if (depth > 0) grouped++; else free++;
        i = close === -1 ? spec.length : close + 1;
      } else if (/[\s|*]/.test(c)) { i++; }
      else {                                      // a bare voice id = one staff
        let j = i;
        while (j < spec.length && !/[\s|(){}[\]*]/.test(spec[j])) j++;
        if (j > i) { if (depth > 0) grouped++; else free++; }
        i = Math.max(j, i + 1);
      }
    }

    // Free staves only mean "pedal" when there is a group to be outside of.
    // A flat `%%score 1 2` is an ungrouped grand staff, not a manual + pedal.
    if (grouped > 0 && free > 0) {
      return { manualStaves: grouped, pedalStaves: free, staves: grouped + free, source: "braced+pedal" };
    }
    // Three or more staves all inside one brace (10 entries here): organ is not
    // engraved on three manual staves — that is two manuals over a pedal staff
    // whose engraver braced all three. The bottom staff is the pedal. This one
    // is an inference, unlike the explicit trailing-staff case above; a piece
    // it gets wrong can say so with a `console:` override.
    if (grouped >= 3) {
      return { manualStaves: grouped - 1, pedalStaves: 1, staves: grouped, source: "braced3" };
    }
    const manualStaves = grouped > 0 ? grouped : free;
    return {
      manualStaves, pedalStaves: 0, staves: manualStaves,
      source: grouped > 0 ? "braced" : "flat",
    };
  }

  // The layout actually used for a piece: its %%score, unless the entry
  // overrides it. Never trusts an override that claims more staves than exist.
  function layoutFor(piece, abc) {
    const parsed = parseScoreLayout(abc);
    const override = piece && piece.console;
    if (override && typeof override.manualStaves === "number") {
      return {
        manualStaves: Math.max(0, override.manualStaves),
        pedalStaves: Math.max(0, override.pedalStaves || 0),
        staves: parsed.staves,
        source: "override",
      };
    }
    return parsed;
  }

  /* ---- 2. Map: startChar -> {staff, voice, pitches} ---------------------- */

  // Walk the rendered tune once. `midiPitches` is filled in by setUpAudio(),
  // so this is built lazily at first playback event rather than at render.
  function buildMap(visualObj, layout) {
    const map = new Map();
    let staffCount = 0;
    (visualObj.lines || []).forEach((line) => {
      if (!line.staff) return;
      staffCount = Math.max(staffCount, line.staff.length);
      line.staff.forEach((staff, si) => {
        (staff.voices || []).forEach((voice, vi) => {
          (voice || []).forEach((el) => {
            if (!el || el.el_type !== "note") return;
            if (typeof el.startChar !== "number") return;
            map.set(el.startChar, {
              key: si + ":" + vi,
              staff: si,
              // A rest has no midiPitches — an empty list, which clears the voice.
              pitches: (el.midiPitches || []).map((p) => p.pitch),
            });
          });
        });
      });
    });
    return { map, staffCount, layout };
  }

  // Which board a staff index belongs to. The pedal is the LAST pedalStaves
  // staves — %%score lists them after the closing brace, and abcjs renders
  // them in that order.
  function boardFor(staffIdx, staffCount, layout) {
    const pedalFrom = staffCount - (layout.pedalStaves || 0);
    if (layout.pedalStaves > 0 && staffIdx >= pedalFrom) return "pedal";
    return staffIdx === 0 ? "manual1" : "manual2";
  }

  /* ---- Drawing ----------------------------------------------------------- */

  function svgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  // One keyboard row. Returns {width, keys: Map(midi -> [elements])} so light()
  // can find a key by pitch without re-querying the DOM.
  function drawKeyboard(parent, low, high, y, dims, cls) {
    const keys = new Map();
    const register = (midi, el) => {
      if (!keys.has(midi)) keys.set(midi, []);
      keys.get(midi).push(el);
    };

    let x = PAD_LEFT;
    const whiteX = new Map();
    for (let m = low; m <= high; m++) {
      if (isBlack(m)) continue;
      const rect = svgEl("rect", {
        x, y, width: dims.white, height: dims.whiteH, rx: 2,
        class: "pp-key pp-key--white " + cls,
      });
      parent.appendChild(rect);
      register(m, rect);
      whiteX.set(m, x);
      x += dims.white;
    }
    const width = x - PAD_LEFT;

    // Blacks sit on the seam between their neighbouring whites, drawn after so
    // they paint on top.
    for (let m = low; m <= high; m++) {
      if (!isBlack(m)) continue;
      const leftWhite = whiteX.get(m - 1);
      if (leftWhite === undefined) continue;
      const rect = svgEl("rect", {
        x: leftWhite + dims.white - dims.black / 2, y,
        width: dims.black, height: dims.blackH, rx: 1.5,
        class: "pp-key pp-key--black " + cls,
      });
      parent.appendChild(rect);
      register(m, rect);
    }
    return { width, keys };
  }

  function label(parent, text, y) {
    const t = svgEl("text", { x: PAD_LEFT - 7, y, class: "pp-label" });
    t.setAttribute("text-anchor", "end");
    t.textContent = text;
    return parent.appendChild(t), t;
  }

  /* ---- Public surface ---------------------------------------------------- */

  let host = null;          // the container div
  let boards = null;        // {manual1, manual2, pedal} -> {keys}
  let lookup = null;        // {map, staffCount, layout} — built lazily
  let pending = null;       // {visualObj, layout} awaiting the lazy build
  let voiceState = null;    // voiceKey -> {board, pitches}
  let lit = [];             // elements currently carrying .pp-lit

  // Draw the console for a piece. `abc` is the rendered source (so the
  // %%score read here is exactly the one abcjs laid out).
  function render(container, piece, abc, visualObj) {
    host = container;
    boards = null; lookup = null; pending = null; voiceState = null; lit = [];
    if (!host) return;
    host.innerHTML = "";
    if (!visualObj) return;

    const layout = layoutFor(piece, abc);
    const svg = svgEl("svg", { class: "pp-console-svg", role: "img" });
    svg.setAttribute("aria-label",
      layout.pedalStaves > 0
        ? "Organ console: two manuals and a pedalboard, keys light as the notes sound"
        : "Organ console: two manuals, keys light as the notes sound (this piece has no pedal part)");

    let y = 4;
    const m1 = drawKeyboard(svg, MANUAL_LOW, MANUAL_HIGH, y, MANUAL, "pp-key--manual");
    label(svg, "I", y + MANUAL.whiteH - 12);
    y += MANUAL.whiteH + ROW_GAP;
    const m2 = drawKeyboard(svg, MANUAL_LOW, MANUAL_HIGH, y, MANUAL, "pp-key--manual");
    label(svg, "II", y + MANUAL.whiteH - 12);
    y += MANUAL.whiteH + BOARD_GAP;
    const ped = drawKeyboard(svg, PEDAL_LOW, PEDAL_HIGH, y, PEDAL,
      layout.pedalStaves > 0 ? "pp-key--pedal" : "pp-key--pedal pp-key--idle");
    label(svg, "Ped.", y + PEDAL.whiteH - 10);
    y += PEDAL.whiteH + 4;

    const width = PAD_LEFT + Math.max(m1.width, ped.width) + 6;
    svg.setAttribute("viewBox", `0 0 ${width} ${y}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("width", "100%");
    host.appendChild(svg);

    boards = { manual1: m1, manual2: m2, pedal: ped };
    pending = { visualObj, layout };
    voiceState = Object.create(null);
  }

  function clearLit() {
    lit.forEach((el) => el.classList.remove("pp-lit"));
    lit = [];
  }

  // Called on every playback event from either path. Failure here must never
  // break playback, so everything is guarded — an unlit console is the
  // degraded state, not an exception.
  function onEvent(ev) {
    if (!boards) return;
    try {
      if (!ev) { clear(); return; }
      if (!lookup && pending) {
        lookup = buildMap(pending.visualObj, pending.layout);
        pending = null;
      }
      if (!lookup) return;

      (ev.startCharArray || []).forEach((sc) => {
        const entry = lookup.map.get(sc);
        if (!entry) return;
        voiceState[entry.key] = {
          board: boardFor(entry.staff, lookup.staffCount, lookup.layout),
          pitches: entry.pitches,
        };
      });

      clearLit();
      Object.keys(voiceState).forEach((k) => {
        const st = voiceState[k];
        const board = boards[st.board];
        if (!board) return;
        st.pitches.forEach((pitch) => {
          // Out of compass: light the end key rather than lose the note.
          const isPed = st.board === "pedal";
          const low = isPed ? PEDAL_LOW : MANUAL_LOW;
          const high = isPed ? PEDAL_HIGH : MANUAL_HIGH;
          const clamped = Math.min(high, Math.max(low, pitch));
          (board.keys.get(clamped) || []).forEach((el) => {
            el.classList.add("pp-lit");
            lit.push(el);
          });
        });
      });
    } catch (err) {
      console.error("Console view failed; continuing unlit:", err);
      boards = null;
    }
  }

  function clear() {
    clearLit();
    if (voiceState) voiceState = Object.create(null);
  }

  return { parseScoreLayout, layoutFor, render, onEvent, clear };
})();
