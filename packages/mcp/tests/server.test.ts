import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createKromiaMcpServer } from '../src/server.js';

/** Conecta un Client a un server nuevo por transporte in-memory. */
async function connect(): Promise<Client> {
  const server = createKromiaMcpServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

const textOf = (r: any) => JSON.parse(r.content[0].text);
const textoCrudo = (r: any) => r.content[0].text as string;

/** Las 16, ordenadas. Si cambian, este fichero tiene que enterarse. */
const TOOLS = [
  'apply_composition', 'apply_template', 'auto_compose', 'describe',
  'get_template', 'list_behaviors', 'list_components', 'list_effects',
  'list_field_types', 'list_recipes', 'list_slot_kinds', 'list_templates',
  'validate_album_data', 'validate_composition', 'validate_rarity_source',
  'validate_tag_styles',
];

describe('kromia MCP server (F1)', () => {
  it('expone EXACTAMENTE las 16 tools, ni una más ni una menos', async () => {
    // La lista es CERRADA a propósito. Con `arrayContaining` —como estaba— borrar
    // una tool dejaba el test en verde: el agente conectado se queda sin la pieza
    // y aquí no se entera nadie. Y al revés, una tool nueva sin entrada aquí es
    // una tool sin ningún caso que la ejercite, que es como llegó `list_effects`.
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(TOOLS);
  });

  it('list_recipes devuelve recetas con id/kind', async () => {
    const client = await connect();
    const recipes = textOf(await client.callTool({ name: 'list_recipes', arguments: {} }));
    expect(Array.isArray(recipes)).toBe(true);
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]).toHaveProperty('id');
    expect(recipes[0]).toHaveProperty('kind');
  });

  it('describe de una receta inexistente marca isError', async () => {
    const client = await connect();
    const r: any = await client.callTool({ name: 'describe', arguments: { category: 'recipe', id: '__nope__' } });
    expect(r.isError).toBe(true);
  });

  it('validate_composition detecta una receta inexistente', async () => {
    const client = await connect();
    const res = textOf(await client.callTool({
      name: 'validate_composition', arguments: { composition: { recipe: '__nope__' } },
    }));
    expect(res.valid).toBe(false);
    expect(res.issues.some((i: any) => i.path === 'recipe')).toBe(true);
  });

  it('auto_compose (list) genera una composición con recipe + slots + validación', async () => {
    const client = await connect();
    const out = textOf(await client.callTool({
      name: 'auto_compose',
      arguments: { kind: 'list', fields: [
        { key: 'name', type: 'text', behavior: 'title' },
        { key: 'photo', type: 'image', behavior: 'avatar' },
      ] },
    }));
    expect(out.composition).toHaveProperty('recipe');
    expect(out.composition).toHaveProperty('slots');
    expect(out.validation).toHaveProperty('valid');
  });

  it('auto_compose (detail) también compone', async () => {
    const client = await connect();
    const out = textOf(await client.callTool({
      name: 'auto_compose',
      arguments: { kind: 'detail', fields: [{ key: 'title', type: 'text', behavior: 'title' }] },
    }));
    expect(out.composition).toHaveProperty('recipe');
  });

  it('apply_template con plantilla inexistente marca isError', async () => {
    const client = await connect();
    const r: any = await client.callTool({
      name: 'apply_template', arguments: { composition: { recipe: 'compact_card' }, templateId: '__nope__' },
    });
    expect(r.isError).toBe(true);
  });

  it('get_template devuelve un layout para una plantilla real (si alguna receta tiene)', async () => {
    const client = await connect();
    const recipes = textOf(await client.callTool({ name: 'list_recipes', arguments: {} }));
    for (const r of recipes) {
      const tpls = textOf(await client.callTool({ name: 'list_templates', arguments: { recipeId: r.id } }));
      if (tpls.length) {
        const out = textOf(await client.callTool({
          name: 'get_template', arguments: { recipeId: r.id, templateId: tpls[0].id },
        }));
        expect(out).toHaveProperty('layout');
        return;
      }
    }
  });

  it('apply_composition: dry-run por defecto (no escribe)', async () => {
    const client = await connect();
    const comp = textOf(await client.callTool({
      name: 'auto_compose', arguments: { kind: 'list', fields: [{ key: 'name', type: 'text', behavior: 'title' }] },
    })).composition;
    const out = textOf(await client.callTool({
      name: 'apply_composition', arguments: { schemaId: 'x', sectionKey: 's', composition: comp },
    }));
    expect(out.applied).toBe(false);
    expect(out.dryRun).toBe(true);
  });

  it('apply_composition: composición inválida no aplica (aunque confirm:true)', async () => {
    const client = await connect();
    const out = textOf(await client.callTool({
      name: 'apply_composition', arguments: { schemaId: 'x', sectionKey: 's', composition: { recipe: '__nope__' }, confirm: true },
    }));
    expect(out.applied).toBe(false);
    expect(out.validation.valid).toBe(false);
  });

  it('apply_composition: confirm:true sin token → isError (no intenta escribir)', async () => {
    delete process.env.KROMIA_API_URL;
    delete process.env.KROMIA_TOKEN;
    const client = await connect();
    const comp = textOf(await client.callTool({
      name: 'auto_compose', arguments: { kind: 'list', fields: [{ key: 'name', type: 'text', behavior: 'title' }] },
    })).composition;
    const r: any = await client.callTool({
      name: 'apply_composition', arguments: { schemaId: 'x', sectionKey: 's', composition: comp, confirm: true },
    });
    expect(r.isError).toBe(true);
  });
});
