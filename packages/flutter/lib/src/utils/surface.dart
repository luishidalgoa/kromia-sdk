import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import '../tokens.dart';

/// Decoración de un `ContainerSurface` → (BoxDecoration?, padding). Espejo de
/// `containerSurfaceClasses` de @kromia/react (background/border/radius/shadow/padding).
({BoxDecoration? decoration, EdgeInsets padding}) surfaceDecoration(ContainerSurface? s) {
  if (s == null) return (decoration: null, padding: EdgeInsets.zero);
  Border? border;
  final b = s.border;
  if (b != null && b.width != null) {
    final side = BorderSide(color: KromiaTokens.paletteColor(b.color ?? 'border', fallback: KromiaTokens.hairline), width: _borderWidth(b.width));
    final sides = (b.sides == null || b.sides!.isEmpty) ? const ['top', 'right', 'bottom', 'left'] : b.sides!;
    border = Border(
      top: sides.contains('top') ? side : BorderSide.none,
      right: sides.contains('right') ? side : BorderSide.none,
      bottom: sides.contains('bottom') ? side : BorderSide.none,
      left: sides.contains('left') ? side : BorderSide.none,
    );
  }
  final hasRadius = s.radius != null && s.radius != 'none';
  final hasDeco = s.background != null || s.bgColor != null || border != null || hasRadius || s.shadow != null;
  return (
    decoration: hasDeco
        ? BoxDecoration(
            color: _bgColor(s),
            border: border,
            borderRadius: hasRadius ? _radius(s) : null,
            boxShadow: KromiaTokens.shadow(s.shadow),
          )
        : null,
    padding: EdgeInsets.all(KromiaTokens.padding(s.padding)),
  );
}

Color? _bgColor(ContainerSurface s) {
  // bgColor (paleta amplia) prevalece sobre el token semántico `background`.
  if (s.bgColor != null && !s.bgColor!.startsWith('field:')) {
    return KromiaTokens.paletteColor(s.bgColor, fallback: KromiaTokens.bgSurface);
  }
  if (s.background != null && s.background != 'none') return KromiaTokens.background(s.background);
  return null;
}

BorderRadius _radius(ContainerSurface s) {
  final r = KromiaTokens.radius(s.radius);
  final corners = s.radiusCorners;
  if (corners == null || corners.isEmpty) return BorderRadius.circular(r);
  final rad = Radius.circular(r);
  return BorderRadius.only(
    topLeft: corners.contains('tl') ? rad : Radius.zero,
    topRight: corners.contains('tr') ? rad : Radius.zero,
    bottomLeft: corners.contains('bl') ? rad : Radius.zero,
    bottomRight: corners.contains('br') ? rad : Radius.zero,
  );
}

double _borderWidth(String? w) => switch (w) {
      'medium' => 2,
      'thick' => 4,
      _ => 1, // thin
    };

/// Velo (scrim) de legibilidad → overlay (gradiente o oscurecido). `Positioned.fill`
/// para que el caller lo apile en un Stack. Espejo de `scrimClass`.
Widget? scrimOverlay(String? scrim) {
  if (scrim == null || scrim == 'none') return null;
  if (scrim == 'full') {
    return Positioned.fill(child: IgnorePointer(child: ColoredBox(color: const Color(0x66000000))));
  }
  final bottom = scrim == 'bottom';
  return Positioned.fill(
    child: IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: bottom ? Alignment.bottomCenter : Alignment.topCenter,
            end: bottom ? Alignment.topCenter : Alignment.bottomCenter,
            colors: const [Color(0xA6000000), Color(0x33000000), Color(0x00000000)],
          ),
        ),
      ),
    ),
  );
}
