# Pipe & Pedal

Pipe & Pedal is a small explorer of the organ repertoire. It opens to a public-domain
organ work with its opening bars engraved on the page. Hear them on a church-organ voice
while the notes light up, both in the score and on a drawing of the console, then read
about the piece and wander on to other works by the same composer. There is no quiz and
no scoring: read it, hear it, and follow where it leads.

Pipe & Pedal replaces the earlier *Name That Organ Piece* quiz that lived here.

**Try it live:** <https://financeprofessormckee.github.io/Name-That-Organ-Piece/>

## Use it

- **▶ Hear it** (or <kbd>Space</kbd>) plays the passage and highlights each note as it
  sounds.
- **🎹 Whole piece** switches from the opening bars to the complete score, for pieces
  that have one, with a player you can pause and scrub.
- **The console view** under the score shows two manuals and a pedalboard, with the keys
  lighting as they play. A piece with no pedal part shows the pedalboard greyed out.
- **🎛 Stops** lets you draw your own registration from flues, reeds, and strings.
  **Suggested registration** puts back the one chosen for the piece.
- **Movements** and **More by** chips step to the other movements of the same work, or
  to other pieces by the same composer.
- **📚 Browse** lists all 183 pieces, with a search box and filters by composer and form.
- **🎲 Another piece** (or <kbd>N</kbd>) chooses another work at random; **← Back**
  retraces your path, and shareable `?piece=` links return to a piece you have visited.

Everything runs locally in your browser. There are no accounts, tracking, or
recordings. The first time you play something, the page fetches the instrument sounds
from the internet; after that, your browser keeps them.

## Sources and rights

Every work is in the public domain, by more than two dozen composers, from Tallis and
Titelouze through Buxtehude and Bach to Mendelssohn, Franck, and Widor. The notation is converted from engravings published by the
[Mutopia Project](https://www.mutopiaproject.org/), [IMSLP](https://imslp.org/), and the
[PDMX](https://pnlong.github.io/PDMX.website/) score collection, and each piece names
its score source and license on screen. Those engravings carry their own licenses:
public domain, CC0, CC BY, or CC BY-SA. Notation derived from a CC BY-SA engraving stays
under that license. Every score in this release was checked against its source and its
license before publication.

Notation and playback come from [abcjs](https://abcjs.net), an MIT-licensed
open-source library; its license notice is included in
[`vendor/abcjs.LICENSE`](vendor/abcjs.LICENSE). This project is released under the
[MIT License](LICENSE).

## Found a mistake?

Corrections are welcome: a wrong note, a misattributed piece, a missing tie, or a
playback that stumbles. Please [open an issue](https://github.com/financeprofessormckee/Name-That-Organ-Piece/issues)
with the piece, the bar, what looks wrong, and the score you are comparing against.
