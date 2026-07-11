/// `custom_foil_recipe.dart` — KRO-122/245. Receta DATA del render del FOIL
/// PERSONALIZADO (`custom_foil`). Espejo 1:1 de `custom-foil-recipe.ts` (SDK
/// `59688aa`): mantener a mano (render-only, sin bump de protocolVersion). Spec
/// cross-platform: `docs/custom-foil-render-spec.md`.
///
/// El foil personalizado NO es un id de catálogo: es una PILA de capas del creador
/// (`EffectLayer` = textura + máscara opcional + blend + intensidad). La máscara se
/// interpreta por LUMINANCIA (blanco brilla, negro oculta — NUNCA por alfa) y el
/// blend se aplica CONTRA el compuesto (arte + capas previas), no contra el fondo.
library;

// (Los catálogos `effectLayerKinds` y `effectBlendModes` ya viven en
// `card_layers.dart` — aquí solo la POLÍTICA de render.)

/// Defaults de una capa NUEVA (== `emptyEffectLayer` de Studio).
const ({String kind, String blend, double intensity}) customFoilLayerDefaults =
    (kind: 'foil', blend: 'color-dodge', intensity: 0.6);

/// Opacidad EFECTIVA de una capa = `intensity` (0..1, clamp), default 0.6.
double foilLayerOpacity(num? intensity) =>
    (intensity ?? customFoilLayerDefaults.intensity).clamp(0.0, 1.0).toDouble();

/// Layout de la TEXTURA por `kind` (en % del cuadro de la carta):
/// pattern → TESELA repetida al 160% (alto auto); foil/glitter → lámina ÚNICA
/// sobredimensionada 250%×100% (recorrido para el paneo por tilt).
({bool repeat, double sizeW, double? sizeH}) foilTextureLayout(String kind) =>
    kind == 'pattern'
        ? (repeat: true, sizeW: 160, sizeH: null) // null = 'auto'
        : (repeat: false, sizeW: 250, sizeH: 100);

/// MÁSCARA: por LUMINANCIA, encaje cover+center, sin repeat. Flutter la convierte
/// luma→alfa (shader/ColorFilter) — NO usar el alfa crudo.
const ({String mode, String fit, String align, bool repeat}) customFoilMask =
    (mode: 'luminance', fit: 'cover', align: 'center', repeat: false);

/// TILT: la textura se panea con (hx,hy) 0..1; `motion` RESERVADO (paneo a fuerza
/// completa en ambos hosts — no inventar fórmula).
const ({double defaultPoint, int followMs}) customFoilTilt =
    (defaultPoint: 0.5, followMs: 140);

/// SHIMMER en rejilla: vaivén ping-pong; duración 3.4s + 0.5s·capa, desfase −0.3s·capa.
const ({double durationBaseS, double durationStepS, double delayStepS})
    customFoilShimmer = (durationBaseS: 3.4, durationStepS: 0.5, delayStepS: 0.3);

/// Orden de PINTADO: el del array (`customLayers[0]` al fondo).
const String customFoilLayerOrder = 'array-order';
