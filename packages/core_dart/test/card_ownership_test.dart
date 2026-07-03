import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-215 — espejo Dart de `card-ownership.ts` + tipos §KRO-215 de `types.ts`.
void main() {
  group('ownershipBadge / isVerifiedOwnership', () {
    CardOwnership o(String source, bool verified) => CardOwnership(
          userId: 'u', albumId: 'a', cardIndex: 1,
          source: source, verified: verified, quantity: 1, acquiredAt: '',
        );

    test("verified SOLO con source=='qr' && verified", () {
      expect(ownershipBadge(o('qr', true)), 'verified');
      expect(isVerifiedOwnership(o('qr', true)), isTrue);
    });
    test('qr sin verificar → declared', () {
      expect(ownershipBadge(o('qr', false)), 'declared');
    });
    test('manual/code/photo → declared aunque verified sea true (no auto-declarable)', () {
      expect(ownershipBadge(o('manual', true)), 'declared');
      expect(ownershipBadge(o('code', true)), 'declared');
      expect(ownershipBadge(o('photo', false)), 'declared');
      expect(isVerifiedOwnership(o('manual', true)), isFalse);
    });

    test('ownershipSources = las 4 fuentes', () {
      expect(ownershipSources, {'qr', 'manual', 'code', 'photo'});
    });
  });

  group('fromJson / defaults', () {
    test('CardOwnership.fromJson + defaults (source manual, verified false, qty 1)', () {
      final c = CardOwnership.fromJson(const {'userId': 'u', 'albumId': 'a', 'cardIndex': '7'});
      expect(c.source, 'manual');
      expect(c.verified, isFalse);
      expect(c.quantity, 1);
      expect(c.cardIndex, '7');
      final full = CardOwnership.fromJson(const {
        'userId': 'u', 'albumId': 'a', 'cardIndex': 3, 'source': 'qr',
        'verified': true, 'quantity': 1, 'identityId': 'id1', 'acquiredAt': '2026-01-01',
      });
      expect(ownershipBadge(full), 'verified');
      expect(full.identityId, 'id1');
    });

    test('fromLegacyOwnedCard → manual/unverified (sin migración)', () {
      final c = CardOwnership.fromLegacyOwnedCard(userId: 'u', albumId: 'a', cardIndex: 5, quantity: 3);
      expect(c.source, 'manual');
      expect(c.verified, isFalse);
      expect(c.quantity, 3);
      expect(ownershipBadge(c), 'declared');
    });

    test('CardIdentity / TransferToken fromJson', () {
      final id = CardIdentity.fromJson(const {
        'id': 'tok', 'albumId': 'a', 'cardIndex': 12, 'serial': '0123/5000', 'mintedAt': '2026-01-01'
      });
      expect(id.id, 'tok');
      expect(id.serial, '0123/5000');
      final t = TransferToken.fromJson(const {
        'id': 't1', 'identityId': 'tok', 'fromUserId': 'u', 'createdAt': 'x', 'expiresAt': 'y'
      });
      expect(t.identityId, 'tok');
    });

    test('CardQrPayload fromJson + toJson roundtrip', () {
      final p = CardQrPayload.fromJson(const {
        'v': 1, 'kind': 'card-identity', 'id': 'tok', 'albumId': 'a', 'cardIndex': 9, 'sig': 'BASE64'
      });
      expect(p.kind, 'card-identity');
      expect(p.sig, 'BASE64');
      final j = p.toJson();
      expect(j['id'], 'tok');
      expect(j.containsKey('serial'), isFalse, reason: 'serial ausente no se serializa');
      expect(CardQrPayload.fromJson(j).cardIndex, 9);
    });

    test('CardTransferBundle fromJson/toJson + kind por defecto (KRO-16)', () {
      const b = CardTransferBundle(qr: 'CARDQR', transferToken: 'TOK123');
      expect(b.kind, cardTransferKind);
      expect(b.toJson(), {'kind': 'card-transfer', 'qr': 'CARDQR', 'transferToken': 'TOK123'});
      final parsed = CardTransferBundle.fromJson(b.toJson());
      expect(parsed.qr, 'CARDQR');
      expect(parsed.transferToken, 'TOK123');
      expect(parsed.kind, 'card-transfer');
    });
  });
}
