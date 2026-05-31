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
class AppearanceProp {
  AppearanceProp._();
  static const String shape = 'shape';
  static const String aspect = 'aspect';
  static const String imageFocus = 'imageFocus';
  static const String align = 'align';
  static const String weight = 'weight';
  static const String size = 'size';
  static const String truncate = 'truncate';
  static const String truncateChars = 'truncateChars';
  static const String accentPosition = 'accentPosition';
  static const String paddingY = 'paddingY';
}

/// Qué props de apariencia aplican a cada kind (= TS APPEARANCE_PROPS_BY_KIND).
const Map<String, List<String>> appearancePropsByKind = <String, List<String>>{
  SlotAcceptKind.image: ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  SlotAcceptKind.imageAvatar: ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  SlotAcceptKind.imageBanner: ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  SlotAcceptKind.imageCover: ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  SlotAcceptKind.imageArray: ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  SlotAcceptKind.textShort: ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.textLong: ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.number: ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.date: ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.url: ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.badge: ['size', 'truncate', 'truncateChars', 'paddingY'],
  SlotAcceptKind.color: ['accentPosition', 'size', 'paddingY'],
  SlotAcceptKind.cardRef: ['paddingY'],
  SlotAcceptKind.any: [
    'shape', 'aspect', 'imageFocus', 'align', 'weight', 'size',
    'truncate', 'truncateChars', 'paddingY',
  ],
};

/// Props de `SlotAppearance` editables para un slot con esos accepts. Multi-
/// accept → UNIÓN de props, en orden canónico estable.
List<String> getAvailableAppearanceProps(List<String> accepts) {
  if (accepts.isEmpty) return <String>[];
  const order = <String>[
    'shape', 'aspect', 'imageFocus', 'align', 'weight', 'size',
    'truncate', 'truncateChars', 'accentPosition', 'paddingY',
  ];
  final union = <String>{};
  for (final kind in accepts) {
    final props = appearancePropsByKind[kind];
    if (props != null) union.addAll(props);
  }
  return order.where(union.contains).toList(growable: false);
}
