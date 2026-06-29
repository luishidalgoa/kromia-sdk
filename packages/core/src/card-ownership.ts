/**
 * KRO-215 — Cartas físicas: helpers PUROS de propiedad.
 *
 * Tronco SDK-first (espejo `core_dart`). Solo derivaciones puras sobre el modelo
 * de `types.ts`; el minteo, la firma y la persistencia viven en el backend.
 * Spec: docs/physical-cards-foundation-spec.md (§4).
 */
import type { CardOwnership } from './types';

/**
 * Verificada vs Declarada — el "nivel de confianza" visible de una carta.
 *
 *   - `verified`: propiedad PROBADA — `source==='qr'` y la identidad validó la firma.
 *   - `declared`: el coleccionista la marcó (manual / código / foto). NO es anti-fraude.
 *
 * Honestidad de producto: el badge hace explícito que "declarada" no es prueba.
 */
export function ownershipBadge(o: CardOwnership): 'verified' | 'declared' {
  return o.source === 'qr' && o.verified ? 'verified' : 'declared';
}

/** ¿La propiedad está verificada por QR (no solo declarada)? Azúcar sobre `ownershipBadge`. */
export function isVerifiedOwnership(o: CardOwnership): boolean {
  return ownershipBadge(o) === 'verified';
}
