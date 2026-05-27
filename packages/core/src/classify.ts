/**
 * Helpers de clasificación / validación / composición de slots.
 *
 * - `classifyField`: dado un field (type + behavior), devuelve qué
 *   `SlotAcceptKind` lo aceptarían. CRÍTICO: esta lógica debe estar
 *   sincronizada con `behaviors.renderAsSlotKind`. El generator usa
 *   `renderAsSlotKind` para construir la sección `slotAcceptKinds[*].behaviorIds`
 *   del KRP, pero el runtime de Studio (y futuro Flutter) usa
 *   `classifyField` para validar field↔slot. Si una de las dos cambia y
 *   la otra no, hay drift entre el contrato declarado y el runtime real.
 *
 * - `isFieldCompatibleWithSlot`: composición de classifyField + slot.accepts.
 *
 * - `getEffectiveSlots`: resuelve la lista final de slots de una composition
 *   combinando manifest base + slotOverrides per-instance (KRO-58 V5).
 *
 * - `validateSlotOverrides`: validación structural de los overrides.
 */

import type { SlotAcceptKind, SlotOverrides, CustomSlotDefinition } from './types';
import type { SlotDefinition, RecipeManifest } from './registries/recipes';

/**
 * Devuelve qué SlotAcceptKinds le aplican a un field, según su type+behavior.
 *
 * "any" siempre se incluye — un slot con `accepts: ['any']` aceptaría cualquier
 * field. Útil para slots flexibles tipo "meta" donde el publisher decide.
 *
 * El orden no importa — el caller hace intersección con `slot.accepts`.
 */
export function classifyField(field: { type: string; behavior?: string }): SlotAcceptKind[] {
  // KRO-71 Fase 2E — Set para evitar duplicados (ej: textarea + behavior
  // markdown/notes/html ambos disparaban 'text-long', resultando en
  // duplicado en el array). El bug existía desde el principio en Studio,
  // pero los consumidores hacían `kinds.includes(...)` que tolera dupes.
  // Los tests cross-language NO lo toleran — paridad por construcción
  // exige output determinístico.
  const kinds = new Set<SlotAcceptKind>(['any']);
  const b = field.behavior;

  // KRO-69 follow-up — image unificado. type=image matchea el kind 'image'
  // (canónico nuevo) Y los 3 legacy aliases (image-avatar/banner/cover)
  // por backward-compat con manifests + composiciones existentes. El
  // SLOT decide cómo se ve vía su id (avatar/thumb/banner) + appearance.
  if (field.type === 'image') {
    kinds.add('image');
    kinds.add('image-avatar');
    kinds.add('image-banner');
    kinds.add('image-cover');
  }
  if (b === 'gallery' || b === 'slideshow' || b === 'card_multiview')   kinds.add('image-array');
  if (field.type === 'array<image>' && !b)                              kinds.add('image-array');
  if (b === 'markdown' || b === 'notes' || b === 'html')                kinds.add('text-long');
  if (b === 'rating' || b === 'enum' || b === 'ordinal_enum')           kinds.add('badge');
  if (b === 'card_index_list' || b === 'card_code_list')                kinds.add('card-ref');
  if (b === 'year' || b === 'iso_date' || b === 'year_list')            kinds.add('date');
  if (b === 'url' || b === 'email' || b === 'phone')                    kinds.add('url');
  // KRO-69 follow-up — color_hex tiene su propio kind 'color' (no se
  // mezcla con text-short). Un slot title/subtitle NO debe aceptar un
  // field de color: semánticamente es un color, no texto. Para mapearlo
  // hace falta un slot que acepte 'color' explícitamente (meta, accent).
  if (b === 'color_hex')                                                kinds.add('color');

  // Por type base — fallback cuando no hay behavior específico que clasifique.
  // KRO-69 follow-up: number también matchea text-short (un número se puede
  // renderizar como texto en slots text-short tipo title/subtitle).
  if (field.type === 'number') {
    kinds.add('number');
    kinds.add('text-short');
  }
  // Excepción: color_hex es type=text técnicamente pero NO debe entrar
  // en text-short (un color no es texto a efectos de slot).
  if ((field.type === 'text' || field.type === 'select') && b !== 'color_hex') kinds.add('text-short');
  if (field.type === 'textarea')                     kinds.add('text-long');

  return [...kinds];
}

/** ¿Este field puede ir en este slot? */
export function isFieldCompatibleWithSlot(
  field: { type: string; behavior?: string },
  slot:  SlotDefinition,
): boolean {
  // Si el slot acepta 'any' → todo cabe.
  if (slot.accepts.includes('any')) return true;
  const fieldKinds = classifyField(field);
  return slot.accepts.some(k => fieldKinds.includes(k));
}

// ── KRO-58 V5 — Slots customizables ────────────────────────────────────────
//
// `getEffectiveSlots` resuelve la lista FINAL de slots que el renderer debe
// pintar para una `ViewComposition` concreta. Combina el manifest base
// con los overrides per-instance:
//   1. Empieza por los slots del manifest base.
//   2. Excluye los slots cuyo id esté en `overrides.disabled`.
//   3. Añade los slots custom de `overrides.custom`.
//   4. Reordena según `overrides.order` si se proveyó.
//
// Función pura, sin side-effects. Backward-compat: si overrides es
// undefined/empty, devuelve `manifest.slots` tal cual (mismo orden).

export function getEffectiveSlots(
  manifest:   RecipeManifest | undefined,
  overrides:  SlotOverrides | undefined,
): SlotDefinition[] {
  if (!manifest) return [];
  const baseSlots   = manifest.slots;
  const disabled    = new Set(overrides?.disabled ?? []);
  const customSlots = overrides?.custom ?? [];

  // Filtra los base que NO están desactivados + añade los custom.
  const enabled: SlotDefinition[] = [
    ...baseSlots.filter(s => !disabled.has(s.id)),
    ...customSlots.map(c => c as SlotDefinition),
  ];

  // Si no hay order custom, devuelve en orden natural.
  const orderHint = overrides?.order;
  if (!orderHint || orderHint.length === 0) return enabled;

  // Aplica el order custom: primero los ids que aparecen en `order`,
  // luego los slots no listados al final en su orden natural.
  const byId = new Map(enabled.map(s => [s.id, s]));
  const ordered: SlotDefinition[] = [];
  const used = new Set<string>();
  for (const id of orderHint) {
    const slot = byId.get(id);
    if (slot && !used.has(id)) {
      ordered.push(slot);
      used.add(id);
    }
  }
  for (const slot of enabled) {
    if (!used.has(slot.id)) ordered.push(slot);
  }
  return ordered;
}

/**
 * Valida un `SlotOverrides` contra un manifest. Devuelve la primera
 * incoherencia que encuentra (id colliding, custom mal formado, etc.)
 * o null si está OK.
 */
export function validateSlotOverrides(
  manifest:  RecipeManifest | undefined,
  overrides: SlotOverrides | undefined,
): string | null {
  if (!overrides) return null;
  if (!manifest) return null;
  const baseIds = new Set(manifest.slots.map(s => s.id));
  const seenCustomIds = new Set<string>();

  for (const c of overrides.custom ?? []) {
    if (!c.id || !c.id.trim()) {
      return `Custom slot sin id`;
    }
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(c.id)) {
      return `Custom slot id inválido: "${c.id}" (debe ser lowercase + alfanumérico)`;
    }
    if (baseIds.has(c.id)) {
      return `Custom slot "${c.id}" colisiona con un slot base del manifest`;
    }
    if (seenCustomIds.has(c.id)) {
      return `Custom slot "${c.id}" duplicado`;
    }
    seenCustomIds.add(c.id);
    if (!c.label || !c.label.trim()) {
      return `Custom slot "${c.id}" sin label`;
    }
    if (c.kind !== 'single' && c.kind !== 'composable') {
      return `Custom slot "${c.id}" tiene kind inválido: ${c.kind}`;
    }
    if (!Array.isArray(c.accepts) || c.accepts.length === 0) {
      return `Custom slot "${c.id}" sin accepts declarados`;
    }
  }

  for (const id of overrides.disabled ?? []) {
    if (!baseIds.has(id)) {
      return `Slot deshabilitado "${id}" no existe en el manifest base`;
    }
  }

  return null;
}

/**
 * Helper de tipo: trata un CustomSlotDefinition como SlotDefinition para
 * reusar la lógica downstream sin duplicar código.
 */
export function customSlotToSlotDefinition(c: CustomSlotDefinition): SlotDefinition {
  return c as SlotDefinition;
}
