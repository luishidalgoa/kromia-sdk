/**
 * KRO-122 — Receta DATA del render del FOIL PERSONALIZADO (`custom_foil`).
 *
 * El foil personalizado NO es un id de catálogo: es una PILA DE CAPAS que aporta
 * el creador. Cada capa (`EffectLayer`, en `types.ts`) = una TEXTURA (lámina
 * tornasolada / glitter / patrón) + una MÁSCARA opcional (grises: dónde brilla)
 * + un modo de FUSIÓN (blend) + una INTENSIDAD. El render las SUPERPONE sobre el
 * arte de la carta, en orden, y el glare/tilt 3D los pone el host.
 *
 * Esta receta se movió a @kromia/core = fuente ÚNICA cross-platform. Antes las
 * reglas de compositing (defaults, tamaño de textura, modo de máscara, orden,
 * fusión) vivían hardcodeadas en Studio `FoilLayer.tsx` → Flutter no tenía nada
 * canónico que espejar = DRIFT (síntoma típico: la capa tapa el arte con un lavado
 * plano, porque se compone mal —sin máscara por luminancia y/o contra el fondo de
 * la celda en vez de contra el arte—).
 *
 * Reparto de responsabilidades del modelo:
 *  - TIPO (`EffectLayer`/`EffectLayerKind`/`EffectBlendMode`) → `types.ts`.
 *  - RESOLVER (qué capas aplican a una carta) → `effect-resolve.ts`.
 *  - RECETA de cómo se PINTA cada capa (este fichero) → capa C (render). NO entra
 *    al `.json` del contrato (es política de render), pero SÍ es fuente única.
 *
 * Spec de render cross-platform (orden, compositing, paridad): ver
 * `docs/custom-foil-render-spec.md`.
 */

import type { EffectLayer, EffectLayerKind, EffectBlendMode } from './types';

/** Los 3 KINDS de capa, en orden de declaración (== orden del selector del editor).
 *  El kind orienta el LAYOUT de la textura (ver `foilTextureLayout`). */
export const EFFECT_LAYER_KINDS: readonly EffectLayerKind[] = ['foil', 'glitter', 'pattern'];

/** Los 5 modos de FUSIÓN canónicos, en orden del selector. Las keys == nombres de
 *  CSS `mix-blend-mode`; para el mapeo a Flutter ver `EFFECT_BLEND_TO_FLUTTER`. */
export const EFFECT_BLEND_MODES: readonly EffectBlendMode[] = [
  'color-dodge', 'overlay', 'screen', 'soft-light', 'hard-light',
];

/** Type guard: ¿`x` es un modo de fusión válido? (validación de contrato/data). */
export function isEffectBlendMode(x: unknown): x is EffectBlendMode {
  return typeof x === 'string' && (EFFECT_BLEND_MODES as readonly string[]).includes(x);
}

/** Type guard: ¿`x` es un kind de capa válido? */
export function isEffectLayerKind(x: unknown): x is EffectLayerKind {
  return typeof x === 'string' && (EFFECT_LAYER_KINDS as readonly string[]).includes(x);
}

/** Defaults de una capa NUEVA (== `emptyEffectLayer` del editor de Studio). Fuente
 *  única: si un host crea capas, arranca de aquí. `motion` queda sin fijar (ver
 *  nota en `CUSTOM_FOIL_TILT`). */
export const CUSTOM_FOIL_LAYER_DEFAULTS = {
  kind: 'foil' as EffectLayerKind,
  blend: 'color-dodge' as EffectBlendMode,
  intensity: 0.6,
} as const;

/** Opacidad EFECTIVA de una capa = `intensity` (0..1), default 0.6. Fuente única
 *  para que Studio y Flutter apliquen exactamente la misma opacidad por capa. */
export function foilLayerOpacity(layer: Pick<EffectLayer, 'intensity'>): number {
  const v = layer.intensity ?? CUSTOM_FOIL_LAYER_DEFAULTS.intensity;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Layout de la TEXTURA de una capa según su `kind`. En % del cuadro de la carta:
 *  - `pattern` → TESELA que se REPITE (repeat), muestreada a 160% (grande, se
 *    tesela sin costura).
 *  - `foil` / `glitter` → lámina ÚNICA (sin repeat) SOBREDIMENSIONADA a 250%×100%,
 *    para dejar RECORRIDO al paneo por tilt (la lámina "reluce" al mover la carta,
 *    ver `CUSTOM_FOIL_TILT`). */
export interface FoilTextureLayout {
  /** ¿La textura se tesela? (CSS `background-repeat: repeat`). */
  repeat: boolean;
  /** Ancho de muestreo en % del cuadro (CSS `background-size` eje X). */
  sizeW: number;
  /** Alto en % del cuadro; `'auto'` conserva el aspect de la tesela (solo pattern). */
  sizeH: number | 'auto';
}
export function foilTextureLayout(kind: EffectLayerKind): FoilTextureLayout {
  return kind === 'pattern'
    ? { repeat: true,  sizeW: 160, sizeH: 'auto' }
    : { repeat: false, sizeW: 250, sizeH: 100 };
}

/**
 * MÁSCARA de una capa — CRÍTICO para la paridad. La máscara es una imagen en
 * GRISES que limita DÓNDE brilla la textura: blanco = brilla, negro = oculta.
 * Se interpreta SIEMPRE por LUMINANCIA (NO por alfa): una máscara opaca (alfa=1)
 * en negro debe OCULTAR, y por alfa no ocultaría nada. Encajada como la textura
 * que enmascara: `cover` + `center` (la máscara se genera del MISMO arte/aspect).
 * Sin `maskUrl` → la capa brilla ENTERA (sin recorte).
 *
 * - Studio (CSS): `mask-mode: luminance; mask-size: cover; mask-position: center;
 *   mask-repeat: no-repeat`.
 * - Flutter: convertir la máscara a alfa por luminancia (p.ej. un `ColorFilter`
 *   luma→alfa, o el canal de luminancia en el shader) y aplicarla como
 *   `BlendMode.dstIn` sobre la capa de textura. NO usar el alfa crudo de la máscara.
 */
export const CUSTOM_FOIL_MASK = {
  /** Interpretación de la máscara: por LUMINANCIA (no alfa). */
  mode: 'luminance',
  /** Encaje de la máscara sobre el cuadro (== la textura que enmascara). */
  fit: 'cover',
  align: 'center',
  repeat: false,
} as const;

/**
 * TILT / movimiento del brillo. La textura (sobredimensionada, ver
 * `foilTextureLayout`) se PANEA con la inclinación de la carta: el host publica un
 * punto normalizado `(hx, hy)` en 0..1 (en Studio las CSS vars `--holo-x`/`--holo-y`,
 * en Flutter el giroscopio/drag) y la textura se posiciona en ese punto → el
 * tornasol se DESPLAZA al mover la carta, sin bucle ni "reinicio".
 *
 * ⚠️ El campo `EffectLayer.motion` (0..1) está RESERVADO: hoy el paneo es a fuerza
 * completa en ambos hosts (Studio no lo lee). Si se implementa, escalaría el paneo
 * alrededor del centro (0.5): `pos = 0.5 + (h - 0.5) * motion`. Documentado para que
 * NADIE invente una fórmula distinta por su cuenta (eso reintroduce drift).
 */
export const CUSTOM_FOIL_TILT = {
  /** El paneo de la textura sigue el punto (hx,hy) 0..1. Centro por defecto. */
  defaultPoint: 0.5,
  /** Transición del paneo al mover (ms) — suaviza el seguimiento del puntero. */
  followMs: 140,
} as const;

/**
 * SHIMMER en rejilla (cuando NO hay tilt: listas/grid). Un vaivén suave (ping-pong)
 * hace relucir la lámina sola. Números canónicos por-capa (`i` = índice en la pila,
 * desincroniza capas vecinas). Studio: keyframes CSS `kr-foil-shimmer`; Flutter:
 * su equivalente con estos mismos valores para que el ritmo coincida.
 */
export const CUSTOM_FOIL_SHIMMER = {
  /** Duración base (s) + incremento por capa. */
  durationBaseS: 3.4,
  durationStepS: 0.5,
  /** Desfase (s) por capa (resta → capas vecinas no laten a la vez). */
  delayStepS: 0.3,
} as const;

/**
 * Mapa CANÓNICO de FUSIÓN → `BlendMode` de Flutter (`dart:ui`). Las keys web (CSS
 * `mix-blend-mode`) y estos valores Flutter son la MISMA operación de mezcla; esta
 * tabla evita que Flutter mapee a mano (fuente de drift). El blend se aplica de la
 * capa CONTRA el resultado compuesto hasta ahí (arte + capas previas), NO contra el
 * fondo de la celda — ver la spec (compositing).
 */
export const EFFECT_BLEND_TO_FLUTTER: Record<EffectBlendMode, string> = {
  'color-dodge': 'BlendMode.colorDodge',
  'overlay':     'BlendMode.overlay',
  'screen':      'BlendMode.screen',
  'soft-light':  'BlendMode.softLight',
  'hard-light':  'BlendMode.hardLight',
};

/** Orden de PINTADO de la pila: las capas se superponen en el orden del array
 *  (`customLayers[0]` es la más al fondo, la última la más arriba). El z-order lo
 *  controla el publisher reordenando en el editor. */
export const CUSTOM_FOIL_LAYER_ORDER = 'array-order' as const;
