import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import '../render_ctx.dart';
import '../tokens.dart';
import '../utils/appearance_styles.dart';

/// Caja-imagen honrando appearance (shape/aspect/size/imageFocus). array<image>
/// con N>1 → chip "+N-1". Espejo de `ThumbBox`.
Widget imageBox(RenderCtx ctx, String url, SlotAppearance? ap, {int? count}) {
  final aspect = appearanceAspect(ap);
  final isCircle = appearanceIsCircle(ap);
  final radius = appearanceCornerRadius(ap);
  // fill = aspect sin size (banner/cover a ancho completo); si no, thumb fijo.
  Widget img = ctx.imageBuilder(url, fit: BoxFit.cover, alignment: appearanceImageAlignment(ap));
  if (aspect != null && ap?.size == null) {
    img = AspectRatio(aspectRatio: aspect, child: img);
  } else {
    final s = appearanceSizePx(ap, 48);
    img = SizedBox(width: s, height: aspect != null ? s / aspect : s, child: img);
  }
  img = isCircle
      ? ClipOval(child: img)
      : ClipRRect(borderRadius: BorderRadius.circular(radius ?? KromiaTokens.radiusLg), child: img);
  if (count != null && count > 1) {
    img = Stack(children: [
      img,
      Positioned(right: 4, bottom: 4, child: _chip('+${count - 1}')),
    ]);
  }
  return img;
}

Widget _chip(String text) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: const Color(0xCC000000), borderRadius: BorderRadius.circular(KromiaTokens.radiusPill)),
      child: Text(text, style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 10, fontWeight: FontWeight.w700)),
    );

/// Pill / badge (rareza/tipo). Honra appearance (color/size/peso) en el texto.
Widget badgePill(String text, SlotAppearance? ap) => Container(
      padding: const EdgeInsets.symmetric(horizontal: KromiaTokens.space4, vertical: KromiaTokens.space2),
      decoration: BoxDecoration(color: KromiaTokens.peach, borderRadius: BorderRadius.circular(KromiaTokens.radiusPill)),
      child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: applyAppearanceText(KromiaTokens.pill.copyWith(color: KromiaTokens.orangeDeep), ap)),
    );

/// Rejilla de mini-cartas (card-ref) — 3 columnas (aprox; el TS deriva las
/// columnas de cardFormat vía miniRefGridColumns, no espejado aún).
Widget refsGrid(List<String> refs) {
  if (refs.isEmpty) return const SizedBox.shrink();
  return GridView.count(
    crossAxisCount: 3,
    mainAxisSpacing: KromiaTokens.space2,
    crossAxisSpacing: KromiaTokens.space2,
    childAspectRatio: 0.7,
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    children: [for (final r in refs.take(9)) _miniCard(r)],
  );
}

Widget _miniCard(String label) => DecoratedBox(
      decoration: BoxDecoration(color: KromiaTokens.greenLight, borderRadius: BorderRadius.circular(KromiaTokens.radiusMd)),
      child: Center(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: KromiaTokens.body.copyWith(fontSize: 11))),
    );

/// Carrusel horizontal de mini-cartas (cards_carousel).
Widget cardsCarousel(List<String> refs) {
  if (refs.isEmpty) return const SizedBox.shrink();
  return SizedBox(
    height: 96,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: refs.length,
      separatorBuilder: (_, __) => const SizedBox(width: KromiaTokens.space3),
      itemBuilder: (_, i) => AspectRatio(aspectRatio: 0.7, child: _miniCard(refs[i])),
    ),
  );
}

/// Carrusel horizontal de imágenes (carousel_peek/centered).
Widget imageRow(RenderCtx ctx, List<String> urls) {
  if (urls.isEmpty) return const SizedBox.shrink();
  return SizedBox(
    height: 120,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: urls.length,
      separatorBuilder: (_, __) => const SizedBox(width: KromiaTokens.space3),
      itemBuilder: (_, i) => ClipRRect(
        borderRadius: BorderRadius.circular(KromiaTokens.radiusMd),
        child: ctx.imageBuilder(urls[i], fit: BoxFit.cover, width: 160, height: 120),
      ),
    ),
  );
}

/// Mosaico de imágenes 3 columnas (gallery_grid).
Widget imageGrid(RenderCtx ctx, List<String> urls) {
  if (urls.isEmpty) return const SizedBox.shrink();
  return GridView.count(
    crossAxisCount: 3,
    mainAxisSpacing: KromiaTokens.space2,
    crossAxisSpacing: KromiaTokens.space2,
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    children: [
      for (final u in urls.take(9))
        ClipRRect(borderRadius: BorderRadius.circular(KromiaTokens.radiusLg), child: ctx.imageBuilder(u, fit: BoxFit.cover)),
    ],
  );
}

/// Separador decorativo (divider) parametrizable por config (width/thickness/tint).
Widget dividerLine(Map<String, String>? config) {
  final c = config ?? const {};
  final widthToken = c['width'] ?? 'short';
  final thickness = switch (c['thickness']) { 'medium' => 2.0, 'thick' => 4.0, _ => 1.0 };
  final tint = switch (c['tint']) { 'muted' => KromiaTokens.muted, 'strong' => KromiaTokens.text, _ => KromiaTokens.hairlineStrong };
  final isFull = widthToken == 'full';
  final width = switch (widthToken) { 'wide' => 96.0, _ => 48.0 };
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: KromiaTokens.space3),
    child: isFull
        ? Container(height: thickness, color: tint)
        : Row(mainAxisAlignment: MainAxisAlignment.center, children: [Container(width: width, height: thickness, color: tint)]),
  );
}
