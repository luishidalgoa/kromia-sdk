import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import 'component_content.dart';
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

  /// Grid emulado (Flutter no tiene CSS-grid): asigna celdas colStart/colSpan +
  /// auto-flow + track fr→flex. rowSpan aproximado a 1 fila (limitación conocida).
  Widget _grid(LayoutContainerNode node, List<LayoutNode> children) {
    final cols = gridCols(node);
    final occupied = <String>{};
    var freeCol = 1, freeRow = 1;
    final placed = <({LayoutNode node, int col, int span, int row})>[];
    for (final ch in children) {
      final p = _placeOf(ch);
      int col, span, row;
      if (p?.colStart != null || p?.rowStart != null) {
        col = (p?.colStart ?? 1).toInt().clamp(1, cols);
        span = (p?.colSpan ?? 1).toInt().clamp(1, cols - col + 1);
        row = (p?.rowStart ?? 1).toInt();
      } else {
        while (occupied.contains('$freeRow:$freeCol')) {
          freeCol++;
          if (freeCol > cols) {
            freeCol = 1;
            freeRow++;
          }
        }
        col = freeCol;
        span = (p?.colSpan ?? 1).toInt().clamp(1, cols - col + 1);
        row = freeRow;
      }
      for (var c = col; c < col + span; c++) {
        occupied.add('$row:$c');
      }
      placed.add((node: ch, col: col, span: span, row: row));
    }
    final maxRow = placed.isEmpty ? 1 : placed.map((p) => p.row).reduce((a, b) => a > b ? a : b);
    final gap = KromiaTokens.gap(node.gap);
    final weights = _columnWeights(node, cols);

    final rows = <Widget>[];
    for (var r = 1; r <= maxRow; r++) {
      final inRow = placed.where((p) => p.row == r).toList()..sort((a, b) => a.col.compareTo(b.col));
      final cells = <Widget>[];
      var cursor = 1;
      for (final p in inRow) {
        if (p.col > cursor) cells.add(Expanded(flex: _weightSpan(weights, cursor, p.col - cursor), child: const SizedBox()));
        cells.add(Expanded(flex: _weightSpan(weights, p.col, p.span), child: _node(p.node)));
        cursor = p.col + p.span;
      }
      if (cursor <= cols) cells.add(Expanded(flex: _weightSpan(weights, cursor, cols - cursor + 1), child: const SizedBox()));
      final spaced = <Widget>[];
      for (var i = 0; i < cells.length; i++) {
        if (i > 0 && gap > 0) spaced.add(SizedBox(width: gap));
        spaced.add(cells[i]);
      }
      if (r > 1 && gap > 0) rows.add(SizedBox(height: gap));
      rows.add(Row(crossAxisAlignment: _crossAlign(node.align, allowStretch: false), children: spaced));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }

  List<int> _columnWeights(LayoutContainerNode node, int cols) {
    final sizes = node.columnSizes;
    return List.generate(cols, (i) {
      final tk = (sizes != null && i < sizes.length) ? sizes[i] : '1fr';
      return switch (tk) { '2fr' => 2, '3fr' => 3, _ => 1 };
    });
  }

  int _weightSpan(List<int> weights, int colStart1, int span) {
    var sum = 0;
    for (var c = colStart1; c < colStart1 + span && c - 1 < weights.length; c++) {
      sum += weights[c - 1];
    }
    return sum < 1 ? 1 : sum;
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
