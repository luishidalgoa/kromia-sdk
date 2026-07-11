/// `card_layers.dart` — KRO-130/122. Capas de PROFUNDIDAD (parallax) + FOIL de
/// una carta. Espejo Dart PURO de `@kromia/core` `card-layers.ts` (+ los tipos
/// `EffectLayer`/`CardDepthLayer` de `types.ts`, líneas 579-693).
///
/// La ilustración premium se descompone en cutouts (fondo/sujeto/partículas) que
/// se desplazan a distinto ritmo al inclinar la carta → 3D real. Lógica PURA
/// (catálogo + factor de parallax + lectura/validación del dato), compartida por
/// Studio (CSS `translateZ`/`--holo-x/y`) y Flutter (`Transform` + giroscopio).
///
/// Las capas son OPT-IN por carta y viven en el DATO de la carta bajo
/// [depthLayersKey] (no en el schema ni en TagStyle: el arte es único por carta).
/// No entran al `.json` del contrato → sin bump de PROTOCOL_VERSION. El drift-test
/// del `.json` NO cubre esta capa: estos valores DEBEN mantenerse 1:1 con el TS a
/// mano (ver el canario de constantes en `card_layers_test.dart`).
library;

import 'custom_foil_recipe.dart' show iridescentLayerKind;

/// Tipos de capa DE TEXTURA (foil importable, KRO-122). Espacio cerrado.
/// ⚠️ NO incluye `'iridescent'` (KRO-250, capa PROCEDURAL): ese kind es válido
/// en [EffectLayer.kind] (ver [isEffectLayerKind]) pero no lleva textura — se
/// pinta con el motor del iridiscente desde [EffectLayer.config].
const Set<String> effectLayerKinds = {'foil', 'glitter', 'pattern'};

/// KRO-250 — ¿[x] es un kind de capa válido? (textura O procedural). Espejo de
/// `isEffectLayerKind` (`custom-foil-recipe.ts`).
bool isEffectLayerKind(String x) =>
    effectLayerKinds.contains(x) || x == iridescentLayerKind;

/// Modos de fusión admitidos (valor técnico CSS; el label es presentación).
/// Mapean a `BlendMode` de Flutter en el render:
/// color-dodge→colorDodge, overlay→overlay, screen→screen,
/// soft-light→softLight, hard-light→hardLight.
const Set<String> effectBlendModes = {
  'color-dodge',
  'overlay',
  'screen',
  'soft-light',
  'hard-light',
};

/// Capa de efecto foil/glitter/pattern/iridescent (KRO-122/250) — render-agnóstico,
/// NO entra al `.json`. La [maskUrl] es una imagen en GRISES interpretada por
/// LUMINANCIA (BLANCO = brilla, NEGRO = no, gris = parcial) — NO por canal alfa.
class EffectLayer {
  /// 'foil' | 'glitter' | 'pattern' | 'iridescent' (KRO-250, procedural).
  final String kind;

  /// Lámina tornasolada / glitter / patrón (URL servida por el proxy de imágenes).
  /// En el TS es OPCIONAL desde KRO-250; aquí `''` = sin textura (mismo JSON,
  /// mismo guard `isEmpty` en render). Obligatoria en kinds de TEXTURA (sin ella
  /// la capa no se pinta); NO aplica a `'iridescent'`.
  final String textureUrl;

  /// KRO-250 — SOLO `kind:'iridescent'`: config del motor iridiscente (los
  /// params del catálogo `iridescent_foil`). En una capa procedural GOBIERNA
  /// TODO el pintado: [textureUrl], [maskUrl], [maskLayout], [maskScale],
  /// [blend], [intensity] y [motion] se IGNORAN. El efecto de catálogo ≡ pila
  /// de 1 capa iridiscente (retro-compat, nada migra).
  final Map<String, Object>? config;

  /// Máscara en grises (luminancia → opacidad). null = cubre toda la carta.
  final String? maskUrl;

  /// KRO-248 — encaje de la máscara: 'cover' (clásico) | 'tile' (tesela).
  /// null = 'cover' (retro-compat). Ver `foilMaskLayout` (custom_foil_recipe).
  final String? maskLayout;

  /// KRO-248 — escala de la tesela con `maskLayout:'tile'` (% del ancho del
  /// cuadro, 5–100). null = default de la receta (`foilMaskTile`).
  final double? maskScale;

  /// Modo de fusión (uno de [effectBlendModes]).
  final String blend;

  /// 0..1 — opacidad efectiva de la capa. default de render: 0.6.
  final double? intensity;

  /// 0..1 — cuánto se desplaza la textura con el tilt.
  final double? motion;

  const EffectLayer({
    required this.kind,
    this.textureUrl = '',
    required this.blend,
    this.config,
    this.maskUrl,
    this.maskLayout,
    this.maskScale,
    this.intensity,
    this.motion,
  });

  factory EffectLayer.fromJson(Map<String, dynamic> json) => EffectLayer(
        kind: (json['kind'] as String?) ?? 'foil',
        textureUrl: (json['textureUrl'] as String?) ?? '',
        blend: (json['blend'] as String?) ?? 'overlay',
        config: (json['config'] as Map?)
            ?.map((k, v) => MapEntry(k.toString(), v as Object)),
        maskUrl: json['maskUrl'] as String?,
        maskLayout: json['maskLayout'] as String?,
        maskScale: (json['maskScale'] as num?)?.toDouble(),
        intensity: (json['intensity'] as num?)?.toDouble(),
        motion: (json['motion'] as num?)?.toDouble(),
      );
}

/// Pila de capas + profundidad (KRO-122, poco usado hoy).
class CardEffect3D {
  final List<EffectLayer> layers;

  /// 0..1.
  final double? depth;

  const CardEffect3D({required this.layers, this.depth});

  factory CardEffect3D.fromJson(Map<String, dynamic> json) => CardEffect3D(
        layers: ((json['layers'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => EffectLayer.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        depth: (json['depth'] as num?)?.toDouble(),
      );
}

/// Campo reservado del dato de la carta donde viven las capas de profundidad.
const String depthLayersKey = '__depthLayers';

/// Orden de compositing/pintado: fondo → medio → frente.
const List<String> layerDepthOrder = ['back', 'mid', 'front'];

/// Factor de parallax 0..1 por profundidad. back (fondo) ≈ quieto; front
/// (partículas) ≈ máximo. DEBE ser idéntico al TS (`PARALLAX_FACTOR`).
const Map<String, double> parallaxFactor = {
  'back': 0.15,
  'mid': 0.45,
  'front': 1.0,
};

/// Capa de profundidad 3D (KRO-130) — per-carta, NO entra al `.json`. La [depth]
/// es uno de [layerDepthOrder]. [foil] es el foil propio de ESTA capa (opcional,
/// se mueve CON el parallax de la capa).
class CardDepthLayer {
  /// Cutout PNG con transparencia.
  final String url;

  /// 'back' | 'mid' | 'front'.
  final String depth;

  final EffectLayer? foil;

  const CardDepthLayer({required this.url, required this.depth, this.foil});

  factory CardDepthLayer.fromJson(Map<String, dynamic> json) => CardDepthLayer(
        url: (json['url'] as String?) ?? '',
        depth: (json['depth'] as String?) ?? '',
        foil: json['foil'] is Map
            ? EffectLayer.fromJson((json['foil'] as Map).cast<String, dynamic>())
            : null,
      );
}

/// Cuánto se desplaza una capa con el ángulo de vista (0..1). Lo comparten Studio
/// y Flutter para que el 3D salga idéntico. Profundidad fuera de catálogo → 0.5.
double depthToParallaxFactor(String depth) => parallaxFactor[depth] ?? 0.5;

/// Lee las capas de profundidad del dato de una carta (campo reservado). Devuelve
/// `[]` si la carta no tiene (carta plana → render normal). Descarta entradas
/// malformadas (sin `url` string o `depth` fuera de catálogo) y ordena
/// fondo→frente para el compositing.
List<CardDepthLayer> getCardDepthLayers(Map<String, dynamic>? card) {
  if (card == null) return const [];
  final raw = card[depthLayersKey];
  if (raw is! List) return const [];

  final valid = <CardDepthLayer>[];
  for (final l in raw) {
    if (l is! Map) continue;
    final m = l.cast<String, dynamic>();
    final url = m['url'];
    final depth = m['depth'];
    if (url is! String) continue;
    if (depth is! String || !layerDepthOrder.contains(depth)) continue;
    valid.add(CardDepthLayer.fromJson(m));
  }
  valid.sort((a, b) =>
      layerDepthOrder.indexOf(a.depth) - layerDepthOrder.indexOf(b.depth));
  return valid;
}

/// Un issue de [validateCardDepthLayers].
class DepthLayerIssue {
  final int index;
  final String message;
  const DepthLayerIssue({required this.index, required this.message});

  @override
  String toString() => '[$index] $message';
}

/// Resultado de [validateCardDepthLayers].
class DepthLayerValidationResult {
  final bool valid;
  final List<DepthLayerIssue> issues;
  const DepthLayerValidationResult({required this.valid, required this.issues});
}

/// Valida una lista de capas de profundidad. Reglas: `url` no vacía, `depth`
/// dentro del catálogo, y si trae `foil`, su `textureUrl` no vacía. No exige un
/// número concreto de capas (opt-in). Lista vacía/ausente = válida.
DepthLayerValidationResult validateCardDepthLayers(List<CardDepthLayer>? layers) {
  final issues = <DepthLayerIssue>[];
  if (layers == null) {
    return const DepthLayerValidationResult(valid: true, issues: []);
  }
  for (var index = 0; index < layers.length; index++) {
    final l = layers[index];
    if (l.url.trim().isEmpty) {
      issues.add(DepthLayerIssue(index: index, message: 'La capa necesita una imagen (url)'));
    }
    if (!layerDepthOrder.contains(l.depth)) {
      issues.add(DepthLayerIssue(index: index, message: 'Profundidad inválida: ${l.depth}'));
    }
    final foil = l.foil;
    if (foil != null && foil.textureUrl.trim().isEmpty) {
      issues.add(DepthLayerIssue(
          index: index, message: 'El foil de la capa necesita una textura (textureUrl)'));
    }
  }
  return DepthLayerValidationResult(valid: issues.isEmpty, issues: issues);
}
