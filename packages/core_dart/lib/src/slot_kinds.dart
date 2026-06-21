/// Slot Acceptance Kinds — espejo 1:1 de `registries/slot-kinds.ts`.
///
/// Metadata humana (label + description) de cada `SlotAcceptKind`, más el mapa
/// de props de apariencia editables por kind (KRO-69 V6). El renderer Flutter
/// consulta esto para etiquetar slots y para ignorar props que no aplican.
library;

import 'slot_accept_kind.dart';

/// Metadata corta de un kind (label para pills + description para tooltip).
class SlotKindMeta {
  final String label;
  final String description;
  const SlotKindMeta(this.label, this.description);
}

/// Single source of truth de la metadata por kind. Orden estable (= TS).
const Map<String, SlotKindMeta> slotAcceptKindMeta = <String, SlotKindMeta>{
  SlotAcceptKind.textShort: SlotKindMeta(
    'Texto',
    'Fields tipo text o select (nombre, ciudad, opciones cerradas).',
  ),
  SlotAcceptKind.textLong: SlotKindMeta(
    'Texto largo',
    'Fields tipo textarea (descripción, bio, párrafos). También markdown/notes/html.',
  ),
  SlotAcceptKind.number: SlotKindMeta(
    'Número',
    'Fields tipo number (precio, índice, cantidad). Cualquier behavior numérico.',
  ),
  SlotAcceptKind.date: SlotKindMeta(
    'Fecha',
    'Fields con behavior year o iso_date (año de fundación, fecha de evento).',
  ),
  SlotAcceptKind.badge: SlotKindMeta(
    'Badge',
    'Fields con behavior rating, enum u ordinal_enum (rareza, categoría, tier).',
  ),
  SlotAcceptKind.color: SlotKindMeta(
    'Color',
    'Fields con behavior color_hex. Se renderiza como swatch visual (cuadradito coloreado) y futuro accent del wrapper.',
  ),
  SlotAcceptKind.image: SlotKindMeta(
    'Imagen',
    'Cualquier field tipo image. El slot decide cómo se renderiza (circular, banner, cover…) según su id y su Apariencia.',
  ),
  SlotAcceptKind.imageAvatar: SlotKindMeta(
    'Imagen',
    '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.',
  ),
  SlotAcceptKind.imageCover: SlotKindMeta(
    'Imagen',
    '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.',
  ),
  SlotAcceptKind.imageBanner: SlotKindMeta(
    'Imagen',
    '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.',
  ),
  SlotAcceptKind.imageArray: SlotKindMeta(
    'Galería',
    'Fields tipo array<image> o behaviors gallery/slideshow/card_multiview.',
  ),
  SlotAcceptKind.cardRef: SlotKindMeta(
    'Referencia a carta',
    'Fields con behavior card_index_list o card_code_list (referencias a otras cartas).',
  ),
  SlotAcceptKind.url: SlotKindMeta(
    'Enlace',
    'Fields con behavior url, email o phone (links clicables).',
  ),
  SlotAcceptKind.any: SlotKindMeta(
    'Cualquier tipo',
    'Wildcard — acepta cualquier field sin filtrar.',
  ),
};

/// Una entry del catálogo como opción para UI (id + label + description).
class SlotAcceptKindOption {
  final String id;
  final String label;
  final String description;
  const SlotAcceptKindOption(this.id, this.label, this.description);
}

/// Devuelve el catálogo como lista, en orden estable, para iteración en UI.
List<SlotAcceptKindOption> getSlotAcceptKindOptions() {
  return slotAcceptKindMeta.entries
      .map((e) => SlotAcceptKindOption(e.key, e.value.label, e.value.description))
      .toList(growable: false);
}

/// Etiqueta humana corta separada por " / " para los accepts de un slot.
/// 1 accept → su label. N → "Texto / Fecha". 'any' presente → "cualquiera".
/// Vacío → "".
String formatSlotAccepts(List<String> accepts) {
  if (accepts.isEmpty) return '';
  if (accepts.contains(SlotAcceptKind.any)) return 'cualquiera';
  return accepts.map((k) => slotAcceptKindMeta[k]?.label ?? k).join(' / ');
}

// ── KRO-69 V6 — Appearance overrides per-slot ─────────────────────────────

/// Tag de propiedad de apariencia editable. Hay un control UI por cada uno.
/// Espejo del type `AppearanceProp` de TS (26 props). Orden canónico = [allAppearanceProps].
class AppearanceProp {
  AppearanceProp._();
  static const String shape = 'shape';
  static const String aspect = 'aspect';
  static const String objectFit = 'objectFit';
  static const String imageFocus = 'imageFocus';
  static const String align = 'align';
  static const String weight = 'weight';
  static const String italic = 'italic';
  static const String underline = 'underline';
  static const String textTransform = 'textTransform';
  static const String font = 'font';
  static const String lineHeight = 'lineHeight';
  static const String tracking = 'tracking';
  static const String textShadow = 'textShadow';
  static const String size = 'size';
  static const String display = 'display';
  static const String textColor = 'textColor';
  static const String bgColor = 'bgColor';
  static const String truncate = 'truncate';
  static const String truncateChars = 'truncateChars';
  static const String accentPosition = 'accentPosition';
  static const String refSize = 'refSize';
  static const String refColumns = 'refColumns';
  static const String refTap = 'refTap';
  static const String paddingY = 'paddingY';
  static const String opacity = 'opacity';
  static const String shadow = 'shadow';
}

/// Qué props de apariencia aplican a cada kind (= TS `APPEARANCE_PROPS_BY_KIND`).
/// KRO-147 F3 — imagen suma objectFit + opacity/shadow; texto suma tipografía
/// rica (italic/underline/font/lineHeight/tracking/textShadow) + display/textColor/
/// bgColor; badge suma opacity/shadow; card-ref usa shape/refSize/refColumns/refTap.
const Map<String, List<String>> appearancePropsByKind = <String, List<String>>{
  SlotAcceptKind.image: ['shape', 'aspect', 'objectFit', 'imageFocus', 'size', 'paddingY', 'opacity', 'shadow'],
  SlotAcceptKind.imageAvatar: ['shape', 'aspect', 'objectFit', 'imageFocus', 'size', 'paddingY', 'opacity', 'shadow'],
  SlotAcceptKind.imageBanner: ['shape', 'aspect', 'objectFit', 'imageFocus', 'size', 'paddingY', 'opacity', 'shadow'],
  SlotAcceptKind.imageCover: ['shape', 'aspect', 'objectFit', 'imageFocus', 'size', 'paddingY', 'opacity', 'shadow'],
  SlotAcceptKind.imageArray: ['shape', 'aspect', 'objectFit', 'imageFocus', 'size', 'paddingY', 'opacity', 'shadow'],
  SlotAcceptKind.textShort: ['align', 'weight', 'italic', 'underline', 'textTransform', 'font', 'lineHeight', 'tracking', 'textShadow', 'size', 'truncate', 'truncateChars', 'display', 'textColor', 'bgColor', 'paddingY'],
  SlotAcceptKind.textLong: ['align', 'weight', 'italic', 'underline', 'textTransform', 'font', 'lineHeight', 'tracking', 'textShadow', 'size', 'truncate', 'truncateChars', 'display', 'textColor', 'bgColor', 'paddingY'],
  SlotAcceptKind.number: ['align', 'weight', 'italic', 'underline', 'textTransform', 'lineHeight', 'tracking', 'textShadow', 'size', 'truncate', 'truncateChars', 'display', 'textColor', 'bgColor', 'paddingY'],
  SlotAcceptKind.date: ['align', 'weight', 'italic', 'underline', 'textTransform', 'lineHeight', 'tracking', 'textShadow', 'size', 'truncate', 'truncateChars', 'display', 'textColor', 'bgColor', 'paddingY'],
  SlotAcceptKind.url: ['align', 'weight', 'italic', 'underline', 'textTransform', 'lineHeight', 'tracking', 'textShadow', 'size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.badge: ['size', 'truncate', 'truncateChars', 'textColor', 'bgColor', 'paddingY', 'opacity', 'shadow'],
  SlotAcceptKind.color: ['accentPosition', 'size', 'paddingY'],
  SlotAcceptKind.cardRef: ['shape', 'refSize', 'refColumns', 'refTap'],
  SlotAcceptKind.any: ['shape', 'aspect', 'objectFit', 'imageFocus', 'align', 'weight', 'textTransform', 'italic', 'underline', 'textShadow', 'size', 'truncate', 'truncateChars', 'paddingY', 'opacity', 'shadow'],
};

/// Catálogo COMPLETO de props de `SlotAppearance` (= TS `ALL_APPEARANCE_PROPS`).
/// Orden canónico estable. El ratchet de conformidad (layout_conformance.dart)
/// exige que el fixture golden las cubra TODAS → fuerza a Flutter a implementarlas.
/// Si añades una prop al modelo `SlotAppearance`, añádela aquí y al fixture.
const List<String> allAppearanceProps = <String>[
  'shape', 'aspect', 'objectFit', 'imageFocus', 'align', 'weight', 'italic', 'underline',
  'textTransform', 'font', 'lineHeight', 'tracking', 'textShadow', 'size', 'display',
  'textColor', 'bgColor', 'truncate', 'truncateChars', 'accentPosition', 'refSize',
  'refColumns', 'refTap', 'paddingY', 'opacity', 'shadow',
];

/// Props de `SlotAppearance` editables para un slot con esos accepts. Multi-
/// accept → UNIÓN de props, en orden canónico estable.
List<String> getAvailableAppearanceProps(List<String> accepts) {
  if (accepts.isEmpty) return <String>[];
  final union = <String>{};
  for (final kind in accepts) {
    final props = appearancePropsByKind[kind];
    if (props != null) union.addAll(props);
  }
  // Orden canónico estable = el del catálogo completo (espejo de TS:
  // `ALL_APPEARANCE_PROPS.filter(p => union.has(p))`).
  return allAppearanceProps.where(union.contains).toList(growable: false);
}
