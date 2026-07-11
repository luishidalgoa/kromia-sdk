import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-217 §14.2 — el slot cuyo campo `color_hex` ALIMENTA el acento no se pinta
/// como celda (su color YA es la raya; si no, saldría swatch + raya duplicados).
/// `extractAccentSettings` devuelve `colorFieldKey` y el LayoutRenderer colapsa esa celda.
void main() {
  RenderCtx ctx({required String tintBehavior}) => RenderCtx(
        composition: ViewComposition(
          recipe: 'editorial',
          action: 'none',
          accentPosition: 'top',
          layout: const LayoutContainerNode(kind: 'flex', direction: 'column', children: [
            LayoutSlotNode(slot: 'color'),
            LayoutSlotNode(slot: 'nombre'),
          ]),
          slots: {
            'color': const SlotComposition(fields: ['tint']),
            'nombre': const SlotComposition(fields: ['nom']),
          },
        ),
        item: const {'tint': '#abcdef', 'nom': 'Ignis'},
        // El behavior del campo `tint` decide si hay acento (solo `color_hex` lo activa).
        fieldDefs: [
          FieldDefLike(key: 'tint', type: 'text', behavior: tintBehavior),
          const FieldDefLike(key: 'nom', type: 'text'),
        ],
      );

  Future<void> pump(WidgetTester t, RenderCtx c) => t.pumpWidget(Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: c))),
      ));

  test('extractAccentSettings devuelve colorFieldKey del field color_hex', () {
    final a = extractAccentSettings(
      const ViewComposition(recipe: 'editorial', action: 'none', slots: {}),
      const {'tint': '#abcdef'},
      const [FieldDefLike(key: 'tint', type: 'text', behavior: 'color_hex')],
      'top',
    );
    expect(a, isNotNull);
    expect(a!.colorFieldKey, 'tint');
    expect(a.color, '#abcdef');
  });

  testWidgets('acento activo (color_hex) → la celda del colorFieldKey colapsa', (t) async {
    await pump(t, ctx(tintBehavior: 'color_hex'));
    expect(find.text('Ignis'), findsOneWidget); // el otro slot sí se pinta
    expect(find.textContaining('abcdef', findRichText: true), findsNothing); // el color NO
  });

  testWidgets('sin color_hex (sin acento) → la celda del color SÍ se pinta', (t) async {
    await pump(t, ctx(tintBehavior: 'none'));
    expect(find.text('Ignis'), findsOneWidget);
    expect(find.textContaining('abcdef', findRichText: true), findsOneWidget);
  });
}
