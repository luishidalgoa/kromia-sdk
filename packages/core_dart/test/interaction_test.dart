/// Corpus de `interaction.dart` — ESPEJO 1:1 de `tests/interaction.test.ts`
/// (KRO-74). Construye las composiciones vía `fromJson` para validar también el
/// parse. Cubre resolveTapAction / resolveDetailComposition / resolveTargetRecipe
/// / resolveExpandRecipe / isTappable / opensNewScreen.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

ViewComposition base([Map<String, dynamic> over = const {}]) =>
    ViewComposition.fromJson(<String, dynamic>{
      'recipe': 'compact_avatar',
      'action': 'none',
      'slots': <String, dynamic>{},
      ...over,
    });

final fields = <FieldDefLike>[
  const FieldDefLike(key: 'foto', label: 'Foto', type: 'image', behavior: 'avatar'),
  const FieldDefLike(key: 'nombre', label: 'Nombre', type: 'text'),
  const FieldDefLike(key: 'desc', label: 'Desc', type: 'textarea'),
  const FieldDefLike(key: 'web', label: 'Web', type: 'text', behavior: 'url'),
];

void main() {
  group('resolveTapAction', () {
    test('none → TapNone', () {
      expect(resolveTapAction(base(), const {}), isA<TapNone>());
    });

    test('navigate_to_detail → TapNavigate con detailComposition', () {
      final r = resolveTapAction(
        base({'action': 'navigate_to_detail', 'targetRecipe': 'editorial'}),
        const {},
        ResolveTapOptions(fieldDefs: fields),
      );
      expect(r, isA<TapNavigate>());
      expect((r as TapNavigate).detailComposition.recipe, 'editorial');
    });

    test('modal → TapModal', () {
      final r = resolveTapAction(
          base({'action': 'modal'}), const {}, ResolveTapOptions(fieldDefs: fields));
      expect(r, isA<TapModal>());
    });

    test('expand_inline → TapExpand con recipe + slots', () {
      final r = resolveTapAction(
        base({
          'action': 'expand_inline',
          'expand': {
            'recipe': 'accordion_simple',
            'slots': {
              'body': {'fields': ['desc']},
            },
          },
        }),
        const {},
      );
      expect(r, isA<TapExpand>());
      final e = r as TapExpand;
      expect(e.expandRecipe, 'accordion_simple');
      expect(e.expandSlots['body']!.fields, ['desc']);
    });

    test('expand_inline sin expand → TapNone', () {
      expect(resolveTapAction(base({'action': 'expand_inline'}), const {}),
          isA<TapNone>());
    });

    test('external_link → TapExternal con url del item', () {
      final r = resolveTapAction(
        base({'action': 'external_link', 'linkField': 'web'}),
        const {'web': 'https://ejemplo.com'},
      );
      expect((r as TapExternal).url, 'https://ejemplo.com');
    });

    test('external_link field vacío → url vacía', () {
      final r = resolveTapAction(
          base({'action': 'external_link', 'linkField': 'web'}), const {'web': ''});
      expect((r as TapExternal).url, '');
    });

    test('external_link sin linkField → url vacía', () {
      final r =
          resolveTapAction(base({'action': 'external_link'}), const {'web': 'x'});
      expect((r as TapExternal).url, '');
    });
  });

  group('resolveDetailComposition', () {
    test('targetComposition tiene prioridad sobre targetRecipe', () {
      final vc = base({
        'action': 'navigate_to_detail',
        'targetRecipe': 'editorial',
        'targetComposition': {'recipe': 'momento', 'action': 'none'},
      });
      expect(resolveDetailComposition(vc, fields).recipe, 'momento');
    });

    test('targetComposition sin slots → rellena con auto-slots', () {
      final vc = base({
        'action': 'navigate_to_detail',
        'targetComposition': {'recipe': 'hero_protagonico', 'action': 'none'},
      });
      final detail = resolveDetailComposition(vc, fields);
      expect(detail.recipe, 'hero_protagonico');
      expect(detail.slots['avatar']!.fields, contains('foto'));
      expect(detail.slots['title']!.fields, contains('nombre'));
    });

    test('targetComposition preserva el siguiente salto', () {
      final vc = base({
        'action': 'navigate_to_detail',
        'targetComposition': {
          'recipe': 'hero_protagonico',
          'action': 'modal',
          'targetComposition': {'recipe': 'editorial', 'action': 'none'},
        },
      });
      final detail = resolveDetailComposition(vc);
      expect(detail.action, 'modal');
      expect(detail.targetComposition?.recipe, 'editorial');
    });

    test('legacy targetRecipe → esa receta con auto-slots', () {
      final vc =
          base({'action': 'navigate_to_detail', 'targetRecipe': 'editorial'});
      expect(resolveDetailComposition(vc, fields).recipe, 'editorial');
    });

    test('sin target → fallback auto hero_protagonico', () {
      expect(
          resolveDetailComposition(base({'action': 'navigate_to_detail'}), fields)
              .recipe,
          'hero_protagonico');
    });

    test('targetRecipe inválida (list recipe) → fallback auto', () {
      final vc =
          base({'action': 'navigate_to_detail', 'targetRecipe': 'compact_avatar'});
      expect(resolveDetailComposition(vc, fields).recipe, 'hero_protagonico');
    });
  });

  group('resolveTargetRecipe', () {
    test('galería → momento', () {
      expect(
          resolveTargetRecipe(
              [const FieldDefLike(key: 'g', label: 'G', type: 'array<image>')]),
          'momento');
    });
    test('imagen → hero_protagonico', () {
      expect(
          resolveTargetRecipe(
              [const FieldDefLike(key: 'f', label: 'F', type: 'image')]),
          'hero_protagonico');
    });
    test('behavior avatar → hero_protagonico', () {
      expect(
          resolveTargetRecipe([
            const FieldDefLike(key: 'a', label: 'A', type: 'text', behavior: 'avatar')
          ]),
          'hero_protagonico');
    });
    test('sin imagen → editorial', () {
      expect(
          resolveTargetRecipe(
              [const FieldDefLike(key: 'n', label: 'N', type: 'text')]),
          'editorial');
    });
  });

  group('resolveExpandRecipe', () {
    test('field url → accordion_with_actions', () {
      expect(
          resolveExpandRecipe([
            const FieldDefLike(key: 'w', label: 'W', type: 'text', behavior: 'url')
          ]),
          'accordion_with_actions');
    });
    test('sin enlazable → accordion_simple', () {
      expect(
          resolveExpandRecipe(
              [const FieldDefLike(key: 't', label: 'T', type: 'textarea')]),
          'accordion_simple');
    });
  });

  group('isTappable / opensNewScreen', () {
    test('none → no tappable', () {
      expect(isTappable(base()), false);
    });
    test('navigate_to_detail → tappable + opens new screen', () {
      final vc = base({'action': 'navigate_to_detail'});
      expect(isTappable(vc), true);
      expect(opensNewScreen(vc), true);
    });
    test('modal → tappable + opens new screen', () {
      final vc = base({'action': 'modal'});
      expect(isTappable(vc), true);
      expect(opensNewScreen(vc), true);
    });
    test('expand_inline → tappable pero NO opens new screen', () {
      final vc = base({'action': 'expand_inline'});
      expect(isTappable(vc), true);
      expect(opensNewScreen(vc), false);
    });
    test('external_link → tappable pero NO opens new screen', () {
      final vc = base({'action': 'external_link'});
      expect(isTappable(vc), true);
      expect(opensNewScreen(vc), false);
    });
  });
}
