/**
 * API snapshot del barrel público `@kromia/core`.
 *
 * Captura el set actual de exports. Cualquier remoción, renombre o cambio
 * breaking del API surface lo caza este test.
 *
 * **Cómo actualizar el snapshot**: si añades un export INTENCIONADAMENTE,
 * actualiza la lista `EXPECTED_EXPORTS` abajo. Si lo borras intencionalmente,
 * también — pero piénsalo dos veces: cualquier eliminación rompe consumers.
 *
 * Recomendación: añadir exports nuevos = minor bump del paquete; eliminar
 * exports = major bump.
 */

import { describe, it, expect } from 'vitest';
import * as SDK from '../src/index';

// ── Exports esperados (snapshot al 2026-05-27, KRP v1.5.0) ───────────

const EXPECTED_EXPORTS = [
  // Version constant — KRO-63
  'PROTOCOL_VERSION',
  // Field types
  'allFieldTypes',
  'getFieldType',
  'FIELD_TYPE_IDS',
  // Actions
  'allActions',
  'getAction',
  'ACTION_IDS',
  // Behaviors
  'allBehaviors',
  'getBehavior',
  'getBehaviorsByType',
  'suggestBehavior',
  'labelForField',
  // Recipes
  'RECIPE_REGISTRY',
  'getRecipeManifest',
  'allRecipes',
  'allRecipesByKind',
  // Componentes prefabricados — KRO-133 Capa 2
  'COMPONENT_REGISTRY',
  'COMPONENT_CATEGORIES',
  'allComponents',
  'getComponentDef',
  'componentsByCategory',
  'getComponentConfigSchema',
  'COMPONENT_IDS',
  // Slot kinds
  'SLOT_ACCEPT_KIND_META',
  'getSlotAcceptKindOptions',
  'formatSlotAccepts',
  'getAvailableAppearanceProps',
  'ALL_APPEARANCE_PROPS',
  // Classification / validation
  'classifyField',
  'isFieldCompatibleWithSlot',
  'getEffectiveSlots',
  'validateSlotOverrides',
  'customSlotToSlotDefinition',
  // Composition validator — KRO-79
  'validateComposition',
  // Synth (AppPreview) — KRO-72
  'synthSectionItems',
  'synthFieldValue',
  'MOCKUP_IMAGE',
  'isMockupImage',
  // Presentation helpers — KRO-73 (B+)
  'formatScalar',
  'buildAutoDetailComposition',
  'buildAutoListComposition',
  'isSchemaOutdated',
  'extractAccentSettings',
  'composeSlotValues',
  // Options catalogs — KRO-75
  'OPTIONS_ACTION_LABELS',
  'OPTIONS_APPEARANCE_SHAPE',
  'OPTIONS_APPEARANCE_FONT',
  'OPTIONS_APPEARANCE_DISPLAY',
  'OPTIONS_COMPOSABLE_DISPLAY',
  'LAYOUT_GAP_LABELS',
  'LAYOUT_ALIGN_LABELS',
  'LAYOUT_TRACK_LABELS',
  'LAYOUT_SURFACE_LABELS',
  'OPTIONS_APPEARANCE_ASPECT',
  'OPTIONS_APPEARANCE_ALIGN',
  'OPTIONS_APPEARANCE_WEIGHT',
  'OPTIONS_APPEARANCE_TEXT_TRANSFORM',
  'OPTIONS_APPEARANCE_SIZE',
  'OPTIONS_APPEARANCE_TRUNCATE',
  'OPTIONS_APPEARANCE_PADDING_Y',
  'OPTIONS_APPEARANCE_REF_COLUMNS',
  'OPTIONS_APPEARANCE_REF_TAP',
  'OPTIONS_APPEARANCE_ACCENT_POSITION',
  'OPTIONS_APPEARANCE_LINE_HEIGHT',
  'OPTIONS_APPEARANCE_TRACKING',
  'OPTIONS_APPEARANCE_TEXTSHADOW',
  'OPTIONS_APPEARANCE_OBJECT_FIT',
  'OPTIONS_APPEARANCE_OPACITY',
  'OPTIONS_APPEARANCE_SHADOW',
  'OPTIONS_APPEARANCE_LABELS',
  'OPTIONS_APPEARANCE_DESCRIPTIONS',
  'APPEARANCE_PRESETS',
  'detectActivePreset',
  'CARD_ASPECTS',
  'CARD_SIZES',
  'DEFAULT_CARD_FORMAT',
  'OPTIONS_CARD_ASPECT_LABELS',
  'OPTIONS_CARD_SIZE_LABELS',
  'aspectToRatio',
  // KRO-78 — grid de mini-cards relacionadas derivado del cardFormat
  'MINI_REF_GRID_SIZE_MULTIPLIER',
  'miniRefGridColumns',
  'getFieldTypeDescriptions',
  // KRO-86 — pre-flight validation de cards + sectionsData
  'validateAlbumData',
  // KRO-84 — helpers del behavior incremental (auto-asignación + duplicados)
  'nextIncrementalValue',
  'findDuplicateIncrementalValues',
  // KRO-94 Fase B — cadena de navegación multi-salto
  'resolveTargetChain',
  'targetChainDepth',
  'MAX_TARGET_DEPTH',
  // KRO-74 — decisor de interactividad (qué pasa al tocar un item)
  'resolveTapAction',
  'resolveDetailComposition',
  'resolveTargetRecipe',
  'resolveExpandRecipe',
  'isTappable',
  'opensNewScreen',
  // KRO-30 — efectos visuales por valor de tag + validador de tag styles
  'allVisualEffects',
  'getVisualEffect',
  'VISUAL_EFFECT_IDS',
  'isTagStyleValid',
  'validateTagStyles',
  // KRO-28 — fuente de rareza (validador + helpers)
  'isFieldEligibleForRarity',
  'validateRaritySource',
  'rarityBucketForValue',
  'normalizeRarityWeights',
  // KRO-132 — almacenamiento de medios por-álbum (ruta + slug + cuota)
  'ALBUM_MEDIA_QUOTA_BYTES',
  'OWNER_MEDIA_ALBUM_ALLOWANCE',
  'OWNER_MEDIA_QUOTA_BYTES',
  'DRAFT_MEDIA_SLUG',
  'slugify',
  'slugifyAlbumName',
  'albumMediaNamespace',
  'albumMediaPrefix',
  // KRO-130 — capas de profundidad (parallax) por carta
  'DEPTH_LAYERS_KEY',
  'LAYER_DEPTH_ORDER',
  'OPTIONS_LAYER_DEPTH',
  'depthToParallaxFactor',
  'getCardDepthLayers',
  'validateCardDepthLayers',
  // KRO-33 — calibración fina de imágenes por carta (write-back Flutter→Studio)
  'IMAGE_TRANSFORMS_KEY',
  'CALIBRATION_STATE_KEY',
  'CALIBRATION_STATES',
  'IDENTITY_IMAGE_TRANSFORM',
  'isValidImageTransform',
  'normalizeImageTransform',
  'getCardImageTransforms',
  'getCardImageTransform',
  'getCardCalibrationState',
  'setCardImageTransform',
  'markCardAutoCalibrated',
  'setCardCalibrationState',
  // KRO-101 — autoridad de acceso a medios (capabilities del bucket)
  'mediaCapability',
  'isPrivatePath',
  'avatarObjectPath',
  'PRIVATE_PREFIX',
  'AVATAR_PREFIX',
  // KRO-133 — árbol de layout (constructor visual de recetas)
  'validateLayout',
  'pruneLayoutSlots',
  'normalizeComposition',
  'RECIPE_ALIASES',
  'COMPONENT_ALIASES',
  // KRO-189 — iconos de sección (catálogo + heurística + nombre lucide canónico)
  'SECTION_ICONS',
  'suggestSectionIcon',
  'lucideIconName',
  'sectionIconSvg',
  'resolveSectionIconId',
  // KRO-131 — tokenizador de markdown inline (compartido Studio↔Flutter)
  'parseInlineMarkdown',
  // KRO-198 — tokenizador de HTML inline seguro (behavior 'html', allowlist)
  'parseInlineHtml',
  // KRO-178 — galería de variantes de plantilla de layout (fuera del KRP)
  'layoutTemplatesFor',
  'applyLayoutTemplate',
  'gridCols',
  'gridRows',
  'cellCovered',
  'migrateSlotsToLayout',
  'migrateSlotsToGrid',
  'computeHiddenHeroRoles',  // KRO-198
  'layoutDepth',
  'collectLayoutSlots',
  'clampPlaceToGrid',
  'LAYOUT_CONTAINER_KINDS',
  'LAYOUT_DIRECTIONS',
  'LAYOUT_ALIGNS',
  'LAYOUT_JUSTIFY',
  'LAYOUT_GAPS',
  'MAX_LAYOUT_DEPTH',
  'MAX_GRID_COLUMNS',
  'MAX_GRID_ROWS',
  'LAYOUT_MIN_HEIGHTS',
  'SURFACE_BACKGROUNDS',
  'SURFACE_BORDER_WIDTHS',
  'SURFACE_BORDER_SIDES',
  'SURFACE_BORDER_COLORS',
  'SURFACE_BORDER_STYLES',
  'SURFACE_RADII',
  'SURFACE_RADIUS_CORNERS',
  'SURFACE_SHADOWS',
  'SURFACE_PADDINGS',
  // KRO-133 — ratchet anti-drift de decoración + track de contenedor
  'ALL_SURFACE_PROPS',
  'ALL_TRACK_PROPS',
  'TRACK_SIZES',
  'trackToCss',
  'gridColumnsTemplate',
  'gridRowsTemplate',
  // KRO-133 F3 — paleta de color
  'PALETTE',
  'PALETTE_THEME_IDS',
  'PALETTE_NEUTRALS',
  'PALETTE_HUES',
  'PALETTE_SHADES',
  'paletteClass',
  'colorFieldKey',
  'resolveFieldColor',
  'FIELD_COLOR_PREFIX',
  // KRO-198 — contraste WCAG sobre la paleta
  'PALETTE_HEX',
  'paletteHex',
  // KRO-198 — fondo de pantalla derivado del papel (cartas resaltan)
  'screenBgHex',
  'paletteContrastRatio',
  'contrastLevel',
  'CONTRAST_AA',
  'CONTRAST_AA_LARGE',
  // KRO-198 — acabados de marca
  'THEME_PRESETS',
  'getThemePreset',
  'applyThemePreset',
  // KRO-198 — estilo condicional por valor
  'matchConditionalCase',
  'resolveConditionalAppearance',
  'matchedConditionalCase',
  'resolveConditionalStyling',
  // KRO-225 — redondeado de esquinas de la carta
  'CARD_CORNER_RADII',
  'CARD_CORNER_RADIUS_PX',
  'OPTIONS_CARD_CORNER_RADIUS_LABELS',
  'cardCornerRadiusPx',
  // KRO-227 — reverso de la carta
  'resolveCardBack',
  'CARD_BACK_SECTION_KEY',
  // KRO-215 — cartas físicas (identidad + propiedad)
  'ownershipBadge',
  'isVerifiedOwnership',
  // KRO-202 — plantillas de efecto (validación)
  'validateEffectTemplates',
  'isEffectTemplateValid',
  // KRO-230 — siluetas de carta (forma del recorte del cromo)
  'CARD_SHAPES',
  'CARD_SHAPE_IDS',
  'DEFAULT_CARD_SHAPE',
  'CUSTOM_CARD_SHAPE',
  'MAX_SHAPE_PATH_LENGTH',
  'cardShapeById',
  'cardShapePath',
  'validateShapePath',
  // KRO-133 F5 — recetas → presets de layout
  'recipeToComposition',
  // KRO-133 — ratchet de conformidad del motor de layout
  'LAYOUT_CONFORMANCE_FIXTURE',
  'conformanceContainerKinds',
  'conformanceComponents',
  'conformanceAppearanceProps',
  'conformanceSurfaceProps',
  'conformanceTrackProps',
  'CONFORMANCE_CATALOG',
] as const;

describe('API snapshot — @kromia/core barrel', () => {
  const actualExports = Object.keys(SDK).sort();
  const expectedExports = [...EXPECTED_EXPORTS].sort();

  it('NO falta ningún export esperado (rompe consumers si se quita)', () => {
    const missing = expectedExports.filter(e => !actualExports.includes(e));
    expect(missing).toEqual([]);
  });

  it('NO hay exports EXTRAS sin documentar (forzar al dev a actualizar este snapshot)', () => {
    const extras = actualExports.filter(e => !expectedExports.includes(e as typeof EXPECTED_EXPORTS[number]));
    expect(extras, `Exports nuevos detectados: ${extras.join(', ')}. Añádelos a EXPECTED_EXPORTS en tests/api-snapshot.test.ts (y considera si merece bump minor del paquete).`).toEqual([]);
  });

  it('cada export esperado está definido y no es undefined', () => {
    EXPECTED_EXPORTS.forEach(name => {
      expect((SDK as Record<string, unknown>)[name], `export "${name}" es undefined`).toBeDefined();
    });
  });

  it('PROTOCOL_VERSION matchea con package.json#version (single source-of-truth)', async () => {
    const pkg = (await import('../package.json', {
      with: { type: 'json' },
    })).default as { version: string };
    expect(SDK.PROTOCOL_VERSION).toBe(pkg.version);
  });

  it('PROTOCOL_VERSION matchea con protocolVersion del .json generado', async () => {
    const krp = (await import('../../../contracts/kromia-recipe-protocol-v1.json', {
      with: { type: 'json' },
    })).default as { protocolVersion: string };
    expect(SDK.PROTOCOL_VERSION).toBe(krp.protocolVersion);
  });
});

// ── Smoke check de tipos (compile-time) ──────────────────────────────
//
// Si alguien cambia el shape de un tipo público (ej. quita `displayName`
// de BehaviorDefinition), TypeScript falla aquí. No es un test runtime
// pero el `tsc --noEmit` del CI los caza.

import type {
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
  VisualEffectDefinition,
  VisualEffectConfigParam,
  VisualEffectLayer,
  TagStyleValidationIssue,
  TagStyleValidationResult,
  RaritySource,
  RarityBucket,
  ResolvedHop,
  FieldTypeDefinition,
  ActionDefinition,
  BehaviorDefinition,
  RecipeManifest,
  SlotDefinition,
  AppearanceProp,
  SynthSourceField,
  SynthSourceSection,
  SynthItem,
  FieldDefLike,
  AccentSettings,
  ComposeSlotInput,
  ComposedSlotResult,
  CatalogOption,
  AppearancePreset,
  CardAspect,
  CardSize,
  CardFormat,
  ValidationIssue,
  ValidationResult,
  ValidateCompositionOptions,
  MarkdownToken,
} from '../src/index';

describe('Type exports compile-check', () => {
  it('todos los tipos públicos siguen accesibles', () => {
    // El simple hecho de que este test compile garantiza la accesibilidad.
    // Asignar undefined a cada uno verifica que el TYPE export existe.
    const _checks: Array<unknown> = [
      null as unknown as RecipeId,
      null as unknown as ActionId,
      null as unknown as SlotKind,
      null as unknown as SlotAcceptKind,
      null as unknown as SlotComposition,
      null as unknown as SlotAppearance,
      null as unknown as NestedViewComposition,
      null as unknown as TargetComposition,
      null as unknown as ViewComposition,
      null as unknown as SlotOverrides,
      null as unknown as CustomSlotDefinition,
      null as unknown as TagStyle,
      null as unknown as VisualEffectDefinition,
      null as unknown as VisualEffectConfigParam,
      null as unknown as VisualEffectLayer,
      null as unknown as TagStyleValidationIssue,
      null as unknown as TagStyleValidationResult,
      null as unknown as RaritySource,
      null as unknown as RarityBucket,
      null as unknown as import('../src/rarity').RarityValidationIssue,
      null as unknown as import('../src/rarity').RarityValidationResult,
      null as unknown as ResolvedHop,
      null as unknown as FieldTypeDefinition,
      null as unknown as ActionDefinition,
      null as unknown as BehaviorDefinition,
      null as unknown as RecipeManifest,
      null as unknown as SlotDefinition,
      null as unknown as AppearanceProp,
      null as unknown as SynthSourceField,
      null as unknown as SynthSourceSection,
      null as unknown as SynthItem,
      null as unknown as FieldDefLike,
      null as unknown as AccentSettings,
      null as unknown as ComposeSlotInput,
      null as unknown as ComposedSlotResult,
      null as unknown as CatalogOption,
      null as unknown as AppearancePreset,
      null as unknown as CardAspect,
      null as unknown as CardSize,
      null as unknown as CardFormat,
      null as unknown as ValidationIssue,
      null as unknown as ValidationResult,
      null as unknown as ValidateCompositionOptions,
      null as unknown as import('../src/interaction').TapResolution,
      null as unknown as import('../src/interaction').ResolveTapOptions,
      // KRO-101 — autoridad de acceso a medios
      null as unknown as import('../src/media-access').MediaAction,
      null as unknown as import('../src/media-access').MediaGrant,
      null as unknown as import('../src/media-access').MediaContext,
      null as unknown as import('../src/media-access').MediaCapabilityOpts,
      // KRO-133 — árbol de layout
      null as unknown as import('../src/types').LayoutNode,
      null as unknown as import('../src/types').LayoutContainerNode,
      null as unknown as import('../src/types').LayoutSlotNode,
      null as unknown as import('../src/types').GridPlacement,
      null as unknown as import('../src/types').ContainerSurface,
      null as unknown as import('../src/types').SurfaceBorder,
      null as unknown as import('../src/types').SurfaceColor,
      null as unknown as import('../src/palette').PaletteSwatch,
      null as unknown as import('../src/palette').PaletteGroup,
      null as unknown as import('../src/palette').PaletteRole,
      null as unknown as import('../src/layout').LayoutValidationResult,
      null as unknown as import('../src/layout').LayoutIssue,
      // KRO-33 — calibración de imágenes por carta
      null as unknown as import('../src/types').ImageTransform,
      null as unknown as import('../src/types').CalibrationState,
      // KRO-131 — token de markdown inline
      null as unknown as MarkdownToken,
    ];
    expect(_checks.length).toBe(64);
  });
});
