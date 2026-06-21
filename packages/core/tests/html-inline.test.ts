/**
 * Tests de `parseInlineHtml` (KRO-198) — allowlist + sanitización.
 *
 * Ground truth cross-language: la salida son `MarkdownToken[]`; un futuro SDK
 * Dart debe producir los mismos tokens para el mismo HTML. Lo crítico es la
 * SEGURIDAD: ningún tag fuera de la allowlist debe sobrevivir, los href se
 * sanitizan, y las entidades se decodifican como TEXTO (no como tags activos).
 */
import { describe, it, expect } from 'vitest';
import { parseInlineHtml } from '../src/html-inline';

describe('parseInlineHtml — allowlist inline', () => {
  it('<b> y <strong> → bold', () => {
    expect(parseInlineHtml('<b>hola</b>')).toEqual([{ type: 'bold', value: 'hola' }]);
    expect(parseInlineHtml('<strong>x</strong>')).toEqual([{ type: 'bold', value: 'x' }]);
  });
  it('<i> y <em> → italic', () => {
    expect(parseInlineHtml('<i>a</i>')).toEqual([{ type: 'italic', value: 'a' }]);
    expect(parseInlineHtml('<em>b</em>')).toEqual([{ type: 'italic', value: 'b' }]);
  });
  it('<code> → code', () => {
    expect(parseInlineHtml('<code>x()</code>')).toEqual([{ type: 'code', value: 'x()' }]);
  });
  it('tags con atributos también se reconocen', () => {
    expect(parseInlineHtml('<strong class="x">y</strong>')).toEqual([{ type: 'bold', value: 'y' }]);
  });
  it('<br> y </p> → break', () => {
    const toks = parseInlineHtml('a<br>b');
    expect(toks).toEqual([{ type: 'text', value: 'a' }, { type: 'break' }, { type: 'text', value: 'b' }]);
  });
});

describe('parseInlineHtml — enlaces sanitizados', () => {
  it('href http(s) → link', () => {
    expect(parseInlineHtml('<a href="https://kromia.app">web</a>')).toEqual([
      { type: 'link', value: 'web', href: 'https://kromia.app' },
    ]);
  });
  it('mailto/tel permitidos', () => {
    expect(parseInlineHtml('<a href="mailto:a@b.com">mail</a>')).toEqual([
      { type: 'link', value: 'mail', href: 'mailto:a@b.com' },
    ]);
  });
  it('javascript: → cae a TEXTO (no link)', () => {
    expect(parseInlineHtml('<a href="javascript:alert(1)">click</a>')).toEqual([
      { type: 'text', value: 'click' },
    ]);
  });
  it('data: → cae a texto', () => {
    expect(parseInlineHtml("<a href='data:text/html,x'>y</a>")).toEqual([
      { type: 'text', value: 'y' },
    ]);
  });
});

describe('parseInlineHtml — seguridad (tags fuera de allowlist)', () => {
  it('<script> se ELIMINA (su contenido queda como texto, no se ejecuta)', () => {
    const toks = parseInlineHtml('<script>alert(1)</script>');
    expect(toks).toEqual([{ type: 'text', value: 'alert(1)' }]);
  });
  it('<img onerror> se elimina por completo', () => {
    // El tag se quita; no queda nada renderizable salvo, quizá, texto vacío.
    const toks = parseInlineHtml('<img src=x onerror="alert(1)">');
    const joined = toks.map(t => ('value' in t ? t.value : '')).join('');
    expect(joined).toBe('');
    expect(toks.some(t => t.type === 'link')).toBe(false);
  });
  it('entidad &lt;b&gt; queda como TEXTO literal, no como bold', () => {
    const toks = parseInlineHtml('&lt;b&gt;x&lt;/b&gt;');
    // Tras decodificar, el string es "<b>x</b>" pero ya NO se reinterpreta como tag.
    const joined = toks.map(t => ('value' in t ? t.value : '')).join('');
    expect(joined).toBe('<b>x</b>');
    expect(toks.some(t => t.type === 'bold')).toBe(false);
  });
  it('entidades comunes se decodifican', () => {
    expect(parseInlineHtml('a&amp;b&nbsp;c')).toEqual([{ type: 'text', value: 'a&b c' }]);
  });
  it('entidad numérica decimal y hex', () => {
    expect(parseInlineHtml('&#169;&#x20AC;')).toEqual([{ type: 'text', value: '©€' }]);
  });
});

describe('parseInlineHtml — mixto realista', () => {
  it('combina bold + link + break', () => {
    const toks = parseInlineHtml('<b>Lore:</b> ver <a href="https://x.io">aquí</a><br>fin');
    expect(toks).toEqual([
      { type: 'bold', value: 'Lore:' },
      { type: 'text', value: ' ver ' },
      { type: 'link', value: 'aquí', href: 'https://x.io' },
      { type: 'break' },
      { type: 'text', value: 'fin' },
    ]);
  });
  it('vacío → []', () => {
    expect(parseInlineHtml('')).toEqual([]);
  });
});
