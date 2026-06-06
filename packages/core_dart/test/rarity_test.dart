/// Corpus de `rarity.dart` — ESPEJO de `tests/rarity.test.ts` (KRO-28).
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

const enumField = FieldDefLike(
    key: 'tier',
    label: 'Tier',
    type: 'select',
    behavior: 'ordinal_enum',
    options: ['rookie', 'pro', 'star', 'legend']);
const ratingField =
    FieldDefLike(key: 'valoracion', label: 'Valoración', type: 'number', behavior: 'rating');
const plainField = FieldDefLike(key: 'nombre', label: 'Nombre', type: 'text');

void main() {
  group('isFieldEligibleForRarity', () {
    test('rating/enum/ordinal_enum → true', () {
      expect(isFieldEligibleForRarity(const FieldDefLike(key: 'x', type: 'number', behavior: 'rating')), true);
      expect(isFieldEligibleForRarity(const FieldDefLike(key: 'x', type: 'select', behavior: 'enum')), true);
      expect(isFieldEligibleForRarity(const FieldDefLike(key: 'x', type: 'select', behavior: 'ordinal_enum')), true);
    });
    test('otros / sin behavior → false', () {
      expect(isFieldEligibleForRarity(const FieldDefLike(key: 'x', type: 'text', behavior: 'url')), false);
      expect(isFieldEligibleForRarity(const FieldDefLike(key: 'x', type: 'text')), false);
    });
  });

  group('validateRaritySource', () {
    test('null → válido sin issues', () {
      final r = validateRaritySource(null, [enumField]);
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });

    test('enum válido pesos 100 → válido', () {
      const rs = RaritySource(fieldKey: 'tier', buckets: [
        RarityBucket(value: 'rookie', weight: 60),
        RarityBucket(value: 'pro', weight: 25),
        RarityBucket(value: 'star', weight: 12),
        RarityBucket(value: 'legend', weight: 3),
      ]);
      final r = validateRaritySource(rs, [enumField]);
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });

    test('rating válido por rangos → válido', () {
      const rs = RaritySource(fieldKey: 'valoracion', buckets: [
        RarityBucket(range: [0, 1.5], weight: 50),
        RarityBucket(range: [2, 3.5], weight: 35),
        RarityBucket(range: [4, 5], weight: 15),
      ]);
      expect(validateRaritySource(rs, [ratingField]).valid, true);
    });

    test('field inexistente → error', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'noexiste', buckets: [RarityBucket(value: 'x', weight: 100)]),
          [enumField]);
      expect(r.valid, false);
      expect(r.issues.any((i) => i.path == 'raritySource.fieldKey' && i.level == 'error'), true);
    });

    test('field no elegible → error', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'nombre', buckets: [RarityBucket(value: 'x', weight: 100)]),
          [plainField]);
      expect(r.valid, false);
    });

    test('buckets vacíos → error', () {
      expect(validateRaritySource(const RaritySource(fieldKey: 'tier', buckets: []), [enumField]).valid, false);
    });

    test('value Y range → error', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'tier', buckets: [RarityBucket(value: 'rookie', range: [0, 1], weight: 100)]),
          [enumField]);
      expect(r.valid, false);
    });

    test('range min>max → error', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'valoracion', buckets: [RarityBucket(range: [5, 0], weight: 100)]),
          [ratingField]);
      expect(r.valid, false);
    });

    test('weight negativo → error', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'tier', buckets: [RarityBucket(value: 'rookie', weight: -5)]),
          [enumField]);
      expect(r.valid, false);
    });

    test('value fuera de options → warn (no invalida)', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'tier', buckets: [RarityBucket(value: 'mythic', weight: 100)]),
          [enumField]);
      expect(r.valid, true);
      expect(r.issues.any((i) => i.level == 'warn'), true);
    });

    test('pesos no suman 100 → warn (normalizable)', () {
      final r = validateRaritySource(
          const RaritySource(fieldKey: 'tier', buckets: [
            RarityBucket(value: 'rookie', weight: 30),
            RarityBucket(value: 'pro', weight: 30),
          ]),
          [enumField]);
      expect(r.valid, true);
      expect(r.issues.any((i) => i.message.contains('normaliz')), true);
    });
  });

  group('rarityBucketForValue', () {
    const enumBuckets = [RarityBucket(value: 'rookie', weight: 60), RarityBucket(value: 'legend', weight: 3)];
    const rangeBuckets = [RarityBucket(range: [0, 1.5], weight: 50), RarityBucket(range: [4, 5], weight: 15)];

    test('match por valor (enum)', () {
      expect(rarityBucketForValue('legend', enumBuckets)?.weight, 3);
    });
    test('match por rango (rating)', () {
      expect(rarityBucketForValue(4.5, rangeBuckets)?.weight, 15);
      expect(rarityBucketForValue(1, rangeBuckets)?.weight, 50);
    });
    test('sin match → null', () {
      expect(rarityBucketForValue('mythic', enumBuckets), isNull);
      expect(rarityBucketForValue(3, rangeBuckets), isNull);
    });
  });

  group('normalizeRarityWeights', () {
    test('escala a 100 preservando proporciones', () {
      final out = normalizeRarityWeights(const [RarityBucket(value: 'a', weight: 30), RarityBucket(value: 'b', weight: 30)]);
      expect(out.map((b) => b.weight).toList(), [50, 50]);
    });
    test('todos 0 → reparto equitativo', () {
      final out = normalizeRarityWeights(
          const [RarityBucket(value: 'a', weight: 0), RarityBucket(value: 'b', weight: 0), RarityBucket(value: 'c', weight: 0)]);
      for (final b in out) {
        expect(b.weight, closeTo(100 / 3, 1e-9));
      }
    });
    test('vacío → vacío', () {
      expect(normalizeRarityWeights(const []), isEmpty);
    });
  });
}
