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
}
