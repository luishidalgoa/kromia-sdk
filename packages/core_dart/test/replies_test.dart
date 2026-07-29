import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-282 — hilos. Espejo Dart de las reglas del contrato.
///
/// Se prueban las que, si se espejan mal, abren escritura donde no debía
/// haberla — que es lo grave aquí: es la primera superficie donde escribe
/// alguien que no es el publisher.
void main() {
  Channel canal({bool? repliesEnabled, bool archived = false}) => Channel(
        id: 'c1',
        publisherId: 'p1',
        name: 'Anuncios',
        slug: 'anuncios',
        repliesEnabled: repliesEnabled,
        archived: archived,
      );

  Post post({
    String id = 'p1',
    String? parentId,
    bool? repliesClosed,
    String? deletedAt,
  }) =>
      Post(
        id: id,
        channelId: 'c1',
        publisherId: 'p1',
        authorId: 'a1',
        body: 'Hola',
        parentId: parentId,
        repliesClosed: repliesClosed,
        deletedAt: deletedAt,
        createdAt: '2026-02-01T10:00:00.000Z',
      );

  group('¿es una respuesta?', () {
    test('lo es cuando tiene padre', () {
      expect(isReply(post(parentId: 'p0')), isTrue);
      expect(isReply(post()), isFalse);
      expect(isReply(null), isFalse);
    });

    test('un padre en blanco NO cuenta como padre', () {
      // Si contara, un dato mal formado convertiría un post normal en respuesta
      // y se podría responder a él anidando.
      expect(isReply(post(parentId: '   ')), isFalse);
    });
  });

  group('cuándo NO se puede responder', () {
    test('AUSENTE significa NO — al revés que los otros interruptores', () {
      // La trampa del contrato: `reactionsAllowed` y `notifiesFollowers` tratan
      // el ausente como SÍ (retro-compatibilidad). Responder es capacidad nueva:
      // encenderla por omisión abriría a escritura todos los muros que ya
      // existen, sin que su dueño lo haya decidido.
      expect(replyBlock(canal(), post()), ReplyBlock.channelOff);
      expect(replyBlock(canal(repliesEnabled: false), post()),
          ReplyBlock.channelOff);
      expect(replyBlock(canal(repliesEnabled: true), post()), isNull);
    });

    test('un canal archivado no admite escritura de ningún tipo', () {
      expect(
        replyBlock(canal(repliesEnabled: true, archived: true), post()),
        ReplyBlock.channelOff,
      );
    });

    test('no se responde a una respuesta: solo hay UN nivel', () {
      expect(
        replyBlock(canal(repliesEnabled: true), post(parentId: 'p0')),
        ReplyBlock.nested,
      );
    });

    test('hilo cerrado y publicación borrada tienen motivo propio', () {
      expect(
        replyBlock(canal(repliesEnabled: true), post(repliesClosed: true)),
        ReplyBlock.threadClosed,
      );
      expect(
        replyBlock(canal(repliesEnabled: true),
            post(deletedAt: '2026-02-02T00:00:00.000Z')),
        ReplyBlock.parentDeleted,
      );
      expect(replyBlock(canal(repliesEnabled: true), null),
          ReplyBlock.parentDeleted);
    });

    test('el orden de los motivos: primero el canal, luego el post', () {
      // Con el canal apagado da igual el estado del hilo — y decir «hilo
      // cerrado» cuando lo que pasa es que el canal no admite respuestas
      // mandaría a mirar donde no es.
      expect(
        replyBlock(canal(), post(repliesClosed: true, parentId: 'p0')),
        ReplyBlock.channelOff,
      );
    });
  });

  group('validar una respuesta', () {
    test('la válida pasa', () {
      final r = validateReply(
        channelId: 'c1',
        authorId: 'a1',
        parentId: 'p1',
        body: 'Cuenta conmigo',
      );
      expect(r.valid, isTrue);
    });

    test('sin cuerpo no vale: no existe la respuesta solo-adjunto', () {
      expect(
        validateReply(channelId: 'c1', authorId: 'a1', parentId: 'p1', body: '  ')
            .valid,
        isFalse,
      );
    });

    test('exige saber a QUÉ responde', () {
      final r = validateReply(channelId: 'c1', authorId: 'a1', body: 'Hola');
      expect(r.valid, isFalse);
      expect(r.issues.any((i) => i.field == 'parentId'), isTrue);
    });

    test('tope propio, más corto que el de una publicación', () {
      expect(communityLimits.replyBody.max, 1000);
      expect(
        validateReply(
                channelId: 'c1',
                authorId: 'a1',
                parentId: 'p1',
                body: 'x' * communityLimits.replyBody.max)
            .valid,
        isTrue,
      );
      expect(
        validateReply(
                channelId: 'c1',
                authorId: 'a1',
                parentId: 'p1',
                body: 'x' * (communityLimits.replyBody.max + 1))
            .valid,
        isFalse,
      );
    });

    test('SIN adjuntos, y es una decisión, no una limitación técnica', () {
      // Dejar subir imágenes a un muro ajeno es lo que obliga a moderar en
      // serio; se abrirá cuando haya con qué sostenerlo.
      final r = validateReply(
        channelId: 'c1',
        authorId: 'a1',
        parentId: 'p1',
        body: 'Mira esto',
        attachments: const [PostLinkAttachment(url: 'https://ejemplo.test')],
      );
      expect(r.valid, isFalse);
      expect(r.issues.any((i) => i.field == 'attachments'), isTrue);
    });
  });

  group('parseo', () {
    test('el canal trae su interruptor, y ausente NO se inventa', () {
      expect(
        Channel.fromJson(const {
          '_id': 'c1',
          'publisherId': 'p1',
          'name': 'X',
          'slug': 'x',
          'repliesEnabled': true,
        }).repliesEnabled,
        isTrue,
      );
      // Ausente = null, y `replyBlock` lo trata como NO.
      expect(
        Channel.fromJson(
            const {'_id': 'c1', 'publisherId': 'p1', 'name': 'X', 'slug': 'x'})
            .repliesEnabled,
        isNull,
      );
    });

    test('el nombre del autor viene ANIDADO bajo information', () {
      // Es como lo puebla el backend. Mirando solo `username` suelto, el nombre
      // salía nulo y la app pintaba un guion y un avatar «?».
      final p = Post.fromJson(const {
        '_id': 'r1',
        'channelId': 'c1',
        'publisherId': 'p1',
        'authorId': {
          '_id': 'u1',
          'information': {
            'username': 'luishidalgoa',
            'displayName': 'Luis',
            'avatarUrl': 'https://x/y.png',
          },
        },
        'body': 'Hola',
      });
      expect(p.authorId, 'u1');
      expect(p.authorName, 'Luis'); // el visible manda sobre el usuario
      expect(p.authorAvatarUrl, 'https://x/y.png');
    });

    test('sin displayName cae al username, y sin nada queda nulo', () {
      Post conAutor(Map<String, dynamic> info) => Post.fromJson({
            '_id': 'r1',
            'channelId': 'c1',
            'publisherId': 'p1',
            'authorId': {'_id': 'u1', 'information': info},
            'body': 'Hola',
          });
      expect(conAutor(const {'username': 'luis'}).authorName, 'luis');
      expect(conAutor(const {}).authorName, isNull);
      expect(conAutor(const {'username': '   '}).authorName, isNull);
    });

    test('la publicación trae su padre y si está cerrada', () {
      final p = Post.fromJson(const {
        '_id': 'r1',
        'channelId': 'c1',
        'publisherId': 'p1',
        'authorId': 'a1',
        'body': 'Respuesta',
        'parentId': 'p0',
        'repliesClosed': true,
      });
      expect(p.parentId, 'p0');
      expect(p.repliesClosed, isTrue);
      expect(isReply(p), isTrue);
    });
  });
}
