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
export 'src/field_def.dart';
export 'src/format_scalar.dart';
export 'src/compose_slot.dart';
export 'src/auto_detail.dart';
export 'src/synth.dart';
export 'src/extract_accent.dart';
export 'src/schema_version.dart';
export 'src/target_chain.dart';
export 'src/interaction.dart';
export 'src/validate.dart';
export 'src/visual_effects.dart';
export 'src/tag_styles.dart';
export 'src/card_layers.dart';
export 'src/rarity.dart';
export 'src/media_path.dart';
export 'src/layout_node.dart';
export 'src/components.dart';
export 'src/layout.dart';
export 'src/recipe_presets.dart';
export 'src/card_format.dart';
export 'src/image_calibration.dart';
export 'src/section_icons.dart';
export 'src/markdown.dart';
export 'src/layout_conformance.dart';
export 'src/appearance_contract.dart';
export 'src/conditional_style.dart';
export 'src/card_back.dart';
export 'src/card_ownership.dart';
export 'src/card_shapes.dart';
export 'src/card_qr.dart';
