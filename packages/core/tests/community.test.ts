import { describe, it, expect } from 'vitest';
import {
  POST_REACTION_EMOJIS,
  CHANNEL_KINDS,
  CHANNEL_VISIBILITIES,
  COMMUNITY_LIMITS,
  isValidReactionEmoji,
  reactionCount,
  hasReacted,
  channelSlugify,
  isDeleted,
  isEdited,
  reactionsAllowed,
  notifiesFollowers,
  canPinAnother,
  validateChannel,
  validatePost,
  linkDomain,
  isKnownAttachment,
  knownAttachments,
  hasUnknownAttachments,
} from '../src/community';
import type { Channel, Post } from '../src/community';

const baseChannel: Channel = {
  id: 'c1', publisherId: 'p1', name: 'Anuncios', slug: 'anuncios',
  kind: 'announcements', visibility: 'followers', createdAt: '2026-07-24T00:00:00Z',
};
const basePost: Post = {
  id: 'x1', channelId: 'c1', publisherId: 'p1', authorId: 'u1',
  body: 'Hola comunidad', createdAt: '2026-07-24T00:00:00Z',
};

describe('KRO-265 — helpers de reacción', () => {
  it('isValidReactionEmoji acepta el set y rechaza el resto', () => {
    for (const e of POST_REACTION_EMOJIS) expect(isValidReactionEmoji(e)).toBe(true);
    expect(isValidReactionEmoji('💩')).toBe(false);
    expect(isValidReactionEmoji('')).toBe(false);
  });
  it('reactionCount y hasReacted leen las reacciones', () => {
    const post: Post = { ...basePost, reactions: [{ emoji: '🔥', userIds: ['a', 'b'] }] };
    expect(reactionCount(post, '🔥')).toBe(2);
    expect(reactionCount(post, '👍')).toBe(0);
    expect(hasReacted(post, '🔥', 'a')).toBe(true);
    expect(hasReacted(post, '🔥', 'z')).toBe(false);
    expect(hasReacted(basePost, '🔥', 'a')).toBe(false); // sin reactions
  });
});

describe('KRO-265 — channelSlugify', () => {
  it('normaliza acentos, mayúsculas y separadores', () => {
    expect(channelSlugify('Novedades')).toBe('novedades');
    expect(channelSlugify('Anuncios 2024! (Ñoño)')).toBe('anuncios-2024-nono');
    expect(channelSlugify('  ---Hola---  ')).toBe('hola');
  });
});

describe('KRO-265 — isDeleted / isEdited', () => {
  it('detecta soft-delete en post y canal', () => {
    expect(isDeleted(basePost)).toBe(false);
    expect(isDeleted({ ...basePost, deletedAt: '2026-07-24T01:00:00Z' })).toBe(true);
    expect(isDeleted({ ...baseChannel, deletedAt: '2026-07-24T01:00:00Z' })).toBe(true);
  });
  it('detecta edición', () => {
    expect(isEdited(basePost)).toBe(false);
    expect(isEdited({ ...basePost, editedAt: '2026-07-24T02:00:00Z' })).toBe(true);
  });
});

describe('KRO-265 — interruptores del canal (reacciones / aviso)', () => {
  it('ausente = permitido (retro-compat de los canales ya creados)', () => {
    expect(reactionsAllowed(baseChannel)).toBe(true);
    expect(notifiesFollowers(baseChannel)).toBe(true);
    expect(reactionsAllowed(null)).toBe(true);
    expect(notifiesFollowers(undefined)).toBe(true);
  });
  it('solo `false` explícito lo apaga', () => {
    expect(reactionsAllowed({ ...baseChannel, reactionsEnabled: false })).toBe(false);
    expect(reactionsAllowed({ ...baseChannel, reactionsEnabled: true })).toBe(true);
    expect(notifiesFollowers({ ...baseChannel, notifyFollowers: false })).toBe(false);
  });
});

describe('KRO-265 — validateChannel', () => {
  it('acepta un canal bien formado', () => {
    expect(validateChannel(baseChannel).valid).toBe(true);
  });
  it('exige publisher, nombre en rango y slug bien formado', () => {
    const r = validateChannel({ name: '', slug: 'MAL_SLUG' });
    expect(r.valid).toBe(false);
    const fields = r.issues.map(i => i.field);
    expect(fields).toContain('publisherId');
    expect(fields).toContain('name');
    expect(fields).toContain('slug');
  });
  it('rechaza kind/visibility fuera del catálogo', () => {
    const r = validateChannel({ ...baseChannel, kind: 'foro' as any, visibility: 'secreto' as any });
    expect(r.valid).toBe(false);
    expect(r.issues.map(i => i.field)).toEqual(expect.arrayContaining(['kind', 'visibility']));
  });
  it('acota la descripción', () => {
    const r = validateChannel({ ...baseChannel, description: 'x'.repeat(COMMUNITY_LIMITS.channelDescription.max + 1) });
    expect(r.valid).toBe(false);
    expect(r.issues[0].field).toBe('description');
  });
  it('los kinds y visibilities del catálogo son válidos', () => {
    for (const kind of CHANNEL_KINDS)
      for (const visibility of CHANNEL_VISIBILITIES)
        expect(validateChannel({ ...baseChannel, kind, visibility }).valid).toBe(true);
  });
});

describe('KRO-265 — validatePost', () => {
  it('acepta un post con cuerpo', () => {
    expect(validatePost(basePost).valid).toBe(true);
  });
  it('acepta un post SOLO con imagen (sin cuerpo)', () => {
    const r = validatePost({ ...basePost, body: '', attachments: [{ key: 'p1/img.png', kind: 'image' }] });
    expect(r.valid).toBe(true);
  });
  it('rechaza un post vacío (sin cuerpo ni adjuntos)', () => {
    const r = validatePost({ ...basePost, body: '   ' });
    expect(r.valid).toBe(false);
    expect(r.issues.map(i => i.field)).toContain('body');
  });
  it('exige canal y autor', () => {
    const r = validatePost({ body: 'hola' });
    expect(r.issues.map(i => i.field)).toEqual(expect.arrayContaining(['channelId', 'authorId']));
  });
  it('acota longitud del cuerpo y nº de adjuntos', () => {
    const many = Array.from({ length: COMMUNITY_LIMITS.postAttachments.max + 1 }, (_, i) => ({ key: `k${i}`, kind: 'image' as const }));
    const r = validatePost({ ...basePost, body: 'x'.repeat(COMMUNITY_LIMITS.postBody.max + 1), attachments: many });
    expect(r.valid).toBe(false);
    const fields = r.issues.map(i => i.field);
    expect(fields).toContain('body');
    expect(fields).toContain('attachments');
  });
  it('valida la key de una imagen', () => {
    const r = validatePost({ ...basePost, attachments: [{ kind: 'image', key: '' }] });
    expect(r.valid).toBe(false);
    expect(r.issues.map(i => i.field)).toContain('attachments[0].key');
  });
  it('rechaza emojis de reacción no permitidos y duplicados', () => {
    const bad = validatePost({ ...basePost, reactions: [{ emoji: '💩', userIds: ['a'] }] });
    expect(bad.valid).toBe(false);
    const dup = validatePost({ ...basePost, reactions: [{ emoji: '🔥', userIds: ['a'] }, { emoji: '🔥', userIds: ['b'] }] });
    expect(dup.valid).toBe(false);
    expect(dup.issues.some(i => /duplicada/i.test(i.message))).toBe(true);
  });
});

describe('canPinAnother (tope de fijadas · KRO-265)', () => {
  const max = COMMUNITY_LIMITS.pinnedPerChannel.max;

  it('deja fijar mientras se esté por debajo del tope', () => {
    for (let n = 0; n < max; n++) expect(canPinAnother(n)).toBe(true);
  });

  it('bloquea justo AL llegar al tope, no después', () => {
    expect(canPinAnother(max)).toBe(false);
    expect(canPinAnother(max + 5)).toBe(false);
  });

  // Ante un contador corrupto preferimos dejar fijar: el coste de un cuarto post
  // fijado es cosmético; el de bloquear al publisher sin explicación, no.
  it('ante un contador roto deja pasar en vez de bloquear al usuario', () => {
    expect(canPinAnother(NaN)).toBe(true);
    expect(canPinAnother(Infinity)).toBe(true);
    expect(canPinAnother(-3)).toBe(true);
    expect(canPinAnother(2.7)).toBe(true); // trunca a 2, por debajo del tope
  });
});

describe('KRO-272 — adjuntos: unión discriminada', () => {
  const MB = 1024 * 1024;

  it('acepta las cuatro variantes bien formadas', () => {
    const r = validatePost({
      ...basePost,
      attachments: [
        { kind: 'image', key: 'p1/foto.png' },
        { kind: 'file', key: 'p1/dossier.pdf', mime: 'application/pdf', size: 5 * MB },
        { kind: 'album-ref', albumId: 'a1' },
        { kind: 'link', url: 'https://ejemplo.com/noticia' },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('un post SOLO con una referencia a álbum es válido (no necesita texto)', () => {
    const r = validatePost({ ...basePost, body: '', attachments: [{ kind: 'album-ref', albumId: 'a1' }] });
    expect(r.valid).toBe(true);
  });

  it('cada variante exige SUS campos, no los de otra', () => {
    // Un album-ref sin albumId falla; que no tenga `key` no es un problema.
    const r = validatePost({ ...basePost, attachments: [{ kind: 'album-ref', albumId: '' } as any] });
    expect(r.valid).toBe(false);
    const fields = r.issues.map(i => i.field);
    expect(fields).toContain('attachments[0].albumId');
    expect(fields).not.toContain('attachments[0].key');
  });

  describe('ficheros: whitelist y tope', () => {
    it('rechaza un mime fuera de la whitelist', () => {
      const r = validatePost({ ...basePost, attachments: [{ kind: 'file', key: 'k', mime: 'application/zip', size: 10 } as any] });
      expect(r.issues.map(i => i.field)).toContain('attachments[0].mime');
    });

    it('acepta justo en el tope y rechaza un byte por encima', () => {
      const max = COMMUNITY_LIMITS.file.maxBytes;
      const enElTope = validatePost({ ...basePost, attachments: [{ kind: 'file', key: 'k', mime: 'application/pdf', size: max }] });
      expect(enElTope.valid).toBe(true);

      const pasado = validatePost({ ...basePost, attachments: [{ kind: 'file', key: 'k', mime: 'application/pdf', size: max + 1 }] });
      expect(pasado.valid).toBe(false);
      expect(pasado.issues.some(i => /60 MB/.test(i.message))).toBe(true);
    });

    it('exige tamaño: sin él no se puede aplicar el tope', () => {
      const r = validatePost({ ...basePost, attachments: [{ kind: 'file', key: 'k', mime: 'application/pdf' } as any] });
      expect(r.issues.map(i => i.field)).toContain('attachments[0].size');
    });
  });

  describe('enlaces: solo http/https', () => {
    it('rechaza los esquemas que son XSS o lectura de disco', () => {
      for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'no-es-una-url']) {
        const r = validatePost({ ...basePost, attachments: [{ kind: 'link', url }] });
        expect(r.valid).toBe(false);
      }
    });

    it('linkDomain saca el dominio SIN visitar la URL', () => {
      expect(linkDomain('https://www.ejemplo.com/ruta?x=1')).toBe('ejemplo.com');
      expect(linkDomain('http://sub.dominio.org')).toBe('sub.dominio.org');
      expect(linkDomain('javascript:alert(1)')).toBeNull();
      expect(linkDomain('')).toBeNull();
      expect(linkDomain(null)).toBeNull();
    });
  });

  describe('tolerancia hacia adelante (que `card-ref` no rompa mañana)', () => {
    const futuro = { kind: 'card-ref', albumId: 'a1', cardIndex: 3 } as any;

    it('un kind desconocido NO invalida la publicación entera', () => {
      const r = validatePost({ ...basePost, attachments: [{ kind: 'image', key: 'k' }, futuro] });
      expect(r.valid).toBe(true);
    });

    it('…pero el host puede filtrarlo para no intentar pintarlo', () => {
      expect(isKnownAttachment(futuro)).toBe(false);
      expect(knownAttachments([{ kind: 'image', key: 'k' }, futuro])).toHaveLength(1);
    });

    it('…y la PUERTA DE ENTRADA puede rechazarlo (leer tolera, crear no)', () => {
      expect(hasUnknownAttachments([futuro])).toBe(true);
      expect(hasUnknownAttachments([{ kind: 'image', key: 'k' }])).toBe(false);
    });

    it('un adjunto sin kind sí es inválido (eso es dato corrupto, no futuro)', () => {
      const r = validatePost({ ...basePost, attachments: [{ key: 'k' } as any] });
      expect(r.valid).toBe(false);
    });
  });
});
