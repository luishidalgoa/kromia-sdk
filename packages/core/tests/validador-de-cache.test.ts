import { describe, it, expect } from 'vitest';
import { validadorCoincide } from '../src/derived-media';

/**
 * KRO-410 — la comparación de `If-None-Match`, que es donde se esconde la letra
 * pequeña.
 *
 * Sube al SDK porque **Studio y el backend sirven el mismo `/api/images`** y ya
 * habían divergido de la peor manera posible: el backend la tenía desde
 * KRO-346 y Studio no la tenía en absoluto. Sin validador, Studio sellaba un año
 * de `immutable` sobre claves que se sobrescriben (`original/<nombre>`, sin hash
 * ni fecha), así que un publisher corregía el arte de una carta y **seguía
 * viendo el viejo**, sin forma de arreglarlo recargando ni cerrando sesión.
 *
 * Cada caso de aquí es una forma concreta de reescribirla mal.
 */
describe('validadorCoincide', () => {
  const ETAG = 'd41d8cd98f00b204e9800998ecf8427e';

  it('el mismo validador, entrecomillado como manda la sintaxis', () => {
    expect(validadorCoincide(`"${ETAG}"`, ETAG)).toBe(true);
  });

  it('y sin comillas, que es como lo guardan algunos clientes', () => {
    expect(validadorCoincide(ETAG, ETAG)).toBe(true);
  });

  it('otro validador NO coincide', () => {
    // Control: sin esto, «devuelve true siempre» pasaría todo lo demás.
    expect(validadorCoincide('"otro-distinto"', ETAG)).toBe(false);
  });

  it('el comodín vale por cualquiera', () => {
    expect(validadorCoincide('*', ETAG)).toBe(true);
  });

  it('acepta VARIOS separados por coma: el cliente trae los que tenga', () => {
    expect(validadorCoincide(`"viejo", "${ETAG}"`, ETAG)).toBe(true);
    expect(validadorCoincide(`"${ETAG}","otro"`, ETAG)).toBe(true);
  });

  it('y si ninguno de la lista es el suyo, no coincide', () => {
    expect(validadorCoincide('"uno", "dos", "tres"', ETAG)).toBe(false);
  });

  it('ignora el prefijo W/ de los débiles, en cualquiera de los dos lados', () => {
    // Para comparar dos representaciones de la MISMA imagen, la distinción
    // fuerte/débil no aporta nada: lo único que importa es si son los mismos
    // bytes. Un cliente que devuelve el validador como débil se quedaría sin
    // 304 para siempre, bajándose la imagen entera cada vez.
    expect(validadorCoincide(`W/"${ETAG}"`, ETAG)).toBe(true);
    expect(validadorCoincide(`"${ETAG}"`, `W/"${ETAG}"`)).toBe(true);
    expect(validadorCoincide(`W/"${ETAG}"`, `W/"${ETAG}"`)).toBe(true);
  });

  it('tolera espacios alrededor de las comas', () => {
    expect(validadorCoincide(`  "viejo" ,   "${ETAG}"  `, ETAG)).toBe(true);
  });

  it('sin cabecera o sin ETag, NO coincide', () => {
    // El caso que importa de verdad: primera visita. Responder 304 aquí dejaría
    // al cliente sin imagen y con la sensación de que la app está rota.
    expect(validadorCoincide(null, ETAG)).toBe(false);
    expect(validadorCoincide(undefined, ETAG)).toBe(false);
    expect(validadorCoincide('', ETAG)).toBe(false);
    expect(validadorCoincide(`"${ETAG}"`, '')).toBe(false);
    expect(validadorCoincide(`"${ETAG}"`, null)).toBe(false);
  });

  it('un ETag que solo son comillas no coincide con nada', () => {
    // Sin esto, un ETag vacío mal formado (`""`) se limpiaría a cadena vacía y
    // empataría con cualquier validador que también quedara vacío — un 304 a
    // ciegas, que es el peor fallo posible aquí.
    expect(validadorCoincide('""', '""')).toBe(false);
    expect(validadorCoincide('"", "algo"', '""')).toBe(false);
  });
});
