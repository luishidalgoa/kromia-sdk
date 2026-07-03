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

export const CARD_SHAPES: ReadonlyArray<CardShapeDefinition> = [
  {
    id: 'standard', label: 'Estándar',
    tooltip: 'Rectángulo redondeado clásico (el redondeo lo controla "Redondeado")',
    path: null,
  },
  {
    id: 'chamfer', label: 'Esquinas cortadas',
    tooltip: 'Chaflán recto en las 4 esquinas — estilo cromo deportivo retro',
    path: 'M 0.1 0 L 0.9 0 L 1 0.07 L 1 0.93 L 0.9 1 L 0.1 1 L 0 0.93 L 0 0.07 Z',
  },
  {
    id: 'arch', label: 'Arco superior',
    tooltip: 'Cabecera en arco — silueta clásica de cromo de fútbol',
    path: 'M 0 1 L 0 0.2 C 0 0.055 0.22 0 0.5 0 C 0.78 0 1 0.055 1 0.2 L 1 1 Z',
  },
  {
    id: 'ticket', label: 'Ticket',
    tooltip: 'Muescas semicirculares a media altura — entrada/cupón',
    // Muescas como cúbicas (semicírculo ≈ C con controles a 4/3·r) — la gramática
    // canónica del protocolo es M/L/C/Q/Z, sin arcos elípticos (A).
    path: 'M 0.06 0 L 0.94 0 Q 1 0 1 0.04 L 1 0.455 C 0.927 0.455 0.927 0.545 1 0.545 L 1 0.96 Q 1 1 0.94 1 L 0.06 1 Q 0 1 0 0.96 L 0 0.545 C 0.073 0.545 0.073 0.455 0 0.455 L 0 0.04 Q 0 0 0.06 0 Z',
  },
  {
    id: 'shield', label: 'Escudo',
    tooltip: 'Escudo heráldico — insignias, clubs, blasones',
    path: 'M 0.5 0 L 0.94 0.06 Q 1 0.07 1 0.13 L 1 0.55 C 1 0.78 0.8 0.92 0.5 1 C 0.2 0.92 0 0.78 0 0.55 L 0 0.13 Q 0 0.07 0.06 0.06 Z',
  },
  {
    id: 'hex', label: 'Hexágono',
    tooltip: 'Hexágono vertical — gemas, fichas, sci-fi',
    path: 'M 0.5 0 L 1 0.13 L 1 0.87 L 0.5 1 L 0 0.87 L 0 0.13 Z',
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
  if (segs < 3) return 'La forma necesita al menos 3 segmentos.';
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
