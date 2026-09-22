/**
 * KRO-230 — Siluetas de carta (la FORMA del recorte del cromo).
 *
 * Un cromo no siempre es un rectángulo redondeado: cromos de fútbol con arco
 * superior, esquinas cortadas, tickets con muescas, escudos… En vez de
 * programar cada forma a fuego, el formato de carta gana un eje `shape` cuyo
 * valor apunta a este catálogo de presets (y, en fase 3, a un path custom
 * importado por el creador desde Figma/Illustrator).
 *
 * ## El protocolo de silueta (contrato de render cross-platform)
 *
 * Una silueta es **un único SVG path** en espacio NORMALIZADO `0..1 × 0..1`
 * (viewBox `0 0 1 1`, eje Y hacia abajo, sin holes, fill-rule nonzero). Cada
 * plataforma lo escala a la caja real de la carta:
 *
 *  - **Web**: `<clipPath clipPathUnits="objectBoundingBox">` + CSS
 *    `clip-path: url(#…)` → responsivo gratis.
 *  - **Flutter**: parsear el path y escalarlo por `size` en un
 *    `CustomClipper<Path>`.
 *  - **Fabricación (KRO-216)**: el mismo path, escalado a mm, alimenta el
 *    troquel de corte.
 *
 * Como el espacio es 0..1 en ambos ejes, la silueta se ESTIRA con el aspect
 * de la carta (igual que el border-radius en % de KRO-225) — un hexágono en
 * 2:3 es más alto que ancho. Es intencional: la forma acompaña al formato.
 *
 * ## Interacción con `cornerRadius`
 *
 * `shape` ausente o `'standard'` ⇒ NO hay clip: la carta es el rectángulo
 * redondeado de siempre (`cardCornerRadiusPx`). Con cualquier otra silueta,
 * las esquinas van HORNEADAS en el path y `cornerRadius` se ignora en el
 * recorte (los editores deben deshabilitar ese control).
 *
 * Es DATA del cardSchema (como `cornerRadius`): NO entra al `.json` del KRP,
 * NO bumpea PROTOCOL_VERSION. La paridad Flutter va por spec + Drift Sync.
 */

import type { CatalogOption } from './options';

/** Definición de una silueta del catálogo. */
export interface CardShapeDefinition extends CatalogOption {
  id:      string;
  label:   string;
  tooltip: string;
  /**
   * SVG path de la silueta en espacio 0..1 (protocolo de arriba).
   * `null` = sin clip (rectángulo redondeado estándar por cornerRadius).
   */
  path: string | null;
}

/**
 * El catálogo es DELIBERADAMENTE mínimo: la silueta NO viene con "formas de
 * ejemplo" — el creador aporta la SUYA (importar SVG o vectorizar una imagen,
 * ver abajo). `'standard'` es la única entrada del catálogo: la carta clásica
 * (rectángulo redondeado por `cornerRadius`), que además sirve para
 * DESELECCIONAR una silueta importada.
 */
export const CARD_SHAPES: ReadonlyArray<CardShapeDefinition> = [
  {
    id: 'standard', label: 'Estándar',
    tooltip: 'Rectángulo redondeado clásico (el redondeo lo controla "Redondeado")',
    path: null,
  },
];

/** Ids válidos del catálogo (para enums de persistencia/validación). */
export const CARD_SHAPE_IDS = CARD_SHAPES.map(s => s.id);

export type CardShapeId = (typeof CARD_SHAPES)[number]['id'];

export const DEFAULT_CARD_SHAPE = 'standard';

/** Definición por id, con fallback a estándar si el id no existe. */
export function cardShapeById(id: string | undefined): CardShapeDefinition {
  return CARD_SHAPES.find(s => s.id === id) ?? CARD_SHAPES[0];
}

/**
 * KRO-230 fase 3 — silueta PERSONALIZADA del creador.
 *
 * `shape: 'custom'` + `shapePath` = un path importado (SVG del diseñador, o
 * contorno vectorizado de una imagen con transparencia) ya normalizado al
 * protocolo. La GRAMÁTICA canónica es deliberadamente pequeña para que todo
 * consumidor (web, Flutter, troquel) la parsee sin un motor SVG completo:
 *
 *   path := M x y (L x y | C x1 y1 x2 y2 x y | Q x1 y1 x y)+ Z
 *
 * — comandos ABSOLUTOS en mayúscula, coordenadas en [0,1], un solo subpath
 * (sin holes), cerrado con Z. El importador de Studio convierte cualquier
 * SVG razonable (h/v/s/t/a, relativos, shapes básicos) a esta forma.
 */
export const CUSTOM_CARD_SHAPE = 'custom';

/** Longitud máxima defensiva del path custom persistido. */
export const MAX_SHAPE_PATH_LENGTH = 6000;

const ARITY: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6 };

/**
 * Valida un `shapePath` custom contra la gramática del protocolo.
 * Devuelve `null` si es válido, o el motivo (es-ES) si no.
 */
export function validateShapePath(path: unknown): string | null {
  if (typeof path !== 'string' || !path.trim()) return 'El path está vacío.';
  if (path.length > MAX_SHAPE_PATH_LENGTH) return 'El path es demasiado largo (simplifica la forma).';
  if (/[^MLCQZ0-9.\-\s]/.test(path)) return 'Solo se admiten comandos M/L/C/Q/Z absolutos y números.';
  const tokens = path.trim().split(/\s+/);
  let i = 0, segs = 0, ms = 0, closed = false;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'Z') { closed = true; if (i !== tokens.length) return 'Z debe ser el último comando (un solo subpath, sin holes).'; break; }
    const n = ARITY[cmd];
    if (n === undefined) return `Comando no admitido: "${cmd}".`;
    if (cmd === 'M' && ++ms > 1) return 'Solo se admite un subpath (una única M, sin holes).';
    if (cmd !== 'M' && ms === 0) return 'El path debe empezar por M.';
    for (let k = 0; k < n; k++) {
      const v = Number(tokens[i++]);
      if (!Number.isFinite(v)) return 'Coordenada no numérica.';
      if (v < -0.002 || v > 1.002) return 'Las coordenadas deben estar normalizadas en 0..1.';
    }
    if (cmd !== 'M') segs++;
  }
  if (!closed) return 'El path debe cerrarse con Z.';
  // 2 segmentos + el cierre implícito de Z = triángulo (la forma mínima).
  if (segs < 2) return 'La forma necesita al menos 3 puntos.';
  return null;
}

/**
 * Path normalizado de la silueta del formato, o `null` si la carta es el
 * rectángulo redondeado estándar (⇒ usa `cardCornerRadiusPx`). Una silueta
 * custom inválida cae a estándar (defensivo, nunca rompe el render).
 */
export function cardShapePath(fmt: { shape?: string; shapePath?: string } | undefined): string | null {
  if (fmt?.shape === CUSTOM_CARD_SHAPE) {
    return fmt.shapePath && validateShapePath(fmt.shapePath) === null ? fmt.shapePath : null;
  }
  return cardShapeById(fmt?.shape).path;
}

// ─────────────────────────────────────────────────────────────────────────
// KRO-230 — TAMAÑO de la silueta (escala uniforme dentro de la caja de carta)
// ─────────────────────────────────────────────────────────────────────────

/** Escala por defecto: la silueta llena la caja de la carta. */
export const DEFAULT_SHAPE_SCALE = 1;
/** Escala mínima: la silueta a la mitad, centrada (deja margen alrededor). */
export const MIN_SHAPE_SCALE = 0.5;

/** Normaliza `shapeScale` al rango [MIN_SHAPE_SCALE, 1]; ausente/no-num ⇒ 1. */
export function clampShapeScale(scale: number | undefined): number {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return DEFAULT_SHAPE_SCALE;
  return Math.min(DEFAULT_SHAPE_SCALE, Math.max(MIN_SHAPE_SCALE, scale));
}

/**
 * Escala un path del protocolo alrededor de su CENTRO (0.5, 0.5) por `scale`,
 * manteniéndolo en el espacio 0..1 (para `scale ≤ 1` ⇒ deja margen; a `1`
 * devuelve el path intacto). Como la gramática es solo M/L/C/Q/Z, TODO número
 * es una coordenada → basta reproyectar cada uno: `v' = 0.5 + (v − 0.5)·s`.
 * El mismo cálculo lo replica Flutter (escalar el Path sobre su centro).
 */
export function scaleShapePath(path: string, scale: number): string {
  const s = clampShapeScale(scale);
  if (s === DEFAULT_SHAPE_SCALE) return path;
  return path.replace(/-?\d*\.?\d+/g, (n) => {
    const v = 0.5 + (Number(n) - 0.5) * s;
    return String(Math.round(v * 10000) / 10000);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// KRO-232 — MARCAS DENTRO DE LA SILUETA
// ─────────────────────────────────────────────────────────────────────────

/** Esquina de la celda donde va una marca (número, «la tienes», favorito). */
export type CardCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Hasta dónde se puede meter una marca hacia dentro buscando sitio: un 30 % de
 * la carta. Más allá deja de estar «en la esquina» y se lee como otra cosa, así
 * que es mejor decir que no cabe (`null`) y que el host decida.
 */
export const CARD_SHAPE_BADGE_INSET_MAX = 0.3;

/** Resolución de la búsqueda (0,5 % de la carta). */
const PASO_INSET = 0.005;
/** Tramos al aplanar cada curva: de sobra para una celda de rejilla. */
const PASOS_CURVA = 24;

type Punto = [number, number];

/** Aplana un path VÁLIDO del protocolo (M/L/Q/C/Z) a un polígono. */
function aplanarPath(path: string): Punto[] {
  const t = path.trim().split(/\s+/);
  const pts: Punto[] = [];
  let i = 0;
  let cur: Punto = [0, 0];
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') {
      cur = [Number(t[i++]), Number(t[i++])];
      pts.push(cur);
    } else if (c === 'Q') {
      const cx = Number(t[i++]), cy = Number(t[i++]), x = Number(t[i++]), y = Number(t[i++]);
      for (let k = 1; k <= PASOS_CURVA; k++) {
        const u = k / PASOS_CURVA, a = 1 - u;
        pts.push([a * a * cur[0] + 2 * a * u * cx + u * u * x, a * a * cur[1] + 2 * a * u * cy + u * u * y]);
      }
      cur = [x, y];
    } else if (c === 'C') {
      const x1 = Number(t[i++]), y1 = Number(t[i++]), x2 = Number(t[i++]), y2 = Number(t[i++]), x = Number(t[i++]), y = Number(t[i++]);
      for (let k = 1; k <= PASOS_CURVA; k++) {
        const u = k / PASOS_CURVA, a = 1 - u;
        pts.push([
          a * a * a * cur[0] + 3 * a * a * u * x1 + 3 * a * u * u * x2 + u * u * u * x,
          a * a * a * cur[1] + 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u * y,
        ]);
      }
      cur = [x, y];
    }
    // Z: el polígono se cierra solo (el último vértice enlaza con el primero).
  }
  return pts;
}

function puntoDentro([px, py]: Punto, poly: Punto[]): boolean {
  let dentro = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xi, yi] = poly[a], [xj, yj] = poly[b];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** ¿Se cortan los segmentos pq y rs (en su interior)? */
function seCortan(p: Punto, q: Punto, r: Punto, s: Punto): boolean {
  const o = (a: Punto, b: Punto, c: Punto) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = o(p, q, r), d2 = o(p, q, s), d3 = o(r, s, p), d4 = o(r, s, q);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Una caja cabe ENTERA en el polígono si sus cuatro esquinas están dentro y
 * ningún borde de la silueta la atraviesa. Lo segundo es lo que un muestreo de
 * puntos no ve: una muesca estrecha que entra en la caja entre dos muestras.
 */
function cajaDentro(x: number, y: number, w: number, h: number, poly: Punto[]): boolean {
  const esquinas: Punto[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (!esquinas.every(e => puntoDentro(e, poly))) return false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    for (let k = 0; k < 4; k++) {
      if (seCortan(poly[b], poly[a], esquinas[k], esquinas[(k + 1) % 4])) return false;
    }
  }
  return true;
}

/**
 * KRO-471 — ¿cabe la caja ENTERA dentro de la silueta de la carta?
 *
 * Mismo espacio normalizado y misma geometría que {@link cardShapeBadgeInset}:
 * `box` va en fracción del ancho (`x`, `w`) y del alto (`y`, `h`) de la carta. Sin
 * silueta (estándar, o una custom inválida que cae a estándar) cabe siempre que
 * esté dentro de la carta. Lo usa el paquete de impresión de Studio para avisar de
 * un QR que el troquel cortaría.
 */
export function cardShapeBoxInside(
  fmt: { shape?: string; shapePath?: string; shapeScale?: number } | undefined,
  box: { x: number; y: number; w: number; h: number },
): boolean {
  const dentroDeLaCarta = box.x >= 0 && box.y >= 0 && box.x + box.w <= 1 && box.y + box.h <= 1;
  if (!dentroDeLaCarta) return false;
  const base = cardShapePath(fmt);
  if (!base) return true;
  const poly = aplanarPath(scaleShapePath(base, fmt?.shapeScale ?? DEFAULT_SHAPE_SCALE));
  return cajaDentro(box.x, box.y, box.w, box.h, poly);
}

/**
 * Cuánto hay que meter una marca hacia dentro, desde su esquina, para que quepa
 * ENTERA en la silueta de la carta.
 *
 * Todo va en el espacio normalizado de la carta (0..1 en cada eje): `box` es el
 * tamaño de la marca como fracción del ancho (`w`) y del alto (`h`), y lo que
 * devuelve es la distancia desde los dos bordes de esa esquina, también en
 * fracción (del ancho en horizontal y del alto en vertical). Es la MÍNIMA: la
 * marca se queda lo más cerca posible de su esquina.
 *
 * - Sin silueta (estándar, o una custom inválida que cae a estándar) → `null`:
 *   el host sigue con su regla del redondeo de esquinas.
 * - Si no cabe antes de {@link CARD_SHAPE_BADGE_INSET_MAX} → `null`, en vez de
 *   llevar la marca al centro de la carta.
 *
 * Decisión del user (KRO-232, «D»): lo que sobresalga de la forma se sigue
 * recortando; esto solo coloca las marcas donde no sobresalen. Studio y la app
 * lo leen de aquí para ponerlas en el mismo sitio.
 */
export function cardShapeBadgeInset(
  fmt: { shape?: string; shapePath?: string; shapeScale?: number } | undefined,
  corner: CardCorner,
  box: { w: number; h: number },
): number | null {
  const base = cardShapePath(fmt);
  if (!base) return null;
  const poly = aplanarPath(scaleShapePath(base, fmt?.shapeScale ?? DEFAULT_SHAPE_SCALE));
  const izquierda = corner.endsWith('left');
  const arriba = corner.startsWith('top');
  for (let paso = 0; paso * PASO_INSET <= CARD_SHAPE_BADGE_INSET_MAX + 1e-9; paso++) {
    const s = paso * PASO_INSET;
    const x = izquierda ? s : 1 - s - box.w;
    const y = arriba ? s : 1 - s - box.h;
    if (cajaDentro(x, y, box.w, box.h, poly)) return Math.round(s * 1000) / 1000;
  }
  return null;
}
