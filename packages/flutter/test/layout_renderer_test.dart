import 'package:flutter/widgets.dart';
import 'package:flutter_layout_grid/flutter_layout_grid.dart' show LayoutGrid;
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-133 Fase 4 / KRO-83 — el motor `kromia_flutter` interpreta el árbol de
/// layout → widget tree. Mismo JSON → estructura/contenido esperado.

final _fieldDefs = <FieldDefLike>[
  const FieldDefLike(key: 'nombre', type: 'text'),
  const FieldDefLike(key: 'equipo', type: 'text'),
  const FieldDefLike(key: 'goles', label: 'Goles', type: 'number'),
  const FieldDefLike(key: 'asist', label: 'Asist', type: 'number'),
  const FieldDefLike(key: 'tipo', type: 'text'),
];

final _slots = <String, SlotComposition>{
  'title': const SlotComposition(fields: ['nombre']),
  'subtitle': const SlotComposition(fields: ['equipo']),
  'stats': const SlotComposition(fields: ['goles', 'asist']),
  'tipo': const SlotComposition(fields: ['tipo']),
};

const _item = <String, dynamic>{'nombre': 'Pelé', 'equipo': 'Santos', 'goles': 643, 'asist': 200, 'tipo': 'Delantero'};

Future<void> pump(WidgetTester t, LayoutContainerNode root, {String recipe = 'compact_avatar', Map<String, SlotComposition>? slots}) async {
  final ctx = RenderCtx(
    composition: ViewComposition(recipe: recipe, action: 'none', slots: slots ?? _slots, layout: root),
    item: _item,
    fieldDefs: _fieldDefs,
  );
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx))),
  ));
  await t.pump();
}

void main() {
  testWidgets('flex column de slots → textos en orden', (t) async {
    await pump(t, const LayoutContainerNode(kind: 'flex', direction: 'column', children: [
      LayoutSlotNode(slot: 'title'),
      LayoutSlotNode(slot: 'subtitle'),
    ]));
    expect(find.text('Pelé'), findsOneWidget);
    expect(find.text('Santos'), findsOneWidget);
  });

  testWidgets('grid 2 columnas con placement → ambos', (t) async {
    await pump(t, const LayoutContainerNode(kind: 'grid', columns: 2, children: [
      LayoutSlotNode(slot: 'title', place: GridPlacement(colStart: 1, colSpan: 1)),
      LayoutSlotNode(slot: 'subtitle', place: GridPlacement(colStart: 2, colSpan: 1)),
    ]));
    expect(find.text('Pelé'), findsOneWidget);
    expect(find.text('Santos'), findsOneWidget);
  });

  testWidgets('grid SIN rowSpan → emulación Column/Row (no instancia LayoutGrid)', (t) async {
    await pump(t, const LayoutContainerNode(kind: 'grid', columns: 2, children: [
      LayoutSlotNode(slot: 'title', place: GridPlacement(colStart: 1)),
      LayoutSlotNode(slot: 'subtitle', place: GridPlacement(colStart: 2)),
    ]));
    expect(find.byType(LayoutGrid), findsNothing);
    expect(find.text('Pelé'), findsOneWidget);
    expect(find.text('Santos'), findsOneWidget);
  });

  testWidgets('grid 2D con rowSpan → usa el motor LayoutGrid y renderiza sin crash', (t) async {
    await pump(t, const LayoutContainerNode(kind: 'grid', columns: 2, children: [
      LayoutSlotNode(slot: 'title', place: GridPlacement(colStart: 1, rowStart: 1, rowSpan: 2)),
      LayoutSlotNode(slot: 'subtitle', place: GridPlacement(colStart: 2, rowStart: 1)),
      LayoutSlotNode(slot: 'tipo', place: GridPlacement(colStart: 2, rowStart: 2)),
    ]));
    expect(find.byType(LayoutGrid), findsOneWidget); // tomó el camino 2D
    expect(find.text('Pelé'), findsOneWidget); // celda con rowSpan:2
    expect(find.text('Santos'), findsOneWidget);
    expect(find.text('Delantero'), findsOneWidget); // fila 2
  });

  testWidgets('stack → Stack + contenido', (t) async {
    await pump(t, const LayoutContainerNode(kind: 'stack', children: [LayoutSlotNode(slot: 'title')]));
    expect(find.byType(Stack), findsWidgets);
    expect(find.text('Pelé'), findsOneWidget);
  });

  testWidgets('surface (card+radius) → ClipRRect + contenido', (t) async {
    await pump(t, const LayoutContainerNode(
      kind: 'flex',
      surface: ContainerSurface(background: 'card', radius: 'lg', padding: 'md'),
      children: [LayoutSlotNode(slot: 'title')],
    ));
    expect(find.text('Pelé'), findsOneWidget);
    expect(find.byType(ClipRRect), findsWidgets);
  });

  testWidgets('absoluto → no crashea', (t) async {
    await pump(t, const LayoutContainerNode(kind: 'grid', columns: 1, children: [
      LayoutSlotNode(slot: 'title'),
      LayoutSlotNode(slot: 'subtitle', place: GridPlacement(position: 'absolute', x: 10, y: 10, w: 50)),
    ]));
    expect(find.text('Pelé'), findsOneWidget);
    expect(find.text('Santos'), findsOneWidget);
  });

  group('prefabs', () {
    testWidgets('section_title → MAYÚSCULAS', (t) async {
      await pump(t, const LayoutContainerNode(children: [LayoutComponentNode(component: 'section_title', slots: {'text': 'tipo'})]));
      expect(find.text('DELANTERO'), findsOneWidget);
    });
    testWidgets('stats_row → valor + etiqueta', (t) async {
      await pump(t, const LayoutContainerNode(children: [LayoutComponentNode(component: 'stats_row', slots: {'stats': 'stats'})]));
      expect(find.text('643'), findsOneWidget);
      expect(find.text('GOLES'), findsOneWidget);
    });
    testWidgets('card → título en la caja', (t) async {
      await pump(t, const LayoutContainerNode(children: [LayoutComponentNode(component: 'card', slots: {'title': 'title'})]));
      expect(find.text('Pelé'), findsOneWidget);
    });
    testWidgets('hero_header → título + subtítulo', (t) async {
      await pump(t, const LayoutContainerNode(children: [LayoutComponentNode(component: 'hero_header', slots: {'title': 'title', 'subtitle': 'subtitle'})]));
      expect(find.text('Pelé'), findsOneWidget);
      expect(find.text('Santos'), findsOneWidget);
    });
    testWidgets('rol oculto → no se pinta', (t) async {
      await pump(t, const LayoutContainerNode(children: [
        LayoutComponentNode(component: 'hero_header', slots: {'title': 'title', 'subtitle': 'subtitle'}, hidden: ['subtitle']),
      ]));
      expect(find.text('Pelé'), findsOneWidget);
      expect(find.text('Santos'), findsNothing);
    });
    testWidgets('componente desconocido → no rompe', (t) async {
      await pump(t, const LayoutContainerNode(children: [LayoutComponentNode(component: 'no_existe', slots: {})]));
      expect(find.byType(LayoutRenderer), findsOneWidget);
    });
  });

  // "Golden" estructural: cada preset real de recipe_presets renderiza sin crash.
  group('presets reales (recipe_presets) renderizan sin excepción', () {
    for (final recipe in recipePresets.keys) {
      testWidgets(recipe, (t) async {
        final manifest = getRecipeManifest(recipe)!;
        final slots = <String, SlotComposition>{for (final s in manifest.slots) s.id: SlotComposition(fields: [s.id])};
        final comp = recipeToComposition(ViewComposition(recipe: recipe, action: 'none', slots: slots));
        final item = <String, dynamic>{for (final s in manifest.slots) s.id: 'v-${s.id}'};
        await t.pumpWidget(Directionality(
          textDirection: TextDirection.ltr,
          // SingleChildScrollView: altura sin acotar (en la app real el layout va
          // dentro de un scroll) → un preset alto no desborda el viewport de test.
          child: SingleChildScrollView(
            child: SizedBox(width: 320, child: LayoutRenderer(ctx: RenderCtx(composition: comp, item: item, fieldDefs: const []))),
          ),
        ));
        await t.pump();
        expect(find.byType(LayoutRenderer), findsOneWidget);
      });
    }
  });
}
