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
  allBehaviors, getBehavior, getBehaviorsByType,
  allVisualEffects, getVisualEffect, EFFECT_FACTORY_PRESETS,
  SLOT_ACCEPT_KIND_META,
  layoutTemplatesFor, applyLayoutTemplate,
  buildAutoListComposition, buildAutoDetailComposition,
  validateComposition, validateTagStyles,
  validateAlbumData, validateRaritySource, normalizeRarityWeights,
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

  server.registerTool('list_behaviors', {
    title: 'Listar behaviors',
    description:
      'Lista los BEHAVIORS: lo que le da SIGNIFICADO a un campo por encima de su tipo (rating, iso_date, markdown, card_index_list…). Importa porque el behavior decide en qué SLOT puede entrar el campo, así que elegirlo bien es lo que hace que auto_compose acierte. Son los mismos `behavior` que piden `auto_compose` y `validate_composition` en sus fields/fieldDefs. `forType` filtra por tipo base — y OJO, los tipos base son solo estos siete: text, textarea, number, select, array<string>, array<number>, array<image>. «enum» NO es un tipo base, es un behavior (el de las opciones predefinidas), así que filtrar por él devuelve vacío.',
    inputSchema: {
      forType: z.string().optional()
        .describe('Tipo base: text | textarea | number | select | array<string> | array<number> | array<image>'),
    },
  }, async ({ forType }) => json(
    (forType ? getBehaviorsByType(forType as never) : allBehaviors()).map((b: any) => ({
      id: b.id, displayName: b.displayName, description: b.description,
      applicableTypes: b.applicableTypes, renderAsSlotKind: b.renderAsSlotKind,
    })),
  ));

  server.registerTool('list_effects', {
    title: 'Listar efectos visuales',
    description:
      'Lista los efectos visuales que se aplican a una carta según el VALOR de una tag (iridescent_foil, crown_badge, glow_border…): id, nombre, capa y cuántos parámetros tiene. Índice ligero: pide la ficha completa con describe(category:"visual-effect", id) antes de configurar ninguno. Los efectos son el OTRO eje del diseño, aparte del layout — viven en albumSchema.tagStyles y se validan con validate_tag_styles.',
  }, async () => json(
    (allVisualEffects() as any[]).map(e => ({
      id: e.id, displayName: e.displayName, description: e.description,
      layer: e.layer, paramCount: (e.config ?? []).length,
      hasPresets: Boolean((EFFECT_FACTORY_PRESETS as any)?.[e.id]),
    })),
  ));

  server.registerTool('list_templates', {
    title: 'Listar plantillas de layout',
    description:
      'Lista las plantillas de layout disponibles para una receta (id, nombre, descripción). Elegir + ajustar una plantilla existente da mejor resultado que diseñar el árbol desde cero.',
    inputSchema: { recipeId: z.string().describe('id de la receta, p.ej. "compact_card"') },
  }, async ({ recipeId }) => {
    // Un `[]` significaba dos cosas distintas: «esta receta no tiene plantillas»
    // y «esta receta no existe». El agente leía la primera y se ponía a construir
    // el árbol de layout a mano, que es justo lo que las plantillas evitan.
    if (!getRecipeManifest(recipeId as RecipeId)) {
      return {
        content: [{ type: 'text' as const, text: `No existe la receta "${recipeId}". Válidas: ${allRecipes().map(r => `${r.id} (${r.kind})`).join(', ')}` }],
        isError: true,
      };
    }
    return json(
      layoutTemplatesFor(recipeId as RecipeId).map(t => ({ id: t.id, name: t.name, description: t.description })),
    );
  });

  server.registerTool('describe', {
    title: 'Describir un elemento del modelo',
    description:
      'Devuelve la definición COMPLETA (incluida su doc: cuándo usar, slots, ejemplos) de un elemento del modelo: receta, componente, tipo de campo, slot-kind, behavior o efecto visual. Para `visual-effect` devuelve TODOS sus parámetros con tipo, opciones cerradas, min/max y default, más sus presets de fábrica si los tiene. MIRA SIEMPRE el `visibleWhen` de cada parámetro: uno cuya condición no se cumple es INERTE — el editor lo oculta y el validador lo da por bueno igualmente, así que se puede tener una config valid:true a medio aplicar sin enterarse. En `iridescent_foil`, 21 de sus 31 parámetros dependen de otro.',
    inputSchema: {
      category: z.enum(['recipe', 'component', 'field-type', 'slot-kind', 'behavior', 'visual-effect']),
      id:       z.string(),
    },
  }, async ({ category, id }) => {
    let item: unknown;
    switch (category) {
      case 'recipe':     item = getRecipeManifest(id as RecipeId); break;
      case 'component':  item = getComponentDef(id as never); break;
      case 'field-type': item = getFieldType(id as never); break;
      case 'slot-kind':  item = (SLOT_ACCEPT_KIND_META as Record<string, unknown>)[id]; break;
      case 'behavior':   item = getBehavior(id as never); break;
      case 'visual-effect': {
        const efecto = getVisualEffect(id as never);
        // Los presets son configuraciones válidas ya cocinadas: para «que las
        // legendarias brillen» son mejor punto de partida que rellenar 31
        // parámetros, el mismo papel que una plantilla frente al árbol a mano.
        // Solo `iridescent_foil` tiene, así que el campo va opcional.
        if (efecto) item = { ...efecto, presets: (EFFECT_FACTORY_PRESETS as any)?.[id] };
        break;
      }
    }
    if (!item) {
      // El error dice QUÉ ids valen: sin eso el agente solo sabe que falló, y su
      // siguiente intento es otra adivinanza.
      const validos: Record<string, string[]> = {
        'recipe':        allRecipes().map(r => r.id),
        'component':     (allComponents() as any[]).map(c => c.id),
        'field-type':    (allFieldTypes() as any[]).map(f => f.id),
        'slot-kind':     Object.keys(SLOT_ACCEPT_KIND_META),
        'behavior':      (allBehaviors() as any[]).map(b => b.id),
        'visual-effect': (allVisualEffects() as any[]).map(e => e.id),
      };
      return {
        content: [{ type: 'text' as const, text: `No existe ${category} con id "${id}". Válidos: ${(validos[category] ?? []).join(', ')}` }],
        isError: true,
      };
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

  server.registerTool('validate_tag_styles', {
    title: 'Validar los efectos por valor de tag',
    description:
      'Valida un TagStyle[] (valor de una tag → efecto visual + su config) contra el catálogo real. Es el MISMO bucle corrector que validate_composition pero para el otro eje del diseño: devuelve {valid, issues:[{index,path,level,message}]}; corrige por el `path` y repite. Comprueba que el efecto existe, que cada parámetro está en el catálogo, que los enum caen dentro de sus options y los números dentro de su rango, y que no falta ninguno obligatorio. DOS COSAS QUE NO HACE: (1) no comprueba `visibleWhen`, así que un parámetro inerte pasa como válido — mira la ficha del efecto con describe; (2) combinar efectos DISTINTOS sobre el mismo valor es INTENCIONADO y se apilan, el aviso de duplicado solo salta con el MISMO efecto repetido.',
    inputSchema: {
      tagStyles: z.array(z.object({ value: z.union([z.string(), z.number()]), effect: z.string() }).passthrough())
        .describe('[{value, effect, config?, fieldKey?, customLayers?}]'),
    },
  }, async ({ tagStyles }) => json(validateTagStyles(tagStyles as never)));

  // ── El DATO, no solo la vista ──────────────────────────────────────────
  server.registerTool('validate_album_data', {
    title: 'Validar las cartas de un álbum',
    description:
      'Valida las CARTAS y los datos de sección contra el esquema: tipo, reglas del behavior, obligatorios, valores de enum y referencias entre secciones. Es la otra mitad del contrato — las demás tools validan cómo se VE el álbum, esta valida lo que CONTIENE. Úsala antes de entregar un lote de cartas: una composición puede estar valid:true y las 200 cartas llevar el año como texto. Devuelve {ok, errors:[{scope,itemIndex,fieldKey,rule,message}]}, donde itemIndex y fieldKey señalan la carta y el campo exactos. OJO: `sections` y `sectionsData` son OBLIGATORIOS aunque el álbum no tenga secciones — pasa {} en los dos.',
    inputSchema: {
      cardFields:   z.array(z.any()).describe('Campos de la carta [{key,type,behavior?,options?,required?}]'),
      cards:        z.array(z.record(z.any())).describe('Las cartas a validar'),
      sections:     z.record(z.any()).describe('Definición de las secciones (pasa {} si no hay)'),
      sectionsData: z.record(z.array(z.record(z.any()))).describe('Datos por sección (pasa {} si no hay)'),
    },
  }, async ({ cardFields, cards, sections, sectionsData }) => json(
    validateAlbumData({ cardFields, cards, sections, sectionsData } as never),
  ));

  server.registerTool('validate_rarity_source', {
    title: 'Validar la fuente de rareza',
    description:
      'Valida de qué campo sale la RAREZA y con qué reparto. La rareza es lo que convierte una lista de cartas en un coleccionable: gobierna qué cartas llevan efecto y cómo se componen los sobres, así que conviene fijarla al diseñar el esquema y no después. Comprueba que el campo existe y es elegible (pide behavior rating/enum/ordinal_enum), que los buckets están bien formados, y devuelve los pesos ya NORMALIZADOS — que es el reparto real que va a ocurrir cuando los pesos no suman 100.',
    inputSchema: {
      raritySource: z.object({ fieldKey: z.string() }).passthrough()
        .describe('{fieldKey, buckets:[{label?,value?,range?,weight?}]}'),
      fieldDefs: z.array(z.any()).describe('Campos de la carta, para comprobar que el field existe y es elegible'),
    },
  }, async ({ raritySource, fieldDefs }) => {
    const validation = validateRaritySource(raritySource as never, fieldDefs as never);
    // El reparto REAL, no el que se escribio. La ficha de esta tool lo promete
    // ("devuelve los pesos ya NORMALIZADOS") y hasta ahora solo salia un aviso
    // de que "se normalizaran" -- que deja al agente con la unica cifra que NO
    // va a ocurrir: la suya. Con 30/10 el publisher cree repartir 30 % y
    // reparte 75.
    //
    // Solo cuando la fuente es valida: normalizar unos buckets que el backend
    // va a rechazar seria darle una cifra con pinta de acordada sobre algo que
    // no se va a aplicar.
    const buckets = (raritySource as any)?.buckets;
    return json(
      validation.valid && Array.isArray(buckets) && buckets.length
        ? { ...validation, normalizedBuckets: normalizeRarityWeights(buckets as never) }
        : validation,
    );
  });

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

  /**
   * Los campos que la heurística NO colocó en ningún slot.
   *
   * Sin esto, `auto_compose` devuelve `valid:true` habiendo tirado campos por el
   * camino, y el agente da por buena una composición a la que le falta justo el
   * que le importaba. Pasó en el dogfooding: de cinco campos colocó tres, y uno
   * de los descartados era la RAREZA, que es la que gobierna los efectos.
   *
   * No es un error —una vista de lista no tiene sitio para todo, y eso está
   * bien—, pero tiene que salir en la respuesta para que se pueda decidir.
   */
  function camposFuera(comp: ViewComposition, fields: FieldDefLike[]): string[] {
    const colocados = new Set<string>();
    for (const slot of Object.values((comp.slots ?? {}) as Record<string, { fields?: string[] }>)) {
      for (const k of slot?.fields ?? []) colocados.add(k);
    }
    return fields.map(f => f.key).filter(k => !colocados.has(k));
  }

  server.registerTool('auto_compose', {
    title: 'Autogenerar una composición',
    description:
      'Genera una ViewComposition SENSATA a partir de los campos de la sección (heurística del SDK: mapea imagen/título/subtítulo/badge/stats a los slots correctos). `kind`: list o detail. Es el mejor punto de partida — luego ajústala con apply_template o a mano y re-valida. Devuelve {composition, validation, sinColocar}. MIRA SIEMPRE `sinColocar`: la heurística coloca los campos que caben en la receta elegida y DESCARTA el resto, y aun así la validación sale valid:true — porque una composición sin un campo es perfectamente válida. Si el campo que te importaba aparece ahí, la composición no sirve para lo que querías por mucho que valide.',
    inputSchema: {
      kind:     z.enum(['list', 'detail']),
      fields:   z.array(fieldShape).describe('Campos de la sección [{key,type,behavior?,label?,options?}]'),
      recipeId: z.string().optional().describe('Solo detail: receta destino (p.ej. "editorial"). Default hero_protagonico.'),
    },
  }, async ({ kind, fields, recipeId }) => {
    const campos = fields as FieldDefLike[];
    const composition = kind === 'list'
      ? buildAutoListComposition(campos)
      : buildAutoDetailComposition(campos, recipeId as RecipeId | undefined);
    const sinColocar = camposFuera(composition, campos);
    return json({
      composition,
      validation: validateComposition(composition),
      // Los campos que la heurística no colocó. NO es un error: una vista de
      // lista no tiene sitio para todo. Pero hay que verlo para decidir.
      sinColocar,
      ...(sinColocar.length
        ? { nota: `La heurística no colocó ${sinColocar.length} campo(s): ${sinColocar.join(', ')}. Si alguno importa, muévelo a un slot a mano o usa una receta con más sitio (mira list_recipes / apply_template) y vuelve a validar.` }
        : {}),
    });
  });

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

  // ── Aplicar al álbum real (F3) ─────────────────────────────────────────
  server.registerTool('apply_composition', {
    title: 'Aplicar una composición a un schema real',
    description:
      'Aplica una ViewComposition a la SECCIÓN de un schema de Kromia. SEGURO: (1) valida localmente antes de nada; (2) DRY-RUN por defecto — muestra qué se aplicaría SIN escribir; solo escribe con `confirm:true`. Escribir requiere env `KROMIA_API_URL` + `KROMIA_TOKEN` (Bearer del usuario). El backend versiona el schema (revertible).',
    inputSchema: {
      schemaId:    z.string().describe('id del card-schema destino'),
      sectionKey:  z.string().describe('clave de la sección dentro del schema'),
      composition: z.object({ recipe: z.string() }).passthrough(),
      confirm:     z.boolean().optional().describe('true = ESCRIBE en el backend; ausente/false = dry-run'),
    },
  }, async ({ schemaId, sectionKey, composition, confirm }) => {
    const validation = validateComposition(composition as unknown as ViewComposition);
    if (!validation.valid) {
      return json({ applied: false, reason: 'Composición inválida — corrígela antes de aplicar.', validation });
    }
    if (!confirm) {
      return json({
        applied: false, dryRun: true,
        wouldApply: { schemaId, sectionKey },
        validation,
        note: 'Dry-run: nada escrito. Repite con confirm:true para aplicar de verdad.',
      });
    }
    const base = process.env.KROMIA_API_URL;
    const token = process.env.KROMIA_TOKEN;
    if (!base || !token) {
      return { content: [{ type: 'text' as const, text: 'Para ESCRIBIR faltan las env `KROMIA_API_URL` y/o `KROMIA_TOKEN` en el proceso del MCP.' }], isError: true };
    }
    try {
      const url = `${base.replace(/\/$/, '')}/card-schemas/${encodeURIComponent(schemaId)}/sections/${encodeURIComponent(sectionKey)}/composition`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ composition }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { content: [{ type: 'text' as const, text: `El backend rechazó (${res.status}): ${JSON.stringify(payload)}` }], isError: true };
      }
      return json({ applied: true, result: payload });
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error de red al aplicar: ${(e as Error).message}` }], isError: true };
    }
  });

  return server;
}
