/**
 * KRO-156 — la descripción de una tool es INTERFAZ, y esta mentía.
 *
 * ## De dónde sale
 *
 * De usar el MCP de verdad, que es lo que este ticket llevaba meses pidiendo.
 * Diseñando una ficha de jugador con `detail_profile` —la receta cuyo propósito
 * es «avatar circular centrado»— el avatar salía SIEMPRE vacío, y la validación
 * decía `valid: true`.
 *
 * La cadena, medida paso a paso:
 *
 *  1. `auto_compose` dejaba el campo de imagen sin colocar (o lo mandaba a
 *     `gallery`), y el slot obligatorio `avatar` vacío.
 *  2. Colocarlo a mano daba error duro: *field «foto» (image-array) no es
 *     compatible con slot «avatar» (acepta: image)*.
 *  3. Los tres behaviors de `array<image>` —gallery, card_multiview,
 *     slideshow— renderizan **todos** como `image-array`.
 *
 * O sea que con los tipos que el agente creía tener, esos slots eran
 * **inalcanzables**. Y no lo son: existe el tipo escalar `image`, y con él el
 * avatar se llena y la validación sale sin un solo issue.
 *
 * ## Dónde estaba la mentira
 *
 * En la descripción de `list_behaviors`, escrita a mano:
 *
 * > «los tipos base son solo estos siete: text, textarea, number, select,
 * >  array<string>, array<number>, array<image>»
 *
 * Faltaban `image` y `cardRef`. Y `image` no es uno cualquiera: es **el único**
 * que llena los slots obligatorios `avatar`, `banner`, `thumb` y `cover`.
 *
 * `list_field_types` sí los devuelve todos — el catálogo estaba bien. Lo que
 * fallaba era la frase que el agente lee ANTES de llamar a nada, que es
 * justamente la que decide qué pregunta.
 *
 * ## Por qué esto es un test y no un arreglo de texto
 *
 * Porque el fallo no es que la frase estuviera mal: es que **se escribió a
 * mano** una lista que el registro ya conoce. Vuelve a pasar en cuanto alguien
 * añada un tipo. Ahora la descripción se DERIVA de `allFieldTypes()`, y esto
 * salta si vuelve a escribirse a mano incompleta.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { allFieldTypes } from '@kromia/core';
import { createKromiaMcpServer } from '../src/server.js';

async function connect(): Promise<Client> {
  const server = createKromiaMcpServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

const descripcionDe = async (nombre: string) => {
  const { tools } = await (await connect()).listTools();
  const t = tools.find(x => x.name === nombre);
  expect(t, `no existe la tool ${nombre}`).toBeDefined();
  return String(t!.description ?? '');
};

/**
 * ¿La descripción nombra ESTE tipo, como tipo y no de refilón?
 *
 * Se pide entre acentos graves y no con `includes` a secas porque `includes`
 * daba un **falso verde**: `image` es subcadena de `array<image>`, así que el
 * caso decía que `image` estaba nombrado cuando lo único que había era la lista
 * de imágenes — justo el tipo que NO llena los avatares. La primera versión de
 * este fichero tenía ese fallo y lo destapó ver que solo faltaba `cardRef`.
 */
const nombra = (desc: string, id: string) => desc.includes('`' + id + '`');

describe('KRO-156 · la descripción de list_behaviors no puede mentir sobre los tipos', () => {
    it('nombra TODOS los tipos base que existen de verdad', async () => {
        /**
         * El fallo entero. La lista escrita a mano se quedó en siete y el
         * registro tiene más — incluido `image`, sin el cual media docena de
         * recetas tienen un slot obligatorio imposible de llenar.
         */
        const desc = await descripcionDe('list_behaviors');
        const faltan = allFieldTypes().map(t => t.id).filter(id => !nombra(desc, id));

        expect(faltan, `la descripción no nombra: ${faltan.join(', ')}`).toEqual([]);
    });

    it('y en particular `image`, que es el que llena los avatares', async () => {
        // Se afirma aparte del caso general porque no es uno más de la lista:
        // es EL que hacía que `detail_profile` y `hero_protagonico` salieran
        // siempre con su slot obligatorio vacío y `valid:true`.
        expect(nombra(await descripcionDe('list_behaviors'), 'image')).toBe(true);
    });

    describe('los controles — lo que esto NO puede romper', () => {
        it('sigue avisando de que «enum» NO es un tipo base', async () => {
            /**
             * El control de partida. «Que nombre todos los tipos» lo cumpliría
             * también volcar la lista y borrar el aviso — y ese aviso está ahí
             * porque `enum` ES un behavior con nombre de tipo, así que filtrar
             * por él devuelve vacío y parece que no hay behaviors.
             */
            const desc = await descripcionDe('list_behaviors');

            expect(desc.toLowerCase()).toContain('enum');
            expect(desc).toMatch(/no es un tipo base/i);
        });

        it('el catálogo de tipos sigue devolviéndolos enteros', async () => {
            // Control: la descripción se deriva de aquí, así que si esto se
            // vaciara, el caso de arriba pasaría por el motivo equivocado.
            const client = await connect();
            const tipos = JSON.parse(
                (await client.callTool({ name: 'list_field_types', arguments: {} }) as any).content[0].text,
            );

            expect(tipos.map((t: any) => t.id)).toContain('image');
            expect(tipos.length).toBeGreaterThanOrEqual(9);
        });
    });
});
