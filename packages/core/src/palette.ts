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
