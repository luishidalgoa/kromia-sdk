import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-217 — el componente `chips_row` (Fila de chips) faltaba en el motor Dart
/// (catálogo + switch) → caía a null y la fila entera (Fuego/rareza/tipo) no se
/// pintaba en la app pese a verse en el AppPreview de Studio. Cada field pasa por
/// `formatScalar` (rating → '★★★★☆', enum → texto) y su apariencia efectiva.
void main() {
  RenderCtx ctx() => RenderCtx(
        composition: const ViewComposition(
          recipe: 'hero_protagonico',
          action: 'none',
          layout: LayoutContainerNode(kind: 'flex', direction: 'column', children: [
            LayoutComponentNode(component: 'chips_row', slots: {'chips': 'chips'}),
          ]),
          slots: {'chips': SlotComposition(fields: ['tipo', 'rareza'])},
        ),
        item: const {'tipo': 'Fuego', 'rareza': 4},
        fieldDefs: const [
          FieldDefLike(key: 'tipo', type: 'text', behavior: 'enum'),
          FieldDefLike(key: 'rareza', type: 'number', behavior: 'rating'),
        ],
      );

  testWidgets('chips_row se renderiza: enum como texto + rating como estrellas', (t) async {
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx()))),
    ));
    // La fila aparece (antes salía SizedBox.shrink → nada).
    expect(find.text('Fuego'), findsOneWidget);
    // rating → '★★★★☆' por formatScalar (NO el número crudo "4").
    expect(find.textContaining('★', findRichText: true), findsOneWidget);
    expect(find.textContaining('☆', findRichText: true), findsOneWidget);
    expect(find.text('4'), findsNothing);
  });

  test('chips_row está en el catálogo de componentes', () {
    expect(componentIds, contains('chips_row'));
  });
}
