/**
 * Visual Effects Registry — KRO-30.
 *
 * Catálogo de **efectos visuales** que se disparan en la carta según el VALOR
 * de una tag concreta (no según el field). Categoría NUEVA, deliberadamente
 * SEPARADA de los field-behaviors (`behaviors.ts`):
 *
 *   - `BehaviorDefinition` (year, color_hex, url…) aplica a un **field**
 *     (cómo se edita / renderiza). 1:1 field→behavior.
 *   - `VisualEffectDefinition` (holographic_effect, crown_badge…) aplica al
 *     **valor de una tag** (`TagStyle.effect`). Se superpone como una CAPA
 *     sobre el render de la carta.
 *
 * Ejemplo: una tag con valor `"Holográfica"` mapeada (vía `TagStyle`) al efecto
 * `holographic_effect` hace que el renderer pinte una capa de holograma encima
 * de la imagen principal.
 *
 * Source-of-truth para:
 *  - El mini-editor de "estilos de tag" en Studio (consume el SOURCE, no el .json).
 *  - El cliente Flutter (KRO-65/83) — registro de widgets de efecto que espeja
 *    este catálogo desde el `.json` del KRP / el mirror Dart.
 *  - El generator del KRP (`src/generate.ts`) → sección `visualEffects` del `.json`.
 *  - El validador `isTagStyleValid` (`src/tag-styles.ts`).
 *
 * Reglas:
 *  - Los IDs son **estables**: se serializan en `TagStyle.effect`. Renombrar = breaking.
 *  - El `config` declara el ESPACIO de valores válidos (enum cerrado, rangos
 *    numéricos) — coherente con la filosofía "presets, no hex/px libres" del
 *    resto del modelo. El `label` de cada param es editor-only y NO entra al
 *    `.json` (igual que la doc rica): editarlo no bumpea el contrato.
 *
 * Lo que NO vive aquí: los widgets/overlays que pintan el efecto. Eso es
 * `kromia-mobile` (`lib/widgets/visual-effects/<id>.dart`) y `kromia-studio`
 * (`src/components/album/visual-effects/<Id>Layer.tsx`). El SDK declara el
 * catálogo + el contrato de config; los clientes implementan el render.
 */

import type { EncyclopediaDoc } from './encyclopedia-doc';

/** Capa que el efecto aplica sobre la carta (orienta al renderer). */
export type VisualEffectLayer = 'overlay' | 'badge' | 'filter' | 'border';

/**
 * Un parámetro de configuración de un efecto. El espacio de valores es CERRADO
 * (enum con `options`, o `number` acotado por `min`/`max`) — no hex/px libres,
 * por consistencia cross-álbum. `string` se reserva para refs/urls (ej.
 * `signature_url`). Todos los params son opcionales salvo que `optional: false`.
 */
export interface VisualEffectConfigParam {
  /** Key técnica — lo que se almacena en `TagStyle.config[key]`. Estable. */
  key: string;
  /** Label castellano para el editor de Studio. Editor-only: NO va al `.json`. */
  label: string;
  /** Tipo del valor admitido. */
  type: 'enum' | 'number' | 'string';
  /** Para `type: 'enum'` — valores admitidos (cerrado). */
  options?: string[];
  /** Valor por defecto si el publisher no lo configura. */
  default?: string | number;
  /** Para `type: 'number'` — mínimo inclusivo. */
  min?: number;
  /** Para `type: 'number'` — máximo inclusivo. */
  max?: number;
  /** Si `false`, el publisher DEBE proveer un valor. Default: true (opcional). */
  optional?: boolean;
}

export interface VisualEffectDefinition extends EncyclopediaDoc {
  /** ID técnico, lo que se almacena en `TagStyle.effect`. Estable. */
  id: string;
  /** Nombre castellano para el editor de Studio. */
  displayName: string;
  /** Frase corta para tooltip + onboarding + wiki. */
  description: string;
  /** Capa que aplica el efecto — orienta al renderer (overlay/badge/filter/border). */
  layer: VisualEffectLayer;
  /** Params de config que el publisher puede ajustar. `[]` si el efecto no se configura. */
  config: VisualEffectConfigParam[];
}

const VISUAL_EFFECTS: VisualEffectDefinition[] = [
  {
    id:          'holographic_effect',
    displayName: 'Holográfico',
    description: 'Capa animada arcoíris superpuesta sobre la imagen principal de la carta.',
    layer:       'overlay',
    config: [
      {
        key:     'intensity',
        label:   'Intensidad',
        type:    'enum',
        options: ['low', 'medium', 'high'],
        default: 'medium',
      },
    ],
    whenToUse:
      'Para cartas especiales/raras donde quieres el efecto "foil" de coleccionable físico. Marca una tag (ej. "Holográfica") con este efecto.',
    related: ['concept:tag-style', 'effect:glow_border', 'effect:iridescent_foil'],
    aliases: ['holograma', 'foil', 'holográfica'],
  },
  {
    // KRO-202 — foil iridiscente PARAMETRIZABLE (a diferencia de `holographic_effect`
    // que es un preset cerrado low/medium/high). Cada param es un slider/selector que
    // el editor compartido (TagStylesEditor) pinta solo. TODOS opcionales con `default`
    // → añadir el efecto + estos params es additive (bump minor), no rompe álbumes viejos
    // (caen al default) ni a Flutter (ignora lo que no sabe). Defaults calcados del mockup
    // `Iridescent Card (standalone).html`. Filosofía "presets, no hex libre": el color de
    // foil es el `pattern` (paleta cerrada) y el borde un enum de colores curados.
    id:          'iridescent_foil',
    displayName: 'Iridiscente',
    description: 'Foil iridiscente ajustable: arcoíris que reluce al inclinar, con tono, brillo, grano y borde configurables en vivo.',
    layer:       'overlay',
    config: [
      {
        key:     'pattern',
        label:   'Patrón',
        type:    'enum',
        options: ['spectrum', 'oilslick', 'sunset', 'mint', 'aurora'],
        default: 'spectrum',
      },
      { key: 'hue',        label: 'Tono',        type: 'number', min: 0,   max: 360, default: 0 },
      { key: 'opacity',    label: 'Intensidad',  type: 'number', min: 0,   max: 100, default: 95 },
      { key: 'glow',       label: 'Resplandor',  type: 'number', min: 0,   max: 100, default: 35 },
      { key: 'sheen',      label: 'Reflejo',     type: 'number', min: 0,   max: 100, default: 40 },
      { key: 'shimmer',    label: 'Destello',    type: 'number', min: 0,   max: 100, default: 50 },
      { key: 'noise',      label: 'Grano',       type: 'number', min: 0,   max: 100, default: 16 },
      { key: 'brightness', label: 'Luminosidad', type: 'number', min: 50,  max: 150, default: 105 },
      { key: 'contrast',   label: 'Contraste',   type: 'number', min: 50,  max: 150, default: 100 },
      { key: 'scale',      label: 'Escala',      type: 'number', min: 100, max: 320, default: 210 },
      {
        key:     'blend',
        label:   'Fusión',
        type:    'enum',
        options: ['color-dodge', 'overlay', 'screen', 'soft-light', 'hard-light'],
        default: 'color-dodge',
      },
      {
        // KRO-202 — marco ornamental (9 diseños del mockup `borderSVG`). 'none'
        // = sin borde (interruptor maestro). El render lo dibuja como SVG blanco
        // sobre transparente y lo tiñe con `border_color` vía máscara CSS.
        key:     'border_style',
        label:   'Diseño del borde',
        type:    'enum',
        options: ['none', 'classic', 'double', 'sticker', 'emblema', 'tech', 'feston', 'gotico', 'barroco'],
        default: 'none',
      },
      {
        // Relleno del marco: hueco (solo trazo) · borde (banda decorativa
        // rellena hasta la ventana) · marco (rellena toda la carta menos la
        // ventana del arte). Espejo del modo `fill` del mockup.
        key:     'border_fill',
        label:   'Relleno del borde',
        type:    'enum',
        options: ['hueco', 'borde', 'marco'],
        default: 'hueco',
      },
      { key: 'border_width', label: 'Grosor del borde', type: 'number', min: 0, max: 16, default: 0 },
      {
        key:     'border_color',
        label:   'Color del borde',
        type:    'enum',
        options: ['none', 'gold', 'silver', 'aurora', 'spectrum'],
        default: 'none',
      },
    ],
    whenToUse:
      'Cuando quieras un foil holográfico AJUSTABLE en vivo en vez de un preset cerrado: elige el patrón de arcoíris (Spectrum/Oilslick/Sunset/Mint/Aurora) y afina tono, resplandor, grano y borde con sliders. Igual que el Holográfico pero parametrizable.',
    related: ['concept:tag-style', 'effect:holographic_effect', 'effect:glow_border'],
    aliases: ['iridiscente', 'iridescent', 'tornasol', 'arcoíris', 'foil parametrizable'],
  },
  {
    id:          'crown_badge',
    displayName: 'Insignia',
    description: 'Corona (o tu imagen propia) como distintivo en una esquina, con separación ajustable.',
    layer:       'badge',
    config: [
      {
        key:     'color',
        label:   'Color (corona por defecto)',
        type:    'enum',
        options: ['gold', 'silver', 'bronze'],
        default: 'gold',
      },
      {
        key:     'position',
        label:   'Posición',
        type:    'enum',
        options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        default: 'top-right',
      },
      {
        // Imagen propia de la insignia. Si se provee, sustituye a la corona por
        // defecto (el `color` deja de aplicar). String = URL (igual que signature_url).
        key:      'image_url',
        label:    'Imagen personalizada (URL)',
        type:     'string',
        optional: true,
      },
      {
        // Separación desde el borde horizontal de la esquina (px). Ajuste fino.
        key:     'padding_x',
        label:   'Separación horizontal (px)',
        type:    'number',
        min:     0,
        max:     48,
        default: 4,
      },
      {
        // Separación desde el borde vertical de la esquina (px). En top empuja
        // el icono hacia ABAJO; en bottom, hacia ARRIBA.
        key:     'padding_y',
        label:   'Separación vertical (px)',
        type:    'number',
        min:     0,
        max:     48,
        default: 4,
      },
    ],
    whenToUse:
      'Para destacar cartas "MVP", capitanes o ediciones premiadas con un distintivo (corona o tu propio icono) visible sin tapar la imagen. Ajusta su posición exacta con la separación.',
    related: ['concept:tag-style', 'effect:signed'],
    aliases: ['corona', 'badge', 'distintivo', 'mvp', 'insignia'],
  },
  {
    id:          'vintage_filter',
    displayName: 'Filtro vintage',
    description: 'Filtro sepia / desaturado que envejece la imagen de la carta.',
    layer:       'filter',
    config: [
      {
        key:     'strength',
        label:   'Intensidad',
        type:    'enum',
        options: ['low', 'medium', 'high'],
        default: 'medium',
      },
    ],
    whenToUse:
      'Para ediciones retro / clásicas / "legends" donde el look envejecido refuerza la narrativa de la colección.',
    related: ['concept:tag-style'],
    aliases: ['sepia', 'retro', 'vintage', 'clásica'],
  },
  {
    id:          'glow_border',
    displayName: 'Borde luminoso',
    description: 'Borde luminoso pulsante alrededor de la carta.',
    layer:       'border',
    config: [
      {
        key:     'color',
        label:   'Color',
        type:    'enum',
        options: ['gold', 'blue', 'green', 'red', 'purple'],
        default: 'gold',
      },
    ],
    whenToUse:
      'Para señalar rareza o estado activo sin tapar la imagen — el brillo perimetral llama la atención de forma sutil.',
    related: ['concept:tag-style', 'effect:holographic_effect'],
    aliases: ['glow', 'brillo', 'borde', 'aura'],
  },
  {
    id:          'frozen',
    displayName: 'Congelado',
    description: 'Capa de hielo + partículas superpuesta sobre la carta.',
    layer:       'overlay',
    config: [],
    whenToUse:
      'Para ediciones temáticas (invierno, hielo) o estados especiales. No requiere configuración.',
    related: ['concept:tag-style'],
    aliases: ['hielo', 'frozen', 'congelada'],
  },
  {
    id:          'signed',
    displayName: 'Firmada',
    description: 'Firma estilizada superpuesta sobre la carta.',
    layer:       'overlay',
    config: [
      {
        key:      'signature_url',
        label:    'URL de la firma',
        type:     'string',
        optional: true,
      },
    ],
    whenToUse:
      'Para cartas autografiadas / autenticadas. Si se provee `signature_url`, el cliente la superpone; si no, usa una firma genérica.',
    related: ['concept:tag-style', 'effect:crown_badge'],
    aliases: ['firma', 'autógrafo', 'signed', 'autografiada'],
  },
];

const VISUAL_EFFECTS_BY_ID = Object.fromEntries(
  VISUAL_EFFECTS.map(e => [e.id, e]),
) as Record<string, VisualEffectDefinition>;

/** Acceso por ID. `undefined` si el efecto no está en el catálogo. */
export function getVisualEffect(id: string): VisualEffectDefinition | undefined {
  return VISUAL_EFFECTS_BY_ID[id];
}

/** Catálogo completo en orden de declaración. */
export function allVisualEffects(): ReadonlyArray<VisualEffectDefinition> {
  return VISUAL_EFFECTS;
}

/** Lista de IDs. */
export const VISUAL_EFFECT_IDS = VISUAL_EFFECTS.map(e => e.id) as ReadonlyArray<string>;
