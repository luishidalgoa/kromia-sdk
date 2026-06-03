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
  | 'accordion_with_actions';

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

  // ── Solo text-* / number / date / url ─────────────────────────────
  /** Alineación horizontal del texto dentro del slot. */
  align?:     'left' | 'center' | 'right';
  /** Peso tipográfico. */
  weight?:    'regular' | 'semibold' | 'bold';

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

  // ── Común (image, text, badge, card-ref) ──────────────────────────
  /** Tamaño relativo — el manifest define el default; aquí ajustas. */
  size?:      'sm' | 'md' | 'lg' | 'xl';
  /** Padding vertical del wrapper del slot — separación con vecinos. */
  paddingY?:  'none' | 'sm' | 'md' | 'lg';
}

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
   * KRO-108 — versión del protocolo (KRP) con la que se creó/guardó esta
   * composición. La estampa `injectProtocolVersion` (KRO-63) y el backend la
   * persiste en `viewCompositionSchema`. **Opcional**: las composiciones legacy
   * no la traen. El cliente (Flutter) la lee para su gate de compatibilidad
   * runtime (`isCompatible`) — es por-composición, no por-álbum. Declarada aquí
   * para paridad TS↔persistido↔Dart (el espejo Dart ya la parsea en `fromJson`).
   */
  protocolVersion?: string;
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
  /** Valor EXACTO de la tag que dispara el efecto (ej. "Holográfica"). */
  value: string;
  /** ID del efecto del catálogo `visual-effects.ts` (ej. "holographic_effect"). */
  effect: string;
  /** Config opcional del efecto. Keys + espacio de valores los define el efecto. */
  config?: Record<string, string | number>;
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
}
