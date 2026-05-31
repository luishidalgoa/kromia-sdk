/// Recipe Registry — espejo 1:1 de `registries/recipes.ts`.
///
/// Catálogo de recetas (manifests declarativos de slots). Cada receta tiene un
/// `kind` (list / detail / expand) y una lista de `SlotDefinition`. El renderer
/// Flutter usa el manifest para saber qué slots lee de la ViewComposition.
///
/// Mirror de la estructura (id/kind/displayName/description/slots + flags). La
/// doc rica EncyclopediaDoc (whenToUse/long/examples/…) llega vía el `.json`.
library;

/// Definición de un slot dentro de una receta.
class SlotDefinition {
  /// ID interno — coincide con la key en ViewComposition.slots.
  final String id;

  /// Etiqueta visible en el editor.
  final String label;

  /// 'single' (1 field) o 'composable' (1-N fields).
  final String kind;

  /// Qué clases de field acepta (SlotAcceptKind).
  final List<String> accepts;

  /// Si false, la receta requiere ≥1 field aquí para ser válida.
  final bool optional;

  /// Tooltip en el editor + hint visual.
  final String? description;

  /// KRO-43 V4 — si true, el slot admite receta anidada (típico en card-ref).
  final bool nestable;

  const SlotDefinition({
    required this.id,
    required this.label,
    required this.kind,
    required this.accepts,
    this.optional = false,
    this.description,
    this.nestable = false,
  });
}

/// Metadata completa de una receta.
class RecipeManifest {
  final String id;

  /// 'list' (item de sección) | 'detail' (vista al tap) | 'expand' (inline).
  final String kind;
  final String displayName;
  final String description;
  final List<SlotDefinition> slots;

  const RecipeManifest({
    required this.id,
    required this.kind,
    required this.displayName,
    required this.description,
    required this.slots,
  });
}

/// Catálogo V1+V2+V3. Orden de declaración estable (= TS).
const Map<String, RecipeManifest> recipeRegistry = <String, RecipeManifest>{
  'compact_avatar': RecipeManifest(
    id: 'compact_avatar',
    kind: 'list',
    displayName: 'Avatar compacto',
    description:
        'Imagen circular + nombre + texto secundario. Ideal para listas de personas/entidades.',
    slots: [
      SlotDefinition(id: 'avatar', label: 'Avatar', kind: 'single', accepts: ['image']),
      SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
      SlotDefinition(
        id: 'subtitle',
        label: 'Subtítulo',
        kind: 'composable',
        accepts: ['text-short', 'date', 'number'],
        optional: true,
        description:
            'Texto secundario. Puedes componer varios fields con un separador (ciudad · año).',
      ),
      SlotDefinition(
        id: 'meta',
        label: 'Meta',
        kind: 'single',
        accepts: ['text-short', 'date', 'badge'],
        optional: true,
        description: 'Información lateral (categoría, fecha, badge).',
      ),
    ],
  ),
  'compact_card': RecipeManifest(
    id: 'compact_card',
    kind: 'list',
    displayName: 'Mini card',
    description: 'Thumb cuadrada + nombre + subtítulo + badge de rareza/categoría.',
    slots: [
      SlotDefinition(id: 'thumb', label: 'Imagen', kind: 'single', accepts: ['image']),
      SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
      SlotDefinition(
        id: 'subtitle',
        label: 'Subtítulo',
        kind: 'composable',
        accepts: ['text-short', 'date', 'number'],
        optional: true,
      ),
      SlotDefinition(
        id: 'badge',
        label: 'Rareza/categoría',
        kind: 'single',
        accepts: ['badge'],
        optional: true,
        description:
            'Badge destacado (rareza, tipo). Ordinal_enum se ordena por jerarquía declarada.',
      ),
    ],
  ),
  'hero_protagonico': RecipeManifest(
    id: 'hero_protagonico',
    kind: 'detail',
    displayName: 'Hero protagónico',
    description:
        'Banner + avatar central + título + stats + body + galería. Para vistas hero al abrir un item.',
    slots: [
      SlotDefinition(id: 'banner', label: 'Banner superior', kind: 'single', accepts: ['image']),
      SlotDefinition(id: 'avatar', label: 'Avatar', kind: 'single', accepts: ['image']),
      SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
      SlotDefinition(
        id: 'subtitle',
        label: 'Subtítulo',
        kind: 'composable',
        accepts: ['text-short', 'date'],
        optional: true,
      ),
      SlotDefinition(
        id: 'stats',
        label: 'Estadísticas',
        kind: 'composable',
        accepts: ['number'],
        optional: true,
        description: 'Lista de valores numéricos. Cada uno con su label heredado del field.',
      ),
      SlotDefinition(id: 'body', label: 'Cuerpo', kind: 'single', accepts: ['text-long'], optional: true),
      SlotDefinition(id: 'gallery', label: 'Galería', kind: 'single', accepts: ['image-array'], optional: true),
      SlotDefinition(
        id: 'related',
        label: 'Cartas relacionadas',
        kind: 'single',
        accepts: ['card-ref'],
        optional: true,
        nestable: true,
        description:
            'Cada carta referenciada se renderiza con una receta anidada (V4). Sin receta anidada cae a chips con IDs.',
      ),
    ],
  ),
  // ── V2 (KRO-41) ───────────────────────────────────────────────────
  'row_text': RecipeManifest(
    id: 'row_text',
    kind: 'list',
    displayName: 'Fila de texto',
    description:
        'Una sola línea: título + subtítulo a la derecha. Sin imagen. Para listas densas (FAQs, días, partidos).',
    slots: [
      SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
      SlotDefinition(
        id: 'subtitle',
        label: 'Subtítulo',
        kind: 'composable',
        accepts: ['text-short', 'date', 'number'],
        optional: true,
        description: 'Información secundaria a la derecha (fecha, hora, autor).',
      ),
    ],
  ),
  'editorial': RecipeManifest(
    id: 'editorial',
    kind: 'detail',
    displayName: 'Editorial',
    description:
        'Artículo con cover + título grande + meta + body markdown + galería. Para historias largas.',
    slots: [
      SlotDefinition(id: 'cover', label: 'Imagen de cabecera', kind: 'single', accepts: ['image']),
      SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
      SlotDefinition(
        id: 'meta',
        label: 'Meta',
        kind: 'composable',
        accepts: ['date', 'text-short'],
        optional: true,
        description: 'Autor · fecha · etiqueta. Se renderiza en pequeño bajo el título.',
      ),
      SlotDefinition(id: 'body', label: 'Cuerpo', kind: 'single', accepts: ['text-long']),
      SlotDefinition(id: 'gallery', label: 'Galería', kind: 'single', accepts: ['image-array'], optional: true),
    ],
  ),
  'momento': RecipeManifest(
    id: 'momento',
    kind: 'detail',
    displayName: 'Momento',
    description:
        'Fecha prominente + título + subtítulo + body + slideshow. Para efemérides, días, momentos clave.',
    slots: [
      SlotDefinition(
        id: 'date',
        label: 'Fecha',
        kind: 'single',
        accepts: ['date'],
        description: 'Fecha o año destacado tipográficamente en la cabecera.',
      ),
      SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
      SlotDefinition(id: 'subtitle', label: 'Subtítulo', kind: 'single', accepts: ['text-short'], optional: true),
      SlotDefinition(id: 'body', label: 'Cuerpo', kind: 'single', accepts: ['text-long'], optional: true),
      SlotDefinition(
        id: 'slideshow',
        label: 'Slideshow',
        kind: 'single',
        accepts: ['image-array'],
        optional: true,
        description: 'Carrusel horizontal scrollable. Pensado para swipe en móvil.',
      ),
    ],
  ),
  // ── V3 (KRO-42) — recetas de EXPAND ───────────────────────────────
  'accordion_simple': RecipeManifest(
    id: 'accordion_simple',
    kind: 'expand',
    displayName: 'Accordion simple',
    description:
        'Solo cuerpo de texto. Se despliega bajo la card al tap (action=expand_inline).',
    slots: [
      SlotDefinition(
        id: 'body',
        label: 'Cuerpo',
        kind: 'single',
        accepts: ['text-long'],
        description: 'Texto largo (markdown / notes / html) que aparece desplegado.',
      ),
    ],
  ),
  'accordion_with_actions': RecipeManifest(
    id: 'accordion_with_actions',
    kind: 'expand',
    displayName: 'Accordion con acciones',
    description:
        'Cuerpo de texto + botones con enlaces. Para items con CTAs (redes, descargas, recursos).',
    slots: [
      SlotDefinition(id: 'body', label: 'Cuerpo', kind: 'single', accepts: ['text-long']),
      SlotDefinition(
        id: 'actions',
        label: 'Botones',
        kind: 'composable',
        accepts: ['url'],
        description:
            'Lista de fields con behavior url/email/phone. Cada uno se renderiza como botón pulsable.',
      ),
    ],
  ),
};

/// Acceso seguro al manifest por id. `null` si no existe.
RecipeManifest? getRecipeManifest(String id) => recipeRegistry[id];

/// Todos los manifests en orden de declaración.
List<RecipeManifest> allRecipes() => recipeRegistry.values.toList();

/// Recetas filtradas por `kind` (mismas referencias que el registry, no copia).
List<RecipeManifest> allRecipesByKind(String kind) =>
    allRecipes().where((r) => r.kind == kind).toList();
