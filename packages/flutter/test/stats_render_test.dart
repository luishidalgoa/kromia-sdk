import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-222 — espejo Dart de `StatsRow.tsx`: el VALOR recorta por `truncateChars`
/// (Apariencia→Recorte→Caracteres) + "…"; la ETIQUETA envuelve a 2 líneas
/// (line-clamp-2) y parte palabras largas en vez de cortarse sin ellipsis.
RenderCtx _ctx({
  SlotAppearance? appearance,
  Map<String, SlotAppearance>? fieldAppearances,
}) =>
    RenderCtx(
      composition: ViewComposition(recipe: 'editorial', action: 'none', slots: {
        'stats': SlotComposition(
          fields: const ['poder', 'estado'],
          appearance: appearance,
          fieldAppearances: fieldAppearances,
        ),
      }),
      item: const {'poder': '99999', 'estado': 'COMUN'},
      fieldDefs: const [
        // La etiqueta de 'poder' es la palabra larga del bug ("DESCUBIERTO").
        FieldDefLike(key: 'poder', type: 'text', label: 'DESCUBIERTO'),
        FieldDefLike(key: 'estado', type: 'text', label: 'Estado'),
      ],
    );

Future<void> _pump(WidgetTester t, RenderCtx ctx) async {
  final w = componentContent(ctx, const LayoutComponentNode(component: 'stats_row', slots: {'stats': 'stats'}));
  await t.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: Center(child: SizedBox(width: 280, child: w ?? const SizedBox()))));
  await t.pump();
}

void main() {
  group('_statsRow (KRO-222)', () {
    testWidgets('etiqueta envuelve a 2 líneas (line-clamp-2), no 1', (t) async {
      await _pump(t, _ctx());
      final label = t.widget<Text>(find.text('DESCUBIERTO'));
      expect(label.maxLines, 2, reason: 'la etiqueta ya no se trunca a 1 línea');
      // softWrap activo (default) → Flutter parte la palabra larga si no cabe.
      expect(label.softWrap, isNot(false));
      // El VALOR por defecto sigue a 1 línea (como el `truncate` CSS).
      expect(t.widget<Text>(find.text('99999')).maxLines, 1);
    });

    testWidgets('truncateChars (nivel-slot) recorta el VALOR + "…"', (t) async {
      await _pump(t, _ctx(appearance: const SlotAppearance(truncateChars: 3)));
      expect(find.text('999…'), findsOneWidget);
      expect(find.text('99999'), findsNothing);
      // Aplica a todas las stats del slot.
      expect(find.text('COM…'), findsOneWidget);
    });

    testWidgets('truncateChars POR-CAMPO recorta solo su stat (mergeFieldAppearance)', (t) async {
      await _pump(t, _ctx(fieldAppearances: const {'poder': SlotAppearance(truncateChars: 3)}));
      expect(find.text('999…'), findsOneWidget);
      expect(find.text('COMUN'), findsOneWidget, reason: "'estado' no lleva truncate → intacto");
    });

    testWidgets("truncate:'none' por-campo → etiqueta sin clamp (maxLines null)", (t) async {
      await _pump(t, _ctx(fieldAppearances: const {'poder': SlotAppearance(truncate: 'none')}));
      expect(t.widget<Text>(find.text('DESCUBIERTO')).maxLines, isNull);
    });
  });
}
