/// `recipe_presets.dart` — KRO-133 F5. Recetas → presets de LAYOUT (árbol grid 2D).
/// Espejo 1:1 de `recipe-presets.ts`. Reconstruye el diseño de cada receta como un
/// árbol de bloques para que "Activar diseño por bloques" parta del diseño real.
/// Best-effort: captura la ESTRUCTURA (no fiel al pixel). Ground-truth cross-language.
library;

import 'dart:math' as math;

import 'composition.dart';
import 'layout.dart' show migrateSlotsToGrid, collectLayoutSlots;
import 'layout_node.dart';

typedef Has = bool Function(String id);

// ── Ladrillos ─────────────────────────────────────────────────────────────────

LayoutNode leaf(String slot, GridPlacement place) => LayoutSlotNode(slot: slot, place: place);

LayoutContainerNode grid(
  int columns,
  int rows,
  List<LayoutNode> children, {
  String gap = 'sm',
  String? align,
  String? justify,
  List<String>? columnSizes,
  List<String>? rowSizes,
  ContainerSurface? surface,
  GridPlacement? place,
}) =>
    LayoutContainerNode(
      kind: 'grid',
      columns: math.max(1, columns),
      rows: math.max(1, rows),
      gap: gap,
      align: align,
      justify: justify,
      columnSizes: columnSizes,
      rowSizes: rowSizes,
      surface: surface,
      place: place,
      children: children,
    );

/// Stack vertical (1 columna) de los slots presentes, en orden.
LayoutContainerNode stack(List<String> ids, Has has, {String? align, String gap = 'sm', ContainerSurface? surface}) {
  final present = ids.where(has).toList();
  return grid(
    1,
    present.length,
    [for (var i = 0; i < present.length; i++) leaf(present[i], GridPlacement(colStart: 1, rowStart: i + 1))],
    gap: gap,
    align: align,
    surface: surface,
  );
}

/// Re-coloca un nodo ya construido (espejo del `{...node, place}` de TS).
LayoutNode _withPlace(LayoutNode n, GridPlacement place) => switch (n) {
      LayoutSlotNode s => LayoutSlotNode(slot: s.slot, grow: s.grow, place: place),
      LayoutComponentNode c =>
        LayoutComponentNode(component: c.component, slots: c.slots, hidden: c.hidden, place: place, surface: c.surface, config: c.config),
      LayoutContainerNode k => LayoutContainerNode(
          kind: k.kind, children: k.children, name: k.name, direction: k.direction, gap: k.gap, align: k.align,
          justify: k.justify, columns: k.columns, rows: k.rows, rowSize: k.rowSize, columnSizes: k.columnSizes,
          rowSizes: k.rowSizes, place: place, surface: k.surface, scrim: k.scrim),
    };

/// TARJETA de detalle (cover full-bleed opcional + contenido con padding).
LayoutContainerNode detailCard(
  String? coverId,
  List<String> contentIds,
  Has has, {
  Map<String, ({String component, String role})> componentAs = const {},
  bool centered = false,
  String? gap,
  String? dividerAfter,
  String? borderTopOn,
}) {
  final nodes = <LayoutNode>[];
  for (final id in contentIds) {
    if (!has(id)) continue;
    final c = componentAs[id];
    LayoutNode node = c != null
        ? LayoutComponentNode(component: c.component, slots: {c.role: id})
        : LayoutSlotNode(slot: id);
    if (borderTopOn == id) {
      node = grid(
        1, 1,
        [_withPlace(node, const GridPlacement(colStart: 1, rowStart: 1))],
        gap: 'none',
        surface: const ContainerSurface(border: SurfaceBorder(width: 'thin', sides: ['top'])),
      );
    }
    nodes.add(node);
    if (dividerAfter == id) nodes.add(const LayoutComponentNode(component: 'divider', slots: {}));
  }
  if (dividerAfter != null && !nodes.any((n) => n is LayoutComponentNode && n.component == 'divider')) {
    nodes.insert(0, const LayoutComponentNode(component: 'divider', slots: {}));
  }
  final content = [for (var i = 0; i < nodes.length; i++) _withPlace(nodes[i], GridPlacement(colStart: 1, rowStart: i + 1))];
  final padded = grid(1, math.max(1, content.length), content,
      gap: gap ?? 'sm', align: centered ? 'center' : null, surface: const ContainerSurface(padding: 'lg'));
  if (coverId != null && has(coverId)) {
    final outer = [
      leaf(coverId, const GridPlacement(colStart: 1, rowStart: 1)),
      _withPlace(padded, const GridPlacement(colStart: 1, rowStart: 2)),
    ];
    return grid(1, 2, outer, gap: 'none', surface: const ContainerSurface(padding: 'none'));
  }
  return padded;
}

/// Fila "media": [media | (título/subtítulo apilados) | accesorio].
LayoutContainerNode mediaRow(String? mediaId, List<String> stackIds, String? asideId, Has has) {
  final children = <LayoutNode>[];
  final colSizes = <String>[];
  var col = 1;
  if (mediaId != null && has(mediaId)) {
    children.add(leaf(mediaId, GridPlacement(colStart: col, rowStart: 1)));
    colSizes.add('content');
    col++;
  }
  final present = stackIds.where(has).toList();
  if (present.isNotEmpty) {
    children.add(_withPlace(
      grid(1, present.length,
          [for (var i = 0; i < present.length; i++) leaf(present[i], GridPlacement(colStart: 1, rowStart: i + 1))],
          gap: 'xs', align: 'start'),
      GridPlacement(colStart: col, rowStart: 1),
    ));
    colSizes.add('1fr');
    col++;
  }
  if (asideId != null && has(asideId)) {
    children.add(leaf(asideId, GridPlacement(colStart: col, rowStart: 1)));
    colSizes.add('content');
    col++;
  }
  return grid(math.max(1, col - 1), 1, children, align: 'center', columnSizes: colSizes, gap: 'md');
}

class RecipePreset {
  final LayoutContainerNode Function(Has has) build;
  final Map<String, SlotAppearance>? appearance;
  const RecipePreset({required this.build, this.appearance});
}

final Map<String, RecipePreset> recipePresets = {
  // ── Listas ──
  'compact_card': RecipePreset(
    build: (has) => mediaRow('thumb', ['title', 'subtitle'], 'badge', has),
    appearance: {
      'thumb': const SlotAppearance(shape: 'rounded'),
      'title': const SlotAppearance(weight: 'semibold'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted'),
      'badge': const SlotAppearance(display: 'badge'),
    },
  ),
  'compact_avatar': RecipePreset(
    build: (has) => mediaRow('avatar', ['title', 'subtitle'], 'meta', has),
    appearance: {
      'avatar': const SlotAppearance(shape: 'circle'),
      'title': const SlotAppearance(weight: 'semibold'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted'),
      'meta': const SlotAppearance(size: 'sm', textColor: 'muted'),
    },
  ),
  'row_text': RecipePreset(
    build: (has) {
      final children = <LayoutNode>[];
      final colSizes = <String>[];
      var col = 1;
      if (has('title')) {
        children.add(leaf('title', GridPlacement(colStart: col, rowStart: 1)));
        colSizes.add('1fr');
        col++;
      }
      if (has('subtitle')) {
        children.add(leaf('subtitle', GridPlacement(colStart: col, rowStart: 1)));
        colSizes.add('content');
        col++;
      }
      return grid(math.max(1, col - 1), 1, children, align: 'center', columnSizes: colSizes);
    },
    appearance: {
      'title': const SlotAppearance(weight: 'semibold'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted', align: 'right'),
    },
  ),

  // ── V5 block-native ──
  'feature_card': RecipePreset(
    build: (has) {
      final children = <LayoutNode>[];
      var row = 1;
      if (has('image')) children.add(leaf('image', GridPlacement(colStart: 1, rowStart: row++)));
      if (has('title')) children.add(leaf('title', GridPlacement(colStart: 1, rowStart: row++)));
      final bottom = <LayoutNode>[];
      final bCols = <String>[];
      var bc = 1;
      if (has('subtitle')) {
        bottom.add(leaf('subtitle', GridPlacement(colStart: bc, rowStart: 1)));
        bCols.add('1fr');
        bc++;
      }
      if (has('badge')) {
        bottom.add(leaf('badge', GridPlacement(colStart: bc, rowStart: 1)));
        bCols.add('content');
        bc++;
      }
      if (bottom.isNotEmpty) {
        children.add(_withPlace(
          grid(math.max(1, bc - 1), 1, bottom, align: 'center', columnSizes: bCols, gap: 'sm'),
          GridPlacement(colStart: 1, rowStart: row++),
        ));
      }
      return grid(1, math.max(1, row - 1), children, gap: 'sm');
    },
    appearance: {
      'image': const SlotAppearance(aspect: '16:9', shape: 'rounded'),
      'title': const SlotAppearance(weight: 'semibold', size: 'lg'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted'),
      'badge': const SlotAppearance(display: 'badge'),
    },
  ),
  'split_panel': RecipePreset(
    build: (has) => mediaRow('image', ['title', 'subtitle', 'badge'], 'meta', has),
    appearance: {
      'image': const SlotAppearance(shape: 'rounded', aspect: '1:1', size: 'lg'),
      'title': const SlotAppearance(weight: 'bold'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted'),
      'badge': const SlotAppearance(display: 'badge'),
      'meta': const SlotAppearance(size: 'sm', textColor: 'muted'),
    },
  ),
  'stat_tile': RecipePreset(
    build: (has) => stack(['badge', 'value', 'label'], has,
        align: 'center', gap: 'xs',
        surface: const ContainerSurface(background: 'muted', radius: 'lg', shadow: 'none', padding: 'md')),
    appearance: {
      'value': const SlotAppearance(weight: 'bold', size: 'xl', align: 'center'),
      'label': const SlotAppearance(size: 'sm', textColor: 'muted', align: 'center'),
      'badge': const SlotAppearance(display: 'badge'),
    },
  ),
  'cover_band': RecipePreset(
    build: (has) {
      final children = <LayoutNode>[];
      var row = 1;
      if (has('image')) children.add(leaf('image', GridPlacement(colStart: 1, rowStart: row++)));
      final band = <LayoutNode>[];
      final bCols = <String>[];
      var bc = 1;
      if (has('title')) {
        band.add(leaf('title', GridPlacement(colStart: bc, rowStart: 1)));
        bCols.add('1fr');
        bc++;
      }
      if (has('badge')) {
        band.add(leaf('badge', GridPlacement(colStart: bc, rowStart: 1)));
        bCols.add('content');
        bc++;
      }
      if (band.isNotEmpty) {
        children.add(_withPlace(
          grid(math.max(1, bc - 1), 1, band,
              align: 'center', columnSizes: bCols, gap: 'sm',
              surface: const ContainerSurface(background: 'none', bgColor: 'accent', radius: 'md', padding: 'sm')),
          GridPlacement(colStart: 1, rowStart: row++),
        ));
      }
      return grid(1, math.max(1, row - 1), children, gap: 'none');
    },
    appearance: {
      'image': const SlotAppearance(aspect: '3:4', shape: 'rounded'),
      'title': const SlotAppearance(weight: 'bold', textColor: 'accent'),
      'badge': const SlotAppearance(display: 'badge'),
    },
  ),

  // ── Detalle ──
  'hero_protagonico': RecipePreset(
    build: (has) {
      final headerSlots = <String, String>{};
      for (final r in ['banner', 'avatar', 'title', 'subtitle']) {
        if (has(r)) headerSlots[r] = r;
      }
      final body = <LayoutNode>[];
      var br = 1;
      if (has('stats')) {
        body.add(LayoutComponentNode(component: 'stats_row', slots: const {'stats': 'stats'}, place: GridPlacement(colStart: 1, rowStart: br++)));
      }
      if (has('body')) body.add(leaf('body', GridPlacement(colStart: 1, rowStart: br++)));
      if (has('gallery')) {
        body.add(LayoutComponentNode(component: 'carousel_peek', slots: const {'images': 'gallery'}, place: GridPlacement(colStart: 1, rowStart: br++)));
      }
      if (has('related')) {
        body.add(LayoutComponentNode(component: 'ref_gallery', slots: const {'refs': 'related'}, place: GridPlacement(colStart: 1, rowStart: br++)));
      }
      final children = <LayoutNode>[
        LayoutComponentNode(component: 'hero_header', slots: headerSlots, place: const GridPlacement(colStart: 1, rowStart: 1)),
      ];
      if (body.isNotEmpty) {
        children.add(_withPlace(
          grid(1, math.max(1, br - 1), body, gap: 'md', surface: const ContainerSurface(padding: 'lg')),
          const GridPlacement(colStart: 1, rowStart: 2),
        ));
      }
      return grid(1, children.length, children, gap: 'none', surface: const ContainerSurface(padding: 'none'));
    },
    appearance: {
      'banner': const SlotAppearance(aspect: '16:9'),
      'avatar': const SlotAppearance(shape: 'circle'),
      'title': const SlotAppearance(weight: 'bold', size: 'xl', align: 'center'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted', align: 'center'),
      'body': const SlotAppearance(size: 'md', truncate: 'none'),
    },
  ),
  'editorial': RecipePreset(
    build: (has) => detailCard('cover', ['title', 'meta', 'body', 'gallery'], has,
        componentAs: {'gallery': (component: 'gallery_grid', role: 'images')},
        gap: 'md', borderTopOn: 'body'),
    appearance: {
      'cover': const SlotAppearance(aspect: '16:9', shape: 'square'),
      'title': const SlotAppearance(weight: 'bold', size: 'xl', font: 'serif'),
      'meta': const SlotAppearance(size: 'sm', textColor: 'muted', textTransform: 'uppercase'),
      'body': const SlotAppearance(size: 'md', truncate: 'none', paddingY: 'md'),
    },
  ),
  'momento': RecipePreset(
    build: (has) => detailCard(null, ['date', 'title', 'subtitle', 'body', 'slideshow'], has,
        componentAs: {'slideshow': (component: 'carousel_centered', role: 'images')},
        centered: true, dividerAfter: 'date'),
    appearance: {
      'date': const SlotAppearance(weight: 'bold', size: 'xl', align: 'center', textColor: 'primary'),
      'title': const SlotAppearance(weight: 'bold', align: 'center'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted', align: 'center'),
      'body': const SlotAppearance(size: 'md', truncate: 'none'),
    },
  ),
  'detail_profile': RecipePreset(
    build: (has) => detailCard(null, ['avatar', 'title', 'subtitle', 'stats', 'body'], has,
        componentAs: {'stats': (component: 'stats_row', role: 'stats')}, centered: true),
    appearance: {
      'avatar': const SlotAppearance(shape: 'circle', size: 'xl'),
      'title': const SlotAppearance(weight: 'bold', size: 'xl', align: 'center'),
      'subtitle': const SlotAppearance(size: 'md', textColor: 'muted', align: 'center'),
      'body': const SlotAppearance(size: 'md', truncate: 'none'),
    },
  ),

  // ── Expand ──
  'accordion_simple': RecipePreset(
    build: (has) => stack(['body'], has),
    appearance: {'body': const SlotAppearance(size: 'md')},
  ),
  'accordion_with_actions': RecipePreset(
    build: (has) => stack(['body', 'actions'], has, gap: 'sm'),
    appearance: {'body': const SlotAppearance(size: 'md')},
  ),
};

/// Fusiona `build`+`appearance` del preset en la composición (KRO-178/145).
ViewComposition composeLayoutPreset(ViewComposition composition, RecipePreset? preset) {
  final slots = composition.slots;
  bool has(String id) => slots.containsKey(id);
  final baseLayout = preset != null ? preset.build(has) : migrateSlotsToGrid(recipe: composition.recipe, slots: slots);

  final nextSlots = <String, SlotComposition>{...slots};
  final ap = preset?.appearance;
  if (ap != null) {
    ap.forEach((id, presetAp) {
      final existing = nextSlots[id];
      if (existing != null) {
        final merged = (existing.appearance ?? const SlotAppearance()).mergedOver(presetAp);
        nextSlots[id] = SlotComposition(
          fields: existing.fields,
          orientation: existing.orientation,
          separator: existing.separator,
          nestedComposition: existing.nestedComposition,
          appearance: merged,
        );
      }
    });
  }

  // KRO-145 — no-regresión: ningún slot presente se pierde (orphans → filas al final).
  final placed = collectLayoutSlots(baseLayout).toSet();
  final orphans = slots.keys.where((id) => !placed.contains(id)).toList();
  final LayoutContainerNode layout;
  if (orphans.isNotEmpty) {
    layout = grid(
      1,
      1 + orphans.length,
      [
        _withPlace(baseLayout, const GridPlacement(colStart: 1, rowStart: 1)),
        for (var i = 0; i < orphans.length; i++) leaf(orphans[i], GridPlacement(colStart: 1, rowStart: i + 2)),
      ],
      surface: baseLayout.surface != null ? const ContainerSurface(padding: 'none') : null,
    );
  } else {
    layout = baseLayout;
  }

  return ViewComposition(
    recipe: composition.recipe,
    action: composition.action,
    slots: nextSlots,
    expand: composition.expand,
    linkField: composition.linkField,
    targetRecipe: composition.targetRecipe,
    targetComposition: composition.targetComposition,
    slotOverrides: composition.slotOverrides,
    accentPosition: composition.accentPosition,
    protocolVersion: composition.protocolVersion,
    layout: layout,
  );
}

/// Composición con `layout` = preset de su receta (apariencias base fusionadas).
ViewComposition recipeToComposition(ViewComposition composition) =>
    composeLayoutPreset(composition, recipePresets[composition.recipe]);
