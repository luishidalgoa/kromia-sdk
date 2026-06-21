import 'package:flutter/widgets.dart';
import 'package:kromia_core/kromia_core.dart';

import 'tokens.dart';

/// Builder de imagen inyectable: el paquete es AGNÓSTICO de la fuente (la app
/// puede pasar su `KromiaImage` con proxy autenticado; por defecto Image.network).
typedef KromiaImageBuilder = Widget Function(
  String url, {
  BoxFit fit,
  Alignment alignment,
  double? width,
  double? height,
});

Widget _defaultImage(String url, {BoxFit fit = BoxFit.cover, Alignment alignment = Alignment.center, double? width, double? height}) =>
    Image.network(
      url,
      fit: fit,
      alignment: alignment,
      width: width,
      height: height,
      errorBuilder: (_, __, ___) => Container(width: width, height: height, color: KromiaTokens.greenLight),
    );

/// Tap en una mini-carta (ref) cuando appearance.refTap == 'focus'.
typedef CardRefTap = void Function(Object ref);

/// Resuelve una ref de carta (índice/id) → arte + título de la carta referenciada,
/// para pintar la mini-carta REAL (no un placeholder con el índice). Espejo de
/// `CardRefResolver` (@kromia/react). null/sin imageUrl → degradado a placeholder.
typedef CardRefResolver = ({String? imageUrl, String? title})? Function(Object ref);

/// Builder de la CELDA completa de una mini-carta de ref. Permite a la app
/// inyectar SU MISMA celda de la grid de "Cartas" (arte + número + estados + tap)
/// → la relación entre cartas se ve idéntica a la grid. Si se provee, prevalece
/// sobre `resolveCardRef`/`onCardRefTap` (la celda gestiona su propio tap).
typedef CardRefCellBuilder = Widget Function(Object ref);

/// Contexto de render: composición + datos del item + defs + builder de imagen.
class RenderCtx {
  final ViewComposition composition;
  final Map<String, dynamic> item;
  final List<FieldDefLike> fieldDefs;
  final KromiaImageBuilder imageBuilder;
  final CardRefTap? onCardRefTap;

  /// Resolución de refs de carta a su arte/título (las mini-cartas relacionadas).
  final CardRefResolver? resolveCardRef;

  /// Celda completa de mini-carta de ref inyectada por la app (reutiliza la celda
  /// de la grid de Cartas). Si está, prevalece sobre resolveCardRef/onCardRefTap.
  final CardRefCellBuilder? cardRefCell;

  /// Formato de carta del álbum → nº de columnas de las rejillas de mini-refs
  /// (miniRefGridColumns). null → default (2:3 standard → 3 columnas).
  final CardFormat? cardFormat;
  final Map<String, FieldDefLike> _byKey;

  RenderCtx({
    required this.composition,
    required this.item,
    this.fieldDefs = const [],
    KromiaImageBuilder? imageBuilder,
    this.onCardRefTap,
    this.resolveCardRef,
    this.cardRefCell,
    this.cardFormat,
  })  : imageBuilder = imageBuilder ?? _defaultImage,
        _byKey = {for (final f in fieldDefs) f.key: f};

  /// Columnas de la rejilla de mini-refs (honra appearance.refColumns; si no,
  /// deriva del cardFormat vía miniRefGridColumns; default 3).
  int refColumns(SlotAppearance? ap) {
    final override = ap?.refColumns;
    if (override != null) return int.tryParse(override) ?? 3;
    return miniRefGridColumns(cardFormat ?? defaultCardFormat);
  }

  Map<String, SlotComposition> get slots => composition.slots;
  FieldDefLike? defFor(String? key) => key == null ? null : _byKey[key];
}
