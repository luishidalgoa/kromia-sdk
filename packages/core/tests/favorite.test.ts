import { describe, it, expect } from 'vitest';
import { favoriteKey } from '../src/favorite';

describe('favoriteKey', () => {
  it('combina albumId + cardIndex de forma estable', () => {
    expect(favoriteKey('alb1', 3)).toBe('alb1::3');
    expect(favoriteKey('alb1', '3')).toBe('alb1::3'); // number y string colisionan a propósito
  });

  it('distingue álbumes distintos con el mismo índice', () => {
    expect(favoriteKey('a', 1)).not.toBe(favoriteKey('b', 1));
  });
});
