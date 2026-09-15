import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-232 — espejo de `marcas-dentro-de-la-silueta-kro232.test.ts`: las marcas
/// de la rejilla (número, «la tienes», favorito) caben ENTERAS dentro de la
/// silueta, metidas lo justo desde su esquina. La cuenta vive en el SDK para que
/// Studio y la app pongan las marcas en el mismo sitio.
///
/// `dentroPorMuestreo` es el mismo juez independiente y tonto que en TS: una
/// rejilla densa de puntos de la caja contra la silueta. El test no afirma «el
/// helper dice que cabe», sino «en ese sitio la marca queda dentro, y un paso
/// antes no».
const _escudo =
    'M 0.5 0 L 1 0.12 L 1 0.55 Q 1 0.85 0.5 1 Q 0 0.85 0 0.55 L 0 0.12 Z';
const _rectangulo = 'M 0 0 L 1 0 L 1 1 L 0 1 Z';
const _rombo = 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z';

// Tamaño aproximado del número en la rejilla: ~16 % del ancho y ~7 % del alto.
const _marca = (w: 0.16, h: 0.07);

typedef _P = (double, double);

/// Polígono de referencia, aplanando las Q con muchos pasos.
List<_P> _poligono(String path) {
  final t = path.trim().split(RegExp(r'\s+'));
  final pts = <_P>[];
  var i = 0;
  var cur = (0.0, 0.0);
  double n() => double.parse(t[i++]);
  while (i < t.length) {
    final c = t[i++];
    if (c == 'M' || c == 'L') {
      cur = (n(), n());
      pts.add(cur);
    } else if (c == 'Q') {
      final cx = n(), cy = n(), x = n(), y = n();
      for (var k = 1; k <= 200; k++) {
        final u = k / 200, a = 1 - u;
        pts.add((a * a * cur.$1 + 2 * a * u * cx + u * u * x,
            a * a * cur.$2 + 2 * a * u * cy + u * u * y));
      }
      cur = (x, y);
    }
  }
  return pts;
}

bool _puntoDentro(_P p, List<_P> poly) {
  var d = false;
  for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    final (xi, yi) = poly[a];
    final (xj, yj) = poly[b];
    if ((yi > p.$2) != (yj > p.$2) &&
        p.$1 < (xj - xi) * (p.$2 - yi) / (yj - yi) + xi) {
      d = !d;
    }
  }
  return d;
}

bool _dentroPorMuestreo(String path, String corner, double s) {
  final poly = _poligono(path);
  final x = corner.endsWith('left') ? s : 1 - s - _marca.w;
  final y = corner.startsWith('top') ? s : 1 - s - _marca.h;
  for (var i = 0; i <= 40; i++) {
    for (var j = 0; j <= 40; j++) {
      if (!_puntoDentro((x + _marca.w * i / 40, y + _marca.h * j / 40), poly)) {
        return false;
      }
    }
  }
  return true;
}

double? _inset(String path, String corner,
        {num? scale, ({double w, double h}) box = _marca}) =>
    cardShapeBadgeInset(
        shape: 'custom', shapePath: path, shapeScale: scale, corner: corner, box: box);

void main() {
  group('KRO-232 · cuánto meter una marca para que quepa dentro de la silueta', () {
    for (final corner in ['top-left', 'top-right', 'bottom-left']) {
      test('escudo, $corner: en el sitio calculado queda dentro, y un paso antes no',
          () {
        final s = _inset(_escudo, corner);
        expect(s, isNotNull);
        expect(_dentroPorMuestreo(_escudo, corner, s!), isTrue);
        // Mínimo: lo JUSTO para caber, no un margen generoso.
        expect(_dentroPorMuestreo(_escudo, corner, s - 0.01), isFalse);
      });
    }

    test('el escudo es simétrico: izquierda y derecha salen igual', () {
      expect(_inset(_escudo, 'top-left'), closeTo(_inset(_escudo, 'top-right')!, 1e-3));
    });

    test('cada esquina se calcula por su lado: una forma cortada solo arriba a la derecha',
        () {
      const cuna = 'M 0 0 L 0.7 0 L 1 0.3 L 1 1 L 0 1 Z';
      expect(_inset(cuna, 'top-left'), 0);
      final derecha = _inset(cuna, 'top-right');
      expect(derecha, greaterThan(0));
      expect(_dentroPorMuestreo(cuna, 'top-right', derecha!), isTrue);
    });

    test('una silueta que llena la caja no mueve nada', () {
      expect(_inset(_rectangulo, 'top-left'), 0);
    });

    test('achicar la silueta (shapeScale) empuja la marca hacia dentro', () {
      final lleno = _inset(_escudo, 'top-left')!;
      final pequeno = _inset(_escudo, 'top-left', scale: 0.7)!;
      expect(pequeno, greaterThan(lleno));
    });

    test('si no cabe en ningún sitio razonable → null, sin inventar posición', () {
      expect(_inset(_rombo, 'top-left', box: (w: 0.6, h: 0.3)), isNull);
    });

    test('una marca que solo cabría pasado el tope → null, no se lleva al centro', () {
      expect(cardShapeBadgeInsetMax, lessThan(0.375));
      expect(_inset(_rombo, 'top-left', scale: 0.5), isNull);
    });

    test('una muesca estrecha que entra entre dos esquinas de la marca también cuenta',
        () {
      const muesca = 'M 0 0 L 0.06 0 L 0.08 0.2 L 0.1 0 L 1 0 L 1 1 L 0 1 Z';
      final s = _inset(muesca, 'top-left');
      expect(s, greaterThan(0));
      expect(_dentroPorMuestreo(muesca, 'top-left', s!), isTrue);
    });

    group('controles — donde no hay silueta', () {
      test('carta estándar (sin forma) → null: el host sigue con su regla del redondeo',
          () {
        expect(cardShapeBadgeInset(shape: 'standard', corner: 'top-left', box: _marca),
            isNull);
        expect(cardShapeBadgeInset(corner: 'top-left', box: _marca), isNull);
      });

      test('silueta custom inválida → null (cae a estándar, como el recorte)', () {
        expect(_inset('M 0 0 X', 'top-left'), isNull);
      });
    });
  });
}
