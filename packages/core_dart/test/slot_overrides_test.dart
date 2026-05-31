/// Corpus de slots customizables (KRO-58 V5) — ESPEJO de
/// `packages/core/tests/slot-overrides.test.ts`.
///
/// Cubre `getEffectiveSlots` + `validateSlotOverrides` + `customSlotToSlotDefinition`.
/// Mismos inputs → mismos outputs/mensajes que el TS (paridad por construcción).
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

// Manifest sintético (igual que el TS, para no depender del catálogo real).
const baseManifest = RecipeManifest(
  id: 'compact_avatar',
  kind: 'list',
  displayName: 'Avatar compacto',
  description: 'test',
  slots: [
    SlotDefinition(id: 'avatar', label: 'Avatar', kind: 'single', accepts: ['image']),
    SlotDefinition(id: 'title', label: 'Título', kind: 'single', accepts: ['text-short']),
    SlotDefinition(id: 'subtitle', label: 'Subtítulo', kind: 'composable', accepts: ['text-short'], optional: true),
    SlotDefinition(id: 'meta', label: 'Meta', kind: 'single', accepts: ['text-short', 'badge'], optional: true),
  ],
);

const customSlot = CustomSlotDefinition(
  id: 'extra',
  label: 'Extra',
  kind: 'single',
  accepts: ['text-short'],
);

List<String> ids(List<SlotDefinition> slots) => slots.map((s) => s.id).toList();

void main() {
  group('getEffectiveSlots', () {
    test('manifest null → []', () {
      expect(getEffectiveSlots(null, null), isEmpty);
    });

    test('overrides null → manifest.slots tal cual (mismo orden)', () {
      final result = getEffectiveSlots(baseManifest, null);
      expect(ids(result), ['avatar', 'title', 'subtitle', 'meta']);
    });

    test('overrides vacío → manifest.slots tal cual', () {
      final result = getEffectiveSlots(baseManifest, const SlotOverrides());
      expect(ids(result), ['avatar', 'title', 'subtitle', 'meta']);
    });

    test('disabled excluye los slots base listados', () {
      final result = getEffectiveSlots(
          baseManifest, const SlotOverrides(disabled: ['subtitle', 'meta']));
      expect(ids(result), ['avatar', 'title']);
    });

    test('custom añade slots al final por defecto', () {
      final result = getEffectiveSlots(
          baseManifest, const SlotOverrides(custom: [customSlot]));
      expect(ids(result), ['avatar', 'title', 'subtitle', 'meta', 'extra']);
    });

    test('disabled + custom combinados', () {
      final result = getEffectiveSlots(baseManifest,
          const SlotOverrides(disabled: ['meta'], custom: [customSlot]));
      expect(ids(result), ['avatar', 'title', 'subtitle', 'extra']);
    });

    test('order reordena por el array proporcionado', () {
      final result = getEffectiveSlots(baseManifest,
          const SlotOverrides(order: ['title', 'meta', 'avatar', 'subtitle']));
      expect(ids(result), ['title', 'meta', 'avatar', 'subtitle']);
    });

    test('order parcial: ids listados primero, resto al final natural', () {
      final result = getEffectiveSlots(
          baseManifest, const SlotOverrides(order: ['meta', 'title']));
      expect(ids(result), ['meta', 'title', 'avatar', 'subtitle']);
    });

    test('order con ids inexistentes los ignora (no crashea)', () {
      final result = getEffectiveSlots(
          baseManifest, const SlotOverrides(order: ['ghost', 'title']));
      expect(ids(result), ['title', 'avatar', 'subtitle', 'meta']);
    });

    test('order con duplicados los deduplica', () {
      final result = getEffectiveSlots(baseManifest,
          const SlotOverrides(order: ['title', 'title', 'avatar']));
      expect(ids(result), ['title', 'avatar', 'subtitle', 'meta']);
    });

    test('combinación completa: disabled + custom + order', () {
      final result = getEffectiveSlots(
        baseManifest,
        const SlotOverrides(
          disabled: ['meta'],
          custom: [customSlot],
          order: ['extra', 'title'],
        ),
      );
      expect(ids(result), ['extra', 'title', 'avatar', 'subtitle']);
    });
  });

  group('validateSlotOverrides', () {
    test('overrides null → null (OK)', () {
      expect(validateSlotOverrides(baseManifest, null), isNull);
    });

    test('manifest null → null (no se valida)', () {
      expect(
        validateSlotOverrides(null, const SlotOverrides(disabled: ['x'])),
        isNull,
      );
    });

    test('disabled con id existente → null', () {
      expect(
        validateSlotOverrides(baseManifest, const SlotOverrides(disabled: ['title'])),
        isNull,
      );
    });

    test('disabled con id inexistente → error', () {
      final err = validateSlotOverrides(
          baseManifest, const SlotOverrides(disabled: ['ghost']));
      expect(err, matches(RegExp(r'ghost.*no existe')));
    });

    test('custom slot sin id → error', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: '', label: 'Bad', kind: 'single', accepts: ['text-short'])
        ]),
      );
      expect(err, matches(RegExp(r'sin id')));
    });

    test('custom slot con id mal formado → error', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: '1bad-id', label: 'Bad', kind: 'single', accepts: ['text-short'])
        ]),
      );
      expect(err, matches(RegExp(r'id inválido')));
    });

    test('custom slot colisiona con base → error', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: 'title', label: 'Bad', kind: 'single', accepts: ['text-short'])
        ]),
      );
      expect(err, matches(RegExp(r'colisiona')));
    });

    test('dos custom con mismo id → error duplicado', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: 'a', label: 'A', kind: 'single', accepts: ['text-short']),
          CustomSlotDefinition(id: 'a', label: 'A2', kind: 'single', accepts: ['text-short']),
        ]),
      );
      expect(err, matches(RegExp(r'duplicado')));
    });

    test('custom sin label → error', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: 'x', label: '', kind: 'single', accepts: ['text-short'])
        ]),
      );
      expect(err, matches(RegExp(r'sin label')));
    });

    test('custom kind inválido → error', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: 'x', label: 'X', kind: 'weird', accepts: ['text-short'])
        ]),
      );
      expect(err, matches(RegExp(r'kind inválido')));
    });

    test('custom sin accepts → error', () {
      final err = validateSlotOverrides(
        baseManifest,
        const SlotOverrides(custom: [
          CustomSlotDefinition(id: 'x', label: 'X', kind: 'single', accepts: [])
        ]),
      );
      expect(err, matches(RegExp(r'sin accepts')));
    });

    test('overrides completos válidos → null', () {
      expect(
        validateSlotOverrides(
          baseManifest,
          const SlotOverrides(
            disabled: ['meta'],
            custom: [customSlot],
            order: ['avatar', 'extra'],
          ),
        ),
        isNull,
      );
    });
  });

  group('customSlotToSlotDefinition', () {
    test('convierte sin pérdida', () {
      const c = CustomSlotDefinition(
        id: 'x',
        label: 'X',
        kind: 'composable',
        accepts: ['text-short', 'badge'],
        optional: true,
        description: 'test',
      );
      final s = customSlotToSlotDefinition(c);
      expect(s.id, 'x');
      expect(s.accepts, ['text-short', 'badge']);
      expect(s.kind, 'composable');
      expect(s.optional, isTrue);
    });
  });

  // Parseo desde JSON real (ejemplo del doc de types.ts). No hay corpus TS de
  // parsing (TS no parsea — usa interfaces), pero verificamos que fromJson lee
  // la forma real del AlbumSchema.
  group('ViewComposition.fromJson', () {
    test('parsea la forma persistida en el AlbumSchema', () {
      final vc = ViewComposition.fromJson(<String, dynamic>{
        'recipe': 'compact_avatar',
        'action': 'navigate_to_detail',
        'targetRecipe': 'hero_protagonico',
        'slots': {
          'avatar': {'fields': ['escudo']},
          'title': {'fields': ['nombre']},
          'subtitle': {
            'fields': ['ciudad', 'año'],
            'orientation': 'horizontal',
            'separator': ' · ',
          },
        },
        'slotOverrides': {
          'disabled': ['meta'],
        },
        'accentPosition': 'left',
      });

      expect(vc.recipe, 'compact_avatar');
      expect(vc.action, 'navigate_to_detail');
      expect(vc.targetRecipe, 'hero_protagonico');
      expect(vc.slots.keys, containsAll(['avatar', 'title', 'subtitle']));
      expect(vc.slots['title']!.fields, ['nombre']);
      expect(vc.slots['subtitle']!.fields, ['ciudad', 'año']);
      expect(vc.slots['subtitle']!.effectiveSeparator, ' · ');
      expect(vc.slots['avatar']!.effectiveOrientation, 'horizontal'); // default
      expect(vc.slotOverrides!.disabled, ['meta']);
      expect(vc.accentPosition, 'left');
    });

    test('sin orientation/separator → aplica defaults del SDK', () {
      final sc = SlotComposition.fromJson(<String, dynamic>{
        'fields': ['a', 'b'],
      });
      expect(sc.effectiveOrientation, 'horizontal');
      expect(sc.effectiveSeparator, ' · ');
    });
  });
}
