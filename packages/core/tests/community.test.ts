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
  validateChannel,
  validatePost,
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
  it('valida key y tipo de cada adjunto', () => {
    const r = validatePost({ ...basePost, attachments: [{ key: '', kind: 'video' as any }] });
    expect(r.valid).toBe(false);
    expect(r.issues.map(i => i.field)).toEqual(expect.arrayContaining(['attachments[0].key', 'attachments[0].kind']));
  });
  it('rechaza emojis de reacción no permitidos y duplicados', () => {
    const bad = validatePost({ ...basePost, reactions: [{ emoji: '💩', userIds: ['a'] }] });
    expect(bad.valid).toBe(false);
    const dup = validatePost({ ...basePost, reactions: [{ emoji: '🔥', userIds: ['a'] }, { emoji: '🔥', userIds: ['b'] }] });
    expect(dup.valid).toBe(false);
    expect(dup.issues.some(i => /duplicada/i.test(i.message))).toBe(true);
  });
});
