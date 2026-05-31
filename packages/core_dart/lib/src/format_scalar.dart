/// `formatScalar` — espejo 1:1 de `format-scalar.ts`.
///
/// Formato visible de un valor escalar según su behavior. Función pura:
/// `(value, def?) → String`. No produce widgets — solo el texto final. El
/// caller decide cómo lo envuelve. Determinismo cross-language: mismos
/// `(value, behavior)` → mismo output que el TS (ver format_scalar_test.dart).
library;

import 'dart:convert';

import 'field_def.dart';

const Map<String, String> _currencySymbols = {
  'EUR': '€', 'USD': '\$', 'GBP': '£', 'JPY': '¥',
};

bool _isEmpty(dynamic v) {
  if (v == null) return true;
  if (v is String) return v.trim().isEmpty;
  if (v is List) return v.isEmpty;
  return false;
}

/// String de un número como lo daría `String(n)` en JS (sin `.0` en enteros).
String _numStr(num v) {
  if (v is int) return v.toString();
  if (v == v.truncateToDouble()) return v.toInt().toString();
  return v.toString();
}

/// Inserta separador de miles '.' (es-ES) en una cadena de dígitos.
String _groupThousands(String digits) {
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write('.');
    buf.write(digits[i]);
  }
  return buf.toString();
}

/// Formato es-ES con 2 decimales: 1234.5 → "1.234,50".
String _formatEs2dec(num value) {
  final neg = value < 0;
  final cents = (value.abs() * 100).round();
  final intPart = cents ~/ 100;
  final decPart = cents % 100;
  final s = '${_groupThousands(intPart.toString())},${decPart.toString().padLeft(2, '0')}';
  return neg ? '-$s' : s;
}

/// Formato visible para un valor escalar según su behavior.
String formatScalar(dynamic value, [FieldDefLike? def]) {
  if (_isEmpty(value)) return '';
  final b = def?.behavior;

  // Año entero: 2026 (sin separadores).
  if (b == 'year' && value is num) return _numStr(value);

  // Fecha ISO: 2026-05-24 → "24/5/2026" (es). Inválida → string original.
  if (b == 'iso_date' && value is String) {
    try {
      final d = DateTime.parse(value);
      return '${d.day}/${d.month}/${d.year}';
    } catch (_) {
      return value;
    }
  }

  // Currency: 19.99 → "19,99 €".
  if (b == 'currency' && value is num) {
    return '${_formatEs2dec(value)} ${_currencySymbols['EUR']}';
  }

  // Percentage: 75 → "75 %".
  if (b == 'percentage' && value is num) return '${_numStr(value)} %';

  // Rating: 4 → "★★★★☆".
  if (b == 'rating' && value is num) {
    const max = 5;
    final v = value.round().clamp(0, max).toInt();
    return '★' * v + '☆' * (max - v);
  }

  // Measurement: la unidad la define behaviorConfig del editor.
  if (b == 'measurement') {
    return value is num ? _numStr(value) : value.toString();
  }

  // Incremental (KRO-84 V2): pad + prefijo/sufijo opcionales (solo presentación).
  if (b == 'incremental' && value is num) {
    final cfg = def?.behaviorConfig ?? const <String, dynamic>{};
    final padRaw = cfg['pad'];
    final pad = (padRaw is num && padRaw > 0) ? padRaw.truncate() : 0;
    final prefix = cfg['prefix'] is String ? cfg['prefix'] as String : '';
    final suffix = cfg['suffix'] is String ? cfg['suffix'] as String : '';
    final n = value.truncate();
    final body = pad > 0
        ? n.abs().toString().padLeft(pad, '0')
        : n.abs().toString();
    return '${n < 0 ? '-' : ''}$prefix$body$suffix';
  }

  // ordinal_enum / enum: el valor ya es string del catálogo.
  if (value is String) return value;
  if (value is num) return _numStr(value);
  if (value is bool) return value ? 'sí' : 'no';

  // Fallback: stringify defensivo.
  try {
    return jsonEncode(value);
  } catch (_) {
    return value.toString();
  }
}
