/// Corpus de `resolveTargetChain` — ESPEJO 1:1 de la parte resolveTargetChain de
/// `tests/target-chain.test.ts` (KRO-94 Fase B). Construye vía fromJson para
/// validar también el parse de `targetComposition`.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

ViewComposition listVC([Map<String, dynamic> extra = const {}]) =>
    ViewComposition.fromJson(<String, dynamic>{
      'recipe': 'compact_avatar',
      'action': 'navigate_to_detail',
      'slots': <String, dynamic>{},
      ...extra,
    });

/// Cadena anidada de `depth` saltos: los intermedios navegan, el último termina.
Map<String, dynamic> buildChain(int depth) {
  Map<String, dynamic> node = {'recipe': 'hero_protagonico', 'action': 'none'};
  for (var i = 1; i < depth; i++) {
    node = {
      'recipe': 'hero_protagonico',
      'action': 'navigate_to_detail',
      'targetComposition': node,
    };
  }
  return node;
}

void main() {
  group('resolveTargetChain', () {
    test('action none → cadena vacía (pantalla terminal)', () {
      expect(resolveTargetChain(listVC({'action': 'none'})), isEmpty);
      expect(resolveTargetChain(null), isEmpty);
    });

    test('legacy navigate_to_detail → 1 hop con el targetRecipe', () {
      final chain = resolveTargetChain(
          listVC({'action': 'navigate_to_detail', 'targetRecipe': 'editorial'}));
      expect(chain.length, 1);
      expect(chain[0].leadingAction, 'navigate_to_detail');
      expect(chain[0].recipe, 'editorial');
    });

    test('legacy modal sin targetRecipe → reusa la receta de la lista', () {
      final chain = resolveTargetChain(listVC({'action': 'modal'}));
      expect(chain[0].leadingAction, 'modal');
      expect(chain[0].recipe, 'compact_avatar');
    });

    test('legacy expand_inline → recipe del expand', () {
      final chain = resolveTargetChain(listVC({
        'action': 'expand_inline',
        'expand': {'recipe': 'accordion_simple', 'slots': <String, dynamic>{}},
      }));
      expect(chain[0].leadingAction, 'expand_inline');
      expect(chain[0].recipe, 'accordion_simple');
    });

    test('legacy external_link → linkField, sin receta', () {
      final chain =
          resolveTargetChain(listVC({'action': 'external_link', 'linkField': 'web'}));
      expect(chain[0].leadingAction, 'external_link');
      expect(chain[0].linkField, 'web');
      expect(chain[0].recipe, isNull);
    });

    test('multi-hop targetComposition → saltos en orden con su leadingAction', () {
      final vc = listVC({
        'action': 'navigate_to_detail',
        'targetComposition': {
          'recipe': 'hero_protagonico',
          'action': 'modal',
          'targetComposition': {'recipe': 'editorial', 'action': 'none'},
        },
      });
      final chain = resolveTargetChain(vc);
      expect(chain.length, 2);
      expect(chain[0].leadingAction, 'navigate_to_detail');
      expect(chain[0].recipe, 'hero_protagonico');
      expect(chain[1].leadingAction, 'modal');
      expect(chain[1].recipe, 'editorial');
    });

    test('targetComposition gana sobre targetRecipe (additive)', () {
      final vc = listVC({
        'action': 'navigate_to_detail',
        'targetRecipe': 'momento',
        'targetComposition': {'recipe': 'editorial', 'action': 'none'},
      });
      final chain = resolveTargetChain(vc);
      expect(chain.length, 1);
      expect(chain[0].recipe, 'editorial');
    });

    test('corta defensivamente en MAX_TARGET_DEPTH+1 ante cadenas absurdas', () {
      final vc =
          listVC({'action': 'navigate_to_detail', 'targetComposition': buildChain(8)});
      expect(resolveTargetChain(vc).length, lessThanOrEqualTo(kMaxTargetDepth + 1));
    });

    test('targetChainDepth refleja el nº de saltos', () {
      expect(targetChainDepth(listVC({'action': 'none'})), 0);
      expect(
          targetChainDepth(
              listVC({'action': 'navigate_to_detail', 'targetRecipe': 'editorial'})),
          1);
    });
  });
}
