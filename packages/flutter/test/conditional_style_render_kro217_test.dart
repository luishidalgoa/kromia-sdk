import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-198/217 — "estilo por valor" (`conditionalStyle`): el chip "Fuego" debe
/// pintarse ROJO porque el caso `elemento == Fuego` aplica un bgColor a los chips
/// `target` (tipo+rareza). Antes el motor no resolvía el conditionalStyle → el chip
/// salía con el fondo por defecto (el bug del user: "Fuego" crema en vez de rojo).
void main() {
  RenderCtx ctx(String elemento) => RenderCtx(
        composition: ViewComposition(
          recipe: 'hero_protagonico',
          action: 'none',
          layout: const LayoutContainerNode(kind: 'flex', direction: 'column', children: [
            LayoutComponentNode(component: 'chips_row', slots: {'chips': 'chips'}),
          ]),
          slots: {
            'chips': SlotComposition(
              fields: const ['tipo', 'rareza'],
              // if elemento == Fuego → bgColor red-500 en los chips tipo+rareza.
              conditionalStyle: const ConditionalStyle(
                fieldKey: 'elemento',
                cases: [
                  ConditionalStyleCase(
                    op: 'eq', value: 'Fuego', target: ['tipo', 'rareza'],
                    appearance: SlotAppearance(bgColor: 'red-500', display: 'badge'),
                  ),
                ],
              ),
            ),
          },
        ),
        item: {'tipo': 'Fuego', 'rareza': 'Rara', 'elemento': elemento},
        fieldDefs: const [
          FieldDefLike(key: 'tipo', type: 'text', behavior: 'enum'),
          FieldDefLike(key: 'rareza', type: 'text', behavior: 'enum'),
          FieldDefLike(key: 'elemento', type: 'text', behavior: 'enum'),
        ],
      );

  bool hasRedPill(WidgetTester t) =>
      t.widgetList<Container>(find.byType(Container)).any((w) {
        final d = w.decoration;
        return d is BoxDecoration && d.color == const Color(0xFFEF4444); // red-500
      });

  testWidgets('elemento==Fuego → chip "Fuego" con bgColor red-500 (target)', (t) async {
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx('Fuego')))),
    ));
    expect(find.text('Fuego'), findsOneWidget);
    expect(hasRedPill(t), isTrue, reason: 'el conditionalStyle debe teñir el chip target de rojo');
  });

  testWidgets('elemento!=Fuego (Agua) → sin el rojo del caso Fuego', (t) async {
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx('Agua')))),
    ));
    expect(hasRedPill(t), isFalse);
  });
}
