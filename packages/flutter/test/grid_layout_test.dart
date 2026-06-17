import 'package:flutter_layout_grid/flutter_layout_grid.dart' hide GridPlacement;
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/src/grid_layout.dart';

/// KRO-83 — geometría del grid 2D (espejo de gridColumnsTemplate/gridRowsTemplate
/// + colocación CSS del @kromia/react). El foco: **rowSpan**, que el `_grid`
/// anterior colapsaba a 1 fila. Test puro y determinista (sin render).

void main() {
  group('kromiaTrackSize', () {
    test('fr tokens → FlexibleTrackSize con su flex', () {
      expect((kromiaTrackSize('1fr') as FlexibleTrackSize).flex, 1);
      expect((kromiaTrackSize('2fr') as FlexibleTrackSize).flex, 2);
      expect((kromiaTrackSize('3fr') as FlexibleTrackSize).flex, 3);
    });
    test('auto/content → IntrinsicContentTrackSize', () {
      expect(kromiaTrackSize('auto'), isA<IntrinsicContentTrackSize>());
      expect(kromiaTrackSize('content'), isA<IntrinsicContentTrackSize>());
    });
    test('desconocido/null → 1fr (default del render)', () {
      expect((kromiaTrackSize(null) as FlexibleTrackSize).flex, 1);
      expect((kromiaTrackSize('zzz') as FlexibleTrackSize).flex, 1);
    });
  });

  group('computeGrid — columnas', () {
    test('sin columnSizes → cols × 1fr', () {
      const ch = [LayoutSlotNode(slot: 'a')];
      final g = computeGrid(const LayoutContainerNode(kind: 'grid', columns: 3, children: ch), ch);
      expect(g.columns.length, 3);
      expect(g.columns.every((t) => t is FlexibleTrackSize && t.flex == 1), true);
    });
    test('columnSizes respeta tokens + rellena 1fr lo que falte', () {
      const ch = [LayoutSlotNode(slot: 'a')];
      final node = const LayoutContainerNode(kind: 'grid', columns: 3, columnSizes: ['2fr', 'auto'], children: ch);
      final g = computeGrid(node, ch);
      expect((g.columns[0] as FlexibleTrackSize).flex, 2);
      expect(g.columns[1], isA<IntrinsicContentTrackSize>());
      expect((g.columns[2] as FlexibleTrackSize).flex, 1); // pad
    });
  });

  group('computeGrid — rowSpan (el gap que cerramos)', () {
    test('hijo con rowSpan:2 → la celda conserva rowSpan y el grid tiene 2 filas', () {
      const children = [
        LayoutSlotNode(slot: 'a', place: GridPlacement(colStart: 1, rowStart: 1, rowSpan: 2)),
        LayoutSlotNode(slot: 'b', place: GridPlacement(colStart: 2, rowStart: 1)),
        LayoutSlotNode(slot: 'c', place: GridPlacement(colStart: 2, rowStart: 2)),
      ];
      const node = LayoutContainerNode(kind: 'grid', columns: 2, children: children);
      final g = computeGrid(node, children);
      expect(g.rows.length, 2); // el span fuerza 2 filas (antes colapsaba a 1)
      // a (0-based): columna 0, fila 0, rowSpan 2
      expect(g.cells[0].columnStart, 0);
      expect(g.cells[0].rowStart, 0);
      expect(g.cells[0].rowSpan, 2);
      // c queda en la fila 2 (índice 1)
      expect(g.cells[2].rowStart, 1);
    });

    test('auto-flow NO invade la celda reservada por un rowSpan', () {
      const children = [
        LayoutSlotNode(slot: 'a', place: GridPlacement(colStart: 1, rowStart: 1, rowSpan: 2)),
        LayoutSlotNode(slot: 'b'), // auto
        LayoutSlotNode(slot: 'c'), // auto
      ];
      const node = LayoutContainerNode(kind: 'grid', columns: 2, children: children);
      final g = computeGrid(node, children);
      // b → col2/fila1; c → col2/fila2 (col1/fila2 está reservada por 'a').
      expect(g.cells[1].columnStart, 1);
      expect(g.cells[1].rowStart, 0);
      expect(g.cells[2].columnStart, 1);
      expect(g.cells[2].rowStart, 1);
    });
  });

  group('computeGrid — filas', () {
    test('default → auto; rowSize:equal → 1fr', () {
      const ch = [LayoutSlotNode(slot: 'a', place: GridPlacement(rowStart: 2))];
      final autoG = computeGrid(const LayoutContainerNode(kind: 'grid', columns: 1, children: ch), ch);
      expect(autoG.rows.every((t) => t is IntrinsicContentTrackSize), true);
      final eqG = computeGrid(const LayoutContainerNode(kind: 'grid', columns: 1, rowSize: 'equal', children: ch), ch);
      expect(eqG.rows.every((t) => t is FlexibleTrackSize && t.flex == 1), true);
    });
  });
}
