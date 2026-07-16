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

/// KRO-247 — paleta "Ninguna": el foil NO pinta gradiente de color. Id reservado
/// del enum `pattern` (no vive en [foilPatterns]: no hay stops de color). Espejo
/// de `FOIL_PATTERN_NONE` (`foil-recipe.ts`, KRP 5.4.0).
const String foilPatternNone = 'none';

/// KRO-247 — RECETA de la lámina NEUTRA (`pattern: 'none'`): sin gradiente de
/// color, el REFLEJO (sheen) usa este barrido blanco diagonal ÚNICO (NO
/// repeating) en vez del gradiente de la paleta; la capa foil de color NO se
/// pinta (hue/brightness/contrast/scale/blend/geometry/warp no aplican). Glare,
/// grano y borde no cambian. Espejo 1:1 de `FOIL_NEUTRAL_SHEEN`: Flutter
/// construye su `LinearGradient` con blanco a estas alphas (0→0.9→0) y hereda
/// el vaivén de rejilla / paneo por tilt. Spec: `iridescent-foil-render-spec.md`
/// §1-bis.
const ({double angleDeg, List<({double alpha, double pos})> stops})
    foilNeutralSheen = (
  angleDeg: 115,
  stops: [(alpha: 0.0, pos: 0.0), (alpha: 0.9, pos: 50.0), (alpha: 0.0, pos: 100.0)],
);

/// KRO-244 — parsea la paleta PERSONALIZADA del foil (`pattern_hex`): 2–4 hex
/// `#RRGGBB` separados por coma. `null` si no es válida (→ se usa `pattern`).
/// Espejo 1:1 de `parseFoilPatternHex` (foil-recipe.ts): mismo criterio que
/// `border_color_hex` (si es válida MANDA sobre `pattern`).
List<String>? parseFoilPatternHex(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  final parts =
      raw.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  if (parts.length < 2 || parts.length > 4) return null;
  final re = RegExp(r'^#[0-9a-fA-F]{6}$');
  return parts.every(re.hasMatch) ? parts : null;
}

// #RRGGBB → Color opaco (los stops del foil son opacos; la opacidad la aplica la
// capa del efecto).
Color _hex(String h) => Color(0xFF000000 | int.parse(h.substring(1), radix: 16));

/// KRO-244 — `FoilPattern` de una paleta PERSONALIZADA (2–4 colores, ya validados
/// por [parseFoilPatternHex]). Mismo CICLO que spectrum (banda cada 45%), colores
/// equiespaciados (`k·45/n %`) y el PRIMERO repetido al cierre (45%) → repetición
/// sin costura. Espejo (como DATA) de `foilCustomPatternCss`: Flutter construye su
/// `LinearGradient` con estos MISMOS stops. [angleDeg] = ángulo NATIVO (115, igual
/// que spectrum); el `angle` del efecto se SUMA en el render, no aquí.
FoilPattern foilCustomPattern(List<String> hexColors, {double angleDeg = 115}) {
  const cycle = 45.0;
  final n = hexColors.length;
  final step = cycle / n;
  final stops = <FoilStop>[
    for (var k = 0; k < n; k++) FoilStop(_hex(hexColors[k]), k * step),
    FoilStop(_hex(hexColors[0]), cycle),
  ];
  return FoilPattern.repeatingLinear(angleDeg, stops);
}

/// Ángulo NATIVO de un pattern (linear = `angleDeg`; conic = `fromDeg`; paleta
/// personalizada / desconocido = 115°, como spectrum). Espejo de
/// `foilPatternBaseAngle` (`foil-recipe.ts`, `6cb2c85`).
double foilPatternBaseAngle(String pattern) {
  final p = foilPatterns[pattern];
  return p == null ? 115 : (p.kind == 'conic' ? p.fromDeg : p.angleDeg);
}

/// KRO-244 — ORIENTACIÓN: ángulo EFECTIVO de las bandas = ángulo nativo del pattern
/// + [rotate] (param `angle` del efecto). Espejo de `foilEffectiveAngle`.
double foilEffectiveAngle(String pattern, [double rotate = 0]) =>
    foilPatternBaseAngle(pattern) + rotate;

/// KRO-244 — RECETA de la GEOMETRÍA ORGÁNICA del foil (`geometry: 'organico'`):
/// las bandas RECTAS se curvan por un desplazamiento de RUIDO FRACTAL → difracción
/// tipo lámina holográfica real. Espejo 1:1 de `FOIL_ORGANIC_WARP` (`6cb2c85`),
/// fuente única cross-platform de los parámetros del ruido.
///
/// - Studio: filtro SVG `feTurbulence`+`feDisplacementMap` sobre foil y sheen
///   (glare/grano/borde NO se deforman).
/// - Flutter: fragment shader — `uv' = uv + (fbm(uv·baseFrequency, octaves)−0.5)
///   · foilWarpDisplacement(warp)` antes de muestrear el gradiente.
///
/// ⚠️ El algoritmo de ruido DIFIERE (Perlin de SVG vs fbm del shader) → NO es
/// bit-idéntico; con los MISMOS parámetros el LOOK converge (bandas anchas curvadas
/// suaves, no zigzag). `seed` fijo = estable entre cartas.
const ({
  double baseFrequencyX,
  double baseFrequencyY,
  int octaves,
  int seed,
  double maxDisplacement,
  double overscan,
}) foilOrganicWarp = (
  baseFrequencyX: 0.008,
  baseFrequencyY: 0.014,
  octaves: 2,
  seed: 7,
  maxDisplacement: 90,
  overscan: 0.12,
);

/// Desplazamiento efectivo del warp orgánico dado el param `warp` (0–100) →
/// `scale` del feDisplacementMap (Studio) / factor del shader (Flutter). Espejo
/// de `foilWarpDisplacement`.
double foilWarpDisplacement(num warp) =>
    (warp.clamp(0, 100) / 100) * foilOrganicWarp.maxDisplacement;

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

/// KRO-249 — FILL LIBRE del marco ornamental: el tinte puede ser una textura
/// importada, un sólido, un degradado propio (2–4 hex, ciclo 45%), una paleta
/// del foil como gradiente FIJO, "como el foil" o un fondo-carta oscuro. Espejo
/// 1:1 de `FoilBorderFill` (`foil-recipe.ts`, KRP 5.6.0). [kind] discrimina:
/// 'texture' ([url]) · 'solid' ([color]) · 'custom-gradient' ([colors] hex) ·
/// 'follow-foil' (el gradiente ACTUAL del foil — lo resuelve el host) ·
/// 'palette' ([pattern] de [foilPatterns]) · 'card-bg' ([top]/[bottom]).
class FoilBorderFill {
  final String kind;
  final String? url;
  final Color? color;
  final List<String>? colors;
  final String? pattern;
  final Color? top;
  final Color? bottom;

  const FoilBorderFill._(this.kind,
      {this.url, this.color, this.colors, this.pattern, this.top, this.bottom});
}

/// KRO-249 — resolver PURO de la PRECEDENCIA del fill del marco (espejo 1:1 de
/// `resolveFoilBorderFill` — NO reimplementar la precedencia en el host):
///   1. `border_texture_url` (no vacía)      → texture (manda sobre todo)
///   2. `border_color_hex` (#RRGGBB válido)  → solid
///   3. `border_gradient_hex` (2–4 hex)      → custom-gradient (ciclo 45%,
///      mismo formato que `pattern_hex` — ver [foilCustomPattern])
///   4. `border_color` enum: 'spectrum' → follow-foil · paleta de
///      [foilPatterns] → palette (gradiente fijo) · fondo-carta → card-bg ·
///      resto → solid ([foilBorderSolid]; desconocido = blanco, look base).
FoilBorderFill resolveFoilBorderFill(Map<String, Object?> config) {
  final texture = (config['border_texture_url']?.toString() ?? '').trim();
  if (texture.isNotEmpty) return FoilBorderFill._('texture', url: texture);

  final hex = (config['border_color_hex']?.toString() ?? '').trim();
  if (RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) {
    return FoilBorderFill._('solid', color: _hex(hex));
  }

  final gradient = parseFoilPatternHex(config['border_gradient_hex']?.toString());
  if (gradient != null) {
    return FoilBorderFill._('custom-gradient', colors: gradient);
  }

  final id = config['border_color']?.toString() ?? 'none';
  if (id == 'spectrum') return const FoilBorderFill._('follow-foil');
  if (foilPatterns.containsKey(id)) {
    return FoilBorderFill._('palette', pattern: id);
  }
  final cardBg = foilCardBg[id];
  if (cardBg != null) {
    return FoilBorderFill._('card-bg', top: cardBg.top, bottom: cardBg.bottom);
  }
  return FoilBorderFill._('solid',
      color: foilBorderSolid[id] ?? foilBorderSolid['none']!);
}

// ─────────────────────────────────────────────────────────────────────────────
// KRO-256 — VIDA del iridiscente: movimiento autónomo, destellos de máscara y
// brillo del marco. Espejo 1:1 de las recetas de `foil-recipe.ts` (KRP 5.7.0).
// ─────────────────────────────────────────────────────────────────────────────

/// Valores del param `motion` (contrato). 'auto' = clásico (vaivén en rejilla,
/// sigue la inclinación/giroscopio en focus). 'deriva' = barrido continuo.
/// 'tono' = el matiz cicla en sitio. 'total' = ambos. Espejo de `FOIL_MOTIONS`.
const List<String> foilMotions = ['auto', 'deriva', 'tono', 'total'];

/// Tiempos del movimiento: segundos por ciclo según `shimmer` (0–100; alto =
/// rápido): `sec = baseSec − (shimmer/100)·spanSec`. La deriva usa el MISMO
/// mapeo que el vaivén de rejilla clásico. Espejo de `FOIL_MOTION_TIMING`.
const ({
  ({double baseSec, double spanSec}) sweep,
  ({double baseSec, double spanSec}) hue,
}) foilMotionTiming = (
  sweep: (baseSec: 5.5, spanSec: 3.5), // 5.5s (shimmer 0) → 2.0s (100)
  hue: (baseSec: 14, spanSec: 10), // 14s → 4s por vuelta completa de matiz
);

/// Flags de render derivados del param `motion` (tolerante a valores raros).
/// Espejo de `foilMotionFlags`.
({bool drift, bool hueCycle}) foilMotionFlags(Object? motion) {
  final m = motion?.toString() ?? 'auto';
  return (
    drift: m == 'deriva' || m == 'total',
    hueCycle: m == 'tono' || m == 'total',
  );
}

double _motionSec(num shimmer, ({double baseSec, double spanSec}) t) {
  final raw = shimmer.toDouble();
  final s = (raw.isFinite ? raw : 50.0).clamp(0.0, 100.0) / 100.0;
  return ((t.baseSec - s * t.spanSec) * 100).roundToDouble() / 100;
}

/// Segundos del ciclo de deriva (barrido) para `shimmer` 0–100. Espejo de
/// `foilMotionSweepSec` (mismo redondeo a 2 decimales).
double foilMotionSweepSec(num shimmer) => _motionSec(shimmer, foilMotionTiming.sweep);

/// Segundos de la vuelta completa del ciclo de tono para `shimmer` 0–100.
/// Espejo de `foilMotionHueSec`.
double foilMotionHueSec(num shimmer) => _motionSec(shimmer, foilMotionTiming.hue);

/// Valores del param `mask_sparkle` (contrato). Espejo de `FOIL_MASK_SPARKLES`.
const List<String> foilMaskSparkles = ['no', 'pastel', 'vivo'];

/// KRO-256 — DESTELLOS de la máscara: un campo multicolor de grano fino se
/// pinta TRAS la máscara (misma máscara/layout que el foil) y su matiz cicla en
/// continuo ([foilMotionHueSec]) → cada perforación muestra SU color, distinto
/// del vecino, rotando (look "cosmos"). El campo reusa la paleta 'spectrum'
/// girada [foilMaskSparkle.angleOffsetDeg] sobre su ángulo nativo, con
/// [foilMaskSparkle.sizePct] pequeño (vecinos ⇒ colores distintos). Espejo de
/// `FOIL_MASK_SPARKLE`. ⚠️ Render: la máscara se rasteriza UNA vez (estática) y
/// el ciclo de matiz anima la capa interior — en el shader single-pass basta
/// sumar el giro de matiz al muestrear el gradiente.
const ({double sizePct, double angleOffsetDeg}) foilMaskSparkle =
    (sizePct: 46, angleOffsetDeg: -30);

/// Variantes del sparkle (opacidad + saturación del campo).
final Map<String, ({double opacity, double saturate})> foilMaskSparkleVariants = {
  'pastel': (opacity: 0.7, saturate: 0.85),
  'vivo': (opacity: 1.0, saturate: 1.6),
};

/// Valores del param `border_sheen` (contrato). Espejo de `FOIL_BORDER_SHEENS`.
const List<String> foilBorderSheens = ['no', 'metalico', 'iridiscente'];

/// KRO-256 — BRILLO del marco: banda especular que barre el marco en continuo,
/// como capa APARTE encima del fill (mismo borderSVG como máscara) → "borde
/// metálico por capas". 'metalico' = esta banda blanca (stops alpha);
/// 'iridiscente' = la banda usa la paleta spectrum atenuada a
/// [foilBorderSheen.iridescentOpacity]. Duración = [foilMotionSweepSec].
/// Espejo de `FOIL_BORDER_SHEEN`.
const ({
  double angleDeg,
  List<({double alpha, double pos})> stops,
  double sizePct,
  double iridescentOpacity,
}) foilBorderSheen = (
  angleDeg: 100,
  // QA: banda AFILADA (pico 1.0 en ±8%) — ancha y tenue leía como "lavado".
  stops: [
    (alpha: 0.0, pos: 0.0),
    (alpha: 0.0, pos: 42.0),
    (alpha: 1.0, pos: 50.0),
    (alpha: 0.0, pos: 58.0),
    (alpha: 0.0, pos: 100.0),
  ],
  sizePct: 250,
  iridescentOpacity: 0.75,
);

/// KRO-256 QA — CANTO del marco: contorno fino oscuro alrededor de la silueta
/// del marco (incluida la ventana del arte) → el marco se lee como pieza
/// aparte en vez de fundirse con la carta. Espejo de `FOIL_BORDER_EDGE`.
/// Render Flutter: stroke fino del path del borderSVG con este color/anchura.
const ({Color color, double blurPx}) foilBorderEdge = (
  color: Color(0xBF181622), // rgba(24,22,34,0.75)
  blurPx: 0.6,
);

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
