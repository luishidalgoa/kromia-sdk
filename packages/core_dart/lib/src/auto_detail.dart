/// `buildAutoDetailComposition` — espejo 1:1 de `auto-detail.ts`.
///
/// Heurística pura para rellenar los slots de la vista DETALLE cuando el
/// publisher no declaró una `viewComposition` explícita. Determinística:
/// `(fields) → ViewComposition` con `recipe: hero_protagonico`, `action: none`.
library;

import 'composition.dart';
import 'field_def.dart';

/// Build una `ViewComposition` automática para el detalle de una sección.
/// Heurísticas (primer match gana), idénticas al TS.
ViewComposition buildAutoDetailComposition(List<FieldDefLike> fields) {
  final slots = <String, SlotComposition>{};

  String? pickFirst(bool Function(FieldDefLike) pred) {
    for (final f in fields) {
      if (pred(f)) return f.key;
    }
    return null;
  }

  // Avatar
  final avatarKey = pickFirst((f) => f.behavior == 'avatar');
  if (avatarKey != null) slots['avatar'] = SlotComposition(fields: [avatarKey]);

  // Banner (banner explícito, o cover/thumbnail como fallback)
  final bannerKey = pickFirst((f) => f.behavior == 'banner') ??
      pickFirst((f) => f.behavior == 'cover' || f.behavior == 'thumbnail');
  if (bannerKey != null) slots['banner'] = SlotComposition(fields: [bannerKey]);

  // Title — primer text-short (no url/email/phone)
  final titleKey = pickFirst((f) =>
      (f.type == 'text' || f.type == 'select') &&
      !['url', 'email', 'phone'].contains(f.behavior ?? ''));
  if (titleKey != null) slots['title'] = SlotComposition(fields: [titleKey]);

  // Subtitle — primer year/iso_date
  final subtitleKey =
      pickFirst((f) => f.behavior == 'year' || f.behavior == 'iso_date');
  if (subtitleKey != null) {
    slots['subtitle'] = SlotComposition(fields: [subtitleKey]);
  }

  // Stats — todos los number (max 4), excluyendo el title
  final statsKeys = fields
      .where((f) => f.type == 'number' && f.key != titleKey)
      .take(4)
      .map((f) => f.key)
      .toList();
  if (statsKeys.isNotEmpty) {
    slots['stats'] = SlotComposition(
        fields: statsKeys, orientation: 'horizontal', separator: ' | ');
  }

  // Body — primer text-long
  final bodyKey = pickFirst((f) =>
      f.type == 'textarea' ||
      ['markdown', 'notes', 'html'].contains(f.behavior ?? ''));
  if (bodyKey != null) slots['body'] = SlotComposition(fields: [bodyKey]);

  // Gallery — primer image-array
  final galleryKey = pickFirst((f) =>
      ['gallery', 'slideshow', 'card_multiview'].contains(f.behavior ?? '') ||
      f.type == 'array<image>');
  if (galleryKey != null) slots['gallery'] = SlotComposition(fields: [galleryKey]);

  // Related — primer card-ref
  final relatedKey = pickFirst(
      (f) => f.behavior == 'card_index_list' || f.behavior == 'card_code_list');
  if (relatedKey != null) {
    slots['related'] = SlotComposition(fields: [relatedKey]);
  }

  return ViewComposition(
      recipe: 'hero_protagonico', action: 'none', slots: slots);
}

/// Build una `ViewComposition` automática para la LISTA de una sección sin
/// composition — espejo 1:1 de `buildAutoListComposition` (auto-detail.ts).
///
/// La lista DEBE usar una recipe `kind:'list'` (cada item inline), NUNCA un hero
/// (`kind:'detail'`, que solo es destino de una acción). Heurística:
///  - Si hay imagen (behavior avatar/cover/thumbnail/banner o type image) →
///    `compact_avatar` (avatar + title + subtitle).
///  - Si no → `row_text` (title + subtitle).
/// `action: 'none'`. Determinística, sin side effects.
ViewComposition buildAutoListComposition(List<FieldDefLike> fields) {
  final slots = <String, SlotComposition>{};

  String? pickFirst(bool Function(FieldDefLike) pred) {
    for (final f in fields) {
      if (pred(f)) return f.key;
    }
    return null;
  }

  final imageKey = pickFirst((f) =>
      f.behavior == 'avatar' ||
      f.behavior == 'cover' ||
      f.behavior == 'thumbnail' ||
      f.behavior == 'banner' ||
      f.type == 'image');

  final titleKey = pickFirst((f) =>
      (f.type == 'text' || f.type == 'select') &&
      !['url', 'email', 'phone'].contains(f.behavior ?? ''));

  final subtitleKey = pickFirst((f) =>
      f.behavior == 'year' || f.behavior == 'iso_date' || f.type == 'number');

  // Con imagen → compact_avatar.
  if (imageKey != null) {
    slots['avatar'] = SlotComposition(fields: [imageKey]);
    if (titleKey != null) slots['title'] = SlotComposition(fields: [titleKey]);
    if (subtitleKey != null && subtitleKey != titleKey) {
      slots['subtitle'] = SlotComposition(fields: [subtitleKey]);
    }
    return ViewComposition(recipe: 'compact_avatar', action: 'none', slots: slots);
  }

  // Sin imagen → row_text.
  if (titleKey != null) slots['title'] = SlotComposition(fields: [titleKey]);
  if (subtitleKey != null && subtitleKey != titleKey) {
    slots['subtitle'] = SlotComposition(fields: [subtitleKey]);
  }
  return ViewComposition(recipe: 'row_text', action: 'none', slots: slots);
}
