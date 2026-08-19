/// `rarity.dart` — KRO-28. Fuente de rareza: tipos + validación + helpers puros.
/// Espejo de `rarity.ts` (+ los tipos `RaritySource`/`RarityBucket` de types.ts).
///
/// Un field `rating`/`enum`/`ordinal_enum` del cardSchema puede marcarse como
/// "fuente de rareza" (`cardSchema.raritySource`) con una distribución de pesos
/// por valor (enum) o por rango (rating). El cliente reparte cartas respetando
/// esos pesos. Pure: sin side effects, sin random.
library;

import 'field_def.dart';

/// Un bucket de la distribución de rareza. Espejo de `RarityBucket`.
class RarityBucket {
  /// Para `enum`/`ordinal_enum`: valor exacto del field.
  final String? value;

  /// Para `rating` (numérico): rango inclusivo `[min, max]`.
  final List<num>? range;

  /// Peso de aparición. Convención 0..100 (se normaliza al repartir).
  final num weight;

  /// KRO-349 — ¿conseguir una carta de esta rareza es un MOMENTO? Lo declara el
  /// publisher; no se deduce.
  ///
  /// Existe porque Kromia es genérico: cada publisher inventa sus rarezas y les
  /// pone los nombres que quiere, así que **«rara» no significa lo mismo en dos
  /// álbumes** y ningún host puede adivinar cuáles son las gordas.
  ///
  /// Va en el BUCKET y no en la carta a propósito: el publisher ya declara sus
  /// tres o cinco niveles con sus pesos, así que marcarlos ahí es una decisión
  /// por nivel en vez de repasar quinientos cromos, y una carta nueva hereda el
  /// suyo sin que nadie se acuerde de nada.
  final bool highlight;

  const RarityBucket(
      {this.value, this.range, required this.weight, this.highlight = false});

  factory RarityBucket.fromJson(Map<String, dynamic> json) => RarityBucket(
        value: json['value'] as String?,
        range: (json['range'] as List?)?.map((e) => e as num).toList(),
        weight: (json['weight'] as num?) ?? 0,
        // Ausente = no es momento: un álbum que no declara nada se comporta
        // exactamente como hasta ahora.
        highlight: json['highlight'] == true,
      );
}

/// Fuente de rareza declarada en `cardSchema.raritySource`. Espejo de `RaritySource`.
class RaritySource {
  /// Key del field (rating/enum/ordinal_enum) que define la rareza.
  final String fieldKey;

  /// Distribución por valor (enum) o por rango (rating).
  final List<RarityBucket> buckets;

  const RaritySource({required this.fieldKey, required this.buckets});

  factory RaritySource.fromJson(Map<String, dynamic> json) => RaritySource(
        fieldKey: (json['fieldKey'] as String?) ?? '',
        buckets: ((json['buckets'] as List?) ?? const [])
            .map((e) => RarityBucket.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );
}

class RarityValidationIssue {
  final String path;
  final String message;
  final String level; // 'error' | 'warn'
  const RarityValidationIssue(
      {required this.path, required this.message, required this.level});

  @override
  String toString() => '[$level] $path: $message';
}

class RarityValidationResult {
  final bool valid;
  final List<RarityValidationIssue> issues;
  const RarityValidationResult({required this.valid, required this.issues});
}

const Set<String> _rarityBehaviors = {'rating', 'enum', 'ordinal_enum'};

/// ¿El field puede marcarse como fuente de rareza? (rating/enum/ordinal_enum).
bool isFieldEligibleForRarity(FieldDefLike field) =>
    _rarityBehaviors.contains(field.behavior ?? '');

/// Valida una [RaritySource] contra los fieldDefs del cardSchema. `null` → válido.
RarityValidationResult validateRaritySource(
    RaritySource? rs, List<FieldDefLike> fieldDefs) {
  final issues = <RarityValidationIssue>[];
  if (rs == null) return RarityValidationResult(valid: true, issues: issues);

  // 1) field existe + es elegible.
  FieldDefLike? field;
  for (final f in fieldDefs) {
    if (f.key == rs.fieldKey) {
      field = f;
      break;
    }
  }
  if (field == null) {
    issues.add(RarityValidationIssue(
        path: 'raritySource.fieldKey',
        level: 'error',
        message: 'el field "${rs.fieldKey}" no existe en el schema'));
  } else if (!isFieldEligibleForRarity(field)) {
    issues.add(RarityValidationIssue(
        path: 'raritySource.fieldKey',
        level: 'error',
        message:
            'el field "${rs.fieldKey}" no es elegible (requiere behavior rating/enum/ordinal_enum)'));
  }

  // 2) buckets no vacíos.
  final buckets = rs.buckets;
  if (buckets.isEmpty) {
    issues.add(const RarityValidationIssue(
        path: 'raritySource.buckets',
        level: 'error',
        message: 'la fuente de rareza no tiene buckets'));
  }

  final isRating = field?.behavior == 'rating';
  final options = field?.options ?? const <String>[];

  for (var i = 0; i < buckets.length; i++) {
    final b = buckets[i];
    final hasValue = b.value != null;
    final hasRange = b.range != null;
    final at = 'raritySource.buckets[$i]';

    // 3) exactamente uno de value|range.
    if (hasValue == hasRange) {
      issues.add(RarityValidationIssue(
          path: at,
          level: 'error',
          message:
              'cada bucket debe declarar exactamente uno: value (enum) o range (rating)'));
    }

    // 4) shape acorde al behavior.
    if (isRating && hasValue) {
      issues.add(RarityValidationIssue(
          path: '$at.value', level: 'warn', message: 'el field es rating → usa range, no value'));
    }
    if (!isRating && hasRange) {
      issues.add(RarityValidationIssue(
          path: '$at.range', level: 'warn', message: 'el field es enum → usa value, no range'));
    }

    // 5) range coherente.
    if (hasRange) {
      final r = b.range!;
      if (r.length < 2 || r[0].isNaN || r[1].isNaN) {
        issues.add(RarityValidationIssue(
            path: '$at.range', level: 'error', message: 'range debe ser [number, number]'));
      } else if (r[0] > r[1]) {
        issues.add(RarityValidationIssue(
            path: '$at.range',
            level: 'error',
            message: 'range inválido: min ${r[0]} > max ${r[1]}'));
      }
    }

    // 6) value dentro de las options del field (si las hay).
    if (hasValue && options.isNotEmpty && !options.contains(b.value)) {
      issues.add(RarityValidationIssue(
          path: '$at.value',
          level: 'warn',
          message: 'el valor "${b.value}" no está en las options del field'));
    }

    // 7) weight numérico >= 0.
    if (b.weight.isNaN || b.weight < 0) {
      issues.add(RarityValidationIssue(
          path: '$at.weight', level: 'error', message: 'weight debe ser un número >= 0'));
    }
  }

  // 8) pesos suman ~100 → warn.
  final total =
      buckets.fold<num>(0, (s, b) => s + (b.weight >= 0 ? b.weight : 0));
  if (buckets.isNotEmpty && (total - 100).abs() > 0.01) {
    issues.add(RarityValidationIssue(
        path: 'raritySource.buckets',
        level: 'warn',
        message: 'los pesos suman $total (no 100); se normalizarán al repartir'));
  }

  return RarityValidationResult(
      valid: !issues.any((it) => it.level == 'error'), issues: issues);
}

/// Devuelve el bucket al que pertenece [value]: por igualdad (enum) o por rango
/// inclusivo (rating). `null` si ninguno aplica. Primer match gana.
RarityBucket? rarityBucketForValue(Object value, List<RarityBucket> buckets) {
  for (final b in buckets) {
    if (b.value != null) {
      if (value.toString() == b.value) return b;
    } else if (b.range != null && b.range!.length >= 2) {
      final n = value is num ? value : num.tryParse(value.toString());
      if (n != null && !n.isNaN && n >= b.range![0] && n <= b.range![1]) return b;
    }
  }
  return null;
}

/// Normaliza los pesos para que sumen 100, preservando proporciones. Si todos
/// son 0 (o no hay), reparte equitativamente. Pure: devuelve buckets nuevos.
List<RarityBucket> normalizeRarityWeights(List<RarityBucket> buckets) {
  if (buckets.isEmpty) return const [];
  final total = buckets.fold<num>(0, (s, b) => s + (b.weight > 0 ? b.weight : 0));
  if (total <= 0) {
    final equal = 100 / buckets.length;
    return buckets
        .map((b) => RarityBucket(value: b.value, range: b.range, weight: equal))
        .toList();
  }
  return buckets
      .map((b) => RarityBucket(
          value: b.value,
          range: b.range,
          weight: ((b.weight > 0 ? b.weight : 0) / total) * 100))
      .toList();
}

/// KRO-349 — ¿la rareza de esta carta es una de las que el publisher marcó como
/// MOMENTO? Espejo de `isHighlightRarity` (`rarity.ts`).
///
/// Vive aquí y no en cada host porque casar el valor de una carta con su bucket
/// **no es una comparación**: para un `enum` es el valor exacto y para un
/// `rating` es un rango inclusivo. Escrito dos veces, un álbum por puntuación se
/// celebraría en un sitio y en el otro no — la misma familia de fallo que
/// KRO-302 y KRO-338.
///
/// Reutiliza [rarityBucketForValue] en vez de repetir el emparejamiento: si
/// algún día cambia cómo se casa un bucket, cambia en un solo sitio.
bool isHighlightRarity(RaritySource? rs, Object? value) {
  final buckets = rs?.buckets;
  if (buckets == null || buckets.isEmpty) return false;
  if (value == null || value == '') return false;
  return rarityBucketForValue(value, buckets)?.highlight == true;
}
