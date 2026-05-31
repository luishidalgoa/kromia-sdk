/// Corpus de `synthSectionItems` — ESPEJO 1:1 de `tests/synth.test.ts`.
/// Los snapshots son GROUND TRUTH cross-language: si el hash FNV-1a o el corpus
/// divergen del TS, estos snapshots fallan.
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

SynthSourceSection makeSection(List<SynthSourceField> fields) =>
    SynthSourceSection(fields);

final playersSection = makeSection(const [
  SynthSourceField(key: 'nombre', type: 'text'),
  SynthSourceField(key: 'pais', type: 'text'),
  SynthSourceField(key: 'edad', type: 'number'),
  SynthSourceField(key: 'rating', type: 'number', behavior: 'rating'),
  SynthSourceField(key: 'avatar', type: 'image'),
  SynthSourceField(key: 'website', type: 'text', behavior: 'url'),
  SynthSourceField(key: 'color', type: 'text', behavior: 'color_hex'),
  SynthSourceField(key: 'galeria', type: 'array<image>', behavior: 'gallery'),
]);

final momentSection = makeSection(const [
  SynthSourceField(key: 'year', type: 'number', behavior: 'year'),
  SynthSourceField(key: 'title', type: 'text'),
  SynthSourceField(key: 'subtitle', type: 'text'),
  SynthSourceField(key: 'fotos', type: 'array<image>', behavior: 'slideshow'),
]);

final editorialSection = makeSection(const [
  SynthSourceField(key: 'titulo', type: 'text'),
  SynthSourceField(key: 'cover', type: 'image'),
  SynthSourceField(key: 'fecha', type: 'text', behavior: 'iso_date'),
  SynthSourceField(key: 'cuerpo', type: 'textarea', behavior: 'markdown'),
  SynthSourceField(key: 'precio', type: 'number', behavior: 'currency'),
  SynthSourceField(key: 'tags', type: 'array<string>', behavior: 'enum'),
]);

void main() {
  group('synthSectionItems — básico', () {
    test('determinístico (3 runs)', () {
      final a = synthSectionItems('players', playersSection, 3);
      final b = synthSectionItems('players', playersSection, 3);
      final c = synthSectionItems('players', playersSection, 3);
      expect(a, equals(b));
      expect(b, equals(c));
    });
    test('genera N items', () {
      expect(synthSectionItems('x', playersSection, 1).length, 1);
      expect(synthSectionItems('x', playersSection, 3).length, 3);
      expect(synthSectionItems('x', playersSection, 10).length, 10);
    });
    test('una key por field', () {
      final keys = synthSectionItems('players', playersSection, 1)[0].keys.toList()..sort();
      expect(keys, playersSection.fields.map((f) => f.key).toList()..sort());
    });
    test('sectionKey distinto → outputs distintos', () {
      expect(synthSectionItems('foo', playersSection, 3),
          isNot(equals(synthSectionItems('bar', playersSection, 3))));
    });
  });

  group('synthSectionItems — snapshots (cross-language ground truth)', () {
    test('3 jugadores', () {
      expect(synthSectionItems('players', playersSection, 3), equals([
        {
          'nombre': 'Andrés López',
          'pais': 'Francia',
          'edad': 96,
          'rating': 4,
          'avatar': 'https://picsum.photos/seed/kromia-4/400/300',
          'website': 'https://kromia.app',
          'color': '#42d7be',
          'galeria': [
            'https://picsum.photos/seed/kromia-0/400/300',
            'https://picsum.photos/seed/kromia-1/400/300',
            'https://picsum.photos/seed/kromia-2/400/300',
          ],
        },
        {
          'nombre': 'Elena Pérez',
          'pais': 'España',
          'edad': 20,
          'rating': 5,
          'avatar': 'https://picsum.photos/seed/kromia-76/400/300',
          'website': 'https://example.com/page',
          'color': '#7d42d7',
          'galeria': [
            'https://picsum.photos/seed/kromia-44/400/300',
            'https://picsum.photos/seed/kromia-45/400/300',
            'https://picsum.photos/seed/kromia-46/400/300',
          ],
        },
        {
          'nombre': 'Carmen Romero',
          'pais': 'España',
          'edad': 32,
          'rating': 4,
          'avatar': 'https://picsum.photos/seed/kromia-16/400/300',
          'website': 'https://kromia.app',
          'color': '#d7b442',
          'galeria': [
            'https://picsum.photos/seed/kromia-56/400/300',
            'https://picsum.photos/seed/kromia-57/400/300',
            'https://picsum.photos/seed/kromia-58/400/300',
          ],
        },
      ]));
    });

    test('3 momentos', () {
      expect(synthSectionItems('moments', momentSection, 3), equals([
        {
          'year': 2013,
          'title': 'Lucía García',
          'subtitle': 'Sofía Hidalgo',
          'fotos': [
            'https://picsum.photos/seed/kromia-56/400/300',
            'https://picsum.photos/seed/kromia-57/400/300',
            'https://picsum.photos/seed/kromia-58/400/300',
          ],
        },
        {
          'year': 2014,
          'title': 'Sofía Romero',
          'subtitle': 'Elena Pérez',
          'fotos': [
            'https://picsum.photos/seed/kromia-36/400/300',
            'https://picsum.photos/seed/kromia-37/400/300',
            'https://picsum.photos/seed/kromia-38/400/300',
          ],
        },
        {
          'year': 1985,
          'title': 'Lucía Pérez',
          'subtitle': 'Elena Castro',
          'fotos': [
            'https://picsum.photos/seed/kromia-16/400/300',
            'https://picsum.photos/seed/kromia-17/400/300',
            'https://picsum.photos/seed/kromia-18/400/300',
          ],
        },
      ]));
    });

    test('3 editoriales', () {
      expect(synthSectionItems('editorial', editorialSection, 3), equals([
        {
          'titulo': 'Andrés Romero',
          'cover': 'https://picsum.photos/seed/kromia-27/400/300',
          'fecha': '2024-01-04',
          'cuerpo': 'Era una noche oscura y tormentosa. El viento azotaba las ventanas mientras escribíamos esta crónica.',
          'precio': 24,
          'tags': ['Cádiz', 'Barcelona', 'Cádiz'],
        },
        {
          'titulo': 'Carmen Hidalgo',
          'cover': 'https://picsum.photos/seed/kromia-98/400/300',
          'fecha': '2024-02-11',
          'cuerpo': 'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero.',
          'precio': 76,
          'tags': ['Cádiz', 'Barcelona', 'Cádiz'],
        },
        {
          'titulo': 'Andrés Ortiz',
          'cover': 'https://picsum.photos/seed/kromia-2/400/300',
          'fecha': '2024-03-18',
          'cuerpo': 'Era una noche oscura y tormentosa. El viento azotaba las ventanas mientras escribíamos esta crónica.',
          'precio': 56,
          'tags': ['Cádiz', 'Sevilla', 'Cádiz'],
        },
      ]));
    });
  });

  group('synthSectionItems — formato por behavior', () {
    final sec = makeSection(const [
      SynthSourceField(key: 'year', type: 'number', behavior: 'year'),
      SynthSourceField(key: 'date', type: 'text', behavior: 'iso_date'),
      SynthSourceField(key: 'color', type: 'text', behavior: 'color_hex'),
      SynthSourceField(key: 'url', type: 'text', behavior: 'url'),
      SynthSourceField(key: 'email', type: 'text', behavior: 'email'),
      SynthSourceField(key: 'phone', type: 'text', behavior: 'phone'),
      SynthSourceField(key: 'rating', type: 'number', behavior: 'rating'),
      SynthSourceField(key: 'cards', type: 'array<number>', behavior: 'card_index_list'),
      SynthSourceField(key: 'codes', type: 'array<string>', behavior: 'card_code_list'),
      SynthSourceField(key: 'gallery', type: 'array<image>', behavior: 'gallery'),
      SynthSourceField(key: 'avatar', type: 'image', behavior: 'avatar'),
      SynthSourceField(key: 'banner', type: 'image', behavior: 'banner'),
    ]);
    final item = synthSectionItems('mix', sec, 1)[0];

    test('year 1980-2025', () {
      expect(item['year'], isA<int>());
      expect(item['year'] as int, inInclusiveRange(1980, 2025));
    });
    test('iso_date YYYY-MM-DD', () => expect(item['date'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$'))));
    test('color_hex #rrggbb', () => expect(item['color'], matches(RegExp(r'^#[0-9a-f]{6}$'))));
    test('url', () => expect(item['url'], matches(RegExp(r'^https?://'))));
    test('email', () => expect(item['email'], matches(RegExp(r'^[\w.]+@[\w.]+$'))));
    test('phone', () => expect(item['phone'], matches(RegExp(r'^\+?\d'))));
    test('rating 1-5', () {
      expect(item['rating'] as int, inInclusiveRange(1, 5));
    });
    test('card_index_list array de números', () {
      expect(item['cards'], isA<List>());
      for (final c in item['cards'] as List) {
        expect(c, isA<int>());
      }
    });
    test('card_code_list array de "C-xxx"', () {
      for (final c in item['codes'] as List) {
        expect(c, matches(RegExp(r'^C-\d+$')));
      }
    });
    test('gallery URLs picsum', () {
      for (final g in item['gallery'] as List) {
        expect(g, matches(RegExp(r'^https://picsum\.photos/seed/kromia-\d+')));
      }
    });
    test('avatar 200x200', () => expect(item['avatar'], matches(RegExp(r'^https://picsum\.photos/seed/kromia-\d+/200/200$'))));
    test('banner 600x200', () => expect(item['banner'], matches(RegExp(r'^https://picsum\.photos/seed/kromia-\d+/600/200$'))));
  });

  group('synthSectionItems — heurística por key', () {
    test('nombre → "Nombre Apellido"', () {
      final items = synthSectionItems('s', makeSection(const [SynthSourceField(key: 'nombre', type: 'text')]), 5);
      for (final it in items) {
        expect((it['nombre'] as String).split(' ').length, greaterThanOrEqualTo(2));
      }
    });
    test('pais → país del corpus', () {
      const known = ['España', 'Brasil', 'Argentina', 'México', 'Francia', 'Italia', 'Alemania', 'Portugal'];
      final items = synthSectionItems('s', makeSection(const [SynthSourceField(key: 'pais', type: 'text')]), 3);
      for (final it in items) {
        expect(known, contains(it['pais']));
      }
    });
    test('team → "Ciudad Nombre"', () {
      final items = synthSectionItems('s', makeSection(const [SynthSourceField(key: 'team', type: 'text')]), 3);
      for (final it in items) {
        expect((it['team'] as String).split(' ').length, 2);
      }
    });
  });

  group('synthSectionItems — select', () {
    test('itera opciones en orden', () {
      final sec = makeSection(const [SynthSourceField(key: 'rareza', type: 'select', options: ['Común', 'Rara', 'Épica'])]);
      final values = synthSectionItems('s', sec, 6).map((it) => it['rareza']).toList();
      expect(values, ['Común', 'Rara', 'Épica', 'Común', 'Rara', 'Épica']);
    });
    test('select sin options → BADGE_VALUES', () {
      const badges = ['Común', 'Rara', 'Épica', 'Legendaria', 'Mítica'];
      final items = synthSectionItems('s', makeSection(const [SynthSourceField(key: 'rareza', type: 'select')]), 3);
      for (final it in items) {
        expect(badges, contains(it['rareza']));
      }
    });
  });
}
