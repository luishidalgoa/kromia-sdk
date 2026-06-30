import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-217 — paridad Flutter de los fixes de apariencia del motor (commit TS
/// 6346aea): `section_title` honra la apariencia del slot (antes la descartaba) y
/// las galerías de bloque propagan forma/aspect/objectFit/efectos/encuadre por
/// celda (antes pintaban `cover` fijo).
RenderCtx _ctx({SlotAppearance? titleAp, SlotAppearance? galleryAp}) => RenderCtx(
      composition: ViewComposition(recipe: 'editorial', action: 'none', slots: {
        'title': SlotComposition(fields: const ['nombre'], appearance: titleAp),
        'gallery': SlotComposition(fields: const ['fotos'], appearance: galleryAp),
      }),
      item: const {
        'nombre': 'Pelé',
        'fotos': ['http://x.test/a.png', 'http://x.test/b.png'],
      },
      fieldDefs: const [
        FieldDefLike(key: 'nombre', type: 'text'),
        FieldDefLike(key: 'fotos', type: 'array<image>'),
      ],
    );

Future<void> _pump(WidgetTester t, Widget? w) => t.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: SizedBox(width: 320, child: w ?? const SizedBox())),
      ),
    );

void main() {
  group('section_title honra apariencia (KRO-217)', () {
    testWidgets('textColor del slot → color del texto (uppercase preservado)', (t) async {
      final w = componentContent(
        _ctx(titleAp: const SlotAppearance(textColor: 'red-500')),
        const LayoutComponentNode(component: 'section_title', slots: {'text': 'title'}),
      );
      await _pump(t, w);
      // 'uppercase' = IDENTIDAD del título de sección (se conserva).
      expect(find.text('PELÉ'), findsOneWidget);
      // red-500 = 0xFFEF4444 (paleta Tailwind) — antes el color era fijo (muted).
      expect(t.widget<Text>(find.text('PELÉ')).style?.color, const Color(0xFFEF4444));
    });

    testWidgets('sin apariencia → sigue en uppercase (sin regresión)', (t) async {
      final w = componentContent(
        _ctx(),
        const LayoutComponentNode(component: 'section_title', slots: {'text': 'title'}),
      );
      await _pump(t, w);
      expect(find.text('PELÉ'), findsOneWidget);
    });
  });

  group('galerías de bloque honran apariencia (KRO-217)', () {
    testWidgets('shape:circle del slot → la celda usa ClipOval', (t) async {
      final w = componentContent(
        _ctx(galleryAp: const SlotAppearance(shape: 'circle')),
        const LayoutComponentNode(component: 'gallery_grid', slots: {'images': 'gallery'}),
      );
      await _pump(t, w);
      expect(find.byType(ClipOval), findsWidgets);
    });

    testWidgets('sin apariencia → celdas rectangulares (ClipRRect, sin ClipOval)', (t) async {
      final w = componentContent(
        _ctx(),
        const LayoutComponentNode(component: 'gallery_grid', slots: {'images': 'gallery'}),
      );
      await _pump(t, w);
      expect(find.byType(ClipOval), findsNothing);
      expect(find.byType(ClipRRect), findsWidgets);
    });
  });
}
