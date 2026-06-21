import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-131 — `buildAutoDetailComposition(fields, recipeId)` recipe-aware: con un
/// targetRecipe != hero, mapea a los slots REALES de esa receta por
/// compatibilidad (cover ← imagen SIN behavior → arregla la portada vacía).
void main() {
  final fields = [
    const FieldDefLike(key: 'estandarte', type: 'image'), // imagen SIN behavior
    const FieldDefLike(key: 'nombre', type: 'text'),
    const FieldDefLike(key: 'descripcion', type: 'textarea', behavior: 'markdown'),
  ];

  test('editorial: imagen sin behavior → cover; textarea → body', () {
    final comp = buildAutoDetailComposition(fields, 'editorial');
    expect(comp.recipe, 'editorial');
    expect(comp.slots['cover']?.fields, contains('estandarte'));
    expect(comp.slots['body']?.fields, contains('descripcion'));
  });

  test('sin recipeId (o hero) → hero legacy intacto', () {
    expect(buildAutoDetailComposition(fields).recipe, 'hero_protagonico');
    expect(buildAutoDetailComposition(fields, 'hero_protagonico').recipe, 'hero_protagonico');
  });

  test('resolveDetailComposition usa el targetRecipe de la lista', () {
    final list = ViewComposition.fromJson(<String, dynamic>{
      'recipe': 'compact_card',
      'action': 'navigate_to_detail',
      'targetRecipe': 'editorial',
      'slots': {'title': {'fields': ['nombre']}},
    });
    final detail = resolveDetailComposition(list, fields);
    expect(detail.recipe, 'editorial');
    expect(detail.slots['cover']?.fields, contains('estandarte'));
  });
}
