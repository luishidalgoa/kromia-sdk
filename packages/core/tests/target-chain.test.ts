/**
 * KRO-94 Fase B — cadena de navegación multi-salto.
 *   - `resolveTargetChain`: normaliza legacy single-hop + nuevo multi-hop.
 *   - `validateComposition`: reglas de la cadena (recipe/action/profundidad).
 */
import { describe, it, expect } from 'vitest';
import { resolveTargetChain, targetChainDepth, MAX_TARGET_DEPTH } from '../src/target-chain';
import { validateComposition } from '../src/validate';
import type { ViewComposition, TargetComposition } from '../src/types';

/** Composición lista mínima válida. */
function listVC(extra: Partial<ViewComposition> = {}): ViewComposition {
  return { recipe: 'compact_avatar', action: 'navigate_to_detail', slots: {}, ...extra };
}

/** Cadena anidada de `depth` saltos: los intermedios navegan, el último termina. */
function buildChain(depth: number): TargetComposition {
  let node: TargetComposition = { recipe: 'hero_protagonico', action: 'none' };
  for (let i = 1; i < depth; i++) {
    node = { recipe: 'hero_protagonico', action: 'navigate_to_detail', targetComposition: node };
  }
  return node;
}

describe('resolveTargetChain', () => {
  it('action none → cadena vacía (pantalla terminal)', () => {
    expect(resolveTargetChain(listVC({ action: 'none' }))).toEqual([]);
    expect(resolveTargetChain(undefined)).toEqual([]);
  });

  it('legacy navigate_to_detail → 1 hop con el targetRecipe', () => {
    const chain = resolveTargetChain(listVC({ action: 'navigate_to_detail', targetRecipe: 'editorial' }));
    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({ leadingAction: 'navigate_to_detail', recipe: 'editorial' });
  });

  it('legacy modal sin targetRecipe → reusa la receta de la lista', () => {
    const chain = resolveTargetChain(listVC({ action: 'modal' }));
    expect(chain[0]).toMatchObject({ leadingAction: 'modal', recipe: 'compact_avatar' });
  });

  it('legacy expand_inline → recipe del expand', () => {
    const chain = resolveTargetChain(listVC({
      action: 'expand_inline',
      expand: { recipe: 'accordion_simple', slots: {} },
    }));
    expect(chain[0]).toMatchObject({ leadingAction: 'expand_inline', recipe: 'accordion_simple' });
  });

  it('legacy external_link → linkField, sin receta', () => {
    const chain = resolveTargetChain(listVC({ action: 'external_link', linkField: 'web' }));
    expect(chain[0]).toMatchObject({ leadingAction: 'external_link', linkField: 'web' });
    expect(chain[0].recipe).toBeUndefined();
  });

  it('multi-hop targetComposition → saltos en orden con su leadingAction', () => {
    const vc = listVC({
      action: 'navigate_to_detail',
      targetComposition: {
        recipe: 'hero_protagonico',
        action: 'modal',
        targetComposition: { recipe: 'editorial', action: 'none' },
      },
    });
    const chain = resolveTargetChain(vc);
    expect(chain).toHaveLength(2);
    expect(chain[0]).toMatchObject({ leadingAction: 'navigate_to_detail', recipe: 'hero_protagonico' });
    expect(chain[1]).toMatchObject({ leadingAction: 'modal', recipe: 'editorial' });
  });

  it('targetComposition gana sobre targetRecipe (additive)', () => {
    const vc = listVC({
      action: 'navigate_to_detail',
      targetRecipe: 'momento',
      targetComposition: { recipe: 'editorial', action: 'none' },
    });
    const chain = resolveTargetChain(vc);
    expect(chain).toHaveLength(1);
    expect(chain[0].recipe).toBe('editorial');
  });

  it('corta defensivamente en MAX_TARGET_DEPTH+1 ante cadenas absurdas', () => {
    const vc = listVC({ action: 'navigate_to_detail', targetComposition: buildChain(8) });
    expect(resolveTargetChain(vc).length).toBeLessThanOrEqual(MAX_TARGET_DEPTH + 1);
  });

  it('targetChainDepth refleja el nº de saltos', () => {
    expect(targetChainDepth(listVC({ action: 'none' }))).toBe(0);
    expect(targetChainDepth(listVC({ action: 'navigate_to_detail', targetRecipe: 'editorial' }))).toBe(1);
  });
});

describe('validateComposition — cadena multi-salto', () => {
  it('cadena válida de 2 saltos → valid', () => {
    const vc = listVC({
      targetComposition: {
        recipe: 'hero_protagonico',
        action: 'modal',
        targetComposition: { recipe: 'editorial', action: 'none' },
      },
    });
    const { valid, issues } = validateComposition(vc);
    expect(valid).toBe(true);
    expect(issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it('hop con recipe inexistente → error', () => {
    const vc = listVC({
      targetComposition: { recipe: 'no_existe' as any, action: 'none' },
    });
    const { valid, issues } = validateComposition(vc);
    expect(valid).toBe(false);
    expect(issues.some(i => i.level === 'error' && i.path === 'targetComposition.recipe')).toBe(true);
  });

  it('hop con action inválida → error', () => {
    const vc = listVC({
      targetComposition: { recipe: 'hero_protagonico', action: 'teletransporte' as any },
    });
    const { issues } = validateComposition(vc);
    expect(issues.some(i => i.level === 'error' && i.path === 'targetComposition.action')).toBe(true);
  });

  it('cadena que excede MAX_TARGET_DEPTH → error', () => {
    const vc = listVC({ targetComposition: buildChain(MAX_TARGET_DEPTH + 1) });
    const { valid, issues } = validateComposition(vc);
    expect(valid).toBe(false);
    expect(issues.some(i => i.level === 'error' && /profundidad/.test(i.message))).toBe(true);
  });

  it('cadena de exactamente MAX_TARGET_DEPTH saltos → sin error de profundidad', () => {
    const vc = listVC({ targetComposition: buildChain(MAX_TARGET_DEPTH) });
    const { issues } = validateComposition(vc);
    expect(issues.some(i => /profundidad/.test(i.message))).toBe(false);
  });

  it('targetRecipe + targetComposition juntos → warn (no invalida)', () => {
    const vc = listVC({
      targetRecipe: 'hero_protagonico',
      targetComposition: { recipe: 'editorial', action: 'none' },
    });
    const { valid, issues } = validateComposition(vc);
    expect(valid).toBe(true);
    expect(issues.some(i => i.level === 'warn' && i.path === 'targetComposition')).toBe(true);
  });

  it('compat: composición single-hop sin targetComposition válida igual que antes', () => {
    const vc = listVC({ action: 'navigate_to_detail', targetRecipe: 'hero_protagonico' });
    expect(validateComposition(vc).valid).toBe(true);
  });
});
