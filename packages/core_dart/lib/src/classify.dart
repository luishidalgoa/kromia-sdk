import 'slot_accept_kind.dart';

/// Field minimo para clasificar — espejo de `{ type: string; behavior?: string }`.
class FieldSpec {
  final String type;
  final String? behavior;
  const FieldSpec(this.type, {this.behavior});
}

/// Slot minimo (subset de `SlotDefinition`) — para clasificar solo importa `accepts`.
class SlotSpec {
  final List<String> accepts;
  const SlotSpec(this.accepts);
}

/// Espejo 1:1 de `classifyField` (TS `packages/core/src/classify.ts`).
///
/// Dado un field (type + behavior), devuelve que `SlotAcceptKind` lo aceptarian.
/// `'any'` siempre se incluye. Output deterministico SIN duplicados (Set interno)
/// — la paridad cross-language lo exige (los tests no toleran duplicados).
///
/// CRITICO: esta logica debe estar sincronizada con `behaviors.renderAsSlotKind`
/// del registry. Si una cambia y la otra no, hay drift contrato vs runtime.
List<String> classifyField(FieldSpec field) {
  final kinds = <String>{SlotAcceptKind.any};
  final b = field.behavior;

  // type=image → kind canonico 'image' + 3 aliases legacy (KRO-69).
  if (field.type == 'image') {
    kinds.add(SlotAcceptKind.image);
    kinds.add(SlotAcceptKind.imageAvatar);
    kinds.add(SlotAcceptKind.imageBanner);
    kinds.add(SlotAcceptKind.imageCover);
  }
  if (b == 'gallery' || b == 'slideshow' || b == 'card_multiview') {
    kinds.add(SlotAcceptKind.imageArray);
  }
  // `!b` en TS = null/undefined/'' → en Dart: null o vacio.
  if (field.type == 'array<image>' && (b == null || b.isEmpty)) {
    kinds.add(SlotAcceptKind.imageArray);
  }
  if (b == 'markdown' || b == 'notes' || b == 'html') kinds.add(SlotAcceptKind.textLong);
  if (b == 'rating' || b == 'enum' || b == 'ordinal_enum') kinds.add(SlotAcceptKind.badge);
  if (b == 'card_index_list' || b == 'card_code_list') kinds.add(SlotAcceptKind.cardRef);
  if (b == 'year' || b == 'iso_date' || b == 'year_list') kinds.add(SlotAcceptKind.date);
  if (b == 'url' || b == 'email' || b == 'phone') kinds.add(SlotAcceptKind.url);
  // color_hex tiene kind propio 'color' (NO text-short, excepcion KRO-69).
  if (b == 'color_hex') kinds.add(SlotAcceptKind.color);

  // Por type base — fallback cuando no hay behavior que clasifique.
  if (field.type == 'number') {
    kinds.add(SlotAcceptKind.number);
    kinds.add(SlotAcceptKind.textShort);
  }
  // Excepcion: color_hex es type=text pero NO entra en text-short.
  if ((field.type == 'text' || field.type == 'select') && b != 'color_hex') {
    kinds.add(SlotAcceptKind.textShort);
  }
  if (field.type == 'textarea') kinds.add(SlotAcceptKind.textLong);

  return kinds.toList();
}

/// ¿Este field puede ir en este slot? (espejo de `isFieldCompatibleWithSlot`).
bool isFieldCompatibleWithSlot(FieldSpec field, SlotSpec slot) {
  if (slot.accepts.contains(SlotAcceptKind.any)) return true;
  final fieldKinds = classifyField(field).toSet();
  return slot.accepts.any(fieldKinds.contains);
}
