/// `synth.ts` — espejo 1:1: generación de items sintéticos para preview.
///
/// Determinismo cross-language: el hash FNV-1a 32-bit + el corpus literal son
/// GROUND TRUTH. Mismos seeds → mismos outputs que el TS (ver synth_test.dart,
/// snapshots idénticos). El hash REPLICA la aritmética de JS (multiplicación en
/// `double` IEEE-754 + `>>> 0`), no usa multiplicación exacta de 64-bit, para
/// producir los MISMOS valores que el TS.
library;

/// Field mínimo que el synth consume.
class SynthSourceField {
  final String key;
  final String type;
  final String? behavior;
  final List<String>? options;
  const SynthSourceField({
    required this.key,
    required this.type,
    this.behavior,
    this.options,
  });
}

/// Sección mínima que el synth necesita.
class SynthSourceSection {
  final List<SynthSourceField> fields;
  const SynthSourceSection(this.fields);
}

// ── Corpus (orden EXACTO = TS) ──────────────────────────────────────────────
const _firstNames = ['Lucía', 'Mateo', 'Sofía', 'Diego', 'Carmen', 'Javier', 'Elena', 'Pablo', 'Marta', 'Andrés'];
const _lastNames = ['García', 'López', 'Pérez', 'Martín', 'Hidalgo', 'Sánchez', 'Romero', 'Vega', 'Castro', 'Ortiz'];
const _cities = ['Sevilla', 'Madrid', 'Barcelona', 'Granada', 'Cádiz', 'Valencia', 'Málaga', 'Bilbao'];
const _countries = ['España', 'Brasil', 'Argentina', 'México', 'Francia', 'Italia', 'Alemania', 'Portugal'];
const _phrases = [
  'Una noche memorable bajo la luna llena.',
  'El compás marcaba el ritmo del corazón.',
  'Caminamos hasta el amanecer entre cánticos.',
  'La emoción del primer paso fue inolvidable.',
  'Bajo el palio, el silencio se hizo respeto.',
];
const _longBodies = [
  'Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero.',
  'Era una noche oscura y tormentosa. El viento azotaba las ventanas mientras escribíamos esta crónica.',
];
const _badgeValues = ['Común', 'Rara', 'Épica', 'Legendaria', 'Mítica'];
const _urls = ['https://kromia.app', 'https://example.com/page', 'https://www.real-madrid.com'];
const _emails = ['hola@kromia.app', 'contacto@ejemplo.com', 'sofia.perez@gmail.com'];
const _phones = ['+34 612 345 678', '+34 645 982 113', '+34 671 002 456'];

// ── Helpers ─────────────────────────────────────────────────────────────────

String _placeholderImage(int seed, [int width = 400, int height = 300]) =>
    'https://picsum.photos/seed/kromia-$seed/$width/$height';

const double _twoP32 = 4294967296.0; // 2^32

/// FNV-1a 32-bit REPLICANDO la aritmética de JS (multiplicación en double +
/// `>>> 0`). NO usar mult exacto de 64-bit: divergiría del TS para h grandes.
int hash(String str) {
  var h = 0x811c9dc5; // offset basis (uint32)
  for (var i = 0; i < str.length; i++) {
    final xored = (h ^ str.codeUnitAt(i)) & 0xFFFFFFFF;
    // ToInt32 (signed) como hace JS antes de multiplicar.
    final hSigned = xored >= 0x80000000 ? xored - 0x100000000 : xored;
    // Multiplicación en double (IEEE-754) → misma pérdida de precisión que JS.
    final product = hSigned.toDouble() * 16777619.0;
    // ToUint32(product) == `>>> 0`.
    var m = product.truncateToDouble().remainder(_twoP32);
    if (m < 0) m += _twoP32;
    h = m.toInt();
  }
  return h;
}

T _pick<T>(List<T> arr, String seed) => arr[hash(seed) % arr.length];

/// HSL → hex `#rrggbb` (mismo algoritmo que el TS).
String _hslToHex(int h, int s, int l) {
  final sN = s / 100;
  final lN = l / 100;
  final c = (1 - (2 * lN - 1).abs()) * sN;
  final x = c * (1 - (((h / 60) % 2) - 1).abs());
  final m = lN - c / 2;
  double r = 0, g = 0, b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  String to255(double v) =>
      ((v + m) * 255).round().toRadixString(16).padLeft(2, '0');
  return '#${to255(r)}${to255(g)}${to255(b)}';
}

// ── API pública ──────────────────────────────────────────────────────────────

/// Genera N items sintéticos para la sección dada.
List<Map<String, dynamic>> synthSectionItems(
  String sectionKey,
  SynthSourceSection section, [
  int count = 3,
]) {
  final out = <Map<String, dynamic>>[];
  for (var i = 0; i < count; i++) {
    final item = <String, dynamic>{};
    for (final f in section.fields) {
      item[f.key] = synthFieldValue(f, '$sectionKey-$i-${f.key}', i);
    }
    out.add(item);
  }
  return out;
}

/// Value coherente con el behavior/type del field.
dynamic synthFieldValue(SynthSourceField field, String seed, int idx) {
  final type = field.type;
  final behavior = field.behavior;

  switch (behavior) {
    case 'avatar':
      return _placeholderImage(hash(seed) % 100, 200, 200);
    case 'banner':
      return _placeholderImage(hash(seed) % 100, 600, 200);
    case 'cover':
    case 'thumbnail':
      return _placeholderImage(hash(seed) % 100, 400, 300);
    case 'gallery':
    case 'slideshow':
    case 'card_multiview':
      return [0, 1, 2].map((o) => _placeholderImage((hash(seed) + o) % 100, 400, 300)).toList();
    case 'url':
      return _pick(_urls, seed);
    case 'email':
      return _pick(_emails, seed);
    case 'phone':
      return _pick(_phones, seed);
    case 'rating':
      return (hash(seed) % 5) + 1;
    case 'color_hex':
      return _hslToHex(hash(seed) % 360, 65, 55);
    case 'year':
      return 1980 + (hash(seed) % 45);
    case 'iso_date':
      final mm = (idx % 12 + 1).toString().padLeft(2, '0');
      final dd = ((idx * 7 + 3) % 28 + 1).toString().padLeft(2, '0');
      return '2024-$mm-$dd';
    case 'card_index_list':
      return [1 + idx, 2 + idx, 3 + idx];
    case 'card_code_list':
      return ['C-${100 + idx}', 'C-${200 + idx}'];
    case 'markdown':
    case 'notes':
    case 'html':
      return _pick(_longBodies, seed);
  }

  if (type == 'number') return hash(seed) % 100;
  if (type == 'image') return _placeholderImage(hash(seed) % 100, 400, 300);
  if (type == 'textarea') return _pick(_longBodies, seed);
  if (type == 'select') {
    final opts = field.options;
    if (opts != null && opts.isNotEmpty) return opts[idx % opts.length];
    return _pick(_badgeValues, seed);
  }
  if (type.startsWith('array<')) {
    if (type.contains('cardRef') || type.contains('sectionRef')) {
      return [1, 2, 3];
    }
    if (type == 'array<image>') {
      return [0, 1, 2].map((o) => _placeholderImage((hash(seed) + o) % 100, 400, 300)).toList();
    }
    return [_pick(_cities, seed), _pick(_cities, '${seed}b'), _pick(_cities, '${seed}c')];
  }

  final key = field.key.toLowerCase();
  if (key.contains('name') || key.contains('nombre') || key.contains('title') || key.contains('titulo')) {
    return '${_pick(_firstNames, seed)} ${_pick(_lastNames, '${seed}l')}';
  }
  if (key.contains('country') || key.contains('pais') || key.contains('nacion')) {
    return _pick(_countries, seed);
  }
  if (key.contains('city') || key.contains('ciudad') || key.contains('location') || key.contains('lugar')) {
    return _pick(_cities, seed);
  }
  if (key.contains('description') || key.contains('descripcion') || key.contains('bio')) {
    return _pick(_phrases, seed);
  }
  if (key.contains('team') || key.contains('equipo') || key.contains('club')) {
    return '${_pick(_cities, seed)} ${_pick(_firstNames, '${seed}b')}';
  }

  return _pick(_phrases, seed);
}
