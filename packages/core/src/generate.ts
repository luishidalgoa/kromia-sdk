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
 *
 * ## KRO-63 — Auto-bump SemVer
 *
 * Tras KRO-63, este script:
 *
 *  1. Lee el `.json` previo desde `git show HEAD:contracts/...`.
 *  2. Genera el `.json` nuevo en memoria con la version actual del package.
 *  3. Compara prev vs next con `detectBumpKind` → kind (major/minor/patch/none).
 *  4. Si kind ≠ 'none', bumpea `package.json#version` automáticamente
 *     y re-genera con la nueva version.
 *  5. Escribe el `.json` final.
 *
 * **Single source of truth**: `package.json#version` es ahora el único
 * sitio donde se escribe la version. La constante exportada
 * `PROTOCOL_VERSION` del SDK la lee desde ahí.
 *
 * Flags soportados:
 *  - `--dry-run`: solo reporta lo que haría, no escribe nada.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

import { allRecipes, type RecipeManifest } from './registries/recipes';
import type { SlotDefinition } from './registries/recipes';
import { SLOT_ACCEPT_KIND_META } from './registries/slot-kinds';
import { allBehaviors, type BehaviorDefinition } from './registries/behaviors';
import { allActions, type ActionDefinition } from './registries/actions';
import { allFieldTypes, type FieldTypeDefinition } from './registries/field-types';
import { allVisualEffects, type VisualEffectDefinition } from './registries/visual-effects';
import type { SlotAcceptKind } from './types';
import { detectBumpKind, applyBump, type BumpKind } from './version-bump';

// ── Paths ──────────────────────────────────────────────────────────────

const PKG_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);
const MONOREPO_ROOT = resolve(PKG_ROOT, '..', '..');
const PACKAGE_JSON_PATH = resolve(PKG_ROOT, 'package.json');
const OUTPUT_PATH = resolve(MONOREPO_ROOT, 'contracts', 'kromia-recipe-protocol-v1.json');
const OUTPUT_REL_GIT = 'contracts/kromia-recipe-protocol-v1.json';

// ── Tipos del payload generado (espejo de la estructura del JSON) ──────

interface ProtocolJson {
  $schema:         string;
  protocolVersion: string;
  generatedAt:     string;
  generatedFrom: {
    packagePath:   string;
    note:          string;
  };
  recipes:             RecipeJson[];
  actions:             ActionJson[];
  behaviors:           BehaviorJson[];
  slotAcceptKinds:     SlotKindJson[];
  fieldTypes:          FieldTypeJson[];
  visualEffects:       VisualEffectJson[];
  compatibilityMatrix: Record<string, CompatibilityEntry>;
  connections:         ConnectionsSection;
}

interface ConnectionsSection {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id:       string;
  category: 'fieldType' | 'behavior' | 'slotKind' | 'recipe' | 'action';
  label:    string;
}

interface GraphEdge {
  from: string;
  to:   string;
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
  renderAs:        SlotAcceptKind | null;
}

interface SlotKindJson {
  id:             SlotAcceptKind;
  description:    string;
  behaviorIds:    string[];
}

/**
 * Shape del CONTRATO para una action — solo los campos funcionales que un
 * renderer necesita. La doc rica (whenToUse/long/examples/related/aliases)
 * NO entra al .json: es metadata del SDK source que los hosts consumen vía
 * paquete (@kromia/react, @kromia/flutter). Así editar doc no bumpea el
 * contrato. Espejo de los campos no-doc de ActionDefinition.
 */
interface ActionJson {
  id:                    string;
  displayName:           string;
  description:           string;
  transition:            'static' | 'push' | 'modal' | 'inline' | 'external';
  requiresTargetRecipe?: boolean;
  targetRecipeKind?:     'detail';
  requiresExpandRecipe?: boolean;
  requiresLinkField?:    boolean;
}

/** Shape del CONTRATO para un field type (sin doc rica — ver ActionJson). */
interface FieldTypeJson {
  id:           string;
  displayName:  string;
  description:  string;
  cardinality:  'scalar' | 'array';
  elementType?: string;
}

/**
 * Shape del CONTRATO para un efecto visual — KRO-30. Sin doc rica (ver
 * ActionJson). El `config` lleva el ESPACIO de valores válidos (lo que un
 * cliente/validador necesita), pero NO el `label` de cada param: ese es
 * editor-only (source) y se excluye igual que la doc → editarlo no bumpea.
 */
interface VisualEffectJson {
  id:          string;
  displayName: string;
  description: string;
  layer:       'overlay' | 'badge' | 'filter' | 'border';
  config:      VisualEffectConfigJson[];
}

interface VisualEffectConfigJson {
  key:       string;
  type:      'enum' | 'number' | 'string';
  options?:  string[];
  default?:  string | number;
  min?:      number;
  max?:      number;
  optional?: boolean;
}

interface CompatibilityEntry {
  kindRole:             'list-source' | 'detail-target' | 'expand-target';
  allowedActions:       string[];
  allowedTargetRecipes: string[];
  allowedExpandRecipes: string[];
}

// ── Helpers de serialización ───────────────────────────────────────────

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

function serializeAction(a: ActionDefinition): ActionJson {
  return {
    id:                   a.id,
    displayName:          a.displayName,
    description:          a.description,
    transition:           a.transition,
    requiresTargetRecipe: a.requiresTargetRecipe,
    targetRecipeKind:     a.targetRecipeKind,
    requiresExpandRecipe: a.requiresExpandRecipe,
    requiresLinkField:    a.requiresLinkField,
  };
}

function serializeFieldType(t: FieldTypeDefinition): FieldTypeJson {
  return {
    id:          t.id,
    displayName: t.displayName,
    description: t.description,
    cardinality: t.cardinality,
    elementType: t.elementType,
  };
}

function serializeVisualEffect(e: VisualEffectDefinition): VisualEffectJson {
  return {
    id:          e.id,
    displayName: e.displayName,
    description: e.description,
    layer:       e.layer,
    // `label` se omite a propósito (editor-only, como la doc rica).
    // IMPORTANTE: omitir las keys `undefined` (no pasarlas como `undefined`).
    // `JSON.stringify` las dropea del .json, pero `buildPayload` las mantendría
    // en memoria → el detector de bump (deepEqual sobre objetos anidados en
    // arrays cuenta keys) vería un mismatch y bumpearía MAJOR en falso en cada
    // `pnpm gen` posterior. Construir solo con las keys definidas evita ese drift.
    config: e.config.map(p => {
      const out: VisualEffectConfigJson = { key: p.key, type: p.type };
      if (p.options  !== undefined) out.options  = p.options;
      if (p.default  !== undefined) out.default  = p.default;
      if (p.min      !== undefined) out.min      = p.min;
      if (p.max      !== undefined) out.max      = p.max;
      if (p.optional !== undefined) out.optional = p.optional;
      return out;
    }),
  };
}

function buildSlotKinds(behaviors: BehaviorJson[]): SlotKindJson[] {
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

  for (const b of behaviors) {
    for (const t of b.applicableTypes) {
      edges.push({ from: `fieldType:${t}`, to: `behavior:${b.id}`, kind: 'type-behavior' });
    }
  }
  for (const b of behaviors) {
    if (b.renderAs) {
      edges.push({ from: `behavior:${b.id}`, to: `slotKind:${b.renderAs}`, kind: 'behavior-slotKind' });
    }
  }
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

// ── Builder del payload ────────────────────────────────────────────────

/**
 * Construye el ProtocolJson en memoria con la version dada. No escribe
 * nada — solo arma el objeto.
 *
 * Si pasas un `generatedAt` fijo, se usa tal cual. Si no, se genera con
 * `new Date().toISOString()` (el detector de bump lo ignora de todas
 * formas).
 */
export function buildPayload(version: string, generatedAt?: string): ProtocolJson {
  const recipes             = allRecipes().map(serializeRecipe);
  const behaviors           = allBehaviors().map(serializeBehavior);
  const actions             = allActions().slice();
  const fieldTypes          = allFieldTypes();
  const visualEffects       = allVisualEffects().map(serializeVisualEffect);
  const slotAcceptKinds     = buildSlotKinds(behaviors);
  const compatibilityMatrix = buildCompatibilityMatrix(recipes, actions);
  const connections         = buildConnections(fieldTypes, behaviors, slotAcceptKinds, recipes, actions, compatibilityMatrix);

  return {
    $schema:         './kromia-recipe-protocol-v1.schema.json',
    protocolVersion: version,
    generatedAt:     generatedAt ?? new Date().toISOString(),
    generatedFrom: {
      packagePath: 'packages/core/',
      note:        'JSON derivado — no editar a mano. Regenerar con `pnpm gen` desde el root del monorepo.',
    },
    recipes,
    actions: actions.map(serializeAction),
    behaviors,
    slotAcceptKinds,
    fieldTypes: fieldTypes.map(serializeFieldType),
    visualEffects,
    compatibilityMatrix,
    connections,
  };
}

// ── Read/write package.json + git previous ─────────────────────────────

interface PackageJson {
  name:    string;
  version: string;
  [k: string]: unknown;
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as PackageJson;
}

function writePackageJsonVersion(newVersion: string): void {
  // Edit en disco preservando orden y formato. Como `JSON.stringify` no
  // garantiza orden, parseamos + serializamos manteniendo el indent 2
  // (estándar npm). Si hubiera comentarios/JSON5 esto rompería, pero
  // package.json siempre es JSON puro.
  const raw = readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const pkg = JSON.parse(raw) as PackageJson;
  pkg.version = newVersion;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

/**
 * Lee el .json previo desde el HEAD del git. Si falla (primer commit,
 * archivo no existía, repo no inicializado), devuelve null — el caller
 * trata como "primera generación, no hay diff".
 */
function readPreviousJsonFromGit(): Record<string, unknown> | null {
  try {
    const raw = execSync(`git show HEAD:${OUTPUT_REL_GIT}`, {
      cwd:      MONOREPO_ROOT,
      encoding: 'utf8',
      stdio:    ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────

function describeBumpReasons(reasons: ReturnType<typeof detectBumpKind>['reasons']): string {
  // Top 5 razones, agrupadas por nivel. Suficiente para entender por qué
  // bumpea sin saturar el terminal.
  const top = reasons.slice(0, 5);
  return top.map(r => `  - [${r.level}] ${r.description}`).join('\n');
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const pkg = readPackageJson();
  const currentVersion = pkg.version;

  // 1) Generar el payload "candidato" con la version actual.
  const candidate = buildPayload(currentVersion);

  // 2) Comparar con el previo desde git.
  const prev = readPreviousJsonFromGit();

  let finalVersion = currentVersion;
  let bumpKind: BumpKind = 'none';

  if (prev) {
    const detection = detectBumpKind(prev, candidate);
    bumpKind = detection.kind;
    if (bumpKind !== 'none') {
      finalVersion = applyBump(currentVersion, bumpKind);
      console.log(`▸ Cambios detectados: ${bumpKind.toUpperCase()} (${detection.reasons.length} razones)`);
      console.log(describeBumpReasons(detection.reasons));
      console.log(`▸ Bump: ${currentVersion} → ${finalVersion}`);
    } else {
      console.log(`▸ Sin cambios detectados frente a HEAD. Version se mantiene en ${currentVersion}.`);
    }
  } else {
    console.log(`▸ No hay .json previo en git HEAD (primera generación o archivo recién añadido).`);
    console.log(`▸ Version se mantiene en ${currentVersion} (sin auto-bump).`);
  }

  // 3) Re-construir el payload final con la version definitiva.
  const finalPayload = (finalVersion === currentVersion)
    ? candidate
    : buildPayload(finalVersion);

  // 4) Escribir (o reportar si --dry-run).
  const serialized = JSON.stringify(finalPayload, null, 2) + '\n';

  if (dryRun) {
    console.log(`▸ --dry-run: NO se escribió nada.`);
    console.log(`▸ Habría escrito: ${OUTPUT_PATH}`);
    console.log(`▸ Habría actualizado package.json#version: ${pkg.version} → ${finalVersion}`);
    return;
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized, 'utf8');

  if (finalVersion !== currentVersion) {
    writePackageJsonVersion(finalVersion);
  }

  // 5) Summary.
  console.log(`✓ Generado ${OUTPUT_PATH}`);
  console.log(`  protocolVersion: ${finalVersion}`);
  console.log(`  recipes:         ${finalPayload.recipes.length} (list=${finalPayload.recipes.filter(r => r.kind === 'list').length}, detail=${finalPayload.recipes.filter(r => r.kind === 'detail').length}, expand=${finalPayload.recipes.filter(r => r.kind === 'expand').length})`);
  console.log(`  actions:         ${finalPayload.actions.length}`);
  console.log(`  behaviors:       ${finalPayload.behaviors.length}`);
  console.log(`  slotAcceptKinds: ${finalPayload.slotAcceptKinds.length}`);
  console.log(`  fieldTypes:      ${finalPayload.fieldTypes.length}`);
  console.log(`  visualEffects:   ${finalPayload.visualEffects.length}`);
  console.log(`  connections:     ${finalPayload.connections.nodes.length} nodes, ${finalPayload.connections.edges.length} edges`);
  if (finalVersion !== currentVersion) {
    console.log(`✓ package.json#version actualizado: ${currentVersion} → ${finalVersion}`);
  }
}

// KRO-114 — solo auto-ejecuta cuando se corre como script (`tsx src/generate.ts`).
// Al importar `buildPayload` desde un test (contract-drift) NO debe regenerar ni
// escribir nada en disco. Idiom ESM (el módulo ya usa import.meta.url para los
// paths): comparamos la URL del módulo con la del entrypoint (argv[1]).
const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
