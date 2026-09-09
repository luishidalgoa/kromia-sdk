import { describe, it, expect } from 'vitest';
import { resolveCardTitle, resolveCardTitleKey } from '../src/card-title';
import type { FieldDefLike } from '../src/types';

const FIELDS: FieldDefLike[] = [
  { key: 'numero', type: 'number', behavior: 'incremental' },
  { key: 'nombre', type: 'text' },
  { key: 'web',    type: 'text', behavior: 'url' },
];

describe('resolveCardTitle — título visible de carta (KRO-222/223)', () => {
  it('1) cardTitleKey explícito manda', () => {
    expect(resolveCardTitle({ numero: 6, nombre: 'Ignis' }, FIELDS, 'nombre', 'numero')).toBe('Ignis');
  });

  it('2) sin cardTitleKey → primer texto legible (no la PK)', () => {
    expect(resolveCardTitle({ numero: 6, nombre: 'Ignis' }, FIELDS, undefined, 'numero')).toBe('Ignis');
  });

  it('el texto legible ignora url/email/phone', () => {
    const only = [{ key: 'web', type: 'text', behavior: 'url' }, { key: 'n', type: 'number' }];
    // sin texto legible ni PK → 'Carta'
    expect(resolveCardTitle({ web: 'x', n: 3 }, only)).toBe('Carta');
  });

  it('3) fallback a la primary key si no hay texto legible', () => {
    const nums = [{ key: 'numero', type: 'number' }];
    expect(resolveCardTitle({ numero: 6 }, nums, undefined, 'numero')).toBe('6');
  });

  it('4) fallback final "Carta" si el campo elegido no tiene valor', () => {
    expect(resolveCardTitle({ numero: 6 }, FIELDS, 'nombre', 'numero')).toBe('Carta');
  });

  it('cardTitleKey inexistente → cae a texto legible', () => {
    expect(resolveCardTitle({ numero: 6, nombre: 'Ignis' }, FIELDS, 'noexiste', 'numero')).toBe('Ignis');
  });

  it('lee claves dot-notation anidadas', () => {
    const f = [{ key: 'meta.title', type: 'text' }];
    expect(resolveCardTitle({ meta: { title: 'Anidado' } }, f, 'meta.title')).toBe('Anidado');
  });
});

/**
 * KRO-223 — la CLAVE del campo que titula, no solo su valor.
 *
 * ## De dónde sale
 *
 * Lo pidió el chat de Mobile al auditar su lado (2026-09-05): la app sabe el
 * VALOR del título pero no la CLAVE, y por eso no puede ocultar ese campo del
 * cuerpo del detalle. Se lee «Ignis» arriba y «Nombre: Ignis» abajo.
 *
 * ## Por qué en el SDK y no deduciéndolo en la app
 *
 * Porque la prioridad ya vive aquí, y deducirla otra vez sería la TERCERA copia
 * del mismo criterio (TS, `core_dart`, la app) — el drift exacto que
 * `resolveCardTitle` vino a cerrar. Si algún día cambia la prioridad, tiene que
 * cambiar en un sitio.
 *
 * ## Es ESTRUCTURAL, no depende de los datos
 *
 * Responde «qué campo titula esta sección», no «qué pone en esta carta». Por eso
 * no recibe la carta: si dependiera del valor, dos cartas de la misma sección
 * podrían ocultar campos distintos, y el detalle cambiaría de forma según la
 * carta que abras.
 */
describe('resolveCardTitleKey · la clave del campo que titula', () => {
  const NOMBRE = { key: 'nombre', type: 'text' } as any;
  const NUMERO = { key: 'numero', type: 'number' } as any;
  const WEB    = { key: 'web',    type: 'text', behavior: 'url' } as any;

  it('gana la elección explícita del publisher', () => {
    expect(resolveCardTitleKey([NUMERO, NOMBRE], 'numero', 'numero')).toBe('numero');
  });

  it('sin elección, el primer texto legible — no la primary key', () => {
    // El fallo original de KRO-222: la PK ganaba y el título salía «6».
    expect(resolveCardTitleKey([NUMERO, NOMBRE], undefined, 'numero')).toBe('nombre');
  });

  it('un texto con behavior de url/email/teléfono no titula', () => {
    expect(resolveCardTitleKey([WEB, NOMBRE], undefined, undefined)).toBe('nombre');
  });

  it('sin ningún texto legible, cae a la primary key', () => {
    expect(resolveCardTitleKey([NUMERO], undefined, 'numero')).toBe('numero');
  });

  it('una `cardTitleKey` que no existe entre los campos NO se devuelve', () => {
    // Mismo criterio que el backend al servirla: una clave inválida se comporta
    // igual que no haber elegido, y devolverla haría que la app ocultara un
    // campo que no es el título — o ninguno.
    expect(resolveCardTitleKey([NUMERO, NOMBRE], 'no-existe', 'numero')).toBe('nombre');
  });

  it('sin candidatos, no hay clave', () => {
    expect(resolveCardTitleKey([], undefined, undefined)).toBeUndefined();
  });

  it('es la MISMA elección que hace resolveCardTitle', () => {
    // El control que impide que las dos funciones se separen: si una cambiara de
    // criterio, el título de arriba y el campo oculto de abajo dejarían de ser
    // el mismo, que es justo el fallo que esto viene a poder arreglar.
    const campos = [NUMERO, NOMBRE];
    const carta  = { numero: 6, nombre: 'Ignis' };
    const clave  = resolveCardTitleKey(campos, undefined, 'numero')!;
    expect(resolveCardTitle(carta, campos, undefined, 'numero')).toBe(String(carta[clave as 'nombre']));
  });
});
