/// Forma mínima de un field que los helpers del SDK (format / compose /
/// auto-detail / synth) necesitan. Espejo de `FieldDefLike` (types.ts).
/// Compatible estructuralmente con el modelo extendido de Studio.
class FieldDefLike {
  final String key;
  final String? label;
  final String type;
  final String? behavior;
  final List<String>? options;

  /// Config opcional del behavior (p.ej. `incremental` → {pad, prefix, suffix};
  /// `rating` → {max}; `measurement` → {unit}). Solo presentación/validación.
  final Map<String, dynamic>? behaviorConfig;

  const FieldDefLike({
    required this.key,
    this.label,
    required this.type,
    this.behavior,
    this.options,
    this.behaviorConfig,
  });
}
