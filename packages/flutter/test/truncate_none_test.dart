import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// El recorte lo manda la APARIENCIA, no el widget.
///
/// Reporte del user: una descripción que en Studio sale entera, en la app sale
/// cortada con «…». Este fichero fija qué obedece el motor, para poder decir con
/// pruebas dónde NO está el fallo:
///
/// - `truncate: 'none'` → sin recorte, sea cual sea el tipo del campo.
/// - texto LARGO (textarea/markdown) sin `truncate` → sin recorte (KRO-158: el
///   texto completo es el contrato de un body).
/// - texto CORTO sin `truncate` → una línea, que es el default de siempre.
///
/// Si con esto en verde la app sigue cortando, el recorte no viene del motor:
/// viene del dato (el campo no es de tipo largo) o de fuera del renderer.
int? _maxLinesDe(WidgetTester t) {
  final textos = t.widgetList<Text>(find.byType(Text)).toList();
  expect(textos, isNotEmpty, reason: 'sin texto pintado el test no prueba nada');
  return textos.first.maxLines;
}

RenderCtx _ctx({required String tipo, String? truncate, String? behavior}) =>
    RenderCtx(
      composition: ViewComposition(
        recipe: 'editorial',
        action: 'none',
        slots: {
          'body': SlotComposition(
            fields: const ['descripcion'],
            appearance: SlotAppearance(truncate: truncate),
          ),
        },
      ),
      item: const {
        'descripcion':
            'Auroria nació de una tormenta de luz. Sus habitantes cuentan que '
                'el cielo se partió en dos y de la grieta cayó el primer '
                'fragmento, todavía caliente, sobre la arena negra.',
      },
      fieldDefs: [
        FieldDefLike(key: 'descripcion', type: tipo, behavior: behavior),
      ],
    );

Future<void> _pintar(WidgetTester t, RenderCtx ctx) async {
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    child: MediaQuery(
      data: const MediaQueryData(size: Size(390, 844)),
      child: SizedBox(width: 320, child: slotContent(ctx, 'body') ?? const SizedBox()),
    ),
  ));
}

void main() {
  testWidgets('truncate «none» NO corta, aunque el campo sea corto', (t) async {
    await _pintar(t, _ctx(tipo: 'text', truncate: 'none'));
    expect(_maxLinesDe(t), isNull);
  });

  testWidgets('texto largo SIN truncate tampoco corta (KRO-158)', (t) async {
    await _pintar(t, _ctx(tipo: 'textarea'));
    expect(_maxLinesDe(t), isNull);
  });

  testWidgets('un markdown largo sin truncate tampoco', (t) async {
    await _pintar(t, _ctx(tipo: 'textarea', behavior: 'markdown'));
    expect(_maxLinesDe(t), isNull);
  });

  testWidgets('texto CORTO sin truncate sí: una línea', (t) async {
    // La mitad que le da valor a las otras tres. Sin esto, un motor que no
    // cortara nunca las pasaría igual.
    await _pintar(t, _ctx(tipo: 'text'));
    expect(_maxLinesDe(t), 1);
  });

  testWidgets('truncate «2» manda sobre el default de texto largo', (t) async {
    await _pintar(t, _ctx(tipo: 'textarea', truncate: '2'));
    expect(_maxLinesDe(t), 2);
  });
}
