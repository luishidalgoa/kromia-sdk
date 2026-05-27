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
