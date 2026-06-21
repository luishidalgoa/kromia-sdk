/**
 * KRO-198 — `computeHiddenHeroRoles`: regla de ocultado de roles de cabecera
 * (hero_header) en el motor de layout. Un rol se oculta si lo marcó el publisher
 * (nodeHidden) o si su slotId está en los hiddenSlots globales (panel "solo datos"
 * del detalle de carta). Espejable a Flutter (la decisión vive en core).
 */
import { describe, it, expect } from 'vitest';
import { computeHiddenHeroRoles } from '../src/layout';

const ROLES = ['banner', 'avatar', 'title', 'subtitle'] as const;

describe('computeHiddenHeroRoles', () => {
  it('sin nada oculto → []', () => {
    expect(computeHiddenHeroRoles(ROLES, undefined, { banner: 'b', title: 't' }, undefined)).toEqual([]);
  });

  it('respeta node.hidden (oculto por el publisher)', () => {
    expect(computeHiddenHeroRoles(ROLES, ['avatar'], { avatar: 'a', title: 't' }, undefined)).toEqual(['avatar']);
  });

  it('oculta un rol cuyo slotId está en hiddenSlots globales', () => {
    // banner→slotId 'banner' (en hiddenSlots) → oculto; title→slotId 'nombre'
    // (NO en hiddenSlots) → visible. Comprueba que cruza por slotId, no por rol.
    const out = computeHiddenHeroRoles(ROLES, undefined, { banner: 'banner', title: 'nombre' }, ['banner', 'title']);
    expect(out).toEqual(['banner']);
  });

  it('cruza por slotId, no por nombre de rol', () => {
    // title→slotId 'title' (en hiddenSlots) → oculto.
    const out = computeHiddenHeroRoles(ROLES, undefined, { banner: 'banner', title: 'title' }, ['banner', 'title']);
    expect(out.sort()).toEqual(['banner', 'title']);
  });

  it('combina node.hidden + hiddenSlots (sin duplicar)', () => {
    const out = computeHiddenHeroRoles(
      ROLES,
      ['avatar'],
      { banner: 'banner', avatar: 'avatar', title: 'nombre' },
      ['banner', 'avatar'], // avatar repetido entre node.hidden y hiddenSlots
    );
    expect(out.sort()).toEqual(['avatar', 'banner']);
  });

  it('un rol sin slot mapeado y no marcado → no se oculta', () => {
    expect(computeHiddenHeroRoles(ROLES, undefined, { title: 'nombre' }, ['banner'])).toEqual([]);
  });

  it('hiddenSlots que no mapea a ningún rol → []', () => {
    expect(computeHiddenHeroRoles(ROLES, undefined, { title: 'nombre' }, ['otra-cosa'])).toEqual([]);
  });
});
