/// Corpus de `layout.dart` — ESPEJO de `tests/layout.test.ts` (KRO-133).
/// NOTA: el caso "raíz que no es contenedor" del TS es irrepresentable en Dart
/// (la firma de validateLayout exige `LayoutContainerNode?`) → omitido; el tipo
/// lo garantiza por construcción.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

Map<String, SlotComposition> slots(List<String> keys) =>
    {for (final k in keys) k: SlotComposition(fields: [k])};

LayoutSlotNode sl(String s, {GridPlacement? place, num? grow}) =>
    LayoutSlotNode(slot: s, place: place, grow: grow);

void main() {
  group('validateLayout — estructura y catálogos', () {
    test('sin layout (null) → válido', () {
      expect(validateLayout(null, slots: slots(['a'])).ok, true);
    });

    test('árbol válido (flex column) → ok sin issues', () {
      final root = LayoutContainerNode(kind: 'flex', direction: 'column', children: [sl('avatar'), sl('title')]);
      final res = validateLayout(root, slots: slots(['avatar', 'title']));
      expect(res.ok, true);
      expect(res.issues, isEmpty);
    });

    test('slot que NO existe → error', () {
      final root = LayoutContainerNode(children: [sl('fantasma')]);
      final res = validateLayout(root, slots: slots(['avatar']));
      expect(res.ok, false);
      expect(res.issues.any((i) => i.level == 'error' && i.message.contains('fantasma')), true);
    });

    test('mismo slot dos veces → error', () {
      final root = LayoutContainerNode(children: [sl('avatar'), sl('avatar')]);
      final res = validateLayout(root, slots: slots(['avatar']));
      expect(res.ok, false);
      expect(res.issues.any((i) => i.message.contains('más de una vez')), true);
    });

    test('contenedor vacío → warn (no rompe)', () {
      final res = validateLayout(const LayoutContainerNode(children: []), slots: slots(['a']));
      expect(res.ok, true);
      expect(res.issues.any((i) => i.level == 'warn'), true);
    });

    test('grid columnas fuera de rango → error', () {
      final root = LayoutContainerNode(kind: 'grid', columns: maxGridColumns + 1, children: [sl('a')]);
      expect(validateLayout(root, slots: slots(['a'])).ok, false);
    });

    test('gap inválido → error', () {
      final root = LayoutContainerNode(gap: 'huge', children: [sl('a')]);
      expect(validateLayout(root, slots: slots(['a'])).ok, false);
    });

    test('anidamiento por encima del máximo → error', () {
      LayoutContainerNode node = LayoutContainerNode(children: [sl('a')]);
      for (var i = 0; i < maxLayoutDepth + 1; i++) {
        node = LayoutContainerNode(children: [node]);
      }
      expect(validateLayout(node, slots: slots(['a'])).ok, false);
    });

    test('anidamiento válido → ok', () {
      final root = LayoutContainerNode(kind: 'flex', direction: 'row', children: [
        sl('avatar'),
        LayoutContainerNode(kind: 'flex', direction: 'column', children: [sl('title'), sl('subtitle')]),
      ]);
      expect(validateLayout(root, slots: slots(['avatar', 'title', 'subtitle'])).ok, true);
    });
  });

  group('migrateSlotsToLayout', () {
    test('respeta un layout ya existente', () {
      final layout = LayoutContainerNode(children: [sl('x')]);
      expect(identical(migrateSlotsToLayout(recipe: 'compact_avatar', slots: slots(['x']), layout: layout), layout), true);
    });

    test('receta conocida → flex con slots en orden de la receta', () {
      final out = migrateSlotsToLayout(recipe: 'compact_avatar', slots: slots(['title', 'avatar']));
      expect(out.kind, 'flex');
      expect(collectLayoutSlots(out), ['avatar', 'title']);
    });

    test('el árbol migrado es VÁLIDO', () {
      final s = slots(['avatar', 'title', 'subtitle']);
      final out = migrateSlotsToLayout(recipe: 'compact_avatar', slots: s);
      expect(validateLayout(out, slots: s).ok, true);
    });
  });

  group('grid 2D placement', () {
    test('place válido dentro del grid → ok', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 2, children: [
        sl('avatar', place: const GridPlacement(colStart: 1, colSpan: 1)),
        sl('title', place: const GridPlacement(colStart: 2, colSpan: 1)),
      ]);
      expect(validateLayout(root, slots: slots(['avatar', 'title'])).ok, true);
    });

    test('colSpan que se sale → warn (no rompe)', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 2, children: [
        sl('avatar', place: const GridPlacement(colStart: 2, colSpan: 3)),
      ]);
      final res = validateLayout(root, slots: slots(['avatar']));
      expect(res.ok, true);
      expect(res.issues.any((i) => i.level == 'warn' && i.message.contains('derecha')), true);
    });

    test('place no entero / < 1 → error', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 2, children: [
        sl('avatar', place: const GridPlacement(colStart: 0, colSpan: 1)),
      ]);
      expect(validateLayout(root, slots: slots(['avatar'])).ok, false);
    });

    test('place en contenedor NO-grid → warn', () {
      final root = LayoutContainerNode(kind: 'flex', direction: 'row', children: [
        sl('avatar', place: const GridPlacement(colStart: 1)),
      ]);
      final res = validateLayout(root, slots: slots(['avatar']));
      expect(res.issues.any((i) => i.level == 'warn' && i.message.contains('grid')), true);
    });

    test('rows fuera de rango → error', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 2, rows: maxGridRows + 1, children: [sl('a')]);
      expect(validateLayout(root, slots: slots(['a'])).ok, false);
    });

    test('rowStart fuera de las filas explícitas → warn', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 2, rows: 2, children: [
        sl('a', place: const GridPlacement(rowStart: 3)),
      ]);
      final res = validateLayout(root, slots: slots(['a']));
      expect(res.ok, true);
      expect(res.issues.any((i) => i.level == 'warn' && i.message.contains('fila')), true);
    });
  });

  group('migrateSlotsToGrid', () {
    test('respeta un layout existente', () {
      final layout = LayoutContainerNode(kind: 'grid', columns: 1, children: [sl('x')]);
      expect(identical(migrateSlotsToGrid(recipe: 'compact_avatar', slots: slots(['x']), layout: layout), layout), true);
    });

    test('grid de 1 columna con slots de la receta', () {
      final out = migrateSlotsToGrid(recipe: 'compact_avatar', slots: slots(['title', 'avatar']));
      expect(out.kind, 'grid');
      expect(out.columns, 1);
      expect(collectLayoutSlots(out), ['avatar', 'title']);
      expect(validateLayout(out, slots: slots(['avatar', 'title'])).ok, true);
    });
  });

  group('helpers de recorrido', () {
    test('layoutDepth', () {
      expect(layoutDepth(sl('a')), 1);
      expect(layoutDepth(LayoutContainerNode(children: [sl('a')])), 2);
      expect(layoutDepth(LayoutContainerNode(children: [LayoutContainerNode(children: [sl('a')])])), 3);
    });

    test('collectLayoutSlots (orden de aparición)', () {
      final root = LayoutContainerNode(children: [
        sl('a'),
        LayoutContainerNode(children: [sl('b'), sl('c')]),
      ]);
      expect(collectLayoutSlots(root), ['a', 'b', 'c']);
    });
  });

  group('clampPlaceToGrid', () {
    test('clampa colStart al nº de columnas', () {
      final r = clampPlaceToGrid(const GridPlacement(colStart: 2, colSpan: 1, rowStart: 4, rowSpan: 1), 1)!;
      expect(r.colStart, 1);
      expect(r.colSpan, 1);
      expect(r.rowStart, 4);
      expect(r.rowSpan, 1);
    });

    test('clampa colSpan para que no se salga', () {
      final r = clampPlaceToGrid(const GridPlacement(colStart: 2, colSpan: 2, rowStart: 1, rowSpan: 1), 2)!;
      expect(r.colStart, 2);
      expect(r.colSpan, 1);
    });

    test('respeta colocaciones válidas (misma ref) y undefined', () {
      const ok = GridPlacement(colStart: 2, colSpan: 1, rowStart: 9, rowSpan: 2);
      expect(identical(clampPlaceToGrid(ok, 3), ok), true);
      expect(clampPlaceToGrid(null, 2), isNull);
    });
  });

  group('pruneLayoutSlots (KRO-165)', () {
    LayoutContainerNode tree() => LayoutContainerNode(
          kind: 'grid', columns: 2, rows: 2, gap: 'sm',
          children: [
            sl('title', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1)),
            sl('extra', place: const GridPlacement(colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1)),
            LayoutContainerNode(
              kind: 'grid', columns: 1, rows: 1, gap: 'sm',
              place: const GridPlacement(colStart: 1, colSpan: 2, rowStart: 2, rowSpan: 1),
              children: [sl('extra', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1))],
            ),
            const LayoutComponentNode(
              component: 'hero_header',
              slots: {'banner': 'image', 'title': 'extra'},
              place: GridPlacement(colStart: 1, colSpan: 2, rowStart: 3, rowSpan: 1),
            ),
          ],
        );

    test('poda las hojas-slot inválidas a cualquier profundidad', () {
      final pruned = pruneLayoutSlots(tree(), ['title', 'image']);
      final out = <String>[];
      void walk(LayoutNode n) {
        if (n is LayoutSlotNode) out.add(n.slot);
        if (n is LayoutContainerNode) n.children.forEach(walk);
      }
      walk(pruned);
      expect(out, ['title']);
    });

    test('desmapea roles de componente a slots inválidos (conserva el componente)', () {
      final pruned = pruneLayoutSlots(tree(), ['title', 'image']);
      final comp = pruned.children.firstWhere((c) => c is LayoutComponentNode) as LayoutComponentNode;
      expect(comp.slots, {'banner': 'image'});
    });

    test('conserva contenedores vacíos + es pura (no muta la entrada)', () {
      final input = tree();
      final pruned = pruneLayoutSlots(input, ['title', 'image']);
      // entrada intacta: el contenedor interno sigue con su slot
      final innerIn = input.children.firstWhere((c) => c is LayoutContainerNode) as LayoutContainerNode;
      expect(innerIn.children.length, 1);
      // salida: contenedor interno vacío
      final innerOut = pruned.children.firstWhere((c) => c is LayoutContainerNode) as LayoutContainerNode;
      expect(innerOut.children, isEmpty);
    });

    test('el podado pasa validateLayout sin "no declarado"', () {
      final pruned = pruneLayoutSlots(tree(), ['title', 'image']);
      final res = validateLayout(pruned, slots: {'title': SlotComposition(fields: ['nombre']), 'image': SlotComposition(fields: ['foto'])});
      expect(res.issues.where((i) => i.message.contains('no está declarado')), isEmpty);
    });
  });

  group('geometría canónica y solapes (KRO-166)', () {
    test('default columnas unificado: sin columns, colStart 2 avisa', () {
      final root = LayoutContainerNode(kind: 'grid', rows: 1, gap: 'sm', children: [
        sl('title', place: const GridPlacement(colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1)),
      ]);
      final res = validateLayout(root, slots: {'title': SlotComposition(fields: ['nombre'])});
      expect(res.issues.any((i) => RegExp(r'columna|colStart|fuera', caseSensitive: false).hasMatch(i.message)), true);
    });

    test('dos hijos apilados → warn de solape', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 2, rows: 2, gap: 'sm', children: [
        sl('title', place: const GridPlacement(colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 1)),
        sl('body', place: const GridPlacement(colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1)),
      ]);
      final res = validateLayout(root, slots: {'title': SlotComposition(fields: ['nombre']), 'body': SlotComposition(fields: ['lore'])});
      final overlaps = res.issues.where((i) => i.message.contains('se solapan')).toList();
      expect(overlaps.length, 1);
      expect(overlaps[0].level, 'warn');
      expect(res.ok, true);
    });

    test('los bloques ABSOLUTOS no cuentan para el solape', () {
      final root = LayoutContainerNode(kind: 'grid', columns: 1, rows: 1, gap: 'sm', children: [
        sl('title', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1)),
        sl('body', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1, position: 'absolute', x: 10, y: 10)),
      ]);
      final res = validateLayout(root, slots: {'title': SlotComposition(fields: ['nombre']), 'body': SlotComposition(fields: ['lore'])});
      expect(res.issues.where((i) => i.message.contains('se solapan')), isEmpty);
    });

    test('gridCols/gridRows/cellCovered', () {
      final c = LayoutContainerNode(kind: 'grid', columns: 2, rows: 1, gap: 'sm', children: [
        sl('title', place: const GridPlacement(colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 1)),
      ]);
      expect(gridCols(c), 2);
      expect(gridCols(LayoutContainerNode(kind: 'grid', rows: 1, children: c.children)), 1);
      expect(gridRows(c), 1);
      expect(cellCovered(c, 2, 1), true);
      expect(cellCovered(c, 1, 2), false);
    });
  });

  group('validateLayout — absoluto/surface/tracks (KRO-167)', () {
    final slotsOpt = {'title': SlotComposition(fields: ['nombre']), 'body': SlotComposition(fields: ['lore'])};

    test('absoluto: x/y fuera de 0..100 → error; en rango → limpio', () {
      final bad = LayoutContainerNode(kind: 'grid', columns: 1, rows: 1, gap: 'sm', children: [
        sl('title', place: const GridPlacement(colStart: 9, colSpan: 1, rowStart: 1, rowSpan: 1, position: 'absolute', x: 150, y: 10)),
      ]);
      expect(validateLayout(bad, slots: slotsOpt).issues.any((i) => i.message.contains('x/y deben ser')), true);
      final ok = LayoutContainerNode(kind: 'grid', columns: 1, rows: 1, gap: 'sm', children: [
        sl('title', place: const GridPlacement(colStart: 9, colSpan: 1, rowStart: 1, rowSpan: 1, position: 'absolute', x: 50, y: 10, w: 30)),
      ]);
      final res = validateLayout(ok, slots: slotsOpt);
      expect(res.issues.where((i) => RegExp(r'columna|colStart').hasMatch(i.message)), isEmpty);
      expect(res.issues.where((i) => i.level == 'error'), isEmpty);
    });

    test('surface: tokens inválidos → error con path surface.*', () {
      final bad = LayoutContainerNode(
        kind: 'grid', columns: 1, rows: 1, gap: 'sm',
        surface: const ContainerSurface(background: 'fucsia', radius: 'xxl'),
        children: [sl('title', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1))],
      );
      final res = validateLayout(bad, slots: slotsOpt);
      expect(res.issues.any((i) => i.path.endsWith('surface.background') && i.level == 'error'), true);
      expect(res.issues.any((i) => i.path.endsWith('surface.radius') && i.level == 'error'), true);
    });

    test('surface válida → sin issues de surface', () {
      final ok = LayoutContainerNode(
        kind: 'grid', columns: 1, rows: 1, gap: 'sm',
        surface: const ContainerSurface(background: 'card', radius: 'lg', padding: 'md', border: SurfaceBorder(width: 'thin', style: 'dashed', sides: ['top'])),
        children: [sl('title', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1))],
      );
      expect(validateLayout(ok, slots: slotsOpt).issues.where((i) => i.path.contains('surface')), isEmpty);
    });

    test('surface en un COMPONENTE (card) → se valida igual', () {
      final layout = LayoutContainerNode(kind: 'grid', columns: 1, rows: 1, gap: 'sm', children: [
        const LayoutComponentNode(
          component: 'card', slots: {'media': 'cover'},
          surface: ContainerSurface(background: 'fucsia', radius: 'xxl'),
          place: GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1),
        ),
      ]);
      final res = validateLayout(layout, slots: {'cover': SlotComposition(fields: ['foto'])});
      expect(res.issues.any((i) => i.path.endsWith('surface.background') && i.level == 'error'), true);
      expect(res.issues.any((i) => i.path.endsWith('surface.radius') && i.level == 'error'), true);

      final okLayout = LayoutContainerNode(kind: 'grid', columns: 1, rows: 1, gap: 'sm', children: [
        const LayoutComponentNode(
          component: 'card', slots: {'media': 'cover'},
          surface: ContainerSurface(radius: 'lg', shadow: 'md'),
          place: GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1),
        ),
      ]);
      expect(validateLayout(okLayout, slots: {'cover': SlotComposition(fields: ['foto'])}).issues.where((i) => i.path.contains('surface')), isEmpty);
    });

    test('track desconocido → warn; columnSizes de más → warn', () {
      final bad = LayoutContainerNode(
        kind: 'grid', columns: 2, rows: 1, gap: 'sm',
        columnSizes: const ['1fr', '7fr', 'auto'],
        children: [
          sl('title', place: const GridPlacement(colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1)),
          sl('body', place: const GridPlacement(colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1)),
        ],
      );
      final res = validateLayout(bad, slots: slotsOpt);
      expect(res.issues.any((i) => i.message.contains('Track "7fr" desconocido')), true);
      expect(res.issues.any((i) => i.message.contains('entradas pero el grid tiene')), true);
      expect(res.ok, true);
    });
  });
}
