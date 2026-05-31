/// Corpus de `buildAutoDetailComposition` — ESPEJO 1:1 de `tests/auto-detail.test.ts`.
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

FieldDefLike fd(String key, String type, [String? behavior, List<String>? options]) =>
    FieldDefLike(key: key, type: type, behavior: behavior, options: options);

void main() {
  group('buildAutoDetailComposition — defaults base', () {
    test('sección vacía → hero_protagonico + slots vacíos', () {
      final r = buildAutoDetailComposition([]);
      expect(r.recipe, 'hero_protagonico');
      expect(r.action, 'none');
      expect(r.slots, isEmpty);
    });
  });

  group('buildAutoDetailComposition — avatar / banner', () {
    test('behavior=avatar → slot avatar', () {
      final r = buildAutoDetailComposition([fd('pic', 'image', 'avatar')]);
      expect(r.slots['avatar']!.fields, ['pic']);
    });
    test('behavior=banner → slot banner', () {
      final r = buildAutoDetailComposition([fd('header', 'image', 'banner')]);
      expect(r.slots['banner']!.fields, ['header']);
    });
    test('behavior=cover → banner (fallback)', () {
      final r = buildAutoDetailComposition([fd('cover', 'image', 'cover')]);
      expect(r.slots['banner']!.fields, ['cover']);
    });
    test('behavior=thumbnail → banner (fallback)', () {
      final r = buildAutoDetailComposition([fd('thumb', 'image', 'thumbnail')]);
      expect(r.slots['banner']!.fields, ['thumb']);
    });
    test('banner explícito gana sobre cover', () {
      final r = buildAutoDetailComposition([
        fd('cover', 'image', 'cover'),
        fd('header', 'image', 'banner'),
      ]);
      expect(r.slots['banner']!.fields, ['header']);
    });
  });

  group('buildAutoDetailComposition — title', () {
    test('primer text-short → title', () {
      final r = buildAutoDetailComposition([fd('nombre', 'text')]);
      expect(r.slots['title']!.fields, ['nombre']);
    });
    test('select también vale', () {
      final r = buildAutoDetailComposition([fd('rareza', 'select', null, ['raro', 'común'])]);
      expect(r.slots['title']!.fields, ['rareza']);
    });
    test('text con url NO va a title', () {
      final r = buildAutoDetailComposition([fd('web', 'text', 'url')]);
      expect(r.slots['title'], isNull);
    });
    test('text con email NO va a title', () {
      final r = buildAutoDetailComposition([fd('mail', 'text', 'email')]);
      expect(r.slots['title'], isNull);
    });
  });

  group('buildAutoDetailComposition — subtitle', () {
    test('primer year → subtitle', () {
      final r = buildAutoDetailComposition([fd('temporada', 'number', 'year')]);
      expect(r.slots['subtitle']!.fields, ['temporada']);
    });
    test('primer iso_date → subtitle', () {
      final r = buildAutoDetailComposition([fd('fecha', 'text', 'iso_date')]);
      expect(r.slots['subtitle']!.fields, ['fecha']);
    });
  });

  group('buildAutoDetailComposition — stats', () {
    test('un number → stats con 1 field + orientation/separator', () {
      final r = buildAutoDetailComposition([fd('edad', 'number')]);
      expect(r.slots['stats']!.fields, ['edad']);
      expect(r.slots['stats']!.orientation, 'horizontal');
      expect(r.slots['stats']!.separator, ' | ');
    });
    test('5 numbers → primeros 4', () {
      final r = buildAutoDetailComposition([
        fd('a', 'number'), fd('b', 'number'), fd('c', 'number'),
        fd('d', 'number'), fd('e', 'number'),
      ]);
      expect(r.slots['stats']!.fields, ['a', 'b', 'c', 'd']);
    });
    test('cero numbers → sin stats', () {
      final r = buildAutoDetailComposition([fd('nombre', 'text')]);
      expect(r.slots['stats'], isNull);
    });
  });

  group('buildAutoDetailComposition — body / gallery / related', () {
    test('textarea → body', () {
      final r = buildAutoDetailComposition([fd('desc', 'textarea')]);
      expect(r.slots['body']!.fields, ['desc']);
    });
    test('markdown → body', () {
      final r = buildAutoDetailComposition([fd('doc', 'text', 'markdown')]);
      expect(r.slots['body']!.fields, ['doc']);
    });
    test('array<image> → gallery', () {
      final r = buildAutoDetailComposition([fd('fotos', 'array<image>')]);
      expect(r.slots['gallery']!.fields, ['fotos']);
    });
    test('behavior=gallery → gallery', () {
      final r = buildAutoDetailComposition([fd('g', 'array<image>', 'gallery')]);
      expect(r.slots['gallery']!.fields, ['g']);
    });
    test('card_index_list → related', () {
      final r = buildAutoDetailComposition([fd('refs', 'array<number>', 'card_index_list')]);
      expect(r.slots['related']!.fields, ['refs']);
    });
  });

  group('buildAutoDetailComposition — composición completa', () {
    test('sección rica → todos los slots', () {
      final r = buildAutoDetailComposition([
        fd('avatar', 'image', 'avatar'),
        fd('nombre', 'text'),
        fd('year', 'number', 'year'),
        fd('edad', 'number'),
        fd('rating', 'number'),
        fd('desc', 'textarea'),
        fd('fotos', 'array<image>', 'gallery'),
      ]);
      expect(r.recipe, 'hero_protagonico');
      expect(r.slots['avatar']!.fields, ['avatar']);
      expect(r.slots['title']!.fields, ['nombre']);
      expect(r.slots['subtitle']!.fields, ['year']);
      expect(r.slots['stats']!.fields, ['year', 'edad', 'rating']);
      expect(r.slots['body']!.fields, ['desc']);
      expect(r.slots['gallery']!.fields, ['fotos']);
    });
  });
}
