/**
 * Field Behaviors — registry.
 *
 * Define cómo se INTERPRETA un field más allá de su `type` base. Un field
 * `type=number` puede ser un año (`behavior=year`), un precio
 * (`behavior=currency`), una valoración (`behavior=rating`), etc.
 *
 * Cada behavior declara:
 *  - `applicableTypes`: qué types base lo admiten (el editor filtra el
 *    dropdown de behavior por el type ya elegido).
 *  - `renderAsSlotKind`: en qué slot kind primario encaja al ser
 *    renderizado. Usado por el generator del KRP para serializar
 *    `slotAcceptKinds[*].behaviorIds`.
 *
 * `renderAsSlotKind` debe estar **sincronizado** con la lógica de
 * `classifyField` en `../classify.ts`. Si una de las dos cambia y la otra
 * no, el `.json` del KRP miente.
 *
 * El ID técnico (snake_case, en `id`) es lo que se almacena en BD en
 * `field.behavior`. El `displayName` es solo cosa del UI.
 *
 * Ver `kromia-sdk/playbooks/add-behavior.md` para el flujo de añadir
 * un behavior nuevo.
 */

import type { SlotAcceptKind } from '../types';
import type { EncyclopediaDoc } from './encyclopedia-doc';

export interface BehaviorDefinition extends EncyclopediaDoc {
  /** ID técnico, snake_case. Lo que se almacena en BD. */
  id: string;
  /** Nombre castellano que ve el editor en el dropdown del Studio. */
  displayName: string;
  /** Frase corta para tooltip. */
  description: string;
  /** Tipos de field compatibles. */
  applicableTypes: ReadonlyArray<string>;
  /**
   * Slot kind primario en el que este behavior encaja al ser renderizado.
   * Si está `undefined`, el behavior solo encaja por `type` base (ej:
   * `currency`, `percentage`, `slug` → siguen el kind del `type=number/text`).
   *
   * El generator lo serializa en `slotAcceptKinds[*].behaviorIds` del KRP.
   * Debe estar **sincronizado** con la lógica de `classifyField` en
   * `../classify.ts`.
   */
  renderAsSlotKind?: SlotAcceptKind;
}

const BEHAVIORS: BehaviorDefinition[] = [
  // Fase A
  {
    id:              'card_index_list',
    displayName:     'Lista de cartas',
    description:     'Lista de cartas del álbum referenciadas por su número. Útil para "cartas relacionadas", "cartas del mismo set", etc.',
    applicableTypes: ['array<number>'],
    renderAsSlotKind: 'card-ref',
    whenToUse:
      'Cuando un field apunta a otras cartas del álbum (jugadores de un equipo, episodios de un capítulo). Se usa con slots `card-ref`. La receta hija se define en `targetRecipe`.',
    related: ['kind:card-ref', 'concept:nested-recipe'],
    aliases: ['referencias a carta', 'lista de cartas', 'card list'],
  },
  {
    id:              'url',
    displayName:     'Enlace web',
    description:     'Dirección web (https://…). Se muestra como enlace clicable que abre en una pestaña nueva.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'url',
    whenToUse:
      'Para enlaces a webs externas, perfiles, fichas. Se suele combinar con la acción `external_link` en el slot.',
    related: ['behavior:url_list', 'action:external_link', 'type:text'],
    aliases: ['enlace', 'link', 'web', 'sitio web'],
  },
  {
    id:              'tags',
    displayName:     'Etiquetas',
    description:     'Etiquetas libres tipo Twitter/Instagram. Útiles para categorizar de forma flexible (#novedad, #legendaria, #2025…).',
    applicableTypes: ['array<string>'],
  },
  // Fase D — quick wins
  {
    id:              'email',
    displayName:     'Email',
    description:     'Dirección de correo electrónico. Se muestra con icono y al pulsarla abre el cliente de correo del usuario.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'url',
    whenToUse: 'Datos de contacto en cartas de personas o entidades.',
    related: ['behavior:url', 'behavior:phone'],
    aliases: ['correo', 'correo electrónico', 'mail'],
  },
  {
    id:              'phone',
    displayName:     'Teléfono',
    description:     'Número de teléfono. Se muestra con icono y al pulsarlo el móvil ofrece llamar directamente.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'url',
    whenToUse: 'Contacto telefónico. La validación es laxa — acepta formatos internacionales.',
    related: ['behavior:email', 'behavior:url'],
    aliases: ['teléfono', 'tel', 'móvil', 'celular'],
  },
  {
    id:              'year',
    displayName:     'Año',
    description:     'Año concreto (4 dígitos). Útil para ediciones, temporadas, año de fundación de un equipo, etc.',
    applicableTypes: ['number'],
    renderAsSlotKind: 'date',
    whenToUse:
      'Cuando el campo es un año (de nacimiento, de fundación, de cierre). Distingue del behavior `iso_date` que necesita día/mes/año completos.',
    related: ['behavior:iso_date', 'type:number'],
    aliases: ['año', 'temporada', 'edición'],
  },
  {
    id:              'currency',
    displayName:     'Precio',
    description:     'Cantidad de dinero. El editor pone el símbolo de moneda delante (€, $, £). Útil para valor de mercado, precio de venta, etc.',
    applicableTypes: ['number'],
    whenToUse: 'Precios, valor de mercado del cromo, cuotas. Configurable por código ISO de moneda.',
    related: ['behavior:measurement', 'behavior:percentage'],
    aliases: ['moneda', 'precio', 'importe'],
  },
  // Fase D.2
  {
    id:              'markdown',
    displayName:     'Texto con formato',
    description:     'Texto largo donde puedes usar **negrita**, listas, enlaces, etc. La app pública lo muestra con el formato aplicado.',
    applicableTypes: ['textarea'],
    renderAsSlotKind: 'text-long',
    whenToUse:
      'Para textos largos con formato: biografías, descripciones, notas. **Solo en slots de texto largo** — los slots cortos (text-short) renderizan literal sin parsear.',
    related: ['type:text', 'recipe:editorial', 'recipe:hero_protagonico'],
    aliases: ['markdown', 'formato', 'texto enriquecido'],
  },
  {
    id:              'enum',
    displayName:     'Opciones predefinidas',
    description:     'Una o varias opciones de una lista que tú decides previamente. Útil para "rareza" (común / rara / épica / legendaria), "tipo", etc.',
    applicableTypes: ['array<string>'],
    renderAsSlotKind: 'badge',
    whenToUse:
      'Categorías sin orden lógico: tipo de hermandad (penitencia/gloria), posición del jugador (portero/delantero), rareza (común/raro/mítico). Si hay orden, usa `ordinal_enum`.',
    related: ['behavior:ordinal_enum', 'kind:badge'],
    aliases: ['categorías', 'opciones', 'lista cerrada'],
  },
  {
    id:              'iso_date',
    displayName:     'Fecha',
    description:     'Fecha concreta (día / mes / año). El editor abre un calendario para elegir. Útil para fecha de nacimiento, debut, lanzamiento, etc.',
    applicableTypes: ['text'],
    renderAsSlotKind: 'date',
    whenToUse:
      'Cuando el campo es una fecha completa: cumpleaños, día de un evento, fecha de publicación. Si solo necesitas el año, usa `year`.',
    related: ['behavior:year', 'type:text'],
    aliases: ['fecha', 'date', 'fecha ISO'],
  },
  // Fase D.3
  {
    id:              'slug',
    displayName:     'URL amigable',
    description:     'Texto pensado para aparecer en una URL. Solo minúsculas, números y guiones — sin espacios ni acentos. Útil cuando una carta o sección tiene una página propia con dirección legible (p.ej. /cartas/lionel-messi-2025).',
    applicableTypes: ['text'],
  },
  {
    id:              'percentage',
    displayName:     'Porcentaje',
    description:     'Porcentaje del 0 al 100. El editor añade el símbolo % automáticamente. Útil para descuentos, completitud, probabilidad de aparición, etc.',
    applicableTypes: ['number'],
    whenToUse: 'Stats, ratios, completitud del álbum, % de victorias.',
    related: ['behavior:measurement', 'behavior:rating', 'type:number'],
    aliases: ['porcentaje', 'percent', 'ratio'],
  },
  {
    id:              'rating',
    displayName:     'Valoración',
    description:     'Valoración con estrellas (de 0 a 5 por defecto). El editor las muestra clicables como en cualquier reseña.',
    applicableTypes: ['number'],
    renderAsSlotKind: 'badge',
    whenToUse:
      'Para valoraciones, dificultad, popularidad. El field debe ser numérico. El renderer pinta hasta 5 estrellas según el valor.',
    related: ['behavior:ordinal_enum', 'type:number', 'kind:badge'],
    aliases: ['valoración', 'estrellas', 'puntuación'],
  },
  {
    id:              'color_hex',
    displayName:     'Color',
    description:     'Selector de color con paleta visual. Para el color corporativo de un equipo, el tinte de una rareza (rojo = legendario), el fondo destacado de una sección…',
    // KRO-69 follow-up — color_hex sigue siendo elegible como behavior
    // de type=text (técnicamente el valor se guarda como string hex).
    // El "tipo text no permite color" del publisher se resuelve en
    // classifyField: behavior=color_hex YA NO matchea kind 'text-short'
    // (tiene kind propio 'color').
    applicableTypes: ['text'],
    renderAsSlotKind: 'color',
    whenToUse:
      'Cuando el field representa un color asociado al ítem (color de hermandad, color de equipo). Suele alimentar slots de tipo `color` que se convierten en accent del card.',
    related: ['kind:color', 'concept:accent'],
    aliases: ['color', 'colour', 'color hex'],
  },
  // Fase D.4
  {
    id:              'url_list',
    displayName:     'Lista de enlaces',
    description:     'Lista de enlaces web. Útil para "enlaces relacionados", "redes sociales del jugador", etc. Cada uno se muestra clicable.',
    applicableTypes: ['array<string>'],
    whenToUse:
      'Para múltiples enlaces asociados a un ítem (redes sociales del jugador, webs de la hermandad). Si solo es una URL, usa `url`.',
    related: ['behavior:url', 'action:external_link'],
    aliases: ['lista de enlaces', 'links', 'redes sociales'],
  },
  {
    id:              'email_list',
    displayName:     'Lista de emails',
    description:     'Lista de direcciones de correo. Cada una se muestra clicable y abre el correo del usuario.',
    applicableTypes: ['array<string>'],
  },
  {
    id:              'measurement',
    displayName:     'Medida con unidad',
    description:     'Medida con unidad: peso, altura, volumen, duración… El editor añade la unidad que elijas (cm, kg, ml, min…).',
    applicableTypes: ['number'],
    whenToUse:
      'Altura, peso, distancia, peso de cromo. Mantiene la unidad como sufijo visual fijo en el render.',
    related: ['behavior:percentage', 'type:number'],
    aliases: ['medida', 'unidad', 'magnitud'],
  },
  {
    id:              'notes',
    displayName:     'Notas internas',
    description:     'Texto largo libre para anotaciones que NO se muestran en la app pública. Útil para notas del equipo, recordatorios o información interna.',
    applicableTypes: ['textarea'],
    renderAsSlotKind: 'text-long',
  },
  // Fase D.5.1
  {
    id:              'code',
    displayName:     'Código fuente',
    description:     'Texto en fuente monoespaciada para mostrar código de programación. Solo úsalo si tu álbum tiene cartas relacionadas con software o tutoriales técnicos.',
    applicableTypes: ['textarea'],
  },
  {
    id:              'html',
    displayName:     'HTML avanzado',
    description:     'Para usuarios técnicos. Permite insertar HTML directamente que la app pública renderizará (con limpieza de seguridad). Si no sabes lo que es HTML, usa "Texto con formato".',
    applicableTypes: ['textarea'],
    renderAsSlotKind: 'text-long',
  },
  {
    id:              'year_list',
    displayName:     'Lista de años',
    description:     'Lista de años. Útil para indicar ediciones múltiples, temporadas históricas en las que un jugador jugó, etc. Se añaden uno a uno.',
    applicableTypes: ['array<number>'],
    renderAsSlotKind: 'date',
  },
  // Fase D.5.2 — Image-heavy (array<image>)
  // KRO-69 follow-up — avatar/banner/cover/thumbnail eliminados como
  // behaviors distintos. La forma y aspect los decide ahora el SLOT vía
  // SlotAppearance. Álbumes existentes con field.behavior=avatar/banner/
  // cover/thumbnail siguen funcionando por classifyField + el renderer.
  {
    id:              'gallery',
    displayName:     'Galería de imágenes',
    description:     'Grid de imágenes sin orden semántico. Para fotos de un evento, varias instantáneas del mismo objeto, momentos sueltos.',
    applicableTypes: ['array<image>'],
    renderAsSlotKind: 'image-array',
  },
  {
    id:              'card_multiview',
    displayName:     'Vistas de la carta',
    description:     'Vistas alternativas de la misma carta (frontal, dorso, holo, foil…). Cada slot tiene una etiqueta fija definida en config.labels.',
    applicableTypes: ['array<image>'],
    renderAsSlotKind: 'image-array',
  },
  {
    id:              'slideshow',
    displayName:     'Pase de diapositivas',
    description:     'Imágenes con orden semántico (proceso, secuencia, antes/después). El cliente las muestra como carousel con flechas.',
    applicableTypes: ['array<image>'],
    renderAsSlotKind: 'image-array',
  },
  // Fase D.5.2 — card_code_list (equivalente textual de card_index_list)
  {
    id:              'card_code_list',
    displayName:     'Lista de cartas (por código)',
    description:     'Lista de cartas del mismo álbum referenciadas por su código de texto (p.ej. HC-001, HC-002). Equivalente a "Lista de cartas" pero cuando tu álbum identifica cada carta por código en lugar de por número.',
    applicableTypes: ['array<string>'],
    renderAsSlotKind: 'card-ref',
  },
  // KROM-25 — ordinal_enum: una opción de una lista ORDENADA (rareza, nivel…)
  {
    id:              'ordinal_enum',
    displayName:     'Lista ordenada (jerarquía)',
    description:     'Una opción de una lista cuyo orden importa. Útil para rareza (común → legendaria), niveles, categorías escalonadas. Declara las opciones en el campo "options" del field, ordenadas de menor a mayor.',
    applicableTypes: ['text', 'select'],
    renderAsSlotKind: 'badge',
    whenToUse:
      'Para enums donde el orden importa visualmente: rareza, dificultad, nivel. La rampa de color se aplica automáticamente.',
    related: ['behavior:enum', 'behavior:rating', 'kind:badge'],
    aliases: ['rareza', 'jerarquía', 'nivel', 'enum ordenado'],
  },
  // Bug 2 (sesión 2026-05-28) — request del user durante verificación KRO-70 V1.
  // Counter auto-incrementable. Reside aquí como behavior puro (no toca el
  // renderer base) — la app cliente puede tratarlo como int normal y solo
  // diferenciarse por el formateo en futuras versiones (zero-padding, prefijo).
  {
    id:              'incremental',
    displayName:     'Contador / dorsal',
    description:     'Número auto-incrementable o secuencial. Útil para dorsales (1, 2, 3…), ediciones numeradas, índices ordinales de cromo, números de serie. El editor lo trata como número plano; el formateo opcional (zero-padding, prefijo) se configurará en una iteración futura.',
    applicableTypes: ['number'],
    whenToUse:
      'Cuando el campo es un número que identifica al cromo dentro de una serie: dorsal del jugador (1-99), número de cromo (#001-#250), número de edición. Si solo es un año, usa `year`.',
    long: `Auto-sugerido por keys: \`dorsal\`, \`numero\`, \`num\`, \`serie\`, \`series\`, \`index\`, \`indice\`, \`orden\`, \`order\`, \`seq\`, \`sequence\`.

V1 trata el valor como número plano. Iteraciones futuras añadirán:
- Zero-padding configurable (\`001\` vs \`1\`)
- Prefijo opcional (\`HC-\` → \`HC-001\`)
- Auto-asignación al crear cromos nuevos (siguiente disponible en la sección)`,
    examples: [
      { title: 'Dorsal del jugador', description: 'Mundial 2026 — número de dorsal 1-99 fijo por jugador.' },
      { title: 'Número de cromo', description: 'Holy Cards — cada hermandad lleva un código incremental (#001, #002…).' },
    ],
    related: ['type:number', 'behavior:year'],
    aliases: ['dorsal', 'contador', 'número de serie'],
  },
];

const BY_ID = new Map(BEHAVIORS.map(b => [b.id, b]));

/** Devuelve el behavior con el ID dado, o `undefined` si no existe. */
export function getBehavior(id: string | undefined | null): BehaviorDefinition | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

/** Devuelve todos los behaviors aplicables al `type` dado. */
export function getBehaviorsByType(type: string): BehaviorDefinition[] {
  return BEHAVIORS.filter(b => b.applicableTypes.includes(type));
}

/** Todos los behaviors registrados. */
export function allBehaviors(): BehaviorDefinition[] {
  return BEHAVIORS.slice();
}

// ── Fase E — sugerencias automáticas por key ──────────────────────────────────

interface SuggestionPattern {
  /** Regex case-insensitive contra `field.key` */
  keyMatch: RegExp;
  /** behavior.id a sugerir (debe existir en BEHAVIORS) */
  suggest: string;
}

const SUGGESTION_PATTERNS: SuggestionPattern[] = [
  // text
  { keyMatch: /^(url|web|website|link|enlace|sitio)$/i,          suggest: 'url' },
  { keyMatch: /^(email|correo|mail|contacto|e_?mail)$/i,         suggest: 'email' },
  { keyMatch: /^(phone|tel(efono)?|movil|movile|celular)$/i,     suggest: 'phone' },
  { keyMatch: /^(date|fecha|fundacion|nacimiento|nac(imiento)?)$/i, suggest: 'iso_date' },
  { keyMatch: /^slug$/i,                                          suggest: 'slug' },
  { keyMatch: /^(color|colour)$/i,                                suggest: 'color_hex' },
  // number
  { keyMatch: /^(year|a[nñ]o|temporada|edicion|edition)$/i,       suggest: 'year' },
  { keyMatch: /^(price|precio|cost(e)?|importe|valor)$/i,         suggest: 'currency' },
  { keyMatch: /^(percentage|porcentaje|percent|pct|%)$/i,         suggest: 'percentage' },
  { keyMatch: /^(rating|valoracion|score|puntuacion|puntos|stars)$/i, suggest: 'rating' },
  // Bug 2 (KRO-70 verificación) — auto-detect counter/dorsal/edition fields.
  // Patrones específicos para no pisar 'year' (que ya cubre edicion/edition):
  // priorizamos dorsal/numero/serie/index/orden, los más típicos en cromos.
  { keyMatch: /^(dorsal|numero|n[uú]m|serie|series|index|indice|orden|order|seq|sequence)$/i, suggest: 'incremental' },
  // array<number>
  { keyMatch: /^(cards|cartas|naipes)$/i,                         suggest: 'card_index_list' },
  // array<string>
  { keyMatch: /^(tags|etiquetas|labels|hashtags)$/i,              suggest: 'tags' },
  { keyMatch: /^(urls|enlaces|websites|links)$/i,                 suggest: 'url_list' },
  { keyMatch: /^(emails|correos|mails)$/i,                        suggest: 'email_list' },
  // textarea
  { keyMatch: /^(markdown|md)$/i,                                 suggest: 'markdown' },
  { keyMatch: /^(notes|notas|bio|biografia|comentarios|comments)$/i, suggest: 'notes' },
];

/**
 * Devuelve el id de behavior sugerido para una key + tipo dados, o `undefined`
 * si no hay pattern reconocido o el tipo no es compatible con el behavior.
 *
 * Ejemplo:
 *   suggestBehavior('email', 'text')  → 'email'
 *   suggestBehavior('email', 'number') → undefined  (incompat tipo)
 *   suggestBehavior('foo',   'text')   → undefined  (sin pattern)
 */
export function suggestBehavior(key: string, type: string): string | undefined {
  if (!key) return undefined;
  for (const p of SUGGESTION_PATTERNS) {
    if (!p.keyMatch.test(key)) continue;
    const def = BY_ID.get(p.suggest);
    if (!def) continue;  // behavior no registrado (shouldn't happen)
    if (!def.applicableTypes.includes(type)) continue;
    return p.suggest;
  }
  return undefined;
}
