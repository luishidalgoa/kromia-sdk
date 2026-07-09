import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-224 — espejo Dart de `@kromia/core` `border-svg.ts` (commit f1e2ced).
/// Tests ESTRUCTURALES (el canario 1:1 exacto vive en el lado TS): cada estilo ×
/// relleno produce markup blanco-sobre-transparente coherente con el contrato.
void main() {
  const styles = ['classic', 'double', 'sticker', 'emblema', 'tech', 'feston', 'gotico', 'barroco'];

  test("'none' → cadena vacía (sin marco)", () {
    expect(borderSvg('none', 8, 6, 'hueco'), isEmpty);
    expect(borderSvgDocument('none', 8, 6, 'marco'), isEmpty);
  });

  test('catálogos cerrados (espejo de BorderStyle/BorderFill)', () {
    expect(borderStyles, containsAll([...styles, 'none']));
    expect(borderFills, ['hueco', 'borde', 'marco']);
  });

  for (final s in styles) {
    test("estilo '$s': hueco = solo trazos; borde/marco = relleno evenodd", () {
      final hueco = borderSvg(s, 8, 6, 'hueco');
      expect(hueco, isNotEmpty);
      expect(hueco, contains('stroke="#fff"'));
      expect(hueco, isNot(contains('fill-rule')), reason: 'hueco no rellena banda');

      for (final fill in ['borde', 'marco']) {
        final out = borderSvg(s, 8, 6, fill);
        expect(out, contains('fill-rule="evenodd"'), reason: '$s/$fill rellena con ventana');
        expect(out, contains('fill="#fff"'));
      }
    });
  }

  test("'marco' rellena hasta el borde de la carta (path desde el origen); 'borde' no",
      () {
    // El passe-partout parte del rect exterior de la CARTA (x=0 → 'M<r>.0,0.0');
    // la banda ('borde') parte del margen (m=6 → no toca y=0).
    final marco = borderSvg('sticker', 8, 6, 'marco');
    final borde = borderSvg('sticker', 8, 6, 'borde');
    expect(marco, contains(',0.0 '));
    expect(borde, isNot(contains(',0.0 ')));
  });

  test('radius (KRO-225) cambia el redondeado del marco', () {
    final r20 = borderSvg('double', 8, 6, 'hueco');
    final r40 = borderSvg('double', 8, 6, 'hueco', radius: 40);
    expect(r20, isNot(equals(r40)));
  });

  test('borderSvgDocument envuelve en <svg viewBox 300×420>', () {
    final doc = borderSvgDocument('classic', 8, 6, 'hueco');
    expect(doc, startsWith('<svg '));
    expect(doc, contains('viewBox="0 0 300 420"'));
    expect(doc, endsWith('</svg>'));
  });

  test('barroco: ornamentos (volutas <g transform> + gemas) presentes', () {
    final out = borderSvg('barroco', 12, 6, 'hueco');
    expect(out, contains('<g transform='));
    expect(out, contains('<circle'));
    expect(out, contains('<line'));
  });

  test('gotico: pips <circle> presentes en todos los rellenos', () {
    for (final fill in ['hueco', 'borde', 'marco']) {
      expect(borderSvg('gotico', 10, 6, fill), contains('<circle'));
    }
  });
}
