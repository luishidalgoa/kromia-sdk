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
  final focusAlign = appearanceImageAlignment(ap);
  Widget img = ctx.imageBuilder(url, fit: appearanceBoxFit(ap), alignment: focusAlign);
  // imageFocus.zoom → escala la imagen sobre el punto de foco (espejo de react
  // `transform: scale(z)` + transformOrigin). Solo con cover (no 'contain') y z>1;
  // el clip del box recorta el excedente.
  final zoom = appearanceImageScale(ap);
  if (zoom > 1.0 && ap?.objectFit != 'contain') {
    img = Transform.scale(scale: zoom, alignment: focusAlign, child: img);
  }
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

/// Pill / badge (rareza/tipo). Color por defecto NEUTRO (`bg-muted` + texto
/// foreground/80), espejo de `BadgePill` de @kromia/react (antes era peach/naranja
/// = drift visual). Honra appearance (color/size/peso) en el texto.
Widget badgePill(String text, SlotAppearance? ap) => Container(
      padding: const EdgeInsets.symmetric(horizontal: KromiaTokens.space4, vertical: KromiaTokens.space2),
      decoration: BoxDecoration(color: KromiaTokens.bgSurface2, borderRadius: BorderRadius.circular(KromiaTokens.radiusPill)),
      child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: applyAppearanceText(KromiaTokens.pill.copyWith(color: KromiaTokens.text.withValues(alpha: 0.8)), ap)),
    );

/// Etiqueta MAYÚSCULAS encima de una galería (KRO-133 fidelidad): las recetas
/// pintan el `def.label` del campo mapeado ("IMÁGENES"/"BESTIAS"/"GALERÍA…").
/// Espejo del `<p class="text-xs uppercase tracking-wider text-muted-foreground
/// font-semibold mb-2">` de `ImageGallery`/`RefGallery`. Sin label → el hijo solo.
Widget _withLabel(String? label, Widget child) {
  if (label == null || label.trim().isEmpty) return child;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Padding(
        padding: const EdgeInsets.only(bottom: KromiaTokens.space3),
        child: Text(label.toUpperCase(),
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.8, color: KromiaTokens.muted, height: 1.3)),
      ),
      child,
    ],
  );
}

/// Rejilla de mini-cartas (card-ref). [columns] lo deriva el caller de
/// `RenderCtx.refColumns` (miniRefGridColumns del cardFormat / appearance.refColumns).
/// [refSize] = ancho % de la carta DENTRO de su celda (centrada); [onRefTap] hace
/// la celda tappable (appearance.refTap=='focus'). Espejo de `MiniCardRefs`.
Widget refsGrid(RenderCtx ctx, List<String> refs, {int columns = 3, String? label, num? refSize, void Function(String ref)? onRefTap}) {
  if (refs.isEmpty) return const SizedBox.shrink();
  // refSize: clamp 10..100 (= react); <100 → encoge la carta y la centra en la celda.
  final pct = refSize == null ? null : (refSize.clamp(10, 100) / 100.0);
  Widget cell(String r) {
    // Si la app inyecta SU celda (la misma de la grid de Cartas), se usa tal cual
    // (arte + número + estados + tap propios) → la relación se ve idéntica a Cartas.
    if (ctx.cardRefCell != null) {
      Widget c = ctx.cardRefCell!(r);
      if (pct != null && pct < 1.0) {
        c = Align(alignment: Alignment.center, child: FractionallySizedBox(widthFactor: pct.toDouble(), child: c));
      }
      return c;
    }
    // Resuelve la ref a la carta REAL (arte + título); si no resuelve, placeholder.
    final resolved = ctx.resolveCardRef?.call(r);
    final imageUrl = resolved?.imageUrl;
    Widget card = (imageUrl != null && imageUrl.isNotEmpty)
        ? _miniCardArt(ctx, imageUrl, resolved?.title)
        : _miniCard(resolved?.title ?? r);
    if (pct != null && pct < 1.0) {
      card = Align(alignment: Alignment.center, child: FractionallySizedBox(widthFactor: pct.toDouble(), child: card));
    }
    if (onRefTap != null) {
      card = GestureDetector(onTap: () => onRefTap(r), behavior: HitTestBehavior.opaque, child: card);
    }
    return card;
  }

  // Aspect de la mini-carta = el del formato de carta del álbum (cardFormat),
  // para que se vea con la MISMA proporción que la carta real (no 0.7 fijo).
  final cardAspect = ctx.cardFormat != null ? aspectToRatio(ctx.cardFormat!.aspect).toDouble() : 0.7;
  return _withLabel(
    label,
    GridView.count(
      crossAxisCount: columns,
      mainAxisSpacing: KromiaTokens.space2,
      crossAxisSpacing: KromiaTokens.space2,
      childAspectRatio: cardAspect,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [for (final r in refs.take(9)) cell(r)],
    ),
  );
}

Widget _miniCard(String label) => DecoratedBox(
      decoration: BoxDecoration(color: KromiaTokens.greenLight, borderRadius: BorderRadius.circular(KromiaTokens.radiusMd)),
      child: Center(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: KromiaTokens.body.copyWith(fontSize: 11))),
    );

/// Mini-carta con el ARTE real de la carta referenciada + título en cinta inferior.
Widget _miniCardArt(RenderCtx ctx, String imageUrl, String? title) => ClipRRect(
      borderRadius: BorderRadius.circular(KromiaTokens.radiusMd),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: KromiaTokens.greenLight, child: ctx.imageBuilder(imageUrl, fit: BoxFit.cover)),
          if (title != null && title.isNotEmpty)
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                color: const Color(0xCC000000),
                child: Text(title,
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 9, fontWeight: FontWeight.w600)),
              ),
            ),
        ],
      ),
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

/// Carrusel horizontal de imágenes (carousel_peek/centered). [label] = etiqueta
/// del campo mapeado (paridad `ImageGallery label=`).
Widget imageRow(RenderCtx ctx, List<String> urls, {String? label}) {
  if (urls.isEmpty) return const SizedBox.shrink();
  return _withLabel(
    label,
    SizedBox(
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
    ),
  );
}

/// Mosaico de imágenes 3 columnas (gallery_grid). [label] = etiqueta del campo
/// mapeado (paridad `ImageGallery label=` → "IMÁGENES").
Widget imageGrid(RenderCtx ctx, List<String> urls, {String? label}) {
  if (urls.isEmpty) return const SizedBox.shrink();
  // Mosaico 3 col. Celdas de tamaño CALCULADO del ancho disponible (LayoutBuilder
  // + Wrap), NO `GridView.count(shrinkWrap)`: ese grid, anidado en un scroll, medía
  // mal en el PRIMER pintado y el Wrap con SizedBox fijos es determinista.
  // CLAVE: se pasa width/height=cell EXPLÍCITOS al imageBuilder para que la imagen
  // llene la celda aunque el frameBuilder de KromiaImage (AnimatedSwitcher) afloje
  // las constraints en la primera carga (si no, salía a su aspect intrínseco 16:9).
  return _withLabel(
    label,
    LayoutBuilder(builder: (context, c) {
      const cols = 3;
      const gap = KromiaTokens.space2;
      final maxW = c.hasBoundedWidth ? c.maxWidth : MediaQuery.of(context).size.width;
      final cell = ((maxW - gap * (cols - 1)) / cols).floorToDouble();
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [
          for (final u in urls.take(9))
            ClipRRect(
              borderRadius: BorderRadius.circular(KromiaTokens.radiusLg),
              child: ctx.imageBuilder(u, fit: BoxFit.cover, width: cell, height: cell),
            ),
        ],
      );
    }),
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
