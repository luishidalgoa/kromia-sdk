import { describe, it, expect } from 'vitest';
import { imageUrls, firstImageUrl, imageCount } from '../src/image-value';

/**
 * KRO-314 — el fallo que originó esto: un `array<image>` en un slot de banner
 * salía como `"/api/images/a.svg,/api/images/b.svg,…"` dentro del `src`, porque
 * el renderer lo AFIRMABA string con un `as string` y quien lo recibía lo
 * coaccionaba con el `toString()` de Array. Sin error y sin aviso.
 */
describe('KRO-314 · valor de campo-imagen', () => {
    it('un array NUNCA se convierte en una cadena con comas', () => {
        const varias = ['/api/images/a.svg', '/api/images/b.svg', '/api/images/c.svg'];
        // Esto es lo que pasaba, y es lo que no puede volver a pasar.
        expect(String(varias)).toContain(',');
        expect(firstImageUrl(varias)).toBe('/api/images/a.svg');
        expect(firstImageUrl(varias)).not.toContain(',');
    });

    it('una imagen suelta también sale como lista: el otro sentido del fallo', () => {
        // Una galería con `as string[]` recibiendo un `image` suelto tampoco es
        // un array — ahí revienta o itera carácter a carácter.
        expect(imageUrls('/api/images/sola.svg')).toEqual(['/api/images/sola.svg']);
    });

    it('descarta huecos en vez de pintar imágenes rotas', () => {
        expect(imageUrls(['/a.svg', '', '   ', null, undefined, 7, '/b.svg']))
            .toEqual(['/a.svg', '/b.svg']);
    });

    it('sin valor no hay imagen — y eso es un hueco, no un error', () => {
        // Los componentes ya saben dibujar su hueco (o la inicial del título)
        // cuando reciben `undefined`; devolver '' les haría pintar una rota.
        for (const v of [undefined, null, '', '   ', [], {}, 0]) {
            expect(firstImageUrl(v)).toBeUndefined();
            expect(imageUrls(v)).toEqual([]);
        }
    });

    it('el contador cuenta las de VERDAD, que es lo que dice el chip «+N»', () => {
        expect(imageCount(['/a.svg', '', '/b.svg'])).toBe(2);
        expect(imageCount('/a.svg')).toBe(1);
        expect(imageCount(undefined)).toBe(0);
    });
});
