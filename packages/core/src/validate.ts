/**
 * `validate.ts` — KRO-79. Validador puro de `ViewComposition`.
 *
 * Dada una composition y opcionalmente los `fieldDefs` de la sección, devuelve
 * la lista de issues detectados. Útil para:
 *  - Backend: validar antes de persistir.
 *  - Studio: badge de "composición válida" en el editor.
 *  - Flutter (KRO-65): rechazar composiciones que no puede renderizar.
 *  - Drift CI (KRO-64): validar consistencia tras un bump del KRP.
 *
 * Pure: sin side effects, sin acceso a I/O. Mismas entradas → mismas issues.
 *
 * **Severities**:
 *  - `error`: violación dura del modelo — el cliente no puede renderizar.
 *  - `warn`:  el cliente puede renderizar con un fallback, pero el publisher
 *             debería ser advertido.
 */

import type { ViewComposition, SlotComposition, SlotAppearance, FieldDefLike, NestedViewComposition, TargetComposition } from './types';
import { RECIPE_REGISTRY, getRecipeManifest, allRecipesByKind } from './registries/recipes';
import { ACTION_IDS } from './registries/actions';
import { MAX_TARGET_DEPTH } from './target-chain';
import { classifyField, isFieldCompatibleWithSlot, getEffectiveSlots } from './classify';
import {
  OPTIONS_APPEARANCE_SHAPE,
  OPTIONS_APPEARANCE_ASPECT,
  OPTIONS_APPEARANCE_ALIGN,
  OPTIONS_APPEARANCE_WEIGHT,
  OPTIONS_APPEARANCE_SIZE,
  OPTIONS_APPEARANCE_TRUNCATE,
  OPTIONS_APPEARANCE_PADDING_Y,
  OPTIONS_APPEARANCE_ACCENT_POSITION,
  OPTIONS_APPEARANCE_REF_COLUMNS,
  OPTIONS_APPEARANCE_REF_TAP,
} from './options';

// ─────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────

export interface ValidationIssue {
  /** Path JSON-style al field que falló (e.g. `slots.title.fields[0]`). */
  path:    string;
  /** Mensaje legible en español. */
  message: string;
  /** Severity: error = no renderizable; warn = renderizable con fallback. */
  level:   'error' | 'warn';
}

export interface ValidationResult {
  /** True si no hay issues `error`. Warnings no invalidan. */
  valid:    boolean;
  /** Todos los issues encontrados (errors + warnings). */
  issues:   ValidationIssue[];
}

export interface ValidateCompositionOptions {
  /**
   * Definiciones de fields de la sección. Si se provee, el validador
   * comprueba que cada field referenciado en slots existe y que su
   * SlotAcceptKind es compatible con el slot del recipe.
   *
   * Sin fieldDefs, el validador no puede comprobar referencias a fields
   * — solo valida la estructura de la composition.
   */
  fieldDefs?: FieldDefLike[];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────

const SHAPE_IDS    = new Set(OPTIONS_APPEARANCE_SHAPE.map(o => o.id));
const ASPECT_IDS   = new Set(OPTIONS_APPEARANCE_ASPECT.map(o => o.id));
const ALIGN_IDS    = new Set(OPTIONS_APPEARANCE_ALIGN.map(o => o.id));
const WEIGHT_IDS   = new Set(OPTIONS_APPEARANCE_WEIGHT.map(o => o.id));
const SIZE_IDS     = new Set(OPTIONS_APPEARANCE_SIZE.map(o => o.id));
const TRUNCATE_IDS = new Set(OPTIONS_APPEARANCE_TRUNCATE.map(o => o.id));
const PADDING_IDS  = new Set(OPTIONS_APPEARANCE_PADDING_Y.map(o => o.id));
const ACCENT_IDS   = new Set(OPTIONS_APPEARANCE_ACCENT_POSITION.map(o => o.id));
const REF_COLS_IDS = new Set(OPTIONS_APPEARANCE_REF_COLUMNS.map(o => o.id));
const REF_TAP_IDS  = new Set(OPTIONS_APPEARANCE_REF_TAP.map(o => o.id));

function validateAppearance(
  appearance: SlotAppearance | undefined,
  path:       string,
  issues:     ValidationIssue[],
): void {
  if (!appearance) return;

  if (appearance.shape !== undefined && !SHAPE_IDS.has(appearance.shape)) {
    issues.push({ path: `${path}.shape`,    level: 'error', message: `shape "${appearance.shape}" no es válido` });
  }
  if (appearance.aspect !== undefined && !ASPECT_IDS.has(appearance.aspect)) {
    issues.push({ path: `${path}.aspect`,   level: 'error', message: `aspect "${appearance.aspect}" no es válido` });
  }
  if (appearance.align !== undefined && !ALIGN_IDS.has(appearance.align)) {
    issues.push({ path: `${path}.align`,    level: 'error', message: `align "${appearance.align}" no es válido` });
  }
  if (appearance.weight !== undefined && !WEIGHT_IDS.has(appearance.weight)) {
    issues.push({ path: `${path}.weight`,   level: 'error', message: `weight "${appearance.weight}" no es válido` });
  }
  if (appearance.size !== undefined && !SIZE_IDS.has(appearance.size)) {
    issues.push({ path: `${path}.size`,     level: 'error', message: `size "${appearance.size}" no es válido` });
  }
  if (appearance.truncate !== undefined && !TRUNCATE_IDS.has(appearance.truncate)) {
    issues.push({ path: `${path}.truncate`, level: 'error', message: `truncate "${appearance.truncate}" no es válido` });
  }
  if (appearance.paddingY !== undefined && !PADDING_IDS.has(appearance.paddingY)) {
    issues.push({ path: `${path}.paddingY`, level: 'error', message: `paddingY "${appearance.paddingY}" no es válido` });
  }
  if (appearance.refColumns !== undefined && !REF_COLS_IDS.has(appearance.refColumns)) {
    issues.push({ path: `${path}.refColumns`, level: 'error', message: `refColumns "${appearance.refColumns}" no es válido` });
  }
  if (appearance.refTap !== undefined && !REF_TAP_IDS.has(appearance.refTap)) {
    issues.push({ path: `${path}.refTap`, level: 'error', message: `refTap "${appearance.refTap}" no es válido` });
  }
  if (appearance.accentPosition !== undefined && !ACCENT_IDS.has(appearance.accentPosition)) {
    issues.push({ path: `${path}.accentPosition`, level: 'error', message: `accentPosition "${appearance.accentPosition}" no es válido` });
  }

  // truncateChars debe ser entero positivo razonable (1..500).
  if (appearance.truncateChars !== undefined) {
    if (
      !Number.isInteger(appearance.truncateChars) ||
      appearance.truncateChars < 1 ||
      appearance.truncateChars > 500
    ) {
      issues.push({
        path:    `${path}.truncateChars`,
        level:   'error',
        message: `truncateChars debe ser entero entre 1 y 500, recibido: ${appearance.truncateChars}`,
      });
    }
  }
}

/**
 * Valida una `NestedViewComposition` (mini-receta dentro de un slot).
 *
 * Reglas:
 *  - `recipe` es string no vacío.
 *  - `slots` es objeto.
 *  - **Depth max = 2**: la nested NO puede tener slots con su propia
 *    `nestedComposition`. Esto previene loops conceptuales (KRO-43 V4).
 *
 * NOTA: los fields del nested típicamente referencian OTRO schema (cross-section),
 * por eso NO se validan contra `fieldDefs` del padre. Solo se valida
 * well-formedness de strings no vacíos.
 */
function validateNested(
  nested:   NestedViewComposition,
  basePath: string,
  issues:   ValidationIssue[],
): void {
  if (typeof nested !== 'object' || Array.isArray(nested)) {
    issues.push({ path: basePath, level: 'error', message: 'nestedComposition no es un objeto' });
    return;
  }
  if (!nested.recipe || typeof nested.recipe !== 'string' || !nested.recipe.trim()) {
    issues.push({ path: `${basePath}.recipe`, level: 'error', message: 'nestedComposition.recipe vacío o no string' });
  }
  // `slots` puede ser undefined (interpretado como "sin slots"), pero si
  // está EXPLÍCITO con null o un array, es error.
  if (nested.slots !== undefined && (nested.slots === null || typeof nested.slots !== 'object' || Array.isArray(nested.slots))) {
    issues.push({ path: `${basePath}.slots`, level: 'error', message: 'nestedComposition.slots no es un objeto' });
    return;
  }
  const nestedSlots = nested.slots ?? {};
  for (const [slotName, slot] of Object.entries(nestedSlots)) {
    const slotPath = `${basePath}.slots.${slotName}`;
    if (!slot || typeof slot !== 'object') {
      issues.push({ path: slotPath, level: 'error', message: `slot "${slotName}" no es un objeto` });
      continue;
    }
    const slotFields = Array.isArray(slot.fields) ? slot.fields : [];
    slotFields.forEach((key, i) => {
      if (typeof key !== 'string' || !key.trim()) {
        issues.push({
          path:    `${slotPath}.fields[${i}]`,
          level:   'error',
          message: `slot "${slotName}" contiene una entry vacía o no-string`,
        });
      }
    });
    // Depth max=2: una nested NO puede tener su propia nested.
    if (slot.nestedComposition !== undefined && slot.nestedComposition !== null) {
      issues.push({
        path:    `${slotPath}.nestedComposition`,
        level:   'error',
        message: `slot "${slotName}" excede profundidad máxima (2). nestedComposition no permitida dentro de otra nested.`,
      });
    }
  }
}

function validateSlot(
  slotId:    string,
  slot:      SlotComposition,
  recipeSlot: { id: string; accepts: string[]; kind: 'single' | 'composable' } | undefined,
  fieldDefs: FieldDefLike[] | undefined,
  basePath:  string,
  issues:    ValidationIssue[],
): void {
  // El slot debe tener al menos 1 field (sino, el editor debe omitirlo).
  // Pero aceptamos array vacío como warn — el renderer lo trata como "slot
  // sin contenido", no es invalido per se.
  if (!Array.isArray(slot.fields)) {
    issues.push({ path: `${basePath}.fields`, level: 'error', message: 'fields debe ser un array' });
    return;
  }

  // Single slot solo acepta 1 field (más sería ignorado por el renderer).
  if (recipeSlot && recipeSlot.kind === 'single' && slot.fields.length > 1) {
    issues.push({
      path:    `${basePath}.fields`,
      level:   'warn',
      message: `slot "${slotId}" es single pero tiene ${slot.fields.length} fields; solo se usa el primero`,
    });
  }

  // Verificación field-existencia + compatibilidad si fieldDefs provisto.
  if (fieldDefs) {
    const defByKey = new Map(fieldDefs.map(d => [d.key, d]));
    slot.fields.forEach((key, i) => {
      const def = defByKey.get(key);
      if (!def) {
        issues.push({
          path:    `${basePath}.fields[${i}]`,
          level:   'error',
          message: `field "${key}" no existe en la sección`,
        });
        return;
      }
      // Compatibilidad con accepts kinds del slot.
      if (recipeSlot) {
        const compatible = isFieldCompatibleWithSlot(def, recipeSlot as any);
        if (!compatible) {
          const kinds = classifyField(def).join('|');
          issues.push({
            path:    `${basePath}.fields[${i}]`,
            level:   'error',
            message: `field "${key}" (${kinds}) no es compatible con slot "${slotId}" (acepta: ${recipeSlot.accepts.join('|')})`,
          });
        }
      }
    });
  }

  // Appearance.
  validateAppearance(slot.appearance, `${basePath}.appearance`, issues);

  // Separator + orientation son strings libres; el cliente los aplica.
  // Solo validamos que orientation sea uno de los dos valores conocidos.
  if (slot.orientation !== undefined && slot.orientation !== 'horizontal' && slot.orientation !== 'vertical') {
    issues.push({
      path:    `${basePath}.orientation`,
      level:   'error',
      message: `orientation "${slot.orientation}" no es válido (esperaba 'horizontal' o 'vertical')`,
    });
  }

  // KRO-80 — nestedComposition con depth max=2.
  if (slot.nestedComposition !== undefined && slot.nestedComposition !== null) {
    validateNested(slot.nestedComposition, `${basePath}.nestedComposition`, issues);
  }
}

/**
 * KRO-94 Fase B — Valida un eslabón de la cadena de navegación multi-salto
 * (`TargetComposition`) y, recursivamente, sus saltos siguientes.
 *
 * Reglas:
 *  - `recipe` debe existir.
 *  - `action` debe ser válida.
 *  - slots well-formed contra el manifest del recipe. Las **referencias a
 *    fields NO se validan** (`fieldDefs` deliberadamente omitido): una pantalla
 *    destino puede renderizar otra sección (cross-section), como en `validateNested`.
 *  - `expand` (si presente) debe ser kind=expand.
 *  - profundidad acotada a `MAX_TARGET_DEPTH` (error si se excede).
 */
function validateTargetChain(
  node:   TargetComposition,
  depth:  number,
  path:   string,
  issues: ValidationIssue[],
): void {
  if (depth > MAX_TARGET_DEPTH) {
    issues.push({
      path,
      level:   'error',
      message: `cadena de navegación excede la profundidad máxima (${MAX_TARGET_DEPTH})`,
    });
    return;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    issues.push({ path, level: 'error', message: 'targetComposition no es un objeto' });
    return;
  }

  const manifest = getRecipeManifest(node.recipe);
  if (!manifest) {
    issues.push({ path: `${path}.recipe`, level: 'error', message: `recipe "${node.recipe}" no existe` });
  }

  if (!ACTION_IDS.includes(node.action)) {
    issues.push({
      path:    `${path}.action`,
      level:   'error',
      message: `action "${node.action}" no es válida (esperaba: ${ACTION_IDS.join('|')})`,
    });
  }

  const slotsByid = new Map((manifest?.slots ?? []).map(s => [s.id, s]));
  for (const [slotId, slot] of Object.entries(node.slots ?? {})) {
    // fieldDefs omitido a propósito (cross-section): solo well-formedness.
    validateSlot(slotId, slot, slotsByid.get(slotId), undefined, `${path}.slots.${slotId}`, issues);
  }

  if (node.expand) {
    const expandManifest = getRecipeManifest(node.expand.recipe);
    if (!expandManifest) {
      issues.push({ path: `${path}.expand.recipe`, level: 'error', message: `expand.recipe "${node.expand.recipe}" no existe` });
    } else if (expandManifest.kind !== 'expand') {
      issues.push({ path: `${path}.expand.recipe`, level: 'error', message: `expand.recipe "${node.expand.recipe}" no es de kind=expand (es "${expandManifest.kind}")` });
    }
    const expandSlotsByid = new Map((expandManifest?.slots ?? []).map(s => [s.id, s]));
    for (const [slotId, slot] of Object.entries(node.expand.slots ?? {})) {
      validateSlot(slotId, slot, expandSlotsByid.get(slotId), undefined, `${path}.expand.slots.${slotId}`, issues);
    }
  }

  if (node.targetComposition) {
    validateTargetChain(node.targetComposition, depth + 1, `${path}.targetComposition`, issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valida una `ViewComposition` contra el modelo del SDK.
 *
 * @param composition Composition a validar.
 * @param options.fieldDefs Definiciones de fields de la sección (opcional).
 *                  Si se provee, el validador comprueba referencias y
 *                  compatibilidad de SlotAcceptKind. Sin fieldDefs, solo
 *                  valida la estructura.
 * @returns         `{ valid, issues }` — `valid` es true si no hay errors
 *                  (las warnings no invalidan).
 */
export function validateComposition(
  composition: ViewComposition,
  options:     ValidateCompositionOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { fieldDefs } = options;

  // ── 1. recipe ──────────────────────────────────────────────────────
  const manifest = getRecipeManifest(composition.recipe);
  if (!manifest) {
    issues.push({
      path:    'recipe',
      level:   'error',
      message: `recipe "${composition.recipe}" no existe en RECIPE_REGISTRY`,
    });
  }

  // ── 2. action ──────────────────────────────────────────────────────
  if (!ACTION_IDS.includes(composition.action)) {
    issues.push({
      path:    'action',
      level:   'error',
      message: `action "${composition.action}" no es válida (esperaba: ${ACTION_IDS.join('|')})`,
    });
  }

  // ── 3. slots ───────────────────────────────────────────────────────
  const recipeSlotsByid = new Map(
    (manifest?.slots ?? []).map(s => [s.id, s]),
  );

  for (const [slotId, slot] of Object.entries(composition.slots ?? {})) {
    const recipeSlot = recipeSlotsByid.get(slotId);
    if (!recipeSlot && manifest) {
      // El slot existe en la composition pero no en el manifest del recipe
      // — puede ser un custom slot legítimo (slotOverrides.custom) o un
      // error del editor. Warn (no error) porque el renderer lo ignora.
      issues.push({
        path:    `slots.${slotId}`,
        level:   'warn',
        message: `slot "${slotId}" no existe en el manifest de "${composition.recipe}" — ¿custom slot?`,
      });
    }
    validateSlot(slotId, slot, recipeSlot, fieldDefs, `slots.${slotId}`, issues);
  }

  // ── 3b. Slots OBLIGATORIOS sin rellenar (paridad con el editor de Studio) ──
  // Para cada slot EFECTIVO (manifest base − disabled + custom) que NO sea
  // opcional, debe haber al menos 1 field asignado. Si el slot falta de la
  // composition o tiene `fields: []`, se avisa. Es `warn` (no `error`): el
  // renderer degrada (placeholder/iniciales), así que no bloquea crear/editar
  // — pero cliente y servidor coinciden en señalar el hueco, igual que el chip
  // rojo "required" del ViewCompositionTreeEditor. Los slots desactivados vía
  // `slotOverrides.disabled` quedan EXCLUIDOS por getEffectiveSlots → no avisan
  // (el publisher los ocultó a propósito).
  if (manifest) {
    const effectiveSlots = getEffectiveSlots(manifest, composition.slotOverrides);
    for (const eslot of effectiveSlots) {
      if (eslot.optional) continue;
      const sc = composition.slots?.[eslot.id];
      const filled = Array.isArray(sc?.fields) && sc!.fields.length > 0;
      if (!filled) {
        issues.push({
          path:    `slots.${eslot.id}`,
          level:   'warn',
          message: `slot "${eslot.id}" es obligatorio en "${composition.recipe}" pero no tiene ningún field asignado`,
        });
      }
    }
  }

  // ── 4. accentPosition (top-level) ─────────────────────────────────
  if (composition.accentPosition !== undefined && !ACCENT_IDS.has(composition.accentPosition)) {
    issues.push({
      path:    'accentPosition',
      level:   'error',
      message: `accentPosition "${composition.accentPosition}" no es válido`,
    });
  }

  // ── 5. expand (mini-receta inline) ────────────────────────────────
  if (composition.expand) {
    const expandManifest = getRecipeManifest(composition.expand.recipe);
    if (!expandManifest) {
      issues.push({
        path:    'expand.recipe',
        level:   'error',
        message: `expand.recipe "${composition.expand.recipe}" no existe`,
      });
    } else if (expandManifest.kind !== 'expand') {
      issues.push({
        path:    'expand.recipe',
        level:   'error',
        message: `expand.recipe "${composition.expand.recipe}" no es de kind=expand (es "${expandManifest.kind}")`,
      });
    }
    // Validar slots de expand.
    const expandSlotsByid = new Map((expandManifest?.slots ?? []).map(s => [s.id, s]));
    for (const [slotId, slot] of Object.entries(composition.expand.slots ?? {})) {
      validateSlot(slotId, slot, expandSlotsByid.get(slotId), fieldDefs, `expand.slots.${slotId}`, issues);
    }
  }

  // ── 6. linkField (KRO-80) ─────────────────────────────────────────
  // Referencia un field existente en fieldDefs cuando se provee.
  if (composition.linkField !== undefined && composition.linkField !== null) {
    if (typeof composition.linkField !== 'string' || !composition.linkField.trim()) {
      issues.push({
        path:    'linkField',
        level:   'error',
        message: 'linkField debe ser un string no vacío (o ausente)',
      });
    } else if (fieldDefs) {
      const fieldKeys = new Set(fieldDefs.map(f => f.key));
      if (!fieldKeys.has(composition.linkField)) {
        issues.push({
          path:    'linkField',
          level:   'error',
          message: `linkField referencia el field "${composition.linkField}" que no existe en la sección`,
        });
      }
    }
  }

  // ── 7. targetRecipe (auto-pick si no especificado) ────────────────
  if (composition.targetRecipe !== undefined) {
    const target = getRecipeManifest(composition.targetRecipe);
    if (!target) {
      issues.push({
        path:    'targetRecipe',
        level:   'error',
        message: `targetRecipe "${composition.targetRecipe}" no existe`,
      });
    } else if (target.kind !== 'detail') {
      issues.push({
        path:    'targetRecipe',
        level:   'warn',
        message: `targetRecipe "${composition.targetRecipe}" no es kind=detail (es "${target.kind}")`,
      });
    }
  }

  // ── 7b. targetComposition (KRO-94 Fase B — cadena multi-salto) ────
  if (composition.targetComposition) {
    if (composition.targetRecipe !== undefined) {
      issues.push({
        path:    'targetComposition',
        level:   'warn',
        message: 'targetComposition y targetRecipe ambos presentes; el cliente usa targetComposition',
      });
    }
    validateTargetChain(composition.targetComposition, 1, 'targetComposition', issues);
  }

  // ── 8. slotOverrides ──────────────────────────────────────────────
  if (composition.slotOverrides) {
    const recipeSlotIds = new Set((manifest?.slots ?? []).map(s => s.id));

    if (composition.slotOverrides.disabled) {
      composition.slotOverrides.disabled.forEach((id, i) => {
        if (!recipeSlotIds.has(id)) {
          issues.push({
            path:    `slotOverrides.disabled[${i}]`,
            level:   'warn',
            message: `slot "${id}" no existe en el manifest del recipe — disabled tiene efecto nulo`,
          });
        }
      });
    }

    if (composition.slotOverrides.custom) {
      composition.slotOverrides.custom.forEach((cs, i) => {
        if (!cs.id || !cs.label || !cs.kind || !Array.isArray(cs.accepts)) {
          issues.push({
            path:    `slotOverrides.custom[${i}]`,
            level:   'error',
            message: `custom slot requiere id, label, kind, accepts[]`,
          });
        }
        if (cs.kind && cs.kind !== 'single' && cs.kind !== 'composable') {
          issues.push({
            path:    `slotOverrides.custom[${i}].kind`,
            level:   'error',
            message: `kind "${cs.kind}" no es válido (esperaba 'single' o 'composable')`,
          });
        }
      });
    }
  }

  const hasErrors = issues.some(i => i.level === 'error');
  return { valid: !hasErrors, issues };
}
