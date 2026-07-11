import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-217 — el fix del "texto oscuro sobre fondo oscuro". El acabado persiste
/// `layout.surface.textColor` (un tono de paleta con AA); el render debe aplicarlo
/// como color BASE del subárbol (cascada CSS en web = `DefaultTextStyle` en Flutter).
/// Sin esto, el texto caía al `foreground` del tema de la app → ilegible sobre el
/// papel oscuro del acabado. Y `stats_row` hardcodeaba colores del tema que NO
/// heredaban (las "stats verdes" de la captura).
void main() {
  group('paletteHex / screenBgHex (KRO-217 §1)', () {
    test('tono de paleta → hex crudo; token de tema/field/null → null', () {
      expect(KromiaTokens.paletteHex('white'), const Color(0xFFFFFFFF));
      expect(KromiaTokens.paletteHex('black'), const Color(0xFF000000));
      expect(KromiaTokens.paletteHex('slate-800'), const Color(0xFF1E293B));
      expect(KromiaTokens.paletteHex('red-500'), const Color(0xFFEF4444));
      // Tokens de tema → null (el render cae al tema de la app, sin forzar hex).
      expect(KromiaTokens.paletteHex('card'), isNull);
      expect(KromiaTokens.paletteHex('muted'), isNull);
      expect(KromiaTokens.paletteHex('foreground'), isNull);
      expect(KromiaTokens.paletteHex('field:tipo'), isNull);
      expect(KromiaTokens.paletteHex(null), isNull);
      expect(KromiaTokens.paletteHex(''), isNull);
    });

    test('screenBgHex mezcla 18% hacia negro (papel de pantalla)', () {
      expect(KromiaTokens.screenBgHex('white'),
          Color.lerp(const Color(0xFFFFFFFF), const Color(0xFF000000), 0.18));
      expect(KromiaTokens.screenBgHex('card'), isNull); // token de tema → fondo de app
    });
  });

  group('LayoutRenderer aplica surface.textColor como color base (cascada)', () {
    RenderCtx ctx(String? textColor, {SlotAppearance? bodyAp}) => RenderCtx(
          composition: ViewComposition(
            recipe: 'editorial',
            action: 'none',
            layout: LayoutContainerNode(
              kind: 'flex',
              direction: 'column',
              surface: ContainerSurface(bgColor: 'slate-800', textColor: textColor),
              children: const [LayoutSlotNode(slot: 'body')],
            ),
            slots: {'body': SlotComposition(fields: const ['desc'], appearance: bodyAp)},
          ),
          item: const {'desc': 'Brasaduende de las fraguas'},
          fieldDefs: const [FieldDefLike(key: 'desc', type: 'text')],
        );

    Future<void> pump(WidgetTester t, RenderCtx c) => t.pumpWidget(Directionality(
          textDirection: TextDirection.ltr,
          child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: c))),
        ));

    testWidgets('con acabado (textColor=white) → DefaultTextStyle blanco + slot hereda', (t) async {
      await pump(t, ctx('white'));
      expect(find.text('Brasaduende de las fraguas'), findsOneWidget);
      // El slot NO fija color propio → lo hereda (color null en su TextStyle).
      expect(t.widget<Text>(find.text('Brasaduende de las fraguas')).style?.color, isNull);
      // Hay un DefaultTextStyle con el color del acabado envolviendo el subárbol.
      final whites = t
          .widgetList<DefaultTextStyle>(find.byType(DefaultTextStyle))
          .where((d) => d.style.color == const Color(0xFFFFFFFF));
      expect(whites, isNotEmpty);
    });

    testWidgets('sin acabado (textColor=null/token de tema) → NO se inyecta color base', (t) async {
      await pump(t, ctx(null));
      final whites = t
          .widgetList<DefaultTextStyle>(find.byType(DefaultTextStyle))
          .where((d) => d.style.color == const Color(0xFFFFFFFF));
      expect(whites, isEmpty); // cae al tema de la app, no fuerza un hex
    });

    testWidgets('slot con textColor propio GANA sobre el base (hijo > raíz)', (t) async {
      await pump(t, ctx('white', bodyAp: const SlotAppearance(textColor: 'red-500')));
      expect(t.widget<Text>(find.text('Brasaduende de las fraguas')).style?.color, const Color(0xFFEF4444));
    });
  });

  group('stats_row hereda el color base (no un foreground fijo) — §18.1', () {
    RenderCtx ctx(String? textColor) => RenderCtx(
          composition: ViewComposition(
            recipe: 'hero_protagonico',
            action: 'none',
            layout: LayoutContainerNode(
              kind: 'flex',
              direction: 'column',
              surface: ContainerSurface(bgColor: 'slate-800', textColor: textColor),
              children: const [LayoutComponentNode(component: 'stats_row', slots: {'stats': 'stats'})],
            ),
            slots: {'stats': SlotComposition(fields: const ['alt', 'peso'])},
          ),
          item: const {'alt': '0.9', 'peso': '12'},
          fieldDefs: const [
            FieldDefLike(key: 'alt', type: 'number', label: 'Altura'),
            FieldDefLike(key: 'peso', type: 'number', label: 'Peso'),
          ],
        );

    testWidgets('el VALOR no fija color (hereda el surface.textColor)', (t) async {
      await t.pumpWidget(Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx('white')))),
      ));
      expect(find.text('0.9'), findsOneWidget);
      // Antes fijaba KromiaTokens.body (color foreground) → NO heredaba = "stats verdes".
      expect(t.widget<Text>(find.text('0.9')).style?.color, isNull);
    });
  });
}
