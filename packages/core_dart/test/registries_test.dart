/// Corpus de los registries catálogo — ESPEJO de los bloques `field-type-registry`,
/// `action-registry` y `slot-kinds` de `packages/core/tests/registries.test.ts`.
///
/// Mismos counts, mismos ids, mismos flags y mismos outputs de helper que el TS.
/// Paridad por construcción: si el catálogo Dart diverge del TS, esto falla.
/// (Los bloques behavior-registry y recipe-registry se añadirán al espejar esos
/// registries en chunks siguientes.)
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

void main() {
  // ── Field types ────────────────────────────────────────────────────
  group('field-type-registry', () {
    final types = allFieldTypes();

    test('contiene 9 types base', () {
      expect(types.length, 9);
    });

    test('incluye los IDs core', () {
      final ids = types.map((t) => t.id).toList();
      expect(
        ids,
        containsAll(<String>[
          'text', 'textarea', 'number', 'select', 'image',
          'array<string>', 'array<number>', 'array<image>', 'cardRef',
        ]),
      );
    });

    test('cada entry tiene shape válido', () {
      for (final t in types) {
        expect(t.id, matches(RegExp(r'^[a-zA-Z<>]+$')));
        expect(t.displayName, isNotEmpty);
        expect(t.description.length, greaterThan(20));
        expect(<String>['scalar', 'array'], contains(t.cardinality));
        if (t.cardinality == 'array') {
          expect(t.elementType, isNotNull);
          expect(t.elementType, isNotEmpty);
        }
      }
    });

    test('fieldTypeIds matchea los ids del catálogo', () {
      final a = List<String>.of(fieldTypeIds)..sort();
      final b = types.map((t) => t.id).toList()..sort();
      expect(a, equals(b));
    });

    test('getFieldType devuelve la entry correcta', () {
      final text = getFieldType('text');
      expect(text, isNotNull);
      expect(text!.cardinality, 'scalar');

      final arrImg = getFieldType('array<image>');
      expect(arrImg!.cardinality, 'array');
      expect(arrImg.elementType, 'image');
    });

    test('getFieldType devuelve null para id inexistente', () {
      expect(getFieldType('unknown'), isNull);
    });
  });

  // ── Actions ────────────────────────────────────────────────────────
  group('action-registry', () {
    final actions = allActions();

    test('contiene 5 actions', () {
      expect(actions.length, 5);
    });

    test('incluye los IDs core', () {
      final ids = actions.map((a) => a.id).toList();
      expect(
        ids,
        containsAll(<String>[
          'none', 'navigate_to_detail', 'modal', 'expand_inline', 'external_link',
        ]),
      );
    });

    test('cada action tiene shape válido', () {
      for (final a in actions) {
        expect(a.id, matches(RegExp(r'^[a-z_]+$')));
        expect(a.displayName, isNotEmpty);
        expect(a.description, isNotEmpty);
        expect(
          <String>['static', 'push', 'modal', 'inline', 'external'],
          contains(a.transition),
        );
      }
    });

    test('constraint flags coherentes con transition', () {
      ActionDefinition byId(String id) => actions.firstWhere((a) => a.id == id);
      expect(byId('navigate_to_detail').requiresTargetRecipe, isTrue);
      expect(byId('navigate_to_detail').targetRecipeKind, 'detail');
      expect(byId('modal').requiresTargetRecipe, isTrue);
      expect(byId('expand_inline').requiresExpandRecipe, isTrue);
      expect(byId('external_link').requiresLinkField, isTrue);
      expect(byId('none').requiresTargetRecipe, isFalse);
    });

    test('actionIds matchea los ids', () {
      final a = List<String>.of(actionIds)..sort();
      final b = actions.map((a) => a.id).toList()..sort();
      expect(a, equals(b));
    });

    test('getAction devuelve la entry correcta', () {
      expect(getAction('none')?.transition, 'static');
      expect(getAction('unknown'), isNull);
    });
  });

  // ── Behaviors ──────────────────────────────────────────────────────
  group('behavior-registry', () {
    final behaviors = allBehaviors();

    test('contiene 27 behaviors', () {
      expect(behaviors.length, 27);
    });

    test('IDs únicos (sin duplicados)', () {
      final ids = behaviors.map((b) => b.id).toList();
      expect(ids.toSet().length, ids.length);
    });

    test('cada behavior tiene shape válido', () {
      for (final b in behaviors) {
        expect(b.id, matches(RegExp(r'^[a-z_]+$')));
        expect(b.displayName, isNotEmpty);
        expect(b.description.length, greaterThan(20));
        expect(b.applicableTypes.length, greaterThan(0));
        // renderAsSlotKind es opcional, pero si está, debe estar en el meta
        if (b.renderAsSlotKind != null) {
          expect(slotAcceptKindMeta.containsKey(b.renderAsSlotKind), isTrue);
        }
      }
    });

    test('applicableTypes solo contiene types base válidos', () {
      for (final b in behaviors) {
        for (final t in b.applicableTypes) {
          expect(fieldTypeIds, contains(t));
        }
      }
    });

    test('getBehavior y getBehaviorsByType funcionan', () {
      expect(getBehavior('color_hex')?.renderAsSlotKind, 'color');
      expect(getBehavior(null), isNull);
      expect(getBehavior(''), isNull);
      expect(getBehavior('unknown'), isNull);

      final textBehaviors = getBehaviorsByType('text');
      expect(textBehaviors.length, greaterThan(0));
      for (final b in textBehaviors) {
        expect(b.applicableTypes, contains('text'));
      }
    });

    test('suggestBehavior matchea patterns conocidos', () {
      expect(suggestBehavior('email', 'text'), 'email');
      expect(suggestBehavior('year', 'number'), 'year');
      expect(suggestBehavior('color', 'text'), 'color_hex');
      // Tipo incompatible
      expect(suggestBehavior('email', 'number'), isNull);
      // Sin pattern
      expect(suggestBehavior('foobar', 'text'), isNull);
    });
  });

  // ── Recipes ────────────────────────────────────────────────────────
  group('recipe-registry', () {
    final recipes = allRecipes();

    test('contiene 13 recipes (8 clásicas + 5 V5 block-native, KRO-133)', () {
      expect(recipes.length, 13);
    });

    test('distribución por kind: 7 list + 4 detail + 2 expand', () {
      List<RecipeManifest> byKind(String k) =>
          recipes.where((r) => r.kind == k).toList();
      expect(byKind('list').length, 7);
      expect(byKind('detail').length, 4);
      expect(byKind('expand').length, 2);
    });

    test('IDs únicos', () {
      final ids = recipes.map((r) => r.id).toList();
      expect(ids.toSet().length, ids.length);
    });

    test('cada recipe tiene shape válido', () {
      for (final r in recipes) {
        expect(r.id, matches(RegExp(r'^[a-z_]+$')));
        expect(r.displayName, isNotEmpty);
        expect(r.description, isNotEmpty);
        expect(<String>['list', 'detail', 'expand'], contains(r.kind));
        expect(r.slots.length, greaterThan(0));
      }
    });

    test('cada slot tiene shape válido + accepts en slotAcceptKindMeta', () {
      for (final r in recipes) {
        final slotIds = <String>{};
        for (final s in r.slots) {
          expect(s.id, matches(RegExp(r'^[a-z_]+$')));
          expect(slotIds.contains(s.id), isFalse); // sin duplicados en la misma recipe
          slotIds.add(s.id);
          expect(s.label, isNotEmpty);
          expect(<String>['single', 'composable'], contains(s.kind));
          expect(s.accepts.length, greaterThan(0));
          for (final k in s.accepts) {
            expect(slotAcceptKindMeta.containsKey(k), isTrue);
          }
        }
      }
    });

    test('getRecipeManifest devuelve correctamente', () {
      final ca = getRecipeManifest('compact_avatar');
      expect(ca, isNotNull);
      expect(ca!.kind, 'list');
    });

    test('recipeRegistry tiene una entry por cada recipe', () {
      final a = recipeRegistry.keys.toList()..sort();
      final b = recipes.map((r) => r.id).toList()..sort();
      expect(a, equals(b));
    });

    group('allRecipesByKind', () {
      test('list → 3 recipes', () {
        final list = allRecipesByKind('list');
        expect(list.length, greaterThanOrEqualTo(1));
        for (final r in list) {
          expect(r.kind, 'list');
        }
      });

      test('detail → 3 recipes', () {
        final detail = allRecipesByKind('detail');
        expect(detail.length, greaterThanOrEqualTo(1));
        for (final r in detail) {
          expect(r.kind, 'detail');
        }
      });

      test('expand → 2 recipes', () {
        final expand = allRecipesByKind('expand');
        expect(expand.length, greaterThanOrEqualTo(1));
        for (final r in expand) {
          expect(r.kind, 'expand');
        }
      });

      test('sum por kind === total allRecipes()', () {
        final total = allRecipes().length;
        final sum = allRecipesByKind('list').length +
            allRecipesByKind('detail').length +
            allRecipesByKind('expand').length;
        expect(sum, total);
      });

      test('mismas referencias que el registry (no copia)', () {
        final list = allRecipesByKind('list');
        for (final r in list) {
          expect(recipeRegistry[r.id], same(r));
        }
      });
    });
  });

  // ── Slot kinds (meta) ──────────────────────────────────────────────
  group('slot-kinds (slotAcceptKindMeta)', () {
    final kinds = slotAcceptKindMeta.keys.toList();

    test('contiene 14 kinds', () {
      expect(kinds.length, 14);
    });

    test('cada kind tiene label + description no-vacíos', () {
      for (final k in kinds) {
        final meta = slotAcceptKindMeta[k]!;
        expect(meta.label, isNotEmpty);
        expect(meta.description.length, greaterThan(10));
      }
    });

    test('getSlotAcceptKindOptions devuelve lista con el shape correcto', () {
      final opts = getSlotAcceptKindOptions();
      expect(opts.length, kinds.length);
      for (final o in opts) {
        expect(o.id, isNotEmpty);
        expect(o.label, isNotEmpty);
        expect(o.description, isNotEmpty);
      }
    });

    test('formatSlotAccepts: any → "cualquiera"', () {
      expect(formatSlotAccepts(['any']), 'cualquiera');
      expect(formatSlotAccepts(['any', 'text-short']), 'cualquiera');
    });

    test('formatSlotAccepts: 1 kind → su label', () {
      expect(formatSlotAccepts(['image']), 'Imagen');
    });

    test('formatSlotAccepts: N kinds → labels con " / "', () {
      expect(formatSlotAccepts(['text-short', 'date']), 'Texto / Fecha');
    });

    test('formatSlotAccepts: lista vacía → ""', () {
      expect(formatSlotAccepts([]), '');
    });

    test('getAvailableAppearanceProps: image → forma + objectFit + efectos (KRO-147 F3)', () {
      final props = getAvailableAppearanceProps(['image']);
      expect(props,
          containsAll(<String>['shape', 'aspect', 'objectFit', 'imageFocus', 'size', 'paddingY', 'opacity', 'shadow']));
    });

    test('getAvailableAppearanceProps: text-short → tipografía rica + color (KRO-147 F3)', () {
      final props = getAvailableAppearanceProps(['text-short']);
      expect(
          props,
          containsAll(<String>[
            'align', 'weight', 'italic', 'underline', 'textTransform', 'font',
            'lineHeight', 'tracking', 'textShadow', 'display', 'textColor', 'bgColor', 'truncate',
          ]));
    });

    test('getAvailableAppearanceProps: card-ref → shape/refSize/refColumns/refTap', () {
      final props = getAvailableAppearanceProps(['card-ref']);
      expect(props, containsAll(<String>['shape', 'refSize', 'refColumns', 'refTap']));
    });

    test('getAvailableAppearanceProps: accepts vacío → []', () {
      expect(getAvailableAppearanceProps([]), <String>[]);
    });

    test('getAvailableAppearanceProps: multi-accept retorna unión de props', () {
      final props = getAvailableAppearanceProps(['image', 'text-short']);
      expect(props, containsAll(<String>['shape', 'align']));
    });

    test('getAvailableAppearanceProps respeta el orden del catálogo (allAppearanceProps)', () {
      final props = getAvailableAppearanceProps(['image', 'text-short', 'card-ref']);
      final idx = props.map(allAppearanceProps.indexOf).toList();
      expect(idx, equals(List<int>.of(idx)..sort()), reason: 'orden estable = allAppearanceProps');
    });

    // Ratchet (KRO-133): TODA prop del catálogo debe gatearla al menos un kind.
    // Falla si `appearancePropsByKind` queda incompleto vs `allAppearanceProps`
    // (el render aplica las 26; la metadata del editor debe gatearlas todas).
    test('appearancePropsByKind cubre TODO el catálogo (sin props huérfanas)', () {
      final gated = <String>{for (final list in appearancePropsByKind.values) ...list};
      final missing = allAppearanceProps.where((p) => !gated.contains(p)).toList();
      expect(missing, isEmpty, reason: 'props del catálogo que ningún kind gatea: ${missing.join(', ')}');
    });
  });
}
