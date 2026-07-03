import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-16 — espejo Dart de `card-qr.ts`: contrato del QR firmado + verificación
/// ECDSA P-256. El VECTOR (`sig`/`pub`/`other`) lo generó node/WebCrypto (imita
/// al backend) sobre este mismo `signingInput` → probamos la INTEROPERABILIDAD
/// real: firma WebCrypto (P1363) ↔ verificación pointycastle. Si el formato de
/// firma driftara entre plataformas, este test lo cazaría.
void main() {
  // v=1, kind, id, albumId, cardIndex=5, serial='0123/5000' (idéntico al test TS).
  const sig =
      'AUFa_vetYNjmYQ5uQG7xsBQU_PzWOLsyR81v5wDu73UFIYgbuAjPg7cJASFM20A1BTUYlG6tCD69XKPqWy5BKg';
  const pubJwk = <String, dynamic>{
    'kty': 'EC',
    'crv': 'P-256',
    'x': 'oFrx9ggKTvHpQtGxln2sDpVy6cNLJ645cGQRoamOS9c',
    'y': 'HPeoeIf8rYyXnZ1sTgmzuwONgpVwoq_fk5MHSDJDAUE',
  };
  const otherJwk = <String, dynamic>{
    'kty': 'EC',
    'crv': 'P-256',
    'x': 'e-9ddavk6L3TdxcUPJd76WavfvXWeHrRjelTR4185Qg',
    'y': 'O5vtpXxKYWKIdiJOh-1qHgW4Co8EYvmasK2NZLsP02Q',
  };

  CardQrPayload payload({Object cardIndex = 5, String? serial = '0123/5000', String s = sig}) =>
      CardQrPayload(
        v: 1,
        id: 'idb-abc123',
        albumId: 'alb-1',
        cardIndex: cardIndex,
        serial: serial,
        sig: s,
      );

  group('base64url', () {
    test('ida y vuelta + null en basura', () {
      final bytes = [0, 1, 2, 250, 255, 62, 63];
      expect(b64urlToBytes(bytesToB64url(bytes)), bytes);
      expect(b64urlToBytes('!!not-base64!!'), isNull);
    });
  });

  group('signing input (anclaje cross-platform)', () {
    test('orden fijo + serial ausente → cadena vacía al final', () {
      expect(cardQrSigningInput(payload()), '1\ncard-identity\nidb-abc123\nalb-1\n5\n0123/5000');
      expect(cardQrSigningInput(payload(serial: null)), '1\ncard-identity\nidb-abc123\nalb-1\n5\n');
    });
  });

  group('serialize ↔ parse', () {
    test('conserva el payload', () {
      final p = payload();
      final round = parseCardQrPayload(serializeCardQrPayload(p));
      expect(round, isNotNull);
      expect(round!.v, p.v);
      expect(round.kind, p.kind);
      expect(round.id, p.id);
      expect(round.albumId, p.albumId);
      expect(round.cardIndex, p.cardIndex);
      expect(round.serial, p.serial);
      expect(round.sig, p.sig);
    });
    test('rechaza basura y payloads inválidos', () {
      expect(parseCardQrPayload('no-json'), isNull);
      expect(parseCardQrPayload('{"kind":"otro"}'), isNull);
    });
  });

  group('validateCardQrPayload', () {
    test('caza los huecos', () {
      expect(validateCardQrPayload(payload()), isNull);
      expect(validateCardQrPayload(CardQrPayload(v: 1, kind: 'x', id: 'a', albumId: 'b', cardIndex: 1, sig: sig)),
          matches(RegExp('kind')));
      expect(validateCardQrPayload(payload().copyWithAlbum('')), matches(RegExp('albumId')));
      expect(validateCardQrPayload(payload(s: 'no válido!')), matches(RegExp('firma')));
    });
  });

  group('verifyCardQrSignature (ECDSA P-256, vector WebCrypto)', () {
    test('true con la clave correcta', () async {
      expect(await verifyCardQrSignature(payload(), pubJwk), isTrue);
    });
    test('false con OTRA clave (no genuina)', () async {
      expect(await verifyCardQrSignature(payload(), otherJwk), isFalse);
    });
    test('false con payload manipulado (cardIndex cambiado tras firmar)', () async {
      expect(await verifyCardQrSignature(payload(cardIndex: 999), pubJwk), isFalse);
    });
    test('false con firma corrupta', () async {
      expect(await verifyCardQrSignature(payload(s: 'AAAA'), pubJwk), isFalse);
    });
  });
}

extension on CardQrPayload {
  CardQrPayload copyWithAlbum(String a) =>
      CardQrPayload(v: v, kind: kind, id: id, albumId: a, cardIndex: cardIndex, serial: serial, sig: sig);
}
