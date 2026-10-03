"use strict";

/* ==========================================================================
 * Pipe & Pedal — an organ explorer.
 *
 * Shows one randomly chosen public-domain organ piece: its opening bars
 * (rendered + played by abcjs), a metadata/info block, Wikipedia links, and a
 * "more by this composer" list you can click through. Notes highlight in sync
 * with playback via abcjs's native TimingCallbacks.
 * ========================================================================== */

/* ---- Data ---------------------------------------------------------------- */

const PIECES = Array.isArray(window.ORGAN_PIECES) ? window.ORGAN_PIECES : [];
const COMPOSERS = window.ORGAN_COMPOSERS || {};

// pieces grouped by composerId → enables "more by this composer"
const BY_COMPOSER = PIECES.reduce((map, p) => {
  (map[p.composerId] = map[p.composerId] || []).push(p);
  return map;
}, {});

// movements grouped by workId, in score order → enables "movements of this work".
// Only entries carrying a workId take part: a single-movement piece has none, and
// a work whose other movements have not been imported yet has only one, so the
// chip row below stays hidden in both cases.
const BY_WORK = PIECES.reduce((map, p) => {
  if (p.workId) (map[p.workId] = map[p.workId] || []).push(p);
  return map;
}, {});
Object.values(BY_WORK).forEach((ms) => ms.sort((a, b) => a.movement - b.movement));

const byId = (id) => PIECES.find((p) => p.id === id) || null;
const composerOf = (piece) => COMPOSERS[piece.composerId] || null;

// unique genres present, alphabetical — powers the Browse form filter
const GENRES = Array.from(new Set(PIECES.map((p) => p.genre).filter(Boolean))).sort();

/* ---- Elements ------------------------------------------------------------ */

const scoreEl = document.getElementById("score");
const consoleEl = document.getElementById("console-view");
const titleEl = document.getElementById("piece-title");
const bylineEl = document.getElementById("piece-byline");
const metaEl = document.getElementById("piece-meta");
const factEl = document.getElementById("fact");
const linksEl = document.getElementById("links");
const moreByEl = document.getElementById("more-by");
const moreByNameEl = document.getElementById("more-by-name");
const moreByChipsEl = document.getElementById("more-by-chips");
const movementsEl = document.getElementById("movements");
const movementsWorkEl = document.getElementById("movements-work");
const movementsChipsEl = document.getElementById("movements-chips");
const sourceEl = document.getElementById("source-note");
const scoreCreditEl = document.getElementById("score-credit");
const nextBtn = document.getElementById("next-btn");
const backBtn = document.getElementById("back-btn");
const playBtn = document.getElementById("play-btn");
const playNote = document.getElementById("play-note");
const modeToggle = document.getElementById("mode-toggle");
const audioControlEl = document.getElementById("audio-control");
const stopsBtn = document.getElementById("stops-btn");
const stopsPanel = document.getElementById("stops-panel");
const stopsHintEl = document.getElementById("stops-hint");
const stopsResetBtn = document.getElementById("stops-reset");
const stopsRowEls = {
  flue: stopsPanel.querySelector('.stops-row[data-family="flue"]'),
  reed: stopsPanel.querySelector('.stops-row[data-family="reed"]'),
  string: stopsPanel.querySelector('.stops-row[data-family="string"]'),
};

const chantHeadEl = document.querySelector(".chant-head");
const scoreCardEl = document.querySelector(".score-card");
const infoEl = document.getElementById("info");
const actionsEl = document.querySelector(".actions");
const browseBtn = document.getElementById("browse-btn");
const browseEl = document.getElementById("browse");
const browseSearchEl = document.getElementById("browse-search");
const browseComposerEl = document.getElementById("browse-composer");
const browseGenreEl = document.getElementById("browse-genre");
const browseListEl = document.getElementById("browse-list");
const browseCountEl = document.getElementById("browse-count");
const browseCloseBtn = document.getElementById("browse-close-btn");

/* ---- Round state --------------------------------------------------------- */

let current = null;      // the piece on screen
let visualObj = null;    // abcjs render result, reused for playback + timing
let synth = null;        // active CreateSynth instance, if any (incipit mode)
let synthControl = null; // abcjs SynthController widget, if any (full-piece mode)
let audioCtx = null;     // shared AudioContext, created on first play
let timer = null;        // abcjs TimingCallbacks, drives the note highlight
let mode = "incipit";    // "incipit" (opening bars) | "full" (whole piece, if abcFull)
let followLine = -1;     // score system the whole-piece view last scrolled to
const backStack = [];    // ids the user has visited (powers ← Back)

let activeStops = [];    // stop ids currently drawn
let suggestedStops = []; // the style-based default for the current piece
let stopsDirty = false;  // has the user deviated from the suggestion?
let stopsDebounce = null;

// Full General MIDI soundfont — includes the church organ (program 19). abcjs's
// built-in default soundfont is piano-only, so the organ voicing needs this one.
const SOUND_FONT_URL = "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/";

/* ---- Wikipedia helper ---------------------------------------------------- */

// Curated URL when present, otherwise a Wikipedia search link (never a dead end).
function wikiLink(url, query) {
  return url || `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;
}
function anchor(href, text) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = text;
  return a;
}

/* ---- Notation render (abcjs) --------------------------------------------- */

// Playback tempo. Few scores carry a numeric Q:, so abcjs would fall back to 180
// beats a minute for most of them. piece.qpm (quarter notes a minute) is set on
// the rendered tune AFTER engraving, so the printed score is unchanged; abcjs
// converts it to the meter's beat for the synth, the note highlight and the
// transport's warp control. REGISTRATION.makeAudioTune shares this metaText.
function applyDefaultTempo(tune, piece) {
  if (!tune || !piece.qpm) return;
  const tempo = tune.metaText.tempo || {};
  if (tempo.bpm) return;  // a numeric Q: in the score wins
  tune.metaText.tempo = Object.assign({}, tempo, { bpm: piece.qpm, duration: [1 / 4] });
}

// Split one voice's music into bars. A bar runs through its closing barline
// (`|`, `||`, `|]`, `|:`, `:|`, `::`, `[|`) plus any volta number (`|1`, `:|2`),
// which is how xml2abc already ends lines. Quoted text, !decorations! and inline
// [X:...] fields are skipped so a `|` or `:` inside them can't end a bar. A
// "bar" holding nothing but space (`:| |:`) folds into the one before it.
function splitBars(music) {
  const bars = [];
  let start = 0, i = 0;
  const n = music.length;
  while (i < n) {
    const c = music[i];
    if (c === '"' || c === "!") {
      const close = music.indexOf(c, i + 1);
      i = close < 0 ? n : close + 1;
      continue;
    }
    if (c === "[" && /[A-Za-z]:/.test(music.substr(i + 1, 2))) {
      const close = music.indexOf("]", i);
      i = close < 0 ? n : close + 1;
      continue;
    }
    const isBar = c === "|" || (c === ":" && (music[i + 1] === ":" || music[i + 1] === "|"))
      || (c === "[" && music[i + 1] === "|");
    if (!isBar) { i++; continue; }
    let j = i;
    while (j < n && ("|:]".includes(music[j]) || (music[j] === "[" && music[j + 1] === "|"))) j++;
    const volta = /^\[?[0-9][0-9,\-]*/.exec(music.slice(j));
    if (volta) j += volta[0].length;
    const text = music.slice(start, j);
    if (bars.length && !/[^\s|:\[\]0-9,\-]/.test(music.slice(start, i))) bars[bars.length - 1] += text;
    else bars.push(text);
    start = i = j;
  }
  const tail = music.slice(start);
  if (/\S/.test(tail)) bars.push(tail);
  else if (bars.length) bars[bars.length - 1] += tail;
  return bars;
}

// The converter wraps each voice's source lines on its own, but abcjs builds
// system k from line k of EVERY voice, and assigns audio tracks by voice position
// within a system. Mismatched breaks therefore stack bars that don't belong
// together and splice one voice's notes into another's track: scrambled sound,
// and a highlight that jumps around. Re-break every voice at the same bars, with
// a line width near the converter's own (the median source line length).
function alignSystems(abc) {
  const lines = abc.split("\n");
  const k = lines.findIndex((l) => /^K:/.test(l));
  if (k < 0) return abc;
  const head = lines.slice(0, k + 1);
  const voices = [];            // { label, music } in order of first body
  const byId = {};
  const widths = [];
  let cur = null;
  for (const line of lines.slice(k + 1)) {
    const v = /^V:\s*(\S+)/.exec(line);
    if (v) { cur = { id: v[1], label: line }; continue; }
    const music = line.replace(/\s*%(?!%).*$/, "");
    if (!cur || !music.trim()) {
      if (!cur && line.trim()) return abc;   // single-voice body: nothing to align
      continue;
    }
    if (!byId[cur.id]) {
      byId[cur.id] = { label: cur.label, music: "" };
      voices.push(byId[cur.id]);
    }
    byId[cur.id].music += " " + music.trim();
    widths.push(music.trim().length);
  }
  if (voices.length < 2) return abc;
  // V: lines with no body (the clef declarations) stay in the header.
  const declared = lines.slice(k + 1).filter((l) => /^V:/.test(l) && !voices.some((v) => v.label === l));
  const barSets = voices.map((v) => splitBars(v.music));
  const count = barSets[0].length;
  if (barSets.some((b) => b.length !== count)) {
    console.warn("alignSystems: voices have different bar counts, leaving line breaks as they are",
      barSets.map((b) => b.length));
    return abc;
  }
  widths.sort((a, b) => a - b);
  const budget = widths[Math.floor(widths.length / 2)] || 80;
  const measure = (bar) => bar.replace(/!.*?!|".*?"/g, "").trim().length;
  const breaks = [];            // bar index each system starts at
  let width = 0;
  for (let b = 0; b < count; b++) {
    const w = Math.max(...barSets.map((bars) => measure(bars[b])));
    if (b === 0 || width + w > budget) { breaks.push(b); width = 0; }
    width += w;
  }
  breaks.push(count);
  const out = head.concat(declared);
  voices.forEach((v, vi) => {
    out.push(v.label);
    for (let s = 0; s + 1 < breaks.length; s++) {
      const text = barSets[vi].slice(breaks[s], breaks[s + 1]).join("").trim();
      out.push(` ${text} %${breaks[s + 1]}`);
    }
  });
  return out.join("\n");
}

function renderScore(piece) {
  scoreEl.innerHTML = "";
  followLine = -1;
  // Full-piece mode uses abcFull (whole score) when present; otherwise the incipit.
  const full = mode === "full" && piece.abcFull;
  const source = alignSystems(full ? piece.abcFull : piece.abc);
  // The whole score is many systems tall, so let it scroll inside the card.
  scoreEl.classList.toggle("score--scroll", !!full);
  // Inject a church-organ MIDI voicing (GM program 19) for playback, after the
  // K: line. The directive doesn't render visually — it only changes the sound.
  // It's a fallback baseline: REGISTRATION.makeAudioTune() overrides the actual
  // instrument/pitch per stop at play time, but if that wrapper ever throws,
  // playback still degrades to this single organ voicing rather than silence.
  const abc = source.replace(/(K:[^\n]*\n)/, "$1%%MIDI program 19\n");
  // Fixed staffwidth; the viewBox below makes the SVG fill the card. No `scale`:
  // abcjs applies it as a CSS transform that pushed the score past the card edge.
  const rendered = window.ABCJS.renderAbc(scoreEl, abc, {
    staffwidth: 620,
    add_classes: true,   // notes get classes so TimingCallbacks can highlight them
    paddingtop: 6,
    paddingbottom: 6,
  });
  visualObj = rendered && rendered[0] ? rendered[0] : null;
  applyDefaultTempo(visualObj, piece);

  // abcjs emits a fixed-pixel width with no viewBox; convert to a fluid,
  // aspect-preserving SVG so it scales to the panel (and on tablets).
  const svg = scoreEl.querySelector("svg");
  if (svg) {
    const w = parseFloat(svg.getAttribute("width"));
    const h = parseFloat(svg.getAttribute("height"));
    if (w && h) {
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.setAttribute("width", "100%");
      svg.removeAttribute("height");
      // abcjs pins the container to a fixed height with overflow hidden; clear it
      // so the stylesheet sizes the card (and .score--scroll can scroll).
      scoreEl.style.height = "";
      scoreEl.style.overflow = "";
    }
  }

  // The console reads the same `abc` we just rendered, so the %%score it parses
  // is exactly the one abcjs laid these staves out from.
  window.CONSOLE.render(consoleEl, piece, abc, visualObj);
}

/* ---- Info block ---------------------------------------------------------- */

function metaRow(label, value) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="meta-label"></span><span class="meta-value"></span>`;
  li.querySelector(".meta-label").textContent = label;
  li.querySelector(".meta-value").textContent = value;
  return li;
}

function renderInfo(piece) {
  const c = composerOf(piece);

  titleEl.textContent = piece.title;
  bylineEl.textContent = c ? c.name : piece.composerId;

  // metadata rows (skip empties)
  metaEl.innerHTML = "";
  const rows = [
    ["Composer", c ? `${c.name}${c.born ? ` (${c.born}–${c.died})` : ""}` : piece.composerId],
    ["Catalogue", piece.catalog],
    ["Key", piece.key],
    ["Year", piece.year],
    ["Form", piece.genre],
  ];
  rows.forEach(([label, value]) => { if (value) metaEl.appendChild(metaRow(label, value)); });
  if (c && c.blurb) metaEl.appendChild(metaRow("Composer note", c.blurb));

  factEl.textContent = piece.fact || "";

  // Wikipedia links: piece + composer
  linksEl.innerHTML = "";
  linksEl.appendChild(document.createTextNode("📖 "));
  linksEl.appendChild(anchor(wikiLink(piece.wikipedia, `${piece.title} ${c ? c.name : ""}`), "This piece"));
  linksEl.appendChild(document.createTextNode("  ·  "));
  linksEl.appendChild(anchor(wikiLink(c && c.wikipedia, c ? c.name : piece.composerId), c ? c.name : "Composer"));

  // "Movements of this work" — a table of contents for a multi-movement work,
  // so the current movement is shown too, marked rather than omitted.
  const movements = BY_WORK[piece.workId] || [];
  if (movements.length > 1) {
    movementsWorkEl.textContent = piece.workTitle || "";
    movementsChipsEl.innerHTML = "";
    movements.forEach((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = p.id === piece.id ? "chip current" : "chip";
      chip.textContent = p.title;
      if (p.id === piece.id) {
        chip.setAttribute("aria-current", "true");
        chip.disabled = true;
      } else {
        chip.addEventListener("click", () => show(p, { pushHistory: true }));
      }
      movementsChipsEl.appendChild(chip);
    });
    movementsEl.hidden = false;
  } else {
    movementsEl.hidden = true;
  }

  // "More by this composer" — minus anything the movements row above already
  // offers, so a sibling movement is never listed twice on one card.
  const shown = new Set(movements.length > 1 ? movements.map((p) => p.id) : []);
  const siblings = (BY_COMPOSER[piece.composerId] || [])
    .filter((p) => p.id !== piece.id && !shown.has(p.id));
  if (siblings.length && c) {
    moreByNameEl.textContent = c.name;
    moreByChipsEl.innerHTML = "";
    siblings.forEach((p) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = p.title;
      chip.addEventListener("click", () => show(p, { pushHistory: true }));
      moreByChipsEl.appendChild(chip);
    });
    moreByEl.hidden = false;
  } else {
    moreByEl.hidden = true;
  }

  sourceEl.textContent = piece.source ? `Notation source: ${piece.source}` : "";
  scoreCreditEl.replaceChildren();
  if (piece.scoreCredit) {
    const credit = piece.scoreCredit;
    const sourceLink = document.createElement("a");
    sourceLink.href = credit.sourceUrl;
    sourceLink.textContent = credit.sourceLabel;
    const licenseLink = document.createElement("a");
    licenseLink.href = credit.licenseUrl;
    licenseLink.textContent = credit.licenseLabel;
    scoreCreditEl.append(
      document.createTextNode(`“${piece.title}” ${credit.attribution}. `),
      sourceLink,
      document.createTextNode(`. ${credit.conversion} Adapted ABC notation: `),
      licenseLink,
      document.createTextNode(".")
    );
    scoreCreditEl.hidden = false;
  } else {
    scoreCreditEl.hidden = true;
  }
}

/* ---- Registration (stops) -------------------------------------------------
 * abcjs's synth has no native drawbar model, so "stops" are approximated at
 * playback time: REGISTRATION.makeAudioTune() wraps visualObj so its audio
 * track list is expanded into one cloned, pitch-shifted, re-timbred track per
 * active stop rank. Notation rendering and note-highlight timing are
 * untouched — they keep using the original visualObj. See registration.js.
 * ---------------------------------------------------------------------- */

function buildStopsUI() {
  (window.ORGAN_STOPS || []).forEach((stop) => {
    const row = stopsRowEls[stop.family];
    if (!row) return;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `stop-${stop.id}`;
    input.className = "stop-chip-input";
    input.dataset.stopId = stop.id;
    const label = document.createElement("label");
    label.className = "stop-chip";
    label.htmlFor = input.id;
    label.textContent = stop.name;
    label.title = stop.blurb;
    row.appendChild(input);
    row.appendChild(label);
    input.addEventListener("change", onStopsChanged);
  });
}

function applySuggestedStops(piece) {
  const { stopIds, label } = window.REGISTRATION.defaultStopsFor(piece, composerOf(piece));
  suggestedStops = stopIds;
  activeStops = stopIds.slice();
  stopsDirty = false;
  syncStopCheckboxes();
  stopsHintEl.textContent = `Suggested: ${label} — change any stop below.`;
  stopsResetBtn.disabled = true;
  stopsPanel.hidden = true;
  stopsBtn.setAttribute("aria-expanded", "false");
}

function syncStopCheckboxes() {
  stopsPanel.querySelectorAll(".stop-chip-input").forEach((input) => {
    input.checked = activeStops.includes(input.dataset.stopId);
  });
}

function onStopsChanged() {
  clearTimeout(stopsDebounce);
  stopsDebounce = setTimeout(async () => {
    const checked = Array.from(stopsPanel.querySelectorAll(".stop-chip-input:checked"))
      .map((input) => input.dataset.stopId);

    if (checked.length === 0) {
      // Refuse to let the last stop be unchecked — playback should never go silent.
      syncStopCheckboxes();
      stopsHintEl.textContent = "At least one stop must be drawn.";
      return;
    }

    activeStops = checked;
    stopsDirty = JSON.stringify(activeStops.slice().sort()) !== JSON.stringify(suggestedStops.slice().sort());
    stopsResetBtn.disabled = !stopsDirty;

    const wasIncipitPlaying = !!synth;
    const wasFullLoaded = mode === "full" && !!synthControl;
    stopPlayback();

    if (mode === "full") {
      if (wasFullLoaded) {
        audioControlEl.innerHTML = "";
        await buildSynthControl();
      }
    } else if (wasIncipitPlaying) {
      await play();
    }
  }, 250);
}

stopsBtn.addEventListener("click", () => {
  const open = stopsPanel.hidden;
  stopsPanel.hidden = !open;
  stopsBtn.setAttribute("aria-expanded", String(open));
});

stopsResetBtn.addEventListener("click", () => {
  activeStops = suggestedStops.slice();
  stopsDirty = false;
  syncStopCheckboxes();
  stopsResetBtn.disabled = true;
  const label = window.REGISTRATION.defaultStopsFor(current, composerOf(current)).label;
  stopsHintEl.textContent = `Suggested: ${label} — change any stop below.`;
});

/* ---- Show a piece -------------------------------------------------------- */

function show(piece, { pushHistory = false, replaceUrl = true } = {}) {
  if (!piece) return;
  if (pushHistory && current) backStack.push(current.id);
  backBtn.hidden = backStack.length === 0;

  stopPlayback();
  current = piece;

  // Every piece opens on its incipit; tear down any full-piece audio widget first.
  mode = "incipit";
  synthControl = null;
  audioControlEl.hidden = true;
  audioControlEl.innerHTML = "";

  renderScore(piece);
  renderInfo(piece);
  applySuggestedStops(piece);

  // The "Whole piece" toggle only appears for pieces that have a full score.
  modeToggle.hidden = !piece.abcFull;
  modeToggle.setAttribute("aria-pressed", "false");
  modeToggle.textContent = "🎹 Whole piece";
  playBtn.hidden = false;
  playBtn.disabled = false;
  playNote.textContent = "";

  if (replaceUrl) {
    const url = `${location.pathname}?piece=${encodeURIComponent(piece.id)}`;
    backStack.length ? window.history.pushState({ id: piece.id }, "", url)
                     : window.history.replaceState({ id: piece.id }, "", url);
  }
}

function pickRandom() {
  if (!PIECES.length) return;
  let next = current;
  while (next === current && PIECES.length > 1) {
    next = PIECES[Math.floor(Math.random() * PIECES.length)];
  }
  show(next, { pushHistory: true });
}

function goBack() {
  const prevId = backStack.pop();
  backBtn.hidden = backStack.length === 0;
  const piece = byId(prevId);
  if (piece) show(piece, { pushHistory: false });
}

/* ---- Browse / filter ------------------------------------------------------ */

function populateBrowseFilters() {
  const composerIds = Object.keys(COMPOSERS)
    .filter((id) => BY_COMPOSER[id] && BY_COMPOSER[id].length)
    .sort((a, b) => COMPOSERS[a].name.localeCompare(COMPOSERS[b].name));
  composerIds.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = COMPOSERS[id].name;
    browseComposerEl.appendChild(opt);
  });
  GENRES.forEach((genre) => {
    const opt = document.createElement("option");
    opt.value = genre;
    opt.textContent = genre;
    browseGenreEl.appendChild(opt);
  });
}

function renderBrowseList() {
  const query = browseSearchEl.value.trim().toLowerCase();
  const composerId = browseComposerEl.value;
  const genre = browseGenreEl.value;

  const results = PIECES.filter((p) => {
    if (composerId && p.composerId !== composerId) return false;
    if (genre && p.genre !== genre) return false;
    if (query) {
      const c = composerOf(p);
      const haystack = `${p.title} ${c ? c.name : p.composerId}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  browseCountEl.textContent = results.length === PIECES.length
    ? `${results.length} pieces`
    : `${results.length} of ${PIECES.length} pieces`;

  browseListEl.innerHTML = "";
  results.forEach((p) => {
    const c = composerOf(p);
    const li = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "browse-row";
    row.innerHTML = `<span class="browse-row-title"></span><span class="browse-row-meta"></span>`;
    row.querySelector(".browse-row-title").textContent = p.title;
    row.querySelector(".browse-row-meta").textContent =
      [c ? c.name : p.composerId, p.genre].filter(Boolean).join(" · ");
    row.addEventListener("click", () => {
      closeBrowse();
      show(p, { pushHistory: true });
    });
    li.appendChild(row);
    browseListEl.appendChild(li);
  });
}

function openBrowse() {
  stopsPanel.hidden = true;
  stopsBtn.setAttribute("aria-expanded", "false");
  chantHeadEl.hidden = true;
  scoreCardEl.hidden = true;
  infoEl.hidden = true;
  actionsEl.hidden = true;
  browseEl.hidden = false;
  renderBrowseList();
  browseSearchEl.focus();
}

function closeBrowse() {
  browseEl.hidden = true;
  chantHeadEl.hidden = false;
  scoreCardEl.hidden = false;
  infoEl.hidden = false;
  actionsEl.hidden = false;
}

/* ---- Playback + follow-along highlight ----------------------------------- */

function clearScoreHighlight() {
  scoreEl.querySelectorAll(".note-playing")
    .forEach((el) => el.classList.remove("note-playing"));
}

// Full reset — score and console both dark. For starting and stopping, not for
// stepping: the console holds per-voice state between events so a sustained
// pedal note stays lit, and wiping it every event would kill that.
function clearHighlight() {
  clearScoreHighlight();
  window.CONSOLE.clear();
  followLine = -1;
}

// Whole-piece view: when playback moves to a new system, scroll the card so that
// system sits at the top. Only on a system change, so the user can still scroll
// by hand between them; a repeat or a seek-bar jump scrolls back as it should.
function followSystem(ev) {
  if (mode !== "full" || !ev || ev.line === followLine) return;
  const parts = scoreEl.querySelectorAll(`.abcjs-staff.abcjs-l${ev.line}`);
  const first = (ev.elements && ev.elements[0] && ev.elements[0][0]) || null;
  const rects = parts.length ? Array.from(parts, (el) => el.getBoundingClientRect())
    : first ? [first.getBoundingClientRect()] : [];
  if (!rects.length) return;
  followLine = ev.line;
  const top = Math.min(...rects.map((r) => r.top))
    - scoreEl.getBoundingClientRect().top + scoreEl.scrollTop - 24;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scoreEl.scrollTo({ top: Math.max(0, top), behavior: still ? "auto" : "smooth" });
}

// The one follow-along step, shared by both playback paths: light the notes on
// the score and the keys on the console. `ev` is null at the end of the tune.
function highlightEvent(ev) {
  clearScoreHighlight();
  window.CONSOLE.onEvent(ev);
  if (!ev) return;
  (ev.elements || []).forEach((set) =>
    (set || []).forEach((el) => el.classList && el.classList.add("note-playing")));
  followSystem(ev);
}

function stopPlayback() {
  if (timer) { try { timer.stop(); } catch (_) {} timer = null; }
  if (synth) { try { synth.stop(); } catch (_) {} synth = null; }
  if (synthControl) { try { synthControl.pause(); } catch (_) {} }
  clearHighlight();
}

async function play() {
  if (!visualObj) return;
  if (!window.ABCJS.synth.supportsAudio()) {
    playNote.textContent = "Audio isn't supported in this browser.";
    return;
  }
  stopPlayback();
  playBtn.disabled = true;
  playNote.textContent = "loading sound…";
  try {
    // Create/resume the audio context inside the click gesture (autoplay policy).
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const audioTune = window.REGISTRATION.makeAudioTune(visualObj, activeStops);
    synth = new window.ABCJS.synth.CreateSynth();
    await synth.init({ audioContext: audioCtx, visualObj: audioTune, options: { soundFontUrl: SOUND_FONT_URL } });
    await synth.prime();

    // Drive the note highlight off the same visualObj, started with the audio so
    // the two stay aligned. eventCallback fires per note; null fires at the end.
    timer = new window.ABCJS.TimingCallbacks(visualObj, {
      eventCallback: highlightEvent,   // null at end of tune clears both views
    });
    synth.start();
    timer.start();
    const stopNames = activeStops
      .map((id) => (window.ORGAN_STOPS.find((s) => s.id === id) || {}).name)
      .filter(Boolean).join(" · ");
    playNote.textContent = `playing — ${stopNames || "Principal 8′"}`;
  } catch (err) {
    console.error("Playback failed:", err);
    const detail = err && (err.message || err.status) ? (err.message || err.status) : String(err);
    playNote.textContent = `Couldn't play: ${detail}`;
    stopPlayback();
  } finally {
    playBtn.disabled = false;
  }
}

/* ---- Full-piece mode ----------------------------------------------------- */

// Switch between the opening-bars incipit and the whole-score view. Re-renders the
// score, then swaps the lightweight "Hear it" button (incipit) for abcjs's built-in
// audio transport with a seek bar (full piece — it can run for minutes).
async function setMode(next) {
  if (!current) return;
  stopPlayback();
  mode = next === "full" && current.abcFull ? "full" : "incipit";
  const full = mode === "full";

  renderScore(current);

  modeToggle.setAttribute("aria-pressed", full ? "true" : "false");
  modeToggle.textContent = full ? "🎼 Opening bars" : "🎹 Whole piece";
  playBtn.hidden = full;
  playNote.textContent = "";
  audioControlEl.hidden = !full;
  audioControlEl.innerHTML = "";
  synthControl = null;

  if (full) await buildSynthControl();
}

// Follow-along cursor for the SynthController — same highlight scheme as play().
const fullCursor = {
  onStart() { clearHighlight(); },
  onEvent: highlightEvent,
  onFinished() { clearHighlight(); },
};

async function buildSynthControl() {
  if (!visualObj) return;
  if (!window.ABCJS.synth.supportsAudio()) {
    audioControlEl.textContent = "Audio isn't supported in this browser.";
    return;
  }
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    synthControl = new window.ABCJS.synth.SynthController();
    synthControl.load(audioControlEl, fullCursor, {
      displayPlay: true,
      displayProgress: true,
      displayClock: true,
      displayWarp: true,
    });
    // setTune primes the whole piece into a buffer (can take a moment for a long
    // score); the widget's own play button starts it, inside the user gesture.
    const audioTune = window.REGISTRATION.makeAudioTune(visualObj, activeStops);
    await synthControl.setTune(audioTune, false, {
      audioContext: audioCtx,
      soundFontUrl: SOUND_FONT_URL,
    });
  } catch (err) {
    console.error("Full-piece audio failed:", err);
    const detail = err && (err.message || err.status) ? (err.message || err.status) : String(err);
    audioControlEl.textContent = `Couldn't load audio: ${detail}`;
  }
}

/* ---- Events -------------------------------------------------------------- */

playBtn.addEventListener("click", play);
modeToggle.addEventListener("click", () => setMode(mode === "full" ? "incipit" : "full"));
nextBtn.addEventListener("click", pickRandom);
backBtn.addEventListener("click", goBack);
browseBtn.addEventListener("click", openBrowse);
browseCloseBtn.addEventListener("click", closeBrowse);
browseSearchEl.addEventListener("input", renderBrowseList);
browseComposerEl.addEventListener("change", renderBrowseList);
browseGenreEl.addEventListener("change", renderBrowseList);

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === "Escape" && !browseEl.hidden) { closeBrowse(); return; }
  if (e.key === "Escape" && !stopsPanel.hidden) {
    stopsPanel.hidden = true;
    stopsBtn.setAttribute("aria-expanded", "false");
    return;
  }
  if (typing) return;
  // In full-piece mode the abcjs transport owns playback (its own play/pause
  // button); Space only drives the lightweight incipit player.
  if (e.key === " ") { e.preventDefault(); if (mode !== "full") play(); }
  else if (e.key === "n" || e.key === "N") { pickRandom(); }
});

window.addEventListener("popstate", (e) => {
  const id = e.state && e.state.id;
  const piece = id ? byId(id) : null;
  if (piece) show(piece, { replaceUrl: false });
});

/* ---- Boot ---------------------------------------------------------------- */

populateBrowseFilters();
buildStopsUI();

if (PIECES.length === 0) {
  scoreEl.textContent = "Add pieces in data/pieces.js to explore.";
} else {
  const wanted = new URLSearchParams(location.search).get("piece");
  const start = (wanted && byId(wanted)) || PIECES[Math.floor(Math.random() * PIECES.length)];
  show(start, { pushHistory: false });
}
