/**
 * KRO-232 — las marcas de la rejilla caben ENTERAS dentro de la silueta.
 *
 * El número de la carta y «la tienes» van en las esquinas de la celda. Con una
 * silueta que no llega a esas esquinas (un escudo, una estrella), el recorte se
 * las comía y asomaban como manchas negras por el borde. Decisión del user
 * (2026-09-11, «D»): se meten hacia dentro lo justo para caber enteras, con la
 * distancia calculada desde la forma de cada álbum e igual en Studio y en la
 * app. Lo que sobresalga de la forma se sigue recortando.
 *
 * Por eso esto vive en el core: si cada host calculara la distancia a su
 * manera, Studio y la app pondrían las marcas en sitios distintos.
 *
 * ## Cómo se comprueba sin fiarse del propio cálculo
 *
 * `dentroPorMuestreo` es un juez independiente y deliberadamente tonto:
 * muestrea una rejilla densa de puntos de la caja contra la silueta. Así el test
 * no afirma «el helper dice que cabe», sino «en ese sitio la marca de verdad
 * queda dentro, y un paso antes no».
 */
import { describe, it, expect } from 'vitest';
import { cardShapeBadgeInset, CARD_SHAPE_BADGE_INSET_MAX } from '../src/card-shapes';

const ESCUDO = 'M 0.5 0 L 1 0.12 L 1 0.55 Q 1 0.85 0.5 1 Q 0 0.85 0 0.55 L 0 0.12 Z';
const RECTANGULO = 'M 0 0 L 1 0 L 1 1 L 0 1 Z';
const ROMBO = 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z';

const escudo = { shape: 'custom', shapePath: ESCUDO };
// Tamaño aproximado del número en la rejilla: ~16 % del ancho y ~7 % del alto.
const MARCA = { w: 0.16, h: 0.07 };

/** Polígono de referencia, aplanando las Q con muchos pasos. */
function poligono(path: string): [number, number][] {
  const t = path.trim().split(/\s+/); const pts: [number, number][] = []; let i = 0; let cur: [number, number] = [0, 0];
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M' || c === 'L') { cur = [+t[i++], +t[i++]]; pts.push(cur); }
    else if (c === 'Q') {
      const cx = +t[i++], cy = +t[i++], x = +t[i++], y = +t[i++];
      for (let k = 1; k <= 200; k++) { const u = k / 200; pts.push([(1 - u) ** 2 * cur[0] + 2 * (1 - u) * u * cx + u * u * x, (1 - u) ** 2 * cur[1] + 2 * (1 - u) * u * cy + u * u * y]); }
      cur = [x, y];
    }
  }
  return pts;
}
function puntoDentro([px, py]: [number, number], poly: [number, number][]) {
  let d = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xi, yi] = poly[a], [xj, yj] = poly[b];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) d = !d;
  }
  return d;
}
const caja = (corner: string, s: number) => ({
  x: corner.endsWith('left') ? s : 1 - s - MARCA.w,
  y: corner.startsWith('top') ? s : 1 - s - MARCA.h,
});
function dentroPorMuestreo(path: string, corner: string, s: number) {
  const poly = poligono(path); const { x, y } = caja(corner, s);
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
    if (!puntoDentro([x + MARCA.w * i / 40, y + MARCA.h * j / 40], poly)) return false;
  }
  return true;
}

describe('KRO-232 · cuánto meter una marca para que quepa dentro de la silueta', () => {
  it.each(['top-left', 'top-right', 'bottom-left'] as const)('escudo, %s: en el sitio calculado la marca queda dentro, y un paso antes no', (corner) => {
    const s = cardShapeBadgeInset(escudo, corner, MARCA);

    expect(s).not.toBeNull();
    expect(dentroPorMuestreo(ESCUDO, corner, s!)).toBe(true);
    // Mínimo: lo JUSTO para caber, no un margen generoso que aleje la marca.
    expect(dentroPorMuestreo(ESCUDO, corner, s! - 0.01)).toBe(false);
  });

  it('el escudo es simétrico: izquierda y derecha salen igual', () => {
    expect(cardShapeBadgeInset(escudo, 'top-left', MARCA))
      .toBeCloseTo(cardShapeBadgeInset(escudo, 'top-right', MARCA)!, 3);
  });

  it('cada esquina se calcula por su lado: una forma cortada solo arriba a la derecha', () => {
    // Con el escudo, izquierda y derecha salen igual y un cálculo que confundiera
    // las esquinas pasaría igual. Aquí la izquierda está entera y la derecha no.
    const CUNA = 'M 0 0 L 0.7 0 L 1 0.3 L 1 1 L 0 1 Z';
    const cuna = { shape: 'custom', shapePath: CUNA };
    expect(cardShapeBadgeInset(cuna, 'top-left', MARCA)).toBe(0);
    const derecha = cardShapeBadgeInset(cuna, 'top-right', MARCA);
    expect(derecha).toBeGreaterThan(0);
    expect(dentroPorMuestreo(CUNA, 'top-right', derecha!)).toBe(true);
  });

  it('una silueta que llena la caja no mueve nada', () => {
    expect(cardShapeBadgeInset({ shape: 'custom', shapePath: RECTANGULO }, 'top-left', MARCA)).toBe(0);
  });

  it('achicar la silueta (shapeScale) empuja la marca hacia dentro', () => {
    const lleno = cardShapeBadgeInset(escudo, 'top-left', MARCA)!;
    const pequeno = cardShapeBadgeInset({ ...escudo, shapeScale: 0.7 }, 'top-left', MARCA)!;
    expect(pequeno).toBeGreaterThan(lleno);
  });

  it('si no cabe en ningún sitio razonable, lo dice (null) en vez de inventar una posición', () => {
    // Un rombo no deja sitio a una marca ancha en la esquina sin llevarla al centro.
    expect(cardShapeBadgeInset({ shape: 'custom', shapePath: ROMBO }, 'top-left', { w: 0.6, h: 0.3 })).toBeNull();
  });

  it('una marca que solo cabría pasado el tope → null, no se lleva al centro', () => {
    // Rombo a la mitad: la esquina de la marca solo entra a partir del 37,5 %.
    // Sin tope, esto devolvería 0.375 y la «esquina» estaría ya en el centro.
    expect(CARD_SHAPE_BADGE_INSET_MAX).toBeLessThan(0.375);
    expect(cardShapeBadgeInset({ shape: 'custom', shapePath: ROMBO, shapeScale: 0.5 }, 'top-left', MARCA)).toBeNull();
  });

  it('una muesca estrecha que entra entre dos esquinas de la marca también cuenta', () => {
    // Las cuatro esquinas de la marca pueden quedar dentro con la muesca
    // clavada en medio de su borde de arriba. Mirar solo las esquinas daría 0.
    const MUESCA = 'M 0 0 L 0.06 0 L 0.08 0.2 L 0.1 0 L 1 0 L 1 1 L 0 1 Z';
    const s = cardShapeBadgeInset({ shape: 'custom', shapePath: MUESCA }, 'top-left', MARCA);
    expect(s).toBeGreaterThan(0);
    expect(dentroPorMuestreo(MUESCA, 'top-left', s!)).toBe(true);
  });

  describe('controles — donde no hay silueta', () => {
    it('carta estándar (sin forma) → null: el host sigue con su regla del redondeo', () => {
      expect(cardShapeBadgeInset({ shape: 'standard' }, 'top-left', MARCA)).toBeNull();
      expect(cardShapeBadgeInset(undefined, 'top-left', MARCA)).toBeNull();
    });

    it('silueta custom inválida → null (cae a estándar, como el recorte)', () => {
      expect(cardShapeBadgeInset({ shape: 'custom', shapePath: 'M 0 0 X' }, 'top-left', MARCA)).toBeNull();
    });
  });
});
