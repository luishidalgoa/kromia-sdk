/**
 * KRO-198 — tokenizador de HTML INLINE seguro (PURO, agnóstico de plataforma).
 *
 * Para fields con `behavior: 'html'`. En vez de meter un sanitizador pesado
 * (DOMPurify) o inyectar HTML crudo (`dangerouslySetInnerHTML` → XSS), convierte
 * un subconjunto ALLOWLIST de HTML inline a los MISMOS `MarkdownToken[]` que ya
 * usa el render de markdown, reutilizando el pipeline de tokens → JSX/`TextSpan`.
 *
 * Seguro por construcción:
 *  - Solo se reconocen tags de la allowlist (b/strong, i/em, code, a[href], br,
 *    p, div, li); CUALQUIER otro tag se ELIMINA (su contenido queda como texto).
 *  - Los `href` se sanitizan (solo http/https/mailto/tel/relativo); un `javascript:`
 *    o `data:` se descarta y el enlace cae a texto plano.
 *  - Las entidades se decodifican AL FINAL, así un `&lt;script&gt;` queda como
 *    texto literal `<script>` (no se ejecuta) y el render lo escapa.
 *  - Nunca se emite HTML: la salida son tokens que cada plataforma pinta con sus
 *    primitivas (React escapa por defecto; Flutter usa `TextSpan`).
 *
 * NO soporta (V1): underline (`<u>`), tablas, imágenes, estilos en línea, anidado
 * de estilos (el modelo de tokens es plano, igual que markdown). Para prosa rica,
 * el publisher tiene `behavior: 'markdown'`.
 */

import { parseInlineMarkdown, type MarkdownToken } from './markdown';

/** Esquemas de URL permitidos en `<a href>`. Relativo (`/…`, `#…`, sin esquema)
 *  también se permite. Bloquea javascript:/data:/vbscript:. */
function isSafeHref(href: string): boolean {
  const h = href.trim().toLowerCase();
  if (h === '') return false;
  if (h.startsWith('javascript:') || h.startsWith('data:') || h.startsWith('vbscript:')) return false;
  // Con esquema explícito → solo http(s)/mailto/tel. Sin esquema (relativo) → OK.
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(h);
  if (!scheme) return true;
  return ['http', 'https', 'mailto', 'tel'].includes(scheme[1]);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', copy: '©', reg: '®', trade: '™',
  euro: '€', laquo: '«', raquo: '»', deg: '°', middot: '·',
};

/** Decodifica entidades nombradas comunes + numéricas (&#NN; / &#xHH;). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? m;
  });
}

/**
 * Tokeniza un string HTML inline a `MarkdownToken[]` (allowlist + sanitizado).
 * Estrategia: normalizar saltos de bloque → `\n`, convertir los inline permitidos
 * a su equivalente markdown, sanitizar enlaces, ELIMINAR el resto de tags, decodificar
 * entidades, y delegar el tokenizado final en `parseInlineMarkdown`.
 */
export function parseInlineHtml(html: string): MarkdownToken[] {
  let s = html ?? '';

  // 1. Bloques → saltos de línea (antes de stripear tags genéricos).
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n')
       .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
       .replace(/<\s*p\b[^>]*>/gi, '')
       .replace(/<\s*li\b[^>]*>/gi, '• ')
       .replace(/<\s*\/\s*(div|li|ul|ol)\s*>/gi, '\n')
       .replace(/<\s*(div|ul|ol)\b[^>]*>/gi, '');

  // 2. Inline permitido → markdown. `[^<]*?` evita cruzar tags anidados.
  s = s.replace(/<\s*(b|strong)\b[^>]*>([^<]*?)<\s*\/\s*\1\s*>/gi, '**$2**')
       .replace(/<\s*(i|em)\b[^>]*>([^<]*?)<\s*\/\s*\1\s*>/gi, '*$2*')
       .replace(/<\s*code\b[^>]*>([^<]*?)<\s*\/\s*code\s*>/gi, '`$1`');

  // 3. Enlaces con href sanitizado; si el href no es seguro → solo el texto.
  s = s.replace(
    /<\s*a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([^<]*?)<\s*\/\s*a\s*>/gi,
    (_m, _q, dq, sq, txt) => {
      const href = (dq ?? sq ?? '');
      return isSafeHref(href) ? `[${txt}](${href.trim()})` : txt;
    },
  );

  // 4. Cualquier tag restante (no permitido) → fuera; su contenido queda como texto.
  s = s.replace(/<[^>]+>/g, '');

  // 5. Entidades al final (un `&lt;b&gt;` queda como texto literal, no como bold).
  s = decodeEntities(s);

  return parseInlineMarkdown(s);
}
