/**
 * KRO-84 — helpers puros del behavior `incremental` para AUTO-ASIGNACIÓN y
 * DETECCIÓN DE DUPLICADOS.
 *
 * Viven en `@kromia/core` para que Studio (editor) y el futuro `@kromia/flutter`
 * compartan exactamente la misma lógica (anti-drift, pattern KRO-75/76/78). El
 * formateo visible (pad/prefix/suffix) está en `format-scalar.ts`.
 *
 * **Ground truth cross-language**: un port Dart debe producir los mismos
 * resultados para las mismas entradas. Los tests en `tests/incremental.test.ts`
 * son la spec.
 */

/**
 * Convierte a entero finito, o null si no es un número "real".
 *
 * OJO: ignoramos null/undefined/'' explícitamente porque `Number(null)` y
 * `Number('')` dan `0` (no NaN) — un valor vacío NO es el dorsal 0.
 */
function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Siguiente valor sugerido para un campo `incremental`: `max(existentes) + 1`.
 * Ignora valores no numéricos / vacíos. Si no hay ninguno válido → `1`.
 *
 * El publisher puede sobrescribirlo (saltar números: dorsales 1-11 + 22
 * retirado). Es solo el DEFAULT al crear un cromo/entry nuevo.
 *
 * @example
 *   nextIncrementalValue([])         // 1
 *   nextIncrementalValue([3, 7, 5])  // 8
 *   nextIncrementalValue([0])        // 1
 *   nextIncrementalValue(['x', 4])   // 5  (ignora no-numéricos)
 */
export function nextIncrementalValue(existing: ReadonlyArray<unknown>): number {
  let max: number | null = null;
  for (const v of existing) {
    const n = toInt(v);
    if (n === null) continue;
    if (max === null || n > max) max = n;
  }
  return (max ?? 0) + 1;
}

/**
 * Valores DUPLICADOS dentro de una lista de un campo `incremental`. Útil para
 * avisar "el dorsal 22 ya está usado por otro cromo". Devuelve cada valor
 * repetido UNA vez, ordenado ascendente. Vacío si no hay duplicados.
 *
 * Ignora valores no numéricos / vacíos (no son "el mismo dorsal").
 *
 * @example
 *   findDuplicateIncrementalValues([1, 2, 3])        // []
 *   findDuplicateIncrementalValues([1, 2, 2, 3, 3])  // [2, 3]
 *   findDuplicateIncrementalValues([7, '7'])         // [7]  (coerción)
 */
export function findDuplicateIncrementalValues(values: ReadonlyArray<unknown>): number[] {
  const seen = new Set<number>();
  const dups = new Set<number>();
  for (const v of values) {
    const n = toInt(v);
    if (n === null) continue;
    if (seen.has(n)) dups.add(n);
    else seen.add(n);
  }
  return [...dups].sort((a, b) => a - b);
}
