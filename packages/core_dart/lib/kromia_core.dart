/// Espejo Dart del SDK `@kromia/core` (TypeScript).
///
/// API publica del paquete. El cliente Flutter importa
/// `package:kromia_core/kromia_core.dart` y obtiene el mismo modelo que
/// Studio consume en TS — sin reimplementar reglas a mano.
///
/// Cobertura actual (KRO-65 parte A+B — espina de clasificacion + compat):
///  - `classifyField` / `isFieldCompatibleWithSlot` (espejo de classify.ts)
///  - `SlotAcceptKind` (los 14 kinds de types.ts)
///  - `isCompatible` / `compareSemver` / `protocolVersion` (runtime compat)
///
/// Pendiente (chunks siguientes): registries completos (behaviors, actions,
/// recipes, slot-kinds, field-types), validate, format — segun los necesite
/// el render de la app.
library kromia_core;

export 'src/slot_accept_kind.dart';
export 'src/classify.dart';
export 'src/version_compat.dart';
