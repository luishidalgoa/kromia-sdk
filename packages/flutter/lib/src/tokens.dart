import 'package:flutter/widgets.dart';

/// Tokens de diseño del motor de render (subset de Kromia design-system usado por
/// el layout). Equivalente a las clases Tailwind que consume @kromia/react.
class KromiaTokens {
  KromiaTokens._();

  // Paleta de marca.
  static const Color green = Color(0xFF2D6B45); // primary
  static const Color greenLight = Color(0xFFB4DDD8);
  static const Color cream = Color(0xFFF7F3EE); // canvas
  static const Color peach = Color(0xFFF5DEC0);
  static const Color orange = Color(0xFFE07B39);
  static const Color orangeDeep = Color(0xFFB5651D);
  static const Color gold = Color(0xFFF0B429);
  static const Color text = Color(0xFF1A2E1A); // foreground
  static const Color muted = Color(0xFF7A8A7A); // muted-foreground

  static const Color bgSurface = Color(0xFFFFFFFF); // bg-card
  static const Color bgSurface2 = Color(0xFFF5F1E8); // bg-muted
  static final Color bgTintGreen = const Color(0xFF2D6B45).withValues(alpha: 0.10);
  static final Color hairline = const Color(0xFF7A8A7A).withValues(alpha: 0.18);
  static final Color hairlineStrong = const Color(0xFF7A8A7A).withValues(alpha: 0.35);

  // Escala tipográfica base (px → logical). `tBody`=14 casa con `text-sm` del TS
  // (@kromia/react); antes 13 = drift de −1px que se notaba pequeño en móvil.
  static const double tBody = 14;
  static const TextStyle body = TextStyle(fontSize: tBody, color: text, height: 1.4);

  /// KRO-217 — como [body] pero SIN color: el texto HEREDA el color base del
  /// contenedor (el `DefaultTextStyle` que el LayoutRenderer fija desde
  /// `surface.textColor` del acabado, o `foreground` por defecto). Es la base de los
  /// textos de DATOS de slot; un `appearance.textColor` propio la sobreescribe. Sin
  /// esto, el color foreground fijo de `body` no heredaba → texto oscuro sobre el
  /// papel oscuro del acabado (el bug del detalle).
  static const TextStyle bodyBase = TextStyle(fontSize: tBody, height: 1.4);
  static const TextStyle overline = TextStyle(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 1.0, color: muted, height: 1.4);
  static const TextStyle title = TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: text, height: 1.15);
  static const TextStyle pill = TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.6);

  // Escalas (Tailwind → px).
  static double gap(String? g) => switch (g) {
        'none' => 0,
        'xs' => 4,
        'sm' => 8,
        'md' => 12,
        'lg' => 20,
        _ => 8, // def 'sm'
      };
  static double padding(String? p) => switch (p) {
        'none' => 0,
        'xs' => 4,
        'sm' => 8,
        'md' => 12,
        'lg' => 20,
        'xl' => 32,
        _ => 0,
      };
  static double radius(String? r) => switch (r) {
        'none' => 0,
        'sm' => 4,
        'md' => 6,
        'lg' => 8,
        'xl' => 12,
        'full' => 9999,
        _ => 0,
      };
  static const double radiusMd = 6;
  static const double radiusLg = 8;
  static const double radiusPill = 9999;
  static const double space2 = 4;
  static const double space3 = 6;
  static const double space4 = 8;

  static List<BoxShadow> shadow(String? s) => switch (s) {
        'sm' => _shSm,
        'md' => _shMd,
        'lg' => _shLg,
        'xl' => _shXl,
        _ => const [],
      };
  // Sombras NEUTRAS escala Tailwind (shadow-sm/md/lg/xl), espejo de @kromia/react.
  // Antes era UNA sola sombra verde-tintada que no distinguía md/lg/xl = drift.
  static const List<BoxShadow> _shSm = [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))];
  static const List<BoxShadow> _shMd = [
    BoxShadow(color: Color(0x1A000000), blurRadius: 6, spreadRadius: -1, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x1A000000), blurRadius: 4, spreadRadius: -2, offset: Offset(0, 2)),
  ];
  static const List<BoxShadow> _shLg = [
    BoxShadow(color: Color(0x1A000000), blurRadius: 15, spreadRadius: -3, offset: Offset(0, 10)),
    BoxShadow(color: Color(0x1A000000), blurRadius: 6, spreadRadius: -4, offset: Offset(0, 4)),
  ];
  static const List<BoxShadow> _shXl = [
    BoxShadow(color: Color(0x1A000000), blurRadius: 25, spreadRadius: -5, offset: Offset(0, 20)),
    BoxShadow(color: Color(0x1A000000), blurRadius: 10, spreadRadius: -6, offset: Offset(0, 8)),
  ];

  /// Color de un id de la PALETA (palette.dart). Tokens de tema (semánticos) +
  /// rejilla Tailwind de 10 tonos × 5 intensidades (`red-500`, `slate-600`…).
  /// 'field:<col>' lo resuelve el render con el item (color_hex). Espejo en hex de
  /// `PALETTE`: el id es el contrato cross-language; Flutter mapea cada uno a Color.
  static Color paletteColor(String? id, {Color fallback = const Color(0xFF1A2E1A)}) {
    switch (id) {
      case 'muted':
        return muted;
      case 'accent':
        return green;
      case 'primary':
        return green;
      case 'foreground':
        return text;
      case 'border':
        return hairline;
      case 'card':
        return bgSurface;
    }
    return _paletteGrid[id] ?? fallback;
  }

  /// KRO-217 — hex CRUDO de un id de paleta, o `null` si es un token de TEMA
  /// (`card`/`muted`/`foreground`/`accent`/`primary`/`border`), `field:<col>` o
  /// desconocido. Espejo de `paletteHex` de `@kromia/core/palette.ts`: los tonos de
  /// paleta (rejilla Tailwind + `white`/`black`) son colores verificados; los tokens
  /// de tema devuelven `null` para que el render caiga al tema de la APP (sin acabado
  /// = tema de app). A diferencia de [paletteColor], NO fuerza un fallback. Es la
  /// pieza del fix del "texto oscuro sobre fondo oscuro": con acabado, `textColor`
  /// SIEMPRE es un tono crudo con AA garantizado; sin él, `null` → tema de app.
  static Color? paletteHex(String? id) {
    if (id == null || id.isEmpty) return null;
    return _paletteGrid[id]; // token de tema / field: / desconocido → null
  }

  /// KRO-217 §12.2/§15.1 — color de FONDO de PANTALLA derivado del papel del acabado:
  /// `paletteHex(id)` mezclado un 18% hacia negro (factor **0.82**) para que la carta
  /// resalte por elevación sobre la pantalla. `null` si `id` es token de tema (la
  /// pantalla conserva el fondo de app). Espejo de `screenBgHex` del SDK.
  static Color? screenBgHex(String? id) {
    final c = paletteHex(id);
    if (c == null) return null;
    return Color.lerp(c, const Color(0xFF000000), 0.18)!; // 82% color + 18% negro
  }

  /// Rejilla de color Tailwind (hue-shade → Color) — valores estándar Tailwind v3.
  /// Tonos: slate/red/orange/amber/emerald/teal/sky/blue/violet/pink; intensidades
  /// 200/400/500/600/800 (= PALETTE_HUES × PALETTE_SHADES de palette.dart). Más
  /// `white`/`black` (KRO-217 §21, grupo neutro fijo).
  static const Map<String, Color> _paletteGrid = {
    'white': Color(0xFFFFFFFF), 'black': Color(0xFF000000),
    'slate-200': Color(0xFFE2E8F0), 'slate-400': Color(0xFF94A3B8), 'slate-500': Color(0xFF64748B), 'slate-600': Color(0xFF475569), 'slate-800': Color(0xFF1E293B),
    'red-200': Color(0xFFFECACA), 'red-400': Color(0xFFF87171), 'red-500': Color(0xFFEF4444), 'red-600': Color(0xFFDC2626), 'red-800': Color(0xFF991B1B),
    'orange-200': Color(0xFFFED7AA), 'orange-400': Color(0xFFFB923C), 'orange-500': Color(0xFFF97316), 'orange-600': Color(0xFFEA580C), 'orange-800': Color(0xFF9A3412),
    'amber-200': Color(0xFFFDE68A), 'amber-400': Color(0xFFFBBF24), 'amber-500': Color(0xFFF59E0B), 'amber-600': Color(0xFFD97706), 'amber-800': Color(0xFF92400E),
    'emerald-200': Color(0xFFA7F3D0), 'emerald-400': Color(0xFF34D399), 'emerald-500': Color(0xFF10B981), 'emerald-600': Color(0xFF059669), 'emerald-800': Color(0xFF065F46),
    'teal-200': Color(0xFF99F6E4), 'teal-400': Color(0xFF2DD4BF), 'teal-500': Color(0xFF14B8A6), 'teal-600': Color(0xFF0D9488), 'teal-800': Color(0xFF115E59),
    'sky-200': Color(0xFFBAE6FD), 'sky-400': Color(0xFF38BDF8), 'sky-500': Color(0xFF0EA5E9), 'sky-600': Color(0xFF0284C7), 'sky-800': Color(0xFF075985),
    'blue-200': Color(0xFFBFDBFE), 'blue-400': Color(0xFF60A5FA), 'blue-500': Color(0xFF3B82F6), 'blue-600': Color(0xFF2563EB), 'blue-800': Color(0xFF1E40AF),
    'violet-200': Color(0xFFDDD6FE), 'violet-400': Color(0xFFA78BFA), 'violet-500': Color(0xFF8B5CF6), 'violet-600': Color(0xFF7C3AED), 'violet-800': Color(0xFF5B21B6),
    'pink-200': Color(0xFFFBCFE8), 'pink-400': Color(0xFFF472B6), 'pink-500': Color(0xFFEC4899), 'pink-600': Color(0xFFDB2777), 'pink-800': Color(0xFF9D174D),
  };

  /// Fondo semántico (surface.background) → Color.
  static Color background(String? bg) => switch (bg) {
        'card' => bgSurface,
        'muted' => bgSurface2,
        'accent' => bgTintGreen,
        'primary' => bgTintGreen,
        _ => const Color(0x00000000), // none
      };
}
