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
