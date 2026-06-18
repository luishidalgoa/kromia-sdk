/**
 * KRO-131 — tokenizador de markdown INLINE (PURO, agnóstico de plataforma).
 *
 * Para fields con `behavior: 'markdown'` (lore/relato/descripcion…). Convierte un
 * string en una lista PLANA de tokens que cada plataforma renderiza con su piel
 * (`@kromia/react` → JSX, `@kromia/flutter` → `TextSpan`), garantizando markdown
 * IDÉNTICO en ambas sin reimplementar el parser en cada lado.
 *
 * Soporta: `**negrita**` · `*cursiva*` / `_cursiva_` · `` `code` `` ·
 * `[texto](url)` · saltos de línea (token `break`). NO es un parser de bloque
 * (sin listas/headings/tablas) — cubre el grueso del lore de cartas sin meter
 * dependencias. Para prosa rica de wiki, Studio usa su `<Markdown>` completo;
 * esto es solo para el render de cartas/secciones.
 */

export type MarkdownToken =
  | { type: 'text';   value: string }
  | { type: 'bold';   value: string }
  | { type: 'italic'; value: string }
  | { type: 'code';   value: string }
  | { type: 'link';   value: string; href: string }
  | { type: 'break' };

/** Tokeniza UNA línea (sin `\n`) a tokens inline. */
function tokenizeLine(text: string): MarkdownToken[] {
  const out: MarkdownToken[] = [];
  // Orden de precedencia: negrita (**) · code (`) · link ([..](..)) · cursiva (* o _).
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[1] != null)      out.push({ type: 'bold',   value: m[1] });
    else if (m[2] != null) out.push({ type: 'code',   value: m[2] });
    else if (m[3] != null) out.push({ type: 'link',   value: m[3], href: m[4] });
    else if (m[5] != null) out.push({ type: 'italic', value: m[5] });
    else if (m[6] != null) out.push({ type: 'italic', value: m[6] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

/**
 * Tokeniza un string markdown inline COMPLETO. Los saltos de línea se emiten
 * como tokens `break` entre líneas, así el render de cada plataforma solo recorre
 * la lista (sin volver a partir por `\n`). Texto sin marcas → un único token
 * `text`.
 */
export function parseInlineMarkdown(text: string): MarkdownToken[] {
  const out: MarkdownToken[] = [];
  const lines = (text ?? '').split('\n');
  lines.forEach((line, i) => {
    if (i > 0) out.push({ type: 'break' });
    out.push(...tokenizeLine(line));
  });
  return out;
}
