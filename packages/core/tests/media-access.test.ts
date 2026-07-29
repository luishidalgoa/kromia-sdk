/**
 * KRO-101 — spec de la autoridad PURA de acceso a medios (`mediaCapability`).
 *
 * Ground truth cross-language: Studio (`/api/minio/*`, `/api/images`) y el backend
 * (`/api/images`, ciclo de vida) deben derivar EXACTAMENTE estas decisiones para
 * los mismos hechos. Si cambias la lógica, este fichero es la spec a actualizar.
 */
import { describe, it, expect } from 'vitest';
import {
  mediaCapability,
  isPrivatePath,
  avatarObjectPath,
  PRIVATE_PREFIX,
  AVATAR_PREFIX,
  type MediaContext,
  type MediaGrant,
} from '../src/media-access';

const ctx = (over: Partial<MediaContext> = {}): MediaContext => ({
  username: 'ana',
  roles: [],
  grants: [],
  ...over,
});

const grant = (over: Partial<MediaGrant> = {}): MediaGrant => ({
  publisherSlug: 'kromia',
  scope: 'publisher',
  permissions: ['album:write'],
  ...over,
});

describe('zona privada (avatares) — antes que admin', () => {
  it('list NUNCA, ni para el dueño ni para admin', () => {
    expect(mediaCapability(ctx(), `${AVATAR_PREFIX}ana.webp`, 'list')).toBe(false);
    expect(mediaCapability(ctx({ roles: ['admin'] }), PRIVATE_PREFIX, 'list')).toBe(false);
    expect(mediaCapability(ctx({ roles: ['admin'] }), `${AVATAR_PREFIX}otro.webp`, 'list')).toBe(false);
  });

  it('el dueño lee/escribe/borra SU propio avatar', () => {
    const u = ctx({ username: 'ana' });
    expect(mediaCapability(u, `${AVATAR_PREFIX}ana.webp`, 'read')).toBe(true);
    expect(mediaCapability(u, `${AVATAR_PREFIX}ana.webp`, 'write')).toBe(true);
    expect(mediaCapability(u, `${AVATAR_PREFIX}ana.webp`, 'delete')).toBe(true);
  });

  it('LEER el avatar de otro SÍ se puede: es lo más público que tiene (KRO-288)', () => {
    // La regla vieja lo negaba, y con ella cada usuario veía su propia cara y la
    // de nadie más: el avatar sale junto al nombre en el ranking, en los
    // asistentes de una quedada y en el autor de cada publicación, así que todo
    // eso caía a iniciales por un 403.
    expect(mediaCapability(ctx({ username: 'ana' }), `${AVATAR_PREFIX}bob.webp`, 'read')).toBe(true);
    expect(mediaCapability(ctx({ roles: ['admin'] }), `${AVATAR_PREFIX}bob.webp`, 'read')).toBe(true);
  });

  it('pero ESCRIBIR o BORRAR el de otro no, ni siendo admin', () => {
    // Que tu cara la vea cualquiera no significa que cualquiera pueda cambiarla.
    expect(mediaCapability(ctx({ username: 'ana' }), `${AVATAR_PREFIX}bob.webp`, 'write')).toBe(false);
    expect(mediaCapability(ctx({ username: 'ana' }), `${AVATAR_PREFIX}bob.webp`, 'delete')).toBe(false);
    expect(mediaCapability(ctx({ roles: ['admin'] }), `${AVATAR_PREFIX}bob.webp`, 'delete')).toBe(false);
  });

  it('un ANÓNIMO no lee ningún avatar', () => {
    // Leer exige estar identificado: si no, la carpeta sería un directorio
    // abierto de caras para quien probase nombres.
    expect(mediaCapability(ctx({ username: '' }), `${AVATAR_PREFIX}bob.webp`, 'read')).toBe(false);
  });

  it('la carpeta sigue sin poder LISTARSE, y eso es lo que la hace privada', () => {
    expect(mediaCapability(ctx({ username: 'ana' }), AVATAR_PREFIX, 'list')).toBe(false);
    expect(mediaCapability(ctx({ roles: ['admin'] }), AVATAR_PREFIX, 'list')).toBe(false);
  });
});

describe('admin — override fuera de la zona privada', () => {
  it('puede todo en cualquier namespace', () => {
    const a = ctx({ username: 'admina', roles: ['admin'] });
    for (const action of ['read', 'write', 'list', 'delete'] as const) {
      expect(mediaCapability(a, 'kromia/liga/2025/foo.webp', action)).toBe(true);
      expect(mediaCapability(a, 'otrousuario/album/x.webp', action)).toBe(true);
    }
  });
});

describe('namespace propio del usuario', () => {
  it('control total del dueño sobre {username}/…', () => {
    const u = ctx({ username: 'ana' });
    for (const action of ['read', 'write', 'list', 'delete'] as const) {
      expect(mediaCapability(u, 'ana/bestiario/2025/x.webp', action)).toBe(true);
      expect(mediaCapability(u, 'ana/', action)).toBe(true);
    }
  });

  it('NO accede (write/list/delete) al namespace de otro usuario sin grant', () => {
    const u = ctx({ username: 'ana' });
    expect(mediaCapability(u, 'bob/album/x.webp', 'write')).toBe(false);
    expect(mediaCapability(u, 'bob/album/x.webp', 'list')).toBe(false);
    expect(mediaCapability(u, 'bob/album/x.webp', 'delete')).toBe(false);
  });

  it('un prefijo que solo EMPIEZA igual no cuenta como namespace propio', () => {
    // "anabel" no es "ana": namespaceOf corta en la primera "/".
    const u = ctx({ username: 'ana' });
    expect(mediaCapability(u, 'anabel/album/x.webp', 'write')).toBe(false);
  });
});

describe('namespace de publisher por grant', () => {
  it('grant publisher-wide con album:write → write/list/delete/read en {orgSlug}/', () => {
    const editor = ctx({ username: 'bob', grants: [grant({ publisherSlug: 'kromia', permissions: ['album:write'] })] });
    for (const action of ['read', 'write', 'list', 'delete'] as const) {
      expect(mediaCapability(editor, 'kromia/liga/2025/x.webp', action)).toBe(true);
    }
  });

  it('grant solo de lectura (album:read) → read/list pero NO write/delete', () => {
    const reader = ctx({ username: 'bob', grants: [grant({ permissions: ['album:read'] })] });
    expect(mediaCapability(reader, 'kromia/liga/x.webp', 'read')).toBe(true);
    expect(mediaCapability(reader, 'kromia/liga/x.webp', 'list')).toBe(true);
    expect(mediaCapability(reader, 'kromia/liga/x.webp', 'write')).toBe(false);
    expect(mediaCapability(reader, 'kromia/liga/x.webp', 'delete')).toBe(false);
  });

  it('grant sobre OTRA org no abre esta (list/write denegados)', () => {
    const editor = ctx({ username: 'bob', grants: [grant({ publisherSlug: 'otraorg' })] });
    expect(mediaCapability(editor, 'kromia/liga/x.webp', 'write')).toBe(false);
    expect(mediaCapability(editor, 'kromia/liga/x.webp', 'list')).toBe(false);
  });

  it('grant de scope álbum limita a {orgSlug}/{albumSlug}/', () => {
    const editor = ctx({
      username: 'bob',
      grants: [grant({ scope: 'album', albumSlug: 'liga', permissions: ['album:write'] })],
    });
    expect(mediaCapability(editor, 'kromia/liga/2025/x.webp', 'write')).toBe(true);
    expect(mediaCapability(editor, 'kromia/liga', 'list')).toBe(true);
    // Otro álbum de la misma org → denegado.
    expect(mediaCapability(editor, 'kromia/copa/x.webp', 'write')).toBe(false);
    expect(mediaCapability(editor, 'kromia/copa/x.webp', 'list')).toBe(false);
  });
});

describe('lectura pública (KRO-140 forward-compatible)', () => {
  it('sin visibilidad informada → read abierto para cualquiera (comportamiento actual)', () => {
    const stranger = ctx({ username: 'nadie' });
    expect(mediaCapability(stranger, 'kromia/liga/x.webp', 'read')).toBe(true);
  });

  it('álbum público → read abierto; pero list/write siguen cerrados sin grant', () => {
    const stranger = ctx({ username: 'nadie' });
    expect(mediaCapability(stranger, 'kromia/liga/x.webp', 'read', { albumVisibility: 'public' })).toBe(true);
    expect(mediaCapability(stranger, 'kromia/liga/x.webp', 'list', { albumVisibility: 'public' })).toBe(false);
    expect(mediaCapability(stranger, 'kromia/liga/x.webp', 'write', { albumVisibility: 'public' })).toBe(false);
  });

  it('álbum privado → un extraño NO puede leer', () => {
    const stranger = ctx({ username: 'nadie' });
    expect(mediaCapability(stranger, 'kromia/liga/x.webp', 'read', { albumVisibility: 'private' })).toBe(false);
  });

  it('álbum privado → el dueño y el miembro con grant SÍ leen; admin también', () => {
    const owner = ctx({ username: 'kromia' }); // namespace propio coincide
    expect(mediaCapability(owner, 'kromia/liga/x.webp', 'read', { albumVisibility: 'private' })).toBe(true);
    const member = ctx({ username: 'bob', grants: [grant({ permissions: ['album:read'] })] });
    expect(mediaCapability(member, 'kromia/liga/x.webp', 'read', { albumVisibility: 'private' })).toBe(true);
    const admin = ctx({ username: 'a', roles: ['admin'] });
    expect(mediaCapability(admin, 'kromia/liga/x.webp', 'read', { albumVisibility: 'private' })).toBe(true);
  });
});

describe('normalización de path', () => {
  it('barras iniciales no cambian la decisión', () => {
    const u = ctx({ username: 'ana' });
    expect(mediaCapability(u, '/ana/album/x.webp', 'write')).toBe(true);
    expect(mediaCapability(u, '///__private/avatars/ana.webp', 'list')).toBe(false);
  });
});

describe('helpers de zona privada', () => {
  it('isPrivatePath', () => {
    expect(isPrivatePath('__private/avatars/ana.webp')).toBe(true);
    expect(isPrivatePath('/__private/x')).toBe(true);
    expect(isPrivatePath('ana/album/x.webp')).toBe(false);
  });

  it('avatarObjectPath sanea la extensión', () => {
    expect(avatarObjectPath('ana', 'webp')).toBe('__private/avatars/ana.webp');
    expect(avatarObjectPath('ana', 'JPG')).toBe('__private/avatars/ana.jpg');
    expect(avatarObjectPath('ana', '../evil')).toBe('__private/avatars/ana.evil');
    expect(avatarObjectPath('ana', '')).toBe('__private/avatars/ana.jpg');
  });
});
