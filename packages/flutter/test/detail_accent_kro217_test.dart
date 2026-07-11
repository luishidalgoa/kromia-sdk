import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-217 §4/§25.3 — el acento del lienzo raíz DEBE dibujarse en el detalle. El
/// lavado `ambient` (linear-gradient color+0x40 → transparent) es una capa aparte;
/// el bgColor OPACO del root surface lo tapaba (el "tinte fuego" no salía). En el
/// detalle el root pierde bg/borde/radius (el papel lo pone el panel del sheet) y
/// el acento se mantiene.
void main() {
  RenderCtx ctx() => RenderCtx(
        composition: const ViewComposition(
          recipe: 'hero_protagonico', // kind 'detail'
          action: 'none',
          accentStyle: 'ambient',
          layout: LayoutContainerNode(
            kind: 'flex',
            direction: 'column',
            surface: ContainerSurface(bgColor: 'slate-800', textColor: 'white'),
            children: [LayoutSlotNode(slot: 'nombre')],
          ),
          slots: {'nombre': SlotComposition(fields: ['nom'])},
        ),
        item: const {'nom': 'Ignis', 'tint': '#ff3300'},
        fieldDefs: const [
          FieldDefLike(key: 'nom', type: 'text'),
          FieldDefLike(key: 'tint', type: 'text', behavior: 'color_hex'),
        ],
      );

  Future<void> pump(WidgetTester t) => t.pumpWidget(Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx()))),
      ));

  bool _hasBoxColor(WidgetTester t, Color c) =>
      t.widgetList<Container>(find.byType(Container)).any((w) {
        final d = w.decoration;
        return d is BoxDecoration && d.color == c;
      }) ||
      t.widgetList<DecoratedBox>(find.byType(DecoratedBox)).any((w) {
        final d = w.decoration;
        return d is BoxDecoration && d.color == c;
      });

  testWidgets('el acento ambient se pinta (gradient color+0x40)', (t) async {
    await pump(t);
    final hasAmbient = t.widgetList<DecoratedBox>(find.byType(DecoratedBox)).any((w) {
      final d = w.decoration;
      if (d is! BoxDecoration) return false;
      final g = d.gradient;
      return g is LinearGradient && g.colors.isNotEmpty && g.colors.first == const Color(0x40FF3300);
    });
    expect(hasAmbient, isTrue);
    expect(find.text('Ignis'), findsOneWidget); // el contenido sigue visible
  });

  testWidgets('el root del detalle NO pinta su bgColor (no tapa el acento)', (t) async {
    await pump(t);
    // slate-800 = 0xFF1E293B. En el detalle lo pinta el panel del sheet, NO el root.
    expect(_hasBoxColor(t, const Color(0xFF1E293B)), isFalse);
  });
}
