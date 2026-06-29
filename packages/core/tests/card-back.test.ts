import { describe, it, expect } from 'vitest';
import { resolveCardBack, CARD_BACK_SECTION_KEY } from '../src/card-back';
import type { CardBackComposition } from '../src/types';

const baseImg = 'back/base.png';
const fireImg = 'back/fire.png';

describe('resolveCardBack', () => {
  it('sin composición → undefined', () => {
    expect(resolveCardBack(undefined, { elemento: 'Fuego' })).toBeUndefined();
  });

  it('solo base (sin condicional) → la base', () => {
    const comp: CardBackComposition = { base: { image: baseImg, qr: { x: 50, y: 80, size: 22 } } };
    expect(resolveCardBack(comp, { elemento: 'Fuego' })).toEqual({ image: baseImg, qr: { x: 50, y: 80, size: 22 } });
  });

  it('condicional por valor: el caso que coincide PISA la base campo a campo', () => {
    const comp: CardBackComposition = {
      base: { image: baseImg, qr: { x: 50, y: 80, size: 22 } },
      conditional: {
        fieldKey: 'elemento',
        cases: [{ value: 'Fuego', design: { image: fireImg } }],  // solo cambia la imagen
      },
    };
    // hereda el qr de la base (merge shallow), cambia la imagen
    expect(resolveCardBack(comp, { elemento: 'Fuego' })).toEqual({ image: fireImg, qr: { x: 50, y: 80, size: 22 } });
    // valor que no matchea → la base
    expect(resolveCardBack(comp, { elemento: 'Agua' })).toEqual({ image: baseImg, qr: { x: 50, y: 80, size: 22 } });
  });

  it('otherwise (else) cuando ningún caso coincide', () => {
    const comp: CardBackComposition = {
      base: { image: baseImg },
      conditional: {
        fieldKey: 'elemento',
        cases: [{ value: 'Fuego', design: { image: fireImg } }],
        otherwise: { image: 'back/other.png' },
      },
    };
    expect(resolveCardBack(comp, { elemento: 'Agua' })?.image).toBe('back/other.png');
    expect(resolveCardBack(comp, { elemento: 'Fuego' })?.image).toBe(fireImg);
  });

  it('filtro por SECCIÓN vía __section__', () => {
    const comp: CardBackComposition = {
      base: { image: baseImg },
      conditional: {
        fieldKey: CARD_BACK_SECTION_KEY,
        cases: [{ value: 'Reinos', design: { image: 'back/reinos.png' } }],
      },
    };
    expect(resolveCardBack(comp, { nombre: 'x' }, 'Reinos')?.image).toBe('back/reinos.png');
    expect(resolveCardBack(comp, { nombre: 'x' }, 'Estandarte')?.image).toBe(baseImg);
  });
});
