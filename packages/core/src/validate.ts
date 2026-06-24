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

import type { ViewComposition, SlotComposition, SlotAppearance, FieldDefLike, NestedViewComposition, TargetComposition, LayoutContainerNode } from './types';
import { validateLayout } from './layout';
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
  OPTIONS_APPEARANCE_LINE_HEIGHT,
  OPTIONS_APPEARANCE_TRACKING,
  OPTIONS_APPEARANCE_OBJECT_FIT,
  OPTIONS_APPEARANCE_OPACITY,
  OPTIONS_APPEARANCE_SHADOW,
  OPTIONS_APPEARANCE_TEXTSHADOW,
  OPTIONS_APPEARANCE_DISPLAY,
  OPTIONS_APPEARANCE_TEXT_TRANSFORM,
  OPTIONS_COMPOSABLE_DISPLAY,
} from './options';
import { paletteContrastRatio, CONTRAST_AA } from './palette';

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
const FONT_IDS      = new Set(['sans', 'serif']);
// KRO-147 F3
const LINE_HEIGHT_IDS = new Set(OPTIONS_APPEARANCE_LINE_HEIGHT.map(o => o.id));
const TRACKING_IDS    = new Set(OPTIONS_APPEARANCE_TRACKING.map(o => o.id));
const OBJECT_FIT_IDS  = new Set(OPTIONS_APPEARANCE_OBJECT_FIT.map(o => o.id));
const OPACITY_IDS     = new Set(OPTIONS_APPEARANCE_OPACITY.map(o => o.id));
const SHADOW_IDS      = new Set(OPTIONS_APPEARANCE_SHADOW.map(o => o.id));
// KRO-155 / KRO-169 — antes validados con arrays literales inline (verdad
// duplicada). Derivados del catálogo para que no puedan divergir del editor.
const TEXTSHADOW_IDS     = new Set(OPTIONS_APPEARANCE_TEXTSHADOW.map(o => o.id));
const DISPLAY_IDS        = new Set(OPTIONS_APPEARANCE_DISPLAY.map(o => o.id));
const TEXT_TRANSFORM_IDS = new Set(OPTIONS_APPEARANCE_TEXT_TRANSFORM.map(o => o.id));
const COMPOSABLE_DISPLAY_IDS = new Set(OPTIONS_COMPOSABLE_DISPLAY.map(o => o.id));
// KRO-198 — operadores del estilo condicional por valor.
const CONDITIONAL_OP_IDS = new Set(['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'truthy', 'falsy']);

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
  if (appearance.refSize !== undefined && (typeof appearance.refSize !== 'number' || appearance.refSize < 10 || appearance.refSize > 100)) {
    issues.push({ path: `${path}.refSize`, level: 'error', message: `refSize debe ser un número entre 10 y 100` });
  }
  if (appearance.refTap !== undefined && !REF_TAP_IDS.has(appearance.refTap)) {
    issues.push({ path: `${path}.refTap`, level: 'error', message: `refTap "${appearance.refTap}" no es válido` });
  }
  if (appearance.font !== undefined && !FONT_IDS.has(appearance.font)) {
    issues.push({ path: `${path}.font`, level: 'error', message: `font "${appearance.font}" no es válido` });
  }
  if (appearance.display !== undefined && !DISPLAY_IDS.has(appearance.display)) {
    issues.push({ path: `${path}.display`, level: 'error', message: `display "${appearance.display}" no es válido` });
  }
  // KRO-198 — ancho del chip (data, no catálogo del contrato): fill | content.
  if (appearance.chipWidth !== undefined && appearance.chipWidth !== 'fill' && appearance.chipWidth !== 'content') {
    issues.push({ path: `${path}.chipWidth`, level: 'error', message: `chipWidth "${appearance.chipWidth}" no es válido (fill | content)` });
  }
  // textColor/bgColor son ids de paleta o 'field:<key>' (string libre — el
  // render degrada a default si no resuelve). Solo se valida el TIPO.
  if (appearance.textColor !== undefined && (typeof appearance.textColor !== 'string' || appearance.textColor.length === 0)) {
    issues.push({ path: `${path}.textColor`, level: 'error', message: 'textColor debe ser un string no vacío' });
  }
  if (appearance.bgColor !== undefined && (typeof appearance.bgColor !== 'string' || appearance.bgColor.length === 0)) {
    issues.push({ path: `${path}.bgColor`, level: 'error', message: 'bgColor debe ser un string no vacío' });
  }
  if (appearance.textTransform !== undefined && !TEXT_TRANSFORM_IDS.has(appearance.textTransform)) {
    issues.push({ path: `${path}.textTransform`, level: 'error', message: `textTransform "${appearance.textTransform}" no es válido` });
  }
  if (appearance.textShadow !== undefined && !TEXTSHADOW_IDS.has(appearance.textShadow)) {
    issues.push({ path: `${path}.textShadow`, level: 'error', message: `textShadow "${appearance.textShadow}" no es válido` });
  }
  // KRO-147 F3 — tipografía rica + caja/efectos.
  if (appearance.italic !== undefined && typeof appearance.italic !== 'boolean') {
    issues.push({ path: `${path}.italic`, level: 'error', message: 'italic debe ser booleano' });
  }
  if (appearance.underline !== undefined && typeof appearance.underline !== 'boolean') {
    issues.push({ path: `${path}.underline`, level: 'error', message: 'underline debe ser booleano' });
  }
  if (appearance.lineHeight !== undefined && !LINE_HEIGHT_IDS.has(appearance.lineHeight)) {
    issues.push({ path: `${path}.lineHeight`, level: 'error', message: `lineHeight "${appearance.lineHeight}" no es válido` });
  }
  if (appearance.tracking !== undefined && !TRACKING_IDS.has(appearance.tracking)) {
    issues.push({ path: `${path}.tracking`, level: 'error', message: `tracking "${appearance.tracking}" no es válido` });
  }
  if (appearance.objectFit !== undefined && !OBJECT_FIT_IDS.has(appearance.objectFit)) {
    issues.push({ path: `${path}.objectFit`, level: 'error', message: `objectFit "${appearance.objectFit}" no es válido` });
  }
  if (appearance.opacity !== undefined && !OPACITY_IDS.has(appearance.opacity)) {
    issues.push({ path: `${path}.opacity`, level: 'error', message: `opacity "${appearance.opacity}" no es válido` });
  }
  if (appearance.shadow !== undefined && !SHADOW_IDS.has(appearance.shadow)) {
    issues.push({ path: `${path}.shadow`, level: 'error', message: `shadow "${appearance.shadow}" no es válido` });
  }
  if (appearance.imageFocus !== undefined) {
    const f = appearance.imageFocus;
    const pct = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
    const zoomOk = f.zoom === undefined || (typeof f.zoom === 'number' && f.zoom >= 1 && f.zoom <= 3);
    if (!pct(f.x) || !pct(f.y) || !zoomOk) {
      issues.push({ path: `${path}.imageFocus`, level: 'error', message: 'imageFocus: x/y deben ser 0..100 y zoom 1..3' });
    }
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

  // KRO-198 — aviso (no error) de contraste insuficiente texto↔fondo. Solo
  // cuando AMBOS son tonos CRUDOS de la rejilla (paletteContrastRatio devuelve
  // null para tokens de tema / `field:` → no verificable, sin falso aviso). El
  // `warn` no invalida la composición (el cliente renderiza igual): es una
  // señal para el publisher de que la carta puede quedar ilegible.
  if (appearance.textColor !== undefined && appearance.bgColor !== undefined) {
    const ratio = paletteContrastRatio(appearance.textColor, appearance.bgColor);
    if (ratio != null && ratio < CONTRAST_AA) {
      issues.push({
        path:    `${path}.textColor`,
        level:   'warn',
        message: `Contraste texto/fondo bajo (${ratio.toFixed(1)}:1, recomendado ≥${CONTRAST_AA}:1) — el texto puede quedar poco legible`,
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
      // KRO-198 — un slot-CAMPO (id = la clave de SU PROPIO field, fields:[slotId])
      // NO se valida contra el rol homónimo del manifest: su `accepts` real lo
      // define el field (classifyField), no el rol que casualmente comparte id.
      // Sin esto, un campo cuya clave coincide con un id de rol (p.ej. 'title')
      // pero con tipo incompatible bloquearía el guardado de toda la composición.
      const isFieldSlot = slot.fields.length === 1 && slot.fields[0] === slotId;
      if (recipeSlot && !isFieldSlot) {
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

  // KRO-198 — variante de render del composable (meta, como orientation).
  if (slot.composableDisplay !== undefined && !COMPOSABLE_DISPLAY_IDS.has(slot.composableDisplay)) {
    issues.push({
      path:    `${basePath}.composableDisplay`,
      level:   'error',
      message: `composableDisplay "${slot.composableDisplay}" no es válido (esperaba ${[...COMPOSABLE_DISPLAY_IDS].join(' | ')})`,
    });
  }

  // KRO-198 — estilo condicional por valor (meta, como composableDisplay).
  if (slot.conditionalStyle !== undefined && slot.conditionalStyle !== null) {
    const cs = slot.conditionalStyle;
    const csPath = `${basePath}.conditionalStyle`;
    if (typeof cs !== 'object' || Array.isArray(cs)) {
      issues.push({ path: csPath, level: 'error', message: 'conditionalStyle no es un objeto' });
    } else {
      if (!cs.fieldKey || typeof cs.fieldKey !== 'string' || !cs.fieldKey.trim()) {
        issues.push({ path: `${csPath}.fieldKey`, level: 'error', message: 'conditionalStyle.fieldKey vacío o no string' });
      }
      if (!Array.isArray(cs.cases) || cs.cases.length === 0) {
        issues.push({ path: `${csPath}.cases`, level: 'error', message: 'conditionalStyle.cases debe ser un array no vacío' });
      } else {
        cs.cases.forEach((c, i) => {
          const cp = `${csPath}.cases[${i}]`;
          if (c.op !== undefined && !CONDITIONAL_OP_IDS.has(c.op)) {
            issues.push({ path: `${cp}.op`, level: 'error', message: `op "${c.op}" no es válido (esperaba ${[...CONDITIONAL_OP_IDS].join(' | ')})` });
          }
          if (c.value !== undefined && typeof c.value !== 'string') {
            issues.push({ path: `${cp}.value`, level: 'error', message: 'value debe ser string' });
          }
          // La appearance de cada caso se valida igual que la base (incluye el
          // aviso de contraste).
          validateAppearance(c.appearance, `${cp}.appearance`, issues);
        });
      }
      // KRO-198 — la cláusula ELSE (otherwise) valida su appearance igual que un caso
      // (mismo aviso de contraste). `op`/`value` se ignoran en el else, no se validan.
      if (cs.otherwise && typeof cs.otherwise === 'object' && !Array.isArray(cs.otherwise)) {
        validateAppearance(cs.otherwise.appearance, `${csPath}.otherwise.appearance`, issues);
      }
    }
  }

  // KRO-198 — rejilla 2D de chips (meta de composición, como composableDisplay).
  if (slot.chipGrid !== undefined && slot.chipGrid !== null) {
    const g = slot.chipGrid;
    const gp = `${basePath}.chipGrid`;
    if (typeof g !== 'object' || Array.isArray(g)) {
      issues.push({ path: gp, level: 'error', message: 'chipGrid no es un objeto' });
    } else if (!Number.isInteger(g.columns) || g.columns < 1 || g.columns > 6) {
      issues.push({ path: `${gp}.columns`, level: 'error', message: 'chipGrid.columns debe ser un entero entre 1 y 6' });
    }
  }
  // KRO-198 — placements por chip (key del field → GridPlacement). Cada celda 1-based.
  if (slot.chipPlacements !== undefined && slot.chipPlacements !== null) {
    const cp = slot.chipPlacements;
    const cpPath = `${basePath}.chipPlacements`;
    if (typeof cp !== 'object' || Array.isArray(cp)) {
      issues.push({ path: cpPath, level: 'error', message: 'chipPlacements no es un objeto' });
    } else {
      for (const [key, place] of Object.entries(cp)) {
        if (!slot.fields.includes(key)) {
          issues.push({ path: `${cpPath}.${key}`, level: 'warn', message: `chipPlacements referencia "${key}", que no es un field del slot` });
        }
        for (const prop of ['colStart', 'colSpan', 'rowStart', 'rowSpan'] as const) {
          const v = (place as Record<string, unknown>)?.[prop];
          if (v !== undefined && (!Number.isInteger(v) || (v as number) < 1)) {
            issues.push({ path: `${cpPath}.${key}.${prop}`, level: 'error', message: `${prop} debe ser un entero ≥ 1 (1-based)` });
          }
        }
      }
    }
  }

  // KRO-80 — nestedComposition con depth max=2.
  if (slot.nestedComposition !== undefined && slot.nestedComposition !== null) {
    validateNested(slot.nestedComposition, `${basePath}.nestedComposition`, issues);
  }
}

/**
 * KRO-164 — Valida el árbol de BLOQUES (`layout`) de una composition con
 * `validateLayout` y vuelca sus issues con el prefijo de path dado. Antes el
 * layout se persistía SIN pasar por el gate (validateComposition lo ignoraba):
 * árboles corruptos —slot duplicado, componente desconocido, hoja colgante—
 * llegaban a BD en silencio. El backend (thin wrapper de KRO-80) hereda esta
 * regla gratis → paridad cliente↔server también para el modo bloques.
 */
function validateCompositionLayout(
  layout: LayoutContainerNode | undefined,
  slots:  Record<string, SlotComposition> | undefined,
  path:   string,
  issues: ValidationIssue[],
): void {
  if (!layout) return;
  const res = validateLayout(layout, { slots: slots ?? {} });
  for (const iss of res.issues) {
    issues.push({ path: `${path}.${iss.path}`, level: iss.level, message: iss.message });
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

  // KRO-164 — el detalle tambien puede llevar diseño por bloques.
  validateCompositionLayout(node.layout, node.slots, `${path}.layout`, issues);

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

  // ── 3c. LAYOUT (diseño por bloques) — KRO-164 ─────────────────────
  validateCompositionLayout(composition.layout, composition.slots, 'layout', issues);

  // ── 4. accentPosition (top-level) ─────────────────────────────────
  if (composition.accentPosition !== undefined && !ACCENT_IDS.has(composition.accentPosition)) {
    issues.push({
      path:    'accentPosition',
      level:   'error',
      message: `accentPosition "${composition.accentPosition}" no es válido`,
    });
  }
  // KRO-198 — accentStyle (data, no catálogo del contrato): bar | rounded | glow | gradient.
  if (
    composition.accentStyle !== undefined &&
    !['bar', 'rounded', 'glow', 'gradient', 'ambient'].includes(composition.accentStyle)
  ) {
    issues.push({
      path:    'accentStyle',
      level:   'error',
      message: `accentStyle "${composition.accentStyle}" no es válido (bar | rounded | glow | gradient | ambient)`,
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
