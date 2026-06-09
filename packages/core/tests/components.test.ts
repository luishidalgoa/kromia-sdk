/**
 * KRO-133 Capa 2 — spec del catálogo de componentes prefabricados + validación
 * del nodo `component` en el árbol de layout. Ground-truth cross-language.
 */
import { describe, it, expect } from 'vitest';
import {
  COMPONENT_REGISTRY, allComponents, getComponentDef, COMPONENT_IDS,
} from '../src/registries/components';
import { validateLayout, collectLayoutSlots } from '../src/layout';
import type { LayoutContainerNode } from '../src/types';

describe('COMPONENT_REGISTRY', () => {
  it('expone card + ref_gallery', () => {
    expect(Object.keys(COMPONENT_REGISTRY).sort()).toEqual(['card', 'ref_gallery']);
    expect(allComponents()).toHaveLength(2);
    expect(COMPONENT_IDS).toEqual(['card', 'ref_gallery']);
  });

  it('getComponentDef resuelve y devuelve undefined para id desconocido', () => {
    const card = getComponentDef('card');
    expect(card?.displayName).toBe('Carta');
    expect(card?.roles.map(r => r.id)).toEqual(['media', 'title', 'caption', 'badge']);
    expect(getComponentDef('nope')).toBeUndefined();
  });

  it('cada rol declara accepts no vacío', () => {
    for (const c of allComponents()) {
      for (const r of c.roles) {
        expect(r.accepts.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('validateLayout — nodo component', () => {
  const slots = { img: { fields: ['foto'] }, nom: { fields: ['nombre'] } };

  const tree = (component: string, map: Record<string, string>): LayoutContainerNode => ({
    type: 'container', kind: 'stack',
    children: [{ type: 'component', component, slots: map }],
  });

  it('componente válido con roles mapeados → ok', () => {
    const res = validateLayout(tree('card', { media: 'img', title: 'nom' }), { slots });
    expect(res.ok).toBe(true);
  });

  it('componente desconocido → error', () => {
    const res = validateLayout(tree('nope', { media: 'img' }), { slots });
    expect(res.ok).toBe(false);
    expect(res.issues.some(i => i.level === 'error' && /desconocido/i.test(i.message))).toBe(true);
  });

  it('slot mapeado no declarado → error', () => {
    const res = validateLayout(tree('card', { media: 'fantasma', title: 'nom' }), { slots });
    expect(res.ok).toBe(false);
    expect(res.issues.some(i => i.level === 'error' && /no está declarado/.test(i.message))).toBe(true);
  });

  it('rol requerido sin mapear → warn (no rompe)', () => {
    const res = validateLayout(tree('card', { media: 'img' }), { slots }); // falta title (requerido)
    expect(res.ok).toBe(true); // warn, no error
    expect(res.issues.some(i => i.level === 'warn' && /Título/.test(i.message))).toBe(true);
  });

  it('collectLayoutSlots devuelve los slots mapeados del componente', () => {
    expect(collectLayoutSlots(tree('card', { media: 'img', title: 'nom' }))).toEqual(['img', 'nom']);
  });
});
