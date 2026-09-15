import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-470 (espejo de KRO-222) — tocar un DATO de la composición avisa al host
/// con la key del campo tocado, para que abra su ficha (nombre + valor + nota).
///
/// El dato es lo que se ve: una estadística, un chip o el texto de un slot. Cada
/// uno responde con SU campo, no con el primero de la fila — «Fuego» tiene que
/// abrir el Elemento, no la Rareza que va a su lado.
RenderCtx _ctx({FieldTap? onFieldTap}) => RenderCtx(
      composition: ViewComposition(recipe: 'editorial', action: 'none', slots: {
        'stats': SlotComposition(fields: const ['poder', 'altura']),
        'chips': SlotComposition(fields: const ['elemento', 'rareza']),
        'lema': SlotComposition(fields: const ['lema']),
        'foto': SlotComposition(fields: const ['foto']),
      }),
      item: const {
        'poder': 90,
        'altura': 1.8,
        'elemento': 'Fuego',
        'rareza': 'Rara',
        'lema': 'Arde sin quemarse',
        'foto': 'https://example.com/a.png',
      },
      fieldDefs: const [
        FieldDefLike(key: 'poder', type: 'number', label: 'Poder'),
        FieldDefLike(
            key: 'altura', type: 'number', label: 'Altura',
            behavior: 'measurement', behaviorConfig: {'unit': 'm'}),
        FieldDefLike(key: 'elemento', type: 'select', label: 'Elemento'),
        FieldDefLike(key: 'rareza', type: 'select', label: 'Rareza'),
        FieldDefLike(key: 'lema', type: 'text', label: 'Lema'),
        FieldDefLike(key: 'foto', type: 'image', label: 'Foto'),
      ],
      imageBuilder: (url, {fit = BoxFit.cover, alignment = Alignment.center, width, height}) =>
          SizedBox(key: const Key('foto'), width: width ?? 100, height: height ?? 100),
      onFieldTap: onFieldTap,
    );

Future<void> _pump(WidgetTester t, RenderCtx ctx) async {
  Widget comp(String c, Map<String, String> slots) =>
      componentContent(ctx, LayoutComponentNode(component: c, slots: slots)) ?? const SizedBox();
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: SizedBox(
        width: 320,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          comp('stats_row', {'stats': 'stats'}),
          comp('chips_row', {'chips': 'chips'}),
          slotContent(ctx, 'lema') ?? const SizedBox(),
          slotContent(ctx, 'foto') ?? const SizedBox(),
        ]),
      ),
    ),
  ));
}

void main() {
  testWidgets('cada dato avisa con SU campo', (t) async {
    final tocados = <String>[];
    await _pump(t, _ctx(onFieldTap: tocados.add));

    for (final (visto, campo) in [
      ('90', 'poder'),
      ('1.8 m', 'altura'), // el valor como lo pinta la carta, con su unidad
      ('Fuego', 'elemento'),
      ('Rara', 'rareza'),
      ('Arde sin quemarse', 'lema'),
    ]) {
      expect(find.text(visto), findsOneWidget, reason: 'control: «$visto» está pintado');
      await t.tap(find.text(visto));
      expect(tocados.last, campo, reason: 'tocar «$visto» abre $campo');
    }
    expect(tocados, hasLength(5));
  });

  testWidgets('la etiqueta de una estadística también abre su campo', (t) async {
    final tocados = <String>[];
    await _pump(t, _ctx(onFieldTap: tocados.add));
    await t.tap(find.text('ALTURA'));
    expect(tocados, ['altura']);
  });

  testWidgets('una imagen no es un dato: no abre ficha', (t) async {
    final tocados = <String>[];
    await _pump(t, _ctx(onFieldTap: tocados.add));
    expect(find.byKey(const Key('foto')), findsOneWidget, reason: 'control: la imagen está');
    await t.tap(find.byKey(const Key('foto')), warnIfMissed: false);
    expect(tocados, isEmpty);
  });

  testWidgets('sin gancho, el árbol no gana detectores', (t) async {
    await _pump(t, _ctx());
    expect(find.byType(GestureDetector), findsNothing);
    // Control: con gancho, sí los hay (si no, el findsNothing no probaría nada).
    await _pump(t, _ctx(onFieldTap: (_) {}));
    expect(find.byType(GestureDetector), findsWidgets);
  });
}
