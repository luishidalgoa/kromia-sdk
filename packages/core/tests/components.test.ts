/**
 * KRO-133 Capa 2 — spec del catálogo de componentes prefabricados + validación
 * del nodo `component` en el árbol de layout. Ground-truth cross-language.
 */
import { describe, it, expect } from 'vitest';
import {
  COMPONENT_REGISTRY, COMPONENT_CATEGORIES, allComponents, getComponentDef,
  componentsByCategory, COMPONENT_IDS,
} from '../src/registries/components';
import { validateLayout, collectLayoutSlots } from '../src/layout';
import type { LayoutContainerNode } from '../src/types';

describe('COMPONENT_REGISTRY', () => {
  it('expone los componentes base + los carruseles + stats + divider (KRO-133/155)', () => {
    expect(Object.keys(COMPONENT_REGISTRY).sort()).toEqual([
      'badge_row', 'card', 'cards_carousel', 'carousel_centered', 'carousel_peek', 'divider',
      'gallery_grid', 'hero_header', 'ref_gallery', 'section_title', 'stats_row',
    ]);
    expect(allComponents()).toHaveLength(11);
    expect(COMPONENT_IDS).toEqual([
      'card', 'badge_row', 'section_title', 'hero_header', 'ref_gallery',
      'carousel_peek', 'carousel_centered', 'gallery_grid', 'cards_carousel', 'divider', 'stats_row',
    ]);
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

  it('toda definición tiene una category ∈ catálogo', () => {
    const valid = new Set(COMPONENT_CATEGORIES.map(c => c.id));
    for (const c of allComponents()) {
      expect(valid.has(c.category)).toBe(true);
    }
  });

  it('componentsByCategory agrupa en orden y sin categorías vacías', () => {
    const groups = componentsByCategory();
    // orden estable por COMPONENT_CATEGORIES.order
    expect(groups.map(g => g.category)).toEqual(['basic', 'header', 'media', 'cards']);
    // cada grupo tiene componentes y todos pertenecen a su categoría
    for (const g of groups) {
      expect(g.components.length).toBeGreaterThan(0);
      expect(g.components.every(c => c.category === g.category)).toBe(true);
    }
    // los 3 de imágenes caen en 'media'
    const media = groups.find(g => g.category === 'media');
    expect(media?.components.map(c => c.id).sort()).toEqual(['carousel_centered', 'carousel_peek', 'gallery_grid']);
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
