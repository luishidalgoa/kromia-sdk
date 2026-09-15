/// `card_shapes.dart` — KRO-230/232. Siluetas de carta (la FORMA del recorte del
/// cromo). Espejo 1:1 de `card-shapes.ts`. DATA del cardSchema (como cornerRadius):
/// NO entra al `.json` del KRP, NO bumpea PROTOCOL_VERSION.
///
/// Protocolo de silueta (contrato de render cross-platform): un ÚNICO SVG path en
/// espacio normalizado `0..1 × 0..1` (viewBox `0 0 1 1`, Y hacia abajo, sin holes,
/// nonzero). Gramática canónica pequeña para parsear sin motor SVG:
///   `path := M x y (L x y | C x1 y1 x2 y2 x y | Q x1 y1 x y)+ Z`
/// — comandos ABSOLUTOS en mayúscula, coords en [0,1], un subpath cerrado con Z.
///
/// `shape` ausente/'standard' ⇒ sin clip (rect redondeado por cornerRadius); con
/// silueta ≠ standard, las esquinas van HORNEADAS en el path y cornerRadius se
/// ignora. La silueta se ESTIRA con el aspect (0..1 en ambos ejes, intencional).
library;

import 'dart:math' as math;

/// Definición de una silueta del catálogo.
class CardShapeDefinition {
  final String id;
  final String label;
  final String tooltip;

  /// SVG path en espacio 0..1, o `null` = sin clip (rect redondeado estándar).
  final String? path;

  const CardShapeDefinition({
    required this.id,
    required this.label,
    required this.tooltip,
    this.path,
  });
}

/// Catálogo DELIBERADAMENTE mínimo: NO hay siluetas de ejemplo — el creador aporta
/// la suya (importar SVG / vectorizar imagen, Studio-only). `'standard'` es la
/// única entrada: la carta clásica (y sirve para DESELECCIONAR una silueta).
const List<CardShapeDefinition> cardShapes = [
  CardShapeDefinition(
    id: 'standard',
    label: 'Estándar',
    tooltip: 'Rectángulo redondeado clásico (el redondeo lo controla "Redondeado")',
    path: null,
  ),
];

/// Ids válidos del catálogo.
List<String> get cardShapeIds => cardShapes.map((s) => s.id).toList(growable: false);

const String defaultCardShape = 'standard';

/// silueta PERSONALIZADA del creador (`shape:'custom'` + `shapePath`).
const String customCardShape = 'custom';

/// Longitud máxima defensiva del path custom persistido.
const int maxShapePathLength = 6000;

/// Definición por id, con fallback a estándar si el id no existe.
CardShapeDefinition cardShapeById(String? id) =>
    cardShapes.firstWhere((s) => s.id == id, orElse: () => cardShapes[0]);

/// Aridad (nº de coords) por comando.
const Map<String, int> _arity = {'M': 2, 'L': 2, 'Q': 4, 'C': 6};

/// Valida un `shapePath` custom contra la gramática del protocolo. Devuelve `null`
/// si es válido, o el motivo (es-ES) si no. Espejo 1:1 de `validateShapePath`.
String? validateShapePath(Object? path) {
  if (path is! String || path.trim().isEmpty) return 'El path está vacío.';
  if (path.length > maxShapePathLength) {
    return 'El path es demasiado largo (simplifica la forma).';
  }
  if (RegExp(r'[^MLCQZ0-9.\-\s]').hasMatch(path)) {
    return 'Solo se admiten comandos M/L/C/Q/Z absolutos y números.';
  }
  final tokens = path.trim().split(RegExp(r'\s+'));
  var i = 0, segs = 0, ms = 0;
  var closed = false;
  while (i < tokens.length) {
    final cmd = tokens[i++];
    if (cmd == 'Z') {
      closed = true;
      if (i != tokens.length) {
        return 'Z debe ser el último comando (un solo subpath, sin holes).';
      }
      break;
    }
    final n = _arity[cmd];
    if (n == null) return 'Comando no admitido: "$cmd".';
    if (cmd == 'M' && ++ms > 1) {
      return 'Solo se admite un subpath (una única M, sin holes).';
    }
    if (cmd != 'M' && ms == 0) return 'El path debe empezar por M.';
    for (var k = 0; k < n; k++) {
      final v = i < tokens.length ? double.tryParse(tokens[i++]) : null;
      if (v == null || !v.isFinite) return 'Coordenada no numérica.';
      if (v < -0.002 || v > 1.002) {
        return 'Las coordenadas deben estar normalizadas en 0..1.';
      }
    }
    if (cmd != 'M') segs++;
  }
  if (!closed) return 'El path debe cerrarse con Z.';
  // 2 segmentos + el cierre implícito de Z = triángulo (la forma mínima).
  if (segs < 2) return 'La forma necesita al menos 3 puntos.';
  return null;
}

/// Path normalizado de la silueta del formato, o `null` si la carta es el rect
/// redondeado estándar. Una silueta custom inválida cae a estándar (defensivo).
/// Espejo de `cardShapePath`.
String? cardShapePath({String? shape, String? shapePath}) {
  if (shape == customCardShape) {
    return (shapePath != null && validateShapePath(shapePath) == null) ? shapePath : null;
  }
  return cardShapeById(shape).path;
}

// ── TAMAÑO de la silueta (escala uniforme sobre el centro) ────────────────────

/// Escala por defecto: la silueta llena la caja de la carta.
const double defaultShapeScale = 1;

/// Escala mínima: la silueta a la mitad, centrada (deja margen).
const double minShapeScale = 0.5;

/// Normaliza `shapeScale` al rango [minShapeScale, 1]; ausente/no-num ⇒ 1.
double clampShapeScale(num? scale) {
  if (scale == null || !scale.toDouble().isFinite) return defaultShapeScale;
  return math.min(defaultShapeScale, math.max(minShapeScale, scale.toDouble()));
}

/// Escala un path del protocolo alrededor de su CENTRO (0.5,0.5) por `scale`,
/// manteniéndolo en 0..1: `v' = 0.5 + (v − 0.5)·s`. Espejo de `scaleShapePath`.
/// (El render de Flutter puede, alternativamente, escalar el `Path` geométrico
/// sobre su centro — mismo resultado.)
String scaleShapePath(String path, num scale) {
  final s = clampShapeScale(scale);
  if (s == defaultShapeScale) return path;
  return path.replaceAllMapped(RegExp(r'-?\d*\.?\d+'), (m) {
    final v = 0.5 + (double.parse(m[0]!) - 0.5) * s;
    final r = (v * 10000).round() / 10000;
    return r == r.truncateToDouble() ? r.toInt().toString() : r.toString();
  });
}

// ── KRO-232 — MARCAS DENTRO DE LA SILUETA ─────────────────────────────────────

/// Hasta dónde se puede meter una marca hacia dentro buscando sitio: un 30 % de
/// la carta. Más allá deja de estar «en la esquina», así que es mejor decir que
/// no cabe (`null`) y que el host decida. Espejo de `CARD_SHAPE_BADGE_INSET_MAX`.
const double cardShapeBadgeInsetMax = 0.3;

/// Resolución de la búsqueda (0,5 % de la carta). Espejo de `PASO_INSET`.
const double _pasoInset = 0.005;

/// Tramos al aplanar cada curva. Espejo de `PASOS_CURVA`.
const int _pasosCurva = 24;

typedef _Punto = (double, double);

/// Aplana un path VÁLIDO del protocolo (M/L/Q/C/Z) a un polígono. Espejo de
/// `aplanarPath`.
List<_Punto> _aplanarPath(String path) {
  final t = path.trim().split(RegExp(r'\s+'));
  final pts = <_Punto>[];
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
      for (var k = 1; k <= _pasosCurva; k++) {
        final u = k / _pasosCurva, a = 1 - u;
        pts.add((a * a * cur.$1 + 2 * a * u * cx + u * u * x,
            a * a * cur.$2 + 2 * a * u * cy + u * u * y));
      }
      cur = (x, y);
    } else if (c == 'C') {
      final x1 = n(), y1 = n(), x2 = n(), y2 = n(), x = n(), y = n();
      for (var k = 1; k <= _pasosCurva; k++) {
        final u = k / _pasosCurva, a = 1 - u;
        pts.add((
          a * a * a * cur.$1 + 3 * a * a * u * x1 + 3 * a * u * u * x2 + u * u * u * x,
          a * a * a * cur.$2 + 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u * y,
        ));
      }
      cur = (x, y);
    }
    // Z: el polígono se cierra solo (el último vértice enlaza con el primero).
  }
  return pts;
}

bool _puntoDentro(_Punto p, List<_Punto> poly) {
  var dentro = false;
  for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    final (xi, yi) = poly[a];
    final (xj, yj) = poly[b];
    if ((yi > p.$2) != (yj > p.$2) &&
        p.$1 < ((xj - xi) * (p.$2 - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/// ¿Se cortan los segmentos pq y rs (en su interior)? Espejo de `seCortan`.
bool _seCortan(_Punto p, _Punto q, _Punto r, _Punto s) {
  double o(_Punto a, _Punto b, _Punto c) =>
      (b.$1 - a.$1) * (c.$2 - a.$2) - (b.$2 - a.$2) * (c.$1 - a.$1);
  final d1 = o(p, q, r), d2 = o(p, q, s), d3 = o(r, s, p), d4 = o(r, s, q);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/// Una caja cabe ENTERA si sus cuatro esquinas están dentro y ningún borde de la
/// silueta la atraviesa (una muesca estrecha entre dos esquinas). Espejo de
/// `cajaDentro`.
bool _cajaDentro(double x, double y, double w, double h, List<_Punto> poly) {
  final esquinas = <_Punto>[(x, y), (x + w, y), (x + w, y + h), (x, y + h)];
  if (!esquinas.every((e) => _puntoDentro(e, poly))) return false;
  for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    for (var k = 0; k < 4; k++) {
      if (_seCortan(poly[b], poly[a], esquinas[k], esquinas[(k + 1) % 4])) {
        return false;
      }
    }
  }
  return true;
}

/// Cuánto hay que meter una marca hacia dentro, desde su [corner], para que
/// quepa ENTERA en la silueta de la carta. Espejo 1:1 de `cardShapeBadgeInset`.
///
/// Todo en el espacio normalizado de la carta (0..1 en cada eje): [box] es el
/// tamaño de la marca como fracción del ancho (`w`) y del alto (`h`), y lo que
/// devuelve es la distancia MÍNIMA desde los dos bordes de esa esquina, también
/// en fracción (del ancho en horizontal y del alto en vertical).
///
/// - Sin silueta (estándar, o una custom inválida que cae a estándar) → `null`:
///   el host sigue con su regla del redondeo de esquinas.
/// - Si no cabe antes de [cardShapeBadgeInsetMax] → `null`, en vez de llevar la
///   marca al centro de la carta.
///
/// [corner]: `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`.
double? cardShapeBadgeInset({
  String? shape,
  String? shapePath,
  num? shapeScale,
  required String corner,
  required ({double w, double h}) box,
}) {
  final base = cardShapePath(shape: shape, shapePath: shapePath);
  if (base == null) return null;
  final poly = _aplanarPath(scaleShapePath(base, shapeScale ?? defaultShapeScale));
  final izquierda = corner.endsWith('left');
  final arriba = corner.startsWith('top');
  for (var paso = 0; paso * _pasoInset <= cardShapeBadgeInsetMax + 1e-9; paso++) {
    final s = paso * _pasoInset;
    final x = izquierda ? s : 1 - s - box.w;
    final y = arriba ? s : 1 - s - box.h;
    if (_cajaDentro(x, y, box.w, box.h, poly)) return (s * 1000).round() / 1000;
  }
  return null;
}
