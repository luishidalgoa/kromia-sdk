/**
 * KRO-216 (mitad de COMPOSICIÓN, sin depender de la imprenta) — componer una
 * TIRADA de cartas físicas por SOBRES, respetando los pesos de rareza (KRO-28).
 *
 * Es matemática pura y DETERMINISTA (seed → misma tirada, auditable): dado el
 * `RaritySource` (pesos por valor), las cartas con su rareza, y la composición
 * de UN sobre (slots por rareza fija o "aleatoria por pesos"), reparte qué carta
 * cae en cada hueco de cada sobre. El resultado alimenta:
 *   - el MINTEO (conteo por carta → `POST /cards/mint`), y
 *   - el DATASET de la tirada (lo que consumiría un flujo VDP de imprenta).
 *
 * El export listo-para-imprenta (formato VDP/PDF-X) sigue siendo research abierto
 * (KRO-216 §8); esto es solo la composición.
 */

import { rarityBucketForValue, normalizeRarityWeights } from './rarity';
import type { RaritySource, RarityBucket } from './types';

/** Un hueco del sobre: rareza fija (valor de bucket) o aleatoria por pesos. */
export interface TiradaSlot {
  /** Valor exacto del bucket (enum) que debe salir en este hueco. */
  rarity?:   string;
  /** Si true (y sin `rarity`), rola la rareza por los pesos de `RaritySource`. */
  weighted?: boolean;
}

/** Composición de la tirada: cuántos sobres y qué lleva cada uno. */
export interface TiradaSpec {
  packs: number;
  slots: TiradaSlot[];
  /** Semilla reproducible/auditable. Ausente ⇒ 1 (determinista). */
  seed?: number;
}

/** KRO-216 — estado de una tirada en su ciclo de vida.
 *  `minted` = compuesta + identidades minteadas (existen, sin dueño, sin repartir).
 *  `distributed` = impresa y repartida → CONGELADA (los QR están en la calle).
 *  `void` = anulada (prueba/error) → sus identidades se purgan. */
export type TiradaStatus = 'minted' | 'distributed' | 'void';

/** KRO-216 — una TIRADA PERSISTIDA: un lote de sobres ya minteado. Es la DUEÑA de
 *  sus identidades físicas (`CardIdentity.tiradaId`). Agrupar + estado hacen el
 *  minteo production-safe: los previews (composición) NO persisten, lo distribuido
 *  se congela y lo `void` se purga → "no repetir QR distribuido". DATA (no entra al
 *  `.json` del KRP; igual que `CardIdentity`). */
export interface Tirada {
  id:         string;
  albumId:    string;
  /** Edición/serie opcional, p.ej. "Serie 1". */
  edition?:   string;
  seed:       number;
  slots:      TiradaSlot[];
  packs:      number;
  /** Total de cartas (identidades) minteadas en esta tirada. */
  count:      number;
  status:     TiradaStatus;
  /** userId del creador. */
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Una carta minteada asignada a un hueco de un sobre. */
export interface TiradaAllocation {
  pack:      number;            // 1-based
  slot:      number;            // 0-based dentro del sobre
  cardIndex: string | number;
  rarity?:   string;            // valor de bucket que salió
}

export interface TiradaResult {
  allocations: TiradaAllocation[];
  /** Conteo por carta (para mintear en lote). */
  perCard:   { cardIndex: string | number; count: number }[];
  /** Conteo por rareza (para el resumen + %). */
  perRarity: { rarity: string; count: number }[];
  total:     number;
  warnings:  string[];
}

/** Carta de entrada: su índice (PK) + su valor de rareza (del field fuente). */
export interface TiradaCard {
  index:   string | number;
  rarity?: string | number;
}

/** PRNG determinista (mulberry32) — seed → secuencia reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clave estable de un bucket (valor enum o etiqueta de rango). */
function bucketKey(b: RarityBucket): string {
  return b.value ?? (b.range ? `${b.range[0]}-${b.range[1]}` : '?');
}

/**
 * Compone la tirada. PURA + determinista por `seed`. Si un hueco pide una rareza
 * sin cartas, se rellena con cualquier carta y se avisa (no se rompe la tirada).
 */
export function composeTirada(
  raritySource: RaritySource | undefined,
  cards:        TiradaCard[],
  spec:         TiradaSpec,
): TiradaResult {
  const warnings: string[] = [];
  const rng = mulberry32(spec.seed ?? 1);
  const buckets = normalizeRarityWeights(raritySource?.buckets ?? []);

  // Agrupa cartas por su bucket de rareza.
  const cardsByBucket = new Map<string, (string | number)[]>();
  for (const c of cards) {
    const bucket = c.rarity !== undefined ? rarityBucketForValue(c.rarity, buckets) : undefined;
    const key = bucket ? bucketKey(bucket) : '__none__';
    if (!cardsByBucket.has(key)) cardsByBucket.set(key, []);
    cardsByBucket.get(key)!.push(c.index);
  }
  const allIndexes = cards.map(c => c.index);

  const pick = <T,>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(rng() * arr.length)] : undefined);
  const rollBucket = (): RarityBucket | undefined => {
    if (buckets.length === 0) return undefined;
    const r = rng() * 100;
    let acc = 0;
    for (const b of buckets) { acc += b.weight; if (r <= acc) return b; }
    return buckets[buckets.length - 1];
  };

  const allocations: TiradaAllocation[] = [];
  const missing = new Set<string>();

  for (let p = 1; p <= Math.max(0, spec.packs); p++) {
    spec.slots.forEach((slot, si) => {
      const bucket = slot.rarity !== undefined
        ? buckets.find(b => bucketKey(b) === slot.rarity || b.value === slot.rarity)
        : (slot.weighted ? rollBucket() : undefined);
      const key = bucket ? bucketKey(bucket) : '__none__';
      const pool = cardsByBucket.get(key) ?? [];
      const chosen = pool.length ? pick(pool) : (missing.add(slot.rarity ?? key), pick(allIndexes));
      if (chosen === undefined) return; // no hay cartas en absoluto
      allocations.push({ pack: p, slot: si, cardIndex: chosen, rarity: bucket?.value });
    });
  }
  for (const k of missing) warnings.push(`No hay cartas de rareza "${k}" — el hueco se rellenó con cualquier carta.`);

  // Agregados.
  const perCardMap = new Map<string, { cardIndex: string | number; count: number }>();
  const perRarityMap = new Map<string, number>();
  for (const a of allocations) {
    const ck = String(a.cardIndex);
    const pc = perCardMap.get(ck) ?? { cardIndex: a.cardIndex, count: 0 };
    pc.count++; perCardMap.set(ck, pc);
    const rk = a.rarity ?? '—';
    perRarityMap.set(rk, (perRarityMap.get(rk) ?? 0) + 1);
  }

  return {
    allocations,
    perCard:   [...perCardMap.values()],
    perRarity: [...perRarityMap.entries()].map(([rarity, count]) => ({ rarity, count })),
    total:     allocations.length,
    warnings,
  };
}
