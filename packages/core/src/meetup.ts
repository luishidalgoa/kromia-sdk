/**
 * KRO-277 (Epic KRO-276) — QUEDADAS: eventos de comunidad a los que el
 * coleccionista se apunta.
 *
 * El contrato va primero, como el resto del SDK: el modelo y las reglas viven
 * aquí y los tres hosts las consumen. Si Studio, el backend y la app deciden
 * cada uno qué es una quedada válida o cuándo se puede fichar, divergen — y la
 * divergencia se descubre tarde, con alguien delante de una tienda.
 *
 * Es DATA social: no toca ningún registry del KRP, así que **no bumpea el
 * `protocolVersion`**.
 *
 * Nota de nomenclatura: el nombre del concepto es **quedada**. Se descartó
 * expresamente compararlo con productos de terceros — es funcionalidad propia.
 */

import type { CommunityIssue, CommunityValidationResult } from './community';

// ── Vocabulario ──────────────────────────────────────────────────────────────

/** Estado de la quedada. `cancelled` se conserva: hay gente apuntada que avisar. */
export const MEETUP_STATUSES = ['scheduled', 'cancelled'] as const;
export type MeetupStatus = typeof MEETUP_STATUSES[number];

/**
 * Qué ha dicho el coleccionista.
 *
 * Se distinguen a propósito: sin esa distinción el aforo miente, porque los que
 * «igual me paso» ocuparían plaza de los que van seguro.
 */
export const RSVP_STATUSES = ['going', 'interested'] as const;
export type RsvpStatus = typeof RSVP_STATUSES[number];

/**
 * CÓMO se registró la asistencia.
 *
 * Se guarda desde el primer día aunque hoy no lo use nadie. La razón es que la
 * ubicación que manda un móvil **no es de fiar** (Android permite simularla
 * desde opciones de desarrollador), así que el día que haya un programa de
 * recompensas habrá que decidir a qué fichaje creerle. Sin este campo desde el
 * principio, ese día no se podrá distinguir un fichaje de confianza de otro
 * cualquiera, y el histórico ya no se puede reconstruir.
 */
export const CHECKIN_METHODS = ['geo', 'host'] as const;
export type CheckinMethod = typeof CHECKIN_METHODS[number];

// ── Límites ──────────────────────────────────────────────────────────────────

/**
 * Se exporta aparte y NO dentro de `COMMUNITY_LIMITS` para no crear un ciclo de
 * importación: este módulo ya depende de los tipos de validación de `community`.
 */
export const MEETUP_LIMITS = {
  title:        { min: 1, max: 90 },
  description:  { max: 1000 },
  /** «Junto a la mesa del fondo». Una dirección te deja en la puerta. */
  meetingPoint: { max: 120 },
  placeLabel:   { max: 80 },
  placeAddress: { max: 200 },
  capacity:     { min: 1, max: 10_000 },
  /** Cuerpo de un comunicado (KRO-283). Es un aviso, no un artículo. */
  update:       { max: 1000 },
  /** Radio de fichaje, en METROS. */
  checkinRadiusMeters: 500,
  /**
   * La ventana de fichaje abre esto ANTES del inicio y cierra al terminar.
   * Una hora y no quince minutos porque la gente llega pronto, y un botón que
   * aún no funciona cuando ya estás dentro de la tienda se lee como avería.
   */
  checkinOpensBeforeMs: 60 * 60 * 1000,
} as const;

// ── Modelo ───────────────────────────────────────────────────────────────────

/**
 * Dónde es la quedada.
 *
 * A diferencia del adjunto de ubicación suelto (`PostLocationAttachment`, donde
 * `lat`/`lng` son opcionales), aquí las **coordenadas son obligatorias**: sin
 * ellas no hay radio contra el que medir el fichaje ni punto que pintar en el
 * mapa. Es lo que evita tener dos clases de quedada que explicar.
 */
export interface MeetupPlace {
  /** Nombre del sitio, tal y como lo escribe el publisher. */
  label:         string;
  address?:      string;
  lat:           number;
  lng:           number;
  /** Dónde exactamente, dentro del sitio. Opcional pero muy recomendable. */
  meetingPoint?: string;
}

export interface Meetup {
  id:           string;
  channelId:    string;
  publisherId:  string;            // denormalizado (queries por publisher)
  /** La publicación que la anuncia en el muro, si se anunció. */
  postId?:      string;
  title:        string;
  description?: string;
  startsAt:     string;            // ISO
  endsAt:       string;            // ISO
  place:        MeetupPlace;
  /** Ausente = SIN límite de plazas. Es opcional a propósito. */
  capacity?:    number;
  status:       MeetupStatus;
  createdAt:    string;            // ISO
  updatedAt?:   string;
  /** Soft-delete, mismo criterio que canales y publicaciones. */
  deletedAt?:   string;
  deletedBy?:   string;
}

export interface MeetupRsvp {
  meetupId:  string;
  /** El id ESTABLE del usuario, nunca su nombre: el nombre puede cambiar. */
  userId:    string;
  status:    RsvpStatus;
  /**
   * Apuntado en anónimo. El anonimato es ASIMÉTRICO: el resto de asistentes le
   * ven como un desconocido, pero **el anfitrión sí le ve** — necesita saber
   * quién viene para gestionar el aforo y moderar. Cuenta para el aforo igual.
   */
  anonymous?: boolean;
  /** Presente = está en LISTA DE ESPERA, en esta posición (1 = el primero). */
  waitlistPosition?: number;
  createdAt: string;
}

export interface MeetupCheckin {
  meetupId: string;
  userId:   string;
  method:   CheckinMethod;
  at:       string;                // ISO
}

/**
 * KRO-283 — un COMUNICADO de la quedada: «hemos cambiado de sitio», «traed
 * fundas», «se ha ampliado el aforo».
 *
 * No es lo mismo que el aviso que se manda al cambiar la hora. Un **aviso**
 * llega, se lee y desaparece; un **comunicado se queda publicado**. La
 * diferencia importa en el caso real: quien se apunta el jueves a una quedada
 * que cambió de sitio el martes no se entera con un aviso —ese mensaje ya
 * pasó— pero sí lo lee al abrir la quedada.
 *
 * Una quedada necesita los dos: el aviso empuja, el comunicado permanece.
 *
 * Lo escribe SOLO quien organiza. Por eso no abre la superficie de escritura ni
 * arrastra la moderación que sí exigirán los hilos (KRO-282): si esos llegan,
 * un comunicado pasa a ser un caso particular suyo en vez de un mecanismo
 * paralelo.
 */
export interface MeetupUpdate {
  id:        string;
  meetupId:  string;
  /** Quién lo escribió — siempre alguien del equipo del publisher. */
  authorId:  string;
  body:      string;
  createdAt: string;              // ISO
  deletedAt?: string;
}

// ── Helpers puros ────────────────────────────────────────────────────────────

/** Parsea una fecha ISO a milisegundos. `NaN` si no vale — quien llama decide. */
function ms(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return Date.parse(iso);
}

/** ¿Es un número real y utilizable? Descarta `NaN` e infinitos. */
function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * ¿Se puede uno apuntar todavía?
 *
 * Se cierra al TERMINAR, no al empezar: alguien que llega tarde a una quedada de
 * cuatro horas sigue queriendo apuntarse, y cerrarlo al inicio le deja fuera de
 * la lista aunque esté allí de pie.
 */
export function meetupIsOpen(m: Meetup | null | undefined, now: string | number | Date = new Date()): boolean {
  if (!m || m.status !== 'scheduled' || m.deletedAt) return false;
  const fin = ms(m.endsAt);
  const ahora = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : ms(now);
  if (!Number.isFinite(fin) || !Number.isFinite(ahora)) return false;
  return ahora <= fin;
}

/** Cuándo abre y cierra el fichaje. Devuelve `null` si las fechas no valen. */
export function checkinWindow(m: Meetup | null | undefined): { opensAt: string; closesAt: string } | null {
  if (!m) return null;
  const inicio = ms(m.startsAt);
  const fin = ms(m.endsAt);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return null;
  return {
    opensAt:  new Date(inicio - MEETUP_LIMITS.checkinOpensBeforeMs).toISOString(),
    closesAt: new Date(fin).toISOString(),
  };
}

/** ¿Estamos DENTRO de la ventana de fichaje? */
export function checkinIsOpen(m: Meetup | null | undefined, now: string | number | Date = new Date()): boolean {
  if (!m || m.status !== 'scheduled' || m.deletedAt) return false;
  const v = checkinWindow(m);
  if (!v) return false;
  const ahora = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : ms(now);
  if (!Number.isFinite(ahora)) return false;
  return ahora >= ms(v.opensAt) && ahora <= ms(v.closesAt);
}

/**
 * Distancia en METROS entre dos puntos (fórmula del semiverseno).
 *
 * Se implementa aquí y no se delega a una librería para que el backend y la app
 * midan EXACTAMENTE lo mismo. Si cada uno usara la suya, la app podría ofrecer
 * un fichaje que el servidor rechaza — y el usuario se queda mirando un botón
 * que no hace nada, que es el peor fallo posible en este flujo.
 */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  if (![aLat, aLng, bLat, bLng].every(esNumero)) return NaN;
  const R = 6_371_000;                       // radio medio de la Tierra, en metros
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * ¿Está lo bastante cerca para fichar?
 *
 * La usan el backend (para DECIDIR) y la app (para pintar el botón). Quien manda
 * es el backend: la app la usa solo para no ofrecer algo que va a ser rechazado.
 */
export function withinCheckinRadius(
  m: Meetup | null | undefined, lat: number, lng: number,
): boolean {
  if (!m || !esNumero(m.place?.lat) || !esNumero(m.place?.lng)) return false;
  const d = distanceMeters(m.place.lat, m.place.lng, lat, lng);
  return Number.isFinite(d) && d <= MEETUP_LIMITS.checkinRadiusMeters;
}

/**
 * Plazas libres. `null` cuando la quedada **no tiene aforo** — que no es lo
 * mismo que cero, y confundirlos haría que una quedada sin límite se pintara
 * como llena.
 */
export function spotsLeft(m: Meetup | null | undefined, going: number): number | null {
  if (!m || !esNumero(m.capacity)) return null;
  return Math.max(0, m.capacity - Math.max(0, going));
}

/** ¿Está llena? Sin aforo nunca lo está. */
export function isFull(m: Meetup | null | undefined, going: number): boolean {
  const libres = spotsLeft(m, going);
  return libres !== null && libres === 0;
}

// ── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida la FORMA de una quedada. Misma función para Studio y el backend: la
 * interfaz no debería poder construir algo que la puerta de entrada rechaza.
 */
export function validateMeetup(m: Partial<Meetup> | null | undefined): CommunityValidationResult {
  const issues: CommunityIssue[] = [];
  if (!m) {
    return { valid: false, issues: [{ field: 'meetup', message: 'No hay quedada que validar.' }] };
  }

  const titulo = (m.title ?? '').trim();
  if (titulo.length < MEETUP_LIMITS.title.min) {
    issues.push({ field: 'title', message: 'La quedada necesita un título.' });
  } else if (titulo.length > MEETUP_LIMITS.title.max) {
    issues.push({ field: 'title', message: `El título no puede superar ${MEETUP_LIMITS.title.max} caracteres.` });
  }

  if ((m.description ?? '').length > MEETUP_LIMITS.description.max) {
    issues.push({ field: 'description', message: `La descripción no puede superar ${MEETUP_LIMITS.description.max} caracteres.` });
  }

  const inicio = ms(m.startsAt);
  const fin = ms(m.endsAt);
  if (!Number.isFinite(inicio)) issues.push({ field: 'startsAt', message: 'La fecha de inicio no es válida.' });
  if (!Number.isFinite(fin))    issues.push({ field: 'endsAt',   message: 'La fecha de fin no es válida.' });
  if (Number.isFinite(inicio) && Number.isFinite(fin) && fin <= inicio) {
    issues.push({ field: 'endsAt', message: 'La quedada no puede terminar antes de empezar.' });
  }

  const sitio = m.place;
  if (!sitio) {
    issues.push({ field: 'place', message: 'La quedada necesita un sitio.' });
  } else {
    const nombre = (sitio.label ?? '').trim();
    if (!nombre) {
      issues.push({ field: 'place.label', message: 'El sitio necesita un nombre.' });
    } else if (nombre.length > MEETUP_LIMITS.placeLabel.max) {
      issues.push({ field: 'place.label', message: `El nombre del sitio no puede superar ${MEETUP_LIMITS.placeLabel.max} caracteres.` });
    }
    if ((sitio.address ?? '').length > MEETUP_LIMITS.placeAddress.max) {
      issues.push({ field: 'place.address', message: `La dirección no puede superar ${MEETUP_LIMITS.placeAddress.max} caracteres.` });
    }
    if ((sitio.meetingPoint ?? '').length > MEETUP_LIMITS.meetingPoint.max) {
      issues.push({ field: 'place.meetingPoint', message: `El punto de encuentro no puede superar ${MEETUP_LIMITS.meetingPoint.max} caracteres.` });
    }
    // Las coordenadas son OBLIGATORIAS aquí, al revés que en el adjunto suelto:
    // sin ellas no hay fichaje ni mapa, y una quedada a medias no se puede
    // arreglar después sin volver a molestar a los inscritos.
    if (!esNumero(sitio.lat) || !esNumero(sitio.lng)) {
      issues.push({ field: 'place', message: 'Elige la dirección en el buscador: sin coordenadas no se puede fichar ni verla en el mapa.' });
    } else {
      if (sitio.lat < -90 || sitio.lat > 90)   issues.push({ field: 'place.lat', message: 'La latitud está fuera de rango.' });
      if (sitio.lng < -180 || sitio.lng > 180) issues.push({ field: 'place.lng', message: 'La longitud está fuera de rango.' });
    }
  }

  // El aforo es opcional; si está, tiene que ser un número de plazas creíble.
  if (m.capacity !== undefined && m.capacity !== null) {
    if (!esNumero(m.capacity) || !Number.isInteger(m.capacity)) {
      issues.push({ field: 'capacity', message: 'El aforo tiene que ser un número entero de plazas.' });
    } else if (m.capacity < MEETUP_LIMITS.capacity.min || m.capacity > MEETUP_LIMITS.capacity.max) {
      issues.push({ field: 'capacity', message: `El aforo tiene que estar entre ${MEETUP_LIMITS.capacity.min} y ${MEETUP_LIMITS.capacity.max}.` });
    }
  }

  if (m.status !== undefined && !(MEETUP_STATUSES as readonly string[]).includes(m.status)) {
    issues.push({ field: 'status', message: 'Estado de quedada no válido.' });
  }

  return { valid: issues.length === 0, issues };
}

/** ¿Es un estado de inscripción de los que admite el contrato? */
export function isValidRsvpStatus(v: unknown): v is RsvpStatus {
  return typeof v === 'string' && (RSVP_STATUSES as readonly string[]).includes(v);
}

/**
 * Valida un comunicado. Poco que comprobar, pero se comprueba en el SDK igual
 * que todo lo demás: si Studio y el backend decidieran cada uno qué cuerpo vale,
 * acabarían discrepando en el tope y el usuario vería un error al enviar algo
 * que la pantalla le dejó escribir.
 */
export function validateMeetupUpdate(body: string | null | undefined): CommunityValidationResult {
  const texto = (body ?? '').trim();
  if (!texto) {
    return { valid: false, issues: [{ field: 'body', message: 'El comunicado no puede estar vacío.' }] };
  }
  if (texto.length > MEETUP_LIMITS.update.max) {
    return {
      valid: false,
      issues: [{ field: 'body', message: `El comunicado no puede superar ${MEETUP_LIMITS.update.max} caracteres.` }],
    };
  }
  return { valid: true, issues: [] };
}
