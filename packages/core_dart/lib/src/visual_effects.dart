/// `visual_effects.dart` — KRO-30. Catálogo de efectos visuales por valor de tag.
///
/// Espejo del registry TS `visual-effects.ts`. A DIFERENCIA del resto de
/// registries (recipes/behaviors, que son const Dart), el catálogo NO se
/// hardcodea: se lee del array `visualEffects[]` del `.json` del KRP, embebido
/// aquí como string (`_visualEffectsJson`) y parseado en frío (lazy). Mirror
/// desde el contrato — no re-tipado a mano → cero drift de datos. Para alinear
/// tras un cambio del contrato basta reemplazar el bloque embebido.
///
/// El RENDER del efecto (widget/overlay) NO vive aquí: es kromia-flutter
/// (`lib/widgets/visual-effects/<id>.dart`). core_dart solo declara el catálogo
/// + el contrato de config + el lookup para el dispatcher effect→widget.
///
/// Nota: el `.json` NO incluye `label` de cada config param (es editor-only de
/// Studio, no entra al contrato) ni la doc rica — por eso no están en el modelo.
library;

import 'dart:convert';

/// Capa que el efecto aplica sobre la carta. Orienta al renderer.
const Set<String> visualEffectLayers = {'overlay', 'badge', 'filter', 'border'};

/// Un parámetro de config de un efecto. Espacio de valores CERRADO (enum con
/// `options`, o number acotado por `min`/`max`); `string` se reserva para
/// refs/urls. Opcional salvo que `optional == false`.
class VisualEffectConfigParam {
  /// Key técnica — lo que se almacena en `TagStyle.config[key]`. Estable.
  final String key;

  /// Tipo del valor admitido: 'enum' | 'number' | 'string'.
  final String type;

  /// Para `type: 'enum'` — valores admitidos (cerrado).
  final List<String>? options;

  /// Valor por defecto si el publisher no lo configura (String | num).
  final Object? defaultValue;

  /// Para `type: 'number'` — mínimo inclusivo.
  final num? min;

  /// Para `type: 'number'` — máximo inclusivo.
  final num? max;

  /// Si `false`, el publisher DEBE proveer un valor. Default: true.
  final bool optional;

  const VisualEffectConfigParam({
    required this.key,
    required this.type,
    this.options,
    this.defaultValue,
    this.min,
    this.max,
    this.optional = true,
  });

  factory VisualEffectConfigParam.fromJson(Map<String, dynamic> json) =>
      VisualEffectConfigParam(
        key: json['key'] as String,
        type: json['type'] as String,
        options: (json['options'] as List?)?.map((e) => e.toString()).toList(),
        defaultValue: json['default'],
        min: json['min'] as num?,
        max: json['max'] as num?,
        optional: json['optional'] as bool? ?? true,
      );
}

/// Definición de un efecto visual del catálogo.
class VisualEffectDefinition {
  /// ID técnico, lo que se almacena en `TagStyle.effect`. Estable.
  final String id;
  final String displayName;
  final String description;

  /// overlay | badge | filter | border.
  final String layer;

  /// Params de config ajustables. `[]` si el efecto no se configura.
  final List<VisualEffectConfigParam> config;

  const VisualEffectDefinition({
    required this.id,
    required this.displayName,
    required this.description,
    required this.layer,
    required this.config,
  });

  factory VisualEffectDefinition.fromJson(Map<String, dynamic> json) =>
      VisualEffectDefinition(
        id: json['id'] as String,
        displayName: (json['displayName'] as String?) ?? '',
        description: (json['description'] as String?) ?? '',
        layer: (json['layer'] as String?) ?? '',
        config: ((json['config'] as List?) ?? const [])
            .map((e) =>
                VisualEffectConfigParam.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(growable: false),
      );
}

/// MIRROR EMBEBIDO del array `visualEffects[]` del `.json` del KRP (KRO-30).
/// Copia verbatim de `contracts/kromia-recipe-protocol-v1.json` → NO editar a
/// mano la semántica; para alinear, regenerar/copiar desde el contrato.
const String _visualEffectsJson = r'''
[{"id":"holographic_effect","displayName":"Holográfico","description":"Capa animada arcoíris superpuesta sobre la imagen principal de la carta.","layer":"overlay","config":[{"key":"intensity","type":"enum","options":["low","medium","high"],"default":"medium"}]},{"id":"iridescent_foil","displayName":"Iridiscente","description":"Foil iridiscente ajustable: arcoíris que reluce al inclinar, con tono, brillo, grano y borde configurables en vivo.","layer":"overlay","config":[{"key":"pattern","type":"enum","options":["none","spectrum","oilslick","sunset","mint","aurora","midnight"],"default":"spectrum"},{"key":"pattern_hex","type":"string"},{"key":"angle","type":"number","default":0,"min":0,"max":360},{"key":"hue","type":"number","default":0,"min":0,"max":360},{"key":"opacity","type":"number","default":95,"min":0,"max":100},{"key":"glow","type":"number","default":35,"min":0,"max":100},{"key":"sheen","type":"number","default":40,"min":0,"max":100},{"key":"shimmer","type":"number","default":50,"min":0,"max":100},{"key":"motion","type":"enum","options":["auto","deriva","tono","total"],"default":"auto"},{"key":"noise","type":"number","default":16,"min":0,"max":100},{"key":"brightness","type":"number","default":105,"min":50,"max":150},{"key":"contrast","type":"number","default":100,"min":50,"max":150},{"key":"scale","type":"number","default":210,"min":100,"max":320},{"key":"blend","type":"enum","options":["color-dodge","overlay","screen","soft-light","hard-light"],"default":"color-dodge"},{"key":"geometry","type":"enum","options":["bandas","organico"],"default":"bandas"},{"key":"warp","type":"number","default":55,"min":0,"max":100},{"key":"mask_url","type":"string"},{"key":"mask_layout","type":"enum","options":["cover","tile"],"default":"cover"},{"key":"mask_scale","type":"number","default":25,"min":5,"max":100},{"key":"mask_sparkle","type":"enum","options":["no","pastel","vivo"],"default":"no"},{"key":"border_style","type":"enum","options":["none","classic","double","sticker","emblema","tech","feston","gotico","barroco","custom"],"default":"none"},{"key":"border_custom_url","type":"string"},{"key":"border_fill","type":"enum","options":["hueco","borde","marco"],"default":"hueco"},{"key":"border_width","type":"number","default":0,"min":0,"max":16},{"key":"border_margin","type":"number","default":6,"min":0,"max":24},{"key":"border_color","type":"enum","options":["none","gold","silver","aurora","spectrum","oilslick","sunset","mint","midnight","forest","obsidian","plum","steel"],"default":"none"},{"key":"border_color_hex","type":"string"},{"key":"border_gradient_hex","type":"string"},{"key":"border_gradient_cycle","type":"number","default":45,"min":6,"max":100},{"key":"border_texture_url","type":"string"},{"key":"border_sheen","type":"enum","options":["no","metalico","iridiscente"],"default":"no"}]},{"id":"crown_badge","displayName":"Insignia","description":"Corona (o tu imagen propia) como distintivo en una esquina, con separación ajustable.","layer":"badge","config":[{"key":"color","type":"enum","options":["gold","silver","bronze"],"default":"gold"},{"key":"position","type":"enum","options":["top-left","top-right","bottom-left","bottom-right"],"default":"top-right"},{"key":"image_url","type":"string","optional":true},{"key":"padding_x","type":"number","default":4,"min":0,"max":48},{"key":"padding_y","type":"number","default":4,"min":0,"max":48}]},{"id":"vintage_filter","displayName":"Filtro vintage","description":"Filtro sepia / desaturado que envejece la imagen de la carta.","layer":"filter","config":[{"key":"strength","type":"enum","options":["low","medium","high"],"default":"medium"}]},{"id":"glow_border","displayName":"Borde luminoso","description":"Borde luminoso pulsante alrededor de la carta.","layer":"border","config":[{"key":"color","type":"enum","options":["gold","blue","green","red","purple"],"default":"gold"}]},{"id":"frozen","displayName":"Congelado","description":"Capa de hielo + partículas superpuesta sobre la carta.","layer":"overlay","config":[]},{"id":"signed","displayName":"Firmada","description":"Firma estilizada superpuesta sobre la carta.","layer":"overlay","config":[{"key":"signature_url","type":"string","optional":true}]}]
''';

List<VisualEffectDefinition>? _catalog;
Map<String, VisualEffectDefinition>? _byId;

void _ensureLoaded() {
  if (_catalog != null) return;
  final raw = jsonDecode(_visualEffectsJson) as List;
  _catalog = raw
      .map((e) =>
          VisualEffectDefinition.fromJson(Map<String, dynamic>.from(e as Map)))
      .toList(growable: false);
  _byId = {for (final e in _catalog!) e.id: e};
}

/// Catálogo completo en orden de declaración (leído del `.json` embebido).
List<VisualEffectDefinition> allVisualEffects() {
  _ensureLoaded();
  return _catalog!;
}

/// Lookup por id → `null` si el efecto no está en el catálogo. Necesario para
/// el dispatcher effect→widget del cliente.
VisualEffectDefinition? getVisualEffect(String id) {
  _ensureLoaded();
  return _byId![id];
}

/// Lista de IDs en orden de declaración (espejo de `VISUAL_EFFECT_IDS`).
List<String> get visualEffectIds {
  _ensureLoaded();
  return _catalog!.map((e) => e.id).toList(growable: false);
}
