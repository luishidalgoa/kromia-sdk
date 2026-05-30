/// Corpus canonico de `classifyField` — ESPEJO 1:1 de
/// `packages/core/tests/classify.test.ts`.
///
/// Mismos inputs → mismos outputs que el TS. Esta es la garantia de paridad
/// cross-language POR CONSTRUCCION: si el Dart diverge del TS en cualquier
/// caso, este test falla. Al añadir un caso al corpus TS, añadelo aqui igual.
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

class CorpusEntry {
  final String desc;
  final FieldSpec field;
  final List<String> expectedKinds;
  const CorpusEntry(this.desc, this.field, this.expectedKinds);
}

final List<CorpusEntry> corpus = <CorpusEntry>[
  // ── type=image ────────────────────────────────────────────────────
  CorpusEntry('image sin behavior -> image + 3 legacy aliases',
      const FieldSpec('image'),
      const ['any', 'image', 'image-avatar', 'image-banner', 'image-cover']),

  // ── type=array<image> ─────────────────────────────────────────────
  CorpusEntry('array<image> sin behavior -> image-array',
      const FieldSpec('array<image>'), const ['any', 'image-array']),
  CorpusEntry('array<image> con behavior=gallery -> image-array',
      const FieldSpec('array<image>', behavior: 'gallery'), const ['any', 'image-array']),
  CorpusEntry('array<image> con behavior=slideshow -> image-array',
      const FieldSpec('array<image>', behavior: 'slideshow'), const ['any', 'image-array']),
  CorpusEntry('array<image> con behavior=card_multiview -> image-array',
      const FieldSpec('array<image>', behavior: 'card_multiview'), const ['any', 'image-array']),

  // ── type=number ───────────────────────────────────────────────────
  CorpusEntry('number sin behavior -> number + text-short',
      const FieldSpec('number'), const ['any', 'number', 'text-short']),
  CorpusEntry('number con behavior=year -> date + number + text-short',
      const FieldSpec('number', behavior: 'year'), const ['any', 'date', 'number', 'text-short']),
  CorpusEntry('number con behavior=rating -> badge + number + text-short',
      const FieldSpec('number', behavior: 'rating'), const ['any', 'badge', 'number', 'text-short']),
  CorpusEntry('number con behavior=currency -> solo number + text-short',
      const FieldSpec('number', behavior: 'currency'), const ['any', 'number', 'text-short']),
  CorpusEntry('number con behavior=percentage -> solo number + text-short',
      const FieldSpec('number', behavior: 'percentage'), const ['any', 'number', 'text-short']),

  // ── type=text ─────────────────────────────────────────────────────
  CorpusEntry('text sin behavior -> text-short',
      const FieldSpec('text'), const ['any', 'text-short']),
  CorpusEntry('text con behavior=url -> url + text-short',
      const FieldSpec('text', behavior: 'url'), const ['any', 'url', 'text-short']),
  CorpusEntry('text con behavior=email -> url + text-short',
      const FieldSpec('text', behavior: 'email'), const ['any', 'url', 'text-short']),
  CorpusEntry('text con behavior=phone -> url + text-short',
      const FieldSpec('text', behavior: 'phone'), const ['any', 'url', 'text-short']),
  CorpusEntry('text con behavior=iso_date -> date + text-short',
      const FieldSpec('text', behavior: 'iso_date'), const ['any', 'date', 'text-short']),
  CorpusEntry('text con behavior=color_hex -> color (NO text-short, KRO-69)',
      const FieldSpec('text', behavior: 'color_hex'), const ['any', 'color']),
  CorpusEntry('text con behavior=ordinal_enum -> badge + text-short',
      const FieldSpec('text', behavior: 'ordinal_enum'), const ['any', 'badge', 'text-short']),
  CorpusEntry('text con behavior=slug -> solo text-short',
      const FieldSpec('text', behavior: 'slug'), const ['any', 'text-short']),

  // ── type=textarea ─────────────────────────────────────────────────
  CorpusEntry('textarea sin behavior -> text-long',
      const FieldSpec('textarea'), const ['any', 'text-long']),
  CorpusEntry('textarea con behavior=markdown -> text-long',
      const FieldSpec('textarea', behavior: 'markdown'), const ['any', 'text-long']),
  CorpusEntry('textarea con behavior=notes -> text-long',
      const FieldSpec('textarea', behavior: 'notes'), const ['any', 'text-long']),
  CorpusEntry('textarea con behavior=html -> text-long',
      const FieldSpec('textarea', behavior: 'html'), const ['any', 'text-long']),
  CorpusEntry('textarea con behavior=code -> solo text-long',
      const FieldSpec('textarea', behavior: 'code'), const ['any', 'text-long']),

  // ── type=select ───────────────────────────────────────────────────
  CorpusEntry('select sin behavior -> text-short',
      const FieldSpec('select'), const ['any', 'text-short']),
  CorpusEntry('select con behavior=ordinal_enum -> badge + text-short',
      const FieldSpec('select', behavior: 'ordinal_enum'), const ['any', 'badge', 'text-short']),

  // ── type=array<string> ────────────────────────────────────────────
  CorpusEntry('array<string> con behavior=enum -> badge',
      const FieldSpec('array<string>', behavior: 'enum'), const ['any', 'badge']),
  CorpusEntry('array<string> con behavior=card_code_list -> card-ref',
      const FieldSpec('array<string>', behavior: 'card_code_list'), const ['any', 'card-ref']),
  CorpusEntry('array<string> con behavior=tags -> solo any',
      const FieldSpec('array<string>', behavior: 'tags'), const ['any']),

  // ── type=array<number> ────────────────────────────────────────────
  CorpusEntry('array<number> con behavior=card_index_list -> card-ref',
      const FieldSpec('array<number>', behavior: 'card_index_list'), const ['any', 'card-ref']),
  CorpusEntry('array<number> con behavior=year_list -> date',
      const FieldSpec('array<number>', behavior: 'year_list'), const ['any', 'date']),

  // ── Edge cases ────────────────────────────────────────────────────
  CorpusEntry('type desconocido -> solo any',
      const FieldSpec('unknown_future_type'), const ['any']),
  CorpusEntry('behavior desconocido sobre text -> text-short (fallback al type)',
      const FieldSpec('text', behavior: 'mystery_behavior'), const ['any', 'text-short']),
];

void main() {
  group('classifyField — corpus canonico (cross-language ground truth)', () {
    for (final entry in corpus) {
      test(entry.desc, () {
        final result = classifyField(entry.field)..sort();
        final expected = [...entry.expectedKinds]..sort();
        expect(result, equals(expected));
      });
    }

    test('siempre incluye "any"', () {
      for (final entry in corpus) {
        expect(classifyField(entry.field), contains('any'));
      }
    });

    test('no devuelve duplicados', () {
      for (final entry in corpus) {
        final kinds = classifyField(entry.field);
        expect(kinds.toSet().length, equals(kinds.length));
      }
    });
  });

  group('isFieldCompatibleWithSlot', () {
    SlotSpec mkSlot(List<String> accepts) => SlotSpec(accepts);

    test('slot any-accepts admite cualquier field', () {
      final slot = mkSlot(['any']);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('image'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('unknown'), slot), isTrue);
    });

    test('slot image admite type=image', () {
      final slot = mkSlot(['image']);
      expect(isFieldCompatibleWithSlot(const FieldSpec('image'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text'), slot), isFalse);
    });

    test('slot text-short NO admite color_hex (KRO-69 exception)', () {
      final slot = mkSlot(['text-short']);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text', behavior: 'color_hex'), slot), isFalse);
    });

    test('slot text-short admite number', () {
      final slot = mkSlot(['text-short']);
      expect(isFieldCompatibleWithSlot(const FieldSpec('number'), slot), isTrue);
    });

    test('slot color SOLO admite behavior=color_hex', () {
      final slot = mkSlot(['color']);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text', behavior: 'color_hex'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text'), slot), isFalse);
      expect(isFieldCompatibleWithSlot(const FieldSpec('image'), slot), isFalse);
    });

    test('slot badge admite rating/enum/ordinal_enum', () {
      final slot = mkSlot(['badge']);
      expect(isFieldCompatibleWithSlot(const FieldSpec('number', behavior: 'rating'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('array<string>', behavior: 'enum'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text', behavior: 'ordinal_enum'), slot), isTrue);
      expect(isFieldCompatibleWithSlot(const FieldSpec('text'), slot), isFalse);
    });
  });
}
