/**
 * KRO-277 — quedadas. Lo que se fija aquí son las decisiones que costaron
 * discusión, no la sintaxis de los tipos.
 */
import { describe, it, expect } from 'vitest';
import {
  validateMeetup, meetupIsOpen, checkinWindow, checkinIsOpen,
  withinCheckinRadius, distanceMeters, spotsLeft, isFull,
  MEETUP_LIMITS, isValidRsvpStatus,
  type Meetup,
} from '../src/meetup';

/** Una quedada válida de base; cada test cambia solo lo suyo. */
function quedada(extra: Partial<Meetup> = {}): Meetup {
  return {
    id: 'm1', channelId: 'c1', publisherId: 'p1',
    title: 'Quedada en la Tienda Cinabrio',
    startsAt: '2026-08-01T18:00:00.000Z',
    endsAt:   '2026-08-01T21:00:00.000Z',
    place: { label: 'Tienda Cinabrio', lat: 37.8845, lng: -4.7796 },
    status: 'scheduled',
    createdAt: '2026-07-29T10:00:00.000Z',
    ...extra,
  };
}

describe('validar una quedada', () => {
  it('la válida pasa', () => {
    expect(validateMeetup(quedada()).valid).toBe(true);
  });

  it('SIN COORDENADAS no vale — es la diferencia con el adjunto de ubicación suelto', () => {
    // Un adjunto de ubicación admite solo el nombre. Una quedada no: sin
    // coordenadas no hay radio contra el que medir el fichaje ni punto en el
    // mapa, y eso no se puede arreglar luego sin volver a molestar a los
    // inscritos.
    const r = validateMeetup(quedada({ place: { label: 'Marismas de Vael' } as any }));
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.field === 'place')).toBe(true);
  });

  it('no puede terminar antes de empezar', () => {
    const r = validateMeetup(quedada({ startsAt: '2026-08-01T21:00:00.000Z', endsAt: '2026-08-01T18:00:00.000Z' }));
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.field === 'endsAt')).toBe(true);
  });

  it('el aforo es OPCIONAL, pero si está tiene que ser creíble', () => {
    expect(validateMeetup(quedada({ capacity: undefined })).valid).toBe(true);
    expect(validateMeetup(quedada({ capacity: 20 })).valid).toBe(true);
    expect(validateMeetup(quedada({ capacity: 0 })).valid).toBe(false);
    expect(validateMeetup(quedada({ capacity: 2.5 })).valid).toBe(false);
  });

  it('rechaza coordenadas fuera del planeta', () => {
    expect(validateMeetup(quedada({ place: { label: 'X', lat: 120, lng: 0 } })).valid).toBe(false);
    expect(validateMeetup(quedada({ place: { label: 'X', lat: 0, lng: 200 } })).valid).toBe(false);
  });

  it('exige título y respeta los topes de texto', () => {
    expect(validateMeetup(quedada({ title: '   ' })).valid).toBe(false);
    expect(validateMeetup(quedada({ title: 'x'.repeat(MEETUP_LIMITS.title.max + 1) })).valid).toBe(false);
  });
});

describe('cuándo se puede uno apuntar', () => {
  it('sigue abierta DESPUÉS de empezar, hasta que termina', () => {
    // Cerrarla al empezar dejaría fuera de la lista a quien llega tarde y está
    // allí de pie.
    expect(meetupIsOpen(quedada(), '2026-08-01T19:30:00.000Z')).toBe(true);
    expect(meetupIsOpen(quedada(), '2026-08-01T21:00:01.000Z')).toBe(false);
  });

  it('una quedada cancelada o borrada no admite a nadie', () => {
    expect(meetupIsOpen(quedada({ status: 'cancelled' }), '2026-08-01T18:30:00.000Z')).toBe(false);
    expect(meetupIsOpen(quedada({ deletedAt: '2026-07-30T00:00:00.000Z' }), '2026-08-01T18:30:00.000Z')).toBe(false);
  });
});

describe('la ventana de fichaje', () => {
  it('abre una hora antes y cierra al terminar', () => {
    const v = checkinWindow(quedada())!;
    expect(v.opensAt).toBe('2026-08-01T17:00:00.000Z');
    expect(v.closesAt).toBe('2026-08-01T21:00:00.000Z');
  });

  it('fuera de la ventana no se ficha', () => {
    const q = quedada();
    expect(checkinIsOpen(q, '2026-08-01T16:59:00.000Z')).toBe(false);  // aún no
    expect(checkinIsOpen(q, '2026-08-01T17:00:00.000Z')).toBe(true);   // justo al abrir
    expect(checkinIsOpen(q, '2026-08-01T20:59:00.000Z')).toBe(true);
    expect(checkinIsOpen(q, '2026-08-01T21:00:01.000Z')).toBe(false);  // ya terminó
  });
});

describe('el radio de fichaje', () => {
  it('mide en metros de verdad', () => {
    // Un grado de latitud son ~111 km. Medio grado de diferencia en latitud
    // tiene que dar del orden de 55 km, no un número inventado.
    const d = distanceMeters(37.0, -4.0, 37.5, -4.0);
    expect(d).toBeGreaterThan(55_000);
    expect(d).toBeLessThan(56_000);
  });

  it('deja fichar dentro de 500 m y no fuera', () => {
    const q = quedada();
    const { lat, lng } = q.place;
    // ~445 m al norte (0.004° de latitud) → dentro.
    expect(withinCheckinRadius(q, lat + 0.004, lng)).toBe(true);
    // ~890 m al norte → fuera.
    expect(withinCheckinRadius(q, lat + 0.008, lng)).toBe(false);
    // En el sitio exacto, obviamente dentro.
    expect(withinCheckinRadius(q, lat, lng)).toBe(true);
  });

  it('con coordenadas basura NO da por bueno el fichaje', () => {
    // Fallar hacia «no» importa: fallar hacia «sí» regalaría asistencias.
    const q = quedada();
    expect(withinCheckinRadius(q, NaN, q.place.lng)).toBe(false);
    expect(withinCheckinRadius(q, Infinity, q.place.lng)).toBe(false);
    expect(withinCheckinRadius(null, 0, 0)).toBe(false);
  });
});

describe('aforo', () => {
  it('SIN aforo devuelve null, que no es lo mismo que cero', () => {
    // Confundirlos pintaría como «llena» una quedada que no tiene límite.
    expect(spotsLeft(quedada({ capacity: undefined }), 999)).toBeNull();
    expect(isFull(quedada({ capacity: undefined }), 999)).toBe(false);
  });

  it('con aforo, cuenta las plazas y no baja de cero', () => {
    const q = quedada({ capacity: 20 });
    expect(spotsLeft(q, 12)).toBe(8);
    expect(spotsLeft(q, 20)).toBe(0);
    expect(spotsLeft(q, 25)).toBe(0);
    expect(isFull(q, 20)).toBe(true);
    expect(isFull(q, 19)).toBe(false);
  });
});

describe('estados de inscripción', () => {
  it('solo admite los del contrato', () => {
    // «voy» y «me interesa» se distinguen a propósito: sin eso el aforo miente.
    expect(isValidRsvpStatus('going')).toBe(true);
    expect(isValidRsvpStatus('interested')).toBe(true);
    expect(isValidRsvpStatus('quizas')).toBe(false);
    expect(isValidRsvpStatus(undefined)).toBe(false);
  });
});
