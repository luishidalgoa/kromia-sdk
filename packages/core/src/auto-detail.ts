/**
 * `auto-detail.ts` — heurística para rellenar slots del detail por defecto.
 *
 * Cuando el publisher no declara `viewComposition` explícito para la vista
 * detail de una sección, el cliente (Studio AppPreview, Flutter renderer)
 * cae a esta función para producir una composition automática razonable.
 *
 * **Heurísticas aplicadas** (en orden, primer match gana):
 *  - `behavior=avatar`         → slot `avatar`
 *  - `behavior=banner`         → slot `banner`
 *  - `behavior=cover|thumbnail`→ slot `banner` (fallback de banner)
 *  - primer text-short         → slot `title`
 *  - primer `year|iso_date`    → slot `subtitle`
 *  - todos los `number`        → slot `stats` (max 4)
 *  - primer text-long          → slot `body`
 *  - primer image-array        → slot `gallery`
 *  - primer card-ref           → slot `related`
 *
 * Pure: `(fields) => ViewComposition`. Sin side effects, sin date/random,
 * sin acceso a UI. Determinístico para los mismos inputs.
 *
 * Historia: extraído de `kromia-studio/src/components/album/
 * SectionAppPreview.tsx:770-837` en KRO-73 (migración B+).
 */

import type { ViewComposition, SlotComposition } from './types';
import type { FieldDefLike } from './types';
import { getRecipeManifest } from './registries/recipes';
import { isFieldCompatibleWithSlot } from './classify';

/**
 * Build una `ViewComposition` automática para el detail de una sección
 * cuyo publisher no declaró una composition explícita.
 *
 * Usa `hero_protagonico` como recipe por defecto (la más completa, asume
 * imagen prominente arriba). El caller puede sustituir el recipe si tiene
 * uno mejor para su caso (e.g. `editorial_minimo` si la sección es texto
 * puro), pero el shape de slots producido sirve para casi cualquier detail.
 *
 * @param fields  Lista de fields de la sección. Solo se consultan
 *                `key`, `type`, `behavior`. Compatible estructuralmente
 *                con `CardFieldDefinition[]` de Studio.
 * @returns       ViewComposition con `recipe: 'hero_protagonico'`,
 *                `action: 'none'` (detail no tiene siguiente nivel de
 *                navegación en V1), y `slots` rellenos por heurística.
 */
export function buildAutoDetailComposition(
  fields: FieldDefLike[],
  recipeId?: ViewComposition['recipe'],
): ViewComposition {
  // KRO-131 — recipe-aware: si el publisher eligió un `targetRecipe` que NO es
  // hero_protagonico (p.ej. editorial/momento), mapeamos a los slots REALES de
  // ESE recipe (vía manifest + compatibilidad), no a los de hero. Antes la
  // heurística producía siempre slots de hero (banner/avatar) y, al cambiar la
  // receta a editorial, su slot `cover` quedaba huérfano → portada vacía. Aquí
  // cover ← primer field tipo imagen, title ← text-short, body ← text-long, etc.,
  // por compatibilidad real del slot (incluye `type:image` SIN behavior).
  if (recipeId && recipeId !== 'hero_protagonico') {
    const m = getRecipeManifest(recipeId);
    if (m) {
      const out: Record<string, SlotComposition> = {};
      const used = new Set<string>();
      for (const slot of m.slots) {
        if (slot.kind === 'composable') {
          const ks = fields
            .filter(f => !used.has(f.key) && isFieldCompatibleWithSlot(f, slot as any))
            .slice(0, 4).map(f => f.key);
          if (ks.length) { out[slot.id] = { fields: ks }; ks.forEach(k => used.add(k)); }
        } else {
          const f = fields.find(ff => !used.has(ff.key) && isFieldCompatibleWithSlot(ff, slot as any));
          if (f) { out[slot.id] = { fields: [f.key] }; used.add(f.key); }
        }
      }
      return { recipe: recipeId, action: 'none', slots: out };
    }
  }
  return buildHeroLegacy(fields);
}

/** Heurística legacy `hero_protagonico` (KRO-44/73). Default cuando no hay
 *  `targetRecipe` o es el propio hero. Se conserva intacta (los tests la fijan). */
function buildHeroLegacy(
  fields: FieldDefLike[],
): ViewComposition {
  const slots: Record<string, SlotComposition> = {};

  const pickFirst = (predicate: (f: FieldDefLike) => boolean): string | undefined => {
    return fields.find(predicate)?.key;
  };

  // Avatar
  const avatarKey = pickFirst(f => f.behavior === 'avatar');
  if (avatarKey) slots.avatar = { fields: [avatarKey] };

  // Banner (avatar/banner explícito o cover como fallback)
  const bannerKey = pickFirst(f => f.behavior === 'banner')
    ?? pickFirst(f => f.behavior === 'cover' || f.behavior === 'thumbnail');
  if (bannerKey) slots.banner = { fields: [bannerKey] };

  // Title — primer text-short
  const titleKey = pickFirst(f =>
    (f.type === 'text' || f.type === 'select') &&
    !['url', 'email', 'phone'].includes(f.behavior ?? ''),
  );
  if (titleKey) slots.title = { fields: [titleKey] };

  // Subtitle — primer date/year
  const subtitleKey = pickFirst(f =>
    f.behavior === 'year' || f.behavior === 'iso_date',
  );
  if (subtitleKey) {
    slots.subtitle = { fields: [subtitleKey] };
  }

  // Stats — todos los number (max 4 para no saturar)
  const statsKeys = fields
    .filter(f => f.type === 'number' && f.key !== titleKey)
    .slice(0, 4)
    .map(f => f.key);
  if (statsKeys.length > 0) {
    slots.stats = { fields: statsKeys, orientation: 'horizontal', separator: ' | ' };
  }

  // Body — primer text-long
  const bodyKey = pickFirst(f =>
    f.type === 'textarea' ||
    ['markdown', 'notes', 'html'].includes(f.behavior ?? ''),
  );
  if (bodyKey) slots.body = { fields: [bodyKey] };

  // Gallery — primer image-array
  const galleryKey = pickFirst(f =>
    ['gallery', 'slideshow', 'card_multiview'].includes(f.behavior ?? '') ||
    f.type === 'array<image>',
  );
  if (galleryKey) slots.gallery = { fields: [galleryKey] };

  // Related — primer card-ref
  const relatedKey = pickFirst(f =>
    f.behavior === 'card_index_list' || f.behavior === 'card_code_list',
  );
  if (relatedKey) slots.related = { fields: [relatedKey] };

  return {
    recipe: 'hero_protagonico',
    action: 'none',
    slots,
  };
}

/**
 * Build una `ViewComposition` automática para la LISTA de una sección cuyo
 * publisher no declaró composition. Cierra el hueco frente a
 * `buildAutoDetailComposition`: la LISTA debe usar una recipe `kind:'list'`
 * (cada item inline), NO una `kind:'detail'` (hero), que solo es destino de
 * una acción. Sin esto, un cliente que auto-defaultee con el de detalle pinta
 * un hero inline por cada item — bug visual.
 *
 * Heurística:
 *  - Si hay imagen (behavior avatar/cover/thumbnail/banner o type image) →
 *    recipe `compact_avatar` (slots avatar + title + subtitle).
 *  - Si no → recipe `row_text` (title + subtitle).
 *
 * `action: 'none'` (suelo: la lista renderiza sin navegación). El cliente puede
 * subir a `navigate_to_detail`/`modal` + `buildAutoDetailComposition` como
 * destino cuando implemente la navegación al detalle.
 *
 * Pure: `(fields) => ViewComposition`. Determinístico, sin side effects.
 */
export function buildAutoListComposition(
  fields: FieldDefLike[],
): ViewComposition {
  const slots: Record<string, SlotComposition> = {};

  const pickFirst = (predicate: (f: FieldDefLike) => boolean): string | undefined =>
    fields.find(predicate)?.key;

  const imageKey = pickFirst(f =>
    f.behavior === 'avatar' || f.behavior === 'cover' ||
    f.behavior === 'thumbnail' || f.behavior === 'banner' ||
    f.type === 'image',
  );

  const titleKey = pickFirst(f =>
    (f.type === 'text' || f.type === 'select') &&
    !['url', 'email', 'phone'].includes(f.behavior ?? ''),
  );

  const subtitleKey = pickFirst(f =>
    f.behavior === 'year' || f.behavior === 'iso_date' || f.type === 'number',
  );

  // Con imagen → compact_avatar (avatar + title + subtitle).
  if (imageKey) {
    slots.avatar = { fields: [imageKey] };
    if (titleKey) slots.title = { fields: [titleKey] };
    if (subtitleKey && subtitleKey !== titleKey) slots.subtitle = { fields: [subtitleKey] };
    return { recipe: 'compact_avatar', action: 'none', slots };
  }

  // Sin imagen → row_text (title + subtitle).
  if (titleKey) slots.title = { fields: [titleKey] };
  if (subtitleKey && subtitleKey !== titleKey) slots.subtitle = { fields: [subtitleKey] };
  return { recipe: 'row_text', action: 'none', slots };
}
