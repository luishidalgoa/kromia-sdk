/** KRO-16 — QR firmado de carta: contrato + firma↔verificación ECDSA P-256. */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  CARD_QR_KIND, cardQrSigningInput, serializeCardQrPayload, parseCardQrPayload,
  validateCardQrPayload, verifyCardQrSignature, bytesToB64url, b64urlToBytes,
  type CardQrSignable,
} from '../src/card-qr';
import type { CardQrPayload } from '../src/types';

const subtle = globalThis.crypto.subtle;

/** Firma en el test (imita al backend) con WebCrypto ECDSA P-256 → sig P1363 base64url. */
async function sign(core: CardQrSignable, privateKey: CryptoKey): Promise<CardQrPayload> {
  const data = new TextEncoder().encode(cardQrSigningInput(core));
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data));
  return { ...core, sig: bytesToB64url(sig) };
}

describe('card-qr (KRO-16)', () => {
  let priv: CryptoKey, pubJwk: JsonWebKey, otherPubJwk: JsonWebKey;

  beforeAll(async () => {
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    priv = kp.privateKey;
    pubJwk = await subtle.exportKey('jwk', kp.publicKey);
    const other = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    otherPubJwk = await subtle.exportKey('jwk', other.publicKey);
  });

  const core: CardQrSignable = { v: 1, kind: CARD_QR_KIND, id: 'idb-abc123', albumId: 'alb-1', cardIndex: 5, serial: '0123/5000' };

  it('base64url ida y vuelta', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 62, 63]);
    expect(b64urlToBytes(bytesToB64url(bytes))).toEqual(bytes);
    expect(b64urlToBytes('!!not-base64!!')).toBeNull();
  });

  it('signing input es determinista y cross-platform (orden fijo)', () => {
    expect(cardQrSigningInput(core)).toBe('1\ncard-identity\nidb-abc123\nalb-1\n5\n0123/5000');
    // serial ausente → cadena vacía al final.
    expect(cardQrSigningInput({ ...core, serial: undefined })).toBe('1\ncard-identity\nidb-abc123\nalb-1\n5\n');
  });

  it('serialize ↔ parse conserva el payload', async () => {
    const p = await sign(core, priv);
    const round = parseCardQrPayload(serializeCardQrPayload(p));
    expect(round).toEqual(p);
  });

  it('parse rechaza basura y payloads inválidos', () => {
    expect(parseCardQrPayload('no-json')).toBeNull();
    expect(parseCardQrPayload('{"kind":"otro"}')).toBeNull();
  });

  it('validateCardQrPayload caza los huecos', async () => {
    const p = await sign(core, priv);
    expect(validateCardQrPayload(p)).toBeNull();
    expect(validateCardQrPayload({ ...p, kind: 'x' })).toMatch(/kind/);
    expect(validateCardQrPayload({ ...p, albumId: '' })).toMatch(/albumId/);
    expect(validateCardQrPayload({ ...p, sig: 'no válido!' })).toMatch(/firma/);
  });

  it('verifyCardQrSignature: true con la clave correcta', async () => {
    const p = await sign(core, priv);
    expect(await verifyCardQrSignature(p, pubJwk)).toBe(true);
  });

  it('rechaza firma de OTRA clave (no genuina)', async () => {
    const p = await sign(core, priv);
    expect(await verifyCardQrSignature(p, otherPubJwk)).toBe(false);
  });

  it('rechaza payload manipulado (cambia cardIndex tras firmar)', async () => {
    const p = await sign(core, priv);
    expect(await verifyCardQrSignature({ ...p, cardIndex: 999 }, pubJwk)).toBe(false);
  });

  it('rechaza firma corrupta', async () => {
    const p = await sign(core, priv);
    expect(await verifyCardQrSignature({ ...p, sig: 'AAAA' }, pubJwk)).toBe(false);
  });
});
