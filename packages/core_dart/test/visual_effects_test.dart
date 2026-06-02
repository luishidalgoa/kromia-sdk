/// Corpus de visual_effects.dart + tag_styles.dart — ESPEJO de
/// `tests/visual-effects.test.ts` (KRO-30). El catálogo se lee del `.json`
/// embebido (no hardcode). Adaptación: el `.json` NO incluye `label` (es
/// editor-only de Studio) → se omite esa aserción del shape.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

void main() {
  group('visual-effects registry', () {
    final effects = allVisualEffects();

    test('contiene los 6 efectos de la V1', () {
      expect(effects.length, 6);
      expect(effects.map((e) => e.id).toList(), [
        'holographic_effect',
        'crown_badge',
        'vintage_filter',
        'glow_border',
        'frozen',
        'signed',
      ]);
    });

    test('IDs únicos', () {
      final ids = effects.map((e) => e.id).toList();
      expect(ids.toSet().length, ids.length);
    });

    test('cada efecto tiene shape válido', () {
      const validLayers = {'overlay', 'badge', 'filter', 'border'};
      const validTypes = {'enum', 'number', 'string'};
      final idRe = RegExp(r'^[a-z_]+$');
      for (final e in effects) {
        expect(idRe.hasMatch(e.id), true);
        expect(e.displayName, isNotEmpty);
        expect(e.description.length, greaterThan(10));
        expect(validLayers.contains(e.layer), true);
        for (final p in e.config) {
          expect(idRe.hasMatch(p.key), true);
          expect(validTypes.contains(p.type), true);
          if (p.type == 'enum') {
            expect(p.options != null && p.options!.isNotEmpty, true);
            if (p.defaultValue != null) {
              expect(p.options, contains(p.defaultValue));
            }
          }
        }
      }
    });

    test('visualEffectIds matchea los ids del catálogo', () {
      final fromGetter = [...visualEffectIds]..sort();
      final fromCatalog = effects.map((e) => e.id).toList()..sort();
      expect(fromGetter, fromCatalog);
    });

    test('getVisualEffect devuelve la entry correcta', () {
      expect(getVisualEffect('crown_badge')?.layer, 'badge');
      expect(getVisualEffect('holographic_effect')?.config[0].key, 'intensity');
      expect(getVisualEffect('frozen')?.config, isEmpty);
      expect(getVisualEffect('unknown'), isNull);
    });
  });

  group('isTagStyleValid', () {
    test('efecto válido sin config → true', () {
      expect(isTagStyleValid(const TagStyle(value: 'Congelada', effect: 'frozen')), true);
    });

    test('efecto válido con config válida → true', () {
      expect(
          isTagStyleValid(const TagStyle(
              value: 'Holográfica',
              effect: 'holographic_effect',
              config: {'intensity': 'high'})),
          true);
      expect(
          isTagStyleValid(const TagStyle(
              value: 'MVP',
              effect: 'crown_badge',
              config: {'color': 'gold', 'position': 'top-left'})),
          true);
    });

    test('efecto inexistente → false', () {
      expect(isTagStyleValid(const TagStyle(value: 'X', effect: 'no_existe')), false);
    });

    test('value vacío → false', () {
      expect(isTagStyleValid(const TagStyle(value: '   ', effect: 'frozen')), false);
    });

    test('config con key desconocida → false', () {
      expect(
          isTagStyleValid(
              const TagStyle(value: 'X', effect: 'frozen', config: {'foo': 'bar'})),
          false);
    });

    test('config con valor enum fuera de options → false', () {
      expect(
          isTagStyleValid(const TagStyle(
              value: 'X', effect: 'holographic_effect', config: {'intensity': 'ultra'})),
          false);
    });

    test('config string (signature_url) acepta cualquier string', () {
      expect(
          isTagStyleValid(const TagStyle(
              value: 'Firmada',
              effect: 'signed',
              config: {'signature_url': 'https://x/firma.png'})),
          true);
    });

    test('config string con valor numérico → false', () {
      expect(
          isTagStyleValid(const TagStyle(
              value: 'Firmada', effect: 'signed', config: {'signature_url': 42})),
          false);
    });
  });

  group('validateTagStyles', () {
    test('array válido → valid:true, sin issues', () {
      final r = validateTagStyles(const [
        TagStyle(
            value: 'Holográfica', effect: 'holographic_effect', config: {'intensity': 'medium'}),
        TagStyle(value: 'MVP', effect: 'crown_badge'),
      ]);
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });

    test('reporta el índice del entry inválido', () {
      final r = validateTagStyles(const [
        TagStyle(value: 'OK', effect: 'frozen'),
        TagStyle(value: 'Bad', effect: 'inexistente'),
      ]);
      expect(r.valid, false);
      final err = r.issues.firstWhere((i) => i.level == 'error');
      expect(err.index, 1);
      expect(err.path, 'tagStyles[1].effect');
    });

    test('valores de tag duplicados → warn (no invalida)', () {
      final r = validateTagStyles(const [
        TagStyle(value: 'Rara', effect: 'glow_border'),
        TagStyle(value: 'Rara', effect: 'holographic_effect'),
      ]);
      expect(r.valid, true);
      final warn = r.issues.firstWhere((i) => i.level == 'warn');
      expect(warn.index, 1);
      expect(warn.message, contains('duplicado'));
    });

    test('array vacío → valid:true', () {
      final r = validateTagStyles(const []);
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });
  });
}
