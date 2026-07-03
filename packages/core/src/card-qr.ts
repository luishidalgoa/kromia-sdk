/**
 * KRO-16 — QR firmado de identidad de carta física (contrato cross-platform).
 *
 * El QR de una carta física codifica un `CardQrPayload` FIRMADO
 * ASIMÉTRICAMENTE: el backend firma con la clave PRIVADA (solo servidor) y
 * cualquiera verifica con la PÚBLICA — autenticidad sin secreto compartido,
 * verificable **offline** (la app puede comprobar que el QR es genuino sin
 * llamar al server; el server además resuelve la propiedad actual).
 *
 * Distinto del QR de PREVIEW (KRO-66): ese es un JWT efímero por-álbum; este es
 * PERMANENTE, por-instancia y de verificación pública.
 *
 * Cripto: **ECDSA P-256 + SHA-256**, firma en formato IEEE P1363 (raw r‖s, 64
 * bytes) codificada en **base64url**. Elegido por portabilidad total: WebCrypto
 * (Node ≥16 + todos los navegadores) y Dart (`cryptography`/`pointycastle`) lo
 * soportan idéntico. La clave pública viaja como **JWK** (`{kty:'EC',crv:'P-256',x,y}`).
 *
 * `cardQrSigningInput` define los BYTES EXACTOS que se firman/verifican — es el
 * punto de anclaje cross-platform: backend (firma), SDK/Studio y Flutter
 * (verifican) deben producir la MISMA cadena. Espejo Dart = Drift Sync.
 */

import type { CardQrPayload } from './types';

export const CARD_QR_KIND = 'card-identity' as const;
export const CARD_QR_VERSION = 1;

// ── base64url ────────────────────────────────────────────────────────────

/** Bytes → base64url (sin `=`, `+/`→`-_`). Isomorfo Node/browser. */
export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === 'function'
    ? btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → bytes. Tolera padding ausente. Devuelve null si no es válido. */
export function b64urlToBytes(s: string): Uint8Array | null {
  if (typeof s !== 'string' || s.length % 4 === 1 || /[^A-Za-z0-9_-]/.test(s)) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  } catch {
    return null;
  }
}

// ── Payload ──────────────────────────────────────────────────────────────

/** Campos firmables del payload (todo menos la propia firma). */
export type CardQrSignable = Omit<CardQrPayload, 'sig'>;

/**
 * Los BYTES EXACTOS que se firman/verifican. Determinista y cross-platform:
 * unión por `\n` en un orden fijo. `cardIndex` se normaliza a String; `serial`
 * ausente = cadena vacía. NO cambiar el formato sin bumpear `v` (rompería las
 * firmas existentes).
 */
export function cardQrSigningInput(p: CardQrSignable): string {
  return [
    String(p.v),
    p.kind,
    p.id,
    p.albumId,
    String(p.cardIndex),
    p.serial ?? '',
  ].join('\n');
}

/** El CONTENIDO del QR = JSON compacto del payload completo (con firma). */
export function serializeCardQrPayload(p: CardQrPayload): string {
  return JSON.stringify({
    v: p.v, kind: p.kind, id: p.id, albumId: p.albumId,
    cardIndex: p.cardIndex, ...(p.serial ? { serial: p.serial } : {}), sig: p.sig,
  });
}

/** Parsea el contenido de un QR a `CardQrPayload`, o null si no es válido. */
export function parseCardQrPayload(raw: string): CardQrPayload | null {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const p = obj as Record<string, unknown>;
  const payload: CardQrPayload = {
    v: Number(p.v),
    kind: p.kind as 'card-identity',
    id: String(p.id ?? ''),
    albumId: String(p.albumId ?? ''),
    cardIndex: (typeof p.cardIndex === 'number' ? p.cardIndex : String(p.cardIndex ?? '')),
    ...(p.serial ? { serial: String(p.serial) } : {}),
    sig: String(p.sig ?? ''),
  };
  return validateCardQrPayload(payload) === null ? payload : null;
}

/** Validación ESTRUCTURAL (no cripto). Devuelve null si es válido, o el motivo. */
export function validateCardQrPayload(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'Payload ausente.';
  const q = p as Record<string, unknown>;
  if (q.kind !== CARD_QR_KIND) return `kind debe ser "${CARD_QR_KIND}".`;
  if (typeof q.v !== 'number' || q.v < 1) return 'v (versión) inválida.';
  if (!q.id || typeof q.id !== 'string') return 'id ausente.';
  if (!q.albumId || typeof q.albumId !== 'string') return 'albumId ausente.';
  if (q.cardIndex === undefined || q.cardIndex === null || q.cardIndex === '') return 'cardIndex ausente.';
  if (!q.sig || typeof q.sig !== 'string' || b64urlToBytes(q.sig) === null) return 'firma (sig) ausente o mal formada.';
  return null;
}

// ── Verificación asimétrica (pública, offline) ─────────────────────────────

/** ¿Hay WebCrypto disponible en este runtime? */
function subtle(): SubtleCrypto | null {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  return c && 'subtle' in c ? c.subtle : null;
}

/**
 * Verifica la firma ECDSA P-256 del payload contra `publicKeyJwk`.
 * PURA (no toca red). Devuelve `false` si la firma no valida, el payload es
 * estructuralmente inválido, o el runtime no tiene WebCrypto.
 *
 * La verificación de AUTENTICIDAD (firma) es solo la mitad: la PROPIEDAD actual
 * la resuelve el backend (`POST /cards/scan`). Esto confirma "es una carta
 * genuina de este publisher", no "es tuya".
 */
export async function verifyCardQrSignature(
  payload: CardQrPayload,
  publicKeyJwk: JsonWebKey,
): Promise<boolean> {
  if (validateCardQrPayload(payload) !== null) return false;
  const s = subtle();
  if (!s) return false;
  const sig = b64urlToBytes(payload.sig);
  if (!sig) return false;
  try {
    const key = await s.importKey('jwk', publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const data = new TextEncoder().encode(cardQrSigningInput(payload));
    return await s.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig as BufferSource, data);
  } catch {
    return false;
  }
}
