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
  EffectTemplate,
  EffectLayer,
  EffectLayerKind,
  EffectBlendMode,
  EffectMaskLayout,
  CardEffect3D,
  LayerDepth,
  CardDepthLayer,
  ImageTransform,
  CalibrationState,
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
  LayoutComponentNode,
  LayoutNode,
  GridPlacement,
  ContainerSurface,
  SurfaceBorder,
  SurfaceColor,
} from './types';
// KRO-198 — altura mínima de bloque (valor, no tipo).
export { LAYOUT_MIN_HEIGHTS } from './types';

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

// KRO-198 — etiqueta normalizada de un field (behavior→displayName, fallback type).
export { labelForField } from './field-label';

// ── Recipes ────────────────────────────────────────────────────────────
export {
  RECIPE_REGISTRY,
  getRecipeManifest,
  allRecipes,
  allRecipesByKind,
  type RecipeManifest,
  type SlotDefinition,
} from './registries/recipes';

// ── Componentes prefabricados (KRO-133 Capa 2) ─────────────────────────
export {
  COMPONENT_REGISTRY,
  COMPONENT_CATEGORIES,
  allComponents,
  getComponentDef,
  componentsByCategory,
  getComponentConfigSchema,
  COMPONENT_IDS,
  type ComponentDefinition,
  type ComponentRole,
  type ComponentCategory,
  type ComponentConfigField,
} from './registries/components';

// ── Slot kinds (meta + appearance props) ───────────────────────────────
export {
  SLOT_ACCEPT_KIND_META,
  getSlotAcceptKindOptions,
  formatSlotAccepts,
  getAvailableAppearanceProps,
  ALL_APPEARANCE_PROPS,
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
  isEffectTemplateValid,    // KRO-202 — plantillas de efecto
  validateEffectTemplates,  // KRO-202
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

// ── Normalización de catálogo (KRO-171) ────────────────────────────────
export { normalizeComposition, RECIPE_ALIASES, COMPONENT_ALIASES } from './normalize';

// ── Iconos de sección (KRO-189) ─────────────────────────────────────────
// Catálogo curado + heurística de sugerencia por nombre. Los ids son
// agnósticos de plataforma; `lucideIconName(def)` da el nombre lucide canónico
// (fuente única) que Studio (lucide-react) y Flutter (fuente lucide) renderizan.
export { SECTION_ICONS, suggestSectionIcon, lucideIconName, sectionIconSvg, resolveSectionIconId, type SectionIconDef } from './section-icons';

// Markdown inline (behavior 'markdown'): tokenizador PURO compartido — Studio y
// Flutter renderizan los mismos tokens con su piel (JSX / TextSpan).
export { parseInlineMarkdown, type MarkdownToken } from './markdown';
// HTML inline (behavior 'html'): allowlist seguro → MISMOS tokens que markdown
// (sin DOMPurify ni innerHTML; href sanitizado, entidades decodificadas). KRO-198.
export { parseInlineHtml } from './html-inline';

// ── Synth (AppPreview / playgrounds) ───────────────────────────────────
// KRO-72: migrado desde kromia-studio. Permite a cualquier consumer
// (Studio, drift detector, futuro Flutter) generar items sintéticos
// deterministas para preview de recipes ANTES de tener datos reales.
export {
  synthSectionItems,
  synthFieldValue,
  MOCKUP_IMAGE,
  isMockupImage,
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
  OPTIONS_APPEARANCE_TEXT_TRANSFORM,
  OPTIONS_APPEARANCE_FONT,
  OPTIONS_APPEARANCE_DISPLAY,
  OPTIONS_COMPOSABLE_DISPLAY,
  LAYOUT_GAP_LABELS,
  LAYOUT_ALIGN_LABELS,
  LAYOUT_TRACK_LABELS,
  LAYOUT_SURFACE_LABELS,
  OPTIONS_APPEARANCE_SIZE,
  OPTIONS_APPEARANCE_TRUNCATE,
  OPTIONS_APPEARANCE_PADDING_Y,
  OPTIONS_APPEARANCE_REF_COLUMNS,
  OPTIONS_APPEARANCE_REF_TAP,
  OPTIONS_APPEARANCE_ACCENT_POSITION,
  // KRO-147 F3 — tipografía rica + caja/efectos
  OPTIONS_APPEARANCE_LINE_HEIGHT,
  OPTIONS_APPEARANCE_TRACKING,
  // KRO-155 — sombra del texto
  OPTIONS_APPEARANCE_TEXTSHADOW,
  OPTIONS_APPEARANCE_OBJECT_FIT,
  OPTIONS_APPEARANCE_OPACITY,
  OPTIONS_APPEARANCE_SHADOW,
  // Appearance — labels + descriptions por prop
  OPTIONS_APPEARANCE_LABELS,
  OPTIONS_APPEARANCE_DESCRIPTIONS,
  // Appearance — presets compuestos (one-click)
  APPEARANCE_PRESETS,
  detectActivePreset,
  // Card format
  CARD_ASPECTS,
  CARD_SIZES,
  CARD_CORNER_RADII,                  // KRO-225
  DEFAULT_CARD_FORMAT,
  OPTIONS_CARD_ASPECT_LABELS,
  OPTIONS_CARD_SIZE_LABELS,
  OPTIONS_CARD_CORNER_RADIUS_LABELS,  // KRO-225
  CARD_CORNER_RADIUS_PX,              // KRO-225
  cardCornerRadiusPx,                 // KRO-225
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
  type CardCornerRadius,  // KRO-225
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

// KRO-33 — calibración fina de imágenes por carta (write-back Flutter→Studio).
// Metadata de carta (offset/scale/rotation por imagen + estado), vive en el dato
// → sin bump. Render compartido: Studio (CSS `imageTransformStyle`) y Flutter.
export {
  IMAGE_TRANSFORMS_KEY,
  CALIBRATION_STATE_KEY,
  CALIBRATION_STATES,
  IDENTITY_IMAGE_TRANSFORM,
  isValidImageTransform,
  normalizeImageTransform,
  getCardImageTransforms,
  getCardImageTransform,
  getCardCalibrationState,
  setCardImageTransform,
  markCardAutoCalibrated,
  setCardCalibrationState,
} from './image-calibration';

// ── Árbol de LAYOUT (constructor visual de recetas, KRO-133) ─────────────────
// La composición pasa de `slots` plano a un ÁRBOL editable (contenedores
// flex/grid/stack + hojas slot). Fase 1: catálogos + validador + auto-migración
// (slots-plano→árbol, no destructiva). Lo comparten Studio (canvas DnD), backend
// (validación) y el futuro motor de render (React + Flutter). Spec en
// tests/layout.test.ts. El tipo `layout?` vive en ViewComposition (additive, sin bump).
export {
  validateLayout,
  pruneLayoutSlots,
  gridCols,
  gridRows,
  cellCovered,
  migrateSlotsToLayout,
  migrateSlotsToGrid,
  computeHiddenHeroRoles,  // KRO-198 — ocultado de roles de cabecera (hero_header)
  layoutDepth,
  collectLayoutSlots,
  clampPlaceToGrid,
  LAYOUT_CONTAINER_KINDS,
  LAYOUT_DIRECTIONS,
  LAYOUT_ALIGNS,
  LAYOUT_JUSTIFY,
  LAYOUT_GAPS,
  MAX_LAYOUT_DEPTH,
  MAX_GRID_COLUMNS,
  MAX_GRID_ROWS,
  SURFACE_BACKGROUNDS,
  SURFACE_BORDER_WIDTHS,
  SURFACE_BORDER_SIDES,
  SURFACE_BORDER_COLORS,
  SURFACE_BORDER_STYLES,
  SURFACE_RADII,
  SURFACE_RADIUS_CORNERS,
  SURFACE_SHADOWS,
  SURFACE_PADDINGS,
  ALL_SURFACE_PROPS,
  ALL_TRACK_PROPS,
  TRACK_SIZES,
  trackToCss,
  gridColumnsTemplate,
  gridRowsTemplate,
  type LayoutIssue,
  type LayoutValidationResult,
  type ValidateLayoutOptions,
} from './layout';

// KRO-133 F3 — paleta de color cerrada (tema + rejilla ~50) + resolutor de
// clases. Catálogo compartido (contrato cross-language); las clases web las
// fuerza `@source inline` en Studio.
export {
  PALETTE,
  PALETTE_THEME_IDS,
  PALETTE_NEUTRALS,
  PALETTE_HUES,
  PALETTE_SHADES,
  paletteClass,
  colorFieldKey,
  resolveFieldColor,
  FIELD_COLOR_PREFIX,
  // KRO-198 — contraste WCAG sobre la paleta (a11y del editor + validación).
  PALETTE_HEX,
  paletteHex,
  // KRO-198 — fondo de pantalla derivado del papel (cartas resaltan por elevación).
  screenBgHex,
  paletteContrastRatio,
  contrastLevel,
  CONTRAST_AA,
  CONTRAST_AA_LARGE,
  type ContrastLevel,
  type PaletteSwatch,
  type PaletteGroup,
  type PaletteRole,
} from './palette';

// KRO-133 F5 — recetas → presets de layout (grid). "Activar diseño por bloques"
// parte del diseño REAL de la receta, no de una columna naíf.
export { recipeToComposition } from './recipe-presets';

// KRO-133 — ratchet de conformidad del motor de layout (corpus golden +
// cobertura del catálogo). Flutter renderiza el fixture como golden; el test
// falla si el catálogo crece sin cobertura → anti-drift al escalar slots.
export {
  LAYOUT_CONFORMANCE_FIXTURE,
  conformanceContainerKinds, conformanceComponents, conformanceAppearanceProps,
  conformanceSurfaceProps, conformanceTrackProps,
  CONFORMANCE_CATALOG,
} from './layout-conformance';

// KRO-178 — galería de variantes de plantilla de layout. FUERA del contrato
// KRP (mismo criterio que SECTION_ICONS): se consumen en EDICIÓN para sembrar
// composition.layout, que es lo que se persiste y lo que el cliente renderiza.
export { layoutTemplatesFor, applyLayoutTemplate } from './layout-templates';
export type { LayoutTemplate } from './layout-templates';

// KRO-198 — acabados de marca (recolor coordinado y legible de un click).
export { THEME_PRESETS, getThemePreset, applyThemePreset } from './themes';
export type { ThemePreset } from './themes';

// KRO-198 — estilo condicional por valor (color/estilo por rareza, stock, etc.).
export { matchConditionalCase, resolveConditionalAppearance, matchedConditionalCase, resolveConditionalStyling } from './conditional-style';
export type { ConditionalStyle, ConditionalStyleCase } from './types';

// KRO-227 — reverso de la carta (imagen + colocación del QR + condicional por valor/sección).
export { resolveCardBack, CARD_BACK_SECTION_KEY } from './card-back';
export type { QrPlacement, CardBackDesign, ConditionalCardBackCase, ConditionalCardBack, CardBackComposition } from './types';

// KRO-230 — siluetas de carta (forma del recorte; DATA del cardFormat, no bumpea el KRP).
export {
  CARD_SHAPES, CARD_SHAPE_IDS, DEFAULT_CARD_SHAPE, CUSTOM_CARD_SHAPE, MAX_SHAPE_PATH_LENGTH,
  DEFAULT_SHAPE_SCALE, MIN_SHAPE_SCALE,
  cardShapeById, cardShapePath, validateShapePath, clampShapeScale, scaleShapePath,
} from './card-shapes';
export type { CardShapeDefinition, CardShapeId } from './card-shapes';

// KRO-202 / KRO-224 — marcos ornamentales de carta (SVG paramétrico blanco-sobre-transparente
// para usar como máscara/relleno teñido). Render-only, TS puro, fuente única cross-platform;
// NO va al KRP (no bumpea). `borderMaskUrl` (envoltorio CSS `url(data:)`) se queda en el host.
export { borderSVG } from './border-svg';
export type { BorderStyle, BorderFill } from './border-svg';

// KRO-30 / KRO-224 — resolución PURA de efectos por tags + receta DATA del foil iridiscente
// (los 6 patterns como datos estructurados: cada host construye su gradiente nativo).
// Render-only cross-platform (Flutter espeja en core_dart); NO va al KRP (no bumpea).
export { resolveCardEffects, cardTagValues } from './effect-resolve';
export type { ResolvedEffect } from './effect-resolve';
// KRO-222/223 — título visible de carta (cardTitleKey→texto→PK→'Carta'). Fuente única
// cross-platform (antes solo en Studio card-view-data.ts). Render-only, no toca el KRP.
export { resolveCardTitle } from './card-title';
export { FOIL_PATTERNS, FOIL_PATTERN_IDS, foilPatternCss, holographicOpacity } from './foil-recipe';
export { parseFoilPatternHex, foilCustomPatternCss } from './foil-recipe';
export { foilPatternBaseAngle, foilEffectiveAngle, FOIL_ORGANIC_WARP, foilWarpDisplacement } from './foil-recipe';
// KRO-247 — paleta "Ninguna" (pattern:'none'): lámina neutra sin gradiente de color.
export { FOIL_PATTERN_NONE, FOIL_NEUTRAL_SHEEN, foilNeutralSheenCss } from './foil-recipe';
export { FOIL_BORDER_SOLID, FOIL_CARD_BG, foilCardBgCss } from './foil-recipe';
// KRO-249 — fill libre del marco (textura | sólido | degradado custom | paleta | fondo-carta).
export { resolveFoilBorderFill } from './foil-recipe';
export type { FoilBorderFill } from './foil-recipe';
// KRO-256 — vida del iridiscente: movimiento autónomo + destellos de máscara + brillo del marco
export { FOIL_MOTIONS, FOIL_MOTION_TIMING, foilMotionFlags, foilMotionSweepSec, foilMotionHueSec } from './foil-recipe';
export { FOIL_MASK_SPARKLES, FOIL_MASK_SPARKLE, FOIL_BORDER_SHEENS, FOIL_BORDER_SHEEN, foilBorderSheenCss, FOIL_BORDER_EDGE } from './foil-recipe';
// KRO-264 — degradado multibanda del marco (pesos + ciclo)
export { FOIL_GRADIENT_SPEC, parseFoilGradientSpec, isMultibandGradient, foilGradientPositions, foilWeightedGradientCss, FOIL_MULTIBAND_PAN, foilMultibandCycle, foilPatternCycle, FOIL_CUSTOM_CYCLE_PCT } from './foil-recipe';
// KRO-257 — salvaguardas anti-"lavado": sustrato midtone del arte vacío + periodo de banda acotado
export { FOIL_ART_VOID_SUBSTRATE, FOIL_BAND_PERIOD_SAFE, foilBandPeriodFrac } from './foil-recipe';
export type { FoilGradientStop } from './foil-recipe';
export type { FoilMotion } from './foil-recipe';
export { EFFECT_FACTORY_PRESETS } from './foil-recipe';
export type { FoilPattern, FoilStop, EffectFactoryPreset } from './foil-recipe';

// KRO-122 — receta DATA del render del FOIL PERSONALIZADO (custom_foil): pila de
// capas (textura + máscara + fusión + intensidad). Reglas de compositing como
// fuente única cross-platform (antes hardcodeadas en Studio FoilLayer.tsx = drift).
// Render-only; NO va al KRP. Spec: docs/custom-foil-render-spec.md
export {
  EFFECT_LAYER_KINDS, EFFECT_BLEND_MODES, isEffectBlendMode, isEffectLayerKind,
  CUSTOM_FOIL_LAYER_DEFAULTS, foilLayerOpacity, foilTextureLayout,
  CUSTOM_FOIL_MASK, CUSTOM_FOIL_TILT, CUSTOM_FOIL_SHIMMER,
  EFFECT_BLEND_TO_FLUTTER, CUSTOM_FOIL_LAYER_ORDER,
  // KRO-248 — layouts de máscara (cover | tile) compartidos iridiscente↔custom_foil.
  FOIL_MASK_LAYOUTS, FOIL_MASK_TILE, foilMaskLayout,
  // KRO-250 — capa PROCEDURAL iridiscente en la pila unificada.
  IRIDESCENT_LAYER_KIND, isIridescentLayer,
} from './custom-foil-recipe';
export type { FoilTextureLayout, FoilMaskLayoutSpec } from './custom-foil-recipe';

// KRO-215 — cartas físicas: identidad + propiedad (tronco SDK-first; DATA, no bumpea el KRP).
export { ownershipBadge, isVerifiedOwnership } from './card-ownership';
export type { CardIdentity, CardOwnership, OwnershipSource, TransferToken, CardQrPayload, CardTransferBundle } from './types';

// KRO-233 — proveedores de impresión curados (recomendar + adaptar el export). DATA.
export { matchProviderToTirada } from './print-provider';
export type {
  PrintProviderProfile, PrintProviderStatus, PrintProviderCapabilities,
  PrintProviderFileSpec, PrintDeliverable, TiradaPrintNeeds, ProviderMatch,
} from './print-provider';

// KRO-129 — favoritos del coleccionista (registro transversal + escaparate). DATA.
export { favoriteKey } from './favorite';
export type { Favorite, FavoriteCardRef } from './favorite';

// KRO-265 / Epic KRO-209 — comunidad del publisher: canales + posts. DATA social (no bumpea KRP).
export { COMMUNITY_MEDIA_PREFIX, RESERVED_MEDIA_NAMESPACES, isCommunityMediaKey, channelIdFromCommunityKey, communityMediaKey } from './media-keys';
export { mapLinkFor, validateAttachmentUpload, MAGIC_BYTES, MAGIC_BYTES_NEEDED, matchesMagicBytes } from './community';
// ── Perfil público del publisher — KRO-285 ──────────────────────────────
export {
  PROFILE_BAND_COLORS,
  BAND_COLOR_VALUES,
  DEFAULT_BAND_COLOR,
  PROFILE_LIMITS,
  PROFILE_KINDS,
  type ProfileKind,
  type AlbumCreatorRef,
  isBandColor,
  validatePublisherProfile,
  profileIsBare,
  type ProfileBandColor,
  type PublisherProfile,
  type PublisherProfileEditable,
  type PublisherProfileComputed,
  type ProfileValidationResult,
} from './publisher-profile';

export { POST_REACTION_EMOJIS, CHANNEL_KINDS, CHANNEL_VISIBILITIES, COMMUNITY_LIMITS, isValidReactionEmoji, reactionCount, hasReacted, channelSlugify, isDeleted, isEdited, reactionsAllowed, notifiesFollowers, canSeeCommunity, canPinAnother, validateChannel, validatePost, isReply, replyBlock, validateReply, type ReplyBlock, ATTACHMENT_KINDS, isKnownAttachment, knownAttachments, hasUnknownAttachments, linkDomain } from './community';
export type { UploadRejection, PostLocationAttachment } from './community';

// KRO-277 (Epic KRO-276) — quedadas: eventos de comunidad con inscripción.
export { MEETUP_STATUSES, RSVP_STATUSES, CHECKIN_METHODS, MEETUP_LIMITS, meetupIsOpen, checkinWindow, checkinIsOpen, distanceMeters, withinCheckinRadius, spotsLeft, isFull, validateMeetup, isValidRsvpStatus } from './meetup';
export { validateMeetupUpdate } from './meetup';
export type { Meetup, MeetupPlace, MeetupRsvp, MeetupCheckin, MeetupUpdate, MeetupStatus, RsvpStatus, CheckinMethod } from './meetup';
export type { Channel, ChannelKind, ChannelVisibility, PostAttachment, PostAttachmentKind, PostImageAttachment, PostFileAttachment, PostAlbumRefAttachment, PostLinkAttachment, PostReaction, Post, PostReactionEmoji, CommunityIssue, CommunityValidationResult } from './community';

// KRO-16 — QR firmado de carta física: contrato + verificación pública (ECDSA P-256).
export {
  CARD_QR_KIND, CARD_QR_VERSION,
  bytesToB64url, b64urlToBytes,
  cardQrSigningInput, serializeCardQrPayload, parseCardQrPayload,
  validateCardQrPayload, verifyCardQrSignature,
} from './card-qr';
export type { CardQrSignable } from './card-qr';

// KRO-216 (composición) — componer una tirada por sobres respetando la rareza.
export { composeTirada } from './card-tirada';
export type { TiradaSlot, TiradaSpec, TiradaAllocation, TiradaResult, TiradaCard, Tirada, TiradaStatus } from './card-tirada';
