import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// Regresión del reparto de columnas `1fr` / `content` en el grid emulado
/// (`_emulatedGrid`). Caso REAL: la fila [subtitle | badge] de la LISTA Reinos
/// (feature_card) tiene `columnSizes:['1fr','content']` → el subtitle (1fr) debe
/// ESTIRAR y empujar el badge (content) al final (fit-content, pegado a la
/// derecha), espejo de `grid-template-columns: 1fr max-content` (CSS / @kromia/react).
///
/// Estructura ANIDADA exacta del backend (root grid 1col×3 filas: image, title,
/// sub-grid[1fr,content]) porque el bug solo se manifiesta con el grid anidado.
Widget _img(String url, {BoxFit fit = BoxFit.cover, Alignment alignment = Alignment.center, double? width, double? height}) =>
    SizedBox(width: width ?? 40, height: height ?? 40);

void main() {
  const layout = LayoutContainerNode(kind: 'grid', columns: 1, rows: 3, gap: 'sm', children: [
    LayoutSlotNode(slot: 'image', place: GridPlacement(colStart: 1, rowStart: 1)),
    LayoutSlotNode(slot: 'title', place: GridPlacement(colStart: 1, rowStart: 2)),
    LayoutContainerNode(
      kind: 'grid', columns: 2, rows: 1, gap: 'sm', align: 'center', columnSizes: ['1fr', 'content'],
      place: GridPlacement(colStart: 1, rowStart: 3),
      children: [
        LayoutSlotNode(slot: 'subtitle', place: GridPlacement(colStart: 1, rowStart: 1)),
        LayoutSlotNode(slot: 'badge', place: GridPlacement(colStart: 2, rowStart: 1)),
      ],
    ),
  ]);
  final slots = <String, SlotComposition>{
    'image': const SlotComposition(fields: ['estandarte'], appearance: SlotAppearance(aspect: '16:9', shape: 'rounded')),
    'title': const SlotComposition(fields: ['nombre'], appearance: SlotAppearance(weight: 'semibold', size: 'lg')),
    'subtitle': const SlotComposition(fields: ['clima'], appearance: SlotAppearance(size: 'md', textColor: 'muted')),
    'badge': const SlotComposition(fields: ['elemento'], appearance: SlotAppearance(display: 'badge')),
  };
  final defs = <FieldDefLike>[
    const FieldDefLike(key: 'estandarte', type: 'image'),
    const FieldDefLike(key: 'nombre', type: 'text'),
    const FieldDefLike(key: 'clima', type: 'text'),
    const FieldDefLike(key: 'elemento', type: 'text'),
  ];
  final item = <String, dynamic>{
    'estandarte': 'http://x.test/forjabrasa.png',
    'nombre': 'Forjabrasa',
    'clima': 'Árido',
    'elemento': 'Fuego',
  };

  testWidgets('grid anidado [1fr, content]: el badge (content) se ancla a la derecha, el 1fr estira', (t) async {
    final ctx = RenderCtx(
      composition: ViewComposition(recipe: 'feature_card', action: 'none', slots: slots, layout: layout),
      item: item,
      fieldDefs: defs,
      imageBuilder: _img,
    );
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: SizedBox(width: 300, child: LayoutRenderer(ctx: ctx))),
    ));
    await t.pump();

    final box = t.getRect(find.byType(LayoutRenderer)); // referencia (evita el offset del Center)
    final arido = t.getRect(find.text('Árido'));
    final fuego = t.getRect(find.text('Fuego'));
    // El badge (content) debe quedar pegado al borde derecho: hueco < ~40 (root p-3
    // 12 + padding del pill). Con el bug (50/50) el hueco era ~85.
    expect(box.right - fuego.right, lessThan(40),
        reason: 'el badge "content" debe anclarse a la derecha; hueco=${box.right - fuego.right} indica reparto 50/50 (Flexible flex:1)');
    // El subtitle (1fr) debe estirar a > 60% del ancho; con el bug ocupaba ~50%.
    expect(arido.width, greaterThan(box.width * 0.6),
        reason: 'el subtitle 1fr debe estirar; ancho=${arido.width} de ${box.width} indica celda al 50%');
  });
}
