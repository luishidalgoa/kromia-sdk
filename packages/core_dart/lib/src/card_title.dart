/// `card_title.dart` — espejo de `card-title.ts` (@kromia/core, `7e48b96`). Título
/// visible de una carta (heurística PURA cross-platform; render-only, no toca el KRP).
///
/// El backend persiste y sirve `cardTitleKey` en el CardSchema (combined schema);
/// ambos hosts (Studio + Flutter) resuelven el título con ESTA misma prioridad, para
/// no reimplementarla a mano (= drift: la app mostraba la PK —el número— como título).
library;

import 'field_def.dart';

/// Lectura dot-notation — las claves pueden ser anidadas (p.ej. `images.standard`).
Object? _getRaw(Map<String, dynamic> card, String key) {
  Object? v = card;
  for (final p in key.split('.')) {
    if (v is Map) {
      v = v[p];
    } else {
      return null;
    }
  }
  return v;
}

T? _firstWhereOrNull<T>(List<T> list, bool Function(T) test) {
  for (final e in list) {
    if (test(e)) return e;
  }
  return null;
}

/// Título de la carta. Prioridad:
///  1. campo de TÍTULO explícito (`cardTitleKey`, lo elige el publisher),
///  2. primer campo de TEXTO legible (type `text`, sin behavior url/email/phone),
///  3. la primary key (`cardPrimaryKey`),
///  4. `'Carta'` (fallback).
///
/// Desde KRO-222 el publisher elige el campo, y el fallback prefiere un texto, no la
/// PK (antes la PK ganaba → ponía el número como título). Devuelve el VALOR del campo
/// elegido en la carta (o `'Carta'` si no hay valor).
String resolveCardTitle(
  Map<String, dynamic> card,
  List<FieldDefLike> fields, [
  String? cardTitleKey,
  String? cardPrimaryKey,
]) {
  bool legibleText(FieldDefLike f) =>
      f.type == 'text' && !const ['url', 'email', 'phone'].contains(f.behavior ?? '');
  final titleField = (cardTitleKey != null
          ? _firstWhereOrNull(fields, (f) => f.key == cardTitleKey)
          : null) ??
      _firstWhereOrNull(fields, legibleText) ??
      (cardPrimaryKey != null
          ? _firstWhereOrNull(fields, (f) => f.key == cardPrimaryKey)
          : null);
  final raw = titleField != null ? _getRaw(card, titleField.key) : null;
  return (raw != null && raw != '') ? raw.toString() : 'Carta';
}
