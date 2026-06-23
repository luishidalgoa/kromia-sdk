/// `conditional_style.dart` — KRO-198. Espejo 1:1 de `conditional-style.ts`.
///
/// "Estilo por valor": evalúa `SlotComposition.conditionalStyle` contra el dato
/// de una carta y devuelve el caso/apariencia efectiva. v2: cada caso (y el
/// `otherwise`/else) lleva `target` (a qué chips del slot componible aplica) +
/// "el caso que coincide gana". Puro: mismas entradas → misma salida.
library;

import 'composition.dart' show SlotAppearance;

/// Parsea un valor a número (acepta strings numéricos); null si no es número.
/// Espejo de `asNumber` (NaN/Infinity → null).
double? _asNumber(Object? v) {
  if (v is num && v.isFinite) return v.toDouble();
  if (v is String && v.trim().isNotEmpty) {
    final n = num.tryParse(v.trim());
    if (n != null && n.isFinite) return n.toDouble();
  }
  return null;
}

/// Truthiness al estilo JS + excluye los strings `'0'` y `'false'`. Espejo de
/// `!!raw && raw !== '0' && raw !== 'false'`.
bool _truthy(Object? raw) {
  final jsTruthy = raw != null &&
      !(raw is bool && raw == false) &&
      !(raw is num && (raw == 0 || raw.isNaN)) &&
      !(raw is String && raw.isEmpty);
  if (!jsTruthy) return false;
  return raw != '0' && raw != 'false';
}

/// Un caso del estilo condicional. `op`/`value` se ignoran en el `otherwise`.
class ConditionalStyleCase {
  /// 'eq'|'neq'|'contains'|'gt'|'gte'|'lt'|'lte'|'truthy'|'falsy'. Default 'eq'.
  final String? op;
  final String? value;

  /// Apariencia a aplicar (merge sobre la base del slot) si el caso matchea.
  final SlotAppearance? appearance;

  /// A qué chip(s) del slot componible aplica (field-keys). Ausente/vacío = toda
  /// la fila (la apariencia base del slot). Con valores = solo esos chips,
  /// ganando sobre su apariencia por-chip.
  final List<String>? target;

  const ConditionalStyleCase({this.op, this.value, this.appearance, this.target});

  factory ConditionalStyleCase.fromJson(Map<String, dynamic> json) => ConditionalStyleCase(
        op: json['op'] as String?,
        value: json['value'] as String?,
        appearance: json['appearance'] is Map
            ? SlotAppearance.fromJson((json['appearance'] as Map).cast<String, dynamic>())
            : null,
        target: (json['target'] as List?)?.map((e) => e.toString()).toList(),
      );
}

/// Mapeo declarativo valor-del-dato → apariencia.
class ConditionalStyle {
  /// Key del schema cuyo valor decide el estilo.
  final String fieldKey;

  /// Casos evaluados EN ORDEN; el PRIMERO que matchea gana (como un switch).
  final List<ConditionalStyleCase> cases;

  /// Cláusula ELSE opcional: apariencia (+ su propio `target`) cuando NINGÚN
  /// `case` coincide. Ausente = cae a la apariencia base (retro-compat). Se llama
  /// `otherwise` y no `else` porque `else` es palabra reservada en Dart.
  final ConditionalStyleCase? otherwise;

  const ConditionalStyle({required this.fieldKey, this.cases = const [], this.otherwise});

  factory ConditionalStyle.fromJson(Map<String, dynamic> json) => ConditionalStyle(
        fieldKey: (json['fieldKey'] as String?) ?? '',
        cases: (json['cases'] as List?)
                ?.whereType<Map>()
                .map((e) => ConditionalStyleCase.fromJson(e.cast<String, dynamic>()))
                .toList() ??
            const <ConditionalStyleCase>[],
        otherwise: json['otherwise'] is Map
            ? ConditionalStyleCase.fromJson((json['otherwise'] as Map).cast<String, dynamic>())
            : null,
      );
}

/// ¿El valor `raw` del dato cumple este caso? Texto case-insensitive + trim;
/// gt/gte/lt/lte numéricas; truthy/falsy ignoran `value`. Espejo de `matchConditionalCase`.
bool matchConditionalCase(ConditionalStyleCase c, Object? raw) {
  final op = c.op ?? 'eq';
  if (op == 'truthy') return _truthy(raw);
  if (op == 'falsy') return !_truthy(raw);

  if (op == 'gt' || op == 'gte' || op == 'lt' || op == 'lte') {
    final a = _asNumber(raw), b = _asNumber(c.value);
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
  if (op == 'contains') return t != '' && s.contains(t);
  if (op == 'neq') return s != t;
  return s == t; // eq
}

/// El CASO que matchea (no solo el merge), para que el caller lea su `target`.
/// Sin condicional / sin match / sin item → null. NO contempla el `otherwise`
/// (es puro "primer caso que coincide"). Espejo de `matchedConditionalCase`.
ConditionalStyleCase? matchedConditionalCase(
  ConditionalStyle? cond,
  Map<String, dynamic>? item,
) {
  if (cond == null || cond.fieldKey.isEmpty || cond.cases.isEmpty || item == null) return null;
  final raw = item[cond.fieldKey];
  for (final c in cond.cases) {
    if (matchConditionalCase(c, raw)) return c;
  }
  return null;
}

/// Caso EFECTIVO CON la cláusula else: el primer `case` que coincide o, si
/// ninguno, la cláusula `otherwise`; null si no hay ni match ni else. El else
/// aplica SOLO con condicional configurado (fieldKey + cases) y datos (item).
/// ESTE es el helper que debe usar el render. Espejo de `resolveConditionalStyling`.
ConditionalStyleCase? resolveConditionalStyling(
  ConditionalStyle? cond,
  Map<String, dynamic>? item,
) {
  if (cond == null || cond.fieldKey.isEmpty || cond.cases.isEmpty || item == null) return null;
  return matchedConditionalCase(cond, item) ?? cond.otherwise;
}

/// Apariencia EFECTIVA tras el estilo condicional: el caso/else efectivo MERGE-a
/// su appearance sobre la [base]; sin efectivo (o sin appearance) → [base].
/// Espejo de `resolveConditionalAppearance` (`{...base, ...eff.appearance}`).
SlotAppearance? resolveConditionalAppearance(
  ConditionalStyle? cond,
  SlotAppearance? base,
  Map<String, dynamic>? item,
) {
  final eff = resolveConditionalStyling(cond, item);
  final ap = eff?.appearance;
  if (ap == null) return base;
  return ap.mergedOver(base); // ap (caso) gana sobre base
}
