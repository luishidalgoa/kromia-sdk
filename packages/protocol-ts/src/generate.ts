/**
 * KRP generator — emite `contracts/kromia-recipe-protocol-v1.json`.
 *
 * Lee los registries del propio paquete (source-of-truth) y emite un
 * fichero JSON serializado, versionado y portable que consumen los
 * clientes downstream:
 *
 *   - kromia-flutter (KRO-65)        → renderiza el catálogo desde el .json
 *                                      (mejor: importa el package Dart
 *                                      espejo, futuro `protocol-dart`).
 *   - Wiki auto-mantenible (KRO-46)  → render markdown desde el .json
 *   - Drift detector CI (KRO-64)     → diff entre versiones para abrir issues
 *
 * Output path: `../../contracts/kromia-recipe-protocol-v1.json` (relativo
 * al paquete, escribe en la raíz del monorepo).
 *
 * El generator debe ser puro: misma entrada → mismo output bit-a-bit
 * (excepto `generatedAt`, que se serializa pero los consumers ignoran
 * para el diff).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { allRecipes, type RecipeManifest } from './registries/recipes';
import type { SlotDefinition } from './registries/recipes';
import { SLOT_ACCEPT_KIND_META } from './registries/slot-kinds';
import { allBehaviors, type BehaviorDefinition } from './registries/behaviors';
import { allActions, type ActionDefinition } from './registries/actions';
import type { SlotAcceptKind } from './types';

// ── Constants ──────────────────────────────────────────────────────────────

const PROTOCOL_VERSION = '1.0.0';

const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  // src/ → packages/protocol-ts/ → packages/ → kromia-protocol/contracts/
  '..',
  '..',
  '..',
  'contracts',
  'kromia-recipe-protocol-v1.json',
);

// ── Tipos del payload generado (espejo de la estructura del JSON) ──────────

interface ProtocolJson {
  $schema:        string;
  protocolVersion: string;
  generatedAt:    string;
  generatedFrom: {
    packagePath:  string;
    note:         string;
  };
  recipes:             RecipeJson[];
  actions:             ActionDefinition[];
  behaviors:           BehaviorJson[];
  slotAcceptKinds:     SlotKindJson[];
  compatibilityMatrix: Record<string, CompatibilityEntry>;
}

interface RecipeJson {
  id:          string;
  kind:        'list' | 'detail' | 'expand';
  displayName: string;
  description: string;
  slots:       SlotJson[];
}

interface SlotJson {
  id:          string;
  label:       string;
  kind:        'single' | 'composable';
  accepts:     SlotAcceptKind[];
  optional:    boolean;
  nestable:    boolean;
  description: string | null;
}

interface BehaviorJson {
  id:              string;
  displayName:     string;
  description:     string;
  applicableTypes: string[];
  /** Hint del SlotAcceptKind primario en el que encaja. null si solo cabe por type. */
  renderAs:        SlotAcceptKind | null;
}

interface SlotKindJson {
  id:             SlotAcceptKind;
  description:    string;
  behaviorIds:    string[];
}

interface CompatibilityEntry {
  /**
   * Rol del recipe en el grafo de composiciones:
   *   - list-source:    receta de lista (source de ViewCompositions con action)
   *   - detail-target:  receta de detalle (puede ser targetRecipe de
   *                     navigate_to_detail/modal; sin actions propias)
   *   - expand-target:  receta de expand (puede ser composition.expand
   *                     de expand_inline; sin actions propias)
   */
  kindRole:              'list-source' | 'detail-target' | 'expand-target';
  /** Actions permitidas en este recipe (solo aplica si kindRole=list-source). */
  allowedActions:        string[];
  /** Recipes permitidos como targetRecipe (solo navigate_to_detail/modal). */
  allowedTargetRecipes:  string[];
  /** Recipes permitidos como composition.expand (solo expand_inline). */
  allowedExpandRecipes:  string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function serializeSlot(s: SlotDefinition): SlotJson {
  return {
    id:          s.id,
    label:       s.label,
    kind:        s.kind,
    accepts:     s.accepts,
    optional:    s.optional ?? false,
    nestable:    s.nestable ?? false,
    description: s.description ?? null,
  };
}

function serializeRecipe(r: RecipeManifest): RecipeJson {
  return {
    id:          r.id,
    kind:        r.kind,
    displayName: r.displayName,
    description: r.description,
    slots:       r.slots.map(serializeSlot),
  };
}

function serializeBehavior(b: BehaviorDefinition): BehaviorJson {
  return {
    id:              b.id,
    displayName:     b.displayName,
    description:     b.description,
    applicableTypes: [...b.applicableTypes],
    renderAs:        b.renderAsSlotKind ?? null,
  };
}

function buildSlotKinds(behaviors: BehaviorJson[]): SlotKindJson[] {
  // Iterar las keys de SLOT_ACCEPT_KIND_META = orden canónico declarado en
  // slot-kinds.ts. Garantiza paridad con el catálogo que ve la UI del Studio
  // + incluye automáticamente kinds añadidos al union.
  const allKinds = Object.keys(SLOT_ACCEPT_KIND_META) as SlotAcceptKind[];
  return allKinds.map(id => ({
    id,
    description: SLOT_ACCEPT_KIND_META[id].description,
    behaviorIds: behaviors.filter(b => b.renderAs === id).map(b => b.id),
  }));
}

function buildCompatibilityMatrix(
  recipes: RecipeJson[],
  actions: ReadonlyArray<ActionDefinition>,
): Record<string, CompatibilityEntry> {
  const detailRecipes = recipes.filter(r => r.kind === 'detail').map(r => r.id);
  const expandRecipes = recipes.filter(r => r.kind === 'expand').map(r => r.id);
  const allActionIds  = actions.map(a => a.id);

  const out: Record<string, CompatibilityEntry> = {};
  for (const r of recipes) {
    if (r.kind === 'list') {
      out[r.id] = {
        kindRole:             'list-source',
        allowedActions:       allActionIds,
        allowedTargetRecipes: detailRecipes,
        allowedExpandRecipes: expandRecipes,
      };
    } else if (r.kind === 'detail') {
      out[r.id] = {
        kindRole:             'detail-target',
        allowedActions:       ['none'],
        allowedTargetRecipes: [],
        allowedExpandRecipes: [],
      };
    } else { // expand
      out[r.id] = {
        kindRole:             'expand-target',
        allowedActions:       [],
        allowedTargetRecipes: [],
        allowedExpandRecipes: [],
      };
    }
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const recipes = allRecipes().map(serializeRecipe);
  const behaviors = allBehaviors().map(serializeBehavior);
  const actions = allActions().slice();
  const slotAcceptKinds     = buildSlotKinds(behaviors);
  const compatibilityMatrix = buildCompatibilityMatrix(recipes, actions);

  const payload: ProtocolJson = {
    $schema:         './kromia-recipe-protocol-v1.schema.json',
    protocolVersion: PROTOCOL_VERSION,
    generatedAt:     new Date().toISOString(),
    generatedFrom: {
      packagePath:  'packages/protocol-ts/',
      note:         'JSON derivado — no editar a mano. Regenerar con `pnpm gen` desde el root del monorepo.',
    },
    recipes,
    actions: [...actions],
    behaviors,
    slotAcceptKinds,
    compatibilityMatrix,
  };

  // 2 espacios de indent + newline final = formato git-friendly (diffs limpios).
  const serialized = JSON.stringify(payload, null, 2) + '\n';
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized, 'utf8');

  console.log(`✓ Generado ${OUTPUT_PATH}`);
  console.log(`  protocolVersion: ${PROTOCOL_VERSION}`);
  console.log(`  recipes:         ${recipes.length} (list=${recipes.filter(r => r.kind === 'list').length}, detail=${recipes.filter(r => r.kind === 'detail').length}, expand=${recipes.filter(r => r.kind === 'expand').length})`);
  console.log(`  actions:         ${actions.length}`);
  console.log(`  behaviors:       ${behaviors.length}`);
  console.log(`  slotAcceptKinds: ${slotAcceptKinds.length}`);
}

main();
