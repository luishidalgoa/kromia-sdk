import 'package:flutter/widgets.dart';
import 'package:flutter_layout_grid/flutter_layout_grid.dart' hide GridPlacement;
import 'package:kromia_core/kromia_core.dart';

import 'grid_layout.dart';
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
      // KRO-217 — propaga la apariencia del slot de imágenes (forma/aspect/objectFit/
      // efectos/encuadre) a la galería; antes la ignoraba (cover fijo).
      inner = isHidden('images')
          ? null
          : imageRow(ctx, rawList('images'), label: roleLabel('images'), appearance: ctx.slots[sidOf('images')]?.appearance);
    case 'gallery_grid':
      inner = isHidden('images')
          ? null
          : imageGrid(ctx, rawList('images'), label: roleLabel('images'), appearance: ctx.slots[sidOf('images')]?.appearance);
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
    // KRO-221/222 — apariencia efectiva POR-CAMPO (igual que `StatsRow.tsx`, que
    // calcula `ap = mergeFieldAppearance(...)`): el publisher puede recortar/clampar
    // cada stat por separado.
    final ap = mergeFieldAppearance(comp.appearance, comp.fieldAppearances, k);
    // KRO-217 §18.1 — el VALOR aplica la apariencia EFECTIVA (color/tipografía/
    // recorte) sobre una base SIN color: a falta de `appearance.textColor` propio,
    // hereda el color base del contenedor (`surface.textColor`, el DefaultTextStyle
    // del LayoutRenderer). Antes fijaba `KromiaTokens.body`/`overline` (colores del
    // tema) → NO heredaban → stats verdes sobre navy (el bug del "dark-on-dark").
    final valueStyle = applyAppearanceText(
        const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, height: 1.4, fontFeatures: [FontFeature.tabularFigures()]),
        ap);
    final labelColor = appearanceTextColor(ap); // color propio del slot, o null → hereda
    cells.add(Expanded(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // KRO-198 — paridad con `StatsRow.tsx`: VALOR `text-lg` (18px) bold tabular.
        // KRO-222 — recorta por `truncateChars` + "…"; líneas por `appearance.truncate`.
        Text(applyAppearanceTruncate(formatScalar(v, def), ap),
            maxLines: appearanceMaxLines(ap), overflow: TextOverflow.ellipsis, style: valueStyle),
        if (def?.label != null && def!.label!.isNotEmpty)
          // KRO-222 — la ETIQUETA envuelve a 2 líneas (line-clamp-2). Mantiene su rol
          // de caption: color propio si lo hay; si no, hereda el base ATENUADO (§18.1
          // "la etiqueta sigue el color, sobre el mismo texto base legible").
          _statLabel(def.label!.toUpperCase(), labelColor, appearanceMaxLines(ap, def: 2)),
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

/// Etiqueta de una estadística (caption 10px uppercase). Con [color] propio del
/// slot lo aplica; sin él, hereda el color base del contenedor (surface.textColor)
/// ATENUADO al 70% para conservar el rol de caption (equivale a `muted-foreground`
/// pero sobre el texto base legible del acabado — no un gris fijo que se pierde).
Widget _statLabel(String text, Color? color, int? maxLines) {
  final t = Text(text,
      maxLines: maxLines, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.0, height: 1.4, color: color));
  return color == null ? Opacity(opacity: 0.7, child: t) : t;
}

/// KRO-220 — chips de un slot composable. Builder de chip ÚNICO por-field (la
/// apariencia efectiva = `mergeFieldAppearance(base, fieldAppearances, key)`),
/// invocado igual con 1 ó N campos. Con `chipGrid` → rejilla 2D (mismo motor que
/// los bloques: computeGrid + flutter_layout_grid) + `chipWidth` fill/content;
/// sin él → flex-wrap histórico (retro-compat).
Widget _badgeRow(RenderCtx ctx, String? sid) {
  if (sid == null) return const SizedBox.shrink();
  final r = resolveSlot(ctx, sid);
  if (r == null) return const SizedBox.shrink();
  final chips = <({String key, Widget chip, SlotAppearance? ap})>[];
  for (final f in r.fields) {
    final txt = formatScalar(f.value, f.def);
    if (txt.isEmpty) continue;
    final ap = mergeFieldAppearance(r.appearance, r.fieldAppearances, f.key); // efectiva por-chip
    Widget chip = badgePill(applyAppearanceTruncate(txt, ap), ap);
    final shadow = appearanceSlotShadow(ap);
    if (shadow.isNotEmpty) chip = DecoratedBox(decoration: BoxDecoration(boxShadow: shadow), child: chip);
    final op = appearanceOpacity(ap);
    if (op < 1.0) chip = Opacity(opacity: op, child: chip);
    chips.add((key: f.key, chip: chip, ap: ap));
  }
  if (chips.isEmpty) return const SizedBox.shrink();

  final comp = ctx.slots[sid];
  final grid = comp?.chipGrid;
  if (grid != null) return _chipGrid(grid, comp!.chipPlacements, chips);

  // flex-wrap histórico (chipWidth se ignora aquí; align → justify del row).
  final align = switch (r.appearance?.align) {
    'center' => WrapAlignment.center,
    'right' => WrapAlignment.end,
    _ => WrapAlignment.start,
  };
  return Wrap(alignment: align, spacing: KromiaTokens.space2, runSpacing: KromiaTokens.space2, children: [for (final c in chips) c.chip]);
}

/// Rejilla 2D de chips (`chipGrid`): N columnas iguales `1fr` + gap; cada chip en
/// su `chipPlacements[key]` (auto-flow al omitir start) vía computeGrid +
/// flutter_layout_grid (mismo motor que el contenedor). `chipWidth`: content →
/// `Align` posiciona el chip; fill (def) → el chip llena la celda.
Widget _chipGrid(ChipGrid grid, Map<String, GridPlacement>? placements,
    List<({String key, Widget chip, SlotAppearance? ap})> chips) {
  final cols = grid.columns < 1 ? 1 : grid.columns;
  final gap = KromiaTokens.gap(grid.gap);
  final synth = [for (final c in chips) LayoutSlotNode(slot: c.key, place: placements?[c.key])];
  final g = computeGrid(LayoutContainerNode(kind: 'grid', columns: cols, gap: grid.gap, children: synth), synth);
  return LayoutBuilder(builder: (context, c) {
    final maxW = c.hasBoundedWidth ? c.maxWidth : MediaQuery.of(context).size.width;
    final cellW = ((maxW - gap * (cols - 1)) / cols).clamp(1.0, double.infinity).toDouble();
    return LayoutGrid(
      gridFit: GridFit.passthrough,
      columnGap: gap,
      rowGap: gap,
      columnSizes: List.filled(cols, FixedTrackSize(cellW)),
      rowSizes: g.rows,
      children: [
        for (var i = 0; i < g.cells.length && i < chips.length; i++)
          _chipCell(chips[i]).withGridPlacement(
            columnStart: g.cells[i].columnStart,
            columnSpan: g.cells[i].columnSpan,
            rowStart: g.cells[i].rowStart,
            rowSpan: g.cells[i].rowSpan,
          ),
      ],
    );
  });
}

/// chipWidth en la celda: 'content' → `Align` (justify-self por `align`); 'fill'
/// (def) → el chip llena la celda (align ya movió el texto vía su textAlign).
Widget _chipCell(({String key, Widget chip, SlotAppearance? ap}) c) {
  if (c.ap?.chipWidth != 'content') return c.chip; // fill (default)
  final align = switch (c.ap?.align) {
    'center' => Alignment.center,
    'right' => Alignment.centerRight,
    _ => Alignment.centerLeft,
  };
  return Align(alignment: align, child: c.chip);
}

Widget _sectionTitle(RenderCtx ctx, String? sid) {
  final comp = sid == null ? null : ctx.slots[sid];
  final first = (comp != null && comp.fields.isNotEmpty) ? comp.fields.first : null;
  final formatted = first != null ? formatScalar(ctx.item[first], ctx.defFor(first)) : '';
  final shown = formatted.isNotEmpty ? formatted : (ctx.defFor(first)?.label ?? '');
  if (shown.isEmpty) return const SizedBox.shrink();
  // KRO-217 — honra la apariencia del slot (color/tamaño/peso vía applyAppearanceText
  // + alineación + recorte + efecto + padding vertical). `uppercase` + el tracking de
  // `overline` son la IDENTIDAD del título de sección: defaults pisables por la apariencia.
  final ap = comp?.appearance;
  Widget t = Text(
    shown.toUpperCase(),
    maxLines: appearanceMaxLines(ap, def: 2),
    overflow: TextOverflow.ellipsis,
    textAlign: appearanceTextAlign(ap),
    style: applyAppearanceText(KromiaTokens.overline, ap),
  );
  final padY = appearancePaddingY(ap);
  if (padY > 0) t = Padding(padding: EdgeInsets.symmetric(vertical: padY), child: t);
  final shadow = appearanceSlotShadow(ap);
  if (shadow.isNotEmpty) t = DecoratedBox(decoration: BoxDecoration(boxShadow: shadow), child: t);
  final op = appearanceOpacity(ap);
  if (op < 1.0) t = Opacity(opacity: op, child: t);
  return t;
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
