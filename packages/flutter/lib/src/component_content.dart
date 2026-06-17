import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import 'render_ctx.dart';
import 'slot_content.dart';
import 'tokens.dart';
import 'ui/prefabs.dart';
import 'utils/surface.dart';

/// Render de un componente prefabricado (KRO-133 Capa 2). Espejo de
/// `ComponentContent`/`ComponentNodeView`. null si rol oculto / sin slot /
/// componente desconocido (degradación elegante).
Widget? componentContent(RenderCtx ctx, LayoutComponentNode node) {
  final hidden = node.hidden ?? const <String>[];
  bool isHidden(String r) => hidden.contains(r);
  String? sidOf(String r) => node.slots?[r];

  List<String> rawList(String r) {
    final sid = sidOf(r);
    if (sid == null) return const [];
    final rs = resolveSlot(ctx, sid);
    final v = (rs != null && rs.fields.isNotEmpty) ? rs.fields.first.value : null;
    return v is List ? v.map((e) => e.toString()).toList() : (v != null ? <String>[v.toString()] : const []);
  }

  Widget? inner;
  switch (node.component) {
    case 'card':
      inner = _card(ctx, node);
    case 'ref_gallery':
      inner = isHidden('refs') ? null : refsGrid(rawList('refs'), columns: ctx.refColumns(ctx.slots[sidOf('refs')]?.appearance));
    case 'carousel_peek':
    case 'carousel_centered':
      inner = isHidden('images') ? null : imageRow(ctx, rawList('images'));
    case 'gallery_grid':
      inner = isHidden('images') ? null : imageGrid(ctx, rawList('images'));
    case 'cards_carousel':
      inner = isHidden('cards') ? null : cardsCarousel(rawList('cards'));
    case 'divider':
      inner = dividerLine(node.config);
    case 'stats_row':
      inner = _statsRow(ctx, sidOf('stats'));
    case 'badge_row':
      inner = isHidden('badges') ? null : _badgeRow(ctx, sidOf('badges'));
    case 'section_title':
      inner = isHidden('text') ? null : _sectionTitle(ctx, sidOf('text'));
    case 'hero_header':
      inner = _heroHeader(ctx, node);
    default:
      inner = null;
  }
  if (inner == null) return null;

  // surface genérica para prefabs (card la honra internamente).
  final sc = node.surface;
  if (sc == null || node.component == 'card') return inner;
  final surf = surfaceDecoration(sc);
  if (surf.decoration == null && surf.padding == EdgeInsets.zero) return inner;
  Widget wrapped = Container(decoration: surf.decoration, padding: surf.padding == EdgeInsets.zero ? null : surf.padding, child: inner);
  if (sc.radius != null && sc.radius != 'none') {
    wrapped = ClipRRect(borderRadius: BorderRadius.circular(KromiaTokens.radius(sc.radius)), child: wrapped);
  }
  return wrapped;
}

Widget _card(RenderCtx ctx, LayoutComponentNode node) {
  final hidden = node.hidden ?? const <String>[];
  Widget? roleSlot(String role) {
    if (hidden.contains(role)) return null;
    final sid = node.slots?[role];
    return sid == null ? null : slotContent(ctx, sid);
  }

  final surf = node.surface != null ? surfaceDecoration(node.surface) : null;
  final decoration = surf?.decoration ??
      BoxDecoration(
        color: KromiaTokens.bgSurface,
        borderRadius: BorderRadius.circular(KromiaTokens.radiusLg),
        border: Border.all(color: KromiaTokens.hairline),
        boxShadow: KromiaTokens.shadow('sm'),
      );
  final media = roleSlot('media');
  final title = roleSlot('title');
  final caption = roleSlot('caption');
  final badge = roleSlot('badge');
  return ClipRRect(
    borderRadius: BorderRadius.circular(KromiaTokens.radius(node.surface?.radius ?? 'lg')),
    child: Container(
      decoration: decoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (media != null) media,
          if (title != null || caption != null || badge != null)
            Padding(
              padding: const EdgeInsets.all(KromiaTokens.space4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title != null) title,
                  if (caption != null) caption,
                  if (badge != null) badge,
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

Widget _statsRow(RenderCtx ctx, String? sid) {
  final comp = sid == null ? null : ctx.slots[sid];
  if (comp == null) return const SizedBox.shrink();
  final cells = <Widget>[];
  for (final k in comp.fields) {
    final v = ctx.item[k];
    if (v == null || v.toString().trim().isEmpty) continue;
    final def = ctx.defFor(k);
    cells.add(Expanded(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(formatScalar(v, def),
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: KromiaTokens.body.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
        if (def?.label != null && def!.label!.isNotEmpty)
          Text(def.label!.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: KromiaTokens.overline),
      ]),
    ));
  }
  if (cells.isEmpty) return const SizedBox.shrink();
  return Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    decoration: BoxDecoration(border: Border(top: BorderSide(color: KromiaTokens.hairline), bottom: BorderSide(color: KromiaTokens.hairline))),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: cells),
  );
}

Widget _badgeRow(RenderCtx ctx, String? sid) {
  final comp = sid == null ? null : ctx.slots[sid];
  if (comp == null) return const SizedBox.shrink();
  final pills = <Widget>[];
  for (final k in comp.fields) {
    final txt = formatScalar(ctx.item[k], ctx.defFor(k));
    if (txt.isEmpty) continue;
    pills.add(badgePill(txt, comp.appearance));
  }
  if (pills.isEmpty) return const SizedBox.shrink();
  return Wrap(spacing: KromiaTokens.space2, runSpacing: KromiaTokens.space2, children: pills);
}

Widget _sectionTitle(RenderCtx ctx, String? sid) {
  final comp = sid == null ? null : ctx.slots[sid];
  final first = (comp != null && comp.fields.isNotEmpty) ? comp.fields.first : null;
  final formatted = first != null ? formatScalar(ctx.item[first], ctx.defFor(first)) : '';
  final shown = formatted.isNotEmpty ? formatted : (ctx.defFor(first)?.label ?? '');
  if (shown.isEmpty) return const SizedBox.shrink();
  return Text(shown.toUpperCase(), style: KromiaTokens.overline);
}

Widget _heroHeader(RenderCtx ctx, LayoutComponentNode node) {
  final hidden = node.hidden ?? const <String>[];
  String? sidOf(String r) => node.slots?[r];
  String slotText(String r) {
    final sid = sidOf(r);
    if (sid == null || hidden.contains(r)) return '';
    final rs = resolveSlot(ctx, sid);
    return rs == null ? '' : composeText(rs);
  }
  String? slotImage(String r) {
    final sid = sidOf(r);
    if (sid == null || hidden.contains(r)) return null;
    final v = ctx.item[ctx.slots[sid]!.fields.isNotEmpty ? ctx.slots[sid]!.fields.first : ''];
    final s = v is List ? (v.isNotEmpty ? v.first?.toString() : null) : v?.toString();
    return (s != null && s.isNotEmpty) ? s : null;
  }

  final title = slotText('title');
  final subtitle = slotText('subtitle');
  final bannerUrl = slotImage('banner');
  final avatarUrl = slotImage('avatar');

  return Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 40),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: bannerUrl != null
                  ? ctx.imageBuilder(bannerUrl, fit: BoxFit.cover)
                  : ColoredBox(color: KromiaTokens.peach),
            ),
          ),
          if (!hidden.contains('avatar'))
            Positioned(
              bottom: 0,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(shape: BoxShape.circle, color: KromiaTokens.greenLight, border: Border.all(color: KromiaTokens.bgSurface, width: 3)),
                clipBehavior: Clip.antiAlias,
                child: avatarUrl != null ? ctx.imageBuilder(avatarUrl, fit: BoxFit.cover) : const SizedBox(),
              ),
            ),
        ],
      ),
      if (title.isNotEmpty)
        Padding(padding: const EdgeInsets.only(top: KromiaTokens.space4), child: Text(title, textAlign: TextAlign.center, style: KromiaTokens.title)),
      if (subtitle.isNotEmpty) Text(subtitle, textAlign: TextAlign.center, style: KromiaTokens.body.copyWith(color: KromiaTokens.muted)),
    ],
  );
}
