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

    Widget content = _node(root);
    // Lienzo raíz SIN surface → padding por defecto p-3 (12px), espejo de react
    // LayoutRenderer (`!rootHasSurface && 'p-3'`). Con surface, el padding ya lo
    // pone la propia surface. Sin esto el contenido (p. ej. la imagen del
    // feature_card) salía a sangre, pegado a los bordes de la tarjeta.
    if (root.surface == null) {
      content = Padding(padding: const EdgeInsets.all(12), child: content);
    }
    Widget tree = _AccentFrame(accent: accent, width: isDetail ? 4 : 3, child: content);
    // KRO-217 — color de texto BASE del subárbol (cascada). Web propaga
    // `surface.textColor` por herencia CSS; Flutter no tiene cascada → los textos de
    // datos parten de `bodyBase` (sin color) y HEREDAN este `DefaultTextStyle`. Con
    // acabado = `paletteHex(surface.textColor)` (tono AA); sin él = `foreground` del
    // tema. Un slot con `appearance.textColor` propio lo sobreescribe (hijo > raíz).
    // Sin esto el texto salía OSCURO sobre el papel oscuro del acabado (el bug).
    final baseTextColor = KromiaTokens.paletteHex(root.surface?.textColor) ?? KromiaTokens.text;
    tree = DefaultTextStyle.merge(style: TextStyle(color: baseTextColor), child: tree);
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
    // 2D REAL SOLO si hay MÚLTIPLES columnas Y algún rowSpan>1 (una celda alta
    // junto a otras que rellenan filas adyacentes → necesita el motor
    // flutter_layout_grid). Con 1 columna, rowSpan es solo extensión vertical = un
    // Column: va por la emulación, que NO pide dimensiones intrínsecas (un hijo con
    // scroll shrink-wrap —refsGrid/galería— NO las soporta → lanza
    // `RenderShrinkWrappingViewport does not support intrinsic dimensions` → el
    // detalle salía EN BLANCO). Los lienzos de detalle del publisher (hero) usan
    // grids de 1 columna con rowSpan → este es el caso real.
    final needs2D = g.columns.length > 1 && g.cells.any((c) => c.rowSpan > 1);
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
      // Fila sin hijos = hueco de un `rowSpan` (la celda alta ya pintó su
      // contenido en su rowStart) → no emitimos Row ni gap (si no, salía un hueco
      // vertical fantasma entre cabecera y cuerpo).
      if (inRow.isEmpty) continue;
      inRow.sort((a, b) => a.col.compareTo(b.col));
      final cells = <Widget>[];
      var cursor = 0;
      for (final p in inRow) {
        if (p.col > cursor) cells.add(Expanded(flex: _weightOf(weights, cursor, p.col - cursor), child: const SizedBox()));
        // Columna 'fr' → Expanded ponderado (reparte el espacio restante). Columna
        // 'content'/'auto' → tamaño de CONTENIDO con **flex:0** → NO participa en el
        // reparto: se mide primero a su contenido y el/los `fr` absorben el resto,
        // empujándola al final (espejo de CSS `grid-template-columns: 1fr content`).
        // Con `Flexible(loose)` SIN flex:0 (flex:1 por defecto) competía 50/50 con el
        // `fr` → el badge del feature_card quedaba al centro con hueco a la derecha.
        if (_spanFlexible(g.columns, p.col, p.span)) {
          cells.add(Expanded(flex: _weightOf(weights, p.col, p.span), child: p.w));
        } else {
          cells.add(Flexible(flex: 0, fit: FlexFit.loose, child: p.w));
        }
        cursor = p.col + p.span;
      }
      if (cursor < cols) cells.add(Expanded(flex: _weightOf(weights, cursor, cols - cursor), child: const SizedBox()));
      final spaced = <Widget>[];
      for (var i = 0; i < cells.length; i++) {
        if (i > 0 && gap > 0) spaced.add(SizedBox(width: gap));
        spaced.add(cells[i]);
      }
      if (rows.isNotEmpty && gap > 0) rows.add(SizedBox(height: gap));
      rows.add(Row(crossAxisAlignment: _crossAlign(node.align, allowStretch: false), children: spaced));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows);
  }

  /// ¿Todas las pistas que cubre el span [start0, start0+span) son flexibles ('fr')?
  /// Si alguna es 'content'/'auto'/fija, la celda debe medir su contenido (no Expanded).
  bool _spanFlexible(List<TrackSize> cols, int start0, int span) {
    for (var c = start0; c < start0 + span && c < cols.length; c++) {
      if (cols[c] is! FlexibleTrackSize) return false;
    }
    return true;
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
    final pos = a.position;
    final w = width;

    // KRO-219 — `ambient`: fondo difuso a TODA la caja (NO borde). Lavado de color
    // desde el borde de `pos` → transparente al 55%. Espejo de la rama background.
    if (a.style == 'ambient') {
      final (begin, end) = _accentDir(pos);
      return DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: begin, end: end, colors: [color.withAlpha(0x40), const Color(0x00000000)], stops: const [0.0, 0.55]),
        ),
        child: child,
      );
    }

    Widget result = child;

    // KRO-219 — `glow`/`gradient`: gradiente INTERIOR (c→transparent sobre w*4 hacia
    // dentro desde el borde). El halo del web es INSET → NO un BoxShadow exterior.
    if (a.style == 'glow' || a.style == 'gradient') {
      result = Stack(children: [result, Positioned.fill(child: IgnorePointer(child: _edgeGradient(pos, w * 4, color)))]);
    }

    // Banda sólida (`bar`/`rounded`/`glow`) vía foregroundDecoration → se pinta SOBRE
    // el contenido sin desplazarlo w px (un Border en `decoration` sí lo correría).
    if (a.style == 'bar' || a.style == 'rounded' || a.style == 'glow') {
      final side = BorderSide(color: color, width: w);
      final border = switch (pos) {
        'top' => Border(top: side),
        'bottom' => Border(bottom: side),
        'left' => Border(left: side),
        'right' => Border(right: side),
        _ => null,
      };
      if (border != null) result = Container(foregroundDecoration: BoxDecoration(border: border), child: result);
    }
    return result;
  }
}

/// Dirección del gradiente del acento: el color vive en el borde de [pos] y se
/// difumina hacia el opuesto (espejo de `dir` de la rama ambient del web).
(Alignment, Alignment) _accentDir(String pos) => switch (pos) {
      'bottom' => (Alignment.bottomCenter, Alignment.topCenter),
      'left' => (Alignment.centerLeft, Alignment.centerRight),
      'right' => (Alignment.centerRight, Alignment.centerLeft),
      _ => (Alignment.topCenter, Alignment.bottomCenter), // top / default
    };

/// Franja de gradiente c→transparent de grosor [thickness] pegada al borde [pos]
/// (glow/gradient). Va dentro de un `Positioned.fill`.
Widget _edgeGradient(String pos, double thickness, Color color) {
  final (begin, end) = _accentDir(pos);
  final box = DecoratedBox(
    decoration: BoxDecoration(gradient: LinearGradient(begin: begin, end: end, colors: [color, const Color(0x00000000)])),
  );
  return switch (pos) {
    'top' => Align(alignment: Alignment.topCenter, child: SizedBox(height: thickness, width: double.infinity, child: box)),
    'bottom' => Align(alignment: Alignment.bottomCenter, child: SizedBox(height: thickness, width: double.infinity, child: box)),
    'left' => Align(alignment: Alignment.centerLeft, child: SizedBox(width: thickness, height: double.infinity, child: box)),
    'right' => Align(alignment: Alignment.centerRight, child: SizedBox(width: thickness, height: double.infinity, child: box)),
    _ => const SizedBox.shrink(),
  };
}

/// `#RGB` / `#RRGGBB` / `#RRGGBBAA` (web) → Color (Flutter 0xAARRGGBB). El alpha
/// del web va al FINAL; aquí se mueve al frente. null si no es hex válido.
Color? _parseHex(String? hex) {
  if (hex == null) return null;
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 3) h = h.split('').map((c) => '$c$c').join();
  if (h.length == 6) {
    final v = int.tryParse(h, radix: 16);
    return v == null ? null : Color(0xFF000000 | v);
  }
  if (h.length == 8) {
    final v = int.tryParse(h.substring(6, 8) + h.substring(0, 6), radix: 16); // RRGGBBAA → AARRGGBB
    return v == null ? null : Color(v);
  }
  return null;
}
