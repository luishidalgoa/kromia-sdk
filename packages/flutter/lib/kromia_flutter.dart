/// `kromia_flutter` — motor de render del árbol de LAYOUT de Kromia para Flutter.
/// Equivalente Dart de `@kromia/react`. Consume el modelo de `kromia_core` y lo
/// pinta. KRO-133 Fase 4 / KRO-83.
library kromia_flutter;

export 'src/layout_renderer.dart' show LayoutRenderer;
export 'src/render_ctx.dart' show RenderCtx, KromiaImageBuilder, CardRefTap;
export 'src/slot_content.dart' show slotContent, resolveSlot, ResolvedSlot, composeText;
export 'src/component_content.dart' show componentContent;
export 'src/tokens.dart' show KromiaTokens;
