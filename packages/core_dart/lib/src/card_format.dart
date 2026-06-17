/// `card_format.dart` — KRO-78. Formato de carta (aspect+size) + derivación del
/// nº de columnas de la rejilla de mini-cards. Espejo de la parte de cardFormat /
/// miniRefGridColumns de `options.ts`. Puro: el render React y Flutter derivan
/// EXACTAMENTE las mismas columnas (anti-drift).
library;

import 'dart:math' as math;

const List<String> cardAspects = ['2:3', '3:2', '1:1', '16:9'];
const List<String> cardSizes = ['mini', 'standard', 'large', 'poster'];

/// Formato persistido de la carta del álbum.
class CardFormat {
  final String aspect; // CardAspect
  final String size; // CardSize
  const CardFormat({required this.aspect, required this.size});

  factory CardFormat.fromJson(Map<String, dynamic> json) => CardFormat(
        aspect: (json['aspect'] as String?) ?? '2:3',
        size: (json['size'] as String?) ?? 'standard',
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
