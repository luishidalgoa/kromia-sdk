/// Espejo Dart del SDK `@kromia/core` (TypeScript).
///
/// API publica del paquete. El cliente Flutter importa
/// `package:kromia_core/kromia_core.dart` y obtiene el mismo modelo que
/// Studio consume en TS — sin reimplementar reglas a mano.
///
/// Cobertura actual:
///  - `classifyField` / `isFieldCompatibleWithSlot` (espejo de classify.ts)
///  - `SlotAcceptKind` (los 14 kinds de types.ts)
///  - `isCompatible` / `compareSemver` / `protocolVersion` (runtime compat)
///  - Registries catálogo: `field-types`, `actions`, `slot-kinds` (label/meta +
///    `formatSlotAccepts` / `getAvailableAppearanceProps`).
///
/// Pendiente (chunks siguientes): registries `behaviors` y `recipes`, `validate`,
/// `format` — segun los necesite el render de la app.
library kromia_core;

export 'src/slot_accept_kind.dart';
export 'src/classify.dart';
export 'src/version_compat.dart';
export 'src/field_types.dart';
export 'src/actions.dart';
export 'src/behaviors.dart';
export 'src/recipes.dart';
export 'src/slot_kinds.dart';
export 'src/composition.dart';
export 'src/slot_overrides.dart';
