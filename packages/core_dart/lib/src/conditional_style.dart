/// KRO-198 — matcher de "Estilo por valor" (ConditionalStyle): evalúa un caso
/// `{op, value}` contra el dato `raw`. Espejo PURO de `matchConditionalCase`
/// (`conditional-style.ts`). Ops: `eq` (def) · `neq` · `contains` · `gt`/`gte`/
/// `lt`/`lte` (numéricas) · `truthy`/`falsy` (ignoran value). Texto: trim +
/// case-insensitive.
///
/// Nota: la resolución de APARIENCIA condicional (resolveConditionalAppearance /
/// resolveConditionalStyling) es un handoff aparte; aquí solo el primitivo de
/// matching, que reúsan el reverso (`card_back.dart`, KRO-228) y, en su día, el
/// estilo condicional de slots.
library;

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
