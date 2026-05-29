/**
 * KRO-70 — Documentación rica compartida por los registries del SDK.
 *
 * El SDK es el source-of-truth de los conceptos del contrato (field types,
 * behaviors, recipes, actions, slot kinds). Su descripción rica (la
 * "enciclopedia" estilo Paradox/CK3) vive AQUÍ, junto a la definición, para
 * que cualquier host la herede sin drift:
 *   - Studio la consume vía `@kromia/core` para tooltips + drawer + wiki.
 *   - Flutter (KRO-83) la espejará desde el mismo `.json` del KRP.
 *
 * Cada `*Definition` del SDK ya tiene `description` (el "short", una frase).
 * Este mixin añade los campos opcionales que enriquecen el tooltip y la
 * página wiki. El frontend deriva su `EncyclopediaEntry` mapeando
 * `displayName → title`, `description → short` y estos campos 1:1.
 */

/** Ejemplo del catálogo real (Holy Cards, Mundial 2026, …) para "atar a la realidad". */
export interface EncyclopediaExample {
  /** Título corto del ejemplo. */
  title: string;
  /** Una frase explicando el caso. */
  description: string;
}

/**
 * Campos de documentación rica que un concepto del SDK puede declarar.
 * Todos opcionales: el mínimo viable de un concepto es `description` (short).
 */
export interface EncyclopediaDoc {
  /** "Úsalo cuando…" — guía decisional. ≤ 280 chars. */
  whenToUse?: string;

  /** Explicación completa en Markdown — drawer + wiki. Tecnicismos OK. */
  long?: string;

  /** Ejemplos del catálogo real. */
  examples?: ReadonlyArray<EncyclopediaExample>;

  /**
   * Slugs de la enciclopedia conectados (ej. `'behavior:year'`,
   * `'concept:slot'`). Pueden apuntar a categorías que vivan en el host
   * (p.ej. `concept:` es Studio-only) — son strings libres, el SDK no los
   * resuelve, solo los declara. Máx 6 para no saturar el tooltip.
   */
  related?: ReadonlyArray<string>;

  /**
   * Sinónimos / términos que, si aparecen en el texto de OTRO tooltip,
   * deben auto-enlazarse a este concepto (encadenamiento estilo CK3).
   * Ej. el type `text` podría tener aliases `['texto', 'string']`.
   */
  aliases?: ReadonlyArray<string>;
}
