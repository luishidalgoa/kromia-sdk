import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-133 — caso de oro REINOS (Testing): detalle `hero_protagonico` con un
/// `layout` editado en el canvas (grids anidados + rowSpan:2 + banner imagen),
/// dentro de un scroll (como `RecipeDetailScreen`). Debe pintar el contenido, NO
/// quedar en blanco. Reproduce el lienzo servido real.

Widget _img(String url, {BoxFit fit = BoxFit.cover, Alignment alignment = Alignment.center, double? width, double? height}) =>
    SizedBox(width: width ?? 40, height: height ?? 40);

void main() {
  // Estructura EXACTA del targetComposition.layout de Reinos (backend real).
  const layout = LayoutContainerNode(kind: 'grid', columns: 1, rows: 3, children: [
    LayoutContainerNode(
      kind: 'grid', columns: 1, rows: 3,
      place: GridPlacement(colStart: 1, rowStart: 1, rowSpan: 2),
      children: [
        LayoutSlotNode(slot: 'banner', place: GridPlacement(colStart: 1, rowStart: 1)),
        LayoutSlotNode(slot: 'title', place: GridPlacement(colStart: 1, rowStart: 2)),
        LayoutSlotNode(slot: 'subtitle', place: GridPlacement(colStart: 1, rowStart: 3)),
      ],
    ),
    LayoutContainerNode(
      kind: 'grid', columns: 1, rows: 2,
      place: GridPlacement(colStart: 1, rowStart: 3),
      children: [
        LayoutSlotNode(slot: 'body', place: GridPlacement(colStart: 1, rowStart: 1)),
        LayoutContainerNode(
          kind: 'grid', columns: 1, rows: 1,
          place: GridPlacement(colStart: 1, rowStart: 2),
          children: [LayoutSlotNode(slot: 'related', place: GridPlacement(colStart: 1, rowStart: 1))],
        ),
      ],
    ),
  ]);

  final slots = <String, SlotComposition>{
    'banner': const SlotComposition(fields: ['estandarte']),
    'title': const SlotComposition(fields: ['nombre']),
    'subtitle': const SlotComposition(fields: ['clima', 'elemento_dominante']),
    'body': const SlotComposition(fields: ['descripcion']),
    'related': const SlotComposition(fields: ['bestias']),
  };
  final defs = <FieldDefLike>[
    const FieldDefLike(key: 'estandarte', type: 'image'),
    const FieldDefLike(key: 'nombre', type: 'text'),
    const FieldDefLike(key: 'clima', type: 'text'),
    const FieldDefLike(key: 'elemento_dominante', type: 'text'),
    const FieldDefLike(key: 'descripcion', type: 'text', behavior: 'markdown'),
    const FieldDefLike(key: 'bestias', type: 'cardRef'),
  ];
  final item = <String, dynamic>{
    'estandarte': 'http://x.test/forjabrasa.png',
    'nombre': 'Forjabrasa',
    'clima': 'Árido',
    'elemento_dominante': 'Fuego',
    'descripcion': 'El reino de las fraguas eternas.',
    'bestias': ['1', '2'],
  };

  testWidgets('detalle hero con layout custom (rowSpan 2D) pinta en scroll, no blanco', (t) async {
    final ctx = RenderCtx(
      composition: ViewComposition(recipe: 'hero_protagonico', action: 'none', slots: slots, layout: layout),
      item: item,
      fieldDefs: defs,
      imageBuilder: _img,
    );
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      // Igual que RecipeDetailScreen: scroll (altura sin acotar).
      child: Center(child: SizedBox(width: 360, child: SingleChildScrollView(child: LayoutRenderer(ctx: ctx)))),
    ));
    await t.pump();
    expect(t.takeException(), isNull, reason: 'no debe lanzar excepción de layout');
    expect(find.text('Forjabrasa'), findsOneWidget, reason: 'el título del lienzo debe pintarse');
    expect(find.textContaining('fraguas'), findsOneWidget, reason: 'el body debe pintarse');
  });
}
