import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-133 — el detalle puede llevar un LAYOUT custom editado por el publisher en
/// el canvas de Studio (`targetComposition.layout`). Debe SOBREVIVIR al parseo y a
/// `resolveDetailComposition` (espejo de `detailCompositionAt`/`materializeDetailComp`
/// de Studio). Antes el modelo Dart no tenía el campo → se descartaba → el detalle
/// caía al preset de la receta (drift TS↔Dart).
void main() {
  test('TargetComposition.fromJson parsea layout/slotOverrides/accentPosition', () {
    final tc = TargetComposition.fromJson(<String, dynamic>{
      'recipe': 'momento',
      'action': 'none',
      'slots': {
        'title': {'fields': ['titulo']},
      },
      'accentPosition': 'left',
      'slotOverrides': {
        'disabled': ['subtitle'],
      },
      'layout': {
        'type': 'container',
        'kind': 'stack',
        'children': [
          {'type': 'slot', 'slot': 'title'},
        ],
      },
    });
    expect(tc.layout, isNotNull, reason: 'el lienzo editado no debe descartarse');
    expect(tc.layout!.kind, 'stack');
    expect(tc.accentPosition, 'left');
    expect(tc.slotOverrides?.disabled, ['subtitle']);
  });

  test('resolveDetailComposition PRESERVA el layout custom del targetComposition', () {
    const customLayout = LayoutContainerNode(
      kind: 'grid',
      columns: 1,
      children: [
        LayoutSlotNode(slot: 'title'),
        LayoutComponentNode(component: 'gallery_grid', slots: {'images': 'imagenes'}),
      ],
    );
    const vc = ViewComposition(
      recipe: 'row_text',
      action: 'navigate_to_detail',
      slots: {'title': SlotComposition(fields: ['titulo'])},
      targetComposition: TargetComposition(
        recipe: 'momento',
        action: 'none',
        slots: {'title': SlotComposition(fields: ['titulo'])},
        layout: customLayout,
      ),
    );
    final detail = resolveDetailComposition(vc, const [FieldDefLike(key: 'titulo', type: 'text')]);
    expect(detail.layout, isNotNull, reason: 'el detalle debe respetar el lienzo del publisher');
    expect(detail.layout!.kind, 'grid');
    expect(detail.layout!.children.length, 2);
  });

  test('sin layout custom → resolveDetailComposition no inventa layout (cae al preset)', () {
    const vc = ViewComposition(
      recipe: 'row_text',
      action: 'navigate_to_detail',
      slots: {'title': SlotComposition(fields: ['titulo'])},
      targetComposition: TargetComposition(
        recipe: 'momento',
        action: 'none',
        slots: {'title': SlotComposition(fields: ['titulo'])},
      ),
    );
    final detail = resolveDetailComposition(vc, const [FieldDefLike(key: 'titulo', type: 'text')]);
    expect(detail.layout, isNull);
  });
}
