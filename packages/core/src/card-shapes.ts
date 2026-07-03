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
