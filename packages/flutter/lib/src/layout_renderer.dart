import 'package:flutter/widgets.dart';
import 'package:flutter_layout_grid/flutter_layout_grid.dart' hide GridPlacement;
import 'package:kromia_core/kromia_core.dart';

import 'component_content.dart';
import 'grid_layout.dart';
import 'render_ctx.dart';
import 'slot_content.dart';
import 'tokens.dart';
import 'utils/surface.dart';

/// KRO-133 Fase 4 / KRO-83 — Motor de render del árbol de LAYOUT en Flutter.
/// Equivalente Dart de `LayoutRenderer.tsx` (@kromia/react): interpreta
/// `ViewComposition.layout` (o el derivado de los slots) y lo pinta.
///
/// El paquete es self-contained (solo kromia_core + flutter) y agnóstico de la
/// fuente de imagen (inyecta `imageBuilder` en [RenderCtx]).
class LayoutRenderer extends StatelessWidget {
  final RenderCtx ctx;
  final VoidCallback? onTap;
  const LayoutRenderer({super.key, required this.ctx, this.onTap});

  @override
  Widget build(BuildContext context) {
    final root = ctx.composition.layout ??
        migrateSlotsToLayout(recipe: ctx.composition.recipe, slots: ctx.composition.slots);
    final isDetail = getRecipeManifest(ctx.composition.recipe)?.kind == 'detail';
    final accent = extractAccentSettings(ctx.composition, ctx.item, ctx.fieldDefs, 'top');

    Widget tree = _AccentFrame(accent: accent, width: isDetail ? 4 : 3, child: _node(root));
    if (onTap != null) tree = GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: tree);
    return tree;
  }

  Widget _node(LayoutNode n) => switch (n) {
        LayoutSlotNode s => slotContent(ctx, s.slot) ?? const SizedBox.shrink(),
        LayoutComponentNode c => componentContent(ctx, c) ?? const SizedBox.shrink(),
        LayoutContainerNode k => _container(k),
      };

  Widget _container(LayoutContainerNode node) {
    final inflow = <LayoutNode>[];
    final absolute = <LayoutNode>[];
    for (final ch in node.children) {
      (_placeOf(ch)?.position == 'absolute' ? absolute : inflow).add(ch);
    }

    Widget body = switch (node.kind) {
      'stack' => Stack(children: [for (final ch in inflow) _node(ch)]),
      'grid' => _grid(node, inflow),
      _ => _flex(node, inflow),
    };

    final scrim = scrimOverlay(node.scrim);
    if (absolute.isNotEmpty || scrim != null) {
      body = Stack(children: [
        body,
        if (scrim != null) scrim,
        for (final ch in absolute) _absolute(ch),
      ]);
    }

    final surf = surfaceDecoration(node.surface);
    if (surf.decoration != null || surf.padding != EdgeInsets.zero) {
      Widget decorated = Container(
        decoration: surf.decoration,
        padding: surf.padding == EdgeInsets.zero ? null : surf.padding,
        child: body,
      );
      if (node.surface?.radius != null && node.surface!.radius != 'none') {
        decorated = ClipRRect(borderRadius: BorderRadius.circular(KromiaTokens.radius(node.surface!.radius)), child: decorated);
      }
      return decorated;
    }
    return body;
  }

  Widget _flex(LayoutContainerNode node, List<LayoutNode> children) {
    final isRow = node.direction == 'row';
    final gap = KromiaTokens.gap(node.gap);
    final kids = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0 && gap > 0) kids.add(SizedBox(width: isRow ? gap : 0, height: isRow ? 0 : gap));
      final ch = children[i];
      Widget w = _node(ch);
      if (isRow && ch is LayoutSlotNode && (ch.grow ?? 0) > 0) w = Expanded(flex: ch.grow!.toInt(), child: w);
      kids.add(w);
    }
    return Flex(
      direction: isRow ? Axis.horizontal : Axis.vertical,
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: _mainAlign(node.justify),
      crossAxisAlignment: _crossAlign(node.align, allowStretch: !isRow),
      children: kids,
    );
  }

  /// Grid 2D NATIVO (KRO-83) vía flutter_layout_grid — port de CSS Grid: track
  /// sizing (fr/auto) + colStart/Span + **rowStart/Span** (antes el rowSpan se
  /// colapsaba a 1 fila). `computeGrid` resuelve la geometría espejando el
  /// @kromia/react (tracks + colocación); aquí solo montamos el widget, dando a
  /// cada hijo su celda explícita (sin depender del auto-placement del paquete).
  Widget _grid(LayoutContainerNode node, List<LayoutNode> children) {
    final g = computeGrid(node, children);
    final gap = KromiaTokens.gap(node.gap);
    // 2D REAL (algún rowSpan>1) → motor flutter_layout_grid, que sí estira una
    // celda por varias filas. Estos grids son de nivel superior (no los mide un
    // grid padre por intrínsecos), así que el LayoutBuilder de _layoutGrid es
    // seguro. El resto (1×N, N×1, filas sin span — TODOS los presets) va por la
    // emulación Column/Row, robusta ante el protocolo intrínseco anidado y con el
    // MISMO resultado (esos grids nunca usan rowSpan).
    final needs2D = g.cells.any((c) => c.rowSpan > 1);
    return needs2D ? _layoutGrid(node, g, gap) : _emulatedGrid(node, children, g, gap);
  }

  /// Grid 2D nativo (flutter_layout_grid). `LayoutBuilder` + columnas `fr` fijadas
  /// a píxeles: con altura sin acotar (scroll), el grid mide el alto de cada fila
  /// `auto` pasando a los hijos el ancho de su columna; si fuese `fr` ese ancho es
  /// ∞ y un hijo con alto∝ancho (AspectRatio) devolvería alto ∞ y reventaría.
  Widget _layoutGrid(LayoutContainerNode node, GridResult g, double gap) {
    final kids = <Widget>[
      for (var i = 0; i < g.cells.length; i++)
        _node(g.children[i]).withGridPlacement(
          columnStart: g.cells[i].columnStart,
          columnSpan: g.cells[i].columnSpan,
          rowStart: g.cells[i].rowStart,
          rowSpan: g.cells[i].rowSpan,
        ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) => LayoutGrid(
        gridFit: GridFit.passthrough,
        columnGap: gap,
        rowGap: gap,
        columnSizes: _resolveColumnTracks(g.columns, constraints.maxWidth, gap),
        rowSizes: g.rows,
        children: kids,
      ),
    );
  }

  /// Emulación 1D del grid (Column de Rows con celdas `Expanded` ponderadas por
  /// los tracks `fr`). Sin rowSpan (innecesario aquí) y sin intrínsecos frágiles.
  Widget _emulatedGrid(LayoutContainerNode node, List<LayoutNode> children, GridResult g, double gap) {
    final cols = g.columns.length;
    final weights = [for (final t in g.columns) t is FlexibleTrackSize ? t.flex.round().clamp(1, 999) : 1];
    final maxRow = g.rows.length;
    final rows = <Widget>[];
    for (var r = 0; r < maxRow; r++) {
      final inRow = <({int col, int span, Widget w})>[];
      for (var i = 0; i < children.length; i++) {
        if (g.cells[i].rowStart == r) {
          inRow.add((col: g.cells[i].columnStart, span: g.cells[i].columnSpan, w: _node(children[i])));
        }
      }
      inRow.sort((a, b) => a.col.compareTo(b.col));
      final cells = <Widget>[];
      var cursor = 0;
      for (final p in inRow) {
        if (p.col > cursor) cells.add(Expanded(flex: _weightOf(weights, cursor, p.col - cursor), child: const SizedBox()));
        cells.add(Expanded(flex: _weightOf(weights, p.col, p.span), child: p.w));
        cursor = p.col + p.span;
      }
      if (cursor < cols) cells.add(Expanded(flex: _weightOf(weights, cursor, cols - cursor), child: const SizedBox()));
      final spaced = <Widget>[];
      for (var i = 0; i < cells.length; i++) {
        if (i > 0 && gap > 0) spaced.add(SizedBox(width: gap));
        spaced.add(cells[i]);
      }
      if (r > 0 && gap > 0) rows.add(SizedBox(height: gap));
      rows.add(Row(crossAxisAlignment: _crossAlign(node.align, allowStretch: false), children: spaced));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }

  int _weightOf(List<int> weights, int start0, int span) {
    var sum = 0;
    for (var c = start0; c < start0 + span && c < weights.length; c++) {
      sum += weights[c];
    }
    return sum < 1 ? 1 : sum;
  }

  /// Fija las columnas `fr` a píxeles cuando el ancho está acotado y TODAS son
  /// flexibles (el caso que reventaba: `fr` + fila `auto` + AspectRatio). Con
  /// columnas `auto`/`content` se respeta la medición intrínseca del paquete.
  List<TrackSize> _resolveColumnTracks(List<TrackSize> tracks, double maxWidth, double gap) {
    if (!maxWidth.isFinite || tracks.isEmpty) return tracks;
    if (!tracks.every((t) => t is FlexibleTrackSize)) return tracks;
    final flexes = [for (final t in tracks) (t as FlexibleTrackSize).flex];
    final sum = flexes.fold<double>(0, (a, b) => a + b);
    final content = maxWidth - gap * (tracks.length - 1);
    if (sum <= 0 || content <= 0) return tracks;
    return [for (final f in flexes) FixedTrackSize(content * (f / sum))];
  }

  Widget _absolute(LayoutNode child) {
    final p = _placeOf(child)!;
    final ax = (((p.x ?? 0) / 100.0) * 2 - 1).clamp(-1.0, 1.0);
    final ay = (((p.y ?? 0) / 100.0) * 2 - 1).clamp(-1.0, 1.0);
    Widget c = _node(child);
    if (p.w != null || p.h != null) {
      c = FractionallySizedBox(
        widthFactor: p.w != null ? (p.w! / 100.0).clamp(0.0, 1.0) : null,
        heightFactor: p.h != null ? (p.h! / 100.0).clamp(0.0, 1.0) : null,
        child: c,
      );
    }
    return Positioned.fill(child: Align(alignment: Alignment(ax, ay), child: c));
  }
}

GridPlacement? _placeOf(LayoutNode n) => switch (n) {
      LayoutSlotNode s => s.place,
      LayoutContainerNode c => c.place,
      LayoutComponentNode k => k.place,
    };

CrossAxisAlignment _crossAlign(String? a, {bool allowStretch = true}) => switch (a) {
      'start' => CrossAxisAlignment.start,
      'center' => CrossAxisAlignment.center,
      'end' => CrossAxisAlignment.end,
      _ => allowStretch ? CrossAxisAlignment.stretch : CrossAxisAlignment.start,
    };

MainAxisAlignment _mainAlign(String? j) => switch (j) {
      'center' => MainAxisAlignment.center,
      'end' => MainAxisAlignment.end,
      'between' => MainAxisAlignment.spaceBetween,
      'around' => MainAxisAlignment.spaceAround,
      _ => MainAxisAlignment.start,
    };

/// Marco de acento (borde de color en un lado) — espejo de `AccentFrame`.
class _AccentFrame extends StatelessWidget {
  final AccentSettings? accent;
  final double width;
  final Widget child;
  const _AccentFrame({required this.accent, required this.width, required this.child});

  @override
  Widget build(BuildContext context) {
    final a = accent;
    if (a == null || a.position == 'none') return child;
    final color = _parseHex(a.color);
    if (color == null) return child;
    final side = BorderSide(color: color, width: width);
    final border = switch (a.position) {
      'top' => Border(top: side),
      'bottom' => Border(bottom: side),
      'left' => Border(left: side),
      'right' => Border(right: side),
      _ => null,
    };
    if (border == null) return child;
    return Container(foregroundDecoration: BoxDecoration(border: border), child: child);
  }
}

Color? _parseHex(String? hex) {
  if (hex == null) return null;
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 3) h = h.split('').map((c) => '$c$c').join();
  if (h.length != 6) return null;
  final v = int.tryParse(h, radix: 16);
  return v == null ? null : Color(0xFF000000 | v);
}
