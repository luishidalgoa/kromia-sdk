import 'dart:ui' show Color;

import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-244 — espejo de los TINTES del marco del `iridescent_foil` centralizados en
/// `@kromia/core` `foil-recipe.ts` (`f5e0c65`). Fuente única: el render del host los
/// lee de aquí, no hardcodea hex. Los valores se re-saturaron (los 4 oscuros se
/// veían iguales; `silver` era casi blanco).
Color _rgb(int rgb) => Color(0xFF000000 | rgb);

void main() {
  group('foilBorderSolid (KRO-244)', () {
    test('hex exactos del core (silver oscurecido)', () {
      expect(foilBorderSolid['none'], _rgb(0xffffff));
      expect(foilBorderSolid['gold'], _rgb(0xf5c542));
      expect(foilBorderSolid['silver'], _rgb(0xaeb9c7));
    });
    test('silver YA NO es el casi-blanco previo (#cbd5e1)', () {
      expect(foilBorderSolid['silver'], isNot(_rgb(0xcbd5e1)));
    });
  });

  group('foilCardBg (KRO-244)', () {
    test('degradados top→bottom re-saturados, hex exactos del core', () {
      expect(foilCardBg['forest'], (top: _rgb(0x2e7d4f), bottom: _rgb(0x0b2b1a)));
      expect(foilCardBg['obsidian'], (top: _rgb(0x41444d), bottom: _rgb(0x0a0a0d)));
      expect(foilCardBg['plum'], (top: _rgb(0x6d3fa8), bottom: _rgb(0x22103d)));
      expect(foilCardBg['steel'], (top: _rgb(0x3f6d99), bottom: _rgb(0x101f30)));
    });
    test('los 4 tonos "top" son distinguibles entre sí (el bug que motivó el cambio)', () {
      final tops = foilCardBg.values.map((v) => v.top).toSet();
      expect(tops, hasLength(4));
    });
  });

  group('parseFoilPatternHex (KRO-244)', () {
    test('acepta 2–4 hex #RRGGBB por coma (trim); rechaza el resto', () {
      expect(parseFoilPatternHex('#ff0000,#00ff00'), ['#ff0000', '#00ff00']);
      expect(parseFoilPatternHex(' #ff0000 , #00ff00 , #0000ff '),
          ['#ff0000', '#00ff00', '#0000ff']);
      expect(parseFoilPatternHex('#111111,#222222,#333333,#444444'), hasLength(4));
      // inválidos → null (→ se usa pattern)
      expect(parseFoilPatternHex(null), isNull);
      expect(parseFoilPatternHex(''), isNull);
      expect(parseFoilPatternHex('#ff0000'), isNull, reason: '1 color < mínimo 2');
      expect(parseFoilPatternHex('#1,#2,#3,#4,#5'), isNull, reason: '5 > máximo 4');
      expect(parseFoilPatternHex('#ff0000,verde'), isNull, reason: 'hex inválido');
      expect(parseFoilPatternHex('#fff,#000'), isNull, reason: 'shorthand no permitido');
    });
  });

  group('foilEffectiveAngle / warp orgánico (KRO-244)', () {
    test('ángulo nativo por pattern (linear=angleDeg, conic=fromDeg, custom/desconocido=115)', () {
      expect(foilPatternBaseAngle('spectrum'), 115);
      expect(foilPatternBaseAngle('oilslick'), 120);
      expect(foilPatternBaseAngle('aurora'), 0, reason: 'conic → fromDeg');
      expect(foilPatternBaseAngle('zzz'), 115, reason: 'desconocido = 115 (spectrum)');
    });
    test('foilEffectiveAngle = nativo + rotate', () {
      expect(foilEffectiveAngle('spectrum', 30), 145);
      expect(foilEffectiveAngle('aurora', 90), 90);
      expect(foilEffectiveAngle('spectrum'), 115);
    });
    test('FOIL_ORGANIC_WARP espejado 1:1 (6cb2c85)', () {
      expect(foilOrganicWarp.baseFrequencyX, 0.008);
      expect(foilOrganicWarp.baseFrequencyY, 0.014);
      expect(foilOrganicWarp.octaves, 2);
      expect(foilOrganicWarp.seed, 7);
      expect(foilOrganicWarp.maxDisplacement, 90);
      expect(foilOrganicWarp.overscan, 0.12);
    });
    test('foilWarpDisplacement = warp/100 · 90, clampado 0–100', () {
      expect(foilWarpDisplacement(0), 0);
      expect(foilWarpDisplacement(55), closeTo(49.5, 1e-9));
      expect(foilWarpDisplacement(100), 90);
      expect(foilWarpDisplacement(150), 90);
      expect(foilWarpDisplacement(-5), 0);
    });
  });

  group('foilCustomPattern (KRO-244)', () {
    test('ciclo 45% equiespaciado + primer color repetido al cierre (sin costura)', () {
      final p = foilCustomPattern(['#ff0000', '#00ff00', '#0000ff']);
      expect(p.kind, 'repeating-linear');
      expect(p.angleDeg, 115, reason: 'ángulo NATIVO = spectrum; angle se suma en render');
      // 3 colores → 0%, 15%, 30% + cierre color0 @45%.
      expect(p.stops.map((s) => s.pos).toList(), [0.0, 15.0, 30.0, 45.0]);
      expect(p.stops.first.color, p.stops.last.color, reason: 'cierre = primer color');
      expect(p.stops.first.color, _rgb(0xff0000));
    });
  });

  group('paleta "Ninguna" (KRO-247, KRP 5.4.0)', () {
    test('foilPatternNone es un id RESERVADO fuera de foilPatterns', () {
      expect(foilPatternNone, 'none');
      expect(foilPatterns.containsKey(foilPatternNone), isFalse);
    });
    test('foilNeutralSheen — barrido blanco 115°, alpha 0→0.9→0 (sin costura)', () {
      expect(foilNeutralSheen.angleDeg, 115);
      expect(foilNeutralSheen.stops.map((s) => s.alpha).toList(), [0.0, 0.9, 0.0]);
      expect(foilNeutralSheen.stops.map((s) => s.pos).toList(), [0.0, 50.0, 100.0]);
    });
  });

  group('resolveFoilBorderFill (KRO-249, KRP 5.6.0)', () {
    test('precedencia: textura > hex sólido > degradado custom > enum', () {
      expect(
          resolveFoilBorderFill({
            'border_texture_url': 'foo/metal.png',
            'border_color_hex': '#ff0000',
            'border_gradient_hex': '#a1a1a1,#e8e8e8',
            'border_color': 'gold',
          }).kind,
          'texture');
      final solid = resolveFoilBorderFill({
        'border_color_hex': '#ff0000',
        'border_gradient_hex': '#a1a1a1,#e8e8e8',
        'border_color': 'gold',
      });
      expect(solid.kind, 'solid');
      expect(solid.color, _rgb(0xff0000));
      // hex inválido NO manda → cae al enum
      expect(
          resolveFoilBorderFill({'border_color_hex': 'nope', 'border_color': 'gold'})
              .color,
          foilBorderSolid['gold']);
      final grad = resolveFoilBorderFill(
          {'border_gradient_hex': '#a1a1a1,#e8e8e8', 'border_color': 'gold'});
      expect(grad.kind, 'custom-gradient');
      expect(grad.colors, ['#a1a1a1', '#e8e8e8']);
    });
    test('kinds del enum: spectrum=follow-foil · paletas=palette · card-bg · sólidos', () {
      expect(resolveFoilBorderFill({'border_color': 'spectrum'}).kind, 'follow-foil');
      expect(resolveFoilBorderFill({'border_color': 'aurora'}).pattern, 'aurora');
      expect(resolveFoilBorderFill({'border_color': 'midnight'}).kind, 'palette');
      final bg = resolveFoilBorderFill({'border_color': 'forest'});
      expect(bg.kind, 'card-bg');
      expect(bg.top, foilCardBg['forest']!.top);
      expect(resolveFoilBorderFill({'border_color': 'silver'}).color,
          foilBorderSolid['silver']);
      // fallback: sin nada / desconocido = blanco (look base)
      expect(resolveFoilBorderFill(const {}).color, _rgb(0xffffff));
      expect(resolveFoilBorderFill({'border_color': 'bogus'}).color, _rgb(0xffffff));
    });
    test('las 13 opciones del CONTRATO solo producen kinds conocidos', () {
      final opts = getVisualEffect('iridescent_foil')!
          .config
          .firstWhere((p) => p.key == 'border_color')
          .options!;
      expect(opts.length, greaterThanOrEqualTo(13));
      for (final o in opts) {
        expect(['solid', 'follow-foil', 'palette', 'card-bg'],
            contains(resolveFoilBorderFill({'border_color': o}).kind),
            reason: 'opción "$o"');
      }
    });
  });
}
