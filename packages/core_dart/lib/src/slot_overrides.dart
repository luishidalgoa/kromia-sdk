/// Resolución de slots efectivos — espejo de `getEffectiveSlots`,
/// `validateSlotOverrides` y `customSlotToSlotDefinition` (TS `classify.ts`).
///
/// `getEffectiveSlots` combina el manifest base de una receta con los overrides
/// per-instance de una composition (disabled + custom + order) para dar la
/// lista FINAL de slots que el renderer debe pintar. Función pura, sin mutar el
/// manifest.
library;

import 'composition.dart';
import 'recipes.dart';

/// Trata una CustomSlotDefinition como SlotDefinition (nestable=false).
SlotDefinition customSlotToSlotDefinition(CustomSlotDefinition c) =>
    SlotDefinition(
      id: c.id,
      label: c.label,
      kind: c.kind,
      accepts: c.accepts,
      optional: c.optional,
      description: c.description,
    );

/// Lista FINAL de slots a renderizar = manifest base − disabled + custom,
/// reordenada por `order`. Backward-compat: overrides null/empty → slots base
/// en orden natural. No muta el manifest.
List<SlotDefinition> getEffectiveSlots(
  RecipeManifest? manifest,
  SlotOverrides? overrides,
) {
  if (manifest == null) return <SlotDefinition>[];
  final baseSlots = manifest.slots;
  final disabled = <String>{...?overrides?.disabled};
  final customSlots = overrides?.custom ?? const <CustomSlotDefinition>[];

  final enabled = <SlotDefinition>[
    ...baseSlots.where((s) => !disabled.contains(s.id)),
    ...customSlots.map(customSlotToSlotDefinition),
  ];

  final orderHint = overrides?.order;
  if (orderHint == null || orderHint.isEmpty) return enabled;

  final byId = <String, SlotDefinition>{for (final s in enabled) s.id: s};
  final ordered = <SlotDefinition>[];
  final used = <String>{};
  for (final id in orderHint) {
    final slot = byId[id];
    if (slot != null && !used.contains(id)) {
      ordered.add(slot);
      used.add(id);
    }
  }
  for (final slot in enabled) {
    if (!used.contains(slot.id)) ordered.add(slot);
  }
  return ordered;
}

final RegExp _customIdRe = RegExp(r'^[a-z][a-zA-Z0-9_]*$');

/// Valida un SlotOverrides contra un manifest. Devuelve la primera incoherencia
/// (string) o `null` si está OK. Mensajes idénticos al TS (el corpus los cruza).
String? validateSlotOverrides(
  RecipeManifest? manifest,
  SlotOverrides? overrides,
) {
  if (overrides == null) return null;
  if (manifest == null) return null;
  final baseIds = <String>{for (final s in manifest.slots) s.id};
  final seenCustomIds = <String>{};

  for (final c in overrides.custom ?? const <CustomSlotDefinition>[]) {
    if (c.id.trim().isEmpty) {
      return 'Custom slot sin id';
    }
    if (!_customIdRe.hasMatch(c.id)) {
      return 'Custom slot id inválido: "${c.id}" (debe ser lowercase + alfanumérico)';
    }
    if (baseIds.contains(c.id)) {
      return 'Custom slot "${c.id}" colisiona con un slot base del manifest';
    }
    if (seenCustomIds.contains(c.id)) {
      return 'Custom slot "${c.id}" duplicado';
    }
    seenCustomIds.add(c.id);
    if (c.label.trim().isEmpty) {
      return 'Custom slot "${c.id}" sin label';
    }
    if (c.kind != 'single' && c.kind != 'composable') {
      return 'Custom slot "${c.id}" tiene kind inválido: ${c.kind}';
    }
    if (c.accepts.isEmpty) {
      return 'Custom slot "${c.id}" sin accepts declarados';
    }
  }

  for (final id in overrides.disabled ?? const <String>[]) {
    if (!baseIds.contains(id)) {
      return 'Slot deshabilitado "$id" no existe en el manifest base';
    }
  }

  return null;
}
