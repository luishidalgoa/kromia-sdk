/**
 * KRO-156 — Servidor MCP de Kromia (F1: lectura + validación).
 *
 * Expone el modelo del SDK (`@kromia/core`) como TOOLS deterministas para que un
 * agente externo (Claude) explore el catálogo y VALIDE composiciones en bucle.
 * F1 es PURO: solo lee `@kromia/core`, no toca el backend ni requiere auth.
 * `createKromiaMcpServer()` lo comparten la entry stdio (`index.ts`) y los tests.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  allRecipes, getRecipeManifest,
  allComponents, getComponentDef,
  allFieldTypes, getFieldType,
  SLOT_ACCEPT_KIND_META,
  layoutTemplatesFor,
  validateComposition,
} from '@kromia/core';
import type { RecipeId, ViewComposition } from '@kromia/core';

/** Envuelve datos como resultado textual JSON de una tool. */
const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export function createKromiaMcpServer(): McpServer {
  const server = new McpServer({ name: 'kromia', version: '0.1.0' });

  // ── Catálogo (lectura) ────────────────────────────────────────────────
  server.registerTool('list_recipes', {
    title: 'Listar recetas',
    description:
      'Lista las recetas (plantillas de carta/sección) del modelo Kromia: id, kind (list/detail/expand), nombre y descripción. Punto de partida para diseñar una vista.',
  }, async () => json(
    allRecipes().map(r => ({ id: r.id, kind: r.kind, displayName: r.displayName, description: r.description })),
  ));

  server.registerTool('list_components', {
    title: 'Listar componentes',
    description: 'Lista los componentes prefabricados (bloques) que se pueden colocar en un layout.',
  }, async () => json(allComponents()));

  server.registerTool('list_field_types', {
    title: 'Listar tipos de campo',
    description: 'Lista los tipos de campo del modelo (text, number, image, enum, rating…).',
  }, async () => json(allFieldTypes()));

  server.registerTool('list_slot_kinds', {
    title: 'Listar slot-kinds',
    description: 'Lista los slot-kinds (qué clase de contenido acepta un slot): id, label y descripción.',
  }, async () => json(
    Object.entries(SLOT_ACCEPT_KIND_META).map(([id, m]) => ({ id, label: m.label, description: m.description })),
  ));

  server.registerTool('list_templates', {
    title: 'Listar plantillas de layout',
    description:
      'Lista las plantillas de layout disponibles para una receta (id, nombre, descripción). Elegir + ajustar una plantilla existente da mejor resultado que diseñar el árbol desde cero.',
    inputSchema: { recipeId: z.string().describe('id de la receta, p.ej. "compact_card"') },
  }, async ({ recipeId }) => json(
    layoutTemplatesFor(recipeId as RecipeId).map(t => ({ id: t.id, name: t.name, description: t.description })),
  ));

  server.registerTool('describe', {
    title: 'Describir un elemento del modelo',
    description:
      'Devuelve la definición COMPLETA (incluida su doc: cuándo usar, slots, ejemplos) de un elemento del modelo: una receta, un componente, un tipo de campo o un slot-kind.',
    inputSchema: {
      category: z.enum(['recipe', 'component', 'field-type', 'slot-kind']),
      id:       z.string(),
    },
  }, async ({ category, id }) => {
    let item: unknown;
    switch (category) {
      case 'recipe':     item = getRecipeManifest(id as RecipeId); break;
      case 'component':  item = getComponentDef(id as never); break;
      case 'field-type': item = getFieldType(id as never); break;
      case 'slot-kind':  item = (SLOT_ACCEPT_KIND_META as Record<string, unknown>)[id]; break;
    }
    if (!item) {
      return { content: [{ type: 'text' as const, text: `No existe ${category} con id "${id}".` }], isError: true };
    }
    return json(item);
  });

  // ── Validación (el bucle corrector) ───────────────────────────────────
  server.registerTool('validate_composition', {
    title: 'Validar una composición',
    description:
      'Valida una ViewComposition (recipe + layout + slots) contra el modelo Kromia. Devuelve {valid, issues:[{path,message,level}]}. Úsalo en bucle: propón una composición → corrige los issues (usa el `path`) → repite hasta valid=true. `fieldDefs` (opcional) = los campos de la sección, para validar referencias.',
    inputSchema: {
      composition: z.object({ recipe: z.string() }).passthrough()
        .describe('ViewComposition: al menos { recipe }, normalmente + layout + slots'),
      fieldDefs: z.array(z.any()).optional()
        .describe('Campos de la sección [{key,type,behavior?}] para validar referencias (opcional)'),
    },
  }, async ({ composition, fieldDefs }) => json(
    validateComposition(
      composition as unknown as ViewComposition,
      // fieldDefs llega como JSON libre desde la tool; el validador comprueba su forma.
      (fieldDefs ? { fieldDefs } : {}) as Parameters<typeof validateComposition>[1],
    ),
  ));

  return server;
}
