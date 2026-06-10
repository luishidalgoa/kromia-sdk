/**
 * `synth.ts` — generación de items sintéticos para AppPreview / playgrounds.
 *
 * Permite que un cliente (Studio, herramienta de QA, futuro Flutter, etc.)
 * renderice una `SectionDefinition` ANTES de que el publisher rellene datos
 * reales, eligiendo valores realistas del corpus según el `behavior` y
 * `type` declarado de cada field.
 *
 * Filosofía: lo más realista posible sin caer en mock complejo. Para cada
 * field se elige un valor del corpus correspondiente, usando un seed
 * determinista por `${sectionKey}-${idx}-${fieldKey}` (mismo idx → mismo
 * valor estable entre re-renders, evita "saltos" molestos).
 *
 * **Determinismo cross-language**: el hash FNV-1a 32-bit + corpus literal
 * en este archivo es **ground truth**. Si en el futuro existe un SDK Dart
 * que también genera previews, debe producir los mismos outputs para los
 * mismos seeds — el `tests/synth.test.ts` del SDK TS es la spec.
 *
 * Historia: originalmente vivía en `kromia-studio/src/components/album/
 * wizard/synth-section-data.ts` (KRO-54 F8). Migrado al SDK en KRO-72 para
 * que Flutter / drift-detector / otras tools puedan reusar la misma lógica
 * sin reimplementarla.
 */

// ── Tipos mínimos consumibles por structural typing ────────────────────

/**
 * Field mínimo que el synth necesita. Estructuralmente compatible con
 * `Pick<CardFieldDefinition, 'key'|'type'|'behavior'|'options'>` de Studio.
 *
 * No requerimos todo `CardFieldDefinition` porque el synth solo consume
 * estos 4 campos — así el SDK no se acopla al modelo extendido de Studio.
 */
export interface SynthSourceField {
  key:       string;
  type:      string;
  behavior?: string;
  options?:  string[];
}

/** Sección mínima que el synth necesita. */
export interface SynthSourceSection {
  fields: SynthSourceField[];
}

/** Item sintetizado: bag de pares key→valor (string, number, array, etc.). */
export type SynthItem = Record<string, unknown>;

// ── Corpus ─────────────────────────────────────────────────────────────

// Mockup-style (petición 2026-06-10): los ejemplos del lienzo/preview NO deben
// parecer datos reales — son maquetas. Nombres/títulos = tiras de «X» de largos
// variados (se ve el layout sin leer contenido); frases = lorem; imágenes =
// placeholder SVG vacío (placeholderImage). Solo el lorem queda como texto real.
const FIRST_NAMES = ['XXXX', 'XXXXXX', 'XXXXX', 'XXXXXXX', 'XXX', 'XXXXXXXX', 'XXXXX', 'XXXXXX', 'XXXX', 'XXXXXXX'];
const LAST_NAMES  = ['XXXXXXX', 'XXXXX', 'XXXXXXXX', 'XXXXXX', 'XXXXXXX', 'XXXX', 'XXXXXXXXX', 'XXXXX', 'XXXXXX', 'XXXXXXX'];
const CITIES      = ['Xxxxxxx', 'Xxxxx', 'Xxxxxxxxx', 'Xxxxxx', 'Xxxx', 'Xxxxxxxx', 'Xxxxx', 'Xxxxxx'];
const COUNTRIES   = ['Xxxxxx', 'Xxxxxx', 'Xxxxxxxxx', 'Xxxxxx', 'Xxxxxxx', 'Xxxxxx', 'Xxxxxxxx', 'Xxxxxxxx'];
const PHRASES     = [
  'Lorem ipsum dolor sit amet consectetur.',
  'Sed do eiusmod tempor incididunt ut.',
  'Ut enim ad minim veniam quis nostrud.',
  'Duis aute irure dolor in reprehenderit.',
  'Excepteur sint occaecat cupidatat non.',
];
const LONG_BODIES = [
  'Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat aute irure.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint.',
];
const BADGE_VALUES = ['Lorem', 'Ipsum', 'Dolor', 'Amet', 'Elit'];
const URLS         = ['https://example.com/xxxx', 'https://example.com/yyyy', 'https://example.com/zzzz'];
const EMAILS       = ['xxxx@example.com', 'xxxxx@example.com', 'xxxxxx@example.com'];
const PHONES       = ['+00 000 000 000', '+00 111 111 111', '+00 222 222 222'];

// ── Helpers ────────────────────────────────────────────────────────────

/** Placeholder de imagen estilo WIREFRAME: SVG inline (data-URI) con fondo
 *  neutro + aspa diagonal — la maqueta clásica de "aquí va una imagen".
 *  Sustituye a Picsum (2026-06-10): una foto real hacía pasar el mockup por
 *  contenido real. data-URI = determinista, offline y sin red. El `seed` se
 *  conserva en la firma por compat (mismo contrato cross-language) aunque el
 *  dibujo no varía. */
function placeholderImage(_seed: number, width = 400, height = 300): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<rect width="${width}" height="${height}" fill="#ece8df"/>`
    + `<rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" fill="none" stroke="#cfc9bb" stroke-width="3"/>`
    + `<line x1="0" y1="0" x2="${width}" y2="${height}" stroke="#cfc9bb" stroke-width="3"/>`
    + `<line x1="${width}" y1="0" x2="0" y2="${height}" stroke="#cfc9bb" stroke-width="3"/>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Hash FNV-1a 32-bit. Determinista por string. No criptográfico — solo
 *  reparte índices entre corpus de forma estable. **Spec cross-language**:
 *  un SDK Dart equivalente debe producir el MISMO hash para el mismo input. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Valor del array indexado por hash(seed)%len. */
function pick<T>(arr: T[], seed: string): T {
  return arr[hash(seed) % arr.length];
}

/** HSL (h:0-360, s/l:0-100) → hex `#rrggbb`. Genera colores sintéticos
 *  atractivos a partir de un seed. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

// ── API pública ────────────────────────────────────────────────────────

/**
 * Genera un array de N items sintéticos para la sección dada.
 * Cada item usa values del corpus correspondiente a behavior/type del field.
 *
 * @param sectionKey  para hacer el seed único por sección (evita que todas
 *                    las secciones del álbum muestren los mismos valores).
 * @param section     definición con fields.
 * @param count       cuántos items generar (default 3).
 */
export function synthSectionItems(
  sectionKey: string,
  section:    SynthSourceSection,
  count:      number = 3,
): SynthItem[] {
  const out: SynthItem[] = [];
  for (let i = 0; i < count; i++) {
    const item: SynthItem = {};
    for (const f of section.fields) {
      item[f.key] = synthFieldValue(f, `${sectionKey}-${i}-${f.key}`, i);
    }
    out.push(item);
  }
  return out;
}

/** Devuelve un value coherente con el behavior/type del field. */
export function synthFieldValue(
  field: SynthSourceField,
  seed:  string,
  idx:   number,
): unknown {
  const { type, behavior } = field;

  // ── Behaviors específicos (tienen prioridad sobre type primitivo) ──
  switch (behavior) {
    case 'avatar':
      return placeholderImage(hash(seed) % 100, 200, 200);
    case 'banner':
      return placeholderImage(hash(seed) % 100, 600, 200);
    case 'cover':
    case 'thumbnail':
      return placeholderImage(hash(seed) % 100, 400, 300);
    case 'gallery':
    case 'slideshow':
    case 'card_multiview':
      return [0, 1, 2].map(o => placeholderImage((hash(seed) + o) % 100, 400, 300));
    case 'url':
      return pick(URLS, seed);
    case 'email':
      return pick(EMAILS, seed);
    case 'phone':
      return pick(PHONES, seed);
    case 'rating':
      return (hash(seed) % 5) + 1;
    case 'color_hex': {
      // Hex determinista por seed. HSL con saturación/lightness moderados
      // para que se vea atractivo + convertido a hex.
      const hue = hash(seed) % 360;
      return hslToHex(hue, 65, 55);
    }
    case 'year':
      return 1980 + (hash(seed) % 45);
    case 'iso_date':
      return `2024-${String((idx % 12) + 1).padStart(2, '0')}-${String((idx * 7 + 3) % 28 + 1).padStart(2, '0')}`;
    case 'card_index_list':
      return [1 + idx, 2 + idx, 3 + idx];
    case 'card_code_list':
      return [`C-${100 + idx}`, `C-${200 + idx}`];
    case 'markdown':
    case 'notes':
    case 'html':
      return pick(LONG_BODIES, seed);
  }

  // ── Type primitivo ──
  if (type === 'number') {
    return hash(seed) % 100;
  }
  // Bug fix (KRO-70 verificación 2026-05-28) — type=image sin behavior caía
  // al fallback de PHRASES, devolviendo texto narrativo como URL. Otros image
  // funcionaban porque tenían behavior (avatar/banner/cover — ahora deprecados
  // por KRO-69 pero el switch arriba los sigue manejando) o porque su key
  // matcheaba alguna heurística textual al final. Manejo explícito aquí.
  if (type === 'image') {
    return placeholderImage(hash(seed) % 100, 400, 300);
  }
  if (type === 'textarea') {
    return pick(LONG_BODIES, seed);
  }
  if (type === 'select') {
    // Iteramos por idx (no por hash) para garantizar que TODAS las opciones
    // aparezcan al menos una vez cuando hay >= len items, en el orden
    // declarado por el publisher ("orden = importancia"). Con hash random
    // se podía dar el caso de no ver opt[0] nunca con 3 items y 3 opciones.
    const opts = field.options;
    if (opts && opts.length > 0) return opts[idx % opts.length];
    return pick(BADGE_VALUES, seed);
  }
  if (type.startsWith('array<')) {
    // Heurística: array de refs → ids fake. Resto → 3 strings del corpus.
    if (type.includes('cardRef') || type.includes('sectionRef')) {
      return [1, 2, 3];
    }
    // Bug fix (KRO-70 verificación 2026-05-28) — array<image> caía al
    // corpus de CITIES como string. Devolver URLs placeholder reales.
    if (type === 'array<image>') {
      return [0, 1, 2].map(o => placeholderImage((hash(seed) + o) % 100, 400, 300));
    }
    return [pick(CITIES, seed), pick(CITIES, seed + 'b'), pick(CITIES, seed + 'c')];
  }

  // ── Type text por defecto: heurística por nombre del key ──
  const key = field.key.toLowerCase();
  if (key.includes('name') || key.includes('nombre') || key.includes('title') || key.includes('titulo')) {
    return `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed + 'l')}`;
  }
  if (key.includes('country') || key.includes('pais') || key.includes('nacion')) {
    return pick(COUNTRIES, seed);
  }
  if (key.includes('city') || key.includes('ciudad') || key.includes('location') || key.includes('lugar')) {
    return pick(CITIES, seed);
  }
  if (key.includes('description') || key.includes('descripcion') || key.includes('bio')) {
    return pick(PHRASES, seed);
  }
  if (key.includes('team') || key.includes('equipo') || key.includes('club')) {
    return `${pick(CITIES, seed)} ${pick(FIRST_NAMES, seed + 'b')}`;
  }

  // Fallback: una frase corta.
  return pick(PHRASES, seed);
}
