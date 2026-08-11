import { describe, it, expect } from 'vitest';
import {
    DERIVED_WIDTHS, DERIVED_PREFIX,
    snapDerivedWidth, derivedMediaKey, isDerivedMediaKey,
} from '../src/derived-media';

/**
 * KRO-331 — la clave de un derivado de imagen, con UNA sola definición.
 *
 * Estas funciones vivían en el backend y Studio resolvía lo mismo por su cuenta
 * con otro criterio (ancho libre y sin cachear). Es el patrón que ya costó
 * KRO-302 con `objectKey` — tres copias, tres criterios, y el síntoma «en la web
 * se ve y en la app no».
 *
 * Aquí el precio de divergir es peor que una imagen rota: sería **caché
 * partida**, cada host generando su propio derivado del mismo objeto.
 */
describe('KRO-331 · ancho del derivado', () => {
    it('sin ancho no hay derivado: se sirve el original', () => {
        expect(snapDerivedWidth(undefined)).toBeNull();
        expect(snapDerivedWidth('')).toBeNull();
        expect(snapDerivedWidth(null)).toBeNull();
    });

    it('lo que no es un número usable tampoco cuenta', () => {
        expect(snapDerivedWidth('grande')).toBeNull();
        expect(snapDerivedWidth('-100')).toBeNull();
        expect(snapDerivedWidth('0')).toBeNull();
        expect(snapDerivedWidth(NaN)).toBeNull();
    });

    /**
     * HACIA ARRIBA, nunca hacia abajo: servir menos píxeles que la celda se ve
     * borroso, y evitar eso es medio motivo de que esto exista.
     */
    it('redondea hacia ARRIBA al primero que cubra lo pedido', () => {
        expect(snapDerivedWidth(50)).toBe(96);
        expect(snapDerivedWidth(97)).toBe(240);
        expect(snapDerivedWidth(240)).toBe(240);
        expect(snapDerivedWidth(481)).toBe(960);
    });

    it('nunca inventa un ancho fuera de la lista', () => {
        for (const pedido of [1, 95, 96, 300, 700, 1000, 5000, 99999]) {
            expect(DERIVED_WIDTHS).toContain(snapDerivedWidth(pedido) as never);
        }
    });

    it('un ancho desmedido se acota al mayor, no fabrica un objeto a medida', () => {
        expect(snapDerivedWidth(100000)).toBe(DERIVED_WIDTHS[DERIVED_WIDTHS.length - 1]);
    });
});

describe('KRO-331 · la caché no puede quedarse vieja', () => {
    const KEY = 'kromia/demo-bestiario/testing/original/zapdos-art-mid-v3.webp';

    it('si el ORIGINAL cambia, la clave del derivado cambia', () => {
        expect(derivedMediaKey(KEY, 'aaaaaaaaaaaaaaaa', 480, 'webp'))
            .not.toBe(derivedMediaKey(KEY, 'bbbbbbbbbbbbbbbb', 480, 'webp'));
    });

    it('mismo original y mismo ancho → misma clave (si no, no habría caché)', () => {
        expect(derivedMediaKey(KEY, 'abc123', 480, 'webp'))
            .toBe(derivedMediaKey(KEY, 'abc123', 480, 'webp'));
    });

    it('cada ancho tiene su propio derivado', () => {
        expect(derivedMediaKey(KEY, 'abc123', 240, 'webp'))
            .not.toBe(derivedMediaKey(KEY, 'abc123', 960, 'webp'));
    });

    it('un ETag con comillas o guiones no rompe la clave', () => {
        const k = derivedMediaKey(KEY, '"a1b2-c3d4"', 480, 'webp');
        expect(k).not.toContain('"');
        expect(k).toContain('a1b2c3d4');
    });

    it('sin ETag genera una clave utilizable, no una rota', () => {
        const k = derivedMediaKey(KEY, '', 480, 'webp');
        expect(k).toContain('sin-etag');
        expect(k.endsWith('.webp')).toBe(true);
    });

    /**
     * El derivado vive en la RAÍZ del bucket: fuera de los álbumes y por tanto
     * invisible en el gestor de medios. Es lo que impide que alguien borre a
     * mano un fichero que no sabe que existe.
     */
    it('vive bajo el namespace interno y se reconoce como derivado', () => {
        const k = derivedMediaKey(KEY, 'abc123', 480, 'webp');
        expect(k.startsWith(DERIVED_PREFIX)).toBe(true);
        expect(isDerivedMediaKey(k)).toBe(true);
        expect(isDerivedMediaKey(KEY)).toBe(false);
    });

    /**
     * La comprobación que protege de verdad la caché COMPARTIDA: Studio y el
     * backend tienen que producir la misma clave para la misma entrada. Si esto
     * dejara de cumplirse, cada uno generaría su propio derivado del mismo
     * objeto — el doble de trabajo y el doble de bucket, en silencio.
     */
    it('la forma de la clave está fijada, no es un detalle interno', () => {
        expect(derivedMediaKey('a/b/c.webp', 'deadbeef', 240, 'webp'))
            .toBe('__raster/v3/deadbeef/240/a/b/c.webp.webp');
    });
});
