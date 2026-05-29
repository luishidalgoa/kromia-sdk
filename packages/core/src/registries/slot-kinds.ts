/**
 * Slot Acceptance Kinds — metadata humana + props de apariencia editables.
 *
 * Single source of truth de `SlotAcceptKind`. Iterar `SLOT_ACCEPT_KIND_META`
 * garantiza que cualquier nuevo kind añadido al union (en `../types.ts`) se
 * refleje automáticamente en el form de "Añadir slot custom" sin tocar
 * código de UI.
 *
 * Si en el futuro se añade una nueva clase (ej. `audio-clip`), basta con:
 *  1. Añadir el literal al union `SlotAcceptKind` en `../types.ts`.
 *  2. Añadir la entry aquí — TypeScript fuerza exhaustividad via Record.
 *  3. Añadir las props de appearance aplicables en
 *     `APPEARANCE_PROPS_BY_KIND` (mismo file).
 *
 * Los labels evitan jerga interna (no "image-avatar" sino "Imagen") y son
 * cortos pensando en pills inline. La descripción es para tooltip al hover.
 */

import type { SlotAcceptKind } from '../types';
import type { EncyclopediaDoc } from './encyclopedia-doc';

export const SLOT_ACCEPT_KIND_META: Record<SlotAcceptKind, { label: string; description: string } & EncyclopediaDoc> = {
  'text-short': {
    label: 'Texto',
    description: 'Fields tipo text o select (nombre, ciudad, opciones cerradas).',
    whenToUse:
      'Cuando el contenido cabe en una línea y no necesita estilos: nombres, títulos, números cortos, etiquetas. Si vas a meter párrafos, usa un slot de texto largo o un behavior `markdown`.',
    long: `Slots de tipo \`text-short\` aceptan **fields de tipo texto, número o select**. El renderer aplica truncado (1L, 2L, etc.) según la appearance del slot.

No esperes saltos de línea ni Markdown: si el publisher mete asteriscos, se renderizan literales. Para contenido enriquecido usa un slot que acepte \`any\` o el behavior \`markdown\`.`,
    examples: [
      { title: 'Nombre del jugador', description: 'En Mundial 2026 cada cromo lleva el nombre en una sola línea con truncado a 1L.' },
      { title: 'Año de la hermandad', description: 'En Holy Cards aparece como subtítulo del avatar.' },
    ],
    related: ['concept:slot', 'concept:appearance', 'behavior:year'],
    aliases: ['texto corto', 'texto', 'title'],
  },
  'text-long': {
    label: 'Texto largo',
    description: 'Fields tipo textarea (descripción, bio, párrafos). También markdown/notes/html.',
    aliases: ['texto largo', 'descripción', 'párrafo'],
  },
  'number': {
    label: 'Número',
    description: 'Fields tipo number (precio, índice, cantidad). Cualquier behavior numérico.',
    aliases: ['número', 'numero', 'numérico'],
  },
  'date': {
    label: 'Fecha',
    description: 'Fields con behavior year o iso_date (año de fundación, fecha de evento).',
    aliases: ['fecha', 'año', 'anio'],
  },
  'badge': {
    label: 'Badge',
    description: 'Fields con behavior rating, enum u ordinal_enum (rareza, categoría, tier).',
    whenToUse:
      'Para resaltar un dato corto que debe llamar la atención: rareza del cromo, posición del jugador, categoría de la hermandad. Si el dato no necesita destaque, usa `text-short` plano.',
    long: `Los slots \`badge\` se renderizan como **pills coloreadas** (BadgePill). Aceptan:

- Texto plano (string corta)
- Behavior \`enum\` o \`ordinal_enum\` — pinta el badge con color por valor
- Behavior \`rating\` — pinta estrellas en lugar de número

El color del badge respeta el accent del slot si está configurado.`,
    examples: [
      { title: 'Rareza Mythic', description: 'Badge dorado en cards de Magic-style.' },
      { title: 'Posición delantero', description: 'Badge rojo en jugadores del Mundial 2026.' },
    ],
    related: ['behavior:enum', 'behavior:ordinal_enum', 'behavior:rating', 'concept:accent'],
    aliases: ['badge', 'etiqueta', 'pill'],
  },
  'color': {
    label: 'Color',
    description: 'Fields con behavior color_hex. Se renderiza como swatch visual (cuadradito coloreado) y futuro accent del wrapper.',
    whenToUse:
      'Para que el publisher elija un color asociado al ítem (color de la hermandad, color del equipo) que la receta usa como **accent** del card, sin pintar un swatch grande en la UI.',
    long: `Los slots \`color\` casi nunca se renderizan visibles — su rol es **alimentar el accent del card** (la línea de color que rodea o subraya la tarjeta).

Aceptan fields de tipo string con behavior \`color_hex\` (formato \`#RRGGBB\`). Si el slot tiene \`accentPosition: 'none'\`, el color se renderiza como swatch pequeño en la propia posición del slot.`,
    examples: [
      { title: 'Color de la hermandad', description: 'En Holy Cards la línea morada del card viene de este slot.' },
      { title: 'Color del equipo', description: 'Borde verde del Real Betis en Mundial 2026.' },
    ],
    related: ['behavior:color_hex', 'concept:accent'],
    aliases: ['color', 'accent', 'color del equipo'],
  },
  'image': {
    label: 'Imagen',
    description: 'Cualquier field tipo image. El slot decide cómo se renderiza (circular, banner, cover…) según su id y su Apariencia.',
    aliases: ['imagen', 'foto', 'photo'],
  },
  'image-avatar': {
    label: 'Imagen',
    description: '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.',
    whenToUse:
      'Cuando el field es una imagen (subida o URL) y la receta necesita pintarla con un tratamiento concreto (avatar circular, banner panorámico, retrato vertical). La appearance del slot controla forma y aspect ratio.',
    long: `Slots \`image-avatar\` aceptan fields de tipo **image** o **string** (si la string es URL válida). El renderer aplica:

- **Forma** (\`shape\`): círculo, cuadrado o redondeado
- **Aspect ratio** (\`aspect\`): 1:1, 16:9, 4:3, 3:4, 9:16, libre
- **Encuadre** (\`imageFocus\`): centro / superior / inferior + zoom

Cuando el field no tiene imagen, el renderer cae a las **iniciales** del field acompañante (típicamente el nombre del cromo).`,
    examples: [
      { title: 'Foto del jugador', description: 'Banner 16:9 en HeroProtagonico, avatar circular en CompactAvatar.' },
      { title: 'Escudo de la hermandad', description: 'Cuadrado 1:1 con border accent en CompactCard.' },
    ],
    related: ['concept:appearance', 'concept:accent', 'recipe:compact_avatar', 'recipe:hero_protagonico'],
    aliases: ['avatar', 'imagen circular', 'foto circular'],
  },
  'image-cover': {
    label: 'Imagen',
    description: '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.',
    aliases: ['imagen portada', 'cover', 'portada'],
  },
  'image-banner': {
    label: 'Imagen',
    description: '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.',
    aliases: ['imagen banner', 'banner', 'cabecera'],
  },
  'image-array': {
    label: 'Galería',
    description: 'Fields tipo array<image> o behaviors gallery/slideshow/card_multiview.',
    aliases: ['galería', 'galeria', 'carrusel'],
  },
  'card-ref': {
    label: 'Referencia a carta',
    description: 'Fields con behavior card_index_list o card_code_list (referencias a otras cartas).',
    whenToUse:
      'Cuando quieres mostrar otras cartas dentro de una (jugadores de un equipo, capítulos de un libro, momentos de un partido). La receta hija decide cómo se pintan las mini-cards.',
    long: `Los slots \`card-ref\` aceptan **array de referencias** a cartas de la sección que se indique en \`targetRecipe\`. El renderer despliega cada referencia con la **receta anidada** (V4).

- Si \`targetRecipe\` apunta a una receta de tipo \`list\` → grid o lista de mini-cards
- Si apunta a una receta de tipo \`detail\` → no aplicable (validación da error)

El behavior \`card_index_list\` parsea CSV de IDs (\`12,15,20\`) a referencias.`,
    examples: [
      { title: 'Plantilla del equipo', description: 'En HeroProtagonico del equipo, mini-grid 4 cols con CompactAvatar.' },
      { title: 'Momentos del partido', description: 'Lista vertical de RowText con goles + minuto.' },
    ],
    related: ['behavior:card_index_list', 'concept:nested-recipe', 'recipe:compact_avatar'],
    aliases: ['referencia a carta', 'card ref', 'mini-cards'],
  },
  'url': {
    label: 'Enlace',
    description: 'Fields con behavior url, email o phone (links clicables).',
    aliases: ['enlace', 'link', 'url'],
  },
  'any': {
    label: 'Cualquier tipo',
    description: 'Wildcard — acepta cualquier field sin filtrar.',
    whenToUse:
      'Slots de "vertedero" — el slot acepta lo que sea y la receta lo pinta como string. Útil en recetas experimentales o cuando quieres dejar la decisión al publisher sin restricciones.',
    long: `Evita usar \`any\` en recetas finales — el publisher pierde la guía visual ("Soporta:" no informa nada). Prefiere kinds tipados (\`text-short\`, \`image-avatar\`, etc.) que el renderer pueda optimizar.`,
    related: ['concept:slot'],
    aliases: ['cualquier tipo', 'wildcard', 'genérico'],
  },
};

/**
 * Devuelve el catálogo como array, en orden estable, para iteración en UI.
 */
export function getSlotAcceptKindOptions(): Array<{ id: SlotAcceptKind; label: string; description: string } & EncyclopediaDoc> {
  return (Object.keys(SLOT_ACCEPT_KIND_META) as SlotAcceptKind[]).map(id => ({
    id,
    ...SLOT_ACCEPT_KIND_META[id],
  }));
}

/**
 * Etiqueta humana corta y separada por " / " para los accepts de un slot.
 * 1 accept → su label ("Avatar"). N accepts → "Texto / Fecha". 'any' →
 * "cualquiera". Usado en el header del SlotEditor para que el publisher
 * entienda qué tipos de field puede asignarle.
 */
export function formatSlotAccepts(
  accepts: ReadonlyArray<SlotAcceptKind>,
): string {
  if (accepts.length === 0) return '';
  if (accepts.includes('any')) return 'cualquiera';
  return accepts.map(k => SLOT_ACCEPT_KIND_META[k]?.label ?? k).join(' / ');
}

// ── KRO-69 V6 — Appearance overrides per-slot ─────────────────────────────
//
// Cada SlotAcceptKind declara qué props de `SlotAppearance` son aplicables.
// El editor (SlotEditor → "Apariencia") consulta este mapa para mostrar
// solo los controles relevantes. El renderer también puede consultarlo
// para ignorar props que llegan pero no aplican.

/** Tag de propiedad editable. Hay un control UI por cada uno. */
export type AppearanceProp =
  | 'shape'
  | 'aspect'
  | 'imageFocus'
  | 'align'
  | 'weight'
  | 'size'
  | 'truncate'
  | 'truncateChars'
  | 'accentPosition'
  | 'paddingY';

const APPEARANCE_PROPS_BY_KIND: Record<SlotAcceptKind, ReadonlyArray<AppearanceProp>> = {
  // KRO-69 follow-up — image unificado. Mismo set de props para los 4
  // (incluidos los 3 legacy aliases que ahora son sinónimos).
  'image':        ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-avatar': ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-banner': ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-cover':  ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-array':  ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'text-short':   ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'text-long':    ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'number':       ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'date':         ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'url':          ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'badge':        ['size', 'truncate', 'truncateChars', 'paddingY'],
  'color':        ['accentPosition', 'size', 'paddingY'],
  'card-ref':     ['paddingY'],
  'any':          ['shape', 'aspect', 'imageFocus', 'align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
};

/**
 * Devuelve la lista de props de `SlotAppearance` editables para un slot
 * cuyo kind/accept es el dado. Un slot con múltiples `accepts` recibe la
 * UNIÓN de props relevantes.
 */
export function getAvailableAppearanceProps(
  accepts: ReadonlyArray<SlotAcceptKind>,
): AppearanceProp[] {
  if (accepts.length === 0) return [];
  const order: AppearanceProp[] = ['shape', 'aspect', 'imageFocus', 'align', 'weight', 'size', 'truncate', 'truncateChars', 'accentPosition', 'paddingY'];
  const union = new Set<AppearanceProp>();
  for (const kind of accepts) {
    for (const prop of APPEARANCE_PROPS_BY_KIND[kind]) {
      union.add(prop);
    }
  }
  return order.filter(p => union.has(p));
}
