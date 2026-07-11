import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-217 §26 — la fila de chips de Ignis usa `chipGrid: {columns: 2}` con
/// `elemento` (fila 1, span 2), `peligrosidad` (col 1, fila 2) y `rareza` ("Rara",
/// col 2, fila 2, fill). Con `FixedTrackSize` el grid quedaba content-width y "Rara"
/// no llegaba a la mitad derecha. Con columnas `1fr` a ancho completo + el chip fill
/// estirando su celda, "Rara" cae en la mitad derecha.
void main() {
  testWidgets('chipGrid 2col: "Rara" (col2, fill) cae en la mitad DERECHA', (t) async {
    final ctx = RenderCtx(
      composition: const ViewComposition(
        recipe: 'hero_protagonico',
        action: 'none',
        layout: LayoutContainerNode(kind: 'flex', direction: 'column', children: [
          LayoutComponentNode(component: 'chips_row', slots: {'chips': 'chips'}),
        ]),
        slots: {
          'chips': SlotComposition(
            fields: ['elemento', 'peligrosidad', 'rareza'],
            appearance: SlotAppearance(align: 'center', display: 'text'),
            chipGrid: ChipGrid(columns: 2),
            chipPlacements: {
              'elemento': GridPlacement(colStart: 1, rowStart: 1, colSpan: 2),
              'peligrosidad': GridPlacement(colStart: 1, rowStart: 2),
              'rareza': GridPlacement(colStart: 2, rowStart: 2),
            },
          ),
        },
      ),
      item: const {'elemento': 'Fuego', 'peligrosidad': 'Alta', 'rareza': 'Rara'},
      fieldDefs: const [
        FieldDefLike(key: 'elemento', type: 'text'),
        FieldDefLike(key: 'peligrosidad', type: 'text'),
        FieldDefLike(key: 'rareza', type: 'text'),
      ],
    );
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx))),
    ));
    expect(find.text('Rara'), findsOneWidget);
    final rara = t.getRect(find.text('Rara'));
    final peli = t.getRect(find.text('Alta'));
    // "Rara" (col 2) a la DERECHA de "Alta" (col 1) y con su centro en la mitad derecha.
    expect(rara.center.dx, greaterThan(peli.center.dx));
    expect(rara.center.dx, greaterThan(160), reason: '"Rara" debe caer en la mitad derecha de 320px');
  });
}
