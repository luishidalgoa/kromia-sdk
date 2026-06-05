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
  // Recipes
  'RECIPE_REGISTRY',
  'getRecipeManifest',
  'allRecipes',
  'allRecipesByKind',
  // Slot kinds
  'SLOT_ACCEPT_KIND_META',
  'getSlotAcceptKindOptions',
  'formatSlotAccepts',
  'getAvailableAppearanceProps',
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
  'OPTIONS_APPEARANCE_ASPECT',
  'OPTIONS_APPEARANCE_ALIGN',
  'OPTIONS_APPEARANCE_WEIGHT',
  'OPTIONS_APPEARANCE_SIZE',
  'OPTIONS_APPEARANCE_TRUNCATE',
  'OPTIONS_APPEARANCE_PADDING_Y',
  'OPTIONS_APPEARANCE_ACCENT_POSITION',
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
  'slugify',
  'slugifyAlbumName',
  'albumMediaNamespace',
  'albumMediaPrefix',
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
    ];
    expect(_checks.length).toBe(45);
  });
});
