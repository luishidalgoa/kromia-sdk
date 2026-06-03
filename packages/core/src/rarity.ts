/**
 * `rarity.ts` — KRO-28. Fuente de rareza: validación + helpers puros.
 *
 * Un field `rating`/`enum`/`ordinal_enum` del cardSchema puede marcarse como
 * "fuente de rareza" (`cardSchema.raritySource`) con una distribución de pesos
 * por valor (enum) o por rango (rating). La app cliente reparte cartas
 * respetando esos pesos.
 *
 * Pure: sin side effects, sin random (el reparto ponderado real lo hace el
 * cliente). Aquí solo validamos el shape + helpers deterministas (a qué bucket
 * pertenece un valor, normalizar pesos).
 */
import type { RaritySource, RarityBucket, FieldDefLike } from './types';

/** Behaviors elegibles como fuente de rareza. */
const RARITY_BEHAVIORS = new Set(['rating', 'enum', 'ordinal_enum']);

/** ¿El field puede marcarse como fuente de rareza? (rating/enum/ordinal_enum) */
export function isFieldEligibleForRarity(field: Pick<FieldDefLike, 'behavior'>): boolean {
  return RARITY_BEHAVIORS.has(field.behavior ?? '');
}

// ─────────────────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────────────────

export interface RarityValidationIssue {
  /** Path JSON-style (e.g. `raritySource.buckets[1].weight`). */
  path:    string;
  message: string;
  level:   'error' | 'warn';
}

export interface RarityValidationResult {
  valid:  boolean;
  issues: RarityValidationIssue[];
}

/**
 * Valida una `RaritySource` contra los fieldDefs del cardSchema. Devuelve issues
 * (error = inaplicable; warn = aplicable con ajuste, p.ej. pesos que no suman 100
 * → se normalizan). `raritySource` undefined/null → válido.
 */
export function validateRaritySource(
  rs: RaritySource | undefined | null,
  fieldDefs: FieldDefLike[],
): RarityValidationResult {
  const issues: RarityValidationIssue[] = [];
  if (!rs) return { valid: true, issues };

  // 1) field existe + es elegible.
  const field = fieldDefs.find(f => f.key === rs.fieldKey);
  if (!field) {
    issues.push({ path: 'raritySource.fieldKey', level: 'error', message: `el field "${rs.fieldKey}" no existe en el schema` });
  } else if (!isFieldEligibleForRarity(field)) {
    issues.push({ path: 'raritySource.fieldKey', level: 'error', message: `el field "${rs.fieldKey}" no es elegible (requiere behavior rating/enum/ordinal_enum)` });
  }

  // 2) buckets no vacíos.
  const buckets = rs.buckets ?? [];
  if (buckets.length === 0) {
    issues.push({ path: 'raritySource.buckets', level: 'error', message: 'la fuente de rareza no tiene buckets' });
  }

  const isRating = field?.behavior === 'rating';
  const options  = field?.options ?? [];

  buckets.forEach((b, i) => {
    const hasValue = b.value !== undefined;
    const hasRange = b.range !== undefined;
    const at = `raritySource.buckets[${i}]`;

    // 3) exactamente uno de value|range.
    if (hasValue === hasRange) {
      issues.push({ path: at, level: 'error', message: 'cada bucket debe declarar exactamente uno: value (enum) o range (rating)' });
    }

    // 4) shape acorde al behavior del field.
    if (isRating && hasValue) {
      issues.push({ path: `${at}.value`, level: 'warn', message: 'el field es rating → usa range, no value' });
    }
    if (!isRating && hasRange) {
      issues.push({ path: `${at}.range`, level: 'warn', message: 'el field es enum → usa value, no range' });
    }

    // 5) range coherente.
    if (hasRange) {
      const [min, max] = b.range!;
      if (typeof min !== 'number' || typeof max !== 'number' || Number.isNaN(min) || Number.isNaN(max)) {
        issues.push({ path: `${at}.range`, level: 'error', message: 'range debe ser [number, number]' });
      } else if (min > max) {
        issues.push({ path: `${at}.range`, level: 'error', message: `range inválido: min ${min} > max ${max}` });
      }
    }

    // 6) value dentro de las options del field (si las hay).
    if (hasValue && options.length > 0 && !options.includes(b.value!)) {
      issues.push({ path: `${at}.value`, level: 'warn', message: `el valor "${b.value}" no está en las options del field` });
    }

    // 7) weight numérico >= 0.
    if (typeof b.weight !== 'number' || Number.isNaN(b.weight) || b.weight < 0) {
      issues.push({ path: `${at}.weight`, level: 'error', message: 'weight debe ser un número >= 0' });
    }
  });

  // 8) pesos suman ~100 → warn (se normalizan al repartir).
  const total = buckets.reduce((s, b) => s + (typeof b.weight === 'number' && b.weight >= 0 ? b.weight : 0), 0);
  if (buckets.length > 0 && Math.abs(total - 100) > 0.01) {
    issues.push({ path: 'raritySource.buckets', level: 'warn', message: `los pesos suman ${total} (no 100); se normalizarán al repartir` });
  }

  return { valid: !issues.some(it => it.level === 'error'), issues };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers deterministas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el bucket al que pertenece un valor de carta: por igualdad (enum) o
 * por rango inclusivo (rating). `undefined` si ninguno aplica. El primer match
 * gana (el orden de buckets lo controla el publisher).
 */
export function rarityBucketForValue(
  value: string | number,
  buckets: RarityBucket[],
): RarityBucket | undefined {
  for (const b of buckets) {
    if (b.value !== undefined) {
      if (String(value) === b.value) return b;
    } else if (b.range) {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(n) && n >= b.range[0] && n <= b.range[1]) return b;
    }
  }
  return undefined;
}

/**
 * Normaliza los pesos para que sumen 100, preservando proporciones. Si todos los
 * pesos son 0 (o no hay), reparte equitativamente. Pure: devuelve buckets nuevos.
 */
export function normalizeRarityWeights(buckets: RarityBucket[]): RarityBucket[] {
  if (buckets.length === 0) return [];
  const total = buckets.reduce((s, b) => s + (b.weight > 0 ? b.weight : 0), 0);
  if (total <= 0) {
    const equal = 100 / buckets.length;
    return buckets.map(b => ({ ...b, weight: equal }));
  }
  return buckets.map(b => ({ ...b, weight: (Math.max(0, b.weight) / total) * 100 }));
}
