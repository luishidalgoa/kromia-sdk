/**
 * KRO-471 — ¿cabe una caja entera dentro de la silueta de la carta?
 *
 * Lo pide el paquete de impresión: el QR del reverso se coloca en % de la carta,
 * y con una silueta que no llega a las esquinas (un escudo, un rombo) el troquel
 * lo cortaría. Es la misma geometría que ya usa `cardShapeBadgeInset` (KRO-232)
 * para las marcas de la rejilla, ahora expuesta para cualquier caja.
 *
 * Todo en el espacio normalizado de la carta: 0..1 en cada eje.
 */
import { describe, it, expect } from 'vitest';
import { cardShapeBoxInside } from '../src/card-shapes';

const ROMBO = { shape: 'custom', shapePath: 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z' };

describe('KRO-471 · una caja dentro de la silueta', () => {
    it('sin silueta (estándar): siempre cabe', () => {
        expect(cardShapeBoxInside(undefined, { x: 0, y: 0, w: 0.3, h: 0.3 })).toBe(true);
        expect(cardShapeBoxInside({ shape: 'standard' }, { x: 0.7, y: 0.7, w: 0.3, h: 0.3 })).toBe(true);
    });

    it('en el centro del rombo cabe', () => {
        expect(cardShapeBoxInside(ROMBO, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 })).toBe(true);
    });

    it('en la esquina del rombo no', () => {
        expect(cardShapeBoxInside(ROMBO, { x: 0.75, y: 0.75, w: 0.2, h: 0.2 })).toBe(false);
    });

    it('la escala de la silueta cuenta: a la mitad, lo que cabía deja de caber', () => {
        const caja = { x: 0.3, y: 0.4, w: 0.2, h: 0.2 };
        expect(cardShapeBoxInside(ROMBO, caja)).toBe(true);
        expect(cardShapeBoxInside({ ...ROMBO, shapeScale: 0.5 }, caja)).toBe(false);
    });

    it('una caja que se sale de la carta no cabe', () => {
        expect(cardShapeBoxInside(ROMBO, { x: 0.9, y: 0.4, w: 0.2, h: 0.2 })).toBe(false);
    });
});
