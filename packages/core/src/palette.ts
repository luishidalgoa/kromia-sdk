/**
 * KRO-133 F3 — Paleta de COLOR cerrada pero amplia (tipo Tailwind) para la
 * personalización atómica del constructor de bloques. Sin hex libre → portable
 * a Flutter (que mapeará cada id a un `Color`). El id es el contrato; las clases
 * web las resuelve `paletteClass` (las utilidades `{bg,text,border}-{id}` se
 * fuerzan en el bundle vía `@source inline` en globals.css de Studio).
 *
 * Estructura: una fila de TOKENS DE TEMA (adaptan a claro/oscuro) + una rejilla
 * de 10 tonos × 5 intensidades.
 */

export type PaletteGroup = 'tema' | 'color';
export type PaletteRole  = 'bg' | 'text' | 'border';

export interface PaletteSwatch {
  /** Id estable (contrato cross-language): 'card' | 'red-500' | … */
  id:    string;
  group: PaletteGroup;
}

/** Tokens semánticos del tema (se adaptan a modo claro/oscuro). */
export const PALETTE_THEME_IDS = ['card', 'muted', 'accent', 'primary', 'foreground'] as const;

/** Tonos de la rejilla de color (orden visual). */
export const PALETTE_HUES = ['slate', 'red', 'orange', 'amber', 'emerald', 'teal', 'sky', 'blue', 'violet', 'pink'] as const;
/** Intensidades de cada tono (clara → oscura). */
export const PALETTE_SHADES = [200, 400, 500, 600, 800] as const;

/** Catálogo completo (tema + rejilla). El editor itera esto; Flutter lo espeja. */
export const PALETTE: ReadonlyArray<PaletteSwatch> = [
  ...PALETTE_THEME_IDS.map(id => ({ id, group: 'tema' as const })),
  ...PALETTE_HUES.flatMap(h => PALETTE_SHADES.map(s => ({ id: `${h}-${s}`, group: 'color' as const }))),
];

/** Clase por rol para los tokens de tema (las de color son `${role}-${id}`). */
const THEME_CLASS: Record<string, Record<PaletteRole, string>> = {
  border:     { bg: 'bg-border',      text: 'text-foreground',         border: 'border-border' },
  card:       { bg: 'bg-card',        text: 'text-card-foreground',    border: 'border-border' },
  muted:      { bg: 'bg-muted',       text: 'text-muted-foreground',   border: 'border-muted' },
  accent:     { bg: 'bg-accent',      text: 'text-accent-foreground',  border: 'border-accent' },
  primary:    { bg: 'bg-primary',     text: 'text-primary',            border: 'border-primary' },
  foreground: { bg: 'bg-foreground',  text: 'text-foreground',         border: 'border-foreground' },
};

/**
 * KRO-147 — Un color puede VINCULARSE a un campo `color_hex` (valor dinámico por
 * item) en vez de ser fijo de la paleta. Se codifica como `field:<fieldKey>`.
 */
export const FIELD_COLOR_PREFIX = 'field:';

/** Si el id es una vinculación a campo (`field:foo`), devuelve la key; si no, null. */
export function colorFieldKey(id: string | undefined | null): string | null {
  return id && id.startsWith(FIELD_COLOR_PREFIX) ? id.slice(FIELD_COLOR_PREFIX.length) : null;
}

/**
 * Resuelve un id de paleta a la clase Tailwind para el rol dado. Tokens de tema
 * → clases semánticas; colores → `${role}-${id}` (p.ej. `bg-red-500`). Vacío si
 * no hay id o si es una vinculación a campo (esos se aplican por estilo inline,
 * `resolveFieldColor`). Misma función en web y (espejada) en Flutter.
 */
export function paletteClass(id: string | undefined | null, role: PaletteRole): string {
  if (!id || colorFieldKey(id)) return '';
  return THEME_CLASS[id]?.[role] ?? `${role}-${id}`;
}

/** Para un color vinculado a campo, devuelve el valor (hex) leído del item; si
 *  no es vinculación a campo (o no hay valor), undefined → usar `paletteClass`. */
export function resolveFieldColor(id: string | undefined | null, item: Record<string, unknown>): string | undefined {
  const key = colorFieldKey(id);
  if (!key) return undefined;
  const v = item?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

// ── KRO-198 — Contraste WCAG sobre la paleta ───────────────────────────────
//
// Comprobación de legibilidad texto↔fondo SIN tocar el render: el editor avisa
// y `validateAppearance` emite un `warn` cuando el publisher fija dos tonos
// CRUDOS de la rejilla con poco contraste. Es el único hueco de a11y que llega
// al coleccionista (los tokens de TEMA ya resuelven a pares fondo/texto
// coherentes por construcción, así que el riesgo real es mezclar shades).

/**
 * Hex de referencia (Tailwind) de cada tono de la REJILLA. Los tokens de TEMA
 * (card/muted/accent/primary/foreground) se adaptan a claro/oscuro → NO se
 * incluyen aquí a propósito: el verificador solo evalúa tonos crudos (el riesgo
 * documentado) y para todo lo demás devuelve `null` (no verificable) en vez de
 * un falso aviso. Flutter espeja este mapa (mismos ids → mismos Color).
 */
export const PALETTE_HEX: Readonly<Record<string, string>> = {
  'slate-200':   '#e2e8f0', 'slate-400':   '#94a3b8', 'slate-500':   '#64748b', 'slate-600':   '#475569', 'slate-800':   '#1e293b',
  'red-200':     '#fecaca', 'red-400':     '#f87171', 'red-500':     '#ef4444', 'red-600':     '#dc2626', 'red-800':     '#991b1b',
  'orange-200':  '#fed7aa', 'orange-400':  '#fb923c', 'orange-500':  '#f97316', 'orange-600':  '#ea580c', 'orange-800':  '#9a3412',
  'amber-200':   '#fde68a', 'amber-400':   '#fbbf24', 'amber-500':   '#f59e0b', 'amber-600':   '#d97706', 'amber-800':   '#92400e',
  'emerald-200': '#a7f3d0', 'emerald-400': '#34d399', 'emerald-500': '#10b981', 'emerald-600': '#059669', 'emerald-800': '#065f46',
  'teal-200':    '#99f6e4', 'teal-400':    '#2dd4bf', 'teal-500':    '#14b8a6', 'teal-600':    '#0d9488', 'teal-800':    '#115e59',
  'sky-200':     '#bae6fd', 'sky-400':     '#38bdf8', 'sky-500':     '#0ea5e9', 'sky-600':     '#0284c7', 'sky-800':     '#075985',
  'blue-200':    '#bfdbfe', 'blue-400':    '#60a5fa', 'blue-500':    '#3b82f6', 'blue-600':    '#2563eb', 'blue-800':    '#1e40af',
  'violet-200':  '#ddd6fe', 'violet-400':  '#a78bfa', 'violet-500':  '#8b5cf6', 'violet-600':  '#7c3aed', 'violet-800':  '#5b21b6',
  'pink-200':    '#fbcfe8', 'pink-400':    '#f472b6', 'pink-500':    '#ec4899', 'pink-600':    '#db2777', 'pink-800':    '#9d174d',
};

/** Hex de un id de paleta SI es un tono crudo de la rejilla; `null` para tokens
 *  de tema (adaptativos), vinculaciones `field:` o ids desconocidos. */
export function paletteHex(id: string | undefined | null): string | null {
  if (!id) return null;
  return PALETTE_HEX[id] ?? null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa WCAG (0..1) de un RGB 0..255. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Ratio de contraste WCAG (1..21) entre dos ids de paleta. Devuelve `null`
 * cuando alguno NO es un tono crudo de la rejilla (token de tema, `field:`,
 * desconocido) → "no verificable". Pura: misma fórmula en web y Flutter.
 */
export function paletteContrastRatio(idA: string | undefined | null, idB: string | undefined | null): number | null {
  const a = paletteHex(idA), b = paletteHex(idB);
  if (!a || !b) return null;
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const la = relativeLuminance(ra), lb = relativeLuminance(rb);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastLevel = 'aa' | 'aa-large' | 'fail' | 'unknown';

/** Umbral mínimo WCAG AA para texto normal. */
export const CONTRAST_AA = 4.5;
/** Umbral WCAG AA para texto grande/negrita. */
export const CONTRAST_AA_LARGE = 3;

/**
 * Veredicto de contraste de un texto sobre un fondo (ambos ids de paleta).
 * 'aa' ≥4.5 · 'aa-large' ≥3 (válido solo para texto grande/bold) · 'fail' <3 ·
 * 'unknown' si no es verificable (token de tema / field: / desconocido).
 */
export function contrastLevel(textId: string | undefined | null, bgId: string | undefined | null): ContrastLevel {
  const r = paletteContrastRatio(textId, bgId);
  if (r == null) return 'unknown';
  if (r >= CONTRAST_AA)       return 'aa';
  if (r >= CONTRAST_AA_LARGE) return 'aa-large';
  return 'fail';
}
