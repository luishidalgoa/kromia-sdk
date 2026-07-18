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
  /** KRO-244 — visibilidad CONDICIONADA en el editor: el param solo se muestra si
   *  el valor actual (o default) del param `key` cumple la condición. P.ej. `warp`
   *  solo con geometry='organico'; los params de borde solo con un diseño elegido.
   *  KRO-247 — admite ARRAY de condiciones (AND): `warp` exige geometry='organico'
   *  Y pattern≠'none'. Editor-only: NO va al `.json` (igual que `label`) → editarlo
   *  no bumpea. */
  visibleWhen?: VisualEffectVisibleWhen | VisualEffectVisibleWhen[];
}

/** Una condición de visibilidad editor-only de un param (ver `visibleWhen`). */
export interface VisualEffectVisibleWhen {
  key: string;
  equals?: string;
  notEquals?: string;
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
        // KRO-244 — renombrado "Patrón" → "Paleta" (label editor-only): es la
        // paleta de colores del foil ("el color de foil ES el patrón").
        // KRO-247 — 'none' = SIN paleta: lámina NEUTRA (sin gradiente de color;
        // quedan reflejo blanco, resplandor, grano y borde). Base para combinar
        // con capas importadas (custom_foil). Aditivo (minor).
        key:     'pattern',
        label:   'Paleta',
        type:    'enum',
        options: ['none', 'spectrum', 'oilslick', 'sunset', 'mint', 'aurora', 'midnight'],
        default: 'spectrum',
      },
      // KRO-244 — paleta PERSONALIZADA: 2–4 hex #RRGGBB separados por coma. Si es
      // válida, MANDA sobre `pattern` (mismo criterio que border_color_hex; también
      // sobre 'none' — el editor garantiza la exclusión mutua). El editor la
      // expone como opción "Personalizada" con pickers de color.
      { key: 'pattern_hex', label: 'Paleta personalizada', type: 'string',
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      // KRO-244 — ORIENTACIÓN de las bandas: giro en grados sobre el ángulo nativo
      // del patrón (0 = tal cual el patrón; p.ej. spectrum nace a 115°). Aplica
      // también al conic (aurora, gira el from) y a la paleta personalizada.
      // KRO-247 — los params que solo parametrizan el GRADIENTE de color (angle,
      // hue, opacity, brightness, contrast, scale, blend, geometry, warp) se
      // ocultan con paleta 'none' (visibleWhen, editor-only).
      { key: 'angle', label: 'Orientación', type: 'number', min: 0, max: 360, default: 0,
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      { key: 'hue',        label: 'Tono',        type: 'number', min: 0,   max: 360, default: 0,
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      { key: 'opacity',    label: 'Intensidad',  type: 'number', min: 0,   max: 100, default: 95,
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      { key: 'glow',       label: 'Resplandor',  type: 'number', min: 0,   max: 100, default: 35 },
      { key: 'sheen',      label: 'Reflejo',     type: 'number', min: 0,   max: 100, default: 40 },
      { key: 'shimmer',    label: 'Destello',    type: 'number', min: 0,   max: 100, default: 50 },
      {
        // KRO-256 — MOVIMIENTO autónomo del foil, a elección del diseñador (las
        // cartas físicas premium "viven": el color se desplaza solo, no solo al
        // inclinar). 'auto' = comportamiento clásico (vaivén en rejilla, sigue la
        // inclinación en focus; retro-compat). 'deriva' = las bandas barren la
        // carta en continuo. 'tono' = el matiz cicla en sitio (rotación del
        // iridiscente). 'total' = deriva + tono. La VELOCIDAD la gobierna el
        // `shimmer` existente (receta `FOIL_MOTION_TIMING`). Aditivo (minor).
        key:     'motion',
        label:   'Movimiento',
        type:    'enum',
        options: ['auto', 'deriva', 'tono', 'total'],
        default: 'auto',
      },
      { key: 'noise',      label: 'Grano',       type: 'number', min: 0,   max: 100, default: 16 },
      { key: 'brightness', label: 'Luminosidad', type: 'number', min: 50,  max: 150, default: 105,
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      { key: 'contrast',   label: 'Contraste',   type: 'number', min: 50,  max: 150, default: 100,
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      { key: 'scale',      label: 'Escala',      type: 'number', min: 100, max: 320, default: 210,
        visibleWhen: { key: 'pattern', notEquals: 'none' } },
      {
        key:     'blend',
        label:   'Fusión',
        type:    'enum',
        options: ['color-dodge', 'overlay', 'screen', 'soft-light', 'hard-light'],
        default: 'color-dodge',
        visibleWhen: { key: 'pattern', notEquals: 'none' },
      },
      {
        // KRO-244 — GEOMETRÍA de las bandas del foil. 'bandas' = rayas rectas
        // clásicas (retro-compat: los álbumes existentes no cambian). 'organico' =
        // difracción CURVADA tipo lámina holográfica real (ref. ticket ISKRA):
        // en web, filtro SVG feTurbulence+feDisplacementMap sobre foil+sheen;
        // en Flutter, noise-warp en el fragment shader. Aditivo (minor).
        key:     'geometry',
        label:   'Geometría',
        type:    'enum',
        options: ['bandas', 'organico'],
        default: 'bandas',
        visibleWhen: { key: 'pattern', notEquals: 'none' },
      },
      // KRO-244 — cantidad de ONDULACIÓN de la difracción (solo aplica con
      // geometry='organico'): 0 = casi recto, 100 = muy revuelto. Aditivo.
      // KRO-247 — doble condición (AND): también exige paleta ≠ 'none'.
      { key: 'warp', label: 'Ondulación', type: 'number', min: 0, max: 100, default: 55,
        visibleWhen: [
          { key: 'geometry', equals: 'organico' },
          { key: 'pattern', notEquals: 'none' },
        ] },
      // KRO-248 — MÁSCARA importable por LUMINANCIA (blanco = el foil asoma,
      // negro = oculto), como la del custom_foil. Recorta las capas foil+sheen
      // (glare/grano/borde no). Con layout 'tile' la máscara TESELA el cuadro
      // (escala = % del ancho por tesela) → fondos "papel perforado"/cosmos-holo.
      // Receta compartida: `foilMaskLayout` (custom-foil-recipe.ts). Aditivo (minor).
      { key: 'mask_url', label: 'Máscara (recorte)', type: 'string' },
      {
        key:     'mask_layout',
        label:   'Encaje de la máscara',
        type:    'enum',
        options: ['cover', 'tile'],
        default: 'cover',
        visibleWhen: { key: 'mask_url', notEquals: '' },
      },
      // Escala de la tesela (% del ancho del cuadro) — solo con encaje Mosaico.
      { key: 'mask_scale', label: 'Escala de la máscara', type: 'number', min: 5, max: 100, default: 25,
        visibleWhen: [
          { key: 'mask_url', notEquals: '' },
          { key: 'mask_layout', equals: 'tile' },
        ] },
      {
        // KRO-256 — DESTELLOS de la máscara: un campo de color multicolor de
        // grano fino tras la máscara cuyo matiz CICLA en continuo → cada
        // perforación muestra SU color, distinto del vecino, y todos van rotando
        // (el look "cosmos" de las cartas premium; con paleta 'Ninguna' los
        // orificios dejan de ser solo blancos). 'pastel' = suave/desaturado,
        // 'vivo' = saturado brillante. Receta `FOIL_MASK_SPARKLE`. Aditivo.
        key:     'mask_sparkle',
        label:   'Destellos de la máscara',
        type:    'enum',
        options: ['no', 'pastel', 'vivo'],
        default: 'no',
        visibleWhen: { key: 'mask_url', notEquals: '' },
      },
      {
        // KRO-202 — marco ornamental (9 diseños del mockup `borderSVG`). 'none'
        // = sin borde (interruptor maestro). El render lo dibuja como SVG blanco
        // sobre transparente y lo tiñe con `border_color` vía máscara CSS.
        key:     'border_style',
        label:   'Diseño del borde',
        type:    'enum',
        // KRO-259 — 'custom': el creador sube SU PROPIO troquel (ver
        // border_custom_url). Superset aditivo (minor).
        options: ['none', 'classic', 'double', 'sticker', 'emblema', 'tech', 'feston', 'gotico', 'barroco', 'custom'],
        default: 'none',
      },
      {
        // KRO-259 — DISEÑO PERSONALIZADO del marco: imagen troquel del creador
        // (blanco = diseño, interpretada por LUMINANCIA — mismo contrato visual
        // que los borderSVG de fábrica, que son blanco sobre transparente).
        // La FORMA ya viene dibujada → border_fill/border_width no aplican
        // (ocultos, editor-only); margen (inset), tintes/degradado/textura,
        // brillo del marco y canto siguen aplicando sobre el troquel.
        key:     'border_custom_url',
        label:   'Tu diseño del borde',
        type:    'string',
        visibleWhen: { key: 'border_style', equals: 'custom' },
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
        // KRO-244 — sin diseño elegido, los controles del borde son ruido.
        // KRO-259 — con diseño CUSTOM la forma ya viene dibujada (AND).
        visibleWhen: [
          { key: 'border_style', notEquals: 'none' },
          { key: 'border_style', notEquals: 'custom' },
        ],
      },
      // Ancho de la banda decorativa + margen desde el borde de la carta — los
      // dos números que parametrizan `borderSVG(style, bw, m, fill)` (espejo de
      // los sliders Ancho/Margen del mockup). `border_width` se conserva (0-16)
      // para no romper el contrato; `border_margin` es aditivo (minor). El editor
      // siembra un Ancho visible al elegir un diseño (sin tocar el default).
      { key: 'border_width',  label: 'Ancho del borde',  type: 'number', min: 0, max: 16, default: 0,
        visibleWhen: [
          { key: 'border_style', notEquals: 'none' },
          { key: 'border_style', notEquals: 'custom' },
        ] },
      { key: 'border_margin', label: 'Margen del borde', type: 'number', min: 0, max: 24, default: 6,
        visibleWhen: { key: 'border_style', notEquals: 'none' } },
      {
        key:     'border_color',
        label:   'Color del borde',
        type:    'enum',
        // none=blanco · gold/silver sólidos · aurora=arcoíris fijo · spectrum=sigue
        // al foil · forest/obsidian/plum/steel = tonos oscuros tipo "fondo carta".
        // KRO-249 — el marco gana las paletas RESTANTES del foil como gradientes
        // FIJOS (oilslick/sunset/mint/midnight; 'spectrum' conserva su semántica
        // "sigue al foil"). Superset aditivo (minor).
        options: ['none', 'gold', 'silver', 'aurora', 'spectrum', 'oilslick', 'sunset', 'mint', 'midnight', 'forest', 'obsidian', 'plum', 'steel'],
        default: 'none',
        visibleWhen: { key: 'border_style', notEquals: 'none' },
      },
      // KRO-202 — color HEX personalizado del borde. Si está (#RRGGBB), MANDA sobre
      // `border_color`. Aditivo (string opcional) → no toca el enum. El editor lo
      // expone como opción "Personalizado" con el color-picker del componente.
      { key: 'border_color_hex', label: 'Color personalizado del borde', type: 'string' },
      // KRO-249 — DEGRADADO personalizado del marco: 2–4 hex #RRGGBB separados por
      // coma (mismo formato/ciclo 45% que pattern_hex). Si es válido, MANDA sobre
      // `border_color` (pero NO sobre border_color_hex ni border_texture_url — ver
      // resolveFoilBorderFill). Gestionado por la opción "Degradado…" del control
      // de color del borde (no se pinta suelto).
      // KRO-264 — MULTIBANDA: acepta 2–16 colores con peso opcional (`#hex@1.4`
      // = ancho relativo de su banda). 2–4 sin pesos = look clásico (retro-compat).
      { key: 'border_gradient_hex', label: 'Degradado personalizado del borde', type: 'string' },
      {
        // KRO-264 — CICLO del degradado: % del cuadro que ocupa un ciclo completo
        // antes de repetirse. El foil real cicla ~cada 25-35% con bandas finas;
        // 45 = el clásico (retro-compat). Aditivo (minor).
        key:     'border_gradient_cycle',
        label:   'Ciclo del degradado',
        type:    'number',
        min:     6,
        max:     100,
        default: 45,
        visibleWhen: { key: 'border_gradient_hex', notEquals: '' },
      },
      // KRO-249 — TEXTURA importada del marco (metal cepillado, papel, damasco…).
      // Si está, MANDA sobre todos los tintes. Servida por el proxy de imágenes.
      { key: 'border_texture_url', label: 'Textura del borde', type: 'string',
        visibleWhen: { key: 'border_style', notEquals: 'none' } },
      {
        // KRO-256 — BRILLO del marco: un reflejo especular que BARRE el marco en
        // continuo, encima del fill (capa aparte → "borde metálico por capas",
        // como los marcos foil de las cartas físicas). 'metalico' = banda blanca
        // especular; 'iridiscente' = banda espectral. La velocidad la gobierna
        // `shimmer`. Receta `FOIL_BORDER_SHEEN`. Aditivo (minor).
        key:     'border_sheen',
        label:   'Brillo del marco',
        type:    'enum',
        options: ['no', 'metalico', 'iridiscente'],
        default: 'no',
        visibleWhen: { key: 'border_style', notEquals: 'none' },
      },
    ],
    whenToUse:
      'Cuando quieras un foil holográfico AJUSTABLE en vivo en vez de un preset cerrado: elige el patrón de arcoíris (Spectrum/Oilslick/Sunset/Mint/Aurora) y afina tono, resplandor, grano y borde con sliders. Igual que el Holográfico pero parametrizable.',
    // KRO-247/248/249 — doc rica (NO entra al .json, no bumpea): el sistema
    // completo del efecto para la wiki; menciona los conceptos por su nombre
    // para que el linkify los encadene (máscara, textura del borde…).
    long: `El Iridiscente tiene tres bloques, todos opcionales salvo la paleta:

**1. La lámina de color** — la *paleta* elige el arcoíris (o crea la tuya con *Personalizada*); orientación, tono, escala, geometría *orgánica* con ondulación… La paleta **Ninguna** apaga el color y deja una lámina neutra (reflejo blanco + resplandor + grano): ideal para combinar con capas importadas del foil personalizado sin teñirlas. El **Movimiento** decide si el foil "vive" solo: *auto* (reluce al inclinar), *deriva* (las bandas barren en continuo), *tono* (los colores rotan en sitio) o *total* (ambos) — la velocidad la marca el *Destello*.

**2. La máscara (recorte)** — una imagen en grises que decide *dónde* asoma el foil (blanco = brilla). Con encaje **Sobre el arte** sigue los contornos del dibujo; con **Mosaico** la imagen se repite como tesela (con su escala) — así se hacen los fondos "papel perforado" de las cartas premium físicas. Los **Destellos de la máscara** encienden cada perforación con su propio color, distinto del vecino y rotando en continuo (el look "cosmos"): *pastel* suave o *vivo* saturado.

**3. El marco (borde)** — un diseño (Clásico, Doble, Gótico…) + un *relleno del borde*: **hueco** (solo trazo), **borde** (banda) o **marco** (passe-partout: toda la banda perimetral, el look de carta física premium). Su color puede ser un tinte del catálogo, un color propio, un **degradado personalizado** (p.ej. metálico plateado) o una **textura del borde** — tu propia imagen rellenando el marco, que manda sobre el tinte. El **Brillo del marco** añade encima un reflejo que barre el borde en continuo — *metálico* (destello blanco especular) o *iridiscente* (banda espectral) — el acabado "borde metálico por capas" de las cartas físicas.`,
    related: ['concept:tag-style', 'effect:holographic_effect', 'effect:border-texture'],
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
