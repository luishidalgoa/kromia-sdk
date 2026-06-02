/// `interaction.dart` — KRO-74. Espejo 1:1 de `interaction.ts`.
///
/// Decisor puro de interactividad: dada una [ViewComposition] y un item de
/// datos, devuelve QUÉ acción ejecutar al tap **sin ejecutarla**. El cliente
/// traduce la [TapResolution] a sus primitivas nativas:
///   - Flutter: Navigator.push() / showModalBottomSheet() / ExpansionTile / launchUrl()
///
/// Pure: sin side effects, sin date/random, sin acceso a UI. Determinístico.
library;

import 'auto_detail.dart';
import 'composition.dart';
import 'field_def.dart';
import 'recipes.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/// Resultado del resolver de tap: qué debe hacer el cliente al tocar un item.
///
/// Unión sellada (espejo del `type TapResolution` de TS). Variantes:
///   - [TapNone]     — la card no es interactiva, nada pasa.
///   - [TapNavigate] — abrir pantalla completa con `detailComposition`.
///   - [TapModal]    — abrir overlay/bottom-sheet con `detailComposition`.
///   - [TapExpand]   — desplegar accordion inline (receta + slots resueltos).
///   - [TapExternal] — abrir URL externa (puede estar vacía si el field no tiene valor).
sealed class TapResolution {
  const TapResolution();

  /// Discriminante textual, paridad con `{ kind: ... }` del TS.
  String get kind;
}

class TapNone extends TapResolution {
  const TapNone();
  @override
  String get kind => 'none';
}

class TapNavigate extends TapResolution {
  final ViewComposition detailComposition;
  const TapNavigate(this.detailComposition);
  @override
  String get kind => 'navigate';
}

class TapModal extends TapResolution {
  final ViewComposition detailComposition;
  const TapModal(this.detailComposition);
  @override
  String get kind => 'modal';
}

class TapExpand extends TapResolution {
  final String expandRecipe;
  final Map<String, SlotComposition> expandSlots;
  const TapExpand({required this.expandRecipe, required this.expandSlots});
  @override
  String get kind => 'expand';
}

class TapExternal extends TapResolution {
  final String url;
  const TapExternal(this.url);
  @override
  String get kind => 'external';
}

/// Opciones de [resolveTapAction]. Espejo de `ResolveTapOptions` (TS).
class ResolveTapOptions {
  /// Definiciones de fields de la sección. Si se proveen, se usan para construir
  /// la `detailComposition` automática cuando el publisher no declaró
  /// `targetComposition` ni `targetRecipe`. Sin ellos, los slots del detalle
  /// quedan vacíos (el renderer caerá a su fallback visual).
  final List<FieldDefLike> fieldDefs;
  const ResolveTapOptions({this.fieldDefs = const []});
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/// Dada una [composition] y el [item] de datos tocado, devuelve la
/// [TapResolution] — qué debe hacer el cliente.
///
/// El [item] solo se usa para `external_link` (extraer la URL del `linkField`).
TapResolution resolveTapAction(
  ViewComposition composition,
  Map<String, dynamic> item, [
  ResolveTapOptions options = const ResolveTapOptions(),
]) {
  final fieldDefs = options.fieldDefs;

  switch (composition.action) {
    case 'navigate_to_detail':
      return TapNavigate(resolveDetailComposition(composition, fieldDefs));

    case 'modal':
      return TapModal(resolveDetailComposition(composition, fieldDefs));

    case 'expand_inline':
      final expand = composition.expand;
      if (expand == null) return const TapNone();
      return TapExpand(expandRecipe: expand.recipe, expandSlots: expand.slots);

    case 'external_link':
      final raw =
          composition.linkField != null ? item[composition.linkField] : null;
      final url = raw is String ? raw.trim() : '';
      return TapExternal(url);

    case 'none':
    default:
      return const TapNone();
  }
}

/// Resuelve la mejor [ViewComposition] para mostrar como pantalla de detalle
/// (destino de `navigate_to_detail` o `modal`).
///
/// Prioridad:
///   1. `targetComposition` (cadena KRO-94): receta + slots del primer salto; si
///      sus slots están vacíos, se rellenan con `buildAutoDetailComposition`.
///      Los saltos más profundos se preservan para encadenar navegación.
///   2. `targetRecipe` (legacy, solo si es de `kind:'detail'`): esa receta + auto-slots.
///   3. Fallback: `buildAutoDetailComposition(fieldDefs)` (`hero_protagonico`).
ViewComposition resolveDetailComposition(
  ViewComposition composition, [
  List<FieldDefLike> fieldDefs = const [],
]) {
  // 1. Cadena multi-salto (KRO-94).
  final hop = composition.targetComposition;
  if (hop != null) {
    final autoSlots = buildAutoDetailComposition(fieldDefs).slots;
    final slots = (hop.slots != null && hop.slots!.isNotEmpty)
        ? hop.slots!
        : autoSlots;
    return ViewComposition(
      recipe: hop.recipe,
      action: hop.action,
      slots: slots,
      targetComposition: hop.targetComposition,
      expand: hop.expand,
      linkField: hop.linkField,
    );
  }

  // 2. Legacy targetRecipe.
  final targetRecipe = composition.targetRecipe;
  if (targetRecipe != null) {
    final manifest = getRecipeManifest(targetRecipe);
    if (manifest != null && manifest.kind == 'detail') {
      final auto = buildAutoDetailComposition(fieldDefs);
      return ViewComposition(
        recipe: targetRecipe,
        action: auto.action,
        slots: auto.slots,
      );
    }
  }

  // 3. Fallback auto.
  return buildAutoDetailComposition(fieldDefs);
}

/// Auto-elige la mejor receta de DETALLE para los fields de una sección.
/// galería → `momento`; imagen prominente → `hero_protagonico`; resto → `editorial`.
String resolveTargetRecipe(List<FieldDefLike> fieldDefs) {
  final hasGallery = fieldDefs.any((f) =>
      const ['gallery', 'slideshow', 'card_multiview'].contains(f.behavior ?? '') ||
      f.type == 'array<image>');
  if (hasGallery) return 'momento';

  final hasMainImage = fieldDefs.any((f) =>
      const ['avatar', 'banner', 'cover', 'thumbnail'].contains(f.behavior ?? '') ||
      f.type == 'image');
  if (hasMainImage) return 'hero_protagonico';

  return 'editorial';
}

/// Auto-elige la mejor receta de despliegue (expand): con fields enlazables
/// (url/email/phone) → `accordion_with_actions`; solo texto → `accordion_simple`.
String resolveExpandRecipe(List<FieldDefLike> fieldDefs) {
  final hasActionable = fieldDefs
      .any((f) => const ['url', 'email', 'phone'].contains(f.behavior ?? ''));
  return hasActionable ? 'accordion_with_actions' : 'accordion_simple';
}

/// ¿El tap es navegable o no? (cursor "pointer" solo si hay algo que tocar).
bool isTappable(ViewComposition composition) => composition.action != 'none';

/// ¿La acción del primer tap abre una pantalla nueva (vs inline)?
/// `navigate_to_detail` y `modal` abren pantalla; `expand_inline` y
/// `external_link` no salen de la lista.
bool opensNewScreen(ViewComposition composition) =>
    composition.action == 'navigate_to_detail' || composition.action == 'modal';
