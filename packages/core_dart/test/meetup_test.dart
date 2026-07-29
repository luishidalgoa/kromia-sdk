import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-277 — quedadas. Espejo de `packages/core/tests/meetup.test.ts`: se fijan
/// las decisiones que costaron discusión, no la sintaxis de los tipos.
///
/// La razón de espejar TAMBIÉN los tests: `withinCheckinRadius` y
/// `checkinWindow` las usan el backend (para DECIDIR) y la app (para pintar el
/// botón «He llegado»). Si el cálculo se separa, la app ofrece un fichaje que el
/// servidor rechaza y el usuario se queda mirando un botón que no hace nada, de
/// pie en la puerta de una tienda.
void main() {
  Meetup quedada({
    String title = 'Quedada en la Tienda Cinabrio',
    String startsAt = '2026-08-01T18:00:00.000Z',
    String endsAt = '2026-08-01T21:00:00.000Z',
    MeetupPlace? place,
    int? capacity,
    String status = 'scheduled',
    String? deletedAt,
    String? description,
  }) =>
      Meetup(
        id: 'm1',
        channelId: 'c1',
        publisherId: 'p1',
        title: title,
        description: description,
        startsAt: startsAt,
        endsAt: endsAt,
        place: place ??
            const MeetupPlace(label: 'Tienda Cinabrio', lat: 37.8845, lng: -4.7796),
        capacity: capacity,
        status: status,
        deletedAt: deletedAt,
        createdAt: '2026-07-29T10:00:00.000Z',
      );

  DateTime t(String iso) => DateTime.parse(iso);

  group('validar una quedada', () {
    test('la válida pasa', () {
      expect(validateMeetup(quedada()).valid, isTrue);
    });

    test('SIN COORDENADAS no vale — es la diferencia con el adjunto de ubicación suelto', () {
      // Un adjunto de ubicación admite solo el nombre. Una quedada no: sin
      // coordenadas no hay radio contra el que medir el fichaje ni punto en el
      // mapa, y eso no se puede arreglar luego sin volver a molestar a los
      // inscritos.
      final r = validateMeetup(quedada(
        place: const MeetupPlace(
            label: 'Marismas de Vael', lat: double.nan, lng: double.nan),
      ));
      expect(r.valid, isFalse);
      expect(r.issues.any((i) => i.field == 'place'), isTrue);
    });

    test('no puede terminar antes de empezar', () {
      final r = quedada(
        startsAt: '2026-08-01T21:00:00.000Z',
        endsAt: '2026-08-01T18:00:00.000Z',
      );
      final v = validateMeetup(r);
      expect(v.valid, isFalse);
      expect(v.issues.any((i) => i.field == 'endsAt'), isTrue);
    });

    test('el aforo es OPCIONAL, pero si está tiene que ser creíble', () {
      expect(validateMeetup(quedada()).valid, isTrue);
      expect(validateMeetup(quedada(capacity: 20)).valid, isTrue);
      expect(validateMeetup(quedada(capacity: 0)).valid, isFalse);
    });

    test('el aforo FRACCIONARIO no puede existir en Dart (nota de espejo)', () {
      // El TS lo rechaza en `validateMeetup` porque allí `capacity` es `number`.
      // Aquí es `int?`, así que un 2.5 solo puede llegar por JSON — y se trunca
      // al parsear. La regla que importa (entre 1 y 10.000) se conserva; quien
      // CREA quedadas es Studio, y valida con el TS antes de que lleguen aquí.
      final m = Meetup.fromJson({
        'id': 'm1',
        'channelId': 'c1',
        'publisherId': 'p1',
        'title': 'X',
        'startsAt': '2026-08-01T18:00:00.000Z',
        'endsAt': '2026-08-01T21:00:00.000Z',
        'place': {'label': 'Sitio', 'lat': 37.0, 'lng': -4.0},
        'capacity': 2.5,
        'createdAt': '2026-07-29T10:00:00.000Z',
      });
      expect(m.capacity, 2);
    });

    test('rechaza coordenadas fuera del planeta', () {
      expect(
          validateMeetup(quedada(
                  place: const MeetupPlace(label: 'X', lat: 120, lng: 0)))
              .valid,
          isFalse);
      expect(
          validateMeetup(quedada(
                  place: const MeetupPlace(label: 'X', lat: 0, lng: 200)))
              .valid,
          isFalse);
    });

    test('exige título y respeta los topes de texto', () {
      expect(validateMeetup(quedada(title: '   ')).valid, isFalse);
      expect(
          validateMeetup(quedada(title: 'x' * (meetupLimits.title.max + 1)))
              .valid,
          isFalse);
      expect(
          validateMeetup(
                  quedada(description: 'x' * (meetupLimits.description.max + 1)))
              .valid,
          isFalse);
    });

    test('sin quedada que validar, se dice — no se revienta', () {
      final r = validateMeetup(null);
      expect(r.valid, isFalse);
      expect(r.issues.single.field, 'meetup');
    });
  });

  group('cuándo se puede uno apuntar', () {
    test('sigue abierta DESPUÉS de empezar, hasta que termina', () {
      // Cerrarla al empezar dejaría fuera de la lista a quien llega tarde y está
      // allí de pie.
      expect(meetupIsOpen(quedada(), now: t('2026-08-01T19:30:00.000Z')), isTrue);
      expect(
          meetupIsOpen(quedada(), now: t('2026-08-01T21:00:01.000Z')), isFalse);
    });

    test('una quedada cancelada o borrada no admite a nadie', () {
      expect(
          meetupIsOpen(quedada(status: 'cancelled'),
              now: t('2026-08-01T18:30:00.000Z')),
          isFalse);
      expect(
          meetupIsOpen(quedada(deletedAt: '2026-07-30T00:00:00.000Z'),
              now: t('2026-08-01T18:30:00.000Z')),
          isFalse);
    });
  });

  group('la ventana de fichaje', () {
    test('abre una hora antes y cierra al terminar', () {
      final v = checkinWindow(quedada())!;
      expect(v.opensAt, '2026-08-01T17:00:00.000Z');
      expect(v.closesAt, '2026-08-01T21:00:00.000Z');
    });

    test('fuera de la ventana no se ficha', () {
      final q = quedada();
      expect(checkinIsOpen(q, now: t('2026-08-01T16:59:00.000Z')), isFalse); // aún no
      expect(checkinIsOpen(q, now: t('2026-08-01T17:00:00.000Z')), isTrue); // al abrir
      expect(checkinIsOpen(q, now: t('2026-08-01T20:59:00.000Z')), isTrue);
      expect(checkinIsOpen(q, now: t('2026-08-01T21:00:01.000Z')), isFalse); // terminó
    });
  });

  group('el radio de fichaje', () {
    test('mide en metros de verdad', () {
      // Un grado de latitud son ~111 km. Medio grado de diferencia tiene que dar
      // del orden de 55 km, no un número inventado.
      final d = distanceMeters(37.0, -4.0, 37.5, -4.0);
      expect(d, greaterThan(55000));
      expect(d, lessThan(56000));
    });

    test('deja fichar dentro de 500 m y no fuera', () {
      final q = quedada();
      final lat = q.place.lat, lng = q.place.lng;
      // ~445 m al norte (0,004° de latitud) → dentro.
      expect(withinCheckinRadius(q, lat + 0.004, lng), isTrue);
      // ~890 m al norte → fuera.
      expect(withinCheckinRadius(q, lat + 0.008, lng), isFalse);
      // En el sitio exacto, obviamente dentro.
      expect(withinCheckinRadius(q, lat, lng), isTrue);
    });

    test('con coordenadas basura NO da por bueno el fichaje', () {
      // Fallar hacia «no» importa: fallar hacia «sí» regalaría asistencias.
      final q = quedada();
      expect(withinCheckinRadius(q, double.nan, q.place.lng), isFalse);
      expect(withinCheckinRadius(q, double.infinity, q.place.lng), isFalse);
      expect(withinCheckinRadius(null, 0, 0), isFalse);
    });
  });

  group('aforo', () {
    test('SIN aforo devuelve null, que no es lo mismo que cero', () {
      // Confundirlos pintaría como «llena» una quedada que no tiene límite.
      expect(spotsLeft(quedada(), 999), isNull);
      expect(isFull(quedada(), 999), isFalse);
    });

    test('con aforo, cuenta las plazas y no baja de cero', () {
      final q = quedada(capacity: 20);
      expect(spotsLeft(q, 12), 8);
      expect(spotsLeft(q, 20), 0);
      expect(spotsLeft(q, 25), 0);
      expect(isFull(q, 20), isTrue);
      expect(isFull(q, 19), isFalse);
    });
  });

  group('estados de inscripción', () {
    test('solo admite los del contrato', () {
      // «voy» y «me interesa» se distinguen a propósito: sin eso el aforo miente.
      expect(isValidRsvpStatus('going'), isTrue);
      expect(isValidRsvpStatus('interested'), isTrue);
      expect(isValidRsvpStatus('quizas'), isFalse);
      expect(isValidRsvpStatus(null), isFalse);
    });
  });

  group('comunicados (KRO-283)', () {
    test('vacío no vale: un comunicado sin texto no comunica', () {
      expect(validateMeetupUpdate(null).valid, isFalse);
      expect(validateMeetupUpdate('   ').valid, isFalse);
    });

    test('con texto vale, y hay tope', () {
      expect(validateMeetupUpdate('Cambiamos de sitio: nos vemos en la plaza.').valid,
          isTrue);
      expect(validateMeetupUpdate('x' * meetupLimits.update.max).valid, isTrue);
      expect(validateMeetupUpdate('x' * (meetupLimits.update.max + 1)).valid,
          isFalse);
    });

    test('el tope es el del CONTRATO, no el de la descripción', () {
      // Hoy los dos valen 1000, pero son campos distintos con vidas distintas:
      // lo que se fija es que el comunicado use el SUYO. Si mañana el TS cambia
      // uno de los dos, este test cae y el espejo se entera.
      expect(meetupLimits.update.max, 1000);
      expect(validateMeetupUpdate('x' * 1000).valid, isTrue);
      expect(validateMeetupUpdate('x' * 1001).valid, isFalse);
    });

    test('se parsea sin lanzar, aunque falten campos', () {
      final c = MeetupUpdate.fromJson(const {
        '_id': 'u1',
        'meetupId': 'm1',
        'authorId': 'p1',
        'body': 'Nos movemos al quiosco',
        'createdAt': '2026-02-13T09:00:00.000Z',
      });
      expect(c.id, 'u1');
      expect(c.body, 'Nos movemos al quiosco');
      // El listado del servidor ya filtra los retirados: aquí llega nulo.
      expect(c.deletedAt, isNull);
      expect(MeetupUpdate.fromJson(const {}).body, isEmpty);
    });
  });

  group('parseo defensivo', () {
    test('un JSON incompleto no revienta la pantalla', () {
      final m = Meetup.fromJson(const {'_id': 'm9'});
      expect(m.id, 'm9');
      expect(m.place.lat.isFinite, isFalse);
      // Sin coordenadas utilizables, ni se ficha ni se valida.
      expect(withinCheckinRadius(m, 37.0, -4.0), isFalse);
      expect(validateMeetup(m).valid, isFalse);
    });

    test('la inscripción sabe si está en lista de espera', () {
      final espera = MeetupRsvp.fromJson(const {
        'meetupId': 'm1',
        'userId': 'u1',
        'status': 'going',
        'waitlistPosition': 3,
      });
      expect(espera.isWaitlisted, isTrue);
      expect(espera.waitlistPosition, 3);
      final dentro = MeetupRsvp.fromJson(
          const {'meetupId': 'm1', 'userId': 'u2', 'status': 'going'});
      expect(dentro.isWaitlisted, isFalse);
      expect(dentro.anonymous, isFalse);
    });

    test('el fichaje conserva CÓMO se registró', () {
      // Hoy no lo lee nadie; existe porque la ubicación que manda un móvil no es
      // de fiar y algún día habrá que decidir a qué fichaje creerle.
      final c = MeetupCheckin.fromJson(const {
        'meetupId': 'm1',
        'userId': 'u1',
        'method': 'geo',
        'at': '2026-08-01T18:05:00.000Z',
      });
      expect(c.method, 'geo');
      expect(checkinMethods, contains(c.method));
    });
  });
}
