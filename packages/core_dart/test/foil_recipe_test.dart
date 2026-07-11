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
}
