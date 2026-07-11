/**
 * KRO-222 / KRO-223 — Título visible de una carta (heurística PURA, movida a
 * @kromia/core: fuente única cross-platform; antes vivía solo en Studio
 * `card-view-data.ts` → Flutter reimplementaba la prioridad a mano = drift).
 *
 * El backend persiste y sirve `cardTitleKey` en el CardSchema (combined schema);
 * ambos hosts (Studio + Flutter) resuelven el título con ESTA misma prioridad.
 */

import type { FieldDefLike } from './types';

/** Lectura dot-notation — las claves pueden ser anidadas (p.ej. `images.standard`). */
function getRaw(card: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (v, p) => (v == null ? undefined : (v as Record<string, unknown>)[p]),
    card,
  );
}

/**
 * Título de la carta. Prioridad:
 *  1. campo de TÍTULO explícito (`cardTitleKey`, lo elige el publisher),
 *  2. primer campo de TEXTO legible (type `text`, sin behavior url/email/phone),
 *  3. la primary key (`cardPrimaryKey`),
 *  4. `'Carta'` (fallback).
 *
 * Antes la PK ganaba sobre el texto (ponía el número como título); desde KRO-222
 * el publisher elige el campo, y el fallback prefiere un texto, no la PK. Devuelve
 * el VALOR del campo elegido en la carta (o `'Carta'` si no hay valor).
 */
export function resolveCardTitle(
  card:           Record<string, unknown>,
  fields:         ReadonlyArray<FieldDefLike>,
  cardTitleKey?:  string,
  cardPrimaryKey?: string,
): string {
  const legibleText = (f: FieldDefLike) =>
    f.type === 'text' && !['url', 'email', 'phone'].includes(f.behavior ?? '');
  const titleField =
    (cardTitleKey ? fields.find(f => f.key === cardTitleKey) : undefined)
    ?? fields.find(legibleText)
    ?? (cardPrimaryKey ? fields.find(f => f.key === cardPrimaryKey) : undefined);
  const rawTitle = titleField ? getRaw(card, titleField.key) : undefined;
  return (rawTitle !== undefined && rawTitle !== null && rawTitle !== '')
    ? String(rawTitle)
    : 'Carta';
}
