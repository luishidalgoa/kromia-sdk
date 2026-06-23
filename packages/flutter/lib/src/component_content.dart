import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import 'render_ctx.dart';
import 'slot_content.dart';
import 'tokens.dart';
import 'ui/prefabs.dart';
import 'utils/appearance_styles.dart';
import 'utils/surface.dart';

/// Render de un componente prefabricado (KRO-133 Capa 2). Espejo de
/// `ComponentContent`/`ComponentNodeView`. null si rol oculto / sin slot /
/// componente desconocido (degradación elegante).
Widget? componentContent(RenderCtx ctx, LayoutComponentNode node) {
  final hidden = node.hidden ?? const <String>[];
  bool isHidden(String r) => hidden.contains(r);
  String? sidOf(String r) => node.slots?[r];

  // KRO-133 fidelidad — etiqueta del campo mapeado a un rol (las recetas pintan el
  // `def.label` de la galería: "IMÁGENES"/"BESTIAS"…). Espejo de `roleLabel`
  // (LayoutRenderer.tsx): rol → slot → primer field → def.label.
  String? roleLabel(String r) {
    final sid = sidOf(r);
    if (sid == null) return null;
    final comp = ctx.slots[sid];
    final fk = (comp != null && comp.fields.isNotEmpty) ? comp.fields.first : null;
    return fk == null ? null : ctx.defFor(fk)?.label;
  }

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
      {
        final refsAp = ctx.slots[sidOf('refs')]?.appearance;
        inner = isHidden('refs')
            ? null
            : refsGrid(
                ctx,
                rawList('refs'),
                columns: ctx.refColumns(refsAp),
                label: roleLabel('refs'),
                refSize: refsAp?.refSize,
                onRefTap: (refsAp?.refTap == 'focus' && ctx.onCardRefTap != null) ? (r) => ctx.onCardRefTap!(r) : null,
              );
      }
    case 'carousel_peek':
    case 'carousel_centered':
      {
        final iid = sidOf('images');
        final imgsAp = iid == null ? null : resolveSlot(ctx, iid)?.appearance;
        inner = isHidden('images')
            ? null
            : imageRow(ctx, rawList('images'),
                label: roleLabel('images'), appearance: imgsAp, centered: node.component == 'carousel_centered');
      }
    case 'gallery_grid':
      {
        final iid = sidOf('images');
        final imgsAp = iid == null ? null : resolveSlot(ctx, iid)?.appearance;
        inner = isHidden('images') ? null : imageGrid(ctx, rawList('images'), label: roleLabel('images'), appearance: imgsAp);
      }
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
        // KRO-198 — paridad con `StatsRow.tsx`: VALOR `text-lg` (18px) bold
        // tabular, ETIQUETA `text-[10px]`. Antes 13/9 → ~28% pequeño vs el diseño.
        Text(formatScalar(v, def),
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: KromiaTokens.body.copyWith(fontSize: 18, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
        if (def?.label != null && def!.label!.isNotEmpty)
          Text(def.label!.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: KromiaTokens.overline.copyWith(fontSize: 10)),
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
  if (sid == null) return const SizedBox.shrink();
  // KRO-198 — vía resolveSlot: honra el estilo condicional por valor (con target →
  // fieldAppearances) + la apariencia por-chip; antes usaba comp.appearance global.
  final r = resolveSlot(ctx, sid);
  if (r == null) return const SizedBox.shrink();
  final pills = <Widget>[];
  for (final f in r.fields) {
    final txt = formatScalar(f.value, f.def);
    if (txt.isEmpty) continue;
    final ap = mergeFieldAppearance(r.appearance, r.fieldAppearances, f.key); // override/condicional por-chip gana
    Widget pill = badgePill(applyAppearanceTruncate(txt, ap), ap);
    // Relleno de apariencia del box (appearancePaddingClass del TS), SUMADO al
    // px-2 py-0.5 propio del pill. Sin override (pad==0) no añade nada.
    final pad = appearancePaddingY(ap);
    if (pad > 0) pill = Padding(padding: EdgeInsets.symmetric(vertical: pad), child: pill);
    // Efecto (opacity + shadow) por badge — espejo de appearanceEffectClasses del box.
    final shadow = appearanceSlotShadow(ap);
    if (shadow.isNotEmpty) pill = DecoratedBox(decoration: BoxDecoration(boxShadow: shadow), child: pill);
    final op = appearanceOpacity(ap);
    if (op < 1.0) pill = Opacity(opacity: op, child: pill);
    pills.add(pill);
  }
  if (pills.isEmpty) return const SizedBox.shrink();
  // align del slot → justify-content del row (TS): left=start, center, right=end.
  final align = switch (r.appearance?.align) {
    'center' => WrapAlignment.center,
    'right' => WrapAlignment.end,
    _ => WrapAlignment.start,
  };
  return Wrap(alignment: align, spacing: KromiaTokens.space2, runSpacing: KromiaTokens.space2, children: pills);
}

Widget _sectionTitle(RenderCtx ctx, String? sid) {
  if (sid == null) return const SizedBox.shrink();
  // KRO-198 — vía resolveSlot (gating + condicional). uppercase/tracking/size/color
  // son DEFAULTS PISABLES por la apariencia, no hardcodes (antes: overline 9px fijo).
  final r = resolveSlot(ctx, sid);
  final first = (r != null && r.fields.isNotEmpty) ? r.fields.first : null;
  final formatted = first != null ? formatScalar(first.value, first.def) : '';
  final shown = formatted.isNotEmpty ? formatted : (first?.def?.label ?? '');
  if (shown.isEmpty) return const SizedBox.shrink();
  final ap = first == null ? r?.appearance : mergeFieldAppearance(r?.appearance, r?.fieldAppearances, first.key);
  // DEFAULT = identidad del título de sección: text-xs(12) + semibold + muted +
  // tracking-wider (≈0.05em). applyAppearanceText pisa lo que la apariencia fije.
  final base = const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.4, letterSpacing: 0.6)
      .copyWith(color: KromiaTokens.muted);
  final style = applyAppearanceText(base, ap);
  // MAYÚSCULAS = identidad FIJA del título de sección (en TS la clase `uppercase`
  // está hardcodeada y appearanceTextClasses solo puede AÑADIRla, nunca quitarla)
  // → textTransform:'none' NO la anula. Paridad con LayoutRenderer.tsx.
  final text = shown.toUpperCase();
  Widget w = Text(text,
      // Sin truncate override → SIN clamp (el `<p>` del TS envuelve a varias líneas).
      maxLines: appearanceMaxLines(ap, def: null),
      overflow: TextOverflow.ellipsis,
      textAlign: appearanceTextAlign(ap),
      style: style);
  final bg = appearanceBgColor(ap); // 'rounded px-1' + fondo
  if (bg != null) {
    w = Container(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
        child: w);
  }
  final pad = appearancePaddingY(ap);
  if (pad > 0) w = Padding(padding: EdgeInsets.symmetric(vertical: pad), child: w);
  final shadow = appearanceSlotShadow(ap);
  if (shadow.isNotEmpty) w = DecoratedBox(decoration: BoxDecoration(boxShadow: shadow), child: w);
  final op = appearanceOpacity(ap);
  if (op < 1.0) w = Opacity(opacity: op, child: w);
  return w;
}

Widget _heroHeader(RenderCtx ctx, LayoutComponentNode node) {
  // KRO-198 §7 — un rol se oculta si lo marcó el publisher (`node.hidden`) o si
  // su slotId está en los `hiddenSlots` globales (panel "solo datos"). Sin este
  // gating, un hero insertado a mano con banner/avatar mapeados a un campo imagen
  // (que el strip de hiddenSlots quita de `composition.slots`) pintaría
  // placeholders Y, peor, `ctx.slots[sid]!` reventaría sobre el slot ausente.
  final hiddenRoles = computeHiddenHeroRoles(
    const ['banner', 'avatar', 'title', 'subtitle'],
    node.hidden,
    node.slots,
    ctx.hiddenSlots,
  );
  bool isHidden(String r) => hiddenRoles.contains(r);
  String? sidOf(String r) => node.slots?[r];
  String slotText(String r) {
    final sid = sidOf(r);
    if (sid == null || isHidden(r)) return '';
    final rs = resolveSlot(ctx, sid);
    return rs == null ? '' : composeText(rs);
  }
  String? slotImage(String r) {
    final sid = sidOf(r);
    if (sid == null || isHidden(r)) return null;
    // Null-safe: el slot puede no estar en el mapa (stripeado por hiddenSlots).
    final comp = ctx.slots[sid];
    if (comp == null || comp.fields.isEmpty) return null;
    final v = ctx.item[comp.fields.first];
    final s = v is List ? (v.isNotEmpty ? v.first?.toString() : null) : v?.toString();
    return (s != null && s.isNotEmpty) ? s : null;
  }

  final title = slotText('title');
  final subtitle = slotText('subtitle');
  final showBanner = !isHidden('banner');
  final showAvatar = !isHidden('avatar');
  final bannerUrl = slotImage('banner');
  final avatarUrl = slotImage('avatar');

  Widget avatarCircle() => Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: KromiaTokens.greenLight,
            border: Border.all(color: KromiaTokens.bgSurface, width: 3)),
        clipBehavior: Clip.antiAlias,
        child: avatarUrl != null ? ctx.imageBuilder(avatarUrl, fit: BoxFit.cover) : const SizedBox(),
      );

  return Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      // banner oculto → ni imagen ni fallback ni solape (§1.B / §3 "solo datos").
      if (showBanner)
        Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomCenter,
          children: [
            Padding(
              padding: EdgeInsets.only(bottom: showAvatar ? 40 : 0),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: bannerUrl != null
                    ? ctx.imageBuilder(bannerUrl, fit: BoxFit.cover)
                    : ColoredBox(color: KromiaTokens.peach),
              ),
            ),
            if (showAvatar) Positioned(bottom: 0, child: avatarCircle()),
          ],
        )
      else if (showAvatar)
        // sin banner no hay nada que solapar → avatar suelto, centrado.
        Padding(padding: const EdgeInsets.only(top: KromiaTokens.space4), child: Center(child: avatarCircle())),
      if (title.isNotEmpty)
        Padding(padding: const EdgeInsets.only(top: KromiaTokens.space4), child: Text(title, textAlign: TextAlign.center, style: KromiaTokens.title)),
      if (subtitle.isNotEmpty) Text(subtitle, textAlign: TextAlign.center, style: KromiaTokens.body.copyWith(color: KromiaTokens.muted)),
    ],
  );
}
