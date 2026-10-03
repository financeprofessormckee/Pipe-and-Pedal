"use strict";

/* ==========================================================================
 * Organ stop registry for "Pipe & Pedal".
 *
 * Each stop is one or more "ranks" — a pitch offset (in semitones from the
 * written note), a GM soundfont program approximating its timbre family, and
 * a relative gain. Mixtures (multiple ranks sounding at once for one stop)
 * share this same shape; a plain stop just has one rank.
 *
 * GM program reference used here: 19 = Church Organ (flue/diapason color),
 * 20 = Reed Organ, 56 = Trumpet, 73 = Flute, 48 = String Ensemble 1.
 * ========================================================================== */

window.ORGAN_STOPS = [
  {
    id: "bourdon16",
    name: "Bourdon 16′",
    family: "flue",
    blurb: "A soft sub-unison foundation — deepens the texture an octave down.",
    ranks: [{ semitones: -12, program: 19, gain: 0.55 }],
  },
  {
    id: "principal8",
    name: "Principal 8′",
    family: "flue",
    blurb: "The organ's core tone, at written pitch.",
    ranks: [{ semitones: 0, program: 19, gain: 1.0 }],
  },
  {
    id: "bourdon8",
    name: "Stopped Flute 8′",
    family: "flue",
    blurb: "A softer, breathier unison flue stop.",
    ranks: [{ semitones: 0, program: 73, gain: 0.6 }],
  },
  {
    id: "octave4",
    name: "Octave 4′",
    family: "flue",
    blurb: "Brightens the chorus an octave above written pitch.",
    ranks: [{ semitones: 12, program: 19, gain: 0.7 }],
  },
  {
    id: "superoctave2",
    name: "Super Octave 2′",
    family: "flue",
    blurb: "Adds top-end sparkle, two octaves above written pitch.",
    ranks: [{ semitones: 24, program: 19, gain: 0.45 }],
  },
  {
    id: "trumpet8",
    name: "Trumpet 8′",
    family: "reed",
    blurb: "A bright reed color at unison pitch.",
    ranks: [{ semitones: 0, program: 56, gain: 0.7 }],
  },

  // -- Deferred (slice 2) — add entries here, no other code changes needed --
  // { id: "quint223", name: "Quint 2⅔′", family: "flue",
  //   blurb: "A mutation rank a twelfth above written pitch — colors, doesn't duplicate, the chorus.",
  //   ranks: [{ semitones: 19, program: 19, gain: 0.35 }] },
  // { id: "mixtureIV", name: "Mixture IV", family: "flue",
  //   blurb: "A four-rank chorus mixture crowning the principal chorus.",
  //   ranks: [
  //     { semitones: 12, program: 19, gain: 0.35 },
  //     { semitones: 19, program: 19, gain: 0.3 },
  //     { semitones: 24, program: 19, gain: 0.3 },
  //     { semitones: 31, program: 19, gain: 0.25 },
  //   ] },
  // { id: "celeste8", name: "Voix Céleste 8′", family: "string",
  //   blurb: "A gently detuned string stop, beating against the Principal for shimmer.",
  //   ranks: [{ semitones: 0, program: 48, gain: 0.45, cents: 9 }] },
];

window.ORGAN_REGISTRATIONS = {
  softFlutes: ["bourdon8"],
  chorus: ["principal8", "octave4"],
  plenum: ["bourdon16", "principal8", "octave4", "superoctave2"],
  frenchAnches: ["principal8", "octave4", "trumpet8"],
  foundations: ["bourdon16", "principal8", "bourdon8"],
};
