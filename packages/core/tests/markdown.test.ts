/**
 * KRO-131 — tokenizador de markdown inline (puro, compartido Studio↔Flutter).
 */
import { describe, it, expect } from 'vitest';
import { parseInlineMarkdown } from '../src/markdown';

describe('parseInlineMarkdown', () => {
  it('texto plano → un único token text', () => {
    expect(parseInlineMarkdown('hola mundo')).toEqual([{ type: 'text', value: 'hola mundo' }]);
  });

  it('**negrita** → token bold', () => {
    expect(parseInlineMarkdown('Soy **Ignis** aquí')).toEqual([
      { type: 'text', value: 'Soy ' },
      { type: 'bold', value: 'Ignis' },
      { type: 'text', value: ' aquí' },
    ]);
  });

  it('*cursiva* y _cursiva_ → token italic', () => {
    expect(parseInlineMarkdown('*a* y _b_')).toEqual([
      { type: 'italic', value: 'a' },
      { type: 'text', value: ' y ' },
      { type: 'italic', value: 'b' },
    ]);
  });

  it('`code` → token code', () => {
    expect(parseInlineMarkdown('usa `year`')).toEqual([
      { type: 'text', value: 'usa ' },
      { type: 'code', value: 'year' },
    ]);
  });

  it('[texto](url) → token link con href', () => {
    expect(parseInlineMarkdown('ver [aquí](https://x.io)')).toEqual([
      { type: 'text', value: 'ver ' },
      { type: 'link', value: 'aquí', href: 'https://x.io' },
    ]);
  });

  it('saltos de línea → tokens break entre líneas', () => {
    expect(parseInlineMarkdown('a\nb')).toEqual([
      { type: 'text', value: 'a' },
      { type: 'break' },
      { type: 'text', value: 'b' },
    ]);
  });

  it('combina marcas en una línea (caso real de lore)', () => {
    expect(parseInlineMarkdown('Las fraguas de **Forjabrasa** e **Ignis**.')).toEqual([
      { type: 'text', value: 'Las fraguas de ' },
      { type: 'bold', value: 'Forjabrasa' },
      { type: 'text', value: ' e ' },
      { type: 'bold', value: 'Ignis' },
      { type: 'text', value: '.' },
    ]);
  });

  it('string vacío → lista vacía de contenido (sin crashear)', () => {
    expect(parseInlineMarkdown('')).toEqual([]);
  });
});
