import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

/// Espejo de `MarkdownText` (@kromia/react `recipe-utils.tsx`): pinta markdown
/// INLINE desde los tokens de `parseInlineMarkdown` (@kromia/core) → `TextSpan`.
/// Para fields con `behavior:'markdown'` (body de editorial/momento/hero, lore de
/// cartas). NO es parser de bloque (sin listas/headings/tablas): el TOKENIZADO
/// vive en el SDK (una sola fuente que Studio y Flutter comparten), aquí solo
/// mapeamos token→span. Soporta **negrita**, *cursiva*/_cursiva_, `code`,
/// [texto](url) y saltos de línea.
Widget markdownText(
  String text, {
  required TextStyle base,
  int? maxLines,
  TextAlign? textAlign,
}) {
  final spans = <InlineSpan>[];
  for (final tk in parseInlineMarkdown(text)) {
    switch (tk.type) {
      case 'break':
        spans.add(const TextSpan(text: '\n'));
      case 'bold':
        spans.add(TextSpan(text: tk.value, style: const TextStyle(fontWeight: FontWeight.w700)));
      case 'italic':
        spans.add(TextSpan(text: tk.value, style: const TextStyle(fontStyle: FontStyle.italic)));
      case 'code':
        spans.add(TextSpan(
          text: tk.value,
          style: TextStyle(
            fontFamily: 'monospace',
            fontSize: base.fontSize != null ? base.fontSize! * 0.85 : null,
            letterSpacing: -0.2,
            backgroundColor: const Color(0x14000000),
          ),
        ));
      case 'link':
        // Igual que el canónico (`underline underline-offset-2`): subrayado,
        // hereda el color del texto base (no se recolorea).
        spans.add(TextSpan(text: tk.value, style: const TextStyle(decoration: TextDecoration.underline)));
      default:
        spans.add(TextSpan(text: tk.value));
    }
  }
  return Text.rich(
    TextSpan(style: base, children: spans),
    maxLines: maxLines,
    overflow: maxLines != null ? TextOverflow.ellipsis : TextOverflow.clip,
    textAlign: textAlign ?? TextAlign.start,
  );
}
