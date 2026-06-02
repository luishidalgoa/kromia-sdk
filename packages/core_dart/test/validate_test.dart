/// Corpus de `validate.dart` — ESPEJO de `tests/validate.test.ts` (KRO-79).
///
/// Construye las composiciones vía constructores (el modelo Dart es tipado).
/// Los casos *estructurales* del TS que en Dart son irrepresentables por el
/// tipo (p.ej. `slots: null`) se omiten con nota: el parse (`fromJson`) los
/// previene antes de llegar al validador — garantía más fuerte, no más débil.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

ViewComposition vc({
  String recipe = 'hero_protagonico',
  String action = 'none',
  SlotComposition? title,
  String? accentPosition,
  NestedViewComposition? expand,
  String? linkField,
  String? targetRecipe,
  TargetComposition? targetComposition,
  SlotOverrides? slotOverrides,
}) =>
    ViewComposition(
      recipe: recipe,
      action: action,
      slots: {'title': title ?? const SlotComposition(fields: ['nombre'])},
      accentPosition: accentPosition,
      expand: expand,
      linkField: linkField,
      targetRecipe: targetRecipe,
      targetComposition: targetComposition,
      slotOverrides: slotOverrides,
    );

List<FieldDefLike> fieldsBase() => const [
      FieldDefLike(key: 'nombre', type: 'text'),
      FieldDefLike(key: 'edad', type: 'number'),
      FieldDefLike(key: 'avatar', type: 'image'),
      FieldDefLike(key: 'galeria', type: 'array<image>', behavior: 'gallery'),
    ];

ValidateCompositionOptions withFields() =>
    ValidateCompositionOptions(fieldDefs: fieldsBase());

void main() {
  group('happy paths', () {
    test('canónica sin fieldDefs → valid + sin issues', () {
      final r = validateComposition(vc());
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });

    test('canónica con fieldDefs → sin errores', () {
      final r = validateComposition(vc(), withFields());
      expect(r.issues.where((i) => i.level == 'error'), isEmpty);
    });

    test('accentPosition válido → valid', () {
      expect(validateComposition(vc(accentPosition: 'top')).valid, true);
    });
  });

  group('recipe', () {
    test('recipe inexistente → error', () {
      final r = validateComposition(vc(recipe: 'fake_recipe'));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.path == 'recipe' && i.level == 'error'), true);
    });
  });

  group('action', () {
    test('action inválida → error', () {
      final r = validateComposition(vc(action: 'fake_action'));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.path == 'action' && i.level == 'error'), true);
    });

    test('cada action válida pasa', () {
      for (final a in const [
        'none',
        'navigate_to_detail',
        'modal',
        'expand_inline',
        'external_link'
      ]) {
        final r = validateComposition(vc(action: a));
        expect(r.issues.where((i) => i.path == 'action' && i.level == 'error'),
            isEmpty);
      }
    });
  });

  group('slot fields', () {
    test('field inexistente con fieldDefs → error', () {
      final r = validateComposition(
          vc(title: const SlotComposition(fields: ['fantasma'])), withFields());
      expect(r.valid, false);
      expect(r.issues.any((i) => i.message.contains('fantasma')), true);
    });

    test('field inexistente SIN fieldDefs → no falla', () {
      final r =
          validateComposition(vc(title: const SlotComposition(fields: ['fantasma'])));
      expect(r.issues.where((i) => i.path.startsWith('slots.title.fields')), isEmpty);
    });

    test('field incompatible con accept kind → error', () {
      final r = validateComposition(
          vc(title: const SlotComposition(fields: ['avatar'])), withFields());
      expect(r.valid, false);
      expect(r.issues.any((i) => i.message.contains('no es compatible')), true);
    });

    test('single slot con múltiples fields → warn (no error)', () {
      final r = validateComposition(
          vc(title: const SlotComposition(fields: ['nombre', 'edad'])), withFields());
      expect(r.issues.any((i) => i.level == 'warn' && i.message.contains('single')),
          true);
    });
  });

  group('appearance', () {
    test('shape inválido → error', () {
      final r = validateComposition(vc(
          title: const SlotComposition(
              fields: ['nombre'], appearance: SlotAppearance(shape: 'fake'))));
      expect(r.valid, false);
      expect(
          r.issues.any(
              (i) => i.path == 'slots.title.appearance.shape' && i.level == 'error'),
          true);
    });

    test('aspect inválido → error', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'], appearance: SlotAppearance(aspect: 'fake'))))
              .valid,
          false);
    });

    test('align inválido → error', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'], appearance: SlotAppearance(align: 'fake'))))
              .valid,
          false);
    });

    test('weight inválido → error', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'], appearance: SlotAppearance(weight: 'fake'))))
              .valid,
          false);
    });

    test('size inválido → error', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'], appearance: SlotAppearance(size: 'fake'))))
              .valid,
          false);
    });

    test('truncateChars fuera de rango → error', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'],
                      appearance: SlotAppearance(truncateChars: 1000))))
              .valid,
          false);
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'], appearance: SlotAppearance(truncateChars: 0))))
              .valid,
          false);
    });

    test('truncateChars válido (1-500) → ok', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'], appearance: SlotAppearance(truncateChars: 80))))
              .valid,
          true);
    });

    test('accentPosition (appearance) inválido → error', () {
      expect(
          validateComposition(vc(
                  title: const SlotComposition(
                      fields: ['nombre'],
                      appearance: SlotAppearance(accentPosition: 'fake'))))
              .valid,
          false);
    });

    test('accentPosition top-level inválido → error', () {
      final r = validateComposition(vc(accentPosition: 'fake'));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.path == 'accentPosition' && i.level == 'error'),
          true);
    });
  });

  group('orientation', () {
    test('orientation inválida → error', () {
      expect(
          validateComposition(
                  vc(title: const SlotComposition(fields: ['nombre'], orientation: 'diagonal')))
              .valid,
          false);
    });

    test('orientation horizontal/vertical → ok', () {
      expect(
          validateComposition(
                  vc(title: const SlotComposition(fields: ['nombre'], orientation: 'vertical')))
              .valid,
          true);
    });
  });

  group('expand', () {
    test('expand.recipe inexistente → error', () {
      expect(
          validateComposition(
                  vc(expand: const NestedViewComposition(recipe: 'fake', slots: {})))
              .valid,
          false);
    });

    test('expand.recipe de kind=detail → error', () {
      final r = validateComposition(vc(
          expand: const NestedViewComposition(recipe: 'hero_protagonico', slots: {})));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.message.contains('no es de kind=expand')), true);
    });

    test('expand.recipe de kind=expand → ok', () {
      final r = validateComposition(vc(
          expand: const NestedViewComposition(recipe: 'accordion_simple', slots: {})));
      expect(
          r.issues
              .where((i) => i.path.startsWith('expand.recipe') && i.level == 'error'),
          isEmpty);
    });
  });

  group('targetRecipe', () {
    test('targetRecipe inexistente → error', () {
      expect(validateComposition(vc(targetRecipe: 'fake')).valid, false);
    });

    test('targetRecipe de kind=list → warn (no error)', () {
      final r = validateComposition(vc(targetRecipe: 'compact_avatar'));
      expect(r.issues.any((i) => i.path == 'targetRecipe' && i.level == 'warn'), true);
      expect(r.valid, true);
    });

    test('targetRecipe de kind=detail → ok', () {
      final r = validateComposition(vc(targetRecipe: 'hero_protagonico'));
      expect(r.issues.where((i) => i.path == 'targetRecipe'), isEmpty);
    });
  });

  group('slotOverrides', () {
    test('disabled con slot inexistente → warn', () {
      final r =
          validateComposition(vc(slotOverrides: const SlotOverrides(disabled: ['fantasma'])));
      expect(
          r.issues.any((i) =>
              i.level == 'warn' && i.path.startsWith('slotOverrides.disabled')),
          true);
      expect(r.valid, true);
    });

    test('custom slot shape válido → ok', () {
      final r = validateComposition(vc(
          slotOverrides: const SlotOverrides(custom: [
        CustomSlotDefinition(
            id: 'extra', label: 'Extra', kind: 'single', accepts: ['text-short']),
      ])));
      expect(r.issues.where((i) => i.path.startsWith('slotOverrides.custom')), isEmpty);
    });

    test('custom slot sin label → error', () {
      final r = validateComposition(vc(
          slotOverrides: const SlotOverrides(custom: [
        CustomSlotDefinition(id: 'x', label: '', kind: 'single', accepts: ['text-short']),
      ])));
      expect(r.valid, false);
    });

    test('custom slot con kind inválido → error', () {
      final r = validateComposition(vc(
          slotOverrides: const SlotOverrides(custom: [
        CustomSlotDefinition(id: 'x', label: 'X', kind: 'fake', accepts: ['text-short']),
      ])));
      expect(r.valid, false);
    });
  });

  group('linkField', () {
    test('linkField ausente → ok', () {
      final r = validateComposition(vc(), withFields());
      expect(r.issues.where((i) => i.path == 'linkField'), isEmpty);
    });

    test('linkField string vacío → error', () {
      final r = validateComposition(vc(linkField: '   '));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.path == 'linkField'), true);
    });

    test('linkField referencia field existente → ok', () {
      final r = validateComposition(vc(linkField: 'nombre'), withFields());
      expect(r.issues.where((i) => i.path == 'linkField'), isEmpty);
    });

    test('linkField referencia field inexistente → error', () {
      final r = validateComposition(vc(linkField: 'fantasma'), withFields());
      expect(r.valid, false);
      expect(
          r.issues.any((i) => i.path == 'linkField' && i.message.contains('fantasma')),
          true);
    });

    test('linkField inexistente SIN fieldDefs → no falla', () {
      final r = validateComposition(vc(linkField: 'fantasma'));
      expect(r.issues.where((i) => i.path == 'linkField'), isEmpty);
    });
  });

  group('nestedComposition (depth max=2)', () {
    test('nested válido (depth 2) → ok', () {
      final r = validateComposition(vc(
          title: const SlotComposition(fields: ['nombre'], nestedComposition: NestedViewComposition(
              recipe: 'compact_avatar',
              slots: {'title': SlotComposition(fields: ['otro'])}))));
      expect(
          r.issues.where(
              (i) => i.path.contains('nestedComposition') && i.level == 'error'),
          isEmpty);
    });

    test('nested con recipe vacío → error', () {
      final r = validateComposition(vc(
          title: const SlotComposition(
              fields: ['nombre'],
              nestedComposition: NestedViewComposition(recipe: '', slots: {}))));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.path.endsWith('nestedComposition.recipe')), true);
    });

    test('nested DENTRO de nested → error (depth > 2)', () {
      final r = validateComposition(vc(
          title: const SlotComposition(fields: ['nombre'], nestedComposition: NestedViewComposition(
              recipe: 'compact_avatar',
              slots: {
                'title': SlotComposition(fields: ['x'], nestedComposition: NestedViewComposition(recipe: 'compact_card', slots: {})),
              }))));
      expect(r.valid, false);
      expect(r.issues.any((i) => i.message.contains('profundidad máxima')), true);
    });

    test('nested.slots con field key vacío → error', () {
      final r = validateComposition(vc(
          title: const SlotComposition(fields: ['nombre'], nestedComposition: NestedViewComposition(
              recipe: 'compact_avatar',
              slots: {'title': SlotComposition(fields: ['  '])}))));
      expect(r.valid, false);
    });

    // NOTA: "nested.slots NO es objeto → error" (slots: null en TS) es
    // irrepresentable en Dart: `NestedViewComposition.slots` es
    // `Map<String, SlotComposition>` (no-null) y `fromJson` coacciona null→{}.
    // El parse lo previene antes del validador → garantía más fuerte.
  });

  group('semánticos', () {
    test('valid=true cuando solo hay warnings', () {
      final r = validateComposition(vc(
          slotOverrides: const SlotOverrides(disabled: ['fantasma']),
          targetRecipe: 'compact_avatar'));
      expect(r.issues, isNotEmpty);
      expect(r.issues.every((i) => i.level == 'warn'), true);
      expect(r.valid, true);
    });

    test('valid=false si hay AL MENOS un error', () {
      final r = validateComposition(vc(
          recipe: 'fake', slotOverrides: const SlotOverrides(disabled: ['fantasma'])));
      expect(r.valid, false);
    });

    test('cada issue incluye path + message + level', () {
      final r = validateComposition(vc(recipe: 'fake'));
      for (final i in r.issues) {
        expect(i.path, isNotEmpty);
        expect(i.message, isNotEmpty);
        expect(['error', 'warn'].contains(i.level), true);
      }
    });
  });
}
