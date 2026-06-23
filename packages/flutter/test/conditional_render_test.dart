import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-198 — el render honra el "Estilo por valor" (conditionalStyle) en resolveSlot:
/// caso/else efectivo, scoping SIN target (sobre la base) vs CON target (sobre el
/// chip), y sin mutar el modelo. + smoke de badge_row.
RenderCtx _ctx(SlotComposition badges, Map<String, dynamic> item) => RenderCtx(
      composition: ViewComposition(recipe: 'detail_profile', action: 'none', slots: {'badges': badges}),
      item: item,
      fieldDefs: const [
        FieldDefLike(key: 'rareza', type: 'text'),
        FieldDefLike(key: 'tipo', type: 'text'),
      ],
    );

void main() {
  const baseAp = SlotAppearance(bgColor: 'muted');
  const condAp = SlotAppearance(bgColor: 'primary');

  group('resolveSlot — estilo condicional (KRO-198)', () {
    test('sin conditionalStyle → appearance/base intactos (camino base, ancla 26/26)', () {
      final r = resolveSlot(
          _ctx(const SlotComposition(fields: ['rareza'], appearance: baseAp), const {'rareza': 'Épica'}), 'badges')!;
      expect(identical(r.appearance, baseAp), isTrue);
      expect(r.fieldAppearances, isNull);
    });

    test('condicional SIN target que matchea → merge sobre la base (condAp gana)', () {
      const comp = SlotComposition(
        fields: ['rareza'],
        appearance: baseAp,
        conditionalStyle: ConditionalStyle(
            fieldKey: 'rareza', cases: [ConditionalStyleCase(value: 'Épica', appearance: condAp)]),
      );
      final r = resolveSlot(_ctx(comp, const {'rareza': 'Épica'}), 'badges')!;
      expect(r.appearance!.bgColor, 'primary'); // condAp gana sobre la base
      expect(r.fieldAppearances, isNull); // sin target, no toca por-chip
    });

    test('condicional CON target que matchea → fieldAppearances[target], base intacta', () {
      const comp = SlotComposition(
        fields: ['rareza', 'tipo'],
        appearance: baseAp,
        conditionalStyle: ConditionalStyle(
            fieldKey: 'rareza',
            cases: [ConditionalStyleCase(value: 'Épica', appearance: condAp, target: ['rareza'])]),
      );
      final r = resolveSlot(_ctx(comp, const {'rareza': 'Épica', 'tipo': 'Fuego'}), 'badges')!;
      expect(identical(r.appearance, baseAp), isTrue); // base de la fila intacta
      expect(r.fieldAppearances!['rareza']!.bgColor, 'primary'); // chip objetivo coloreado
      expect(r.fieldAppearances!.containsKey('tipo'), isFalse); // otros chips sin tocar
    });

    test('cláusula else (otherwise) se aplica cuando ningún caso matchea', () {
      const comp = SlotComposition(
        fields: ['rareza'],
        appearance: baseAp,
        conditionalStyle: ConditionalStyle(
          fieldKey: 'rareza',
          cases: [ConditionalStyleCase(value: 'Épica', appearance: condAp)],
          otherwise: ConditionalStyleCase(appearance: SlotAppearance(bgColor: 'slate-200')),
        ),
      );
      final r = resolveSlot(_ctx(comp, const {'rareza': 'Común'}), 'badges')!;
      expect(r.appearance!.bgColor, 'slate-200'); // el else manda
    });

    test('NO muta el modelo parseado (fieldAppearances del comp intacto)', () {
      const original = SlotAppearance(opacity: '50');
      const comp = SlotComposition(
        fields: ['rareza'],
        appearance: baseAp,
        fieldAppearances: {'rareza': original},
        conditionalStyle: ConditionalStyle(
            fieldKey: 'rareza',
            cases: [ConditionalStyleCase(value: 'Épica', appearance: condAp, target: ['rareza'])]),
      );
      final r = resolveSlot(_ctx(comp, const {'rareza': 'Épica'}), 'badges')!;
      expect(r.fieldAppearances!['rareza']!.bgColor, 'primary'); // el resuelto sí
      expect(r.fieldAppearances!['rareza']!.opacity, '50'); // mergeado sobre el por-chip
      expect(identical(comp.fieldAppearances!['rareza'], original), isTrue); // el ORIGINAL intacto
    });
  });

  group('badge_row (KRO-198 render)', () {
    Future<void> pumpBadges(WidgetTester t, SlotComposition badges, Map<String, dynamic> item) async {
      final w = componentContent(
        _ctx(badges, item),
        const LayoutComponentNode(component: 'badge_row', slots: {'badges': 'badges'}),
      );
      await t.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: Center(child: w ?? const SizedBox())));
      await t.pump();
    }

    testWidgets('pinta una pastilla por field con valor (Wrap)', (t) async {
      await pumpBadges(t, const SlotComposition(fields: ['rareza', 'tipo']), const {'rareza': 'Épica', 'tipo': 'Fuego'});
      expect(find.text('Épica'), findsOneWidget);
      expect(find.text('Fuego'), findsOneWidget);
      expect(find.byType(Wrap), findsOneWidget);
    });

    testWidgets("display:'text' → texto plano (sin Container de pastilla)", (t) async {
      await pumpBadges(
        t,
        const SlotComposition(fields: ['rareza'], appearance: SlotAppearance(display: 'text')),
        const {'rareza': 'Épica'},
      );
      expect(find.text('Épica'), findsOneWidget);
      expect(find.byType(Container), findsNothing); // sin caja
    });

    testWidgets('condicional con target → no rompe y pinta ambos chips', (t) async {
      await pumpBadges(
        t,
        const SlotComposition(
          fields: ['rareza', 'tipo'],
          conditionalStyle: ConditionalStyle(
              fieldKey: 'rareza',
              cases: [ConditionalStyleCase(value: 'Épica', appearance: SlotAppearance(bgColor: 'primary'), target: ['rareza'])]),
        ),
        const {'rareza': 'Épica', 'tipo': 'Fuego'},
      );
      expect(find.text('Épica'), findsOneWidget);
      expect(find.text('Fuego'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });
}
