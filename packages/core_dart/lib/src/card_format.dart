/// `card_format.dart` — KRO-78. Formato de carta (aspect+size) + derivación del
/// nº de columnas de la rejilla de mini-cards. Espejo de la parte de cardFormat /
/// miniRefGridColumns de `options.ts`. Puro: el render React y Flutter derivan
/// EXACTAMENTE las mismas columnas (anti-drift).
library;

import 'dart:math' as math;

const List<String> cardAspects = ['2:3', '3:2', '1:1', '16:9'];
const List<String> cardSizes = ['mini', 'standard', 'large', 'poster'];

/// KRO-225 — niveles de redondeo de esquina de la carta (enum cerrado). Espejo de
/// `CARD_CORNER_RADII` (`options.ts`).
const List<String> cardCornerRadii = ['none', 'sm', 'md', 'lg', 'xl'];

/// KRO-225 — redondeo por nivel. `css` = `border-radius` del contenedor de la
/// carta en el render, en **PORCENTAJE** (escala con el tamaño → igual de redonda
/// en grid/focus/preview). `svg` = radio en el espacio 300×420 del `borderSvg`
/// (≈ css% × 3, porque el lienzo SVG es 300 de ancho). Espejo 1:1 de
/// `CARD_CORNER_RADIUS_PX` (`options.ts`). Coherencia POR CONSTRUCCIÓN:
/// `svg/300 == css%` exacto → el render deriva UN solo radio y lo usa para el clip
/// de la carta Y el radius del marco, así nunca divergen (KRO-225).
const Map<String, ({String css, double svg})> cardCornerRadiusPx = {
  'none': (css: '0', svg: 0),
  'sm': (css: '4%', svg: 12),
  'md': (css: '8%', svg: 24),
  'lg': (css: '16%', svg: 48),
  'xl': (css: '28%', svg: 84),
};

/// Resuelve el redondeo del formato, con fallback a 'md' si no se declaró
/// (o si trae un valor fuera del enum). Espejo de `cardCornerRadiusPx(fmt)`.
({String css, double svg}) cardCornerRadiusOf(CardFormat? fmt) {
  final key = fmt?.cornerRadius;
  return cardCornerRadiusPx[key] ?? cardCornerRadiusPx['md']!;
}

/// Formato persistido de la carta del álbum.
class CardFormat {
  final String aspect; // CardAspect
  final String size; // CardSize

  /// KRO-225 — redondeo de esquinas (`cardCornerRadii`). Opcional (aditivo):
  /// ausente ⇒ 'md'. Resuélvelo con `cardCornerRadiusOf`. Ignorado cuando la
  /// silueta ≠ 'standard' (esquinas horneadas en el path).
  final String? cornerRadius;

  /// KRO-230/232 — SILUETA del recorte: id del catálogo `cardShapes` o `'custom'`.
  /// Ausente ⇒ 'standard' (rect redondeado). Con silueta ≠ standard, cornerRadius
  /// se ignora (esquinas horneadas en el path). Ver `card_shapes.dart`.
  final String? shape;

  /// KRO-230 fase 3 — path de la silueta CUSTOM (solo con `shape:'custom'`):
  /// gramática M/L/C/Q/Z, coords 0..1, subpath cerrado (ver `validateShapePath`).
  final String? shapePath;

  /// KRO-230 — TAMAÑO de la silueta: escala uniforme [0.5, 1] sobre el centro
  /// (1 = llena la carta; <1 deja margen). Ausente ⇒ 1 (`clampShapeScale`).
  final double? shapeScale;

  const CardFormat({
    required this.aspect,
    required this.size,
    this.cornerRadius,
    this.shape,
    this.shapePath,
    this.shapeScale,
  });

  factory CardFormat.fromJson(Map<String, dynamic> json) => CardFormat(
        aspect: (json['aspect'] as String?) ?? '2:3',
        size: (json['size'] as String?) ?? 'standard',
        cornerRadius: json['cornerRadius'] as String?,
        shape: json['shape'] as String?,
        shapePath: json['shapePath'] as String?,
        shapeScale: (json['shapeScale'] as num?)?.toDouble(),
      );
}

const CardFormat defaultCardFormat = CardFormat(aspect: '2:3', size: 'standard');

/// Razón W/H del aspect.
num aspectToRatio(String a) {
  final parts = a.split(':');
  final w = parts.isNotEmpty ? (num.tryParse(parts[0]) ?? 1) : 1;
  final h = parts.length > 1 ? (num.tryParse(parts[1]) ?? 1) : 1;
  return h == 0 ? 1 : w / h;
}

/// Multiplicador de columnas por tamaño físico (cards más grandes → menos columnas).
const Map<String, double> miniRefGridSizeMultiplier = {
  'mini': 1.3,
  'standard': 1.0,
  'large': 0.7,
  'poster': 0.4,
};

/// Nº de columnas de la rejilla de mini-cards, derivado del cardFormat. Clamp 1-6.
///   baseCols = aspect panorámico (ratio > 1.2) ? 2 : 3
///   cols     = round(baseCols × multiplicador-por-size)
int miniRefGridColumns(CardFormat cardFormat) {
  final isWide = aspectToRatio(cardFormat.aspect) > 1.2;
  final baseCols = isWide ? 2 : 3;
  final mult = miniRefGridSizeMultiplier[cardFormat.size] ?? 1.0;
  return math.max(1, math.min(6, (baseCols * mult).round()));
}
