/// `buildAutoDetailComposition` — espejo 1:1 de `auto-detail.ts`.
///
/// Heurística pura para rellenar los slots de la vista DETALLE cuando el
/// publisher no declaró una `viewComposition` explícita. Determinística:
/// `(fields) → ViewComposition` con `recipe: hero_protagonico`, `action: none`.
library;

import 'classify.dart';
import 'composition.dart';
import 'field_def.dart';
import 'recipes.dart';

/// Build una `ViewComposition` automática para el DETALLE de una sección —
/// espejo 1:1 de `auto-detail.ts` (incl. la rama recipe-aware KRO-131).
///
/// Si [recipeId] es una receta de detalle distinta de `hero_protagonico` (p.ej.
/// `editorial`, `momento`), mapea a los slots REALES de ESA receta por
/// COMPATIBILIDAD (cover ← primer field imagen, incluso `type:image` SIN
/// behavior; title ← text-short; body ← text-long; …) — NO a los de hero (lo que
/// dejaba la portada vacía al cambiar la receta). Sin [recipeId], o con hero →
/// la heurística hero legacy.
ViewComposition buildAutoDetailComposition(List<FieldDefLike> fields, [String? recipeId]) {
  if (recipeId != null && recipeId != 'hero_protagonico') {
    final m = getRecipeManifest(recipeId);
    if (m != null) {
      final out = <String, SlotComposition>{};
      final used = <String>{};
      bool compat(FieldDefLike f, SlotDefinition slot) =>
          !used.contains(f.key) &&
          isFieldCompatibleWithSlot(
              FieldSpec(f.type, behavior: f.behavior), SlotSpec(slot.accepts));
      for (final slot in m.slots) {
        if (slot.kind == 'composable') {
          final ks = fields.where((f) => compat(f, slot)).take(4).map((f) => f.key).toList();
          if (ks.isNotEmpty) {
            out[slot.id] = SlotComposition(fields: ks);
            used.addAll(ks);
          }
        } else {
          FieldDefLike? found;
          for (final f in fields) {
            if (compat(f, slot)) {
              found = f;
              break;
            }
          }
          if (found != null) {
            out[slot.id] = SlotComposition(fields: [found.key]);
            used.add(found.key);
          }
        }
      }
      return ViewComposition(recipe: recipeId, action: 'none', slots: out);
    }
  }
  return _buildHeroLegacy(fields);
}

/// Heurística legacy `hero_protagonico` (default sin targetRecipe o con hero).
/// Se conserva intacta (los tests la fijan).
ViewComposition _buildHeroLegacy(List<FieldDefLike> fields) {
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
