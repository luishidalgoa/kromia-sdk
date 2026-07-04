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
  layoutTemplatesFor, applyLayoutTemplate,
  buildAutoListComposition, buildAutoDetailComposition,
  validateComposition,
} from '@kromia/core';
import type { RecipeId, ViewComposition, FieldDefLike } from '@kromia/core';

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

  // ── Construcción (F2) ──────────────────────────────────────────────────
  const fieldShape = z.object({
    key:      z.string(),
    type:     z.string(),
    label:    z.string().optional(),
    behavior: z.string().optional(),
    options:  z.array(z.string()).optional(),
  }).passthrough();

  /** Devuelve la composición + su validación (el agente itera contra esto). */
  const withValidation = (composition: ViewComposition) =>
    json({ composition, validation: validateComposition(composition) });

  server.registerTool('auto_compose', {
    title: 'Autogenerar una composición',
    description:
      'Genera una ViewComposition SENSATA a partir de los campos de la sección (heurística del SDK: mapea imagen/título/subtítulo/badge/stats a los slots correctos). `kind`: list o detail. Devuelve {composition, validation}. Es el mejor punto de partida — luego ajústala con apply_template o a mano y re-valida.',
    inputSchema: {
      kind:     z.enum(['list', 'detail']),
      fields:   z.array(fieldShape).describe('Campos de la sección [{key,type,behavior?,label?,options?}]'),
      recipeId: z.string().optional().describe('Solo detail: receta destino (p.ej. "editorial"). Default hero_protagonico.'),
    },
  }, async ({ kind, fields, recipeId }) => withValidation(
    kind === 'list'
      ? buildAutoListComposition(fields as FieldDefLike[])
      : buildAutoDetailComposition(fields as FieldDefLike[], recipeId as RecipeId | undefined),
  ));

  server.registerTool('apply_template', {
    title: 'Aplicar una plantilla de layout',
    description:
      'Aplica una plantilla de layout (de las que devuelve list_templates para esa receta) a una composición existente, y valida. Enfoque ROBUSTO: elegir + ajustar una plantilla en vez de diseñar el árbol desde cero. Devuelve {composition, validation}.',
    inputSchema: {
      composition: z.object({ recipe: z.string() }).passthrough(),
      templateId:  z.string(),
    },
  }, async ({ composition, templateId }) => {
    const comp = composition as unknown as ViewComposition;
    const templates = layoutTemplatesFor(comp.recipe);
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) {
      return {
        content: [{ type: 'text' as const, text: `No existe la plantilla "${templateId}" para la receta "${comp.recipe}". Disponibles: ${templates.map(t => t.id).join(', ') || '(ninguna)'}.` }],
        isError: true,
      };
    }
    return withValidation(applyLayoutTemplate(comp, tpl));
  });

  server.registerTool('get_template', {
    title: 'Ver el layout de una plantilla',
    description:
      'Devuelve el árbol de layout que produce una plantilla para una receta, para INSPECCIONARLO antes de aplicarla. `slots` = ids de slots presentes (si se omite, se asumen todos).',
    inputSchema: {
      recipeId:   z.string(),
      templateId: z.string(),
      slots:      z.array(z.string()).optional().describe('ids de slots presentes; omitir = todos'),
    },
  }, async ({ recipeId, templateId, slots }) => {
    const tpl = layoutTemplatesFor(recipeId as RecipeId).find(t => t.id === templateId);
    if (!tpl) {
      return { content: [{ type: 'text' as const, text: `No existe la plantilla "${templateId}" para "${recipeId}".` }], isError: true };
    }
    const has = (id: string) => (slots ? slots.includes(id) : true);
    return json({ layout: tpl.build(has), appearance: tpl.appearance });
  });

  return server;
}
