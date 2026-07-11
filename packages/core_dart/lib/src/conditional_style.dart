/// KRO-198 — matcher de "Estilo por valor" (ConditionalStyle): evalúa un caso
/// `{op, value}` contra el dato `raw`. Espejo PURO de `matchConditionalCase`
/// (`conditional-style.ts`). Ops: `eq` (def) · `neq` · `contains` · `gt`/`gte`/
/// `lt`/`lte` (numéricas) · `truthy`/`falsy` (ignoran value). Texto: trim +
/// case-insensitive.
///
/// KRO-198 — además del primitivo de matching, este módulo resuelve la APARIENCIA
/// condicional completa (`resolveConditionalStyling`/`matchedConditionalCase`/
/// `resolveConditionalAppearance`), espejo de `conditional-style.ts`. Lo usa el
/// render de slots/chips (el "estilo por valor": color por rareza/elemento…).
library;

import 'composition.dart' show ConditionalStyle, ConditionalStyleCase, SlotAppearance;

/// Parsea a número (acepta strings numéricos); null si no es número finito.
num? _asNumber(Object? v) {
  if (v is num) return v.isFinite ? v : null;
  if (v is String) {
    final t = v.trim();
    if (t.isEmpty) return null;
    return num.tryParse(t);
  }
  return null;
}

/// TS `!!raw && raw !== '0' && raw !== 'false'`.
bool _truthy(Object? raw) {
  if (raw == null) return false;
  if (raw is bool) return raw;
  if (raw is num) return raw != 0;
  final s = raw.toString();
  return s.isNotEmpty && s != '0' && s != 'false';
}

/// ¿El valor `raw` del dato cumple el caso `{op, value}`? Espejo 1:1 de
/// `matchConditionalCase`.
bool matchConditionalCase({String? op, String? value, required Object? raw}) {
  final o = op ?? 'eq';
  if (o == 'truthy') return _truthy(raw);
  if (o == 'falsy') return !_truthy(raw);

  if (o == 'gt' || o == 'gte' || o == 'lt' || o == 'lte') {
    final a = _asNumber(raw);
    final b = _asNumber(value);
    if (a == null || b == null) return false;
    return switch (o) {
      'gt' => a > b,
      'gte' => a >= b,
      'lt' => a < b,
      _ => a <= b, // lte
    };
  }

  final s = (raw == null ? '' : raw.toString()).trim().toLowerCase();
  final t = (value ?? '').trim().toLowerCase();
  if (o == 'contains') return t.isNotEmpty && s.contains(t);
  if (o == 'neq') return s != t;
  return s == t; // eq
}

/// KRO-198 — el CASO que matchea (no el merge): el 1º de `cond.cases` cuyo `{op,
/// value}` cumple el valor de `cond.fieldKey` en `item`. Para leer su `target` y
/// aplicar la apariencia a los chips correctos. NO contempla el `otherwise` (else)
/// — puro "primer caso que coincide". Espejo de `matchedConditionalCase`.
ConditionalStyleCase? matchedConditionalCase(
    ConditionalStyle? cond, Map<String, dynamic>? item) {
  if (cond == null || cond.fieldKey.isEmpty || cond.cases.isEmpty || item == null) {
    return null;
  }
  final raw = item[cond.fieldKey];
  for (final c in cond.cases) {
    if (matchConditionalCase(op: c.op, value: c.value, raw: raw)) return c;
  }
  return null;
}

/// KRO-198 — caso EFECTIVO CON la cláusula else: el 1º `case` que coincide o, si
/// ninguno, `cond.otherwise`; `null` si no hay ni match ni else. El else aplica SOLO
/// con el condicional configurado (fieldKey + cases) y evaluado contra datos (hay
/// item). Es el helper que usa el render (para que el else surta efecto). Espejo de
/// `resolveConditionalStyling`.
ConditionalStyleCase? resolveConditionalStyling(
    ConditionalStyle? cond, Map<String, dynamic>? item) {
  if (cond == null || cond.fieldKey.isEmpty || cond.cases.isEmpty || item == null) {
    return null;
  }
  return matchedConditionalCase(cond, item) ?? cond.otherwise;
}

/// KRO-198 — apariencia EFECTIVA tras el estilo condicional: la del caso efectivo
/// mergeada sobre `base` (el caso gana). Sin condicional/match/else → `base` intacta.
/// Espejo de `resolveConditionalAppearance` (para slots NO composables — sin chips).
SlotAppearance? resolveConditionalAppearance(
    ConditionalStyle? cond, SlotAppearance? base, Map<String, dynamic>? item) {
  final eff = resolveConditionalStyling(cond, item);
  if (eff == null) return base;
  final ap = eff.appearance;
  return ap == null ? base : ap.mergedOver(base);
}
