import 'composition.dart' show SlotAppearance, ConditionalStyle, ConditionalStyleCase;

/// KRO-198 — Estilo condicional por valor: evalúa `SlotComposition.conditionalStyle`
/// contra el dato de una carta y devuelve la apariencia efectiva. Resuelve
/// "color/estilo por rareza" (y similares) de forma DECLARATIVA dentro del propio
/// modelo de appearance. Espejo 1:1 de `conditional-style.ts` (@kromia/core).
/// Puro: mismas entradas → misma salida.

/// Parsea un valor a número (acepta strings numéricos); null si no es número.
num? _asNumber(Object? v) {
  if (v is num && v.isFinite) return v;
  if (v is String && v.trim().isNotEmpty) return num.tryParse(v.trim());
  return null;
}

/// `truthy` del TS: `!!raw && raw !== '0' && raw !== 'false'` (0/0.0/''/'0'/'false' → false).
bool _truthy(Object? raw) {
  if (raw == null) return false;
  if (raw is bool) return raw;
  if (raw is num) return raw != 0;
  final s = raw.toString();
  return s.isNotEmpty && s != '0' && s != 'false';
}

/// ¿El valor [raw] del dato cumple este caso? Comparación de texto
/// case-insensitive + trim; gt/gte/lt/lte numéricas; truthy/falsy ignoran value.
bool matchConditionalCase(ConditionalStyleCase c, Object? raw) {
  final op = c.op ?? 'eq';
  if (op == 'truthy') return _truthy(raw);
  if (op == 'falsy') return !_truthy(raw);

  if (op == 'gt' || op == 'gte' || op == 'lt' || op == 'lte') {
    final a = _asNumber(raw);
    final b = _asNumber(c.value);
    if (a == null || b == null) return false;
    return op == 'gt'
        ? a > b
        : op == 'gte'
            ? a >= b
            : op == 'lt'
                ? a < b
                : a <= b;
  }

  final s = (raw == null ? '' : raw.toString()).trim().toLowerCase();
  final t = (c.value ?? '').trim().toLowerCase();
  if (op == 'contains') return t.isNotEmpty && s.contains(t);
  if (op == 'neq') return s != t;
  return s == t; // eq
}

/// Apariencia EFECTIVA tras aplicar el estilo condicional: el primer caso que
/// matchea el valor de `cond.fieldKey` en [item] MERGE-a su appearance sobre la
/// [base]. Sin condicional / sin match / sin item → devuelve la base intacta.
SlotAppearance? resolveConditionalAppearance(
  ConditionalStyle? cond,
  SlotAppearance? base,
  Map<String, dynamic>? item,
) {
  if (cond == null || cond.fieldKey.isEmpty || cond.cases.isEmpty || item == null) {
    return base;
  }
  final raw = item[cond.fieldKey];
  for (final c in cond.cases) {
    if (matchConditionalCase(c, raw)) {
      final ap = c.appearance;
      return ap == null ? base : ap.mergedOver(base); // matched gana sobre base
    }
  }
  return base;
}
