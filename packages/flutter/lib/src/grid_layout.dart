/// KRO-83 — geometría del grid 2D en Flutter. Espejo del CSS Grid de
/// `@kromia/react` (`gridColumnsTemplate`/`gridRowsTemplate` + colocación
/// `col/rowStart`/`Span`). PURO (sin widgets) para poder testear la colocación
/// y el track-sizing de forma determinista, igual que el TS testea sus templates.
///
/// El `GridPlacement` del MODELO (kromia_core) y el `GridPlacement` (widget) de
/// flutter_layout_grid colisionan en nombre → aquí ocultamos el del paquete y
/// trabajamos con el del modelo; el motor (layout_renderer) usa la extensión
/// `.withGridPlacement` para feedear estas celdas.
library;

import 'dart:math' as math;

import 'package:flutter_layout_grid/flutter_layout_grid.dart' hide GridPlacement;
import 'package:kromia_core/kromia_core.dart';

/// Colocación resuelta de un hijo en el grid, en coordenadas de
/// flutter_layout_grid (índices de track **0-based**; CSS es 1-based por línea).
class GridCell {
  final int columnStart;
  final int columnSpan;
  final int rowStart;
  final int rowSpan;
  const GridCell({
    required this.columnStart,
    required this.columnSpan,
    required this.rowStart,
    required this.rowSpan,
  });
}

/// Geometría resuelta del grid: tracks de columna/fila + la celda de cada hijo
/// EN FLUJO (`children`, alineado 1:1 con `cells`).
class GridResult {
  final List<TrackSize> columns;
  final List<TrackSize> rows;
  final List<GridCell> cells;
  final List<LayoutNode> children;
  const GridResult({required this.columns, required this.rows, required this.cells, required this.children});
}

/// Token de track (`1fr`/`2fr`/`3fr`/`auto`/`content`) → `TrackSize` de
/// flutter_layout_grid. Espejo de `trackToCss`: fr→flexible, auto/content→
/// intrínseco (max-content; Flutter no distingue min/max-content), resto→1fr.
TrackSize kromiaTrackSize(String? token) => switch (token) {
      '2fr' => 2.fr,
      '3fr' => 3.fr,
      'auto' || 'content' => auto,
      _ => 1.fr, // '1fr' / null / desconocido → default del render
    };

GridPlacement? _placeOf(LayoutNode n) => switch (n) {
      LayoutSlotNode s => s.place,
      LayoutContainerNode c => c.place,
      LayoutComponentNode k => k.place,
    };

/// Resuelve los tracks de columna/fila + la colocación de cada hijo EN FLUJO
/// (`inflow` = sin los absolutos, que el motor pinta aparte). Mirrors el TS:
///   - columnas: `columnSizes` (relleno 1fr) o `cols × 1fr`;
///   - filas: `rowSizes` (relleno auto) o, sin ellas, `equal`→1fr / default→auto;
///   - colocación: explícita (`col/rowStart`+`Span`, columnas clampadas al grid)
///     o auto-flow row-sparse, RESERVANDO las celdas que cubre el rowSpan para
///     que el auto-flow no las invada (el fallo que colapsaba rowSpan).
/// Las filas se dimensionan al MÁXIMO que exige la colocación (incl. auto-flow)
/// — flutter_layout_grid lanza si un hijo cae fuera de los tracks definidos.
GridResult computeGrid(
  LayoutContainerNode node,
  List<LayoutNode> inflow,
) {
  final cols = gridCols(node);
  final colSizes = node.columnSizes;
  final columns = List<TrackSize>.generate(
    cols,
    (i) => kromiaTrackSize((colSizes != null && i < colSizes.length) ? colSizes[i] : '1fr'),
  );

  // Colocación (row-sparse, espejo del _grid enviado + reserva de rowSpan).
  final occupied = <String>{};
  var freeCol = 1, freeRow = 1;
  final cells = <GridCell>[];
  for (final ch in inflow) {
    final place = clampPlaceToGrid(_placeOf(ch), cols);
    final hasExplicit = place?.colStart != null || place?.rowStart != null;
    int col, colSpan, row;
    if (hasExplicit) {
      col = (place?.colStart ?? 1).toInt().clamp(1, cols);
      colSpan = (place?.colSpan ?? 1).toInt().clamp(1, cols - col + 1);
      row = math.max(1, (place?.rowStart ?? 1).toInt());
    } else {
      colSpan = (place?.colSpan ?? 1).toInt().clamp(1, cols);
      while (true) {
        if (freeCol + colSpan - 1 > cols) {
          freeCol = 1;
          freeRow++;
          continue;
        }
        var fits = true;
        for (var c = freeCol; c < freeCol + colSpan; c++) {
          if (occupied.contains('$freeRow:$c')) {
            fits = false;
            break;
          }
        }
        if (fits) break;
        freeCol++;
        if (freeCol > cols) {
          freeCol = 1;
          freeRow++;
        }
      }
      col = freeCol;
      row = freeRow;
    }
    final rowSpan = math.max(1, (place?.rowSpan ?? 1).toInt());
    for (var r = row; r < row + rowSpan; r++) {
      for (var c = col; c < col + colSpan; c++) {
        occupied.add('$r:$c');
      }
    }
    cells.add(GridCell(columnStart: col - 1, columnSpan: colSpan, rowStart: row - 1, rowSpan: rowSpan));
    if (!hasExplicit) {
      freeCol = col + colSpan;
      if (freeCol > cols) {
        freeCol = 1;
        freeRow++;
      }
    }
  }

  final maxRow = cells.isEmpty ? 1 : cells.map((c) => c.rowStart + c.rowSpan).reduce(math.max);
  final explicitRows = math.max(gridRows(node), node.rows ?? 1);
  final rowSizes = node.rowSizes;
  final rows = List<TrackSize>.generate(maxRow, (i) {
    if (rowSizes != null) return i < rowSizes.length ? kromiaTrackSize(rowSizes[i]) : auto;
    // Sin rowSizes: equal→1fr en las filas explícitas; las implícitas (auto-flow)
    // y el default son `auto` (grid-auto-rows del CSS).
    if (node.rowSize == 'equal' && i < explicitRows) return 1.fr;
    return auto;
  });

  return GridResult(columns: columns, rows: rows, cells: cells, children: inflow);
}
