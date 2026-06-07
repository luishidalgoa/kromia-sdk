/**
 * `@kromia/core` — API pública del SDK TypeScript.
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
  TargetComposition,
  ViewComposition,
  SlotOverrides,
  CustomSlotDefinition,
  TagStyle,
  EffectLayer,
  EffectLayerKind,
  EffectBlendMode,
  CardEffect3D,
  LayerDepth,
  CardDepthLayer,
  RaritySource,
  RarityBucket,
  // KRO-133 — árbol de layout (constructor visual de recetas)
  LayoutContainerKind,
  LayoutDirection,
  LayoutAlign,
  LayoutJustify,
  LayoutGap,
  LayoutSlotNode,
  LayoutContainerNode,
  LayoutNode,
  GridPlacement,
  ContainerSurface,
} from './types';

// ── Field types ────────────────────────────────────────────────────────
export {
  allFieldTypes,
  getFieldType,
  FIELD_TYPE_IDS,
  type FieldTypeDefinition,
} from './registries/field-types';

// ── Encyclopedia (doc rica compartida por los registries) — KRO-70 ──────
// Mixin que cada *Definition incluye (whenToUse/long/examples/related/aliases).
// El host (Studio, Flutter) deriva su enciclopedia desde los registries.
export type { EncyclopediaDoc, EncyclopediaExample } from './registries/encyclopedia-doc';

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

// ── Visual effects (efectos por VALOR de tag) — KRO-30 ──────────────────
// Catálogo de efectos que se superponen a la carta según el valor de una tag
// (holographic_effect, crown_badge…). Categoría SEPARADA de los field-behaviors.
// El editor de tag-styles de Studio + el renderer de Flutter consumen el catálogo;
// `tag-styles.ts` valida los TagStyle contra él.
export {
  allVisualEffects,
  getVisualEffect,
  VISUAL_EFFECT_IDS,
  type VisualEffectDefinition,
  type VisualEffectConfigParam,
  type VisualEffectLayer,
} from './registries/visual-effects';

// ── Tag styles validator — KRO-30 ───────────────────────────────────────
// Valida `TagStyle[]` (mapeo valor-de-tag → efecto) contra el catálogo.
export {
  isTagStyleValid,
  validateTagStyles,
  type TagStyleValidationIssue,
  type TagStyleValidationResult,
} from './tag-styles';

// ── Rareza (fuente de rareza) — KRO-28 ───────────────────────────────────
// Field rating/enum/ordinal_enum marcado como fuente de rareza + distribución
// de pesos. Validador + helpers puros; el reparto ponderado real es del cliente.
export {
  isFieldEligibleForRarity,
  validateRaritySource,
  rarityBucketForValue,
  normalizeRarityWeights,
  type RarityValidationIssue,
  type RarityValidationResult,
} from './rarity';

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

// ── Cadena de navegación multi-salto — KRO-94 Fase B ───────────────────
// Resolver puro que normaliza una ViewComposition a su cadena ordenada de
// pantallas destino (legacy single-hop + nuevo targetComposition recursivo).
// El canvas de Studio y el renderer de Flutter (cuando lo espeje) recorren la
// cadena con esta misma función.
export {
  resolveTargetChain,
  targetChainDepth,
  MAX_TARGET_DEPTH,
  type ResolvedHop,
} from './target-chain';

// ── Album data validator — KRO-86 ─────────────────────────────────────
// Función pura que valida cards + sectionsData de un álbum antes del POST.
// Aplica type + behavior + required + enum + sectionRef. Studio lo usa en
// `handleSubmit` para mostrar modal de errores antes de mandar al backend
// (que también lo usará via Fase 5 — paridad estricta). Sin Zod, vanilla TS.
export {
  validateAlbumData,
  type AlbumDataInput,
  type ValidatableField,
  type ValidatableSection,
  type ValidationError as AlbumValidationError,
  type ValidationResult as AlbumValidationResult,
  type ValidationRule as AlbumValidationRule,
} from './validate-album-data';

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
export { buildAutoDetailComposition, buildAutoListComposition } from './auto-detail';
export { isSchemaOutdated } from './schema-version';
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
  // KRO-78 — grid de mini-cards relacionadas derivado del cardFormat
  MINI_REF_GRID_SIZE_MULTIPLIER,
  miniRefGridColumns,
  // Field type descriptions helper
  getFieldTypeDescriptions,
} from './options';

// ── Interactividad — decisor de tap (KRO-74) ────────────────────────────
// Función pura que, dado una ViewComposition + item, devuelve QUÉ hacer al tap.
// Studio la usa para sus animaciones in-frame; Flutter para Navigator/Modal/etc.
// Cierra el ciclo: Modelo → Datos → Presentación → Interactividad, todo en SDK.
export {
  resolveTapAction,
  resolveDetailComposition,
  resolveTargetRecipe,
  resolveExpandRecipe,
  isTappable,
  opensNewScreen,
  type TapResolution,
  type ResolveTapOptions,
} from './interaction';

// ── Incremental behavior helpers (KRO-84) ───────────────────────────────
// Auto-asignación (max+1) + detección de duplicados para el behavior
// `incremental`. Puros, consumidos por el editor de Studio y el futuro Flutter.
export {
  nextIncrementalValue,
  findDuplicateIncrementalValues,
} from './incremental';

// ── Almacenamiento de medios por-álbum (KRO-132) ─────────────────────────
// Ruta canónica del bucket (raíz por usuario/organización + slug fijo) + slug
// determinista + constantes de cuota. Puros, compartidos por el backend (ciclo
// de vida del bucket) y Studio (subida/listado). Spec en tests/media-path.test.ts.
export {
  ALBUM_MEDIA_QUOTA_BYTES,
  OWNER_MEDIA_ALBUM_ALLOWANCE,
  OWNER_MEDIA_QUOTA_BYTES,
  DRAFT_MEDIA_SLUG,
  slugify,
  slugifyAlbumName,
  albumMediaNamespace,
  albumMediaPrefix,
  type AlbumMediaRoot,
  type AlbumMediaPrefixInput,
} from './media-path';

// ── Autoridad de acceso a medios (KRO-101) ───────────────────────────────────
// Función PURA de capabilities del bucket: decide read/write/list/delete a partir
// de username + roles + grants (resueltos a slug). La comparten Studio
// (`/api/minio/*`, `/api/images`) y el backend (`/api/images`, ciclo de vida) →
// una sola regla, sin drift. La regla de `read` ya contempla la visibilidad del
// álbum (KRO-140) vía `albumVisibility`. Spec en tests/media-access.test.ts.
export {
  mediaCapability,
  isPrivatePath,
  avatarObjectPath,
  PRIVATE_PREFIX,
  AVATAR_PREFIX,
  type MediaAction,
  type MediaGrant,
  type MediaContext,
  type MediaCapabilityOpts,
} from './media-access';

export {
  // Tipos
  type CatalogOption,
  type AppearancePreset,
  type CardAspect,
  type CardSize,
  type CardFormat,
} from './options';

// ── Capas de profundidad (parallax) por carta — KRO-130 ─────────────────
// Cutouts a distinta profundidad (fondo/medio/frente) que hacen parallax al
// inclinar la carta. Lógica pura (factor de parallax + lectura/validación del
// dato + catálogo de profundidad) compartida por Studio (CSS) y Flutter
// (Transform + giroscopio). Opt-in por carta, vive en el dato → sin bump.
export {
  DEPTH_LAYERS_KEY,
  LAYER_DEPTH_ORDER,
  OPTIONS_LAYER_DEPTH,
  depthToParallaxFactor,
  getCardDepthLayers,
  validateCardDepthLayers,
  type DepthLayerIssue,
  type DepthLayerValidationResult,
} from './card-layers';

// ── Árbol de LAYOUT (constructor visual de recetas, KRO-133) ─────────────────
// La composición pasa de `slots` plano a un ÁRBOL editable (contenedores
// flex/grid/stack + hojas slot). Fase 1: catálogos + validador + auto-migración
// (slots-plano→árbol, no destructiva). Lo comparten Studio (canvas DnD), backend
// (validación) y el futuro motor de render (React + Flutter). Spec en
// tests/layout.test.ts. El tipo `layout?` vive en ViewComposition (additive, sin bump).
export {
  validateLayout,
  migrateSlotsToLayout,
  migrateSlotsToGrid,
  layoutDepth,
  collectLayoutSlots,
  LAYOUT_CONTAINER_KINDS,
  LAYOUT_DIRECTIONS,
  LAYOUT_ALIGNS,
  LAYOUT_JUSTIFY,
  LAYOUT_GAPS,
  MAX_LAYOUT_DEPTH,
  MAX_GRID_COLUMNS,
  MAX_GRID_ROWS,
  SURFACE_BACKGROUNDS,
  SURFACE_BORDERS,
  SURFACE_RADII,
  SURFACE_SHADOWS,
  SURFACE_PADDINGS,
  type LayoutIssue,
  type LayoutValidationResult,
  type ValidateLayoutOptions,
} from './layout';
