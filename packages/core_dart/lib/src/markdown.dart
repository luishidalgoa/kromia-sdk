/// KRO-131 — tokenizador de markdown INLINE (PURO). Espejo 1:1 de `markdown.ts`.
///
/// Para fields `behavior:'markdown'` (lore/relato/descripcion…). Convierte un
/// string en una lista PLANA de tokens que cada plataforma renderiza con su piel
/// (@kromia/react → JSX, @kromia/flutter → TextSpan) → markdown IDÉNTICO sin
/// reimplementar el parser. Soporta `**negrita**` · `*cursiva*`/`_cursiva_` ·
/// `` `code` `` · `[texto](url)` · saltos de línea (token `break`). No es parser
/// de bloque.
library;

/// Token de markdown inline. `type`: `text|bold|italic|code|link|break`.
/// `value` = contenido (vacío en `break`); `href` solo en `link`.
class MarkdownToken {
  final String type;
  final String value;
  final String? href;
  const MarkdownToken(this.type, {this.value = '', this.href});
}

// Precedencia: negrita (**) · code (`) · link ([..](..)) · cursiva (* o _).
final RegExp _inlineRe =
    RegExp(r'\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_');

/// Tokeniza UNA línea (sin `\n`) a tokens inline.
List<MarkdownToken> _tokenizeLine(String text) {
  final out = <MarkdownToken>[];
  var last = 0;
  for (final m in _inlineRe.allMatches(text)) {
    if (m.start > last) {
      out.add(MarkdownToken('text', value: text.substring(last, m.start)));
    }
    if (m.group(1) != null) {
      out.add(MarkdownToken('bold', value: m.group(1)!));
    } else if (m.group(2) != null) {
      out.add(MarkdownToken('code', value: m.group(2)!));
    } else if (m.group(3) != null) {
      out.add(MarkdownToken('link', value: m.group(3)!, href: m.group(4)));
    } else if (m.group(5) != null) {
      out.add(MarkdownToken('italic', value: m.group(5)!));
    } else if (m.group(6) != null) {
      out.add(MarkdownToken('italic', value: m.group(6)!));
    }
    last = m.end;
  }
  if (last < text.length) {
    out.add(MarkdownToken('text', value: text.substring(last)));
  }
  return out;
}

/// Tokeniza un string markdown inline completo. Los `\n` → tokens `break` entre
/// líneas, así el render de cada plataforma solo recorre la lista.
List<MarkdownToken> parseInlineMarkdown(String text) {
  final out = <MarkdownToken>[];
  final lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (i > 0) out.add(const MarkdownToken('break'));
    out.addAll(_tokenizeLine(lines[i]));
  }
  return out;
}
