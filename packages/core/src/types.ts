/**
 * Tipos canónicos del sistema de Recetas (KRO-21 / KRO-40 V1).
 *
 * Una receta define un layout pre-cocinado con slots semánticos fijos. El
 * publisher elige una receta del catálogo y asigna fields del schema a cada
 * slot. El renderer (Studio web + Flutter mobile) usa la misma especificación
 * para garantizar paridad visual.
 *
 * Modelo de datos persistido (dentro de SectionDefinition.viewComposition,
 * y a futuro también dentro de CardSchema):
 *
 *   ViewComposition {
 *     recipe: 'compact_avatar' | ...
 *     action: 'none' | 'navigate_to_detail' | ...
 *     slots: {
 *       avatar:   { fields: ['escudo'] },
 *       title:    { fields: ['nombre'] },
 *       subtitle: { fields: ['ciudad', 'año'], orientation: 'horizontal', separator: ' · ' },
 *     }
 *   }
 *
 * Si una sección/card NO tiene viewComposition declarado, el cliente cae a
 * render genérico (compat retro). Es opcional.
 */

/**
 * IDs de recetas del catálogo. V1 incluye 3 (las V2-V4 añadirán las demás
 * — los tipos están aquí para que el editor pueda validar transiciones
 * sin necesidad de propagar cambios cuando se shippeen nuevas recetas).
 */
export type RecipeId =
  // V1 (KRO-40)
  | 'compact_avatar'
  | 'compact_card'
  | 'hero_protagonico'
  // V2 (KRO-41)
  | 'row_text'
  | 'editorial'
  | 'momento'
  // V3 (KRO-42)
  | 'accordion_simple'
  | 'accordion_with_actions'
  // V5 (KRO-133) — recetas "block-native": sin componente React hardcodeado,
  // su layout es un preset del sistema de bloques y lo pinta el motor genérico.
  | 'feature_card'
  | 'split_panel'
  | 'stat_tile'
  | 'cover_band'
  // V5 — plantillas de DETALLE block-native. (`detail_panel` "Ficha" eliminada
  // KRO-133: quedó idéntica a `editorial` tras unificar la tarjeta de detalle.)
  | 'detail_profile';

/** IDs de acciones. V1: solo none + navigate_to_detail. */
export type ActionId =
  // V1 (KRO-40)
  | 'none'
  | 'navigate_to_detail'
  // V2 (KRO-41)
  | 'modal'
  // V3 (KRO-42)
  | 'expand_inline'
  | 'external_link';

/**
 * Composición de un slot dentro de una receta. Los slots single normalmente
 * tienen `fields.length === 1` (validado por el editor + backend); los
 * composable admiten 1-N y respetan orientation/separator.
 */
export interface SlotComposition {
  /** Keys del schema (CardFieldDefinition.key) asignadas al slot. */
  fields: string[];
  /** Para slots composable. Default 'horizontal'. */
  orientation?: 'horizontal' | 'vertical';
  /** Para slots composable. Default ' · '. */
  separator?: string;
  /**
   * KRO-198 — variante de RENDER de un slot COMPOSABLE (cómo se disponen sus
   * múltiples fields/valores). Solo aplica cuando el slot tiene ≥2 fields o un
   * field array. Default `'auto'`.
   *  - `'auto'`   por behavior: tags→chips, url_list/email_list→enlaces, resto =
   *               join por `separator` respetando `orientation` (comportamiento
   *               histórico — backward-compatible cuando el campo está ausente).
   *  - `'inline'` todos los valores en línea, unidos por `separator`.
   *  - `'list'`   un valor por línea (apilados).
   *  - `'chips'`  cada valor como pastilla/badge.
   *  - `'table'`  filas etiqueta–valor (usa la etiqueta de cada field).
   *  - `'stats'`  fila de estadísticas: cada field como VALOR grande (números
   *               tabulares) + su ETIQUETA debajo en mayúsculas, en columnas con
   *               borde superior/inferior. Replica el componente `stats_row` →
   *               hace que ese estilo SEA expresable con un slot pelado (antes no
   *               lo era) y que descomponer el componente no pierda el estilo.
   *
   * Meta de composición (como orientation/separator) → NO entra al contrato KRP,
   * no bumpea PROTOCOL_VERSION. Flutter lo espeja vía el tipo en `core_dart`.
   */
  composableDisplay?: 'auto' | 'inline' | 'list' | 'chips' | 'table' | 'stats';
  /**
   * KRO-43 V4 — Receta anidada para slots `nestable` (typicamente card-ref).
   * Cada item del array referenciado se renderiza con esta mini-receta en
   * lugar del fallback (chips de IDs). Solo válido en slots marcados con
   * `nestable: true` en el registry. Profundidad máxima 2 (la nested NO
   * puede tener slots con su propia nested — el validador backend lo
   * impone para evitar loops conceptuales).
   */
  nestedComposition?: NestedViewComposition;
  /**
   * KRO-69 V6 — Override de apariencia per-instance. El publisher puede
   * sobreescribir cómo se renderiza el slot dentro de esta composition
   * concreta sin tocar el manifest base de la receta. Solo se aplican las
   * props compatibles con el `kind` del slot (image-* acepta shape/aspect,
   * text-* acepta align/weight/size, etc.). Props no aplicables se ignoran
   * en el render — el editor solo expone las relevantes.
   *
   * Fallback: si `appearance` es undefined o una prop concreta es
   * undefined, el renderer usa el default del manifest base de la receta.
   */
  appearance?: SlotAppearance;
  /**
   * KRO-198 — Estilo CONDICIONAL por valor: la apariencia del slot cambia
   * según el valor de un campo del dato (p.ej. "si rareza == legendaria →
   * texto dorado", "si stock <= 0 → rojo"). El primer caso que matchea gana;
   * su `appearance` se MERGE-a sobre la base (`appearance`). Si ninguno matchea
   * (o no hay dato), se usa la base.
   *
   * Meta de composición (como composableDisplay) → NO entra al contrato KRP, no
   * bumpea PROTOCOL_VERSION. Flutter lo espeja vía el tipo en `core_dart`.
   */
  conditionalStyle?: ConditionalStyle;
  /**
   * KRO-198 — apariencia POR-FIELD dentro de un slot COMPOSABLE. key = field key
   * del schema. Se MERGE-a sobre `appearance` (la base del slot): un field sin
   * entrada aquí hereda la base; uno con entrada la sobreescribe SOLO para ese
   * field. Permite, p.ej., dar a cada "estadística" de un `stats_row` su propio
   * color de texto/fondo. Solo aplica a los displays donde cada field es una
   * unidad visible (chips/stats/table/list/inline); el caso "array de un solo
   * field" no tiene key por-elemento → cae a la base.
   *
   * Meta de composición (como composableDisplay/conditionalStyle) → NO entra al
   * contrato KRP, no bumpea PROTOCOL_VERSION. Flutter lo espeja en `core_dart`.
   */
  fieldAppearances?: Record<string, SlotAppearance>;
}

/** KRO-198 — un caso del estilo condicional. */
export interface ConditionalStyleCase {
  /** Operador de comparación contra `value`. Default 'eq'.
   *  'truthy'/'falsy' ignoran `value` (miran si el campo tiene valor). */
  op?: 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'truthy' | 'falsy';
  /** Valor a comparar (string; gt/gte/lt/lte lo parsean a número). */
  value?: string;
  /** Apariencia a aplicar (merge sobre la base del slot) si el caso matchea. */
  appearance?: SlotAppearance;
}

/** KRO-198 — mapeo declarativo valor-del-dato → apariencia. */
export interface ConditionalStyle {
  /** Key del schema (CardFieldDefinition.key) cuyo valor decide el estilo. */
  fieldKey: string;
  /** Casos evaluados EN ORDEN; el PRIMERO que matchea gana (como un switch). */
  cases: ConditionalStyleCase[];
}

/**
 * KRO-69 V6 — Subset CSS-like de propiedades de apariencia que un slot
 * puede overridear por instancia. Todas opcionales y se interpretan según
 * el `SlotAcceptKind` del slot al que se aplican (el editor filtra qué
 * props enseñar; el renderer ignora las irrelevantes).
 *
 * V1 voluntariamente cerrado a presets (no hex, no px arbitrarios) — los
 * coleccionistas necesitan consistency cross-álbum y los publishers no
 * necesitan freedom infinita.
 */
export interface SlotAppearance {
  // ── Solo image-* ──────────────────────────────────────────────────
  /** Forma del clip — circle típico para avatars, square/rounded para covers. */
  shape?:     'circle' | 'square' | 'rounded';
  /** Aspect ratio del wrapper. 'free' = sin enforce.
   *  9:16 cubre el caso Story/Reel (vertical mobile-first). */
  aspect?:    '1:1' | '16:9' | '4:3' | '3:4' | '9:16' | 'free';
  /** KRO-147 F3 — ajuste de la imagen dentro de su caja. 'cover' (default) =
   *  rellena recortando (con `imageFocus`); 'contain' = encaja entera sin
   *  recortar (deja bandas). */
  objectFit?: 'cover' | 'contain';

  // ── Solo text-* / number / date / url ─────────────────────────────
  /** Alineación horizontal del texto dentro del slot. */
  align?:     'left' | 'center' | 'right';
  /** Peso tipográfico. */
  weight?:    'regular' | 'semibold' | 'bold';
  /** KRO-133 — transformación del texto. 'uppercase' = MAYÚSCULAS con
   *  tracking ancho (estilo "etiqueta"/meta de las recetas Editorial/Momento).
   *  'none' (default) = sin cambio. */
  textTransform?: 'none' | 'uppercase';
  /** KRO-133 — familia tipográfica. 'serif' = con serifas (títulos editoriales);
   *  'sans' (default) = la fuente base. Lo fijan los presets para fidelidad
   *  (p.ej. el título de la receta Editorial). */
  font?: 'sans' | 'serif';
  /** KRO-147 F3 — cursiva. true = `italic`. Default (undefined/false) = recto. */
  italic?: boolean;
  /** KRO-147 F3 — subrayado. true = `underline` (con offset). */
  underline?: boolean;
  /** KRO-147 F3 — interlineado (line-height). 'tight' = compacto, 'normal'
   *  (default) = el de la app, 'relaxed' = aireado (párrafos largos). */
  lineHeight?: 'tight' | 'normal' | 'relaxed';
  /** KRO-147 F3 — espaciado entre letras (tracking). 'tight' = apretado,
   *  'normal' (default), 'wide' = abierto (estilo etiqueta). Independiente
   *  del `tracking-wider` que ya aplica `textTransform: 'uppercase'`. */
  tracking?: 'tight' | 'normal' | 'wide';
  /** KRO-155 — sombra del TEXTO (≠ del box `shadow`): legibilidad de texto claro
   *  sobre imágenes. 'sm'/'md' = sombra sutil/media; 'none' (default) = sin sombra. */
  textShadow?: 'none' | 'sm' | 'md';

  // ── Solo text-* / number / date / url / badge ─────────────────────
  /** Líneas máximas a mostrar antes de truncar con "…". '1' = una sola
   *  línea (nowrap + ellipsis), '2'/'3' = N líneas con wrap, 'none' = sin
   *  truncar (texto completo). Default del manifest = '1' (single-line)
   *  para mantener layout consistente en listas.
   *
   *  Modo CSS — depende del ancho del contenedor. Si quieres un corte
   *  predecible por número de caracteres, usa `truncateChars`. */
  truncate?:  '1' | '2' | '3' | 'none';
  /** Truncado adicional por número de caracteres del texto resultante.
   *  Slice en JS antes de renderizar → `text.slice(0, N) + '…'`. Útil
   *  cuando quieres "siempre ~80 chars" independiente del ancho.
   *  Coexiste con `truncate` (líneas): el slice por chars actúa primero,
   *  y line-clamp envuelve si aún sobrepasa N líneas. Min 1, max 500. */
  truncateChars?: number;
  /** KRO-198 — Render-only meta (NO entra al contrato KRP; no bumpea
   *  PROTOCOL_VERSION). Fuerza que un slot componible "En línea"/horizontal
   *  NO parta a la siguiente línea: aplica `white-space: nowrap` al wrapper
   *  de la fila (los valores + separadores fluyen en una sola línea; si
   *  rebasan el ancho, desbordan en vez de envolver). Opt-in (default = se
   *  permite envolver, para no alterar recetas con `line-clamp-N`). NO usa
   *  `inline-flex` a propósito: eso crearía un formatting context que rompería
   *  la elipsis del `<p class="truncate">` padre de las recetas. */
  noWrap?: boolean;

  // ── Solo image-* ──────────────────────────────────────────────────
  /** Punto focal de la imagen: qué porción se queda visible dentro del
   *  crop (object-cover). El crosshair representa el "centro de interés"
   *  — el publisher arrastra para mover lo que ve el coleccionista cuando
   *  la imagen no cabe entera. Zoom escala la imagen dentro del cuadro
   *  con transform-origin en el mismo punto, para que zoom y posición
   *  jueguen coherente.
   *
   *  Defaults conceptuales: x=50, y=50, zoom=1 (centro sin zoom). Si la
   *  prop está undefined, se usan esos valores en el renderer. */
  imageFocus?: {
    /** 0..100, horizontal. 0 = borde izquierdo, 100 = borde derecho. */
    x:    number;
    /** 0..100, vertical. 0 = borde superior, 100 = borde inferior. */
    y:    number;
    /** 1..3, factor de escala. 1 = sin zoom, 2 = doble tamaño, etc. */
    zoom: number;
  };

  // ── Solo kind=color ────────────────────────────────────────────────
  /** Posición del border accent del wrapper de la receta cuando el field
   *  con behavior=color_hex está mapeado a este slot. Override del default
   *  por receta (top para detail, top para compact cards, left para
   *  accordion/row). 'none' desactiva el accent (solo se ve el swatch en
   *  el slot). 'auto' usa el default de la receta. */
  accentPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none' | 'auto';

  // ── Solo kind=card-ref (mini-cartas de referencias) ───────────────
  /** KRO-133 — columnas de la rejilla de mini-cartas ('1'..'4'). Sin valor =
   *  automático (derivado del cardFormat del álbum vía miniRefGridColumns). */
  refColumns?: '1' | '2' | '3' | '4';
  /** KRO-133 — qué pasa al TOCAR una mini-carta: 'focus' abre la carta real
   *  en modo focus (overlay protagonista); 'none' (default) no es interactiva. */
  refTap?:     'none' | 'focus';
  /** KRO-133 — tamaño NUMÉRICO de cada mini-carta: % del ancho disponible
   *  (10..100). En rejilla = ancho dentro de su columna (100 = llena la
   *  celda); en carrusel = % del ancho del contenedor por carta. Sin valor =
   *  default del modo (100 en rejilla, ~35 en carrusel). */
  refSize?:    number;

  // ── Común (image, text, badge, card-ref) ──────────────────────────
  /** Tamaño relativo — el manifest define el default; aquí ajustas. */
  size?:      'sm' | 'md' | 'lg' | 'xl';
  /** Padding vertical del wrapper del slot — separación con vecinos. */
  paddingY?:  'none' | 'sm' | 'md' | 'lg';
  /** KRO-198 — relleno POR LADO del slot (independiente). Si está presente,
   *  PREVALECE sobre `paddingY`: cada lado (top/right/bottom/left) su tamaño
   *  (ausente = 'none'). Render-only meta (NO contrato KRP). */
  paddingSides?: Partial<Record<'top' | 'right' | 'bottom' | 'left', 'none' | 'sm' | 'md' | 'lg'>>;
  /**
   * KRO-133 F3 — cómo se PRESENTA el contenido textual del slot:
   * 'text' (default) = texto plano; 'badge' = pill/chip (como la rareza/tipo
   * "Fuego"/"Agua" de las recetas). Solo aplica a slots de texto/número.
   */
  display?:   'text' | 'badge';
  /** KRO-133 F3 — color del TEXTO (id de la paleta de `@kromia/core`). */
  textColor?: string;
  /** KRO-133 F3 — color de FONDO del slot (id de paleta) = resaltado / chip. */
  bgColor?:   string;
  /** KRO-147 F3 — opacidad del slot (efecto). '100' (default) = opaco;
   *  '90'/'75'/'50' = translúcido (marcas de agua, fondos sutiles). */
  opacity?:   '100' | '90' | '75' | '50';
  /** KRO-147 F3 — sombra del slot (a nivel slot, no del contenedor). 'none'
   *  (default) = sin sombra; sm/md/lg = elevación creciente (imágenes/badges). */
  shadow?:    'none' | 'sm' | 'md' | 'lg';
}

/**
 * KRO-33 — Calibración fina de la imagen de una carta dentro de su frame
 * (`cardFormat`). El publisher ajusta el encuadre en Flutter (pinch/zoom/drag,
 * UX táctil nativa) y se hace WRITE-BACK a Studio: Studio = editor estructural,
 * Flutter = renderer (no hay cropper web). Studio NO recorta el blob — guarda
 * solo este transform como metadata → recalibrable más tarde sin perder calidad.
 *
 * Es metadata de carta (vive en el DATO de la carta, ver `image-calibration.ts`),
 * NO entra al `.json` del contrato KRP → sin bump de PROTOCOL_VERSION. Render
 * agnóstico: Studio (CSS, `imageTransformStyle`) y Flutter (Transform) lo espejan.
 * Análogo per-CARTA de `SlotAppearance.imageFocus` (que es per-SLOT del template).
 */
export interface ImageTransform {
  /** Punto focal horizontal 0..1 (0.5 = centro): qué parte queda centrada en el frame. */
  offsetX: number;
  /** Punto focal vertical 0..1 (0.5 = centro). */
  offsetY: number;
  /** Escala ≥ 1 (1 = fit natural al frame, >1 = zoom in). */
  scale: number;
  /** Rotación en grados (opcional, default 0; raramente útil). */
  rotation?: number;
}

/**
 * KRO-33 — estado de calibración de la imagen de UNA carta:
 *  - `pending_calibration`: imagen subida pero sin ajustar (Flutter no la ha tocado).
 *  - `calibrated`: tiene un `ImageTransform` aplicado desde Flutter.
 *  - `auto_calibrated`: sin transform; el publisher aceptó el fallback `cover + center`.
 * Es PER-CARTA (no per-composición) → vive en el dato de la carta, nunca en el contrato.
 */
export type CalibrationState = 'pending_calibration' | 'calibrated' | 'auto_calibrated';

/**
 * Composición anidada — subset de ViewComposition sin action/expand/linkField
 * porque la receta anidada se renderiza inline dentro del slot padre (no es
 * interactiva por sí misma, hereda el comportamiento del slot).
 *
 * Los slots de la nested NO pueden tener su propia `nestedComposition`
 * (max depth = 2). El validador backend lo impone.
 */
export interface NestedViewComposition {
  recipe: RecipeId;
  slots:  Record<string, SlotComposition>;
}

/**
 * KRO-94 Fase B — Pantalla destino de una cadena de navegación MULTI-SALTO.
 *
 * Hoy una vista navega a UNA pantalla destino-hoja (`ViewComposition.targetRecipe`,
 * sin acción propia → single-hop). `TargetComposition` permite que la pantalla
 * destino lleve su PROPIA `action` → encadenar (lista → detalle → modal → …).
 *
 * Additive: `ViewComposition.targetRecipe` (hoja) se mantiene por compat retro;
 * las composiciones nuevas usan `ViewComposition.targetComposition`. La cadena
 * está acotada a `MAX_TARGET_DEPTH` (impuesto por el validador) para evitar
 * profundidades absurdas o loops. A diferencia de `NestedViewComposition` (que
 * es una mini-receta INLINE dentro de un slot, no interactiva), cada
 * `TargetComposition` es una PANTALLA navegable.
 *
 * Por hop: `recipe` = la receta de esa pantalla; `action` = la que dispara el
 * SIGUIENTE salto; `slots` (opcional) = composición de la pantalla; `expand`/
 * `linkField` cuando su action es expand_inline/external_link; y su propio
 * `targetComposition` cuando su action es navigate_to_detail/modal.
 */
export interface TargetComposition {
  recipe: RecipeId;
  action: ActionId;
  slots?: Record<string, SlotComposition>;
  expand?: {
    recipe: RecipeId;
    slots:  Record<string, SlotComposition>;
  };
  linkField?: string;
  targetComposition?: TargetComposition;
  /**
   * KRO-133 — la pantalla de detalle es editable como una composición completa
   * (mismo editor que la sección): admite su propio árbol de LAYOUT (modo
   * Bloques), overrides de slots y posición del accent. Additive: las cadenas
   * existentes no los traen → render idéntico (auto-derivado). Estructuralmente
   * compatible con `ViewComposition` para reusar `ViewCompositionEditor`.
   */
  layout?: LayoutContainerNode;
  slotOverrides?: SlotOverrides;
  accentPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none' | 'auto';
}

/**
 * Composición completa de una vista (sección o card) con receta + acción +
 * map de slots. Persistido dentro de SectionDefinition.viewComposition.
 */
export interface ViewComposition {
  recipe: RecipeId;
  action: ActionId;
  slots: Record<string, SlotComposition>;
  expand?: {
    recipe: RecipeId;
    slots:  Record<string, SlotComposition>;
  };
  linkField?: string;
  targetRecipe?: RecipeId;
  /**
   * KRO-94 Fase B — Cadena de navegación MULTI-SALTO. Cuando la action es
   * `navigate_to_detail`/`modal`, la pantalla destino puede llevar su propia
   * `action` y encadenar (lista → detalle → modal → …) en vez de ser una hoja.
   *
   * Additive sobre `targetRecipe`: si está presente, gana sobre `targetRecipe`
   * (que queda como forma-hoja legacy). Profundidad acotada a `MAX_TARGET_DEPTH`
   * (validador). Las composiciones single-hop existentes no lo traen → render
   * idéntico. Los clientes que aún no soportan multi-salto (Flutter previo)
   * ignoran el campo y renderizan el primer destino — degradación elegante.
   */
  targetComposition?: TargetComposition;
  slotOverrides?: SlotOverrides;
  /**
   * KRO-69 follow-up — Personalización del accent (border de color del
   * wrapper de la receta). Si la sección tiene un field `color_hex`, su
   * valor se usa como tinte del strip lateral/superior/etc.
   */
  accentPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none' | 'auto';

  /**
   * KRO-198 — estilo de la LISTA de items de la sección (render-only meta, NO
   * contrato KRP). `separator`: si `true`, dibuja una línea divisoria entre cada
   * item; AUSENTE/`false` = SIN separador (default nuevo). Lo lee el host que
   * pinta la lista (preview de Studio / pantalla de Flutter); el motor de bloques
   * no lo usa (opera dentro de UN item). Additive: las composiciones legacy no lo
   * traen → lista sin línea.
   */
  listStyle?: { separator?: boolean };

  /**
   * KRO-108 — versión del protocolo (KRP) con la que se creó/guardó esta
   * composición. La estampa `injectProtocolVersion` (KRO-63) y el backend la
   * persiste en `viewCompositionSchema`. **Opcional**: las composiciones legacy
   * no la traen. El cliente (Flutter) la lee para su gate de compatibilidad
   * runtime (`isCompatible`) — es por-composición, no por-álbum. Declarada aquí
   * para paridad TS↔persistido↔Dart (el espejo Dart ya la parsea en `fromJson`).
   */
  protocolVersion?: string;

  /**
   * KRO-133 — Árbol de LAYOUT (constructor visual tipo Gutenberg). Describe CÓMO
   * se disponen los slots (contenedores flex/grid/stack anidables + hojas = slots)
   * en vez de dejarlo cableado en el JSX de cada receta. **Opcional + additive**:
   * si falta, el cliente cae al preset de la receta (`migrateSlotsToLayout` deriva
   * un árbol equivalente, no destructivo). Mobile-first: un solo layout, sin
   * breakpoints. Las recetas pasan a ser presets de este árbol (decisión KRO-133).
   */
  layout?: LayoutContainerNode;
}

// ── KRO-133 — Árbol de LAYOUT (constructor visual de recetas) ────────────────
//
// La composición deja de tener el layout cableado en JSX por-receta y pasa a un
// ÁRBOL editable: contenedores (flex/grid/stack) que anidan otros contenedores o
// HOJAS (slots). Los `slots` de ViewComposition siguen definiendo QUÉ fields lleva
// cada slot; este árbol define DÓNDE va cada slot. Presets cerrados (gap/align/…)
// como `SlotAppearance` — el publisher elige de catálogos, no px libres.

/** Disposición de un contenedor. `stack` = cascada/superposición en Z. */
export type LayoutContainerKind = 'flex' | 'grid' | 'stack';
/** flex: eje principal. */
export type LayoutDirection = 'row' | 'column';
/** Alineación en el eje cruzado (flex) / items (grid). */
export type LayoutAlign = 'start' | 'center' | 'end' | 'stretch';
/** Distribución en el eje principal (flex). */
export type LayoutJustify = 'start' | 'center' | 'end' | 'between' | 'around';
/** Separación entre hijos — preset cerrado (no px libre). */
export type LayoutGap = 'none' | 'xs' | 'sm' | 'md' | 'lg';

/**
 * KRO-133 F3 — Colocación de un nodo DENTRO de un contenedor `grid` 2D.
 * 1-based (como CSS grid). Si se omite `colStart`/`rowStart`, el nodo cae por
 * auto-flow en la siguiente celda libre. `colSpan`/`rowSpan` default 1.
 * Es un preset declarativo (sin px/fr libres) → portable a Flutter (F4).
 */
export interface GridPlacement {
  /** Columna inicial 1-based. Omitir = auto-flow. */
  colStart?: number;
  /** Nº de columnas que ocupa (default 1). */
  colSpan?: number;
  /** Fila inicial 1-based. Omitir = auto-flow. */
  rowStart?: number;
  /** Nº de filas que ocupa (default 1). */
  rowSpan?: number;
  /** KRO-133 F3 — alineación del elemento DENTRO de su celda en el eje
   *  horizontal (justify-self). Default = align-items del grid padre. */
  justifySelf?: LayoutAlign;
  /** KRO-133 F3 — alineación del elemento dentro de su celda en el eje
   *  vertical (align-self). Default = align-items del grid padre. */
  alignSelf?: LayoutAlign;
  /** KRO-133 — modo ABSOLUTO: el nodo SALE del flujo del grid y se posiciona
   *  LIBREMENTE dentro de su contenedor (que pasa a `position: relative`). Para
   *  superposiciones libres — el publisher lo ARRASTRA por el lienzo. Cuando
   *  está activo, colStart/colSpan/rowStart/rowSpan se ignoran. */
  position?: 'absolute';
  /** % horizontal de la esquina sup-izq del nodo dentro del contenedor (0-100). */
  x?: number;
  /** % vertical de la esquina sup-izq del nodo dentro del contenedor (0-100). */
  y?: number;
  /** KRO-133 — ANCHO del nodo absoluto en % del contenedor (1-100). Sin valor =
   *  auto (se ajusta al contenido → se ve "reducido"). Pon 100 para ancho completo. */
  w?: number;
  /** KRO-133 — ALTO del nodo absoluto en % del contenedor (1-100). Sin valor =
   *  auto (se ajusta al contenido). */
  h?: number;
}

/**
 * KRO-133 F3 — Color de un token de la paleta (cerrado, sin hex libre → portable
 * a Flutter). Para bordes (y, a futuro, otros tintes).
 */
export type SurfaceColor = 'border' | 'muted' | 'accent' | 'primary' | 'foreground';

/**
 * KRO-133 F3 — Borde ATÓMICO de un contenedor: grosor + lado(s) + color + estilo.
 * Sin `width` no hay borde. Todo cerrado (sin px/hex libres) → portable a Flutter.
 */
export interface SurfaceBorder {
  /** Grosor. Sin esto, no se pinta borde. */
  width?: 'thin' | 'medium' | 'thick';
  /** Lados CONCRETOS donde aplica (multi-selección). Vacío/undefined = los 4. */
  sides?: Array<'top' | 'right' | 'bottom' | 'left'>;
  /** Color del borde — id de la paleta de `@kromia/core` (token de tema como
   *  'border'/'accent' o color como 'red-500'). Default 'border'. */
  color?: string;
  /** Estilo de línea. Default 'solid'. */
  style?: 'solid' | 'dashed' | 'dotted';
}

/**
 * KRO-133 F3 — Decoración RICA de un CONTENEDOR (presets cerrados, sin hex/px
 * libre → portable a Flutter). Para "vestir" cajas: fondo, borde atómico,
 * esquinas, sombra y relleno. Todo opcional; ausente = sin decoración.
 */
export interface ContainerSurface {
  /** Fondo de la caja (token semántico; 'primary'/'accent' = tinte suave). */
  background?: 'none' | 'card' | 'muted' | 'accent' | 'primary';
  /** KRO-133 F3 — color de fondo de la PALETA amplia (id; prevalece sobre
   *  `background` si está presente). Es el fondo de la CARD (del contenedor). */
  bgColor?:   string;
  /** KRO-198 — color de fondo de la PANTALLA que ALOJA la card (id de paleta),
   *  INDEPENDIENTE de `bgColor` (= fondo de la card). La pantalla se deriva
   *  `screenBgHex(screenBgColor ?? bgColor)` — un punto más oscuro para que las
   *  cartas RESALTEN por elevación. Solo aplica al contenedor RAÍZ (la pantalla
   *  vive fuera de la card). Render-only meta (NO contrato KRP, igual que
   *  `cornerRadii`/`paddingSides`). Si se toca el fondo de la CARD, este campo NO
   *  cambia → editar la card no mueve la pantalla. El acabado setea ambos. */
  screenBgColor?: string;
  /** KRO-198 — color de texto BASE del contenedor (id de paleta). Cascada a TODOS
   *  los slots descendientes SIN color propio (herencia CSS): un slot que fija su
   *  textColor en `appearance` lo sobreescribe; el resto hereda éste. Da un "color
   *  de texto global" sin recolorear slot a slot, y alimenta la cabecera del detalle.
   *  El acabado lo setea (antes era por-slot). Render-only meta (NO contrato KRP,
   *  igual que `screenBgColor`/`cornerRadii`). */
  textColor?: string;
  /** Borde atómico (grosor/lado/color/estilo). */
  border?: SurfaceBorder;
  /** Redondeo de esquinas (uniforme, o el tamaño aplicado a `radiusCorners`). */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** KRO-133 F3 — esquinas CONCRETAS donde aplica el radius (multi). Vacío/
   *  undefined = las 4. tl=sup-izq, tr=sup-der, bl=inf-izq, br=inf-der. */
  radiusCorners?: Array<'tl' | 'tr' | 'bl' | 'br'>;
  /** KRO-198 — tamaño de radio POR ESQUINA, independiente. Si está presente,
   *  PREVALECE sobre `radius`/`radiusCorners`: cada esquina usa su propio tamaño
   *  (las ausentes = 'none', rectas). Render-only meta (NO contrato KRP). */
  cornerRadii?: Partial<Record<'tl' | 'tr' | 'bl' | 'br', 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'>>;
  /** Sombra/elevación. */
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Relleno interno (uniforme en los 4 lados). */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** KRO-198 — relleno POR LADO, independiente. Si está presente, PREVALECE
   *  sobre `padding`: cada lado (top/right/bottom/left) usa su propio tamaño
   *  (los lados ausentes = 'none', sin relleno). Render-only meta (NO contrato
   *  KRP, igual que `cornerRadii`). */
  paddingSides?: Partial<Record<'top' | 'right' | 'bottom' | 'left', 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'>>;
}

/** Hoja del árbol: un slot. Sus fields viven en `ViewComposition.slots[slot]`. */
export interface LayoutSlotNode {
  type: 'slot';
  /** Nombre del slot — clave en `ViewComposition.slots`. */
  slot: string;
  /** Peso de crecimiento si el contenedor padre es flex (default 0 = no crece). */
  grow?: number;
  /** KRO-133 F3 — colocación dentro del grid padre (celda + span). */
  place?: GridPlacement;
}

/** Nodo contenedor: dispone a sus hijos según `kind`. */
export interface LayoutContainerNode {
  type: 'container';
  kind: LayoutContainerKind;
  children: LayoutNode[];
  /** KRO-155 — nombre opcional del contenedor, puesto por el publisher para
   *  navegar un layout complejo desde el panel de Capas ("Cabecera", "Cuerpo"…).
   *  Metadata de AUTORÍA: el render lo ignora (no entra al contrato KRP). */
  name?: string;
  /** flex: dirección de los hijos. Default 'column'. (Ignorado en grid/stack.) */
  direction?: LayoutDirection;
  /** Separación entre hijos. Default 'sm'. (stack la ignora — superpone en Z.) */
  gap?: LayoutGap;
  /** Alineación cruzada (flex) / align-items (grid). Default 'stretch'. */
  align?: LayoutAlign;
  /** Distribución principal (flex) / justify-items (grid). Default 'start'. */
  justify?: LayoutJustify;
  /** grid: nº de columnas (1..6). Default 1 (`gridCols → ?? 1`, KRO-166). (Ignorado en flex/stack.) */
  columns?: number;
  /** KRO-133 F3 — grid: nº de filas EXPLÍCITAS (1..6). Omitir = filas implícitas
   *  (auto). Útil para colocar por celda 2D con rowStart/rowSpan. */
  rows?: number;
  /** KRO-133 F3 — dimensionado de las filas del grid: 'auto' (default) = cada
   *  fila se ajusta a su contenido; 'equal' = todas iguales (1fr). */
  rowSize?: 'auto' | 'equal';
  /** KRO-133 F3 — tamaño POR COLUMNA (track sizing). Token por columna:
   *  '1fr'|'2fr'|'3fr' (flexible) | 'auto' | 'content' (ajustado al contenido).
   *  Si todas son '1fr' / undefined → columnas iguales (comportamiento default).
   *  La longitud se ajusta a `columns`. */
  columnSizes?: string[];
  /** KRO-133 F3 — tamaño POR FILA (track sizing). Mismos tokens que columnSizes.
   *  undefined → según `rowSize` (auto/equal). */
  rowSizes?: string[];
  /** KRO-133 F3 — colocación de ESTE contenedor dentro de su grid padre. */
  place?: GridPlacement;
  /** KRO-133 F3 — decoración de la caja (fondo/borde/esquinas/sombra/padding). */
  surface?: ContainerSurface;
  /** KRO-155 — velo de oscurecimiento (scrim) para legibilidad de TEXTO SOBRE
   *  IMAGEN. Gradiente opcional sobre el contenido de FONDO del contenedor
   *  (z-10), por debajo de los hijos ABSOLUTOS (texto, z-20). Presets cerrados:
   *  'bottom'/'top' = degradado oscuro desde ese borde; 'full' = oscurecido
   *  uniforme. Metadata de render (NO entra al contrato KRP), como `surface`.
   *  Complementa a `SlotAppearance.textShadow`. undefined/'none' = sin velo. */
  scrim?: 'none' | 'bottom' | 'top' | 'full';
}

/**
 * KRO-133 Capa 2 — Hoja "componente prefabricado": un bloque COMPUESTO
 * reutilizable (carta, galería de cartas, avatar…) que el motor pinta como UNA
 * unidad, en vez de que el publisher recomponga slots a mano. Resuelve el hueco
 * de que el motor de bloques no podía reproducir lo que las recetas hardcodean.
 *
 * `component` = id del catálogo (`COMPONENT_REGISTRY`); `slots` mapea cada ROL
 * del componente (p.ej. media/title/caption) a un slot de la composición — sus
 * fields viven en `ViewComposition.slots[slotId]` como cualquier otro slot.
 * Espejo Flutter pendiente (KRO-83).
 */
export interface LayoutComponentNode {
  type: 'component';
  /** Id del componente en `COMPONENT_REGISTRY` (p.ej. 'card', 'ref_gallery'). */
  component: string;
  /** Mapa rol → slotId de la composición. */
  slots?: Record<string, string>;
  /** KRO-133 — roles OCULTOS por el publisher: el renderer no pinta ese módulo
   *  (ni siquiera su placeholder — p.ej. el avatar con inicial del hero).
   *  Reversible desde el editor. */
  hidden?: string[];
  /** Colocación de este componente dentro del grid padre (celda + span). */
  place?: GridPlacement;
  /** KRO-155 — decoración del componente (fondo/borde/radius/sombra/relleno),
   *  el MISMO `ContainerSurface` que los contenedores. Lo honran TODOS los prefabs:
   *  `card` lo aplica a su caja interna (media full-bleed + cuerpo); el resto
   *  (stats/badges/título/galerías/separador…) envuelve su salida en la caja
   *  decorada cuando está definido. undefined = look default (sin caja). */
  surface?: ContainerSurface;
  /** KRO-155 — CONFIG genérica per-instancia del componente: bolsa cerrada de
   *  presets (clave → id de opción) que personaliza cómo se renderiza ESTE
   *  prefab, sin añadir un campo tipado por cada parámetro. El esquema de qué
   *  claves/opciones admite cada componente vive en `getComponentConfigSchema`
   *  (metadata de editor, NO en el contrato KRP) y el render mapea los ids a
   *  clases. P.ej. `divider`: { width, thickness, style, tint }. Como `surface`,
   *  es data per-instancia (no contrato); undefined = defaults del componente. */
  config?: Record<string, string>;
}

/** Un nodo del árbol = contenedor, slot-hoja o componente prefabricado. */
export type LayoutNode = LayoutContainerNode | LayoutSlotNode | LayoutComponentNode;

/**
 * KRO-122 — Foil IMPORTABLE por el creador. Un efecto holográfico custom no es
 * un id de catálogo: es una PILA DE CAPAS que el diseñador aporta. Cada capa =
 * una textura (lámina tornasolada / glitter / patrón) + una máscara opcional
 * (grises: dónde brilla) + un modo de fusión. El glare y el tilt 3D los pone el
 * renderer (no se autoran). Render-agnóstico: Studio (CSS) y Flutter (shader)
 * lo espejan. NO entra al `.json` del contrato (es data de álbum) → sin bump.
 */
export type EffectLayerKind = 'foil' | 'glitter' | 'pattern';
export type EffectBlendMode =
  | 'color-dodge' | 'overlay' | 'screen' | 'soft-light' | 'hard-light';

export interface EffectLayer {
  /** Naturaleza de la capa (orienta el render por defecto). */
  kind: EffectLayerKind;
  /** URL de la textura/patrón (la lámina que se superpone). */
  textureUrl: string;
  /** URL de la máscara en grises (blanco = brilla, negro = no). Opcional. */
  maskUrl?: string;
  /** Modo de fusión de la capa sobre la imagen. */
  blend: EffectBlendMode;
  /** Intensidad 0..1 (opacidad efectiva). */
  intensity?: number;
  /** Cuánto se desplaza/cambia la capa con el ángulo/tilt. 0..1. */
  motion?: number;
}

/**
 * KRO-122 — Efecto 3D/foil completo de una carta: pila de capas + profundidad
 * del relieve (parallax). Usado para el foil importable. El render lo consume
 * (Studio `HoloCard`/`VisualEffectLayers`, Flutter su equivalente).
 */
export interface CardEffect3D {
  layers: EffectLayer[];
  /** Fuerza del tilt/parallax 0..1. Default render-defined. */
  depth?: number;
}

/**
 * KRO-130 — Capa de PROFUNDIDAD (parallax) de una carta premium. La ilustración
 * se descompone en cutouts (PNG con transparencia) a distinta profundidad
 * (fondo / medio / frente); al inclinar o girar la carta, cada capa se desplaza
 * a distinto ritmo → 3D real (no un plano que se inclina). Es OPT-IN por carta y
 * vive en el DATO de la carta (a diferencia del foil de KRO-122, que se comparte
 * por tag en `TagStyle.customLayers`: el arte es ÚNICO por carta). El render lo
 * consume (Studio `HoloCard`, Flutter su equivalente con giroscopio). NO entra al
 * `.json` del contrato (es data de carta) → sin bump de PROTOCOL_VERSION.
 */
export type LayerDepth = 'back' | 'mid' | 'front';

export interface CardDepthLayer {
  /** URL del cutout (PNG con transparencia). */
  url: string;
  /** Profundidad relativa (preset cerrado): back=fondo (parallax suave) … front=partículas (parallax fuerte). */
  depth: LayerDepth;
  /** Foil propio OPCIONAL de esta capa (reusa el modelo de foil importable de KRO-122). */
  foil?: EffectLayer;
}

/**
 * KRO-30 — Mapeo VALOR-de-tag → efecto visual. El publisher declara, a nivel
 * álbum (`albumSchema.tagStyles`), qué valores concretos de tag disparan qué
 * efecto al renderizar la carta. Es behavior-on-VALUE, no behavior-on-FIELD:
 * vive aparte de los field-behaviors y referencia el catálogo de
 * `visual-effects.ts` (NO `behaviors.ts`).
 *
 * Una carta con una tag cuyo valor NO tiene `TagStyle` sigue siendo válida —
 * el render simplemente no aplica efecto (fallback: chip neutro). No-destructivo.
 *
 * `config` lleva los params del efecto (ver `VisualEffectDefinition.config`):
 * keys según el efecto, valores dentro del espacio cerrado que declara cada
 * param. `isTagStyleValid` (`tag-styles.ts`) lo valida.
 */
export interface TagStyle {
  /** Valor EXACTO que dispara el efecto (ej. "Holográfica", "legend"). */
  value: string;
  /** ID del efecto del catálogo `visual-effects.ts` (ej. "holographic_effect"). */
  effect: string;
  /** Config opcional del efecto. Keys + espacio de valores los define el efecto. */
  config?: Record<string, string | number>;
  /**
   * KRO-120 — Campo al que se ANCLA el efecto (opcional, additive):
   *  - Con `fieldKey`: el efecto aplica cuando el valor de ESE campo coincide
   *    con `value`. Permite ligar efectos a un campo concreto, incluido el de
   *    rareza (`rating`/`enum`/`ordinal_enum`): p.ej. `{fieldKey:'rareza',
   *    value:'legend', effect:'holographic_effect'}`.
   *  - Sin `fieldKey`: comportamiento clásico (standalone) — matchea el `value`
   *    contra cualquier campo con behavior `tags` de la carta.
   * Varios efectos pueden compartir `(fieldKey, value)` (relación 1:N). No
   * entra al `.json` del contrato (igual que el resto del shape de álbum): es
   * data de álbum, no catálogo → no bumpea PROTOCOL_VERSION.
   */
  fieldKey?: string;
  /**
   * KRO-122 — Foil PERSONALIZADO (importado por el creador): pila de capas
   * propias. Si está presente, el render usa estas capas en vez del efecto de
   * catálogo (`effect` se usa como id estable, p.ej. `'custom_foil'`). additive.
   */
  customLayers?: EffectLayer[];
}

/**
 * KRO-28 — Fuente de rareza: un field `rating`/`enum`/`ordinal_enum` del
 * cardSchema marcado como "fuente de rareza" + la distribución de probabilidad
 * de aparición por valor o por rango. Vive a nivel `cardSchema.raritySource`.
 * La app cliente usa estos pesos al repartir cartas (sobres/pulls). Es metadata
 * del schema — no toca la carta individual.
 */
export interface RarityBucket {
  /** Para `enum`/`ordinal_enum`: valor exacto del field. */
  value?: string;
  /** Para `rating` (numérico): rango inclusivo `[min, max]`. */
  range?: [number, number];
  /** Peso de aparición. Convención 0..100 (se normaliza al repartir). */
  weight: number;
}

export interface RaritySource {
  /** Key del field (rating/enum/ordinal_enum) que define la rareza. */
  fieldKey: string;
  /** Distribución por valor (enum) o por rango (rating). */
  buckets: RarityBucket[];
}

/**
 * KRO-58 V5 — Tipos compartidos. SlotKind define si un slot acepta 1 field
 * o N fields composables.
 */
export type SlotKind = 'single' | 'composable';

/**
 * Clases de field que un slot puede aceptar. Mapping a behaviors/types
 * existentes definido en `classifyField()` de classify.ts.
 * "any" es wildcard útil para slots flexibles tipo "meta" donde el
 * publisher puede meter casi cualquier cosa.
 */
export type SlotAcceptKind =
  | 'image'           // type=image (cualquier imagen scalar — unifica avatar/banner/cover/thumbnail)
  | 'image-avatar'    // [legacy alias de 'image'] mantenido por backward-compat
  | 'image-banner'    // [legacy alias de 'image'] mantenido por backward-compat
  | 'image-cover'     // [legacy alias de 'image'] mantenido por backward-compat
  | 'image-array'     // type=array<image> / behavior: gallery / slideshow / card_multiview
  | 'text-short'      // type: text, select, number (texto plano corto)
  | 'text-long'       // type: textarea (+ behavior markdown/notes/html)
  | 'number'          // type: number (stats — value semantico)
  | 'date'            // behavior: year / iso_date
  | 'badge'           // behavior: rating / enum / ordinal_enum
  | 'color'           // behavior: color_hex (kind propio — no se mezcla con text-short)
  | 'card-ref'        // behavior: card_index_list / card_code_list
  | 'url'             // behavior: url / email / phone (link clicable)
  | 'any';            // wildcard

/**
 * KRO-58 V5 — Overrides per-instance de slots. Vive dentro de una
 * ViewComposition concreta, no en el manifest global.
 */
export interface SlotOverrides {
  disabled?: string[];
  custom?:   CustomSlotDefinition[];
  order?:    string[];
}

/**
 * KRO-58 V5 — Mismo shape que `SlotDefinition` del recipe-registry. Vive
 * aquí porque `ViewComposition.slotOverrides.custom` lo necesita y types.ts
 * no puede importar de recipe-registry (ciclo de imports).
 */
export interface CustomSlotDefinition {
  id:          string;
  label:       string;
  kind:        SlotKind;
  accepts:     SlotAcceptKind[];
  optional?:   boolean;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// KRO-73 — Tipos consumidos por los helpers de presentación (format/auto/
// accent/compose). Son "structural subsets" mínimos: el SDK no se acopla al
// modelo extendido de los consumers (CardFieldDefinition de Studio), solo
// pide lo necesario para hacer su trabajo. Studio les pasa sus fields y por
// structural typing TypeScript acepta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma mínima de un field que los helpers del SDK necesitan para formatear
 * y componer values. Compatible estructuralmente con `CardFieldDefinition`
 * de Studio (que tiene más campos — el SDK solo pide los relevantes).
 */
export interface FieldDefLike {
  key:       string;
  label?:    string;
  type:      string;
  behavior?: string;
  options?:  string[];
  /**
   * Config opcional del behavior, consumida por el formatter / validador.
   * Ej.: `incremental` → `{ pad, prefix, suffix }` (KRO-84); `rating` →
   * `{ max }`; `measurement` → `{ unit }`. Solo presentación / validación —
   * en BD se guarda el valor crudo.
   */
  behaviorConfig?: Record<string, unknown>;
}

/**
 * Resultado de `extractAccentSettings` — color hex resuelto + posición
 * computada (composition override > slot override > recipe default).
 */
export interface AccentSettings {
  color:    string;
  position: 'top' | 'right' | 'bottom' | 'left' | 'none';
  /** KRO-198 — clave del campo `color_hex` que ALIMENTA el acento. El host la usa
   *  para suprimir como celda el slot que mapea ese campo cuando el acento está
   *  activo (su color ya ES la raya, no se duplica como swatch). */
  colorFieldKey?: string;
}
