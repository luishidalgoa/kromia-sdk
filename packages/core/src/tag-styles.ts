/**
 * `tag-styles.ts` — KRO-30. Validador puro de `TagStyle[]` contra el catálogo
 * de efectos visuales (`visual-effects.ts`).
 *
 * Dado uno o varios `TagStyle`, comprueba que:
 *  - `value` es un string no vacío.
 *  - `effect` existe en el registry de efectos visuales.
 *  - cada key de `config` pertenece a los params declarados por ese efecto.
 *  - cada valor de `config` cae dentro del espacio válido del param
 *    (enum → en `options`; number → dentro de `min`/`max`; string → string).
 *  - los params `optional: false` están presentes.
 *
 * Útil para:
 *  - Studio: el mini-editor de estilos de tag no deja guardar efectos/config inválidos.
 *  - Backend: validar antes de persistir `albumSchema.tagStyles`.
 *  - Flutter (KRO-65/83): ignorar/avisar tagStyles que no puede renderizar.
 *
 * Pure: sin side effects, sin I/O. Mismas entradas → mismas issues.
 */

import type { TagStyle } from './types';
import { getVisualEffect } from './registries/visual-effects';

// ─────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────

export interface TagStyleValidationIssue {
  /** Índice del TagStyle en el array validado (-1 si se validó uno suelto). */
  index:   number;
  /** Path JSON-style al campo que falló (e.g. `tagStyles[0].config.intensity`). */
  path:    string;
  /** Mensaje legible en español. */
  message: string;
  /** Severity: error = no aplicable; warn = aplicable con fallback. */
  level:   'error' | 'warn';
}

export interface TagStyleValidationResult {
  /** True si no hay issues `error`. Warnings no invalidan. */
  valid:  boolean;
  /** Todos los issues encontrados (errors + warnings). */
  issues: TagStyleValidationIssue[];
}

// ─────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valida UN `TagStyle` y empuja issues a `issues` (con el `index` y `prefix`
 * dados). Reutilizado por `validateTagStyles` y por `isTagStyleValid`.
 */
function collectTagStyleIssues(
  ts:     TagStyle,
  index:  number,
  prefix: string,
  issues: TagStyleValidationIssue[],
): void {
  // 1. value no vacío.
  if (typeof ts.value !== 'string' || ts.value.trim() === '') {
    issues.push({ index, path: `${prefix}.value`, level: 'error', message: 'el valor de la tag no puede estar vacío' });
  }

  // KRO-122 — Foil PERSONALIZADO: no es un efecto de catálogo, sino capas
  // propias. Se valida que haya al menos una capa y que cada una tenga textura.
  if (ts.effect === 'custom_foil' || (ts.customLayers && ts.customLayers.length > 0)) {
    const layers = ts.customLayers ?? [];
    if (layers.length === 0) {
      issues.push({ index, path: `${prefix}.customLayers`, level: 'error', message: 'el foil personalizado necesita al menos una capa' });
    }
    layers.forEach((l, li) => {
      if (typeof l.textureUrl !== 'string' || l.textureUrl.trim() === '') {
        issues.push({ index, path: `${prefix}.customLayers[${li}].textureUrl`, level: 'error', message: 'la capa de foil necesita una textura (URL)' });
      }
    });
    return;
  }

  // 2. effect existe en el catálogo.
  const effect = getVisualEffect(ts.effect);
  if (!effect) {
    issues.push({ index, path: `${prefix}.effect`, level: 'error', message: `el efecto "${ts.effect}" no existe en el catálogo de efectos visuales` });
    return; // sin definición del efecto no podemos validar config.
  }

  const params   = effect.config;
  const paramById = new Map(params.map(p => [p.key, p]));
  const config    = ts.config ?? {};

  // 3. cada key de config pertenece al efecto.
  for (const key of Object.keys(config)) {
    const param = paramById.get(key);
    if (!param) {
      issues.push({ index, path: `${prefix}.config.${key}`, level: 'error', message: `"${key}" no es una opción de config del efecto "${ts.effect}"` });
      continue;
    }
    const value = config[key];
    validateConfigValue(param, value, index, `${prefix}.config.${key}`, issues);
  }

  // 4. params requeridos presentes.
  for (const param of params) {
    if (param.optional === false && !(param.key in config)) {
      issues.push({ index, path: `${prefix}.config.${param.key}`, level: 'error', message: `el efecto "${ts.effect}" requiere config "${param.key}"` });
    }
  }
}

function validateConfigValue(
  param:  { key: string; type: 'enum' | 'number' | 'string'; options?: string[]; min?: number; max?: number },
  value:  unknown,
  index:  number,
  path:   string,
  issues: TagStyleValidationIssue[],
): void {
  switch (param.type) {
    case 'enum': {
      if (typeof value !== 'string' || !(param.options ?? []).includes(value)) {
        issues.push({ index, path, level: 'error', message: `valor "${String(value)}" inválido (admitidos: ${(param.options ?? []).join(', ')})` });
      }
      break;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        issues.push({ index, path, level: 'error', message: `valor "${String(value)}" no es un número` });
        break;
      }
      if (param.min !== undefined && value < param.min) {
        issues.push({ index, path, level: 'error', message: `${value} < mínimo ${param.min}` });
      }
      if (param.max !== undefined && value > param.max) {
        issues.push({ index, path, level: 'error', message: `${value} > máximo ${param.max}` });
      }
      break;
    }
    case 'string': {
      if (typeof value !== 'string') {
        issues.push({ index, path, level: 'error', message: `valor "${String(value)}" no es un string` });
      }
      break;
    }
  }
}

/**
 * Valida un `TagStyle` suelto. `true` si no tiene issues `error`.
 */
export function isTagStyleValid(ts: TagStyle): boolean {
  const issues: TagStyleValidationIssue[] = [];
  collectTagStyleIssues(ts, -1, 'tagStyle', issues);
  return !issues.some(i => i.level === 'error');
}

/**
 * Valida un array de `TagStyle` (el `albumSchema.tagStyles` completo).
 * Además de validar cada entry, avisa (`warn`) de valores de tag duplicados
 * (dos estilos para el mismo `value` → ambigüedad de cuál aplicar).
 */
export function validateTagStyles(tagStyles: TagStyle[]): TagStyleValidationResult {
  const issues: TagStyleValidationIssue[] = [];

  tagStyles.forEach((ts, index) => {
    collectTagStyleIssues(ts, index, `tagStyles[${index}]`, issues);
  });

  // Duplicados por `value` → warn (no bloquea, pero el render elegiría el primero).
  const seen = new Map<string, number>();
  tagStyles.forEach((ts, index) => {
    if (typeof ts.value !== 'string' || ts.value.trim() === '') return;
    const prev = seen.get(ts.value);
    if (prev !== undefined) {
      issues.push({ index, path: `tagStyles[${index}].value`, level: 'warn', message: `valor de tag "${ts.value}" duplicado (ya definido en tagStyles[${prev}]); se aplicaría el primero` });
    } else {
      seen.set(ts.value, index);
    }
  });

  return { valid: !issues.some(i => i.level === 'error'), issues };
}
