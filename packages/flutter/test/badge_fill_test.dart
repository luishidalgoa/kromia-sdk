import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-198 follow-up (TS `f633dd1`) — `chipWidth:'fill'` en el badge de slot
/// ÚNICO: la pastilla estira al 100% del contenedor; ausente/'content' = clásico.
RenderCtx _ctx(SlotAppearance ap) => RenderCtx(
      composition: ViewComposition(recipe: 'editorial', action: 'none', slots: {
        'b': SlotComposition(fields: const ['tipo'], appearance: ap),
      }),
      item: const {'tipo': 'Fuego'},
      fieldDefs: const [FieldDefLike(key: 'tipo', type: 'text')],
    );

Future<void> _pump(WidgetTester t, SlotAppearance ap) async {
  final w = slotContent(_ctx(ap), 'b');
  await t.pumpWidget(Directionality(
    textDirection: TextDirection.ltr,
    // Align = constraints SUELTAS (como una columna real): el badge clásico se
    // ajusta al contenido; el fill estira hasta el ancho disponible (300).
    child: Center(
      child: SizedBox(
        width: 300,
        child: Align(alignment: Alignment.centerLeft, child: w ?? const SizedBox()),
      ),
    ),
  ));
  await t.pump();
}

void main() {
  testWidgets("badge único + chipWidth:'fill' → pastilla a ancho completo", (t) async {
    await _pump(t, const SlotAppearance(display: 'badge', chipWidth: 'fill'));
    expect(find.text('Fuego'), findsOneWidget);
    // La pastilla (Container) ocupa el ancho del contenedor (300).
    final pill = t.getSize(find.ancestor(of: find.text('Fuego'), matching: find.byType(Container)).first);
    expect(pill.width, 300);
  });

  testWidgets("badge único sin chipWidth → fit-content (clásico)", (t) async {
    await _pump(t, const SlotAppearance(display: 'badge'));
    final pill = t.getSize(find.ancestor(of: find.text('Fuego'), matching: find.byType(Container)).first);
    expect(pill.width, lessThan(300), reason: 'la pastilla se ajusta al contenido');
  });
}
