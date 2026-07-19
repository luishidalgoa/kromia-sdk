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
      // KRO-264 — stops con peso (default 1)
      expect(grad.stops!.map((s) => s.weight).toList(), [1.0, 1.0]);
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

  // KRO-256 — vida del iridiscente: movimiento + destellos de máscara + brillo
  // del marco. Espejo 1:1 del corpus TS (foil-recipe.test.ts).
  group('KRO-256 — motion / mask_sparkle / border_sheen', () {
    test('los valores de las recetas == options del contrato (anti-drift)', () {
      final cfg = getVisualEffect('iridescent_foil')!.config;
      expect(cfg.firstWhere((p) => p.key == 'motion').options, foilMotions);
      expect(cfg.firstWhere((p) => p.key == 'mask_sparkle').options,
          foilMaskSparkles);
      expect(cfg.firstWhere((p) => p.key == 'border_sheen').options,
          foilBorderSheens);
    });
    test('foilMotionFlags deriva drift/hueCycle (tolerante a basura)', () {
      expect(foilMotionFlags('auto'), (drift: false, hueCycle: false));
      expect(foilMotionFlags('deriva'), (drift: true, hueCycle: false));
      expect(foilMotionFlags('tono'), (drift: false, hueCycle: true));
      expect(foilMotionFlags('total'), (drift: true, hueCycle: true));
      expect(foilMotionFlags(null), (drift: false, hueCycle: false));
      expect(foilMotionFlags('bogus'), (drift: false, hueCycle: false));
    });
    test('tiempos: shimmer 0/50/100 + clamps + default del vaivén clásico', () {
      expect(foilMotionSweepSec(0), foilMotionTiming.sweep.baseSec);
      expect(foilMotionSweepSec(100), 2.0);
      // shimmer 50 (default) = 3.75s — MISMO valor que el vaivén de rejilla.
      expect(foilMotionSweepSec(50), 3.75);
      expect(foilMotionHueSec(0), 14);
      expect(foilMotionHueSec(100), 4);
      expect(foilMotionSweepSec(-50), 5.5); // clamp inferior
      expect(foilMotionHueSec(500), 4); // clamp superior
      expect(foilMotionSweepSec(double.nan), 3.75); // basura → default 50
    });
    test('recetas del sparkle y del brillo del marco: valores exactos del core', () {
      expect(foilMaskSparkle.sizePct, 46);
      expect(foilMaskSparkle.angleOffsetDeg, -30);
      expect(foilMaskSparkleVariants['pastel'], (opacity: 0.7, saturate: 0.85));
      expect(foilMaskSparkleVariants['vivo'], (opacity: 1.0, saturate: 1.6));
      // cada opción activa del contrato tiene variante
      for (final v in foilMaskSparkles.where((v) => v != 'no')) {
        expect(foilMaskSparkleVariants[v], isNotNull, reason: 'variante "$v"');
      }
      expect(foilBorderSheen.angleDeg, 100);
      expect(foilBorderSheen.sizePct, 250);
      expect(foilBorderSheen.iridescentOpacity, 0.75);
      // QA: banda afilada (pico 1.0 en ±8%)
      expect(foilBorderSheen.stops, [
        (alpha: 0.0, pos: 0.0),
        (alpha: 0.0, pos: 42.0),
        (alpha: 1.0, pos: 50.0),
        (alpha: 0.0, pos: 58.0),
        (alpha: 0.0, pos: 100.0),
      ]);
      // QA: canto del marco — rgba(24,22,34,0.75) + blur sub-píxel
      expect(foilBorderEdge.color, const Color(0xBF181622));
      expect(foilBorderEdge.blurPx, 0.6);
    });
  });

  // KRO-264 — degradado MULTIBANDA (espejo del corpus TS).
  group('KRO-264 — parseFoilGradientSpec / posiciones', () {
    test('pesos opcionales (@), default 1', () {
      final s = parseFoilGradientSpec('#ff0000,#00ff00@2.5')!;
      expect(s.map((e) => e.weight).toList(), [1.0, 2.5]);
      expect(s.map((e) => e.hex).toList(), ['#ff0000', '#00ff00']);
    });
    test('limites: 2..16 colores, pesos 0.1..20, hex validos', () {
      final dieciseis = List.generate(
          16, (i) => '#0000${(10 + i).toRadixString(16).padLeft(2, '0')}').join(',');
      expect(parseFoilGradientSpec(dieciseis), isNotNull);
      expect(parseFoilGradientSpec('$dieciseis,#ffffff'), isNull);
      expect(parseFoilGradientSpec('#ff0000'), isNull);
      expect(parseFoilGradientSpec('#ff0000@0,#00ff00'), isNull);
      expect(parseFoilGradientSpec('#ff0000@25,#00ff00'), isNull);
    });
    test('isMultibandGradient: >4 colores, pesos o ciclo', () {
      final s4 = parseFoilGradientSpec('#111111,#222222,#333333,#444444')!;
      expect(isMultibandGradient(s4), false);
      expect(isMultibandGradient(s4, 30), true);
      expect(isMultibandGradient(parseFoilGradientSpec('#111111,#222222@2')!), true);
    });
    test('foilGradientPositions reparte el ciclo por pesos (1:2:1 de 40)', () {
      final stops = parseFoilGradientSpec('#111111@1,#222222@2,#333333@1')!;
      expect(foilGradientPositions(stops, 40), [0.0, 10.0, 30.0]);
    });
    test('foilPatternCycle — ciclo canónico por paleta (paridad de tamaño app)', () {
      expect(foilPatternCycle('spectrum'), 45);
      expect(foilPatternCycle('midnight'), 45);
      expect(foilPatternCycle('oilslick'), 40);
      expect(foilPatternCycle('sunset'), 48);
      expect(foilPatternCycle('mint'), 48);
      expect(foilPatternCycle('aurora'), isNull); // cónica: gira, no cicla
      expect(foilPatternCycle('nope'), foilCustomCyclePct); // custom/desconocida = 45
    });
    test('QA tilt: lienzo sobredimensionado + ciclo compensado (espejo TS)', () {
      expect(foilMultibandPan.sizePct, 200);
      expect(foilMultibandCycle(28), 14.0);
      expect(foilMultibandCycle(45), 22.5);
    });
  });

  // KRO-257 — salvaguardas anti-"lavado" (espejo del corpus TS).
  group('KRO-257 — salvaguardas anti-"lavado"', () {
    test('foilArtVoidSubstrate es un gris CLARO NEUTRO (calibrado 1:1 vs Studio)', () {
      final hex = foilArtVoidSubstrate;
      expect(RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex), isTrue);
      final r = int.parse(hex.substring(1, 3), radix: 16);
      final g = int.parse(hex.substring(3, 5), radix: 16);
      final b = int.parse(hex.substring(5, 7), radix: 16);
      expect(r, g); // NEUTRO (R=G=B): un cálido como el peach desatura el wash → bug
      expect(g, b);
      final lum = r / 255; // claro pero NO blanco puro (overlay no tiñe) ni oscuro (traga)
      expect(lum, greaterThanOrEqualTo(0.5));
      expect(lum, lessThan(0.98));
    });
    test('foilBandPeriodFrac = ciclo·scale/100; cónicas → null', () {
      expect(foilBandPeriodFrac('spectrum', 300), 1.35);
      expect(foilBandPeriodFrac('oilslick', 100), 0.40);
      expect(foilBandPeriodFrac('aurora', 210), isNull);
    });
    test('periodo visual en rango SANO para TODO pattern·scale del contrato', () {
      final scale = getVisualEffect('iridescent_foil')!
          .config
          .firstWhere((p) => p.key == 'scale');
      for (final p in foilPatternIds.where((p) => foilPatternCycle(p) != null)) {
        for (final s in [scale.min!, scale.defaultValue as num, scale.max!]) {
          final frac = foilBandPeriodFrac(p, (s as num).toDouble())!;
          expect(frac, lessThanOrEqualTo(foilBandPeriodSafe.maxFrac), reason: '$p@$s');
          expect(frac, greaterThanOrEqualTo(foilBandPeriodSafe.minFrac), reason: '$p@$s');
        }
      }
    });
  });
}
