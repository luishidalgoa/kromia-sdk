/**
 * `version-bump.ts` — detector de tipo de cambio SemVer entre dos
 * outputs del KRP `.json`.
 *
 * Aplica las reglas del playbook `playbooks/bump-protocol.md`:
 *
 *  - **Major**: cualquier eliminación (recipe, action, behavior,
 *    slotKind, fieldType, slot dentro de una recipe), o cambio de shape
 *    no-cosmético en una entrada existente (`kind`, `accepts[]`,
 *    `applicableTypes[]`, `optional`, `nestable`, `transition`, etc.).
 *  - **Minor**: nueva entidad (recipe, action, behavior, slotKind,
 *    fieldType, nuevo slot opcional en una recipe existente).
 *  - **Patch**: solo cambios cosméticos (`displayName`, `description`,
 *    `label`).
 *  - **None**: outputs idénticos modulo `generatedAt` y `protocolVersion`.
 *
 * El detector es **puro** — recibe dos objetos JSON ya parseados, no
 * toca disco ni git. Eso lo hace trivial de testear con corpus de
 * transiciones (estado A → estado B → bump esperado).
 *
 * Campos meta del JSON ignorados al comparar (no son contrato):
 *  - `$schema`, `protocolVersion`, `generatedAt`, `generatedFrom`.
 *
 * Campos derivados (calculados desde los registries, no fuentes
 * primarias) que también se ignoran al detectar bump:
 *  - `compatibilityMatrix`, `connections.nodes`, `connections.edges`.
 *  - Cambios en estos campos siempre reflejan cambios upstream en
 *    alguna colección — el detector los pillaría ahí primero.
 *
 * NOTA conceptual: este módulo es **NO publicado** como API del SDK
 * porque su consumer natural es `generate.ts` (interno). Se exporta
 * desde el barrel solo para que CI / tests externos puedan invocarlo
 * si lo necesitan (drift detector futuro de KRO-64, por ejemplo).
 */

// ── Tipos públicos ─────────────────────────────────────────────────

export type BumpKind = 'major' | 'minor' | 'patch' | 'none';

export interface BumpReason {
  /** Tipo de cambio que disparó el reason. */
  level:      'major' | 'minor' | 'patch';
  /** Colección donde se detectó (recipes, actions, behaviors, ...). */
  collection: string;
  /** Id de la entidad (o `'<root>'` si es del top-level). */
  entityId:   string;
  /** Descripción legible del cambio. */
  description: string;
}

export interface BumpDetectionResult {
  /** Nivel de bump máximo detectado. */
  kind:    BumpKind;
  /** Lista de razones que llevaron al veredicto, ordenadas por gravedad. */
  reasons: BumpReason[];
}

// ── Constantes internas ────────────────────────────────────────────

/**
 * Campos cosméticos por entrada. Cambios en estos campos solos = PATCH.
 * Mismo set para todas las colecciones — si una colección añade un
 * campo "label-ish" nuevo, considerar si debería entrar aquí.
 */
const COSMETIC_FIELDS = new Set<string>([
  'displayName',
  'description',
  'label',
]);

/** Top-level fields del JSON que NO se comparan (no son contrato). */
const IGNORED_TOP_LEVEL_FIELDS = new Set<string>([
  '$schema',
  'protocolVersion',
  'generatedAt',
  'generatedFrom',
  // Derivados — si cambian, fue por cambios upstream ya detectados.
  'compatibilityMatrix',
  'connections',
]);

/**
 * Colecciones a comparar entry-by-entry. El orden NO importa para el
 * resultado del detector (el max wins), pero sí condiciona el orden
 * de los `reasons` en el output.
 */
const COLLECTIONS = ['recipes', 'actions', 'behaviors', 'slotAcceptKinds', 'fieldTypes'] as const;

// ── API pública ────────────────────────────────────────────────────

/**
 * Detecta el tipo de bump SemVer entre dos outputs del KRP.
 * Pure function — no side effects.
 */
export function detectBumpKind(prev: unknown, next: unknown): BumpDetectionResult {
  const reasons: BumpReason[] = [];

  if (!isRecord(prev) || !isRecord(next)) {
    throw new Error('detectBumpKind: prev y next deben ser objetos JSON.');
  }

  for (const coll of COLLECTIONS) {
    const prevArr = Array.isArray(prev[coll]) ? (prev[coll] as unknown[]) : [];
    const nextArr = Array.isArray(next[coll]) ? (next[coll] as unknown[]) : [];

    diffCollection(coll, prevArr, nextArr, reasons);
  }

  // Cazar también nuevos top-level fields no cubiertos por COLLECTIONS
  // (futuro: si el JSON gana una sección nueva como `viewHints` la
  // detección sigue siendo correcta — adición = minor).
  for (const key of Object.keys(next)) {
    if (IGNORED_TOP_LEVEL_FIELDS.has(key)) continue;
    if (COLLECTIONS.includes(key as typeof COLLECTIONS[number])) continue;
    if (!(key in prev)) {
      reasons.push({
        level:       'minor',
        collection:  '<root>',
        entityId:    key,
        description: `nuevo top-level field "${key}"`,
      });
    }
  }
  for (const key of Object.keys(prev)) {
    if (IGNORED_TOP_LEVEL_FIELDS.has(key)) continue;
    if (COLLECTIONS.includes(key as typeof COLLECTIONS[number])) continue;
    if (!(key in next)) {
      reasons.push({
        level:       'major',
        collection:  '<root>',
        entityId:    key,
        description: `top-level field "${key}" eliminado`,
      });
    }
  }

  // Veredicto = máximo nivel detectado, ordenado de mayor a menor.
  reasons.sort((a, b) => severityRank(b.level) - severityRank(a.level));

  const kind: BumpKind = reasons.length === 0
    ? 'none'
    : reasons[0].level;

  return { kind, reasons };
}

/**
 * Aplica un bump a un string SemVer.
 *
 * - major: 1.2.3 → 2.0.0
 * - minor: 1.2.3 → 1.3.0
 * - patch: 1.2.3 → 1.2.4
 * - none:  sin cambios
 */
export function applyBump(current: string, kind: BumpKind): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m) throw new Error(`applyBump: "${current}" no es un SemVer válido (X.Y.Z).`);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  switch (kind) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'none':  return current;
  }
}

// ── Internals ──────────────────────────────────────────────────────

function severityRank(kind: 'major' | 'minor' | 'patch'): number {
  return kind === 'major' ? 3 : kind === 'minor' ? 2 : 1;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Index a collection by its `id` field. Entries sin id se ignoran. */
function indexById(arr: unknown[]): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const item of arr) {
    if (isRecord(item) && typeof item.id === 'string') {
      out.set(item.id, item);
    }
  }
  return out;
}

function diffCollection(
  coll:    string,
  prevArr: unknown[],
  nextArr: unknown[],
  reasons: BumpReason[],
): void {
  const prevById = indexById(prevArr);
  const nextById = indexById(nextArr);

  // Removals → major (siempre breaking).
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) {
      reasons.push({
        level:       'major',
        collection:  coll,
        entityId:    id,
        description: `${coll}: "${id}" eliminado`,
      });
    }
  }

  // Additions → minor (backward-compatible — un cliente viejo que no
  // conoce el nuevo id puede ignorarlo).
  for (const id of nextById.keys()) {
    if (!prevById.has(id)) {
      reasons.push({
        level:       'minor',
        collection:  coll,
        entityId:    id,
        description: `${coll}: "${id}" añadido`,
      });
    }
  }

  // Modifications.
  for (const id of nextById.keys()) {
    const prevEntry = prevById.get(id);
    if (!prevEntry) continue;
    const nextEntry = nextById.get(id)!;
    diffEntry(coll, id, prevEntry, nextEntry, reasons);
  }
}

/**
 * Compara dos entradas (mismo id) y empuja razones al array.
 *
 * - Campos cosméticos diferentes → patch.
 * - Cualquier otro campo diferente → major.
 * - Para el array `slots` de recipes, hace un diff entry-by-entry
 *   recursivo: slot añadido = minor (solo si `optional:true`),
 *   slot eliminado = major, slot modificado en shape = major.
 */
function diffEntry(
  coll:    string,
  id:      string,
  prev:    Record<string, unknown>,
  next:    Record<string, unknown>,
  reasons: BumpReason[],
): void {
  const allKeys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    // Tratamiento especial para `slots` (recipes) — sub-colección
    // con sus propias reglas.
    if (key === 'slots' && coll === 'recipes') {
      diffRecipeSlots(id, prev.slots, next.slots, reasons);
      continue;
    }

    if (!deepEqual(prev[key], next[key])) {
      if (COSMETIC_FIELDS.has(key)) {
        reasons.push({
          level:       'patch',
          collection:  coll,
          entityId:    id,
          description: `${coll}.${id}.${key} cambió (cosmético)`,
        });
      } else {
        reasons.push({
          level:       'major',
          collection:  coll,
          entityId:    id,
          description: `${coll}.${id}.${key} cambió (shape)`,
        });
      }
    }
  }
}

function diffRecipeSlots(
  recipeId: string,
  prevSlots: unknown,
  nextSlots: unknown,
  reasons:   BumpReason[],
): void {
  if (!Array.isArray(prevSlots) || !Array.isArray(nextSlots)) {
    // Si el shape cambió tan radicalmente que slots ya no es array, eso es major.
    reasons.push({
      level:       'major',
      collection:  'recipes',
      entityId:    recipeId,
      description: `recipes.${recipeId}.slots: shape changed (no es array)`,
    });
    return;
  }

  const prevBySlotId = indexById(prevSlots);
  const nextBySlotId = indexById(nextSlots);

  // Slot eliminado → major.
  for (const slotId of prevBySlotId.keys()) {
    if (!nextBySlotId.has(slotId)) {
      reasons.push({
        level:       'major',
        collection:  'recipes',
        entityId:    recipeId,
        description: `recipes.${recipeId}.slots: "${slotId}" eliminado`,
      });
    }
  }

  // Slot añadido → minor si optional:true, major si optional:false
  // (un cliente que rendereaba la recipe sin el slot ahora se enfrenta
  // a un slot requerido nuevo que no sabe rellenar).
  for (const slotId of nextBySlotId.keys()) {
    if (!prevBySlotId.has(slotId)) {
      const slot = nextBySlotId.get(slotId)!;
      const isOptional = slot.optional === true;
      reasons.push({
        level:       isOptional ? 'minor' : 'major',
        collection:  'recipes',
        entityId:    recipeId,
        description: `recipes.${recipeId}.slots: "${slotId}" añadido${isOptional ? ' (optional)' : ' (REQUIRED)'}`,
      });
    }
  }

  // Slot modificado: comparar field-by-field (idéntico tratamiento de cosmetic).
  for (const slotId of nextBySlotId.keys()) {
    const prevSlot = prevBySlotId.get(slotId);
    if (!prevSlot) continue;
    const nextSlot = nextBySlotId.get(slotId)!;
    const slotKeys = new Set<string>([...Object.keys(prevSlot), ...Object.keys(nextSlot)]);
    for (const k of slotKeys) {
      if (!deepEqual(prevSlot[k], nextSlot[k])) {
        if (COSMETIC_FIELDS.has(k)) {
          reasons.push({
            level:       'patch',
            collection:  'recipes',
            entityId:    recipeId,
            description: `recipes.${recipeId}.slots.${slotId}.${k} cambió (cosmético)`,
          });
        } else {
          reasons.push({
            level:       'major',
            collection:  'recipes',
            entityId:    recipeId,
            description: `recipes.${recipeId}.slots.${slotId}.${k} cambió (shape)`,
          });
        }
      }
    }
  }
}

/** Deep equality recursiva. Orden importa en arrays (conservador). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao).sort();
  const bKeys = Object.keys(bo).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (!deepEqual(ao[aKeys[i]], bo[bKeys[i]])) return false;
  }
  return true;
}
