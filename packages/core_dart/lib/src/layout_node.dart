/// `layout_node.dart` — KRO-133. Modelo del ÁRBOL DE LAYOUT de una composición.
/// Espejo 1:1 de los tipos LayoutNode/LayoutContainerNode/LayoutSlotNode/
/// LayoutComponentNode/GridPlacement/ContainerSurface/SurfaceBorder de types.ts.
///
/// Es dato JSON puro: el publisher lo edita en Studio (canvas WYSIWYG) y el motor
/// de render (este chat, Flutter) lo interpreta a un widget tree equivalente al de
/// @kromia/react. El TS es la fuente de verdad; esto lo espeja.
library;

/// Colocación de un nodo dentro de un contenedor grid (1-based). Espejo de `GridPlacement`.
class GridPlacement {
  final num? colStart; // 1-based
  final num? colSpan; // default 1
  final num? rowStart; // 1-based
  final num? rowSpan; // default 1
  final String? justifySelf; // LayoutAlign
  final String? alignSelf; // LayoutAlign
  /// Modo ABSOLUTO: 'absolute' = fuera del flujo del grid.
  final String? position;
  final num? x; // % 0..100
  final num? y; // % 0..100
  final num? w; // % 1..100
  final num? h; // % 1..100

  const GridPlacement({
    this.colStart,
    this.colSpan,
    this.rowStart,
    this.rowSpan,
    this.justifySelf,
    this.alignSelf,
    this.position,
    this.x,
    this.y,
    this.w,
    this.h,
  });

  factory GridPlacement.fromJson(Map<String, dynamic> j) => GridPlacement(
        colStart: j['colStart'] as num?,
        colSpan: j['colSpan'] as num?,
        rowStart: j['rowStart'] as num?,
        rowSpan: j['rowSpan'] as num?,
        justifySelf: j['justifySelf'] as String?,
        alignSelf: j['alignSelf'] as String?,
        position: j['position'] as String?,
        x: j['x'] as num?,
        y: j['y'] as num?,
        w: j['w'] as num?,
        h: j['h'] as num?,
      );
}

/// Borde atómico de un contenedor. Espejo de `SurfaceBorder`.
class SurfaceBorder {
  final String? width; // 'thin'|'medium'|'thick'
  final List<String>? sides; // top/right/bottom/left
  final String? color; // id de paleta
  final String? style; // solid/dashed/dotted
  const SurfaceBorder({this.width, this.sides, this.color, this.style});

  factory SurfaceBorder.fromJson(Map<String, dynamic> j) => SurfaceBorder(
        width: j['width'] as String?,
        sides: (j['sides'] as List?)?.map((e) => e.toString()).toList(),
        color: j['color'] as String?,
        style: j['style'] as String?,
      );
}

/// Decoración rica de un contenedor/componente. Espejo de `ContainerSurface`.
class ContainerSurface {
  final String? background; // none/card/muted/accent/primary
  final String? bgColor; // id de paleta (prevalece sobre background)
  final SurfaceBorder? border;
  final String? radius; // none/sm/md/lg/xl/full
  final List<String>? radiusCorners; // tl/tr/bl/br
  final String? shadow; // none/sm/md/lg/xl
  final String? padding; // none/xs/sm/md/lg/xl

  /// KRO-217 §15.1 — fondo de la PANTALLA que aloja el contenedor (id de paleta),
  /// independiente de `bgColor`. La pantalla se deriva `screenBgHex(screenBgColor ??
  /// bgColor)` (papel 18% hacia negro). Render-only, fuera del contrato KRP.
  final String? screenBgColor;

  /// KRO-217 §20.1 — color de texto GLOBAL del contenedor (id de paleta): se aplica
  /// como color base de TODO el subárbol (cascada CSS en web; `DefaultTextStyle` en
  /// Flutter). Un slot con `appearance.textColor` propio lo sobreescribe. Es EL dato
  /// que garantiza la legibilidad del acabado (`applyThemePreset` lo persiste con AA).
  /// Render-only, fuera del contrato KRP.
  final String? textColor;

  const ContainerSurface({
    this.background,
    this.bgColor,
    this.border,
    this.radius,
    this.radiusCorners,
    this.shadow,
    this.padding,
    this.screenBgColor,
    this.textColor,
  });

  factory ContainerSurface.fromJson(Map<String, dynamic> j) => ContainerSurface(
        background: j['background'] as String?,
        bgColor: j['bgColor'] as String?,
        border: j['border'] == null
            ? null
            : SurfaceBorder.fromJson(Map<String, dynamic>.from(j['border'] as Map)),
        radius: j['radius'] as String?,
        radiusCorners: (j['radiusCorners'] as List?)?.map((e) => e.toString()).toList(),
        shadow: j['shadow'] as String?,
        padding: j['padding'] as String?,
        screenBgColor: j['screenBgColor'] as String?,
        textColor: j['textColor'] as String?,
      );
}

/// Un nodo del árbol = contenedor, slot-hoja o componente prefabricado.
sealed class LayoutNode {
  const LayoutNode();

  factory LayoutNode.fromJson(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'slot':
        return LayoutSlotNode.fromJson(json);
      case 'component':
        return LayoutComponentNode.fromJson(json);
      case 'container':
      default:
        return LayoutContainerNode.fromJson(json);
    }
  }
}

/// Hoja del árbol: un slot (sus fields viven en `ViewComposition.slots[slot]`).
class LayoutSlotNode extends LayoutNode {
  final String slot;
  final num? grow;
  final GridPlacement? place;
  const LayoutSlotNode({required this.slot, this.grow, this.place});

  factory LayoutSlotNode.fromJson(Map<String, dynamic> j) => LayoutSlotNode(
        slot: (j['slot'] as String?) ?? '',
        grow: j['grow'] as num?,
        place: j['place'] == null
            ? null
            : GridPlacement.fromJson(Map<String, dynamic>.from(j['place'] as Map)),
      );
}

/// Nodo contenedor: dispone a sus hijos según `kind` (flex/grid/stack).
class LayoutContainerNode extends LayoutNode {
  final String kind; // flex/grid/stack
  final List<LayoutNode> children;
  final String? name; // metadata de autoría (el render lo ignora)
  final String? direction; // row/column
  final String? gap; // none/xs/sm/md/lg
  final String? align; // start/center/end/stretch
  final String? justify; // start/center/end/between/around
  final int? columns; // grid 1..6
  final int? rows; // grid 1..6
  final String? rowSize; // auto/equal
  final List<String>? columnSizes;
  final List<String>? rowSizes;
  final GridPlacement? place;
  final ContainerSurface? surface;
  final String? scrim; // none/bottom/top/full

  const LayoutContainerNode({
    this.kind = 'flex',
    this.children = const [],
    this.name,
    this.direction,
    this.gap,
    this.align,
    this.justify,
    this.columns,
    this.rows,
    this.rowSize,
    this.columnSizes,
    this.rowSizes,
    this.place,
    this.surface,
    this.scrim,
  });

  factory LayoutContainerNode.fromJson(Map<String, dynamic> j) => LayoutContainerNode(
        kind: (j['kind'] as String?) ?? 'flex',
        children: ((j['children'] as List?) ?? const [])
            .map((e) => LayoutNode.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
        name: j['name'] as String?,
        direction: j['direction'] as String?,
        gap: j['gap'] as String?,
        align: j['align'] as String?,
        justify: j['justify'] as String?,
        columns: (j['columns'] as num?)?.toInt(),
        rows: (j['rows'] as num?)?.toInt(),
        rowSize: j['rowSize'] as String?,
        columnSizes: (j['columnSizes'] as List?)?.map((e) => e.toString()).toList(),
        rowSizes: (j['rowSizes'] as List?)?.map((e) => e.toString()).toList(),
        place: j['place'] == null
            ? null
            : GridPlacement.fromJson(Map<String, dynamic>.from(j['place'] as Map)),
        surface: j['surface'] == null
            ? null
            : ContainerSurface.fromJson(Map<String, dynamic>.from(j['surface'] as Map)),
        scrim: j['scrim'] as String?,
      );

  LayoutContainerNode copyWith({List<LayoutNode>? children}) => LayoutContainerNode(
        kind: kind,
        children: children ?? this.children,
        name: name,
        direction: direction,
        gap: gap,
        align: align,
        justify: justify,
        columns: columns,
        rows: rows,
        rowSize: rowSize,
        columnSizes: columnSizes,
        rowSizes: rowSizes,
        place: place,
        surface: surface,
        scrim: scrim,
      );
}

/// Hoja "componente prefabricado": un bloque compuesto del `componentRegistry`.
class LayoutComponentNode extends LayoutNode {
  final String component;
  final Map<String, String>? slots; // rol → slotId
  final List<String>? hidden; // roles ocultos
  final GridPlacement? place;
  final ContainerSurface? surface;
  final Map<String, String>? config;

  const LayoutComponentNode({
    required this.component,
    this.slots,
    this.hidden,
    this.place,
    this.surface,
    this.config,
  });

  factory LayoutComponentNode.fromJson(Map<String, dynamic> j) => LayoutComponentNode(
        component: (j['component'] as String?) ?? '',
        slots: (j['slots'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())),
        hidden: (j['hidden'] as List?)?.map((e) => e.toString()).toList(),
        place: j['place'] == null
            ? null
            : GridPlacement.fromJson(Map<String, dynamic>.from(j['place'] as Map)),
        surface: j['surface'] == null
            ? null
            : ContainerSurface.fromJson(Map<String, dynamic>.from(j['surface'] as Map)),
        config: (j['config'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())),
      );

  LayoutComponentNode copyWith({Map<String, String>? slots}) => LayoutComponentNode(
        component: component,
        slots: slots ?? this.slots,
        hidden: hidden,
        place: place,
        surface: surface,
        config: config,
      );
}
