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
  const clave = resolveCardTitleKey(fields, cardTitleKey, cardPrimaryKey);
  const rawTitle = clave ? getRaw(card, clave) : undefined;
  return (rawTitle !== undefined && rawTitle !== null && rawTitle !== '')
    ? String(rawTitle)
    : 'Carta';
}

/**
 * La CLAVE del campo que titula la carta — la misma elección que hace
 * `resolveCardTitle`, sin mirar los datos. `undefined` si no hay candidato.
 *
 * ## Para qué hace falta, además del valor
 *
 * Para poder OCULTAR ese campo del cuerpo del detalle. Quien pinta la ficha
 * necesita saber cuál es la fila que ya está arriba: sin esto se lee «Ignis» en
 * la cabecera y «Nombre: Ignis» otra vez debajo. Lo pidió el chat de Mobile al
 * auditar su lado (KRO-223), y la alternativa —deducir la clave en la app—
 * sería la TERCERA copia de esta prioridad (TS, `core_dart`, la app), que es
 * exactamente el drift que esta función vino a cerrar.
 *
 * ## Es estructural a propósito
 *
 * Contesta «qué campo titula esta sección», no «qué pone en esta carta»: por eso
 * no recibe la carta. Si dependiera del valor, dos cartas de la misma sección
 * ocultarían campos distintos y el detalle cambiaría de forma según cuál abras.
 */
export function resolveCardTitleKey(
  fields:          ReadonlyArray<FieldDefLike>,
  cardTitleKey?:   string,
  cardPrimaryKey?: string,
): string | undefined {
  const legibleText = (f: FieldDefLike) =>
    f.type === 'text' && !['url', 'email', 'phone'].includes(f.behavior ?? '');
  const titleField =
    // La elección explícita solo vale si el campo EXISTE. Una clave inválida se
    // comporta como no haber elegido — mismo criterio que el backend al servirla.
    (cardTitleKey ? fields.find(f => f.key === cardTitleKey) : undefined)
    ?? fields.find(legibleText)
    ?? (cardPrimaryKey ? fields.find(f => f.key === cardPrimaryKey) : undefined);
  return titleField?.key;
}
