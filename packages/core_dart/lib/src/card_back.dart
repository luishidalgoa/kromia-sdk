/// KRO-227/228 — Reverso de la carta. Modelo DATA (NO entra al contrato KRP, igual
/// que `detailComposition`/chips/accentStyle) + resolución del reverso EFECTIVO.
/// Espejo 1:1 de `card-back.ts` + los tipos de `types.ts`.
library;

import 'conditional_style.dart';

/// Pseudo-campo: filtrar el reverso por la SECCIÓN de la carta.
const String cardBackSectionKey = '__section__';

/// Colocación del QR sobre el reverso. `x`,`y` = CENTRO en % (0–100); `size` =
/// lado del cuadrado en % del ANCHO. (No es un GridPlacement de CSS-grid.)
class QrPlacement {
  final double x;
  final double y;
  final double size;
  const QrPlacement({required this.x, required this.y, required this.size});

  factory QrPlacement.fromJson(Map<String, dynamic> j) => QrPlacement(
        x: (j['x'] as num?)?.toDouble() ?? 0,
        y: (j['y'] as num?)?.toDouble() ?? 0,
        size: (j['size'] as num?)?.toDouble() ?? 0,
      );
}

/// Diseño del reverso: imagen a sangre + (opcional) colocación del QR.
class CardBackDesign {
  /// URL del arte del reverso (a sangre).
  final String? image;

  /// Colocación del QR (solo modo `qr`). null = sin QR.
  final QrPlacement? qr;

  const CardBackDesign({this.image, this.qr});

  factory CardBackDesign.fromJson(Map<String, dynamic> j) => CardBackDesign(
        image: j['image'] as String?,
        qr: j['qr'] is Map
            ? QrPlacement.fromJson((j['qr'] as Map).cast<String, dynamic>())
            : null,
      );

  /// Merge superficial: este diseño PISA [base] campo a campo (espejo de
  /// `{...base, ...design}`). Lo ausente conserva el de la base (variar solo la
  /// imagen mantiene el QR de la base, etc.).
  CardBackDesign mergedOver(CardBackDesign base) =>
      CardBackDesign(image: image ?? base.image, qr: qr ?? base.qr);
}

/// Un caso de la regla condicional del reverso (estilo "Estilo por valor").
class ConditionalCardBackCase {
  /// Operador (reúsa los de ConditionalStyleCase). Default 'eq'.
  final String? op;
  final String? value;

  /// El reverso a usar si este caso coincide (merge sobre `base`).
  final CardBackDesign design;

  const ConditionalCardBackCase({this.op, this.value, required this.design});

  factory ConditionalCardBackCase.fromJson(Map<String, dynamic> j) =>
      ConditionalCardBackCase(
        op: j['op'] as String?,
        value: j['value'] as String?,
        design: CardBackDesign.fromJson(
            (j['design'] as Map?)?.cast<String, dynamic>() ?? const {}),
      );
}

/// Variación condicional del reverso por valor de un campo (o por SECCIÓN vía la
/// clave `__section__`). Casos en orden, el 1º que coincide gana; `otherwise` =
/// else (no `else`, palabra reservada en Dart).
class ConditionalCardBack {
  final String fieldKey;
  final List<ConditionalCardBackCase> cases;
  final CardBackDesign? otherwise;

  const ConditionalCardBack({
    required this.fieldKey,
    required this.cases,
    this.otherwise,
  });

  factory ConditionalCardBack.fromJson(Map<String, dynamic> j) =>
      ConditionalCardBack(
        fieldKey: (j['fieldKey'] as String?) ?? '',
        cases: ((j['cases'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => ConditionalCardBackCase.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        otherwise: j['otherwise'] is Map
            ? CardBackDesign.fromJson((j['otherwise'] as Map).cast<String, dynamic>())
            : null,
      );
}

/// Composición del reverso a nivel cardSchema: un `base` por defecto + una
/// variación `conditional` opcional que lo pisa campo a campo cuando coincide.
class CardBackComposition {
  final CardBackDesign? base;
  final ConditionalCardBack? conditional;

  const CardBackComposition({this.base, this.conditional});

  factory CardBackComposition.fromJson(Map<String, dynamic> j) =>
      CardBackComposition(
        base: j['base'] is Map
            ? CardBackDesign.fromJson((j['base'] as Map).cast<String, dynamic>())
            : null,
        conditional: j['conditional'] is Map
            ? ConditionalCardBack.fromJson(
                (j['conditional'] as Map).cast<String, dynamic>())
            : null,
      );
}

/// Reverso EFECTIVO de una carta. Espejo 1:1 de `resolveCardBack` (card-back.ts):
/// el 1º caso condicional que coincide (merge sobre `base`), o el `otherwise`, o
/// la `base`. [section] alimenta el filtro `__section__`. Sin composición / sin
/// condicional configurado / sin datos → la base intacta.
CardBackDesign? resolveCardBack(
  CardBackComposition? comp,
  Map<String, dynamic>? item, {
  String? section,
}) {
  if (comp == null) return null;
  final base = comp.base;
  final cond = comp.conditional;
  // Sin condicional configurado o sin datos que evaluar → la base.
  if (cond == null || cond.fieldKey.isEmpty || cond.cases.isEmpty || item == null) {
    return base;
  }

  final raw = cond.fieldKey == cardBackSectionKey ? section : item[cond.fieldKey];
  CardBackDesign? chosen;
  for (final c in cond.cases) {
    if (matchConditionalCase(op: c.op, value: c.value, raw: raw)) {
      chosen = c.design;
      break;
    }
  }
  chosen ??= cond.otherwise;
  if (chosen == null) return base;
  // El reverso elegido PISA la base campo a campo.
  return base == null ? chosen : chosen.mergedOver(base);
}
