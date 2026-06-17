/// Corpus de la calibración de imágenes — ESPEJO de `tests/image-calibration.test.ts`
/// (KRO-33). Lectura/validación/escritura del transform + estado sobre el dato de
/// la carta (claves reservadas).
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

const T = ImageTransform(offsetX: 0.3, offsetY: 0.7, scale: 1.5, rotation: 90);

void main() {
  group('isValidImageTransform', () {
    test('acepta un transform en rango (rotation opcional)', () {
      expect(isValidImageTransform(T), isTrue);
      expect(isValidImageTransform({'offsetX': 0, 'offsetY': 1, 'scale': 1}), isTrue);
    });
    test('rechaza offsets fuera de [0,1], scale<1 y no-objetos', () {
      expect(isValidImageTransform({'offsetX': -0.1, 'offsetY': 0.5, 'scale': 1}), isFalse);
      expect(isValidImageTransform({'offsetX': 0.5, 'offsetY': 1.2, 'scale': 1}), isFalse);
      expect(isValidImageTransform({'offsetX': 0.5, 'offsetY': 0.5, 'scale': 0.5}), isFalse);
      expect(isValidImageTransform({'offsetX': 0.5, 'offsetY': 0.5, 'scale': 1, 'rotation': 'x'}), isFalse);
      expect(isValidImageTransform(null), isFalse);
      expect(isValidImageTransform('nope'), isFalse);
    });
  });

  group('normalizeImageTransform', () {
    test('clampa offsets a [0,1] y scale a ≥1', () {
      expect(
        normalizeImageTransform(const ImageTransform(offsetX: -1, offsetY: 5, scale: 0.2)),
        const ImageTransform(offsetX: 0, offsetY: 1, scale: 1),
      );
    });
    test('envuelve rotation a [0,360) y la omite si no es número', () {
      expect(normalizeImageTransform(const ImageTransform(offsetX: 0.5, offsetY: 0.5, scale: 1, rotation: 450)).rotation, 90);
      expect(normalizeImageTransform(const ImageTransform(offsetX: 0.5, offsetY: 0.5, scale: 1, rotation: -90)).rotation, 270);
      expect(normalizeImageTransform(const ImageTransform(offsetX: 0.5, offsetY: 0.5, scale: 1)).rotation, isNull);
    });
    test('offsets no finitos → centro (0.5)', () {
      expect(normalizeImageTransform(const ImageTransform(offsetX: double.nan, offsetY: 0.5, scale: 1)).offsetX, 0.5);
    });
  });

  group('getCardImageTransforms / getCardImageTransform', () {
    test('lee el mapa y descarta entradas malformadas', () {
      final card = {
        imageTransformsKey: {'image': T, 'bad': {'offsetX': 9}},
      };
      expect(getCardImageTransforms(card), {'image': T});
      expect(getCardImageTransform(card, 'image'), T);
      expect(getCardImageTransform(card, 'nope'), isNull);
    });
    test('carta vacía/sin clave → {}', () {
      expect(getCardImageTransforms({}), <String, ImageTransform>{});
      expect(getCardImageTransforms(null), <String, ImageTransform>{});
    });
  });

  group('getCardCalibrationState', () {
    test('devuelve el estado guardado si es válido', () {
      expect(getCardCalibrationState({calibrationStateKey: 'auto_calibrated'}), 'auto_calibrated');
    });
    test('deriva calibrated si hay transforms y no hay estado guardado', () {
      expect(getCardCalibrationState({imageTransformsKey: {'image': T}}), 'calibrated');
    });
    test('deriva pending_calibration por defecto', () {
      expect(getCardCalibrationState({}), 'pending_calibration');
      expect(getCardCalibrationState(null), 'pending_calibration');
    });
    test('ignora un estado guardado inválido y deriva', () {
      expect(getCardCalibrationState({calibrationStateKey: 'garbage'}), 'pending_calibration');
    });
  });

  group('setCardImageTransform', () {
    test('escribe el transform (normalizado) y marca calibrated, inmutable', () {
      final card = <String, dynamic>{'number': 12};
      final next = setCardImageTransform(card, 'image', const ImageTransform(offsetX: 2, offsetY: 0.4, scale: 0.1));
      expect(identical(next, card), isFalse);
      expect(card[imageTransformsKey], isNull);
      expect(getCardImageTransform(next, 'image'), const ImageTransform(offsetX: 1, offsetY: 0.4, scale: 1));
      expect(getCardCalibrationState(next), 'calibrated');
      expect(next['number'], 12);
    });
    test('preserva transforms de otros campos al añadir uno', () {
      final card = setCardImageTransform({}, 'front', T);
      final next = setCardImageTransform(card, 'back', identityImageTransform);
      expect(getCardImageTransforms(next).keys.toList()..sort(), ['back', 'front']);
    });
  });

  group('markCardAutoCalibrated / setCardCalibrationState', () {
    test('markCardAutoCalibrated marca auto sin tocar transforms', () {
      final card = setCardImageTransform({}, 'image', T);
      final next = markCardAutoCalibrated(card);
      expect(getCardCalibrationState(next), 'auto_calibrated');
      expect(getCardImageTransform(next, 'image'), T); // el transform sigue ahí
    });
    test('setCardCalibrationState fija el estado crudo', () {
      expect(getCardCalibrationState(setCardCalibrationState({}, 'pending_calibration')), 'pending_calibration');
    });
  });

  group('catálogo + identidad', () {
    test('calibrationStates tiene los 3 estados', () {
      expect(calibrationStates, ['pending_calibration', 'calibrated', 'auto_calibrated']);
    });
    test('IDENTITY = centro, sin zoom', () {
      expect(identityImageTransform, const ImageTransform(offsetX: 0.5, offsetY: 0.5, scale: 1));
    });
  });
}
