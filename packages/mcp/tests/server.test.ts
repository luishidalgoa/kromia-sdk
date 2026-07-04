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

describe('kromia MCP server (F1)', () => {
  it('expone las tools de catálogo + validación + construcción', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name).sort();
    expect(names).toEqual(expect.arrayContaining([
      'list_recipes', 'list_components', 'list_field_types', 'list_slot_kinds',
      'list_templates', 'describe', 'validate_composition',
      'auto_compose', 'apply_template', 'get_template',
    ]));
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
});
