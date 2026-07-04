import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-129 — espejo Dart de `favorite.ts`: `favoriteKey` + Favorite/FavoriteCardRef.
void main() {
  group('favoriteKey', () {
    test('combina albumId + cardIndex de forma estable (num y string colisionan)', () {
      expect(favoriteKey('alb1', 3), 'alb1::3');
      expect(favoriteKey('alb1', '3'), 'alb1::3');
    });
    test('distingue álbumes distintos con el mismo índice', () {
      expect(favoriteKey('a', 1), isNot(favoriteKey('b', 1)));
    });
  });

  group('Favorite / FavoriteCardRef fromJson', () {
    test('Favorite.fromJson + toJson', () {
      final f = Favorite.fromJson(const {
        'id': 'f1', 'userId': 'u', 'albumId': 'a', 'cardIndex': 5,
        'order': 2, 'createdAt': '2026-01-01',
      });
      expect(f.id, 'f1');
      expect(f.cardIndex, 5);
      expect(f.order, 2);
      expect(favoriteKey(f.albumId, f.cardIndex), 'a::5');
      expect(f.toJson()['albumId'], 'a');
    });
    test('FavoriteCardRef.fromJson (cardIndex String)', () {
      final ref = FavoriteCardRef.fromJson(const {'albumId': 'b', 'cardIndex': '7'});
      expect(ref.albumId, 'b');
      expect(ref.cardIndex, '7');
    });
  });
}
