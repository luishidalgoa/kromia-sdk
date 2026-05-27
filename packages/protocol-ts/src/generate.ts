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
import { allFieldTypes, type FieldTypeDefinition } from './registries/field-types';
import type { SlotAcceptKind } from './types';

// ── Constants ──────────────────────────────────────────────────────────────

const PROTOCOL_VERSION = '1.1.0';

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
  fieldTypes:          FieldTypeDefinition[];
  compatibilityMatrix: Record<string, CompatibilityEntry>;
  connections:         ConnectionsSection;
}

/**
 * Grafo explícito de aristas entre las entidades del modelo. Pensado para
 * consumers que necesiten reconstruir el diagrama de nodos sin re-implementar
 * la lógica (ej. visualizador KRO-71 Fase 3, tooltips KRO-70, wiki KRO-46).
 *
 * Reglas:
 *  - `nodes` enumera todas las entidades con un id namespaced.
 *  - `edges` son aristas dirigidas. La semántica de cada `kind` se documenta
 *    abajo. NO se incluye edges derivables trivialmente (e.g. recipe→slot
 *    está en `recipes[*].slots`).
 */
interface ConnectionsSection {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  /** id namespaced: `fieldType:text`, `behavior:url`, `slotKind:image`, etc. */
  id:       string;
  category: 'fieldType' | 'behavior' | 'slotKind' | 'recipe' | 'action';
  label:    string;
}

interface GraphEdge {
  /** Node id source. */
  from: string;
  /** Node id target. */
  to:   string;
  /**
   * Tipo de relación:
   *  - `type-behavior`: este behavior aplica a este fieldType (declared en `applicableTypes`).
   *  - `behavior-slotKind`: este behavior se renderiza típicamente en este slotKind (declared en `renderAsSlotKind`).
   *  - `recipe-action`: este recipe (kind=list) permite esta action.
   *  - `recipe-target`: este recipe (kind=list) puede tener este detail recipe como targetRecipe.
   *  - `recipe-expand`: este recipe (kind=list) puede tener este expand recipe como expand.
   */
  kind: 'type-behavior' | 'behavior-slotKind' | 'recipe-action' | 'recipe-target' | 'recipe-expand';
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

function buildConnections(
  fieldTypes: ReadonlyArray<FieldTypeDefinition>,
  behaviors:  BehaviorJson[],
  slotKinds:  SlotKindJson[],
  recipes:    RecipeJson[],
  actions:    ReadonlyArray<ActionDefinition>,
  compatibilityMatrix: Record<string, CompatibilityEntry>,
): ConnectionsSection {
  const nodes: GraphNode[] = [
    ...fieldTypes.map(t => ({ id: `fieldType:${t.id}`, category: 'fieldType' as const, label: t.displayName })),
    ...behaviors.map(b  => ({ id: `behavior:${b.id}`,  category: 'behavior'  as const, label: b.displayName })),
    ...slotKinds.map(k  => ({ id: `slotKind:${k.id}`,  category: 'slotKind'  as const, label: k.id })),
    ...recipes.map(r    => ({ id: `recipe:${r.id}`,    category: 'recipe'    as const, label: r.displayName })),
    ...actions.map(a    => ({ id: `action:${a.id}`,    category: 'action'    as const, label: a.displayName })),
  ];

  const edges: GraphEdge[] = [];

  // type-behavior: behavior.applicableTypes → fieldType
  for (const b of behaviors) {
    for (const t of b.applicableTypes) {
      edges.push({ from: `fieldType:${t}`, to: `behavior:${b.id}`, kind: 'type-behavior' });
    }
  }

  // behavior-slotKind: behavior.renderAs → slotKind
  for (const b of behaviors) {
    if (b.renderAs) {
      edges.push({ from: `behavior:${b.id}`, to: `slotKind:${b.renderAs}`, kind: 'behavior-slotKind' });
    }
  }

  // recipe-action: lista de actions permitidas por recipe (kind=list)
  // recipe-target: detail recipes válidos como targetRecipe
  // recipe-expand: expand recipes válidos como expand
  for (const [recipeId, entry] of Object.entries(compatibilityMatrix)) {
    if (entry.kindRole === 'list-source') {
      for (const aid of entry.allowedActions) {
        edges.push({ from: `recipe:${recipeId}`, to: `action:${aid}`, kind: 'recipe-action' });
      }
      for (const tid of entry.allowedTargetRecipes) {
        edges.push({ from: `recipe:${recipeId}`, to: `recipe:${tid}`, kind: 'recipe-target' });
      }
      for (const eid of entry.allowedExpandRecipes) {
        edges.push({ from: `recipe:${recipeId}`, to: `recipe:${eid}`, kind: 'recipe-expand' });
      }
    }
  }

  return { nodes, edges };
}

function main() {
  const recipes = allRecipes().map(serializeRecipe);
  const behaviors = allBehaviors().map(serializeBehavior);
  const actions = allActions().slice();
  const fieldTypes = allFieldTypes();
  const slotAcceptKinds     = buildSlotKinds(behaviors);
  const compatibilityMatrix = buildCompatibilityMatrix(recipes, actions);
  const connections         = buildConnections(fieldTypes, behaviors, slotAcceptKinds, recipes, actions, compatibilityMatrix);

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
    fieldTypes: [...fieldTypes],
    compatibilityMatrix,
    connections,
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
  console.log(`  fieldTypes:      ${fieldTypes.length}`);
  console.log(`  connections:     ${connections.nodes.length} nodes, ${connections.edges.length} edges`);
}

main();
