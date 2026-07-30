/**
 * KRO-302 — la conversión URL↔key del bucket.
 *
 * Existe porque esto estaba escrito tres veces con tres criterios distintos, y
 * el día que el dato guardado cambió de forma cada host se rompió de una manera
 * diferente y **ninguno con una excepción**. Lo que se fija aquí es sobre todo
 * qué NO es un objeto del bucket: ahí es donde divergían.
 */
import { describe, it, expect } from 'vitest';
import { objectUrl, objectKey } from '../src/media-address';

const LOC = { publicUrl: 'https://s3.ejemplo.com', bucket: 'kromia' };

describe('objectUrl', () => {
  it('compone base + bucket + key', () => {
    expect(objectUrl('__private/avatars/luis.webp', LOC))
      .toBe('https://s3.ejemplo.com/kromia/__private/avatars/luis.webp');
  });

  it('sin saber dónde vive el bucket NO se inventa una URL', () => {
    // Una URL falsa se ve igual que una imagen que no se subió, y manda a quien
    // depure al sitio equivocado. Mejor decir que no se sabe.
    expect(objectUrl('a/b.png', {})).toBeNull();
    expect(objectUrl('a/b.png', { bucket: 'kromia' })).toBeNull();
  });

  it('tolera barras de más por los dos lados', () => {
    expect(objectUrl('/a/b.png', { publicUrl: 'https://s3.ejemplo.com/', bucket: '/kromia/' }))
      .toBe('https://s3.ejemplo.com/kromia/a/b.png');
  });
});

describe('objectKey', () => {
  it('vuelve de la URL a la key', () => {
    expect(objectKey('https://s3.ejemplo.com/kromia/__private/avatars/luis.webp', LOC))
      .toBe('__private/avatars/luis.webp');
  });

  it('ida y vuelta', () => {
    const key = 'ana/liga-2025/original/foto.png';
    expect(objectKey(objectUrl(key, LOC), LOC)).toBe(key);
  });

  it('una key suelta se devuelve tal cual', () => {
    expect(objectKey('ana/liga/foto.png', LOC)).toBe('ana/liga/foto.png');
    expect(objectKey('/ana/liga/foto.png', LOC)).toBe('ana/liga/foto.png');
  });

  it('tolera la ruta del PROXY, que es lo que rompió el avatar', () => {
    // El backend guardó un tiempo `/api/images/{key}`. Sin quitar ese prefijo,
    // el host se lo volvía a poner y pedía `/api/images/api/images/…`.
    expect(objectKey('/api/images/__private/avatars/luis.webp', LOC))
      .toBe('__private/avatars/luis.webp');
  });

  it('lo que NO es del bucket devuelve null, para que el host lo deje pasar', () => {
    // Proxyar el avatar de Google o un blob local los ROMPE. Este es justo el
    // punto donde los tres hosts tenían criterios distintos.
    expect(objectKey('https://lh3.googleusercontent.com/a/foto.jpg', LOC)).toBeNull();
    expect(objectKey('data:image/png;base64,AAAA', LOC)).toBeNull();
    expect(objectKey('blob:http://localhost/abc', LOC)).toBeNull();
    expect(objectKey('mockup:image', LOC)).toBeNull();
    expect(objectKey('', LOC)).toBeNull();
    expect(objectKey(null, LOC)).toBeNull();
  });

  it('con un CDN que lleva PATH sigue acertando', () => {
    // Es el caso que rompía la heurística de «quita el primer segmento»: aquí el
    // primero es `media`, no el bucket.
    const cdn = { publicUrl: 'https://cdn.ejemplo.com/media', bucket: 'kromia' };
    expect(objectKey('https://cdn.ejemplo.com/media/kromia/a/b.png', cdn)).toBe('a/b.png');
    expect(objectUrl('a/b.png', cdn)).toBe('https://cdn.ejemplo.com/media/kromia/a/b.png');
  });

  it('sin base, cae a la heurística de quitar el primer segmento', () => {
    // El comportamiento que tenían los hosts. Se conserva para no romper lo ya
    // guardado, pero por eso conviene pasar siempre `publicUrl`.
    expect(objectKey('https://otro.host/kromia/a/b.png', {})).toBe('a/b.png');
    // Con un solo segmento no hay key que sacar.
    expect(objectKey('https://otro.host/solo', {})).toBeNull();
  });

  it('si se dice el bucket, una URL de OTRO bucket no cuela', () => {
    expect(objectKey('https://otro.host/ajeno/a/b.png', { bucket: 'kromia' })).toBeNull();
  });
});
