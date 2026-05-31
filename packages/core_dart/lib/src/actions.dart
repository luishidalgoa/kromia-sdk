/// Action Registry — espejo 1:1 de `registries/actions.ts`.
///
/// Catalogo de acciones que un publisher asocia a una receta de lista: que pasa
/// cuando el coleccionista toca un item. Los IDs son ESTABLES (se serializan
/// como `composition.action`; renombrar = breaking). Los constraint flags
/// (requiresTargetRecipe, etc.) determinan que campos extra debe declarar la
/// composition — el cliente Flutter implementa cada transicion.
library;

class ActionDefinition {
  /// ID tecnico (se almacena como `composition.action`).
  final String id;

  /// Nombre castellano para el dropdown del editor.
  final String displayName;

  /// Frase corta (tooltip / onboarding).
  final String description;

  /// Tipo de transicion visual: static | push | modal | inline | external.
  final String transition;

  /// Si true, la composition DEBE declarar `targetRecipe`.
  final bool requiresTargetRecipe;

  /// Si requiresTargetRecipe, que kind de recipe se permite como target.
  final String? targetRecipeKind;

  /// Si true, la composition DEBE declarar `expand` (mini-receta).
  final bool requiresExpandRecipe;

  /// Si true, la composition DEBE declarar `linkField` (key del field con URL).
  final bool requiresLinkField;

  const ActionDefinition({
    required this.id,
    required this.displayName,
    required this.description,
    required this.transition,
    this.requiresTargetRecipe = false,
    this.targetRecipeKind,
    this.requiresExpandRecipe = false,
    this.requiresLinkField = false,
  });
}

const List<ActionDefinition> _actions = <ActionDefinition>[
  ActionDefinition(
    id: 'none',
    displayName: 'Ninguna',
    description: 'El item es informativo, no responde al tap.',
    transition: 'static',
  ),
  ActionDefinition(
    id: 'navigate_to_detail',
    displayName: 'Navegar al detalle',
    description:
        'Push de una nueva pantalla con la receta de detalle declarada en targetRecipe.',
    transition: 'push',
    requiresTargetRecipe: true,
    targetRecipeKind: 'detail',
  ),
  ActionDefinition(
    id: 'modal',
    displayName: 'Modal overlay',
    description:
        'Bottom sheet con la receta de detalle declarada en targetRecipe (no abandona la lista).',
    transition: 'modal',
    requiresTargetRecipe: true,
    targetRecipeKind: 'detail',
  ),
  ActionDefinition(
    id: 'expand_inline',
    displayName: 'Expandir inline',
    description:
        'Mini-receta (accordion) desplegada bajo el item — la composition debe declarar `expand`.',
    transition: 'inline',
    requiresExpandRecipe: true,
  ),
  ActionDefinition(
    id: 'external_link',
    displayName: 'Enlace externo',
    description:
        'Abre la URL contenida en el field declarado en linkField (behavior url/email/phone).',
    transition: 'external',
    requiresLinkField: true,
  ),
];

/// Acceso por ID. `null` si la action no está en el catálogo.
ActionDefinition? getAction(String id) {
  for (final a in _actions) {
    if (a.id == id) return a;
  }
  return null;
}

/// Catálogo completo en orden de declaración.
List<ActionDefinition> allActions() => _actions;

/// Lista de IDs.
final List<String> actionIds = _actions.map((a) => a.id).toList(growable: false);
