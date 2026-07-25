import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-265 / KRO-272 — espejo del contrato de COMUNIDAD (lado lector).
void main() {
  group('adjuntos (unión discriminada)', () {
    test('parsea los 4 kinds conocidos', () {
      expect(
        PostAttachment.fromJson({'kind': 'image', 'key': 'k1', 'alt': 'foto'}),
        isA<PostImageAttachment>(),
      );
      final f = PostAttachment.fromJson(
          {'kind': 'file', 'key': 'k2', 'mime': 'application/pdf', 'size': 1234});
      expect(f, isA<PostFileAttachment>());
      expect((f! as PostFileAttachment).size, 1234);
      expect(
        PostAttachment.fromJson({'kind': 'album-ref', 'albumId': 'a1'}),
        isA<PostAlbumRefAttachment>(),
      );
      expect(PostAttachment.fromJson({'kind': 'link', 'url': 'https://panini.es/x'}),
          isA<PostLinkAttachment>());
    });

    test('kind DESCONOCIDO se ignora (leer tolera; no rompe el muro)', () {
      expect(PostAttachment.fromJson({'kind': 'video', 'key': 'k'}), isNull);
    });

    test('el enlace expone solo el DOMINIO (sin www)', () {
      const l = PostLinkAttachment(url: 'https://www.panini.es/promo?x=1');
      expect(l.domain, 'panini.es');
      expect(const PostLinkAttachment(url: 'no-es-url').domain, isEmpty);
    });

    test('un post con un adjunto desconocido conserva los conocidos', () {
      final p = Post.fromJson({
        '_id': 'p1',
        'attachments': [
          {'kind': 'video', 'key': 'x'},
          {'kind': 'link', 'url': 'https://panini.es'},
        ],
      });
      expect(p.attachments, hasLength(1));
      expect(p.attachments.single, isA<PostLinkAttachment>());
    });
  });

  group('reacciones', () {
    final post = Post.fromJson({
      '_id': 'p1',
      'reactions': [
        {'emoji': '👍', 'userIds': ['u1', 'u2']},
        {'emoji': '🔥', 'userIds': ['u3']},
      ],
    });

    test('el set es CERRADO (6 emojis)', () {
      expect(postReactionEmojis, hasLength(6));
      expect(isValidReactionEmoji('👍'), isTrue);
      expect(isValidReactionEmoji('🍕'), isFalse);
    });

    test('cuenta por emoji; los ausentes son 0', () {
      expect(reactionCount(post, '👍'), 2);
      expect(reactionCount(post, '🎉'), 0);
    });

    test('sabe si TÚ reaccionaste', () {
      expect(hasReacted(post, '👍', 'u1'), isTrue);
      expect(hasReacted(post, '👍', 'u9'), isFalse);
      expect(hasReacted(post, '🎉', 'u1'), isFalse);
    });
  });

  group('interruptores del canal (ausente = SÍ, retro-compat)', () {
    Channel ch({bool? reactions, bool? notify}) => Channel(
          id: 'c',
          publisherId: 'p',
          name: 'Anuncios',
          slug: 'anuncios',
          reactionsEnabled: reactions,
          notifyFollowers: notify,
        );

    test('reactionsAllowed', () {
      expect(reactionsAllowed(ch()), isTrue, reason: 'ausente = sí');
      expect(reactionsAllowed(ch(reactions: false)), isFalse);
      expect(reactionsAllowed(null), isTrue);
    });

    test('notifiesFollowers', () {
      expect(notifiesFollowers(ch()), isTrue);
      expect(notifiesFollowers(ch(notify: false)), isFalse);
    });
  });

  group('post', () {
    test('sello "editado" solo si se editó el cuerpo', () {
      expect(isEdited(Post.fromJson({'_id': 'p', 'editedAt': '2026-01-01'})), isTrue);
      expect(isEdited(Post.fromJson({'_id': 'p'})), isFalse);
    });

    test('autor poblado por el backend', () {
      final p = Post.fromJson({
        '_id': 'p',
        'authorId': {'_id': 'u1', 'username': 'panini'},
      });
      expect(p.authorId, 'u1');
      expect(p.authorName, 'panini');
    });

    test('límites del contrato', () {
      expect(communityLimits.postAttachments.max, 10);
      expect(communityLimits.file.mimes, ['application/pdf']);
      expect(communityLimits.file.maxBytes, 60 * 1024 * 1024);
      expect(communityLimits.pinnedPerChannel.max, 3);
    });
  });
}
