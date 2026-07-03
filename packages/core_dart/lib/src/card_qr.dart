/// KRO-16 — QR firmado de identidad de carta física (contrato cross-platform).
/// Espejo de `card-qr.ts`. El backend firma con la clave PRIVADA (solo servidor)
/// y cualquiera verifica con la PÚBLICA → autenticidad sin secreto compartido,
/// verificable OFFLINE. Cripto **ECDSA P-256 + SHA-256**, firma IEEE P1363 (raw
/// r‖s, 64 bytes) en **base64url**; clave pública como **JWK** (`{x, y}`).
///
/// `cardQrSigningInput` define los BYTES EXACTOS firmados/verificados — el punto
/// de ANCLAJE cross-platform: backend (firma) y SDK/Studio/Flutter (verifican)
/// deben producir la MISMA cadena. NO cambiar el formato sin bumpear `v`.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

import 'card_ownership.dart';

const String cardQrKind = 'card-identity';
const int cardQrVersion = 1;

// ── base64url ─────────────────────────────────────────────────────────────

/// Bytes → base64url (sin padding, `+/`→`-_`).
String bytesToB64url(List<int> bytes) => base64Url.encode(bytes).replaceAll('=', '');

/// base64url → bytes. Tolera padding ausente; null si no es válido.
Uint8List? b64urlToBytes(String s) {
  if (s.length % 4 == 1 || RegExp(r'[^A-Za-z0-9_-]').hasMatch(s)) return null;
  final padded = s + '=' * ((4 - s.length % 4) % 4);
  try {
    return base64Url.decode(padded);
  } catch (_) {
    return null;
  }
}

// ── Payload ────────────────────────────────────────────────────────────────

/// Los BYTES EXACTOS que se firman/verifican: unión por `\n` en orden fijo
/// `v, kind, id, albumId, cardIndex, serial`. `cardIndex`→String; `serial`
/// ausente = cadena vacía. Espejo 1:1 de `cardQrSigningInput`.
String cardQrSigningInput(CardQrPayload p) => [
      '${p.v}',
      p.kind,
      p.id,
      p.albumId,
      '${p.cardIndex}',
      p.serial ?? '',
    ].join('\n');

/// CONTENIDO del QR = JSON compacto del payload completo (con firma).
String serializeCardQrPayload(CardQrPayload p) => jsonEncode({
      'v': p.v,
      'kind': p.kind,
      'id': p.id,
      'albumId': p.albumId,
      'cardIndex': p.cardIndex,
      if (p.serial != null && p.serial!.isNotEmpty) 'serial': p.serial,
      'sig': p.sig,
    });

/// Parsea el contenido de un QR a `CardQrPayload`, o null si no es válido.
CardQrPayload? parseCardQrPayload(String raw) {
  Object? obj;
  try {
    obj = jsonDecode(raw);
  } catch (_) {
    return null;
  }
  if (obj is! Map) return null;
  final p = CardQrPayload.fromJson(obj.cast<String, dynamic>());
  return validateCardQrPayload(p) == null ? p : null;
}

/// Validación ESTRUCTURAL (no cripto). null si es válido, o el motivo.
String? validateCardQrPayload(CardQrPayload p) {
  if (p.kind != cardQrKind) return 'kind debe ser "$cardQrKind".';
  if (p.v < 1) return 'v (versión) inválida.';
  if (p.id.isEmpty) return 'id ausente.';
  if (p.albumId.isEmpty) return 'albumId ausente.';
  if ('${p.cardIndex}'.isEmpty) return 'cardIndex ausente.';
  if (p.sig.isEmpty || b64urlToBytes(p.sig) == null) {
    return 'firma (sig) ausente o mal formada.';
  }
  return null;
}

// ── Verificación asimétrica (pública, offline) ─────────────────────────────

BigInt _bigIntFromBytes(List<int> bytes) {
  var r = BigInt.zero;
  for (final b in bytes) {
    r = (r << 8) | BigInt.from(b & 0xff);
  }
  return r;
}

/// Verifica la firma ECDSA P-256 del payload contra `publicKeyJwk` (`{x, y}` en
/// base64url). PURA (no toca red). `false` si la firma no valida, el payload es
/// estructuralmente inválido, o la clave/firma están mal formadas. Espejo de
/// `verifyCardQrSignature` (WebCrypto en TS ↔ pointycastle en Dart, mismo P1363).
///
/// AUTENTICIDAD (firma) ≠ PROPIEDAD: esto confirma "carta genuina de este
/// publisher", no "es tuya" (la propiedad la resuelve `POST /cards/scan`).
Future<bool> verifyCardQrSignature(
  CardQrPayload payload,
  Map<String, dynamic> publicKeyJwk,
) async {
  if (validateCardQrPayload(payload) != null) return false;
  final sig = b64urlToBytes(payload.sig);
  if (sig == null || sig.length != 64) return false;
  final xb = b64urlToBytes(publicKeyJwk['x']?.toString() ?? '');
  final yb = b64urlToBytes(publicKeyJwk['y']?.toString() ?? '');
  if (xb == null || yb == null) return false;
  try {
    final domain = ECCurve_secp256r1(); // P-256 == secp256r1 == prime256v1
    final pub = ECPublicKey(
      domain.curve.createPoint(_bigIntFromBytes(xb), _bigIntFromBytes(yb)),
      domain,
    );
    final r = _bigIntFromBytes(sig.sublist(0, 32));
    final s = _bigIntFromBytes(sig.sublist(32, 64));
    // pointycastle ECDSA opera sobre el HASH del mensaje (P1363: r‖s raw).
    final hash = SHA256Digest()
        .process(Uint8List.fromList(utf8.encode(cardQrSigningInput(payload))));
    final signer = ECDSASigner()
      ..init(false, PublicKeyParameter<ECPublicKey>(pub));
    return signer.verifySignature(hash, ECSignature(r, s));
  } catch (_) {
    return false;
  }
}
