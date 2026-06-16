/// Corpus de `recipe_presets.dart` — ESPEJO de `tests/recipe-presets.test.ts`
/// (KRO-133 F5 / KRO-145). Por cada preset: migra a un árbol válido, coloca TODOS
/// los slots (sin drops), sin fantasmas, preserva slots custom, fusiona apariencia
/// (usuario gana), es puro, y robusto con slots ausentes.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

ViewComposition fullComposition(String recipe) {
  final manifest = getRecipeManifest(recipe)!;
  final slots = <String, SlotComposition>{
    for (final s in manifest.slots) s.id: SlotComposition(fields: [s.id]),
  };
  return ViewComposition(recipe: recipe, action: 'none', slots: slots);
}

List<LayoutIssue> errorsOf(ViewComposition comp) =>
    validateLayout(comp.layout, slots: comp.slots).issues.where((i) => i.level == 'error').toList();

void main() {
  final presetRecipes = recipePresets.keys.toList();

  test('el catálogo cubre las clásicas + block-native (≥12)', () {
    expect(presetRecipes.length, greaterThanOrEqualTo(12));
    for (final r in [
      'compact_card', 'compact_avatar', 'row_text', 'hero_protagonico',
      'editorial', 'momento', 'accordion_simple', 'accordion_with_actions',
    ]) {
      expect(presetRecipes, contains(r), reason: 'falta preset de $r');
    }
  });

  for (final recipe in presetRecipes) {
    group(recipe, () {
      test('el manifest existe con slots', () {
        final m = getRecipeManifest(recipe);
        expect(m, isNotNull, reason: '$recipe sin manifest');
        expect(m!.slots.length, greaterThan(0));
      });

      test('migra a un layout estructuralmente válido', () {
        final comp = recipeToComposition(fullComposition(recipe));
        expect(comp.layout, isNotNull);
        expect(errorsOf(comp), isEmpty);
        expect(validateLayout(comp.layout, slots: comp.slots).ok, true);
      });

      test('coloca TODOS los slots del manifest — sin drops', () {
        final comp = recipeToComposition(fullComposition(recipe));
        final placed = collectLayoutSlots(comp.layout!).toSet();
        final missing = getRecipeManifest(recipe)!.slots.map((s) => s.id).where((id) => !placed.contains(id)).toList();
        expect(missing, isEmpty, reason: '$recipe: el preset no coloca estos slots');
      });

      test('solo referencia slots presentes (sin fantasmas)', () {
        final comp = recipeToComposition(fullComposition(recipe));
        for (final slot in collectLayoutSlots(comp.layout!)) {
          expect(comp.slots[slot], isNotNull, reason: '$recipe referencia slot ausente "$slot"');
        }
      });

      test('preserva un slot CUSTOM no contemplado por el preset', () {
        final base = fullComposition(recipe);
        final slots = <String, SlotComposition>{...base.slots, '__custom__': const SlotComposition(fields: ['__custom__'])};
        final comp = recipeToComposition(ViewComposition(recipe: recipe, action: 'none', slots: slots));
        final placed = collectLayoutSlots(comp.layout!).toSet();
        expect(placed.contains('__custom__'), true, reason: '$recipe: slot custom perdido al migrar');
        expect(errorsOf(comp), isEmpty);
      });

      test('fusiona la apariencia base del preset en ≥1 slot', () {
        final comp = recipeToComposition(fullComposition(recipe));
        final any = comp.slots.values.any((s) => s.appearance?.isNotEmpty ?? false);
        expect(any, true);
      });

      test('la apariencia del usuario GANA sobre la del preset', () {
        final preset = recipePresets[recipe]!;
        final styled = (preset.appearance ?? const {}).keys.where((k) => getRecipeManifest(recipe)!.slots.any((s) => s.id == k));
        if (styled.isEmpty) return; // sin appearance sobre slots del manifest
        final slot = styled.first;
        final base = fullComposition(recipe);
        final slots = <String, SlotComposition>{...base.slots};
        slots[slot] = SlotComposition(fields: [slot], appearance: const SlotAppearance(align: '__user__'));
        final next = recipeToComposition(ViewComposition(recipe: recipe, action: 'none', slots: slots));
        expect(next.slots[slot]!.appearance!.align, '__user__');
      });

      test('es robusto con slots OPCIONALES ausentes (solo requeridos)', () {
        final manifest = getRecipeManifest(recipe)!;
        final slots = <String, SlotComposition>{
          for (final s in manifest.slots)
            if (!s.optional) s.id: SlotComposition(fields: [s.id]),
        };
        final comp = recipeToComposition(ViewComposition(recipe: recipe, action: 'none', slots: slots));
        expect(errorsOf(comp), isEmpty);
      });

      test('es robusto con UN solo slot y con ninguno', () {
        final manifest = getRecipeManifest(recipe)!;
        for (final s in manifest.slots) {
          final comp = recipeToComposition(
              ViewComposition(recipe: recipe, action: 'none', slots: {s.id: SlotComposition(fields: [s.id])}));
          expect(errorsOf(comp), isEmpty, reason: '$recipe con solo "${s.id}"');
        }
        final empty = recipeToComposition(ViewComposition(recipe: recipe, action: 'none', slots: const {}));
        expect(errorsOf(empty), isEmpty, reason: '$recipe sin slots');
      });
    });
  }
}
