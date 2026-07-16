/// Corpus de visual_effects.dart + tag_styles.dart — ESPEJO de
/// `tests/visual-effects.test.ts` (KRO-30). El catálogo se lee del `.json`
/// embebido (no hardcode). Adaptación: el `.json` NO incluye `label` (es
/// editor-only de Studio) → se omite esa aserción del shape.
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

void main() {
  group('visual-effects registry', () {
    final effects = allVisualEffects();

    test('contiene los efectos del catálogo (orden del contrato)', () {
      expect(effects.length, 7);
      expect(effects.map((e) => e.id).toList(), [
        'holographic_effect',
        'iridescent_foil', // KRO-202/224 — 2ª posición, como en el contrato
        'crown_badge',
        'vintage_filter',
        'glow_border',
        'frozen',
        'signed',
      ]);
    });

    test('iridescent_foil (KRO-224/244/247-249/256): layer overlay + 29 params + rangos/enums', () {
      final e = getVisualEffect('iridescent_foil')!;
      expect(e.layer, 'overlay');
      // KRO-244: +geometry+warp+pattern_hex+angle · KRO-248: +mask_url+mask_layout
      // +mask_scale · KRO-249: +border_gradient_hex+border_texture_url ·
      // KRO-256: +motion+mask_sparkle+border_sheen.
      expect(e.config.length, 29);
      final pattern = e.config.firstWhere((p) => p.key == 'pattern');
      expect(pattern.type, 'enum');
      expect(pattern.defaultValue, 'spectrum');
      expect(pattern.options, contains('aurora'));
      // KRO-247 (KRP 5.4.0) — paleta "Ninguna" (lámina neutra sin color).
      expect(pattern.options, contains('none'));
      // KRO-248 (KRP 5.5.0) — máscara importable por luminancia + tile.
      expect(e.config.firstWhere((p) => p.key == 'mask_url').type, 'string');
      final maskLayout = e.config.firstWhere((p) => p.key == 'mask_layout');
      expect(maskLayout.options, ['cover', 'tile']);
      expect(maskLayout.defaultValue, 'cover');
      final maskScale = e.config.firstWhere((p) => p.key == 'mask_scale');
      expect(maskScale.min, 5);
      expect(maskScale.max, 100);
      expect(maskScale.defaultValue, 25);
      // KRO-249 (KRP 5.6.0) — fill libre del marco.
      final borderColor = e.config.firstWhere((p) => p.key == 'border_color');
      expect(borderColor.options,
          containsAll(['oilslick', 'sunset', 'mint', 'midnight', 'spectrum']));
      expect(borderColor.options!.length, greaterThanOrEqualTo(13));
      expect(e.config.firstWhere((p) => p.key == 'border_gradient_hex').type, 'string');
      expect(e.config.firstWhere((p) => p.key == 'border_texture_url').type, 'string');
      final scale = e.config.firstWhere((p) => p.key == 'scale');
      expect(scale.type, 'number');
      expect(scale.min, 100);
      expect(scale.max, 320);
      expect(scale.defaultValue, 210);
      // border_color_hex es string libre (color personalizado), sin options/min/max.
      final hex = e.config.firstWhere((p) => p.key == 'border_color_hex');
      expect(hex.type, 'string');
      // KRO-244 — difracción orgánica: geometry (enum, default retro-compat 'bandas')
      // + warp (0–100, default 55). Espejo del bump KRP 5.2.0.
      final geometry = e.config.firstWhere((p) => p.key == 'geometry');
      expect(geometry.type, 'enum');
      expect(geometry.defaultValue, 'bandas');
      expect(geometry.options, containsAll(['bandas', 'organico']));
      final warp = e.config.firstWhere((p) => p.key == 'warp');
      expect(warp.type, 'number');
      expect(warp.min, 0);
      expect(warp.max, 100);
      expect(warp.defaultValue, 55);
      // KRO-244 — paleta personalizada + orientación (KRP 5.3.0). pattern_hex =
      // string libre (2–4 hex, manda sobre pattern); angle = 0–360, default 0.
      final patternHex = e.config.firstWhere((p) => p.key == 'pattern_hex');
      expect(patternHex.type, 'string');
      final angle = e.config.firstWhere((p) => p.key == 'angle');
      expect(angle.type, 'number');
      expect(angle.min, 0);
      expect(angle.max, 360);
      expect(angle.defaultValue, 0);
      // KRO-256 (KRP 5.7.0) — vida del iridiscente: movimiento a elección,
      // destellos por perforación y brillo del marco.
      final motion = e.config.firstWhere((p) => p.key == 'motion');
      expect(motion.type, 'enum');
      expect(motion.options, ['auto', 'deriva', 'tono', 'total']);
      expect(motion.defaultValue, 'auto');
      final sparkle = e.config.firstWhere((p) => p.key == 'mask_sparkle');
      expect(sparkle.options, ['no', 'pastel', 'vivo']);
      expect(sparkle.defaultValue, 'no');
      final bsheen = e.config.firstWhere((p) => p.key == 'border_sheen');
      expect(bsheen.options, ['no', 'metalico', 'iridiscente']);
      expect(bsheen.defaultValue, 'no');
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

    // KRO-127 — combinar efectos DISTINTOS sobre el mismo valor = intencionado
    // (sin aviso); solo el MISMO efecto repetido avisa. Espejo de tag-styles.ts.
    test('efectos DISTINTOS sobre el mismo valor → SIN aviso (se combinan)', () {
      final r = validateTagStyles(const [
        TagStyle(value: 'Rara', effect: 'glow_border'),
        TagStyle(value: 'Rara', effect: 'holographic_effect'),
      ]);
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });
    test('el MISMO efecto repetido sobre el mismo valor → warn', () {
      final r = validateTagStyles(const [
        TagStyle(value: 'Rara', effect: 'glow_border'),
        TagStyle(value: 'Rara', effect: 'glow_border'),
      ]);
      expect(r.valid, true);
      final warn = r.issues.firstWhere((i) => i.level == 'warn');
      expect(warn.index, 1);
      expect(warn.message, contains('ya está aplicado'));
    });

    // KRO-122/123 — foil personalizado: incompleto = warn, no error.
    test('custom_foil sin capas / capa sin textura → warn (no bloquea)', () {
      final sinCapas = validateTagStyles(const [
        TagStyle(value: 'comun', effect: 'custom_foil', customLayers: []),
      ]);
      expect(sinCapas.valid, true);
      expect(sinCapas.issues.single.level, 'warn');
      final sinTextura = validateTagStyles(const [
        TagStyle(value: 'comun', effect: 'custom_foil', customLayers: [
          EffectLayer(kind: 'foil', textureUrl: '', blend: 'color-dodge'),
        ]),
      ]);
      expect(sinTextura.valid, true);
      expect(sinTextura.issues.single.path, contains('textureUrl'));
    });

    // KRO-250 — capa PROCEDURAL iridiscente en la pila unificada.
    test('capa iridiscente sin textura → SIN warn; config inválido → error', () {
      final ok = validateTagStyles(const [
        TagStyle(value: 'comun', effect: 'custom_foil', customLayers: [
          EffectLayer(kind: 'iridescent', blend: 'color-dodge', config: {
            'pattern': 'midnight',
            'warp': 40,
          }),
        ]),
      ]);
      expect(ok.valid, true);
      expect(ok.issues, isEmpty);

      final bad = validateTagStyles(const [
        TagStyle(value: 'comun', effect: 'custom_foil', customLayers: [
          EffectLayer(kind: 'iridescent', blend: 'color-dodge', config: {
            'pattern': 'bogus',
            'hue': 900,
          }),
        ]),
      ]);
      expect(bad.valid, false);
      expect(bad.issues.any((i) => i.path.contains('config.pattern')), isTrue);
      expect(bad.issues.any((i) => i.path.contains('config.hue')), isTrue);
    });

    // KRO-247/248/249 — el contrato 5.6.0 embebido admite los params nuevos.
    test('contrato 5.6.0: pattern none + máscara + fill libre del marco', () {
      final r = validateTagStyles(const [
        TagStyle(value: 'Legendaria', effect: 'iridescent_foil', config: {
          'pattern': 'none',
          'mask_url': 'x/dots.png',
          'mask_layout': 'tile',
          'mask_scale': 18,
          'border_style': 'classic',
          'border_gradient_hex': '#8e9aa8,#e8edf2,#8e9aa8',
          'border_texture_url': 'x/metal.png',
          'border_color': 'midnight',
        }),
      ]);
      expect(r.valid, true, reason: r.issues.join('; '));
      expect(r.issues, isEmpty);
    });

    test('array vacío → valid:true', () {
      final r = validateTagStyles(const []);
      expect(r.valid, true);
      expect(r.issues, isEmpty);
    });
  });
}
