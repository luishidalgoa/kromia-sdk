import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-219 — render de `accentStyle` en el motor (_AccentFrame): bar/rounded =
/// banda (foregroundDecoration, no desplaza); glow = banda + gradiente interior;
/// gradient = gradiente en el borde; ambient = fondo difuso (LinearGradient).
RenderCtx _ctx(String style, {String position = 'left'}) => RenderCtx(
      composition: ViewComposition(
        recipe: 'editorial',
        action: 'none',
        accentStyle: style,
        accentPosition: position,
        slots: const {
          'title': SlotComposition(fields: ['nombre']),
          'color': SlotComposition(fields: ['color']),
        },
        layout: const LayoutContainerNode(children: [LayoutSlotNode(slot: 'title')]),
      ),
      item: const {'nombre': 'Pelé', 'color': '#ff0000'},
      fieldDefs: const [
        FieldDefLike(key: 'nombre', type: 'text'),
        FieldDefLike(key: 'color', type: 'text', behavior: 'color_hex'),
      ],
    );

Future<void> _pump(WidgetTester t, String style, {String position = 'left'}) async {
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: _ctx(style, position: position)))),
  ));
  await t.pump();
}

final _hasLinearGradient = find.byWidgetPredicate(
    (w) => w is DecoratedBox && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).gradient is LinearGradient);
final _hasForegroundBorder = find.byWidgetPredicate(
    (w) => w is Container && w.foregroundDecoration is BoxDecoration && (w.foregroundDecoration as BoxDecoration).border != null);

void main() {
  group('accentStyle render (KRO-219)', () {
    testWidgets('los 5 estilos renderizan sin crash + conservan el contenido', (t) async {
      for (final s in ['bar', 'rounded', 'glow', 'gradient', 'ambient']) {
        await _pump(t, s);
        expect(t.takeException(), isNull, reason: '$s crasheó');
        expect(find.text('Pelé'), findsOneWidget, reason: '$s perdió el contenido');
      }
    });

    testWidgets('bar → banda vía foregroundDecoration (no desplaza), SIN gradiente', (t) async {
      await _pump(t, 'bar');
      expect(_hasForegroundBorder, findsWidgets); // banda en foregroundDecoration
      expect(_hasLinearGradient, findsNothing); // no es gradiente
    });

    testWidgets('ambient → fondo con LinearGradient (NO banda foregroundDecoration)', (t) async {
      await _pump(t, 'ambient');
      expect(_hasLinearGradient, findsWidgets);
      expect(_hasForegroundBorder, findsNothing); // ambient no pinta banda
    });

    testWidgets('gradient → gradiente en el borde', (t) async {
      await _pump(t, 'gradient');
      expect(_hasLinearGradient, findsWidgets);
    });

    testWidgets('glow → banda (foregroundDecoration) + gradiente interior', (t) async {
      await _pump(t, 'glow');
      expect(_hasForegroundBorder, findsWidgets); // la banda sólida
      expect(_hasLinearGradient, findsWidgets); // el halo interior
    });

    testWidgets('position=none → sin acento (ni banda ni gradiente)', (t) async {
      await _pump(t, 'glow', position: 'none');
      expect(_hasForegroundBorder, findsNothing);
      expect(_hasLinearGradient, findsNothing);
      expect(find.text('Pelé'), findsOneWidget);
    });
  });
}
