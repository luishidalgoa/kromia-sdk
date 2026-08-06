import { describe, it, expect } from 'vitest';
import { buildAutoDetailComposition } from '../src/auto-detail';
import { resolveDetailComposition } from '../src/interaction';
import { classifyField, isFieldCompatibleWithSlot } from '../src/classify';
import { getRecipeManifest } from '../src/registries/recipes';

/**
 * KRO-317 — reproducción del caso REAL del álbum «Demo Bestiario».
 *
 * Los campos y las recetas destino son los que hay en producción, leídos de la
 * base: es la única forma de que este test hable del fallo que ve el user y no
 * de uno inventado.
 */
const LEYENDAS = [
    { key: 'titulo',   label: 'Título',   type: 'text',          behavior: undefined },
    { key: 'fecha',    label: 'Fecha',    type: 'text',          behavior: 'iso_date' },
    { key: 'relato',   label: 'Relato',   type: 'textarea',      behavior: 'markdown' },
    { key: 'imagenes', label: 'Imágenes', type: 'array<image>',  behavior: 'slideshow' },
] as any[];

const REINOS = [
    { key: 'nombre',             label: 'Nombre',      type: 'text',     behavior: undefined },
    { key: 'estandarte',         label: 'Estandarte',  type: 'image',    behavior: undefined },
    { key: 'clima',              label: 'Clima',       type: 'select',   behavior: 'ordinal_enum' },
    { key: 'elemento_dominante', label: 'Elemento',    type: 'select',   behavior: 'ordinal_enum' },
    { key: 'descripcion',        label: 'Descripción', type: 'textarea', behavior: 'markdown' },
    { key: 'color',              label: 'Color',       type: 'text',     behavior: 'color_hex' },
] as any[];

describe('KRO-317 · el texto largo acaba en el slot equivocado', () => {
    it('un textarea/markdown NO lo puede robar un slot de texto CORTO', () => {
        // Hipótesis descartada, pero el test se queda: si algún día un texto
        // largo pasara a ser compatible con un slot corto, CUALQUIER receta cuyo
        // slot corto vaya antes del cuerpo se llevaría el relato — y un slot
        // corto se pinta plano y a una línea, o sea asteriscos literales Y «…»
        // de una sola vez. Es barato dejar la puerta cerrada.
        const relato = LEYENDAS[2];
        expect(classifyField(relato)).toContain('text-long');

        const momento = getRecipeManifest('momento')!;
        const subtitle = momento.slots.find(s => s.id === 'subtitle')!;
        expect(isFieldCompatibleWithSlot(relato, subtitle as any)).toBe(false);
    });

    it('«momento»: el relato va al CUERPO, no al subtítulo', () => {
        const comp = buildAutoDetailComposition(LEYENDAS, 'momento');
        expect(comp.slots.body?.fields).toEqual(['relato']);
        expect(comp.slots.subtitle?.fields ?? []).not.toContain('relato');
        // Y el resto cae donde debe, para que el test no pase por accidente.
        expect(comp.slots.date?.fields).toEqual(['fecha']);
        expect(comp.slots.title?.fields).toEqual(['titulo']);
        expect(comp.slots.slideshow?.fields).toEqual(['imagenes']);
    });

    it('«editorial»: la descripción va al CUERPO, y la portada a cover', () => {
        const comp = buildAutoDetailComposition(REINOS, 'editorial');
        expect(comp.slots.body?.fields).toEqual(['descripcion']);
        expect(comp.slots.cover?.fields).toEqual(['estandarte']);
        expect(comp.slots.title?.fields).toEqual(['nombre']);
    });

    it('`resolveDetailComposition` respeta la receta destino, como hace Studio', () => {
        // KRO-317 — la rama `targetRecipe` construía los slots SIN pasarle la
        // receta, así que salían los del hero (`banner`, `avatar`, `subtitle`) y
        // luego se les pegaba encima la etiqueta de otra receta. Editorial iba a
        // buscar su `cover` y su `body` a una composición que no los tenía.
        //
        // Studio ya lo arregló en su lado (KRO-131) y dejó el motivo escrito;
        // esta copia del SDK se quedó con la versión rota. Mismo fallo, corregido
        // en un sitio y olvidado en el de al lado.
        const lista: any = { recipe: 'compact_card', action: 'navigate_to_detail', slots: {}, targetRecipe: 'editorial' };
        const detalle = resolveDetailComposition(lista, REINOS);

        expect(detalle.recipe).toBe('editorial');
        // Los slots tienen que ser los de EDITORIAL…
        expect(Object.keys(detalle.slots)).toContain('cover');
        expect(detalle.slots.body?.fields).toEqual(['descripcion']);
        // …y NO los del hero disfrazados.
        expect(Object.keys(detalle.slots)).not.toContain('banner');
        expect(Object.keys(detalle.slots)).not.toContain('avatar');
    });

    /**
     * KRO-317 (2ª parte) — el MISMO fallo sobrevivía en la rama de al lado.
     *
     * `resolveDetailComposition` tiene dos caminos: el salto multi-hop
     * (`targetComposition`, KRO-94) y el simple (`targetRecipe`). Se arregló el
     * segundo y el primero se quedó como estaba, sintetizando los slots sin
     * decirle para qué receta son — o sea, los del hero por defecto encajados en
     * la receta del salto.
     *
     * Se descubre solo cuando el salto **no trae slots propios**: si los trae, se
     * usan tal cual y el fallo no se ve. Por eso pasó desapercibido.
     */
    it('el salto multi-hop SIN slots propios también respeta su receta', () => {
        const lista: any = {
            recipe: 'compact_card',
            action: 'navigate_to_detail',
            slots: {},
            targetComposition: { recipe: 'editorial', action: 'none', slots: {} },
        };
        const detalle = resolveDetailComposition(lista, REINOS);

        expect(detalle.recipe).toBe('editorial');
        expect(Object.keys(detalle.slots)).toContain('cover');
        expect(detalle.slots.cover?.fields).toEqual(['estandarte']);
        expect(detalle.slots.body?.fields).toEqual(['descripcion']);
        expect(Object.keys(detalle.slots)).not.toContain('banner');
        expect(Object.keys(detalle.slots)).not.toContain('avatar');
    });

    /**
     * Control: si el salto SÍ trae slots, mandan los suyos y no se sintetiza
     * nada. Sin esto, el test de arriba podría pasar por el motivo equivocado.
     */
    it('si el salto trae slots propios, se respetan tal cual', () => {
        const lista: any = {
            recipe: 'compact_card',
            action: 'navigate_to_detail',
            slots: {},
            targetComposition: {
                recipe: 'editorial',
                action: 'none',
                slots: { title: { fields: ['color'] } },
            },
        };
        const detalle = resolveDetailComposition(lista, REINOS);
        expect(detalle.slots.title?.fields).toEqual(['color']);
        expect(Object.keys(detalle.slots)).toEqual(['title']);
    });
});
