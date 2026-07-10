/// `foil_recipe.dart` — KRO-202/KRO-224. Receta DATA del foil iridiscente.
/// Espejo Dart PURO de `@kromia/core` `foil-recipe.ts` (commit `265387a`):
/// mantener 1:1 con el TS a mano (render-only, sin bump de protocolVersion).
///
/// Los 6 `pattern` del `iridescent_foil` son DATOS ESTRUCTURADOS (ángulo + stops
/// de color), NO strings CSS: cada host construye su gradiente nativo desde los
/// MISMOS stops → el color del foil es idéntico en Studio (CSS) y Flutter
/// (`LinearGradient`/`SweepGradient`) sin copiar strings. `foilPatternCss` (web)
/// NO se espeja — Flutter construye el gradiente desde `foilPatterns[pattern]`.
library;

import 'dart:ui' show Color;

/// Un stop del gradiente del foil. [pos] en % (0–100).
class FoilStop {
  final Color color;
  final double pos;
  const FoilStop(this.color, this.pos);
}

/// Un pattern del foil: lineal-repetido (con [angleDeg] + [stops] posicionados) o
/// cónico (con [fromDeg] + [colors] equiespaciados, sin posiciones).
class FoilPattern {
  /// 'repeating-linear' | 'conic'.
  final String kind;
  final double angleDeg; // repeating-linear
  final List<FoilStop> stops; // repeating-linear
  final double fromDeg; // conic
  final List<Color> colors; // conic

  const FoilPattern.repeatingLinear(this.angleDeg, this.stops)
      : kind = 'repeating-linear',
        fromDeg = 0,
        colors = const [];

  const FoilPattern.conic(this.fromDeg, this.colors)
      : kind = 'conic',
        angleDeg = 0,
        stops = const [];
}

// Hex #rrggbb → Color opaco (los stops del mockup son opacos; la opacidad la
// aplica la capa del efecto).
Color _c(int rgb) => Color(0xFF000000 | rgb);

/// Los 6 patterns del `iridescent_foil` (stops EXACTOS, calcados del mockup).
/// El enum `pattern` del efecto = estas keys.
final Map<String, FoilPattern> foilPatterns = {
  'spectrum': FoilPattern.repeatingLinear(115, [
    FoilStop(_c(0xff5fa2), 0), FoilStop(_c(0xffd166), 9), FoilStop(_c(0x6efea0), 18),
    FoilStop(_c(0x57d2ff), 27), FoilStop(_c(0xb985ff), 36), FoilStop(_c(0xff5fa2), 45),
  ]),
  'oilslick': FoilPattern.repeatingLinear(120, [
    FoilStop(_c(0x3a6df0), 0), FoilStop(_c(0x9b5cff), 10), FoilStop(_c(0xff5fa2), 20),
    FoilStop(_c(0x27c4b0), 30), FoilStop(_c(0x3a6df0), 40),
  ]),
  'sunset': FoilPattern.repeatingLinear(110, [
    FoilStop(_c(0xff7e5f), 0), FoilStop(_c(0xffd166), 12), FoilStop(_c(0xff5fa2), 24),
    FoilStop(_c(0xb985ff), 36), FoilStop(_c(0xff7e5f), 48),
  ]),
  'mint': FoilPattern.repeatingLinear(115, [
    FoilStop(_c(0x6efea0), 0), FoilStop(_c(0x57d2ff), 12), FoilStop(_c(0xb4ddd8), 24),
    FoilStop(_c(0xa0ffe0), 36), FoilStop(_c(0x6efea0), 48),
  ]),
  'aurora': FoilPattern.conic(0, [
    _c(0x57d2ff), _c(0x6efea0), _c(0xffd166), _c(0xff5fa2), _c(0xb985ff), _c(0x57d2ff),
  ]),
  'midnight': FoilPattern.repeatingLinear(120, [
    FoilStop(_c(0x3a5fd0), 0), FoilStop(_c(0x7a4ad0), 11), FoilStop(_c(0x2aa088), 22),
    FoilStop(_c(0x4a6ad0), 33), FoilStop(_c(0x3a5fd0), 45),
  ]),
};

/// Ids de los patterns disponibles (orden de declaración).
List<String> get foilPatternIds => foilPatterns.keys.toList(growable: false);

/// KRO-244 — TINTES SÓLIDOS del marco ornamental del `iridescent_foil` (opción
/// `border_color`). Espejo 1:1 de `FOIL_BORDER_SOLID` (`foil-recipe.ts`, `f5e0c65`):
/// `silver` se OSCURECIÓ (antes casi blanco, se confundía con `none`). El render
/// tiñe el SVG blanco del borde con `srcIn`. FUENTE ÚNICA — no hardcodear en el host.
final Map<String, Color> foilBorderSolid = {
  'none': _c(0xffffff),
  'gold': _c(0xf5c542),
  'silver': _c(0xaeb9c7),
};

/// KRO-244 — TINTES "fondo de carta" del marco (degradado vertical top→bottom).
/// Espejo 1:1 de `FOIL_CARD_BG` (`foil-recipe.ts`, `f5e0c65`): RE-SATURADOS respecto
/// a los casi-negros previos (los 4 se veían iguales). El render los usa como
/// gradiente lineal (ShaderMask srcIn sobre el SVG del borde). FUENTE ÚNICA.
final Map<String, ({Color top, Color bottom})> foilCardBg = {
  'forest': (top: _c(0x2e7d4f), bottom: _c(0x0b2b1a)),
  'obsidian': (top: _c(0x41444d), bottom: _c(0x0a0a0d)),
  'plum': (top: _c(0x6d3fa8), bottom: _c(0x22103d)),
  'steel': (top: _c(0x3f6d99), bottom: _c(0x101f30)),
};

/// Opacidad de la capa del efecto `holographic_effect` según su `intensity`
/// (preset cerrado). Compartida cross-platform (espejo de `holographicOpacity`).
double holographicOpacity(Object? intensity) {
  switch (intensity) {
    case 'low':
      return 0.18;
    case 'high':
      return 0.48;
    default:
      return 0.32; // medium
  }
}
