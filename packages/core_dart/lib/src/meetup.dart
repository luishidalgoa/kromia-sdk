/// KRO-277 (Epic KRO-276) — QUEDADAS: eventos de comunidad a los que el
/// coleccionista se apunta.
///
/// Espejo Dart de `packages/core/src/meetup.ts`. El contrato manda: el modelo y
/// las reglas viven en el TS y los tres hosts las consumen. Si Studio, el
/// backend y la app decidieran cada uno qué es una quedada válida o cuándo se
/// puede fichar, divergirían — y la divergencia se descubre tarde, con alguien
/// delante de una tienda.
///
/// Es DATA social: no toca ningún registry del KRP, así que **no bumpea el
/// `protocolVersion`**.
///
/// Nota de nomenclatura: el nombre del concepto es **quedada**. Es funcionalidad
/// propia de Kromia; no se compara con productos de terceros.
library;

import 'dart:math' as math;

import 'community.dart';

// ── Vocabulario ──────────────────────────────────────────────────────────────

/// Estado de la quedada. `cancelled` se conserva: hay gente apuntada que avisar.
const List<String> meetupStatuses = ['scheduled', 'cancelled'];

/// Qué ha dicho el coleccionista.
///
/// Se distinguen a propósito: sin esa distinción el aforo miente, porque los que
/// «igual me paso» ocuparían plaza de los que van seguro.
const List<String> rsvpStatuses = ['going', 'interested'];

/// CÓMO se registró la asistencia.
///
/// Se guarda desde el primer día aunque hoy no lo lea nadie. La razón es que la
/// ubicación que manda un móvil **no es de fiar** (Android permite simularla
/// desde opciones de desarrollador), así que el día que haya un programa de
/// recompensas habrá que decidir a qué fichaje creerle. Sin este campo desde el
/// principio, ese día no se podrá distinguir un fichaje de confianza de otro
/// cualquiera, y el histórico ya no se puede reconstruir.
const List<String> checkinMethods = ['geo', 'host'];

// ── Límites ──────────────────────────────────────────────────────────────────

/// Límites de contrato de las quedadas.
///
/// Van APARTE y NO dentro de [communityLimits], igual que en el TS: este módulo
/// ya depende de `community`, y meterlos allí abriría un ciclo de importación.
const ({
  ({int min, int max}) title,
  ({int max}) description,
  ({int max}) meetingPoint,
  ({int max}) placeLabel,
  ({int max}) placeAddress,
  ({int min, int max}) capacity,
  ({int max}) update,
  int checkinRadiusMeters,
  int checkinOpensBeforeMs,
}) meetupLimits = (
  title: (min: 1, max: 90),
  description: (max: 1000),
  // «Junto a la mesa del fondo». Una dirección te deja en la puerta.
  meetingPoint: (max: 120),
  placeLabel: (max: 80),
  placeAddress: (max: 200),
  capacity: (min: 1, max: 10000),
  update: (max: 1000),
  /// Radio de fichaje, en METROS.
  checkinRadiusMeters: 500,
  /// La ventana de fichaje abre esto ANTES del inicio y cierra al terminar.
  ///
  /// CINCO MINUTOS — decisión del user (2026-08-04), que revierte la hora que
  /// había antes. Fichar es «he acudido», y con una hora de margen eso deja de
  /// significarlo: alguien puede fichar desde la puerta y marcharse, o hacerlo
  /// de paso una hora antes por otra cosa. Cuanto más pegada al inicio, más se
  /// parece la marca a lo que dice ser.
  ///
  /// LA CONTRAPARTIDA, que estaba escrita aquí y conviene no perder: la gente
  /// llega pronto, y un botón que aún no funciona cuando ya estás dentro del
  /// sitio se lee como avería. Cinco minutos lo hacen frecuente, no raro. Se
  /// asume a cambio de que el dato signifique algo — pero si empiezan a llegar
  /// quejas de «no me deja fichar y ya estoy aquí», el motivo es este número, y
  /// el mensaje que lo acompaña tiene que decir a qué hora se abre.
  checkinOpensBeforeMs: 5 * 60 * 1000,
);

// ── Modelo ───────────────────────────────────────────────────────────────────

/// Dónde es la quedada.
///
/// A diferencia del adjunto de ubicación suelto (`PostLocationAttachment`, donde
/// `lat`/`lng` son opcionales), aquí las **coordenadas son obligatorias**: sin
/// ellas no hay radio contra el que medir el fichaje ni punto que pintar en el
/// mapa. Es lo que evita tener dos clases de quedada que explicar.
class MeetupPlace {
  /// Nombre del sitio, tal y como lo escribe el publisher.
  final String label;
  final String? address;
  final double lat;
  final double lng;

  /// Dónde exactamente, dentro del sitio. Opcional pero muy recomendable.
  final String? meetingPoint;

  const MeetupPlace({
    required this.label,
    required this.lat,
    required this.lng,
    this.address,
    this.meetingPoint,
  });

  /// Parseo DEFENSIVO: nunca lanza. Un sitio ilegible degrada a coordenadas no
  /// finitas, que los helpers ya descartan, en vez de tumbar la pantalla.
  factory MeetupPlace.fromJson(Map<String, dynamic> json) => MeetupPlace(
        label: json['label']?.toString() ?? '',
        address: json['address']?.toString(),
        lat: _num(json['lat']),
        lng: _num(json['lng']),
        meetingPoint: json['meetingPoint']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'label': label,
        if (address != null) 'address': address,
        'lat': lat,
        'lng': lng,
        if (meetingPoint != null) 'meetingPoint': meetingPoint,
      };
}

class Meetup {
  final String id;
  final String channelId;

  /// Denormalizado (consultas por publisher).
  final String publisherId;

  /// La publicación que la anuncia en el muro, si se anunció.
  final String? postId;
  final String title;
  final String? description;

  /// ISO.
  final String startsAt;

  /// ISO.
  final String endsAt;
  final MeetupPlace place;

  /// Ausente = SIN límite de plazas. Es opcional a propósito.
  final int? capacity;
  final String status;

  /// ISO.
  final String createdAt;
  final String? updatedAt;

  /// Soft-delete, mismo criterio que canales y publicaciones.
  final String? deletedAt;
  final String? deletedBy;

  const Meetup({
    required this.id,
    required this.channelId,
    required this.publisherId,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.place,
    required this.createdAt,
    this.postId,
    this.description,
    this.capacity,
    this.status = 'scheduled',
    this.updatedAt,
    this.deletedAt,
    this.deletedBy,
  });

  factory Meetup.fromJson(Map<String, dynamic> json) {
    final sitio = json['place'];
    return Meetup(
      id: (json['_id'] ?? json['id'])?.toString() ?? '',
      channelId: (json['channelId'] ?? '')?.toString() ?? '',
      publisherId: (json['publisherId'] ?? '')?.toString() ?? '',
      postId: json['postId']?.toString(),
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      startsAt: json['startsAt']?.toString() ?? '',
      endsAt: json['endsAt']?.toString() ?? '',
      place: sitio is Map
          ? MeetupPlace.fromJson(sitio.cast<String, dynamic>())
          : const MeetupPlace(label: '', lat: double.nan, lng: double.nan),
      capacity: (json['capacity'] as num?)?.toInt(),
      // Un estado desconocido NO se da por programado: eso pintaría como viva
      // una quedada que el servidor considera otra cosa.
      status: json['status']?.toString() ?? 'scheduled',
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString(),
      deletedAt: json['deletedAt']?.toString(),
      deletedBy: json['deletedBy']?.toString(),
    );
  }
}

class MeetupRsvp {
  final String meetupId;

  /// El id ESTABLE del usuario, nunca su nombre: el nombre puede cambiar.
  final String userId;
  final String status;

  /// Apuntado en anónimo. El anonimato es ASIMÉTRICO: el resto de asistentes le
  /// ven como un desconocido, pero **el anfitrión sí le ve** — necesita saber
  /// quién viene para gestionar el aforo y moderar. Cuenta para el aforo igual.
  final bool anonymous;

  /// Presente = está en LISTA DE ESPERA, en esta posición (1 = el primero).
  final int? waitlistPosition;
  final String createdAt;

  const MeetupRsvp({
    required this.meetupId,
    required this.userId,
    required this.status,
    this.anonymous = false,
    this.waitlistPosition,
    this.createdAt = '',
  });

  factory MeetupRsvp.fromJson(Map<String, dynamic> json) => MeetupRsvp(
        meetupId: json['meetupId']?.toString() ?? '',
        userId: json['userId']?.toString() ?? '',
        status: json['status']?.toString() ?? '',
        anonymous: json['anonymous'] == true,
        waitlistPosition: (json['waitlistPosition'] as num?)?.toInt(),
        createdAt: json['createdAt']?.toString() ?? '',
      );

  /// ¿Está en lista de espera? La posición presente es la marca.
  bool get isWaitlisted => waitlistPosition != null;
}

/// KRO-283 — COMUNICADO de una quedada.
///
/// No es lo mismo que el aviso que se manda al cambiar la hora. Un **aviso**
/// llega, se lee y desaparece; un **comunicado se queda publicado**. La
/// diferencia importa en el caso real: quien se apunta el jueves a una quedada
/// que cambió de sitio el martes no se entera con un aviso —ese mensaje ya
/// pasó— pero sí lo lee al abrir la quedada.
///
/// Lo escribe SOLO quien organiza, así que no abre superficie de escritura ni
/// arrastra moderación.
class MeetupUpdate {
  final String id;
  final String meetupId;

  /// Quién lo escribió — siempre alguien del equipo del publisher.
  final String authorId;
  final String body;

  /// ISO.
  final String createdAt;

  /// Soft-delete. **El listado del servidor YA filtra los retirados**, así que
  /// en la app esto viene siempre nulo; se modela para no divergir del contrato
  /// y por si algún día se expone el historial completo.
  final String? deletedAt;

  const MeetupUpdate({
    required this.id,
    required this.meetupId,
    required this.authorId,
    required this.body,
    required this.createdAt,
    this.deletedAt,
  });

  factory MeetupUpdate.fromJson(Map<String, dynamic> json) => MeetupUpdate(
        id: (json['_id'] ?? json['id'])?.toString() ?? '',
        meetupId: json['meetupId']?.toString() ?? '',
        authorId: json['authorId']?.toString() ?? '',
        body: json['body']?.toString() ?? '',
        createdAt: json['createdAt']?.toString() ?? '',
        deletedAt: json['deletedAt']?.toString(),
      );
}

class MeetupCheckin {
  final String meetupId;
  final String userId;
  final String method;

  /// ISO.
  final String at;

  const MeetupCheckin({
    required this.meetupId,
    required this.userId,
    required this.method,
    required this.at,
  });

  factory MeetupCheckin.fromJson(Map<String, dynamic> json) => MeetupCheckin(
        meetupId: json['meetupId']?.toString() ?? '',
        userId: json['userId']?.toString() ?? '',
        method: json['method']?.toString() ?? '',
        at: json['at']?.toString() ?? '',
      );
}

// ── Helpers puros ────────────────────────────────────────────────────────────

/// Número real y utilizable. `NaN` si no lo es — quien llama decide.
double _num(Object? v) {
  if (v is num) return v.isFinite ? v.toDouble() : double.nan;
  if (v is String) return double.tryParse(v) ?? double.nan;
  return double.nan;
}

/// Milisegundos de una fecha ISO. `null` si no vale.
int? _ms(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  return DateTime.tryParse(iso)?.millisecondsSinceEpoch;
}

int _ahora(DateTime? now) => (now ?? DateTime.now()).millisecondsSinceEpoch;

/// ¿Se puede uno apuntar todavía?
///
/// Se cierra al TERMINAR, no al empezar: alguien que llega tarde a una quedada
/// de cuatro horas sigue queriendo apuntarse, y cerrarlo al inicio le deja fuera
/// de la lista aunque esté allí de pie.
bool meetupIsOpen(Meetup? m, {DateTime? now}) {
  if (m == null || m.status != 'scheduled' || m.deletedAt != null) return false;
  final fin = _ms(m.endsAt);
  if (fin == null) return false;
  return _ahora(now) <= fin;
}

/// Cuándo abre y cierra el fichaje. `null` si las fechas no valen.
({String opensAt, String closesAt})? checkinWindow(Meetup? m) {
  if (m == null) return null;
  final inicio = _ms(m.startsAt);
  final fin = _ms(m.endsAt);
  if (inicio == null || fin == null) return null;
  return (
    opensAt: DateTime.fromMillisecondsSinceEpoch(
            inicio - meetupLimits.checkinOpensBeforeMs,
            isUtc: true)
        .toIso8601String(),
    closesAt:
        DateTime.fromMillisecondsSinceEpoch(fin, isUtc: true).toIso8601String(),
  );
}

/// ¿Estamos DENTRO de la ventana de fichaje?
bool checkinIsOpen(Meetup? m, {DateTime? now}) {
  if (m == null || m.status != 'scheduled' || m.deletedAt != null) return false;
  final v = checkinWindow(m);
  if (v == null) return false;
  final abre = _ms(v.opensAt);
  final cierra = _ms(v.closesAt);
  if (abre == null || cierra == null) return false;
  final t = _ahora(now);
  return t >= abre && t <= cierra;
}

/// Distancia en METROS entre dos puntos (fórmula del semiverseno).
///
/// Se implementa aquí y no se delega a una librería para que el backend y la app
/// midan EXACTAMENTE lo mismo. Si cada uno usara la suya, la app podría ofrecer
/// un fichaje que el servidor rechaza — y el usuario se queda mirando un botón
/// que no hace nada, que es el peor fallo posible en este flujo.
double distanceMeters(double aLat, double aLng, double bLat, double bLng) {
  if (![aLat, aLng, bLat, bLng].every((v) => v.isFinite)) return double.nan;
  const r = 6371000.0; // radio medio de la Tierra, en metros
  double rad(double g) => g * math.pi / 180;
  final dLat = rad(bLat - aLat);
  final dLng = rad(bLng - aLng);
  final s = math.pow(math.sin(dLat / 2), 2) +
      math.cos(rad(aLat)) * math.cos(rad(bLat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.min(1, math.sqrt(s.toDouble())));
}

/// ¿Está lo bastante cerca para fichar?
///
/// La usan el backend (para DECIDIR) y la app (para pintar el botón). Quien
/// manda es el backend: la app la usa solo para no ofrecer algo que va a ser
/// rechazado.
bool withinCheckinRadius(Meetup? m, double lat, double lng) {
  if (m == null || !m.place.lat.isFinite || !m.place.lng.isFinite) return false;
  final d = distanceMeters(m.place.lat, m.place.lng, lat, lng);
  return d.isFinite && d <= meetupLimits.checkinRadiusMeters;
}

/// Plazas libres. `null` cuando la quedada **no tiene aforo** — que no es lo
/// mismo que cero, y confundirlos haría que una quedada sin límite se pintara
/// como llena.
int? spotsLeft(Meetup? m, int going) {
  final aforo = m?.capacity;
  if (m == null || aforo == null) return null;
  return math.max(0, aforo - math.max(0, going));
}

/// ¿Está llena? Sin aforo nunca lo está.
bool isFull(Meetup? m, int going) {
  final libres = spotsLeft(m, going);
  return libres != null && libres == 0;
}

/// Valida un comunicado. Vacío no vale (un comunicado sin texto no comunica) y
/// hay tope de longitud.
MeetupValidationResult validateMeetupUpdate(String? body) {
  final texto = (body ?? '').trim();
  if (texto.isEmpty) {
    return const MeetupValidationResult(
      false,
      [MeetupIssue('body', 'El comunicado no puede estar vacío.')],
    );
  }
  if (texto.length > meetupLimits.update.max) {
    return MeetupValidationResult(
      false,
      [
        MeetupIssue('body',
            'El comunicado no puede superar ${meetupLimits.update.max} caracteres.')
      ],
    );
  }
  return const MeetupValidationResult(true, []);
}

/// ¿Es un estado de inscripción de los que admite el contrato?
bool isValidRsvpStatus(Object? v) => v is String && rsvpStatuses.contains(v);

// ── Validación ───────────────────────────────────────────────────────────────

/// Los tipos de validación son los de `community`, igual que en el TS (donde
/// este módulo los importa de allí). Se mantienen los nombres como ALIAS para
/// no romper a quien ya los usa.
typedef MeetupIssue = CommunityIssue;
typedef MeetupValidationResult = CommunityValidationResult;

/// Valida la FORMA de una quedada. Misma función para los tres hosts: la
/// interfaz no debería poder construir algo que la puerta de entrada rechaza.
///
/// Se espeja aunque hoy la app solo LEA quedadas: es la regla que decide si un
/// sitio sirve para fichar, y tenerla en los dos idiomas es lo que impide que se
/// separen sin que nadie lo note.
MeetupValidationResult validateMeetup(Meetup? m) {
  if (m == null) {
    return const MeetupValidationResult(
      false,
      [MeetupIssue('meetup', 'No hay quedada que validar.')],
    );
  }
  final issues = <MeetupIssue>[];

  final titulo = m.title.trim();
  if (titulo.length < meetupLimits.title.min) {
    issues.add(const MeetupIssue('title', 'La quedada necesita un título.'));
  } else if (titulo.length > meetupLimits.title.max) {
    issues.add(MeetupIssue('title',
        'El título no puede superar ${meetupLimits.title.max} caracteres.'));
  }

  if ((m.description ?? '').length > meetupLimits.description.max) {
    issues.add(MeetupIssue('description',
        'La descripción no puede superar ${meetupLimits.description.max} caracteres.'));
  }

  final inicio = _ms(m.startsAt);
  final fin = _ms(m.endsAt);
  if (inicio == null) {
    issues.add(const MeetupIssue('startsAt', 'La fecha de inicio no es válida.'));
  }
  if (fin == null) {
    issues.add(const MeetupIssue('endsAt', 'La fecha de fin no es válida.'));
  }
  if (inicio != null && fin != null && fin <= inicio) {
    issues.add(const MeetupIssue(
        'endsAt', 'La quedada no puede terminar antes de empezar.'));
  }

  final sitio = m.place;
  final nombre = sitio.label.trim();
  if (nombre.isEmpty) {
    issues.add(const MeetupIssue('place.label', 'El sitio necesita un nombre.'));
  } else if (nombre.length > meetupLimits.placeLabel.max) {
    issues.add(MeetupIssue('place.label',
        'El nombre del sitio no puede superar ${meetupLimits.placeLabel.max} caracteres.'));
  }
  if ((sitio.address ?? '').length > meetupLimits.placeAddress.max) {
    issues.add(MeetupIssue('place.address',
        'La dirección no puede superar ${meetupLimits.placeAddress.max} caracteres.'));
  }
  if ((sitio.meetingPoint ?? '').length > meetupLimits.meetingPoint.max) {
    issues.add(MeetupIssue('place.meetingPoint',
        'El punto de encuentro no puede superar ${meetupLimits.meetingPoint.max} caracteres.'));
  }
  // Las coordenadas son OBLIGATORIAS aquí, al revés que en el adjunto suelto:
  // sin ellas no hay fichaje ni mapa, y una quedada a medias no se puede
  // arreglar después sin volver a molestar a los inscritos.
  if (!sitio.lat.isFinite || !sitio.lng.isFinite) {
    issues.add(const MeetupIssue('place',
        'Elige la dirección en el buscador: sin coordenadas no se puede fichar ni verla en el mapa.'));
  } else {
    if (sitio.lat < -90 || sitio.lat > 90) {
      issues.add(const MeetupIssue('place.lat', 'La latitud está fuera de rango.'));
    }
    if (sitio.lng < -180 || sitio.lng > 180) {
      issues.add(const MeetupIssue('place.lng', 'La longitud está fuera de rango.'));
    }
  }

  // El aforo es opcional; si está, tiene que ser un número de plazas creíble.
  final aforo = m.capacity;
  if (aforo != null &&
      (aforo < meetupLimits.capacity.min || aforo > meetupLimits.capacity.max)) {
    issues.add(MeetupIssue('capacity',
        'El aforo tiene que estar entre ${meetupLimits.capacity.min} y ${meetupLimits.capacity.max}.'));
  }

  if (!meetupStatuses.contains(m.status)) {
    issues.add(const MeetupIssue('status', 'Estado de quedada no válido.'));
  }

  return MeetupValidationResult(issues.isEmpty, issues);
}
