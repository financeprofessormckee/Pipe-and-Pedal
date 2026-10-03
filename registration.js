"use strict";

/* ==========================================================================
 * Registration engine for "Pipe & Pedal".
 *
 * abcjs's synth has no drawbar/additive organ model — it just plays a GM
 * soundfont patch per voice, selected via CreateSynth/SynthController reading
 * visualObj.setUpAudio(). To approximate real stop registration (several
 * pitch ranks + timbres sounding together per note) without touching the
 * notation render, we wrap the rendered visualObj in a shallow-copy proxy
 * that overrides only setUpAudio: it calls the real one, then clones each
 * track once per active stop rank (pitch-shifted, re-timbred, gain-scaled).
 * Everything else — including `lines`, which drives on-screen note
 * highlighting for both playback paths — stays the original object, so the
 * follow-along cursor still points at real rendered elements.
 * ========================================================================== */

window.REGISTRATION = (function () {
  const STOPS = window.ORGAN_STOPS || [];
  const REGISTRATIONS = window.ORGAN_REGISTRATIONS || {};
  const STOPS_BY_ID = STOPS.reduce((map, s) => { map[s.id] = s; return map; }, {});

  // Playable MIDI note range for the FluidR3 GM soundfont abcjs loads from.
  const MIN_PITCH = 21;
  const MAX_PITCH = 108;

  /* ---- Period / dynamic buckets --------------------------------------- */

  function periodBucketFor(composer) {
    const nat = (composer && composer.nationality) || "";
    const born = parseInt((composer && composer.born) || "", 10);
    if (/French|Belgian/.test(nat)) return isNaN(born) || born < 1800 ? "frenchClassical" : "frenchRomantic";
    if (/German|Danish/.test(nat)) return isNaN(born) || born < 1750 ? "germanBaroque" : "germanRomantic";
    if (/English/.test(nat)) return "english";
    return "generic";
  }

  const SOFT_GENRES = [
    "chorale prelude", "chorale", "hymn verset", "hymn tune", "organ office",
    "adagio", "canon", "trio sonata", "chanson",
  ];
  const LOUD_GENRES = [
    "toccata", "toccata & fugue", "toccata and fugue", "prelude & fugue",
    "prelude and fugue", "offertoire", "opera chorus",
  ];

  function dynamicBucketFor(piece) {
    const genre = ((piece && piece.genre) || "").toLowerCase();
    if (LOUD_GENRES.some((g) => genre.includes(g))) return "loud";
    if (SOFT_GENRES.some((g) => genre.includes(g))) return "soft";
    return "medium";
  }

  // period bucket -> dynamic bucket -> registration id
  const DEFAULTS = {
    germanBaroque:   { soft: "chorus",      medium: "chorus",      loud: "plenum" },
    frenchClassical: { soft: "softFlutes",  medium: "chorus",      loud: "frenchAnches" },
    frenchRomantic:  { soft: "foundations", medium: "foundations", loud: "frenchAnches" },
    germanRomantic:  { soft: "foundations", medium: "foundations", loud: "plenum" },
    english:         { soft: "softFlutes",  medium: "chorus",      loud: "plenum" },
    generic:         { soft: "chorus",      medium: "chorus",      loud: "plenum" },
  };

  const BUCKET_LABELS = {
    germanBaroque: "German Baroque", frenchClassical: "French Classical",
    frenchRomantic: "French Romantic", germanRomantic: "German Romantic",
    english: "English", generic: "Generic",
  };
  const DYNAMIC_LABELS = { soft: "quiet registration", medium: "chorus", loud: "full organ" };

  function defaultStopsFor(piece, composer) {
    const period = periodBucketFor(composer);
    const dynamic = dynamicBucketFor(piece);
    const regId = (DEFAULTS[period] && DEFAULTS[period][dynamic]) || "chorus";
    const stopIds = (REGISTRATIONS[regId] || ["principal8"]).filter((id) => STOPS_BY_ID[id]);
    const label = `${BUCKET_LABELS[period] || "Generic"} · ${DYNAMIC_LABELS[dynamic] || "chorus"}`;
    return { stopIds: stopIds.length ? stopIds : ["principal8"], label };
  }

  /* ---- Track expansion -------------------------------------------------- */

  function ranksFor(stopIds) {
    const ranks = [];
    (stopIds && stopIds.length ? stopIds : ["principal8"]).forEach((id) => {
      const stop = STOPS_BY_ID[id];
      if (stop) ranks.push(...stop.ranks);
    });
    return ranks.length ? ranks : STOPS_BY_ID.principal8.ranks;
  }

  function expandForStops(flattened, stopIds) {
    const ranks = ranksFor(stopIds);
    const gainSum = ranks.reduce((sum, r) => sum + r.gain, 0);
    const master = 1 / Math.max(1, Math.sqrt(gainSum));

    const originalTracks = flattened.tracks || [];
    const expandedTracks = [];

    ranks.forEach((rank) => {
      originalTracks.forEach((track) => {
        const clonedTrack = [];
        let hasProgram = false;
        track.forEach((ev) => {
          if (ev.cmd === "program") {
            hasProgram = true;
            clonedTrack.push(Object.assign({}, ev, { instrument: rank.program }));
          } else if (ev.cmd === "note") {
            const pitch = ev.pitch + rank.semitones;
            if (pitch < MIN_PITCH || pitch > MAX_PITCH) return; // drop out-of-range notes
            clonedTrack.push(Object.assign({}, ev, {
              pitch,
              instrument: rank.program,
              volume: Math.min(127, Math.max(1, Math.round((ev.volume || 0) * rank.gain * master))),
              cents: (ev.cents || 0) + (rank.cents || 0),
            }));
          } else {
            clonedTrack.push(ev);
          }
        });
        if (!hasProgram) clonedTrack.unshift({ cmd: "program", channel: 0, instrument: rank.program });
        expandedTracks.push(clonedTrack);
      });
    });

    return Object.assign({}, flattened, { tracks: expandedTracks, pan: undefined });
  }

  /* ---- The audio-tune wrapper -------------------------------------------- */

  function makeAudioTune(visualObj, stopIds) {
    try {
      const audioTune = Object.assign(Object.create(Object.getPrototypeOf(visualObj)), visualObj);
      audioTune.setUpAudio = function (opts) {
        return expandForStops(visualObj.setUpAudio(opts), stopIds);
      };
      return audioTune;
    } catch (err) {
      console.error("Registration wrapper failed, falling back to plain voicing:", err);
      return visualObj;
    }
  }

  return { periodBucketFor, dynamicBucketFor, defaultStopsFor, expandForStops, makeAudioTune };
})();
