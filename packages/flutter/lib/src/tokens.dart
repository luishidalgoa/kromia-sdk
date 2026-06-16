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

  // Escala tipográfica base (px → logical).
  static const double tBody = 13;
  static const TextStyle body = TextStyle(fontSize: tBody, color: text, height: 1.4);
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
        'sm' => _soft,
        'md' || 'lg' || 'xl' => _card,
        _ => const [],
      };
  static final List<BoxShadow> _soft = [BoxShadow(color: const Color(0xFF000000).withValues(alpha: 0.10), blurRadius: 3, offset: const Offset(1, 2))];
  static final List<BoxShadow> _card = [BoxShadow(color: const Color(0xFF2D6B45).withValues(alpha: 0.18), blurRadius: 8, offset: const Offset(0, 2))];

  /// Color de un token de paleta (background/border/text). 'field:<col>' lo
  /// resuelve el render con el item (color_hex). Default = hairline (borde).
  static Color paletteColor(String? id, {Color fallback = const Color(0xFF1A2E1A)}) => switch (id) {
        'muted' => muted,
        'accent' => green,
        'primary' => green,
        'foreground' => text,
        'border' => hairline,
        'card' => bgSurface,
        _ => fallback,
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
