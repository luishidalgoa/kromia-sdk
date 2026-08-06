/**
 * `interaction.ts` — KRO-74 (B++).
 *
 * Decisor puro de interactividad: dado una `ViewComposition` y un item de datos,
 * devuelve QUÉ acción ejecutar al tap sin ejecutarla. Los clientes traducen la
 * resolución a sus primitivas nativas:
 *   - Studio:  animación in-frame / modal slide-up / accordion / toast URL
 *   - Flutter: Navigator.push() / showModalBottomSheet() / ExpansionTile / launchUrl()
 *
 * Esto cierra el ciclo del SDK polyglot:
 *   1. Modelo  (qué entidades existen)       → `@kromia/core` ✅
 *   2. Datos sintéticos (fake data preview)  → `synthSectionItems` ✅  (KRO-72)
 *   3. Presentación  (format / accent / auto)→ `formatScalar` / `extractAccentSettings` ✅ (KRO-73)
 *   4. Interactividad (qué pasa al tocar)    → `resolveTapAction` ✅  ← esta tarea
 *
 * Pure: sin side effects, sin date/random, sin acceso a UI. Determinístico.
 */

import type { ViewComposition, SlotComposition, RecipeId } from './types';
import type { FieldDefLike } from './types';
import { resolveTargetChain } from './target-chain';
import { buildAutoDetailComposition } from './auto-detail';
import { getRecipeManifest } from './registries/recipes';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado del resolver de tap: qué debe hacer el cliente al tocar un item.
 *
 * `none`     — la card no es interactiva, nada pasa.
 * `navigate` — abrir pantalla completa con `detailComposition`.
 * `modal`    — abrir overlay/bottom-sheet con `detailComposition`.
 * `expand`   — desplegar accordion inline (receta + slots ya resueltos).
 * `external` — abrir URL externa (puede estar vacía si el field no tiene valor).
 */
export type TapResolution =
  | { kind: 'none' }
  | { kind: 'navigate'; detailComposition: ViewComposition }
  | { kind: 'modal';    detailComposition: ViewComposition }
  | { kind: 'expand';   expandRecipe: RecipeId; expandSlots: Record<string, SlotComposition> }
  | { kind: 'external'; url: string };

export interface ResolveTapOptions {
  /**
   * Definiciones de fields de la sección. Si se proveen, se usan para
   * construir la `detailComposition` automática cuando el publisher no
   * declaró `targetComposition` ni `targetRecipe`. Sin ellos, los slots
   * del detalle quedan vacíos (el renderer caerá a su fallback visual).
   */
  fieldDefs?: FieldDefLike[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dado una `ViewComposition` y el item de datos tocado, devuelve la
 * `TapResolution` — qué debe hacer el cliente.
 *
 * Compatibilidad:
 *  - `targetComposition` (KRO-94, cadena multi-salto) tiene prioridad.
 *  - `targetRecipe` (legacy single-hop) se honra si no hay cadena.
 *  - Si no hay nada → `buildAutoDetailComposition(fieldDefs)` como fallback.
 *
 * El `item` solo se usa para `external_link` (extraer la URL del `linkField`).
 * Para los otros tipos de acción el item no afecta a la resolución.
 */
export function resolveTapAction(
  composition: ViewComposition,
  item: Record<string, unknown>,
  options: ResolveTapOptions = {},
): TapResolution {
  const { fieldDefs = [] } = options;

  switch (composition.action) {
    case 'navigate_to_detail':
      return {
        kind: 'navigate',
        detailComposition: resolveDetailComposition(composition, fieldDefs),
      };

    case 'modal':
      return {
        kind: 'modal',
        detailComposition: resolveDetailComposition(composition, fieldDefs),
      };

    case 'expand_inline': {
      const expand = composition.expand;
      if (!expand) return { kind: 'none' };
      return {
        kind: 'expand',
        expandRecipe: expand.recipe,
        expandSlots: expand.slots,
      };
    }

    case 'external_link': {
      const raw = composition.linkField ? item[composition.linkField] : undefined;
      const url = typeof raw === 'string' ? raw.trim() : '';
      return { kind: 'external', url };
    }

    case 'none':
    default:
      return { kind: 'none' };
  }
}

/**
 * Resuelve la mejor `ViewComposition` para mostrar como pantalla de detalle
 * (destino de `navigate_to_detail` o `modal`).
 *
 * Prioridad:
 *   1. `targetComposition` (cadena KRO-94): usa la receta + slots del primer
 *      salto de la cadena; si sus slots están vacíos, los rellena con
 *      `buildAutoDetailComposition(fieldDefs)`. Los saltos más profundos
 *      (`targetComposition.targetComposition`) se preservan tal cual para que
 *      el renderer pueda encadenar navegación.
 *   2. `targetRecipe` (legacy): receta declarada + auto-slots de fieldDefs.
 *   3. Fallback: `buildAutoDetailComposition(fieldDefs)` con `hero_protagonico`.
 */
export function resolveDetailComposition(
  composition: ViewComposition,
  fieldDefs: FieldDefLike[] = [],
): ViewComposition {
  // 1. Cadena multi-salto (KRO-94).
  if (composition.targetComposition) {
    const hop = composition.targetComposition;
    // KRO-317 (2ª parte) — los slots sintetizados son PARA la receta del salto.
    // Sin pasarla, `buildAutoDetailComposition` los construía para la receta por
    // defecto (`hero_protagonico`) y se los encajábamos a otra distinta: los
    // slots que esa receta no tiene se quedan huérfanos y los que sí tiene se
    // quedan vacíos. Es el mismo fallo que se arregló abajo, en la rama de
    // `targetRecipe`, y que en el detalle de sección se veía como una portada en
    // blanco. Sobrevivía aquí porque esta rama es la multi-salto (KRO-94) y se
    // arregló solo la otra.
    const autoSlots = buildAutoDetailComposition(fieldDefs, hop.recipe).slots;
    const slots = hop.slots && Object.keys(hop.slots).length > 0
      ? hop.slots
      : autoSlots;
    return {
      recipe:  hop.recipe,
      action:  hop.action,
      slots,
      // KRO-133 — el DETALLE puede tener su propio diseño por BLOQUES
      // (`layout`) + slots deshabilitados/custom (`slotOverrides`) + posición de
      // acento. El tipo `TargetComposition` los declara y Studio los persiste,
      // pero antes se PERDÍAN aquí → el cliente (Flutter) caía siempre al preset
      // en vez de pintar el lienzo guardado. Se propagan tal cual.
      ...(hop.layout         ? { layout: hop.layout }                 : {}),
      ...(hop.slotOverrides  ? { slotOverrides: hop.slotOverrides }   : {}),
      ...(hop.accentPosition ? { accentPosition: hop.accentPosition } : {}),
      ...(hop.targetComposition ? { targetComposition: hop.targetComposition } : {}),
      ...(hop.expand            ? { expand: hop.expand }                         : {}),
      ...(hop.linkField         ? { linkField: hop.linkField }                   : {}),
    };
  }

  // 2. Legacy targetRecipe.
  if (composition.targetRecipe) {
    const manifest = getRecipeManifest(composition.targetRecipe);
    if (manifest && manifest.kind === 'detail') {
      // KRO-317 — la receta destino se le PASA al constructor.
      //
      // Antes se llamaba sin ella, así que la heurística legacy producía slots
      // de `hero_protagonico` (`banner`, `avatar`, `subtitle`…) y acto seguido se
      // les pegaba encima la etiqueta de OTRA receta. Editorial iba entonces a
      // buscar su `cover` a una composición que no lo tenía → **portada vacía**,
      // y lo mismo con el `slideshow` de momento.
      //
      // Studio arregló exactamente esto en su lado (KRO-131) y dejó el motivo
      // escrito en `SectionAppPreview.tsx`; esta copia del SDK se quedó con la
      // versión rota. Mismo fallo corregido en un sitio y olvidado en el de al
      // lado — que es como se ven distintos el AppPreview y la app pintando la
      // MISMA sección.
      return {
        ...buildAutoDetailComposition(fieldDefs, composition.targetRecipe),
        recipe: composition.targetRecipe,
      };
    }
  }

  // 3. Fallback auto.
  return buildAutoDetailComposition(fieldDefs);
}

/**
 * KRO-74 — Auto-elige la mejor receta de detalle para los fields de una sección.
 *
 * `hero_protagonico` cuando hay imagen prominente (avatar/banner/cover/thumbnail
 * o `type=image`). `editorial` cuando la sección es mayormente texto/fecha/stats
 * sin imagen dominante. `momento` cuando hay galería de imágenes.
 *
 * Pure: `(fieldDefs) => RecipeId`. Determinístico.
 */
export function resolveTargetRecipe(fieldDefs: FieldDefLike[]): RecipeId {
  const hasGallery = fieldDefs.some(f =>
    ['gallery', 'slideshow', 'card_multiview'].includes(f.behavior ?? '') ||
    f.type === 'array<image>',
  );
  if (hasGallery) return 'momento';

  const hasMainImage = fieldDefs.some(f =>
    ['avatar', 'banner', 'cover', 'thumbnail'].includes(f.behavior ?? '') ||
    f.type === 'image',
  );
  if (hasMainImage) return 'hero_protagonico';

  return 'editorial';
}

/**
 * KRO-74 — Auto-elige la mejor receta de despliegue (expand) para los fields
 * de una sección.
 *
 * `accordion_with_actions` cuando hay fields de enlace (url/email/phone) que
 * el accordion puede convertir en botones de acción. `accordion_simple` si
 * solo hay texto.
 *
 * Pure: `(fieldDefs) => RecipeId`. Determinístico.
 */
export function resolveExpandRecipe(fieldDefs: FieldDefLike[]): RecipeId {
  const hasActionable = fieldDefs.some(f =>
    ['url', 'email', 'phone'].includes(f.behavior ?? ''),
  );
  return hasActionable ? 'accordion_with_actions' : 'accordion_simple';
}

/**
 * Conveniencia: dado una `ViewComposition`, ¿el tap es navegable o no?
 * Útil para que el renderer de lista muestre el cursor "pointer" solo
 * cuando hay algo que tocar.
 */
export function isTappable(composition: ViewComposition): boolean {
  return composition.action !== 'none';
}

/**
 * Conveniencia: ¿la acción del primer tap abre una pantalla nueva (vs inline)?
 * `navigate_to_detail` y `modal` abren pantalla; `expand_inline` y
 * `external_link` no salen de la lista.
 */
export function opensNewScreen(composition: ViewComposition): boolean {
  return (
    composition.action === 'navigate_to_detail' ||
    composition.action === 'modal'
  );
}
