/*
 * Composers for "Pipe & Pedal".
 *
 * A lookup table keyed by `composerId` — each ORGAN_PIECES entry references one of
 * these ids (`composerId`) instead of repeating the name. That lets the explorer
 * show a short bio, a Wikipedia link, and a "more by this composer" list without
 * duplicating data.
 *
 * Fields per composer:
 *   name        display name (with accents)
 *   born, died  years as strings ("" if unknown / still living)
 *   nationality short adjective, e.g. "French"
 *   wikipedia   full Wikipedia URL, or null to fall back to a generated search link
 *   blurb       one-sentence orientation, shown under the piece
 *
 * Some ids here currently have NO piece pointing at them -- wagner, tournemire,
 * vierne, boellmann and alain lost their last entry when round 127 retired the
 * eleven pieces that had no citable engraving (see RETIRED-PIECES.md). The
 * records are kept on purpose, not overlooked: `populateBrowseFilters` in
 * app.js only offers composers with at least one piece, so an unused record is
 * invisible in the UI, and keeping it means restoring a retired piece is a
 * single paste rather than two edits.
 */

window.ORGAN_COMPOSERS = {
  bach: {
    name: "J. S. Bach",
    born: "1685", died: "1750", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Johann_Sebastian_Bach",
    blurb: "Baroque master of Weimar and Leipzig — the summit of the organ repertoire."
  },
  pachelbel: {
    name: "Johann Pachelbel",
    born: "1653", died: "1706", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Johann_Pachelbel",
    blurb: "South-German Baroque organist whose chorale settings shaped a generation (Bach's family among them)."
  },
  wagner: {
    name: "Richard Wagner",
    born: "1813", died: "1883", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Richard_Wagner",
    blurb: "Opera revolutionary; his stage music migrated to the organ loft by sheer popularity."
  },
  widor: {
    name: "Charles-Marie Widor",
    born: "1844", died: "1937", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Charles-Marie_Widor",
    blurb: "Organist of Saint-Sulpice for 64 years and father of the French organ symphony."
  },
  tournemire: {
    name: "Charles Tournemire",
    born: "1870", died: "1939", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Charles_Tournemire",
    blurb: "Titulaire at Sainte-Clotilde; mystic improviser who built L'Orgue mystique on Gregorian chant."
  },
  franck: {
    name: "César Franck",
    born: "1822", died: "1890", nationality: "Franco-Belgian",
    wikipedia: "https://en.wikipedia.org/wiki/C%C3%A9sar_Franck",
    blurb: "Sainte-Clotilde organist whose late works founded the modern French organ school."
  },
  vierne: {
    name: "Louis Vierne",
    born: "1870", died: "1937", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Louis_Vierne",
    blurb: "Blind from birth; organist of Notre-Dame de Paris, where he died at the console mid-recital."
  },
  boellmann: {
    name: "Léon Boëllmann",
    born: "1862", died: "1897", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/L%C3%A9on_Bo%C3%ABllmann",
    blurb: "Alsatian organist at Saint-Vincent-de-Paul; dead at 35, remembered for one dazzling Suite gothique."
  },
  alain: {
    name: "Jehan Alain",
    born: "1911", died: "1940", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Jehan_Alain",
    blurb: "Visionary of a new modal language, killed in action at 29; his sister Marie-Claire championed the works."
  },
  reger: {
    name: "Max Reger",
    born: "1873", died: "1916", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Max_Reger",
    blurb: "Prodigiously prolific late-Romantic organist-composer, equally at home writing the thorniest and the plainest ends of the German repertoire."
  },
  tallis: {
    name: "Thomas Tallis",
    born: "1505", died: "1585", nationality: "English",
    wikipedia: "https://en.wikipedia.org/wiki/Thomas_Tallis",
    blurb: "Tudor court composer whose hymn tunes and polyphony survived the Reformation's upheavals in English church music."
  },
  scheidemann: {
    name: "Heinrich Scheidemann",
    born: "c. 1595", died: "1663", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Heinrich_Scheidemann",
    blurb: "North German organ master at Hamburg's Catharinenkirche; a Sweelinck pupil whose fantasias and praeambula shaped the generation that produced Buxtehude."
  },
  titelouze: {
    name: "Jean Titelouze",
    born: "1563", died: "1633", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Jean_Titelouze",
    blurb: "Organist of Rouen Cathedral, often called the father of French organ music — the first to publish a substantial body of French organ hymn versets."
  },
  banchieri: {
    name: "Adriano Banchieri",
    born: "c. 1568", died: "1634", nationality: "Italian",
    wikipedia: "https://en.wikipedia.org/wiki/Adriano_Banchieri",
    blurb: "Benedictine monk of Bologna whose L'organo suonarino taught a generation how to accompany the liturgy — and left some of the earliest printed organ fugues."
  },
  buxtehude: {
    name: "Dieterich Buxtehude",
    born: "c. 1637", died: "1707", nationality: "Danish-German",
    wikipedia: "https://en.wikipedia.org/wiki/Dieterich_Buxtehude",
    blurb: "Organist of the Marienkirche in Lübeck, and the man the young Bach walked some 250 miles to hear."
  },
  mendelssohn: {
    name: "Felix Mendelssohn",
    born: "1809", died: "1847", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Felix_Mendelssohn",
    blurb: "Romantic composer and conductor whose revival of Bach's music reached the organ too — his Op. 37 and Op. 65 reopened the instrument to the concert hall."
  },
  dandrieu: {
    name: "Jean-François Dandrieu",
    born: "1681", died: "1738", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Jean-Fran%C3%A7ois_Dandrieu",
    blurb: "Organist of Saint-Merri and of the royal chapel; a leading voice of the French classical organ school between Couperin and Daquin."
  },
  delmet: {
    name: "Paul Delmet",
    born: "1862", died: "1904", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Paul_Delmet",
    blurb: "Montmartre chansonnier of the cabaret era, whose sentimental songs were widely arranged — including for the organ loft."
  },
  muffat: {
    name: "Georg Muffat",
    born: "1653", died: "1704", nationality: "German-French",
    wikipedia: "https://en.wikipedia.org/wiki/Georg_Muffat",
    blurb: "A cosmopolitan Baroque composer trained in Paris under Lully and in Rome under Corelli and Pasquini; his Apparatus musico-organisticus fused French, Italian, and German keyboard idioms."
  },
  gigout: {
    name: "Eugène Gigout",
    born: "1844", died: "1925", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Eug%C3%A8ne_Gigout",
    blurb: "Longtime organist of Saint-Augustin in Paris and founder of his own organ school; his B-minor Toccata remains a recital-closing staple."
  },
  grigny: {
    name: "Nicolas de Grigny",
    born: "1672", died: "1703", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Nicolas_de_Grigny",
    blurb: "Organist of Reims Cathedral, dead of smallpox at 31; his sole publication, the 1699 Livre d'orgue, was hand-copied by the young Bach and stands among the summits of the French classical organ school."
  },
  bruckner: {
    name: "Anton Bruckner",
    born: "1824", died: "1896", nationality: "Austrian",
    wikipedia: "https://en.wikipedia.org/wiki/Anton_Bruckner",
    blurb: "Symphonist and church organist at Linz and Vienna, better known for his sprawling symphonies than for his handful of small, devout organ pieces."
  },
  weckmann: {
    name: "Matthias Weckmann",
    born: "1621", died: "1674", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Matthias_Weckmann",
    blurb: "Schütz pupil and organist of Hamburg's Jacobikirche, whose stile-fantastico free works bridge the North-German school from Scheidemann to Buxtehude."
  },
  roberday: {
    name: "François Roberday",
    born: "1624", died: "1680", nationality: "French",
    wikipedia: "https://en.wikipedia.org/wiki/Fran%C3%A7ois_Roberday",
    blurb: "Organist to the French court whose sole publication, the 1660 Fugues et Caprices, pairs each fugue with a theme borrowed from an older master, credited in the score."
  },
  ritter: {
    name: "Christian Ritter",
    born: "c. 1645", died: "c. 1725", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Christian_Ritter",
    blurb: "Court organist in Stockholm and Dresden whose few surviving keyboard works place him stylistically alongside Buxtehude in the North-German stylus phantasticus."
  },
  anonymous: {
    name: "Anonymous",
    born: "", died: "", nationality: "German",
    wikipedia: null,
    blurb: "A chorale-based organ setting handed down without a composer's name attached — common for functional Baroque liturgical repertoire."
  },
  surzynski: {
    name: "Mieczysław Surzyński",
    born: "1866", died: "1924", nationality: "Polish",
    wikipedia: "https://en.wikipedia.org/wiki/Mieczys%C5%82aw_Surzy%C5%84ski",
    blurb: "Longtime organist of Warsaw's Poznań and Warsaw cathedrals, and a central figure of Polish Romantic organ music alongside his brothers Józef and Stanisław."
  },
  merkel: {
    name: "Gustav Adolf Merkel",
    born: "1827", died: "1885", nationality: "German",
    wikipedia: "https://en.wikipedia.org/wiki/Gustav_Adolf_Merkel",
    blurb: "Dresden court organist whose fluent, Mendelssohn-indebted style made him one of the most-played German organ composers of the later 19th century."
  }
};
