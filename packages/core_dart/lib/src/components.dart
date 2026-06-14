/// `components.dart` — KRO-133 Capa 2. Catálogo de COMPONENTES PREFABRICADOS.
/// Espejo 1:1 de `registries/components.ts`. Un componente es un bloque compuesto
/// reutilizable (carta, galería, hero…) que el motor de render pinta como una
/// unidad; el publisher mapea cada ROL a un slot de la composición.
library;

/// Categoría de un componente (agrupa la palette del editor). Catálogo cerrado.
typedef ComponentCategory = String; // 'basic' | 'header' | 'media' | 'cards'

class ComponentCategoryDef {
  final String id;
  final String label;
  final int order;
  const ComponentCategoryDef({required this.id, required this.label, required this.order});
}

const List<ComponentCategoryDef> componentCategories = [
  ComponentCategoryDef(id: 'basic', label: 'Básicos', order: 0),
  ComponentCategoryDef(id: 'header', label: 'Cabeceras', order: 1),
  ComponentCategoryDef(id: 'media', label: 'Imágenes y carruseles', order: 2),
  ComponentCategoryDef(id: 'cards', label: 'Cartas y referencias', order: 3),
];

/// Un "hueco" del componente, mapeable a un slot de la composición.
class ComponentRole {
  /// Id del rol — clave en `LayoutComponentNode.slots`.
  final String id;
  final String label;
  /// Tipos de slot que encajan (mismo catálogo que los slots de receta).
  final List<String> accepts;
  /// Si true, el componente se pinta sin él. Default false (requerido).
  final bool optional;
  const ComponentRole(
      {required this.id, required this.label, this.accepts = const [], this.optional = false});
}

class ComponentDefinition {
  final String id;
  final String displayName;
  final String description;
  final ComponentCategory category;
  final List<ComponentRole> roles;
  const ComponentDefinition({
    required this.id,
    required this.displayName,
    required this.description,
    required this.category,
    required this.roles,
  });
}

/// Catálogo cerrado (orden de declaración estable = TS).
const Map<String, ComponentDefinition> componentRegistry = {
  'card': ComponentDefinition(
    id: 'card',
    displayName: 'Carta',
    description:
        'Tarjeta compuesta: imagen + título + pie y badge opcionales. La unidad visual de un cromo, como un bloque reutilizable.',
    category: 'basic',
    roles: [
      ComponentRole(id: 'media', label: 'Imagen', accepts: ['image', 'image-array']),
      ComponentRole(id: 'title', label: 'Título', accepts: ['text-short']),
      ComponentRole(id: 'caption', label: 'Pie', accepts: ['text-short', 'text-long'], optional: true),
      ComponentRole(id: 'badge', label: 'Badge', accepts: ['badge'], optional: true),
    ],
  ),
  'badge_row': ComponentDefinition(
    id: 'badge_row',
    displayName: 'Fila de badges',
    description:
        'Pinta cada campo del slot como un BADGE separado (p.ej. "Fuego · Rara · Holo" como pills sueltas), en vez de un único pill que envuelve todo. Para varios atributos cortos en línea.',
    category: 'basic',
    roles: [
      ComponentRole(id: 'badges', label: 'Badges', accepts: ['badge', 'text-short']),
    ],
  ),
  'section_title': ComponentDefinition(
    id: 'section_title',
    displayName: 'Título de sección',
    description:
        'Etiqueta de sección en MAYÚSCULAS colocable sobre cualquier bloque. Muestra el valor del campo o, si no hay, su etiqueta — como los rótulos "GALERÍA"/"ESTADÍSTICAS" que hoy solo existen dentro de las galerías.',
    category: 'basic',
    roles: [
      ComponentRole(id: 'text', label: 'Texto', accepts: ['text-short'], optional: true),
    ],
  ),
  'hero_header': ComponentDefinition(
    id: 'hero_header',
    displayName: 'Cabecera hero',
    description:
        'Banner + avatar circular superpuesto + título + subtítulo centrados — la cabecera de la receta "Hero protagónico" como bloque fiel (con placeholder de banner degradado e inicial del título). Se coloca como unidad.',
    category: 'header',
    roles: [
      ComponentRole(id: 'banner', label: 'Banner', accepts: ['image', 'image-array'], optional: true),
      ComponentRole(id: 'avatar', label: 'Avatar', accepts: ['image'], optional: true),
      ComponentRole(id: 'title', label: 'Título', accepts: ['text-short']),
      ComponentRole(id: 'subtitle', label: 'Subtítulo', accepts: ['text-short', 'date', 'number'], optional: true),
    ],
  ),
  'ref_gallery': ComponentDefinition(
    id: 'ref_gallery',
    displayName: 'Galería de cartas',
    description:
        'Rejilla de mini-cartas a partir de un slot de referencias (card-ref). Para cartas relacionadas, plantillas, colecciones.',
    category: 'cards',
    roles: [
      ComponentRole(id: 'refs', label: 'Referencias', accepts: ['card-ref']),
    ],
  ),
  'carousel_peek': ComponentDefinition(
    id: 'carousel_peek',
    displayName: 'Carrusel grande',
    description:
        'Carrusel horizontal de imágenes grandes con swipe: cada imagen ocupa ~70% del ancho y asoma la siguiente (estilo "Hero protagónico"). Para galerías destacadas.',
    category: 'media',
    roles: [
      ComponentRole(id: 'images', label: 'Imágenes', accepts: ['image-array', 'image']),
    ],
  ),
  'carousel_centered': ComponentDefinition(
    id: 'carousel_centered',
    displayName: 'Carrusel centrado',
    description:
        'Carrusel horizontal de tarjetas de imagen centradas con swipe (estilo "Momento"). Pensado para slideshow en móvil.',
    category: 'media',
    roles: [
      ComponentRole(id: 'images', label: 'Imágenes', accepts: ['image-array', 'image']),
    ],
  ),
  'gallery_grid': ComponentDefinition(
    id: 'gallery_grid',
    displayName: 'Galería en mosaico',
    description:
        'Mosaico de imágenes en rejilla de 3 columnas (estilo "Editorial"). Muestra varias imágenes a la vez sin swipe.',
    category: 'media',
    roles: [
      ComponentRole(id: 'images', label: 'Imágenes', accepts: ['image-array', 'image']),
    ],
  ),
  'cards_carousel': ComponentDefinition(
    id: 'cards_carousel',
    displayName: 'Carrusel de cartas',
    description:
        'Carrusel horizontal de cartas referenciadas con swipe — las mini-cartas de la galería en una fila deslizable. Para cartas relacionadas o colecciones largas.',
    category: 'cards',
    roles: [
      ComponentRole(id: 'cards', label: 'Cartas', accepts: ['card-ref']),
    ],
  ),
  'divider': ComponentDefinition(
    id: 'divider',
    displayName: 'Separador',
    description:
        'Línea fina corta y centrada para separar bloques (el "hr" de las recetas de detalle). Decorativo, sin contenido.',
    category: 'basic',
    roles: [],
  ),
  'stats_row': ComponentDefinition(
    id: 'stats_row',
    displayName: 'Fila de estadísticas',
    description:
        'Fila de estadísticas: cada campo del slot se muestra como valor grande + su etiqueta debajo (números tabulares). El bloque "stats" de las recetas de detalle, como componente fiel.',
    category: 'basic',
    roles: [
      ComponentRole(id: 'stats', label: 'Estadísticas', accepts: ['number', 'text-short']),
    ],
  ),
};

/// Todos los componentes (orden de declaración).
List<ComponentDefinition> allComponents() => componentRegistry.values.toList();

/// Definición de un componente por id, o `null` si no existe.
ComponentDefinition? getComponentDef(String id) => componentRegistry[id];

/// Ids del catálogo.
final List<String> componentIds = componentRegistry.keys.toList(growable: false);

// ── KRO-155 — CONFIG genérica per-componente (metadata de editor) ────────────

class ComponentConfigOption {
  final String id;
  final String label;
  const ComponentConfigOption({required this.id, required this.label});
}

class ComponentConfigField {
  final String key;
  final String label;
  final List<ComponentConfigOption> options;
  final String defaultValue;
  const ComponentConfigField(
      {required this.key, required this.label, required this.options, required this.defaultValue});
}

const Map<String, List<ComponentConfigField>> _componentConfigSchemas = {
  'divider': [
    ComponentConfigField(key: 'width', label: 'Ancho', defaultValue: 'short', options: [
      ComponentConfigOption(id: 'short', label: 'Corto'),
      ComponentConfigOption(id: 'wide', label: 'Ancho'),
      ComponentConfigOption(id: 'full', label: 'Completo'),
    ]),
    ComponentConfigField(key: 'thickness', label: 'Grosor', defaultValue: 'hairline', options: [
      ComponentConfigOption(id: 'hairline', label: 'Fino'),
      ComponentConfigOption(id: 'medium', label: 'Medio'),
      ComponentConfigOption(id: 'thick', label: 'Grueso'),
    ]),
    ComponentConfigField(key: 'style', label: 'Estilo', defaultValue: 'solid', options: [
      ComponentConfigOption(id: 'solid', label: 'Sólido'),
      ComponentConfigOption(id: 'dashed', label: 'Discontinuo'),
      ComponentConfigOption(id: 'dotted', label: 'Punteado'),
    ]),
    ComponentConfigField(key: 'tint', label: 'Tono', defaultValue: 'border', options: [
      ComponentConfigOption(id: 'border', label: 'Borde'),
      ComponentConfigOption(id: 'muted', label: 'Tenue'),
      ComponentConfigOption(id: 'strong', label: 'Fuerte'),
    ]),
  ],
};

/// Esquema de CONFIG de un componente (campos personalizables), o `[]` si no tiene.
List<ComponentConfigField> getComponentConfigSchema(String componentId) =>
    _componentConfigSchemas[componentId] ?? const [];
