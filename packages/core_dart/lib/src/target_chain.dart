/// `target_chain.dart` — espejo 1:1 de `target-chain.ts` (@kromia/core, KRO-94 B).
///
/// Normaliza una `ViewComposition` a su CADENA de pantallas destino, unificando
/// el modelo legacy single-hop (`targetRecipe`/`expand`/`linkField`) y el nuevo
/// multi-salto (`targetComposition` recursivo). Puro y determinista: el renderer
/// Flutter produce los MISMOS saltos que el canvas de Studio.
library;

import 'composition.dart';

/// Profundidad máxima de la cadena (nº de pantallas tras la lista). 4 ⇒
/// lista → A → B → C → D. El resolver corta defensivamente ante datos cíclicos.
const int kMaxTargetDepth = 4;

/// Acciones que ABREN una pantalla nueva (encadenable o terminal).
const Set<String> _navigatingActions = {
  'navigate_to_detail',
  'modal',
  'expand_inline',
  'external_link',
};

/// Un salto resuelto de la cadena (pantalla destino + cómo se llegó a ella).
class ResolvedHop {
  /// Acción que LLEVA a esta pantalla desde la anterior. Nunca 'none'.
  final String leadingAction;

  /// Receta de esta pantalla. null si aún sin elegir o si es external_link.
  final String? recipe;

  /// Solo cuando `leadingAction == 'external_link'`: field con la URL.
  final String? linkField;

  /// Nodo `TargetComposition` crudo del salto. null para los saltos legacy
  /// sintetizados desde `targetRecipe`/`expand`/`linkField`.
  final TargetComposition? node;

  const ResolvedHop({
    required this.leadingAction,
    this.recipe,
    this.linkField,
    this.node,
  });
}

/// Receta efectiva del primer salto en el modelo legacy, según la action.
ResolvedHop? _legacyFirstHop(ViewComposition vc) {
  switch (vc.action) {
    case 'navigate_to_detail':
      return ResolvedHop(leadingAction: 'navigate_to_detail', recipe: vc.targetRecipe);
    case 'modal':
      // Sin targetRecipe el modal reusa la receta de la lista (fallback cliente).
      return ResolvedHop(leadingAction: 'modal', recipe: vc.targetRecipe ?? vc.recipe);
    case 'expand_inline':
      return ResolvedHop(leadingAction: 'expand_inline', recipe: vc.expand?.recipe);
    case 'external_link':
      return ResolvedHop(leadingAction: 'external_link', linkField: vc.linkField);
    default:
      return null;
  }
}

/// Resuelve la cadena ordenada de pantallas destino de una `ViewComposition`.
///
/// - `action == 'none'`/ausente → cadena vacía (pantalla terminal).
/// - `targetComposition` presente → recorre la cadena recursiva, parando en una
///   action no-navegante, en 'none', o al alcanzar `kMaxTargetDepth` (corte
///   defensivo).
/// - en su defecto → un único salto sintetizado del modelo legacy.
List<ResolvedHop> resolveTargetChain(ViewComposition? vc) {
  if (vc == null || vc.action.isEmpty || vc.action == 'none') return [];

  // Nuevo modelo multi-salto.
  if (vc.targetComposition != null) {
    final hops = <ResolvedHop>[];
    var leading = vc.action;
    TargetComposition? node = vc.targetComposition;
    while (node != null && hops.length <= kMaxTargetDepth) {
      hops.add(ResolvedHop(
        leadingAction: leading,
        recipe: node.recipe,
        linkField: node.linkField,
        node: node,
      ));
      // Solo se encadena si la action del nodo abre otra pantalla navegable.
      if (node.action.isEmpty || !_navigatingActions.contains(node.action)) break;
      leading = node.action;
      node = node.targetComposition;
    }
    return hops;
  }

  // Modelo legacy: un único salto terminal.
  final hop = _legacyFirstHop(vc);
  return hop != null ? [hop] : [];
}

/// Nº de saltos de la cadena (0 = pantalla terminal).
int targetChainDepth(ViewComposition? vc) => resolveTargetChain(vc).length;
