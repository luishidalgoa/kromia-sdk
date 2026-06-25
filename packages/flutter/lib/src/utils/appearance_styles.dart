import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import '../tokens.dart';

/// Traduce `SlotAppearance` (presets cerrados) a estilo Flutter — espejo de los
/// helpers `appearance*Class` de `recipe-utils.tsx` (@kromia/react). Un override
/// del publisher (negrita, centrado, tamaño, color, serif…) se ve igual en
/// Studio (web) y en la app.

FontWeight? appearanceFontWeight(SlotAppearance? a) => switch (a?.weight) {
      'regular' => FontWeight.w400,
      'semibold' => FontWeight.w600,
      'bold' => FontWeight.w700,
      _ => null,
    };

double? appearanceFontSize(SlotAppearance? a) => switch (a?.size) {
      'sm' => 12,
      'md' => 14,
      'lg' => 16,
      'xl' => 18,
      _ => null,
    };

TextAlign? appearanceTextAlign(SlotAppearance? a) => switch (a?.align) {
      'left' => TextAlign.left,
      'center' => TextAlign.center,
      'right' => TextAlign.right,
      _ => null,
    };

double? _lineHeight(SlotAppearance? a) => switch (a?.lineHeight) {
      'tight' => 1.25, // leading-tight
      'normal' => 1.5, // leading-normal
      'relaxed' => 1.625, // leading-relaxed
      _ => null,
    };

/// tracking (letter-spacing). React usa `em` (relativo al fontSize); Flutter usa
/// px absoluto → calculamos `em × fontSize` para que el espaciado escale igual a
/// cualquier tamaño. `uppercase` añade el `tracking-wider` (0.05em) implícito de
/// react cuando no hay tracking explícito.
double? _letterSpacing(SlotAppearance? a, double fontSize) {
  final em = switch (a?.tracking) {
    'tight' => -0.025, // tracking-tight
    'normal' => 0.0, // tracking-normal
    'wide' => 0.025, // tracking-wide
    _ => a?.textTransform == 'uppercase' ? 0.05 : null, // tracking-wider implícito
  };
  return em == null ? null : em * fontSize;
}

List<Shadow>? _textShadow(SlotAppearance? a) => switch (a?.textShadow) {
      'sm' => const [Shadow(blurRadius: 2, color: Color(0x66000000), offset: Offset(0, 1))],
      'md' => const [Shadow(blurRadius: 4, color: Color(0x99000000), offset: Offset(0, 1))],
      _ => null,
    };

/// objectFit → BoxFit. 'contain' = encaja entera; 'cover' (def) = rellena recortando.
BoxFit appearanceBoxFit(SlotAppearance? a) => a?.objectFit == 'contain' ? BoxFit.contain : BoxFit.cover;

/// opacity → factor 0..1 ('100'/'90'/'75'/'50').
double appearanceOpacity(SlotAppearance? a) => switch (a?.opacity) {
      '90' => 0.9,
      '75' => 0.75,
      '50' => 0.5,
      _ => 1.0,
    };

/// textColor (token de paleta) → Color. 'field:<col>' lo resuelve el render con
/// el item (color_hex) → aquí null.
Color? appearanceTextColor(SlotAppearance? a) {
  final c = a?.textColor;
  if (c == null || c.startsWith('field:')) return null;
  return KromiaTokens.paletteColor(c, fallback: KromiaTokens.text);
}

/// bgColor (token de paleta) → Color de fondo del bloque de texto. Espejo de
/// `paletteClass(a.bgColor,'bg')` en `appearanceTextClasses`. 'field:' → null.
Color? appearanceBgColor(SlotAppearance? a) {
  final c = a?.bgColor;
  if (c == null || c.startsWith('field:')) return null;
  return KromiaTokens.paletteColor(c, fallback: KromiaTokens.bgSurface2);
}

/// shadow del SLOT (efecto, KRO-147 F3) → boxShadow. Espejo de
/// `SLOT_SHADOW_CLASSES` (none/sm/md/lg). Se aplica al wrapper de cualquier slot.
List<BoxShadow> appearanceSlotShadow(SlotAppearance? a) => KromiaTokens.shadow(a?.shadow);

/// Aplica weight/size/color/font/italic/underline/tracking/lineHeight sobre un
/// estilo base (espejo de appearanceTextClasses). El uppercase se aplica al TEXTO
/// (ver [appearanceTransform]), no al estilo.
TextStyle applyAppearanceText(TextStyle base, SlotAppearance? a) {
  if (a == null) return base;
  final fontSize = appearanceFontSize(a) ?? base.fontSize ?? KromiaTokens.tBody;
  return base.copyWith(
    fontWeight: appearanceFontWeight(a) ?? base.fontWeight,
    fontSize: appearanceFontSize(a) ?? base.fontSize,
    color: appearanceTextColor(a) ?? base.color,
    fontFamily: a.font == 'serif' ? 'serif' : base.fontFamily,
    fontStyle: a.italic == true ? FontStyle.italic : base.fontStyle,
    decoration: a.underline == true ? TextDecoration.underline : base.decoration,
    letterSpacing: _letterSpacing(a, fontSize) ?? base.letterSpacing,
    height: _lineHeight(a) ?? base.height,
    shadows: _textShadow(a) ?? base.shadows,
  );
}

/// textTransform: 'uppercase' → MAYÚSCULAS.
String appearanceTransform(String text, SlotAppearance? a) =>
    a?.textTransform == 'uppercase' ? text.toUpperCase() : text;

/// truncate → maxLines. '1'/'2'/'3' → n; 'none' → null; sin override → [def].
int? appearanceMaxLines(SlotAppearance? a, {int? def = 1}) => switch (a?.truncate) {
      '1' => 1,
      '2' => 2,
      '3' => 3,
      'none' => null,
      _ => def,
    };

double appearanceSizePx(SlotAppearance? a, double basePx) => switch (a?.size) {
      'sm' => (basePx * 0.7).roundToDouble(),
      'lg' => (basePx * 1.4).roundToDouble(),
      'xl' => (basePx * 1.8).roundToDouble(),
      _ => basePx,
    };

double? appearanceAspect(SlotAppearance? a) => switch (a?.aspect) {
      '1:1' => 1,
      '16:9' => 16 / 9,
      '4:3' => 4 / 3,
      '3:4' => 3 / 4,
      '9:16' => 9 / 16,
      _ => null,
    };

bool appearanceIsCircle(SlotAppearance? a) => a?.shape == 'circle';

double? appearanceCornerRadius(SlotAppearance? a) => switch (a?.shape) {
      'square' => 0,
      'rounded' => 8,
      _ => null,
    };

double appearancePaddingY(SlotAppearance? a) => switch (a?.paddingY) {
      'sm' => 4,
      'md' => 8,
      'lg' => 16,
      _ => 0,
    };

Alignment appearanceImageAlignment(SlotAppearance? a) {
  final f = a?.imageFocus;
  if (f == null) return Alignment.center;
  return Alignment((f.x.clamp(0, 100) / 50.0) - 1.0, (f.y.clamp(0, 100) / 50.0) - 1.0);
}

double appearanceImageScale(SlotAppearance? a) => (a?.imageFocus?.zoom ?? 1).clamp(1, 3).toDouble();

/// KRO-221 — apariencia EFECTIVA de un field de un slot composable: el override
/// por-field ([fieldAppearances]`[key]`) GANA sobre la [base] del slot (merge
/// shallow). Espejo de `mergeFieldAppearance` (`{...base, ...fieldAppearances[key]}`).
/// Sin entrada por-field → la base intacta. NB: necesita la KEY del field
/// (ResolvedSlot la conserva) — un array sin key por-elemento cae a la base.
SlotAppearance? mergeFieldAppearance(
  SlotAppearance? base,
  Map<String, SlotAppearance>? fieldAppearances,
  String? key,
) {
  if (key == null || fieldAppearances == null) return base;
  final fa = fieldAppearances[key];
  return fa != null ? fa.mergedOver(base) : base; // fa (this) gana sobre base
}

/// KRO-221 — recorta [text] a `truncateChars` + '…' (slice por caracteres;
/// distinto del line-clamp de `truncate`). Espejo de `applyAppearanceTruncate`.
/// Sin truncateChars (o texto más corto) → el texto intacto.
String applyAppearanceTruncate(String text, SlotAppearance? a) {
  final n = a?.truncateChars;
  if (n == null || n <= 0 || text.length <= n) return text;
  return '${text.substring(0, n).trimRight()}…';
}
