/**
 * `card-layers.ts` — KRO-130. Capas de PROFUNDIDAD (parallax) de una carta.
 *
 * La ilustración premium se descompone en cutouts (fondo / sujeto / partículas)
 * que se desplazan a distinto ritmo al inclinar la carta → 3D real. Lógica PURA
 * (catálogo + factor de parallax + lectura/validación del dato), compartida por
 * Studio (CSS `translateZ`/`--holo-x/y`) y Flutter (`Transform` + giroscopio)
 * para que el efecto sea idéntico en ambas plataformas.
 *
 * Las capas son OPT-IN por carta y viven en el DATO de la carta bajo
 * `DEPTH_LAYERS_KEY` (no en el schema ni en TagStyle: el arte es único por carta).
 * No entran al `.json` del contrato → sin bump de PROTOCOL_VERSION.
 */
import type { CardDepthLayer, LayerDepth } from './types';
import type { CatalogOption } from './options';

/** Campo reservado del dato de la carta donde viven las capas de profundidad. */
export const DEPTH_LAYERS_KEY = '__depthLayers';

/** Orden de compositing/pintado: fondo → medio → frente. */
export const LAYER_DEPTH_ORDER: readonly LayerDepth[] = ['back', 'mid', 'front'];

/** Catálogo cerrado de profundidad para el editor (patrón KRO-75). */
export const OPTIONS_LAYER_DEPTH: ReadonlyArray<CatalogOption> = [
  { id: 'back',  label: 'Fondo',  tooltip: 'Capa de atrás — se mueve poco al inclinar' },
  { id: 'mid',   label: 'Medio',  tooltip: 'El sujeto — parallax moderado' },
  { id: 'front', label: 'Frente', tooltip: 'Partículas / efectos — se mueve mucho' },
];

/** Factor de parallax 0..1 por profundidad. back (fondo) ≈ quieto; front (partículas) ≈ máximo. */
const PARALLAX_FACTOR: Record<LayerDepth, number> = {
  back:  0.15,
  mid:   0.45,
  front: 1.0,
};

/**
 * Cuánto se desplaza una capa con el ángulo de vista (0..1). Lo comparten Studio
 * y Flutter para que el 3D salga idéntico. Valor fuera de catálogo → 0.5 (neutro).
 */
export function depthToParallaxFactor(depth: LayerDepth): number {
  return PARALLAX_FACTOR[depth] ?? 0.5;
}

/**
 * Lee las capas de profundidad del dato de una carta (campo reservado). Devuelve
 * `[]` si la carta no tiene (carta plana → render normal). Descarta entradas
 * malformadas y ordena fondo→frente para el compositing.
 */
export function getCardDepthLayers(card: Record<string, unknown> | null | undefined): CardDepthLayer[] {
  if (!card || typeof card !== 'object') return [];
  const raw = (card as Record<string, unknown>)[DEPTH_LAYERS_KEY];
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter((l): l is CardDepthLayer =>
    !!l && typeof l === 'object' &&
    typeof (l as Record<string, unknown>).url === 'string' &&
    LAYER_DEPTH_ORDER.includes((l as Record<string, unknown>).depth as LayerDepth),
  );
  return [...valid].sort(
    (a, b) => LAYER_DEPTH_ORDER.indexOf(a.depth) - LAYER_DEPTH_ORDER.indexOf(b.depth),
  );
}

export interface DepthLayerIssue {
  /** Índice de la capa con el problema. */
  index: number;
  message: string;
}
export interface DepthLayerValidationResult {
  valid: boolean;
  issues: DepthLayerIssue[];
}

/**
 * Valida una lista de capas de profundidad. Reglas: `url` no vacía, `depth`
 * dentro del catálogo, y si trae `foil`, su `textureUrl` no vacía. No exige un
 * número concreto de capas (es opt-in). Lista vacía/ausente = válida.
 */
export function validateCardDepthLayers(
  layers: CardDepthLayer[] | null | undefined,
): DepthLayerValidationResult {
  const issues: DepthLayerIssue[] = [];
  if (!layers) return { valid: true, issues };

  layers.forEach((l, index) => {
    if (!l || typeof l !== 'object') {
      issues.push({ index, message: 'Capa inválida' });
      return;
    }
    if (typeof l.url !== 'string' || l.url.trim() === '') {
      issues.push({ index, message: 'La capa necesita una imagen (url)' });
    }
    if (!LAYER_DEPTH_ORDER.includes(l.depth)) {
      issues.push({ index, message: `Profundidad inválida: ${String(l.depth)}` });
    }
    if (l.foil && (typeof l.foil.textureUrl !== 'string' || l.foil.textureUrl.trim() === '')) {
      issues.push({ index, message: 'El foil de la capa necesita una textura (textureUrl)' });
    }
  });

  return { valid: issues.length === 0, issues };
}
