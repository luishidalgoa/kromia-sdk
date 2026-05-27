/**
 * `@kromia/protocol` — API pública del SDK TypeScript.
 *
 * Cualquier consumer (Studio, drift-detector CI, herramienta interna,
 * futuras integraciones third-party) debe importar de aquí, NO de paths
 * internos del paquete.
 *
 * Reglas:
 *  - Solo se re-exporta lo que es API pública estable.
 *  - Tipos internos (helpers privados) NO se exponen.
 *  - Cualquier cambio aquí es un cambio de versión del paquete.
 */

// ── Version ────────────────────────────────────────────────────────────
// Single source-of-truth: package.json#version. El generator del SDK
// (KRO-63) auto-bumpea esta value, y este export la propaga a Studio
// (que la inyecta en ViewComposition al guardar) y a cualquier otro
// consumer.
import pkg from '../package.json';

/**
 * Version del KRP que este SDK exporta. Coincide con `protocolVersion`
 * del `.json` generado y con `package.json#version`. Studio inyecta
 * este valor al guardar `ViewComposition` (KRO-63 Fase B).
 */
export const PROTOCOL_VERSION: string = pkg.version;

// ── Types ──────────────────────────────────────────────────────────────
export type {
  RecipeId,
  ActionId,
  SlotKind,
  SlotAcceptKind,
  SlotComposition,
  SlotAppearance,
  NestedViewComposition,
  ViewComposition,
  SlotOverrides,
  CustomSlotDefinition,
} from './types';

// ── Field types ────────────────────────────────────────────────────────
export {
  allFieldTypes,
  getFieldType,
  FIELD_TYPE_IDS,
  type FieldTypeDefinition,
} from './registries/field-types';

// ── Actions ────────────────────────────────────────────────────────────
export {
  allActions,
  getAction,
  ACTION_IDS,
  type ActionDefinition,
} from './registries/actions';

// ── Behaviors ──────────────────────────────────────────────────────────
export {
  allBehaviors,
  getBehavior,
  getBehaviorsByType,
  suggestBehavior,
  type BehaviorDefinition,
} from './registries/behaviors';

// ── Recipes ────────────────────────────────────────────────────────────
export {
  RECIPE_REGISTRY,
  getRecipeManifest,
  allRecipes,
  allRecipesByKind,
  type RecipeManifest,
  type SlotDefinition,
} from './registries/recipes';

// ── Slot kinds (meta + appearance props) ───────────────────────────────
export {
  SLOT_ACCEPT_KIND_META,
  getSlotAcceptKindOptions,
  formatSlotAccepts,
  getAvailableAppearanceProps,
  type AppearanceProp,
} from './registries/slot-kinds';

// ── Classification / validation ────────────────────────────────────────
export {
  classifyField,
  isFieldCompatibleWithSlot,
  getEffectiveSlots,
  validateSlotOverrides,
  customSlotToSlotDefinition,
} from './classify';

// ── Composition validator — KRO-79 ─────────────────────────────────────
// Función pura que valida una ViewComposition contra el modelo. Devuelve
// issues con severity (error | warn). Útil para backend (pre-persist),
// Studio (badge editor), Flutter (rechazar composiciones no renderizables)
// y Drift CI (validar consistencia post-bump).
export {
  validateComposition,
  type ValidationIssue,
  type ValidationResult,
  type ValidateCompositionOptions,
} from './validate';

// ── Synth (AppPreview / playgrounds) ───────────────────────────────────
// KRO-72: migrado desde kromia-studio. Permite a cualquier consumer
// (Studio, drift detector, futuro Flutter) generar items sintéticos
// deterministas para preview de recipes ANTES de tener datos reales.
export {
  synthSectionItems,
  synthFieldValue,
  type SynthSourceField,
  type SynthSourceSection,
  type SynthItem,
} from './synth';

// ── Presentation helpers (format / auto / accent / compose) ────────────
// KRO-73 (B+): migrados desde kromia-studio. Cuatro funciones puras que
// Studio + futuro Flutter consumen para que el AppPreview se renderice
// "primo hermano" en ambas plataformas. NO contienen JSX/Widgets — solo
// la lógica que precede al render.
export type { FieldDefLike, AccentSettings } from './types';
export { formatScalar } from './format-scalar';
export { buildAutoDetailComposition } from './auto-detail';
export { extractAccentSettings } from './extract-accent';
export {
  composeSlotValues,
  type ComposeSlotInput,
  type ComposedSlotResult,
} from './compose-slot';

// ── Options catalogs (KRO-75) ───────────────────────────────────────────
// Catálogos de opciones de personalización disponibles al publisher en el
// editor. Studio renderiza los dropdowns consumiendo estos catálogos —
// no duplica las listas. Flutter (KRO-65) validará composiciones contra
// los mismos catálogos.
export {
  // Action
  OPTIONS_ACTION_LABELS,
  // Appearance — catálogos por propiedad
  OPTIONS_APPEARANCE_SHAPE,
  OPTIONS_APPEARANCE_ASPECT,
  OPTIONS_APPEARANCE_ALIGN,
  OPTIONS_APPEARANCE_WEIGHT,
  OPTIONS_APPEARANCE_SIZE,
  OPTIONS_APPEARANCE_TRUNCATE,
  OPTIONS_APPEARANCE_PADDING_Y,
  OPTIONS_APPEARANCE_ACCENT_POSITION,
  // Appearance — labels + descriptions por prop
  OPTIONS_APPEARANCE_LABELS,
  OPTIONS_APPEARANCE_DESCRIPTIONS,
  // Appearance — presets compuestos (one-click)
  APPEARANCE_PRESETS,
  detectActivePreset,
  // Card format
  CARD_ASPECTS,
  CARD_SIZES,
  DEFAULT_CARD_FORMAT,
  OPTIONS_CARD_ASPECT_LABELS,
  OPTIONS_CARD_SIZE_LABELS,
  aspectToRatio,
  // Field type descriptions helper
  getFieldTypeDescriptions,
  // Tipos
  type CatalogOption,
  type AppearancePreset,
  type CardAspect,
  type CardSize,
  type CardFormat,
} from './options';
