/// Modelo de composición de vista — espejo de los tipos de `types.ts`
/// (`ViewComposition`, `SlotComposition`, `SlotAppearance`, overrides…).
///
/// Es el dato que el publisher persiste por sección en el AlbumSchema
/// (`dataStructure[sectionKey].viewComposition`, OPCIONAL). El cliente Flutter
/// lo lee del backend y, junto al `RecipeManifest` del registry + los datos del
/// álbum, renderiza la vista. Si una sección NO trae viewComposition → render
/// genérico (compat retro).
///
/// Incluye `fromJson` porque estos tipos llegan como JSON del backend (a
/// diferencia de los registries, que son catálogos estáticos).
library;

import 'layout_node.dart';

/// Override de apariencia per-instance — espejo 1:1 de `SlotAppearance` (types.ts).
class SlotAppearance {
  // ── Image-* ──
  final String? shape; // 'circle' | 'square' | 'rounded'
  final String? aspect; // '1:1' | '16:9' | '4:3' | '3:4' | '9:16' | 'free'
  final String? objectFit; // 'cover' (def) | 'contain'
  // ── Texto ──
  final String? align; // 'left' | 'center' | 'right'
  final String? weight; // 'regular' | 'semibold' | 'bold'
  final String? textTransform; // 'none' (def) | 'uppercase'
  final String? font; // 'sans' (def) | 'serif'
  final bool? italic;
  final bool? underline;
  final String? lineHeight; // 'tight' | 'normal' | 'relaxed'
  final String? tracking; // 'tight' | 'normal' | 'wide'
  final String? textShadow; // 'none' (def) | 'sm' | 'md'
  final String? truncate; // '1' | '2' | '3' | 'none'
  final int? truncateChars;
  final ImageFocus? imageFocus;
  final String? accentPosition; // 'top'|'right'|'bottom'|'left'|'none'|'auto'
  // ── Refs (card-ref) ──
  final String? refColumns; // '1' | '2' | '3' | '4'
  final String? refTap; // 'none' | 'focus'
  final num? refSize;
  // ── Generales ──
  final String? size; // 'sm' | 'md' | 'lg' | 'xl'
  final String? paddingY; // 'none' | 'sm' | 'md' | 'lg'
  final String? display; // 'text' (def) | 'badge'
  final String? textColor; // id de paleta o 'field:<col>' (color_hex)
  final String? bgColor; // id de paleta o 'field:<col>'
  final String? opacity; // '100' | '90' | '75' | '50'
  final String? shadow; // 'none' | 'sm' | 'md' | 'lg'

  const SlotAppearance({
    this.shape,
    this.aspect,
    this.objectFit,
    this.align,
    this.weight,
    this.textTransform,
    this.font,
    this.italic,
    this.underline,
    this.lineHeight,
    this.tracking,
    this.textShadow,
    this.truncate,
    this.truncateChars,
    this.imageFocus,
    this.accentPosition,
    this.refColumns,
    this.refTap,
    this.refSize,
    this.size,
    this.paddingY,
    this.display,
    this.textColor,
    this.bgColor,
    this.opacity,
    this.shadow,
  });

  factory SlotAppearance.fromJson(Map<String, dynamic> json) => SlotAppearance(
        shape: json['shape'] as String?,
        aspect: json['aspect'] as String?,
        objectFit: json['objectFit'] as String?,
        align: json['align'] as String?,
        weight: json['weight'] as String?,
        textTransform: json['textTransform'] as String?,
        font: json['font'] as String?,
        italic: json['italic'] as bool?,
        underline: json['underline'] as bool?,
        lineHeight: json['lineHeight'] as String?,
        tracking: json['tracking'] as String?,
        textShadow: json['textShadow'] as String?,
        truncate: json['truncate'] as String?,
        truncateChars: (json['truncateChars'] as num?)?.toInt(),
        imageFocus: json['imageFocus'] == null
            ? null
            : ImageFocus.fromJson(json['imageFocus'] as Map<String, dynamic>),
        accentPosition: json['accentPosition'] as String?,
        refColumns: json['refColumns'] as String?,
        refTap: json['refTap'] as String?,
        refSize: json['refSize'] as num?,
        size: json['size'] as String?,
        paddingY: json['paddingY'] as String?,
        display: json['display'] as String?,
        textColor: json['textColor'] as String?,
        bgColor: json['bgColor'] as String?,
        opacity: json['opacity'] as String?,
        shadow: json['shadow'] as String?,
      );

  /// `this` (usuario) SOBRE [base] (preset): cada campo del usuario gana; los
  /// ausentes caen al preset. Espejo de `{...preset, ...user}` (composeLayoutPreset).
  SlotAppearance mergedOver(SlotAppearance? base) {
    if (base == null) return this;
    return SlotAppearance(
      shape: shape ?? base.shape,
      aspect: aspect ?? base.aspect,
      objectFit: objectFit ?? base.objectFit,
      align: align ?? base.align,
      weight: weight ?? base.weight,
      textTransform: textTransform ?? base.textTransform,
      font: font ?? base.font,
      italic: italic ?? base.italic,
      underline: underline ?? base.underline,
      lineHeight: lineHeight ?? base.lineHeight,
      tracking: tracking ?? base.tracking,
      textShadow: textShadow ?? base.textShadow,
      truncate: truncate ?? base.truncate,
      truncateChars: truncateChars ?? base.truncateChars,
      imageFocus: imageFocus ?? base.imageFocus,
      accentPosition: accentPosition ?? base.accentPosition,
      refColumns: refColumns ?? base.refColumns,
      refTap: refTap ?? base.refTap,
      refSize: refSize ?? base.refSize,
      size: size ?? base.size,
      paddingY: paddingY ?? base.paddingY,
      display: display ?? base.display,
      textColor: textColor ?? base.textColor,
      bgColor: bgColor ?? base.bgColor,
      opacity: opacity ?? base.opacity,
      shadow: shadow ?? base.shadow,
    );
  }

  /// ¿Tiene algún override?
  bool get isNotEmpty =>
      shape != null ||
      aspect != null ||
      objectFit != null ||
      align != null ||
      weight != null ||
      textTransform != null ||
      font != null ||
      italic != null ||
      underline != null ||
      lineHeight != null ||
      tracking != null ||
      textShadow != null ||
      truncate != null ||
      truncateChars != null ||
      imageFocus != null ||
      accentPosition != null ||
      refColumns != null ||
      refTap != null ||
      refSize != null ||
      size != null ||
      paddingY != null ||
      display != null ||
      textColor != null ||
      bgColor != null ||
      opacity != null ||
      shadow != null;
}

/// Punto focal de imagen (object-cover). Defaults: x=50, y=50, zoom=1.
class ImageFocus {
  final double x; // 0..100
  final double y; // 0..100
  final double zoom; // 1..3
  const ImageFocus({this.x = 50, this.y = 50, this.zoom = 1});

  factory ImageFocus.fromJson(Map<String, dynamic> json) => ImageFocus(
        x: (json['x'] as num?)?.toDouble() ?? 50,
        y: (json['y'] as num?)?.toDouble() ?? 50,
        zoom: (json['zoom'] as num?)?.toDouble() ?? 1,
      );
}

/// Composición de un slot: qué fields van en el hueco + cómo se componen.
class SlotComposition {
  /// Keys del schema asignadas al slot.
  final List<String> fields;

  /// Para slots composable. Default 'horizontal'.
  final String? orientation;

  /// Para slots composable. Default ' · '.
  final String? separator;

  /// Receta anidada para slots nestable (card-ref). Profundidad máx 2.
  final NestedViewComposition? nestedComposition;

  /// Override visual per-instance.
  final SlotAppearance? appearance;

  /// KRO-221 — apariencia POR-FIELD dentro de un slot COMPOSABLE (key = field key
  /// del schema → su override). Se MERGE-a sobre `appearance` (la base del slot):
  /// un field sin entrada hereda la base; con entrada la sobreescribe SOLO para
  /// ese field (`mergeFieldAppearance`). DATA — no entra al contrato KRP.
  final Map<String, SlotAppearance>? fieldAppearances;

  const SlotComposition({
    required this.fields,
    this.orientation,
    this.separator,
    this.nestedComposition,
    this.appearance,
    this.fieldAppearances,
  });

  /// Orientación efectiva (aplica el default del SDK).
  String get effectiveOrientation => orientation ?? 'horizontal';

  /// Separador efectivo (aplica el default del SDK).
  String get effectiveSeparator => separator ?? ' · ';

  factory SlotComposition.fromJson(Map<String, dynamic> json) => SlotComposition(
        fields: (json['fields'] as List?)?.map((e) => e.toString()).toList() ??
            const <String>[],
        orientation: json['orientation'] as String?,
        separator: json['separator'] as String?,
        nestedComposition: json['nestedComposition'] == null
            ? null
            : NestedViewComposition.fromJson(
                json['nestedComposition'] as Map<String, dynamic>),
        appearance: json['appearance'] == null
            ? null
            : SlotAppearance.fromJson(json['appearance'] as Map<String, dynamic>),
        fieldAppearances: (json['fieldAppearances'] is Map)
            ? (json['fieldAppearances'] as Map).map((k, v) => MapEntry(
                k.toString(), SlotAppearance.fromJson((v as Map).cast<String, dynamic>())))
            : null,
      );
}

/// Composición anidada (sin action/expand/linkField). Máx depth 2.
class NestedViewComposition {
  final String recipe;
  final Map<String, SlotComposition> slots;
  const NestedViewComposition({required this.recipe, required this.slots});

  factory NestedViewComposition.fromJson(Map<String, dynamic> json) =>
      NestedViewComposition(
        recipe: json['recipe'] as String,
        slots: _parseSlots(json['slots']),
      );
}

/// Pantalla destino navegable (KRO-94 Fase B). Recursiva: cada destino lleva su
/// propia `action` y puede encadenar otra (`targetComposition`). Espejo de
/// `TargetComposition` (types.ts).
class TargetComposition {
  final String recipe;
  final String action;
  final Map<String, SlotComposition>? slots;
  final NestedViewComposition? expand;
  final String? linkField;
  final TargetComposition? targetComposition;

  /// KRO-133 — la pantalla de detalle es editable como una composición completa
  /// (mismo editor que la sección): admite su propio árbol de LAYOUT (modo
  /// Bloques editado en el canvas), overrides de slots y posición del accent.
  /// Espejo de `TargetComposition.layout/slotOverrides/accentPosition` (types.ts).
  /// SIN estos campos, el lienzo que el publisher edita en Studio se descartaba al
  /// parsear → el detalle caía al preset de la receta (drift TS↔Dart).
  final SlotOverrides? slotOverrides;
  final String? accentPosition;
  final LayoutContainerNode? layout;

  const TargetComposition({
    required this.recipe,
    required this.action,
    this.slots,
    this.expand,
    this.linkField,
    this.targetComposition,
    this.slotOverrides,
    this.accentPosition,
    this.layout,
  });

  factory TargetComposition.fromJson(Map<String, dynamic> json) => TargetComposition(
        recipe: (json['recipe'] as String?) ?? '',
        action: (json['action'] as String?) ?? 'none',
        slots: json['slots'] == null ? null : _parseSlots(json['slots']),
        expand: json['expand'] == null
            ? null
            : NestedViewComposition.fromJson(json['expand'] as Map<String, dynamic>),
        linkField: json['linkField'] as String?,
        targetComposition: json['targetComposition'] == null
            ? null
            : TargetComposition.fromJson(
                json['targetComposition'] as Map<String, dynamic>),
        slotOverrides: json['slotOverrides'] == null
            ? null
            : SlotOverrides.fromJson(json['slotOverrides'] as Map<String, dynamic>),
        accentPosition: json['accentPosition'] as String?,
        layout: json['layout'] is Map
            ? LayoutContainerNode.fromJson((json['layout'] as Map).cast<String, dynamic>())
            : null,
      );
}

/// Composición completa de una vista (sección o card).
class ViewComposition {
  final String recipe;
  final String action;
  final Map<String, SlotComposition> slots;
  final NestedViewComposition? expand;
  final String? linkField;
  final String? targetRecipe;

  /// KRO-94 Fase B — cadena de navegación MULTI-SALTO. Si está presente, gana
  /// sobre `targetRecipe` (forma-hoja legacy). Aditivo: un cliente que lo ignore
  /// renderiza solo el primer destino (degradación elegante).
  final TargetComposition? targetComposition;

  final SlotOverrides? slotOverrides;
  final String? accentPosition;

  /// Versión del KRP con la que se guardó la composición (KRO-63). Vive en el
  /// doc persistido (subschema Mongo del backend), NO en la interfaz
  /// `ViewComposition` de types.ts → gap de paridad TS↔persistido a coordinar.
  /// El gate de compat de runtime (KRO-65) lee de aquí. Legacy = null.
  final String? protocolVersion;

  /// KRO-133 Fase 4 — árbol de LAYOUT editable (motor de bloques). Si está
  /// presente, el render lo interpreta (LayoutRenderer); si no, cae al render de
  /// receta clásico. Espejo de `ViewComposition.layout` (types.ts).
  final LayoutContainerNode? layout;

  const ViewComposition({
    required this.recipe,
    required this.action,
    required this.slots,
    this.expand,
    this.linkField,
    this.targetRecipe,
    this.targetComposition,
    this.slotOverrides,
    this.accentPosition,
    this.protocolVersion,
    this.layout,
  });

  factory ViewComposition.fromJson(Map<String, dynamic> json) => ViewComposition(
        recipe: json['recipe'] as String,
        action: (json['action'] as String?) ?? 'none',
        slots: _parseSlots(json['slots']),
        expand: json['expand'] == null
            ? null
            : NestedViewComposition.fromJson(json['expand'] as Map<String, dynamic>),
        linkField: json['linkField'] as String?,
        targetRecipe: json['targetRecipe'] as String?,
        targetComposition: json['targetComposition'] == null
            ? null
            : TargetComposition.fromJson(
                json['targetComposition'] as Map<String, dynamic>),
        slotOverrides: json['slotOverrides'] == null
            ? null
            : SlotOverrides.fromJson(json['slotOverrides'] as Map<String, dynamic>),
        accentPosition: json['accentPosition'] as String?,
        protocolVersion: json['protocolVersion'] as String?,
        layout: json['layout'] is Map
            ? LayoutContainerNode.fromJson((json['layout'] as Map).cast<String, dynamic>())
            : null,
      );
}

/// Overrides per-instance de slots (KRO-58 V5).
class SlotOverrides {
  final List<String>? disabled;
  final List<CustomSlotDefinition>? custom;
  final List<String>? order;
  const SlotOverrides({this.disabled, this.custom, this.order});

  factory SlotOverrides.fromJson(Map<String, dynamic> json) => SlotOverrides(
        disabled: (json['disabled'] as List?)?.map((e) => e.toString()).toList(),
        custom: (json['custom'] as List?)
            ?.map((e) =>
                CustomSlotDefinition.fromJson(e as Map<String, dynamic>))
            .toList(),
        order: (json['order'] as List?)?.map((e) => e.toString()).toList(),
      );
}

/// Slot custom declarado en una composition (mismo shape que SlotDefinition).
class CustomSlotDefinition {
  final String id;
  final String label;
  final String kind; // 'single' | 'composable'
  final List<String> accepts;
  final bool optional;
  final String? description;

  const CustomSlotDefinition({
    required this.id,
    required this.label,
    required this.kind,
    required this.accepts,
    this.optional = false,
    this.description,
  });

  factory CustomSlotDefinition.fromJson(Map<String, dynamic> json) =>
      CustomSlotDefinition(
        id: (json['id'] as String?) ?? '',
        label: (json['label'] as String?) ?? '',
        kind: (json['kind'] as String?) ?? '',
        accepts:
            (json['accepts'] as List?)?.map((e) => e.toString()).toList() ??
                const <String>[],
        optional: json['optional'] as bool? ?? false,
        description: json['description'] as String?,
      );
}

Map<String, SlotComposition> _parseSlots(dynamic raw) {
  if (raw is! Map) return <String, SlotComposition>{};
  final out = <String, SlotComposition>{};
  raw.forEach((k, v) {
    if (v is Map<String, dynamic>) {
      out[k.toString()] = SlotComposition.fromJson(v);
    } else if (v is Map) {
      out[k.toString()] = SlotComposition.fromJson(Map<String, dynamic>.from(v));
    }
  });
  return out;
}
