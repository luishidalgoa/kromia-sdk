/// Espejo de `SlotAcceptKind` (TS `packages/core/src/types.ts`).
///
/// Son los "tipos de slot" que un field puede satisfacer. Se manejan como
/// `String` (igual que el union de TS) para paridad directa con el corpus
/// cross-language y con el contrato `.json`.
class SlotAcceptKind {
  SlotAcceptKind._();

  /// type=image (cualquier imagen scalar — unifica avatar/banner/cover/thumbnail).
  static const String image = 'image';

  /// [alias legacy de 'image'] mantenido por backward-compat.
  static const String imageAvatar = 'image-avatar';

  /// [alias legacy de 'image'].
  static const String imageBanner = 'image-banner';

  /// [alias legacy de 'image'].
  static const String imageCover = 'image-cover';

  /// type=array<image> / behavior: gallery / slideshow / card_multiview.
  static const String imageArray = 'image-array';

  /// type: text, select, number (texto plano corto).
  static const String textShort = 'text-short';

  /// type: textarea (+ behavior markdown/notes/html).
  static const String textLong = 'text-long';

  /// type: number (stats — value semantico).
  static const String number = 'number';

  /// behavior: year / iso_date / year_list.
  static const String date = 'date';

  /// behavior: rating / enum / ordinal_enum.
  static const String badge = 'badge';

  /// behavior: color_hex (kind propio — no se mezcla con text-short).
  static const String color = 'color';

  /// behavior: card_index_list / card_code_list.
  static const String cardRef = 'card-ref';

  /// behavior: url / email / phone (link clicable).
  static const String url = 'url';

  /// Wildcard — un slot con accepts ['any'] admite cualquier field.
  static const String any = 'any';

  /// Conjunto canonico de todos los kinds (paridad con el union TS).
  static const Set<String> all = <String>{
    image, imageAvatar, imageBanner, imageCover, imageArray,
    textShort, textLong, number, date, badge, color, cardRef, url, any,
  };
}
