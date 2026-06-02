/// `tag_styles.dart` — KRO-30. `TagStyle` + validador puro contra el catálogo
/// de efectos visuales. Espejo de `tag-styles.ts` (+ el tipo `TagStyle` de
/// `types.ts`).
///
/// Pure: sin side effects, sin I/O. Mismas entradas → mismas issues.
library;

import 'visual_effects.dart';

/// Mapeo valor-de-tag → efecto visual. Vive en `albumSchema.tagStyles`. Una
/// carta cuya tag tenga este `value` dispara el `effect` (con `config`).
class TagStyle {
  /// Valor EXACTO de la tag que dispara el efecto (ej. "Holográfica").
  final String value;

  /// ID del efecto del catálogo (ej. "holographic_effect").
  final String effect;

  /// Config opcional del efecto. Keys + espacio de valores los define el efecto
  /// (valores `String | num`).
  final Map<String, Object>? config;

  const TagStyle({required this.value, required this.effect, this.config});

  factory TagStyle.fromJson(Map<String, dynamic> json) => TagStyle(
        value: (json['value'] as String?) ?? '',
        effect: (json['effect'] as String?) ?? '',
        config: (json['config'] as Map?)
            ?.map((k, v) => MapEntry(k.toString(), v as Object)),
      );
}

/// Un issue del validador de tag styles. Espejo de `TagStyleValidationIssue`.
class TagStyleValidationIssue {
  /// Índice del TagStyle en el array (-1 si se validó uno suelto).
  final int index;
  final String path;
  final String message;

  /// 'error' = no aplicable; 'warn' = aplicable con fallback.
  final String level;

  const TagStyleValidationIssue({
    required this.index,
    required this.path,
    required this.message,
    required this.level,
  });

  @override
  String toString() => '[$level] $path: $message';
}

/// Resultado de [validateTagStyles]. Espejo de `TagStyleValidationResult`.
class TagStyleValidationResult {
  final bool valid;
  final List<TagStyleValidationIssue> issues;
  const TagStyleValidationResult({required this.valid, required this.issues});
}

void _collectTagStyleIssues(
    TagStyle ts, int index, String prefix, List<TagStyleValidationIssue> issues) {
  // 1. value no vacío.
  if (ts.value.trim().isEmpty) {
    issues.add(TagStyleValidationIssue(
        index: index,
        path: '$prefix.value',
        level: 'error',
        message: 'el valor de la tag no puede estar vacío'));
  }

  // 2. effect existe en el catálogo.
  final effect = getVisualEffect(ts.effect);
  if (effect == null) {
    issues.add(TagStyleValidationIssue(
        index: index,
        path: '$prefix.effect',
        level: 'error',
        message:
            'el efecto "${ts.effect}" no existe en el catálogo de efectos visuales'));
    return; // sin definición no podemos validar config.
  }

  final params = effect.config;
  final paramByKey = {for (final p in params) p.key: p};
  final config = ts.config ?? const <String, Object>{};

  // 3. cada key de config pertenece al efecto.
  config.forEach((key, value) {
    final param = paramByKey[key];
    if (param == null) {
      issues.add(TagStyleValidationIssue(
          index: index,
          path: '$prefix.config.$key',
          level: 'error',
          message: '"$key" no es una opción de config del efecto "${ts.effect}"'));
      return;
    }
    _validateConfigValue(param, value, index, '$prefix.config.$key', issues);
  });

  // 4. params requeridos presentes.
  for (final param in params) {
    if (param.optional == false && !config.containsKey(param.key)) {
      issues.add(TagStyleValidationIssue(
          index: index,
          path: '$prefix.config.${param.key}',
          level: 'error',
          message: 'el efecto "${ts.effect}" requiere config "${param.key}"'));
    }
  }
}

void _validateConfigValue(VisualEffectConfigParam param, Object value, int index,
    String path, List<TagStyleValidationIssue> issues) {
  switch (param.type) {
    case 'enum':
      if (value is! String || !(param.options ?? const []).contains(value)) {
        issues.add(TagStyleValidationIssue(
            index: index,
            path: path,
            level: 'error',
            message:
                'valor "$value" inválido (admitidos: ${(param.options ?? const []).join(', ')})'));
      }
      break;
    case 'number':
      if (value is! num) {
        issues.add(TagStyleValidationIssue(
            index: index, path: path, level: 'error', message: 'valor "$value" no es un número'));
        break;
      }
      if (param.min != null && value < param.min!) {
        issues.add(TagStyleValidationIssue(
            index: index, path: path, level: 'error', message: '$value < mínimo ${param.min}'));
      }
      if (param.max != null && value > param.max!) {
        issues.add(TagStyleValidationIssue(
            index: index, path: path, level: 'error', message: '$value > máximo ${param.max}'));
      }
      break;
    case 'string':
      if (value is! String) {
        issues.add(TagStyleValidationIssue(
            index: index, path: path, level: 'error', message: 'valor "$value" no es un string'));
      }
      break;
  }
}

/// Valida un [TagStyle] suelto. `true` si no tiene issues `error`.
bool isTagStyleValid(TagStyle ts) {
  final issues = <TagStyleValidationIssue>[];
  _collectTagStyleIssues(ts, -1, 'tagStyle', issues);
  return !issues.any((i) => i.level == 'error');
}

/// Valida el array completo (`albumSchema.tagStyles`). Además avisa (`warn`) de
/// valores de tag duplicados (dos estilos para el mismo `value` → ambigüedad).
TagStyleValidationResult validateTagStyles(List<TagStyle> tagStyles) {
  final issues = <TagStyleValidationIssue>[];

  for (var index = 0; index < tagStyles.length; index++) {
    _collectTagStyleIssues(tagStyles[index], index, 'tagStyles[$index]', issues);
  }

  // Duplicados por `value` → warn (se aplicaría el primero).
  final seen = <String, int>{};
  for (var index = 0; index < tagStyles.length; index++) {
    final ts = tagStyles[index];
    if (ts.value.trim().isEmpty) continue;
    final prev = seen[ts.value];
    if (prev != null) {
      issues.add(TagStyleValidationIssue(
          index: index,
          path: 'tagStyles[$index].value',
          level: 'warn',
          message:
              'valor de tag "${ts.value}" duplicado (ya definido en tagStyles[$prev]); se aplicaría el primero'));
    } else {
      seen[ts.value] = index;
    }
  }

  return TagStyleValidationResult(
      valid: !issues.any((i) => i.level == 'error'), issues: issues);
}
