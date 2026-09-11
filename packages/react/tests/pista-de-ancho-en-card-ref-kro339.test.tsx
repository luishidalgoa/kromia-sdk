/**
 * KRO-339 — la mini-carta de una referencia le dice al host CUÁNTO ocupa.
 *
 * El host (Studio) resuelve cada ref a la foto de la carta y le pide la imagen
 * al proxy. Sin saber el tamaño al que se va a pintar, no puede pedir un ancho,
 * así que se bajaba el ORIGINAL (hasta 1200 px) para una mini-carta de ~100.
 * Quien sabe el tamaño es `MiniCardRefs`: las columnas de la rejilla, el
 * `refSize` de la apariencia, el ancho del carrusel.
 *
 * Por eso el resolutor recibe una PISTA: la fracción del ancho del slot que
 * ocupa cada mini-carta. No son píxeles —el SDK no mide el DOM—; el host la
 * multiplica por el ancho máximo que conoce de su marco.
 *
 * Es aditiva: un resolutor de un solo argumento sigue valiendo (Flutter y
 * cualquier host viejo).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CARD_FORMAT } from '@kromia/core';
import { MiniCardRefs } from '../src/index';

type Props = Partial<Parameters<typeof MiniCardRefs>[0]>;

/** Renderiza y devuelve las pistas que recibió el resolutor, una por mini-carta. */
function pistasCon(props: Props): unknown[] {
    const pistas: unknown[] = [];
    const resolveRef = ((_ref: string | number, pista?: unknown) => {
        pistas.push(pista);
        return { imageUrl: 'carta.png' };
    }) as any;
    renderToStaticMarkup(
        <MiniCardRefs refs={[1, 2, 3, 4, 5, 6]} seed="s" cardFormat={DEFAULT_CARD_FORMAT} resolveRef={resolveRef} {...props} />,
    );
    return pistas;
}

describe('KRO-339 · la mini-carta dice cuánto ocupa', () => {
    it('en rejilla de 4 columnas, cada una ocupa un cuarto', () => {
        const pistas = pistasCon({ appearance: { refColumns: '4' } as any });

        expect(pistas.length).toBeGreaterThan(0);
        for (const p of pistas) expect(p).toEqual({ widthFraction: 1 / 4 });
    });

    it('con `refSize`, la fracción es la de la carta DENTRO de su columna', () => {
        // 2 columnas y la carta al 50 % de la suya → un cuarto del slot.
        const pistas = pistasCon({ appearance: { refColumns: '2', refSize: 50 } as any });

        for (const p of pistas) expect(p).toEqual({ widthFraction: 0.25 });
    });

    it('en carrusel, el ancho de cada carta (35 % por defecto)', () => {
        const pistas = pistasCon({ layout: 'carousel' });

        expect(pistas.length).toBeGreaterThan(0);
        for (const p of pistas) expect(p).toEqual({ widthFraction: 0.35 });
    });

    it('en carrusel con `refSize`, ese', () => {
        const pistas = pistasCon({ layout: 'carousel', appearance: { refSize: 60 } as any });

        for (const p of pistas) expect(p).toEqual({ widthFraction: 0.6 });
    });

    it('el control: un resolutor de UN argumento sigue pintando la foto', () => {
        // La pista es aditiva. Sin esto, «recibe la pista» lo cumpliría también
        // un cambio que obligue a todos los hosts a aceptarla.
        const html = renderToStaticMarkup(
            <MiniCardRefs refs={[7]} seed="s" cardFormat={DEFAULT_CARD_FORMAT}
                resolveRef={(ref) => ({ imageUrl: `foto-${ref}.png` })} />,
        );

        expect(html).toContain('foto-7.png');
    });
});
