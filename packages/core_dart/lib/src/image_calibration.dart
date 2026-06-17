/// `image_calibration.dart` — KRO-33. Espejo Dart de `image-calibration.ts`.
///
/// Calibración fina de imágenes POR CARTA: el encuadre se ajusta en Flutter
/// (pinch/zoom/drag) y se hace write-back a Studio, que guarda solo un
/// `ImageTransform` por imagen como metadata (recalibrable, sin perder calidad).
///
/// Lógica PURA (lectura/validación/escritura del dato + catálogo de estados),
/// compartida por Studio (CSS `imageTransformStyle`) y Flutter (`Transform`). Los
/// datos viven en el DATO de la carta bajo claves reservadas; NO entran al `.json`
/// del contrato → SIN bump de PROTOCOL_VERSION.
///
/// Ground truth cross-language: `tests/image-calibration.test.ts`.
library;

/// Encuadre fino de UNA imagen de carta (per-carta, no per-slot). Espejo de
/// `ImageTransform` (types.ts).
class ImageTransform {
  /// Punto focal horizontal 0..1 (0.5 = centro): qué parte queda centrada.
  final double offsetX;

  /// Punto focal vertical 0..1 (0.5 = centro).
  final double offsetY;

  /// Escala ≥ 1 (1 = fit natural al frame, >1 = zoom in).
  final double scale;

  /// Rotación en grados (opcional, default sin rotación).
  final double? rotation;

  const ImageTransform({
    required this.offsetX,
    required this.offsetY,
    required this.scale,
    this.rotation,
  });

  factory ImageTransform.fromJson(Map json) => ImageTransform(
        offsetX: (json['offsetX'] as num).toDouble(),
        offsetY: (json['offsetY'] as num).toDouble(),
        scale: (json['scale'] as num).toDouble(),
        rotation: (json['rotation'] as num?)?.toDouble(),
      );

  /// JSON canónico: `rotation` se OMITE si es null (espejo del TS, donde la clave
  /// no existe cuando no hay rotación) → forma estable para el write-back.
  Map<String, dynamic> toJson() => {
        'offsetX': offsetX,
        'offsetY': offsetY,
        'scale': scale,
        if (rotation != null) 'rotation': rotation,
      };

  @override
  bool operator ==(Object other) =>
      other is ImageTransform &&
      other.offsetX == offsetX &&
      other.offsetY == offsetY &&
      other.scale == scale &&
      other.rotation == rotation;

  @override
  int get hashCode => Object.hash(offsetX, offsetY, scale, rotation);

  @override
  String toString() => 'ImageTransform($offsetX, $offsetY, x$scale, rot=$rotation)';
}

// ── Catálogo de estados de calibración (CalibrationState es un string-union TS) ─
const String calibrationPending = 'pending_calibration';
const String calibrationCalibrated = 'calibrated';
const String calibrationAuto = 'auto_calibrated';

/// Catálogo cerrado (orden lógico pending → calibrated → auto).
const List<String> calibrationStates = [calibrationPending, calibrationCalibrated, calibrationAuto];

/// Campo reservado del dato de la carta: mapa `fieldKey` → `ImageTransform`.
const String imageTransformsKey = '__imageTransforms';

/// Campo reservado del dato de la carta: estado de calibración.
const String calibrationStateKey = '__calibrationState';

/// Transform identidad: fit natural, centrado, sin zoom ni rotación.
const ImageTransform identityImageTransform = ImageTransform(offsetX: 0.5, offsetY: 0.5, scale: 1);

double _clamp01(num n) {
  if (!n.isFinite) return 0.5;
  return n.clamp(0, 1).toDouble();
}

/// ¿Tiene forma de `ImageTransform` válido? (offset ∈ [0,1], scale ≥ 1, rotation
/// número u omitido). Acepta una instancia `ImageTransform` o un mapa crudo (JSON).
bool isValidImageTransform(Object? t) {
  if (t is ImageTransform) {
    return t.offsetX >= 0 && t.offsetX <= 1 && t.offsetY >= 0 && t.offsetY <= 1 && t.scale >= 1;
  }
  if (t is! Map) return false;
  final ox = t['offsetX'], oy = t['offsetY'], sc = t['scale'], rot = t['rotation'];
  return ox is num && ox >= 0 && ox <= 1 &&
      oy is num && oy >= 0 && oy <= 1 &&
      sc is num && sc >= 1 &&
      (rot == null || rot is num);
}

/// Normaliza un transform (clamp de rangos + wrap de rotación a [0,360)). Úsalo
/// al recibir uno del write-back / al escribirlo.
ImageTransform normalizeImageTransform(ImageTransform t) {
  double? rot;
  if (t.rotation != null && t.rotation!.isFinite) {
    rot = ((t.rotation! % 360) + 360) % 360;
  }
  return ImageTransform(
    offsetX: _clamp01(t.offsetX),
    offsetY: _clamp01(t.offsetY),
    scale: t.scale.isFinite ? (t.scale < 1 ? 1.0 : t.scale.toDouble()) : 1.0,
    rotation: rot,
  );
}

/// Lee el mapa `fieldKey` → `ImageTransform` de una carta (descarta malformados).
Map<String, ImageTransform> getCardImageTransforms(Map? card) {
  if (card == null) return {};
  final raw = card[imageTransformsKey];
  if (raw is! Map) return {};
  final out = <String, ImageTransform>{};
  raw.forEach((key, val) {
    if (isValidImageTransform(val)) {
      out[key.toString()] = val is ImageTransform ? val : ImageTransform.fromJson(val as Map);
    }
  });
  return out;
}

/// Transform de un campo de imagen concreto (o null si no está calibrado).
ImageTransform? getCardImageTransform(Map? card, String fieldKey) => getCardImageTransforms(card)[fieldKey];

/// Estado de calibración EFECTIVO. Devuelve el guardado si es válido; si no, lo
/// deriva: con transforms → `calibrated`; sin ellos → `pending_calibration`.
/// (`auto_calibrated` solo se alcanza explícitamente.)
String getCardCalibrationState(Map? card) {
  if (card != null) {
    final stored = card[calibrationStateKey];
    if (stored is String && calibrationStates.contains(stored)) return stored;
    if (getCardImageTransforms(card).isNotEmpty) return calibrationCalibrated;
  }
  return calibrationPending;
}

/// Setea (inmutable) el transform de un campo y marca la carta `calibrated`. El
/// mapa de transforms se guarda como JSON (forma estable, serializable).
Map<String, dynamic> setCardImageTransform(Map<String, dynamic> card, String fieldKey, ImageTransform transform) {
  final transforms = <String, dynamic>{
    for (final e in getCardImageTransforms(card).entries) e.key: e.value.toJson(),
    fieldKey: normalizeImageTransform(transform).toJson(),
  };
  return {...card, imageTransformsKey: transforms, calibrationStateKey: calibrationCalibrated};
}

/// Marca (inmutable) la carta como `auto_calibrated` (cover+center, sin transform).
Map<String, dynamic> markCardAutoCalibrated(Map<String, dynamic> card) =>
    {...card, calibrationStateKey: calibrationAuto};

/// Setea (inmutable) el estado de calibración crudo (resets/migraciones).
Map<String, dynamic> setCardCalibrationState(Map<String, dynamic> card, String state) =>
    {...card, calibrationStateKey: state};
