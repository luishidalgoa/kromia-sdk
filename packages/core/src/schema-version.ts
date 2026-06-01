/**
 * `schema-version.ts` — KRO-115.
 *
 * Un schema (CardSchema/AlbumSchema) se ESTAMPA al crearse con el
 * `PROTOCOL_VERSION` del core de ese momento (campo `coreVersion`). Esto
 * permite, en el futuro, saber si un schema (o un álbum que lo referencia)
 * está **desactualizado** respecto al core actual y necesita revisión.
 *
 * Eje NUEVO, distinto del `version` del propio schema (KROM-23, que cuenta sus
 * ediciones). Aquí comparamos contra qué versión del CORE se construyó.
 */

/** Extrae el MAJOR de un SemVer (`"2.5.1"` → 2). Tolera `"2"`. */
function majorOf(v: string | null | undefined): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+)/.exec(v.trim());
  return m ? Number(m[1]) : null;
}

/**
 * ¿El schema estampado con `stamped` está DESACTUALIZADO frente al core
 * actual (`current`, típicamente `PROTOCOL_VERSION`)?
 *
 * Solo un bump **MAJOR** del core implica cambios breaking (recetas/behaviors
 * eliminados o con shape cambiado — ver `version-bump.ts`); minor/patch son
 * backward-compatible. Por eso "desactualizado" = el MAJOR estampado es MENOR
 * que el actual.
 *
 *  - `stamped` ausente/null/no-parseable → `false` (legacy/desconocido: no lo
 *    marcamos, no sabemos contra qué core se hizo).
 *  - `stamped` major `>=` `current` major → `false` (al día, o más nuevo).
 *  - `stamped` major `<`  `current` major → `true` (necesita revisión).
 *
 * Pura: sin side effects, determinista. Espejo trivial en Dart (paridad Flutter).
 */
export function isSchemaOutdated(
  stamped: string | null | undefined,
  current: string,
): boolean {
  const sMajor = majorOf(stamped);
  const cMajor = majorOf(current);
  if (sMajor === null || cMajor === null) return false;
  return sMajor < cMajor;
}
