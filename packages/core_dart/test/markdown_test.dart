import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// Espejo de `markdown.test.ts`: tokenizador inline (anti-drift).
void main() {
  test('texto plano → un token text', () {
    final t = parseInlineMarkdown('Ignis el brasaduende');
    expect(t.length, 1);
    expect(t.first.type, 'text');
    expect(t.first.value, 'Ignis el brasaduende');
  });

  test('negrita / cursiva / code / link', () {
    final t = parseInlineMarkdown('Brasaduende de las **fraguas**');
    expect(t.map((e) => e.type), ['text', 'bold']);
    expect(t.last.value, 'fraguas');

    final i = parseInlineMarkdown('un *susurro* y `codigo`');
    expect(i.map((e) => e.type), ['text', 'italic', 'text', 'code']);

    final l = parseInlineMarkdown('ver [ficha](https://x.test)');
    expect(l.last.type, 'link');
    expect(l.last.value, 'ficha');
    expect(l.last.href, 'https://x.test');
  });

  test('salto de línea → token break', () {
    final t = parseInlineMarkdown('linea1\nlinea2');
    expect(t.map((e) => e.type), ['text', 'break', 'text']);
  });

  test('cursiva con guion bajo también', () {
    final t = parseInlineMarkdown('texto _enfasis_ fin');
    expect(t.any((e) => e.type == 'italic' && e.value == 'enfasis'), isTrue);
  });
}
