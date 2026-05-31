/// `composeSlotValues` — espejo 1:1 de `compose-slot.ts`.
///
/// Lógica pura para slots composables: formatea cada field con `formatScalar`,
/// filtra vacíos, y decide si aplica truncate por nº de chars. NO renderiza
/// widgets — devuelve un `ComposedSlotResult` para que el caller pinte. Paridad
/// estructural Studio↔Flutter.
library;

import 'composition.dart' show SlotAppearance;
import 'field_def.dart';
import 'format_scalar.dart';

/// Un field de entrada para componer (def opcional + value crudo).
class ComposeSlotField {
  final FieldDefLike? def;
  final dynamic value;
  const ComposeSlotField({this.def, required this.value});
}

/// Entrada de `composeSlotValues`.
class ComposeSlotInput {
  final List<ComposeSlotField> fields;
  final String orientation; // 'horizontal' | 'vertical'
  final String separator;
  final SlotAppearance? appearance;
  const ComposeSlotInput({
    this.fields = const [],
    this.orientation = 'horizontal',
    this.separator = ' · ',
    this.appearance,
  });
}

/// Resultado de `composeSlotValues`.
class ComposedSlotResult {
  final List<String> items;
  final String orientation;
  final String separator;

  /// Si != null, el caller pinta UN string plano (el truncate por chars recortó
  /// todo, perdiendo el separador estilizado).
  final String? truncated;

  const ComposedSlotResult({
    required this.items,
    required this.orientation,
    required this.separator,
    this.truncated,
  });
}

/// Slice por N chars + "…". Devuelve el original si N inválido o no excede.
String _applyTruncate(String text, int? n) {
  if (n == null || n <= 0) return text;
  if (text.length <= n) return text;
  return '${text.substring(0, n).trimRight()}…';
}

/// Items formateados de un slot composable + decisión de truncate.
ComposedSlotResult composeSlotValues(ComposeSlotInput slot) {
  final items = slot.fields
      .map((f) => formatScalar(f.value, f.def))
      .where((t) => t != '')
      .toList();

  final charLimit = slot.appearance?.truncateChars;
  String? truncated;

  if (charLimit != null && charLimit > 0 && items.isNotEmpty) {
    final joiner = slot.orientation == 'vertical' ? ' ' : slot.separator;
    final allText = items.join(joiner);
    final cut = _applyTruncate(allText, charLimit);
    if (cut != allText) truncated = cut;
  }

  return ComposedSlotResult(
    items: items,
    orientation: slot.orientation,
    separator: slot.separator,
    truncated: truncated,
  );
}
