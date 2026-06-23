import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import 'markdown_text.dart';
import 'render_ctx.dart';
import 'tokens.dart';
import 'ui/prefabs.dart';
import 'utils/appearance_styles.dart';

/// Slot resuelto: fields (key+def+value), apariencia, apariencia por-field,
/// orientación, separador.
class ResolvedSlot {
  final List<({String key, FieldDefLike? def, Object? value})> fields;
  final SlotAppearance? appearance;

  /// KRO-198 — apariencia POR-FIELD (key → SlotAppearance) para slots composable.
  /// La consume el render de chips/badges; el estilo condicional con `target` ya
  /// viene mergeado aquí (gana sobre el override por-chip).
  final Map<String, SlotAppearance>? fieldAppearances;
  final String orientation;
  final String separator;
  const ResolvedSlot({
    required this.fields,
    this.appearance,
    this.fieldAppearances,
    required this.orientation,
    required this.separator,
  });
}

/// resolveSlot — espejo de `resolveSlot` de recipe-utils. null si el slot está
/// deshabilitado o no existe / sin fields. Aplica el "Estilo por valor" (KRO-198):
/// `resolveConditionalStyling` (contempla la cláusula else) decide el caso/else
/// efectivo; SIN `target` su apariencia se mergea sobre la BASE de la fila (gana),
/// CON `target` se mergea sobre `fieldAppearances[k]` de ESOS chips (gana), sin
/// tocar la base. Sin condicional → camino base byte-idéntico al anterior.
ResolvedSlot? resolveSlot(RenderCtx ctx, String slotId) {
  final comp = ctx.slots[slotId];
  if (comp == null || comp.fields.isEmpty) return null;
  final disabled = ctx.composition.slotOverrides?.disabled ?? const <String>[];
  if (disabled.contains(slotId)) return null;

  final condCase = resolveConditionalStyling(comp.conditionalStyle, ctx.item);
  final condAp = condCase?.appearance;
  final targets = (condCase?.target ?? const <String>[]).where((t) => t.isNotEmpty).toList();

  // SIN target (o sin condAp) → condAp mergea sobre la base de la fila (gana); si
  // no hay condAp o el caso tiene target, la base queda intacta. Espejo de
  // `(condAp && !targets.length) ? {...sc.appearance, ...condAp} : sc.appearance`.
  final appearance = (condAp != null && targets.isEmpty) ? condAp.mergedOver(comp.appearance) : comp.appearance;

  // CON target → condAp mergea sobre fieldAppearances[k] de ESOS chips (gana); la
  // base no se toca. Clonamos el mapa para NO mutar el modelo parseado (compartido
  // entre items de la sección).
  var fieldAppearances = comp.fieldAppearances;
  if (condAp != null && targets.isNotEmpty) {
    final next = <String, SlotAppearance>{...?fieldAppearances};
    for (final k in targets) {
      next[k] = condAp.mergedOver(next[k]); // condAp gana sobre el override por-chip
    }
    fieldAppearances = next;
  }

  return ResolvedSlot(
    fields: [for (final k in comp.fields) (key: k, def: ctx.defFor(k), value: ctx.item[k])],
    appearance: appearance,
    fieldAppearances: fieldAppearances,
    orientation: comp.effectiveOrientation,
    separator: comp.effectiveSeparator,
  );
}

bool _isImage(FieldDefLike? d) => d?.type == 'image' || d?.type == 'array<image>';

bool _isRef(FieldDefLike? d) {
  if (d == null) return false;
  if (d.type == 'cardRef' || d.type == 'sectionRef' || d.type.contains('cardRef') || d.type.contains('sectionRef')) return true;
  return classifyField(FieldSpec(d.type, behavior: d.behavior)).contains(SlotAcceptKind.cardRef);
}

bool _isLongText(FieldDefLike? d) =>
    d != null && classifyField(FieldSpec(d.type, behavior: d.behavior)).contains(SlotAcceptKind.textLong);

String composeText(ResolvedSlot r) {
  final res = composeSlotValues(ComposeSlotInput(
    fields: [for (final f in r.fields) ComposeSlotField(def: f.def, value: f.value)],
    orientation: r.orientation,
    separator: r.separator,
    appearance: r.appearance,
  ));
  return res.truncated ?? res.items.join(res.separator);
}

/// Render del CONTENIDO de un slot (imagen / refs / badge / texto). null si el
/// slot está deshabilitado o no resuelve a datos. Espejo de `SlotContent`.
Widget? slotContent(RenderCtx ctx, String slotId) {
  final r = resolveSlot(ctx, slotId);
  if (r == null) return null;
  final first = r.fields.isEmpty ? null : r.fields.first;
  final ap = r.appearance;
  final pad = appearancePaddingY(ap);
  Widget wrap(Widget w) {
    if (pad > 0) w = Padding(padding: EdgeInsets.symmetric(vertical: pad), child: w);
    // KRO-147 F3 — efecto de slot (shadow + opacity) sobre el wrapper de
    // cualquier slot (imagen/badge/texto/refs). Espejo de `appearanceEffectClasses`.
    final shadow = appearanceSlotShadow(ap);
    if (shadow.isNotEmpty) w = DecoratedBox(decoration: BoxDecoration(boxShadow: shadow), child: w);
    final op = appearanceOpacity(ap);
    if (op < 1.0) w = Opacity(opacity: op, child: w);
    return w;
  }

  // Imagen (array<image> → 1ª url + chip "+N").
  if (_isImage(first?.def)) {
    final raw = first?.value;
    final url = raw is List ? (raw.isNotEmpty ? raw.first?.toString() : null) : raw?.toString();
    if (url == null || url.isEmpty) return null;
    return wrap(imageBox(ctx, url, ap, count: raw is List ? raw.length : null));
  }

  // Referencias → rejilla de mini-cartas. Honra refSize (ancho % de la carta en
  // su celda) y refTap='focus' (celda tappable → ctx.onCardRefTap). Espejo de
  // `MiniCardRefs` (@kromia/react RefGallery).
  if (_isRef(first?.def)) {
    final raw = first?.value;
    final refs = raw is List
        ? raw.map((e) => e.toString()).toList()
        : (raw != null ? <String>[raw.toString()] : <String>[]);
    return wrap(refsGrid(
      ctx,
      refs,
      columns: ctx.refColumns(ap),
      refSize: ap?.refSize,
      onRefTap: (ap?.refTap == 'focus' && ctx.onCardRefTap != null) ? (r) => ctx.onCardRefTap!(r) : null,
    ));
  }

  // Texto.
  final text = composeText(r);
  if (text.isEmpty) return null;
  final shown = appearanceTransform(text, ap);
  if (ap?.display == 'badge') return wrap(badgePill(shown, ap));

  final longText = _isLongText(first?.def);
  final maxLines = appearanceMaxLines(ap, def: longText ? null : 1);

  // KRO-133 — field con `behavior:'markdown'` (body de editorial/momento/hero,
  // lore): se pinta como markdown INLINE (negrita/cursiva/code/links), no string
  // crudo. Espejo de `ScalarText`→`MarkdownText` (@kromia/react): antes salía
  // `**Ignis**` literal porque el motor de bloques pintaba `Text` plano.
  Widget textW;
  if (first?.def?.behavior == 'markdown') {
    textW = markdownText(
      shown,
      base: applyAppearanceText(KromiaTokens.body, ap),
      maxLines: maxLines,
      textAlign: appearanceTextAlign(ap),
    );
  } else {
    textW = Text(
      shown,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      textAlign: appearanceTextAlign(ap),
      style: applyAppearanceText(KromiaTokens.body, ap),
    );
  }
  // bgColor → fondo del bloque de texto (espejo de paletteClass(bgColor,'bg')).
  final bg = appearanceBgColor(ap);
  if (bg != null) textW = Container(color: bg, child: textW);
  return wrap(textW);
}
