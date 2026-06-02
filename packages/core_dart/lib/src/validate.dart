/// `validate.dart` — KRO-79. Validador puro de [ViewComposition].
///
/// Espejo 1:1 de `validate.ts`. Dada una composition y opcionalmente los
/// `fieldDefs` de la sección, devuelve la lista de issues detectados.
///
/// Pure: sin side effects, sin I/O. Mismas entradas → mismas issues.
///
/// **Severities**:
///  - `error`: violación dura del modelo — el cliente no puede renderizar.
///  - `warn`:  el cliente puede renderizar con un fallback, pero el publisher
///             debería ser advertido.
///
/// NOTA de paridad: el modelo Dart está fuertemente tipado (p.ej. `slots`
/// siempre es `Map<String, SlotComposition>`, `fields` siempre `List<String>`),
/// por lo que algunos checks *estructurales* del TS (slots == null,
/// fields no-array, nested no-objeto) son imposibles por construcción — los
/// garantiza el parse (`fromJson`), no el validador. Aquí se espejan los checks
/// **semánticos**, que son los que un cliente realmente necesita.
library;

import 'actions.dart' show actionIds;
import 'classify.dart';
import 'composition.dart';
import 'field_def.dart';
import 'recipes.dart';
import 'target_chain.dart' show kMaxTargetDepth;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/// Un issue detectado por [validateComposition]. Espejo de `ValidationIssue`.
class ValidationIssue {
  /// Path JSON-style al field que falló (p.ej. `slots.title.fields[0]`).
  final String path;

  /// Mensaje legible en español.
  final String message;

  /// Severity: `error` = no renderizable; `warn` = renderizable con fallback.
  final String level;

  const ValidationIssue({
    required this.path,
    required this.message,
    required this.level,
  });

  @override
  String toString() => '[$level] $path: $message';
}

/// Resultado de [validateComposition]. Espejo de `ValidationResult`.
class ValidationResult {
  /// `true` si no hay issues de nivel `error`. Las warnings no invalidan.
  final bool valid;

  /// Todos los issues encontrados (errors + warnings).
  final List<ValidationIssue> issues;

  const ValidationResult({required this.valid, required this.issues});
}

/// Opciones de [validateComposition]. Espejo de `ValidateCompositionOptions`.
class ValidateCompositionOptions {
  /// Definiciones de fields de la sección. Si se provee, el validador comprueba
  /// que cada field referenciado existe y que su SlotAcceptKind es compatible
  /// con el slot del recipe. Sin fieldDefs, solo valida la estructura.
  final List<FieldDefLike>? fieldDefs;
  const ValidateCompositionOptions({this.fieldDefs});
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos de appearance — espejo de los ids de `options.ts`
// (OPTIONS_APPEARANCE_*). Inlineados como sets cerrados: son metadata estable
// del modelo del KRP; el corpus de comportamiento vigila la paridad.
// ─────────────────────────────────────────────────────────────────────────────

const Set<String> _shapeIds = {'circle', 'square', 'rounded'};
const Set<String> _aspectIds = {'1:1', '16:9', '4:3', '3:4', '9:16', 'free'};
const Set<String> _alignIds = {'left', 'center', 'right'};
const Set<String> _weightIds = {'regular', 'semibold', 'bold'};
const Set<String> _sizeIds = {'sm', 'md', 'lg', 'xl'};
const Set<String> _truncateIds = {'1', '2', '3', 'none'};
const Set<String> _paddingIds = {'none', 'sm', 'md', 'lg'};
const Set<String> _accentIds = {'auto', 'top', 'left', 'right', 'bottom', 'none'};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

void _validateAppearance(
    SlotAppearance? appearance, String path, List<ValidationIssue> issues) {
  if (appearance == null) return;

  void check(String? value, Set<String> valid, String prop) {
    if (value != null && !valid.contains(value)) {
      issues.add(ValidationIssue(
          path: '$path.$prop', level: 'error', message: '$prop "$value" no es válido'));
    }
  }

  check(appearance.shape, _shapeIds, 'shape');
  check(appearance.aspect, _aspectIds, 'aspect');
  check(appearance.align, _alignIds, 'align');
  check(appearance.weight, _weightIds, 'weight');
  check(appearance.size, _sizeIds, 'size');
  check(appearance.truncate, _truncateIds, 'truncate');
  check(appearance.paddingY, _paddingIds, 'paddingY');
  check(appearance.accentPosition, _accentIds, 'accentPosition');

  // truncateChars debe ser entero entre 1 y 500.
  final tc = appearance.truncateChars;
  if (tc != null && (tc < 1 || tc > 500)) {
    issues.add(ValidationIssue(
      path: '$path.truncateChars',
      level: 'error',
      message: 'truncateChars debe ser entero entre 1 y 500, recibido: $tc',
    ));
  }
}

/// Valida una [NestedViewComposition] (mini-receta dentro de un slot).
/// Reglas: `recipe` no vacío; keys de fields no vacías; **depth máx = 2** (una
/// nested no puede contener otra nested).
void _validateNested(
    NestedViewComposition nested, String basePath, List<ValidationIssue> issues) {
  if (nested.recipe.trim().isEmpty) {
    issues.add(ValidationIssue(
        path: '$basePath.recipe',
        level: 'error',
        message: 'nestedComposition.recipe vacío o no string'));
  }
  nested.slots.forEach((slotName, slot) {
    final slotPath = '$basePath.slots.$slotName';
    for (var i = 0; i < slot.fields.length; i++) {
      if (slot.fields[i].trim().isEmpty) {
        issues.add(ValidationIssue(
          path: '$slotPath.fields[$i]',
          level: 'error',
          message: 'slot "$slotName" contiene una entry vacía o no-string',
        ));
      }
    }
    // Depth máx=2: una nested NO puede tener su propia nested.
    if (slot.nestedComposition != null) {
      issues.add(ValidationIssue(
        path: '$slotPath.nestedComposition',
        level: 'error',
        message:
            'slot "$slotName" excede profundidad máxima (2). nestedComposition no permitida dentro de otra nested.',
      ));
    }
  });
}

void _validateSlot(
  String slotId,
  SlotComposition slot,
  SlotDefinition? recipeSlot,
  List<FieldDefLike>? fieldDefs,
  String basePath,
  List<ValidationIssue> issues,
) {
  // Single slot solo usa 1 field (más sería ignorado por el renderer) → warn.
  if (recipeSlot != null && recipeSlot.kind == 'single' && slot.fields.length > 1) {
    issues.add(ValidationIssue(
      path: '$basePath.fields',
      level: 'warn',
      message:
          'slot "$slotId" es single pero tiene ${slot.fields.length} fields; solo se usa el primero',
    ));
  }

  // Existencia + compatibilidad de field si fieldDefs provisto.
  if (fieldDefs != null) {
    final defByKey = {for (final d in fieldDefs) d.key: d};
    for (var i = 0; i < slot.fields.length; i++) {
      final key = slot.fields[i];
      final def = defByKey[key];
      if (def == null) {
        issues.add(ValidationIssue(
          path: '$basePath.fields[$i]',
          level: 'error',
          message: 'field "$key" no existe en la sección',
        ));
        continue;
      }
      if (recipeSlot != null) {
        final spec = FieldSpec(def.type, behavior: def.behavior);
        final compatible = isFieldCompatibleWithSlot(spec, SlotSpec(recipeSlot.accepts));
        if (!compatible) {
          final kinds = classifyField(spec).join('|');
          issues.add(ValidationIssue(
            path: '$basePath.fields[$i]',
            level: 'error',
            message:
                'field "$key" ($kinds) no es compatible con slot "$slotId" (acepta: ${recipeSlot.accepts.join('|')})',
          ));
        }
      }
    }
  }

  // Appearance.
  _validateAppearance(slot.appearance, '$basePath.appearance', issues);

  // Orientation: solo 'horizontal' o 'vertical'.
  final o = slot.orientation;
  if (o != null && o != 'horizontal' && o != 'vertical') {
    issues.add(ValidationIssue(
      path: '$basePath.orientation',
      level: 'error',
      message: "orientation \"$o\" no es válido (esperaba 'horizontal' o 'vertical')",
    ));
  }

  // nestedComposition con depth máx=2 (KRO-80).
  if (slot.nestedComposition != null) {
    _validateNested(slot.nestedComposition!, '$basePath.nestedComposition', issues);
  }
}

/// KRO-94 Fase B — valida un eslabón de la cadena multi-salto y, recursivamente,
/// sus saltos siguientes. Las referencias a fields NO se validan (cross-section).
void _validateTargetChain(
    TargetComposition node, int depth, String path, List<ValidationIssue> issues) {
  if (depth > kMaxTargetDepth) {
    issues.add(ValidationIssue(
      path: path,
      level: 'error',
      message: 'cadena de navegación excede la profundidad máxima ($kMaxTargetDepth)',
    ));
    return;
  }

  if (getRecipeManifest(node.recipe) == null) {
    issues.add(ValidationIssue(
        path: '$path.recipe', level: 'error', message: 'recipe "${node.recipe}" no existe'));
  }

  if (!actionIds.contains(node.action)) {
    issues.add(ValidationIssue(
      path: '$path.action',
      level: 'error',
      message: 'action "${node.action}" no es válida (esperaba: ${actionIds.join('|')})',
    ));
  }

  final manifest = getRecipeManifest(node.recipe);
  final slotsById = {for (final s in manifest?.slots ?? const <SlotDefinition>[]) s.id: s};
  (node.slots ?? const <String, SlotComposition>{}).forEach((slotId, slot) {
    _validateSlot(slotId, slot, slotsById[slotId], null, '$path.slots.$slotId', issues);
  });

  final expand = node.expand;
  if (expand != null) {
    final expandManifest = getRecipeManifest(expand.recipe);
    if (expandManifest == null) {
      issues.add(ValidationIssue(
          path: '$path.expand.recipe',
          level: 'error',
          message: 'expand.recipe "${expand.recipe}" no existe'));
    } else if (expandManifest.kind != 'expand') {
      issues.add(ValidationIssue(
          path: '$path.expand.recipe',
          level: 'error',
          message:
              'expand.recipe "${expand.recipe}" no es de kind=expand (es "${expandManifest.kind}")'));
    }
    final expandSlotsById = {
      for (final s in expandManifest?.slots ?? const <SlotDefinition>[]) s.id: s
    };
    expand.slots.forEach((slotId, slot) {
      _validateSlot(
          slotId, slot, expandSlotsById[slotId], null, '$path.expand.slots.$slotId', issues);
    });
  }

  if (node.targetComposition != null) {
    _validateTargetChain(
        node.targetComposition!, depth + 1, '$path.targetComposition', issues);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/// Valida una [composition] contra el modelo del SDK. Devuelve `{valid, issues}`
/// — `valid` es `true` si no hay errors (las warnings no invalidan).
ValidationResult validateComposition(
  ViewComposition composition, [
  ValidateCompositionOptions options = const ValidateCompositionOptions(),
]) {
  final issues = <ValidationIssue>[];
  final fieldDefs = options.fieldDefs;

  // 1. recipe.
  final manifest = getRecipeManifest(composition.recipe);
  if (manifest == null) {
    issues.add(ValidationIssue(
      path: 'recipe',
      level: 'error',
      message: 'recipe "${composition.recipe}" no existe en RECIPE_REGISTRY',
    ));
  }

  // 2. action.
  if (!actionIds.contains(composition.action)) {
    issues.add(ValidationIssue(
      path: 'action',
      level: 'error',
      message:
          'action "${composition.action}" no es válida (esperaba: ${actionIds.join('|')})',
    ));
  }

  // 3. slots.
  final recipeSlotsById = {
    for (final s in manifest?.slots ?? const <SlotDefinition>[]) s.id: s
  };
  composition.slots.forEach((slotId, slot) {
    final recipeSlot = recipeSlotsById[slotId];
    if (recipeSlot == null && manifest != null) {
      issues.add(ValidationIssue(
        path: 'slots.$slotId',
        level: 'warn',
        message:
            'slot "$slotId" no existe en el manifest de "${composition.recipe}" — ¿custom slot?',
      ));
    }
    _validateSlot(slotId, slot, recipeSlot, fieldDefs, 'slots.$slotId', issues);
  });

  // 4. accentPosition (top-level).
  if (composition.accentPosition != null &&
      !_accentIds.contains(composition.accentPosition)) {
    issues.add(ValidationIssue(
      path: 'accentPosition',
      level: 'error',
      message: 'accentPosition "${composition.accentPosition}" no es válido',
    ));
  }

  // 5. expand (mini-receta inline).
  final expand = composition.expand;
  if (expand != null) {
    final expandManifest = getRecipeManifest(expand.recipe);
    if (expandManifest == null) {
      issues.add(ValidationIssue(
        path: 'expand.recipe',
        level: 'error',
        message: 'expand.recipe "${expand.recipe}" no existe',
      ));
    } else if (expandManifest.kind != 'expand') {
      issues.add(ValidationIssue(
        path: 'expand.recipe',
        level: 'error',
        message:
            'expand.recipe "${expand.recipe}" no es de kind=expand (es "${expandManifest.kind}")',
      ));
    }
    final expandSlotsById = {
      for (final s in expandManifest?.slots ?? const <SlotDefinition>[]) s.id: s
    };
    expand.slots.forEach((slotId, slot) {
      _validateSlot(
          slotId, slot, expandSlotsById[slotId], fieldDefs, 'expand.slots.$slotId', issues);
    });
  }

  // 6. linkField (KRO-80).
  final linkField = composition.linkField;
  if (linkField != null) {
    if (linkField.trim().isEmpty) {
      issues.add(ValidationIssue(
        path: 'linkField',
        level: 'error',
        message: 'linkField debe ser un string no vacío (o ausente)',
      ));
    } else if (fieldDefs != null) {
      final fieldKeys = {for (final f in fieldDefs) f.key};
      if (!fieldKeys.contains(linkField)) {
        issues.add(ValidationIssue(
          path: 'linkField',
          level: 'error',
          message:
              'linkField referencia el field "$linkField" que no existe en la sección',
        ));
      }
    }
  }

  // 7. targetRecipe (legacy single-hop).
  final targetRecipe = composition.targetRecipe;
  if (targetRecipe != null) {
    final target = getRecipeManifest(targetRecipe);
    if (target == null) {
      issues.add(ValidationIssue(
        path: 'targetRecipe',
        level: 'error',
        message: 'targetRecipe "$targetRecipe" no existe',
      ));
    } else if (target.kind != 'detail') {
      issues.add(ValidationIssue(
        path: 'targetRecipe',
        level: 'warn',
        message: 'targetRecipe "$targetRecipe" no es kind=detail (es "${target.kind}")',
      ));
    }
  }

  // 7b. targetComposition (KRO-94 Fase B — cadena multi-salto).
  if (composition.targetComposition != null) {
    if (targetRecipe != null) {
      issues.add(const ValidationIssue(
        path: 'targetComposition',
        level: 'warn',
        message:
            'targetComposition y targetRecipe ambos presentes; el cliente usa targetComposition',
      ));
    }
    _validateTargetChain(composition.targetComposition!, 1, 'targetComposition', issues);
  }

  // 8. slotOverrides.
  final overrides = composition.slotOverrides;
  if (overrides != null) {
    final recipeSlotIds = {
      for (final s in manifest?.slots ?? const <SlotDefinition>[]) s.id
    };
    final disabled = overrides.disabled;
    if (disabled != null) {
      for (var i = 0; i < disabled.length; i++) {
        if (!recipeSlotIds.contains(disabled[i])) {
          issues.add(ValidationIssue(
            path: 'slotOverrides.disabled[$i]',
            level: 'warn',
            message:
                'slot "${disabled[i]}" no existe en el manifest del recipe — disabled tiene efecto nulo',
          ));
        }
      }
    }
    final custom = overrides.custom;
    if (custom != null) {
      for (var i = 0; i < custom.length; i++) {
        final cs = custom[i];
        if (cs.id.isEmpty || cs.label.isEmpty || cs.kind.isEmpty) {
          issues.add(ValidationIssue(
            path: 'slotOverrides.custom[$i]',
            level: 'error',
            message: 'custom slot requiere id, label, kind, accepts[]',
          ));
        }
        if (cs.kind.isNotEmpty && cs.kind != 'single' && cs.kind != 'composable') {
          issues.add(ValidationIssue(
            path: 'slotOverrides.custom[$i].kind',
            level: 'error',
            message: "kind \"${cs.kind}\" no es válido (esperaba 'single' o 'composable')",
          ));
        }
      }
    }
  }

  final hasErrors = issues.any((i) => i.level == 'error');
  return ValidationResult(valid: !hasErrors, issues: issues);
}
