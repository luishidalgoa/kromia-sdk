/**
 * KRO-156 — un slot obligatorio vacío tiene que VERSE, aunque valide.
 *
 * ## El caso, salido de usar el MCP
 *
 * `hero_protagonico` con un campo `array<image>`: la heurística lo manda a
 * `gallery` y deja **`banner` y `avatar` vacíos**. Y `sinColocar` sale **vacío**,
 * porque el campo sí se colocó — la única red que había cubre «se descartó un
 * campo tuyo», no «falta una pieza de la receta». Son fallos distintos y se
 * pueden dar por separado.
 *
 * `validate_composition` devuelve `valid: true`, porque un obligatorio sin
 * llenar es un `warn`. Y eso **es deliberado**: un diseño a medias no es
 * inválido, y Studio hace lo mismo — lo detecta aparte
 * (`hasRequiredEmptyWarn` en `CopyCompositionDialog`) para poder enseñarlo.
 *
 * Lo que faltaba aquí es la otra mitad de esa decisión: **enseñarlo**. La
 * condición de parada que documentan estas tools es `valid === true`, así que
 * un agente termina con un `detail_profile` sin avatar y nada se lo dice.
 *
 * Por eso esto NO cambia la validación: añade el aviso.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createKromiaMcpServer } from '../src/server.js';

async function connect(): Promise<Client> {
  const server = createKromiaMcpServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}
const textOf = (r: any) => JSON.parse(r.content[0].text);

const componer = async (args: any) =>
  textOf(await (await connect()).callTool({ name: 'auto_compose', arguments: args }));

describe('KRO-156 · los slots obligatorios vacíos salen en la respuesta', () => {
    it('un perfil sin avatar lo dice, aunque valide', async () => {
        /**
         * El caso entero. `array<image>` no entra en un slot que acepta `image`,
         * así que el avatar —la razón de ser de esta receta— queda vacío.
         */
        const r = await componer({
            kind: 'detail', recipeId: 'detail_profile',
            fields: [{ key: 'foto', type: 'array<image>' }, { key: 'nombre', type: 'text' }],
        });

        expect(r.obligatoriosVacios).toContain('avatar');
        // Y se dice que la validación NO lo va a parar, que es donde estaba la
        // trampa: el agente se fía de `valid` y se planta ahí.
        expect(r.validation.valid).toBe(true);
        expect(r.avisoObligatorios).toBeDefined();
    });

    it('y lo dice incluso cuando el campo SÍ se colocó en otro sitio', async () => {
        /**
         * El caso que `sinColocar` no puede ver, y el que lo justifica todo: aquí
         * la imagen acaba en `gallery`, así que no falta ningún campo — falta
         * una PIEZA. Con la red anterior, silencio absoluto.
         */
        const r = await componer({
            kind: 'detail',
            fields: [{ key: 'foto', type: 'array<image>' }, { key: 'nombre', type: 'text' }],
        });

        expect(r.sinColocar).toEqual([]);
        expect(r.obligatoriosVacios).toEqual(expect.arrayContaining(['banner', 'avatar']));
    });

    it('el aviso explica el porqué del tipo, que es lo que desatasca', async () => {
        // Sin esto, el agente sabe que falta el avatar y no sabe qué hacer: el
        // catálogo dice `array<image>` y el slot dice `image`, y la diferencia
        // no está en ninguna parte visible.
        const r = await componer({
            kind: 'detail', recipeId: 'detail_profile',
            fields: [{ key: 'foto', type: 'array<image>' }],
        });

        expect(r.avisoObligatorios).toMatch(/image/);
    });

    describe('los controles — lo que esto NO puede romper', () => {
        it('una composición COMPLETA no avisa de nada', async () => {
            // El control de partida. «Avisa de obligatorios vacíos» lo cumpliría
            // también algo que avisa siempre, y entonces el aviso es ruido y se
            // deja de leer — que es como se pierde el que importa.
            const r = await componer({
                kind: 'detail', recipeId: 'detail_profile',
                fields: [{ key: 'foto', type: 'image' }, { key: 'nombre', type: 'text' }],
            });

            expect(r.obligatoriosVacios).toEqual([]);
            expect(r.avisoObligatorios).toBeUndefined();
            expect(r.validation.issues).toEqual([]);
        });

        it('y los slots OPCIONALES vacíos no cuentan', async () => {
            // `subtitle`, `stats` y `body` son opcionales en detail_profile:
            // meterlos aquí convertiría el aviso en una queja permanente.
            const r = await componer({
                kind: 'detail', recipeId: 'detail_profile',
                fields: [{ key: 'foto', type: 'image' }, { key: 'nombre', type: 'text' }],
            });

            expect(r.obligatoriosVacios).not.toContain('subtitle');
            expect(r.obligatoriosVacios).not.toContain('stats');
            expect(r.obligatoriosVacios).not.toContain('body');
        });

        it('`sinColocar` sigue funcionando: son fallos distintos', async () => {
            // Control cruzado. Si el nuevo aviso hubiera sustituido al viejo en
            // vez de acompañarlo, este caso lo destapa.
            const r = await componer({
                kind: 'list',
                fields: [{ key: 'nombre', type: 'text' }, { key: 'x1', type: 'text' },
                         { key: 'x2', type: 'text' }, { key: 'x3', type: 'text' },
                         { key: 'x4', type: 'text' }, { key: 'x5', type: 'text' }],
            });

            expect(r.sinColocar.length).toBeGreaterThan(0);
        });
    });
});
