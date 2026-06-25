/// `extract_accent.dart` — espejo Dart de `extract-accent.ts` (@kromia/core).
///
/// Resuelve color + posición del accent visual de una receta. El color sale de
/// un field con `behavior=color_hex` de la sección; la posición se resuelve con
/// la cascada `composition.accentPosition` > `slot.appearance.accentPosition` >
/// `recipeDefault`. Puro, sin side effects. Paridad 1:1 vigilada por el corpus
/// (`test/extract_accent_test.dart` espeja `tests/extract-accent.test.ts`).
library;

import 'composition.dart';
import 'field_def.dart';

/// Resultado de [extractAccentSettings] — color hex resuelto + posición.
/// Espejo de `AccentSettings` (types.ts).
class AccentSettings {
  final String color;

  /// 'top' | 'right' | 'bottom' | 'left' | 'none'.
  final String position;

  /// KRO-219 — ESTILO de la franja: 'bar'|'rounded'|'glow'|'gradient'|'ambient'.
  /// default 'bar'. Copiado de `composition.accentStyle` (NO altera color/posición).
  final String style;

  const AccentSettings({required this.color, required this.position, this.style = 'bar'});

  @override
  bool operator ==(Object other) =>
      other is AccentSettings &&
      other.color == color &&
      other.position == position &&
      other.style == style;

  @override
  int get hashCode => Object.hash(color, position, style);

  @override
  String toString() => 'AccentSettings(color: $color, position: $position, style: $style)';
}

/// Mismo patrón que `extract-accent.ts`: `#RRGGBB` o `#RRGGBBAA`, con o sin `#`.
final RegExp _hexRe =
    RegExp(r'^#?[0-9a-f]{6}([0-9a-f]{2})?$', caseSensitive: false);

/// Extrae color hex + posición del accent para una `composition` + `item`.
///
/// Devuelve `null` si no hay color hex válido en `item` (el caller renderiza
/// sin accent). [recipeDefault] es `'top'` o `'left'` según la receta.
AccentSettings? extractAccentSettings(
  ViewComposition? composition,
  Map<String, dynamic> item,
  List<FieldDefLike> fieldDefs,
  String recipeDefault,
) {
  // 1. Buscar color hex válido en cualquier field color_hex de la sección.
  String? color;
  String? colorFieldKey;
  for (final def in fieldDefs) {
    if (def.behavior != 'color_hex') continue;
    final value = item[def.key];
    if (value is! String) continue;
    final raw = value.trim();
    if (!_hexRe.hasMatch(raw)) continue;
    color = raw.startsWith('#') ? raw : '#$raw';
    colorFieldKey = def.key;
    break;
  }
  if (color == null || colorFieldKey == null) return null;

  // 2. Resolver posición — composition > slot override > recipeDefault.
  var resolved = composition?.accentPosition ?? 'auto';
  if (resolved == 'auto' && composition != null) {
    for (final slot in composition.slots.values) {
      if (!slot.fields.contains(colorFieldKey)) continue;
      final p = slot.appearance?.accentPosition;
      if (p != null) {
        resolved = p;
        break;
      }
    }
  }
  final position = resolved == 'auto' ? recipeDefault : resolved;
  // KRO-219 — el estilo se copia tal cual (default 'bar'); no afecta color/posición.
  return AccentSettings(color: color, position: position, style: composition?.accentStyle ?? 'bar');
}
