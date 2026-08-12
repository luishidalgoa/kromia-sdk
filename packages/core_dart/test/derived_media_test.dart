import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-335 — el ancho de un derivado de imagen. Espejo de
/// `packages/core/src/derived-media.ts`.
///
/// Vive en el SDK y no en cada host porque **Studio y el backend sirven los dos
/// el mismo `/api/images`**, cada uno con su implementación. Si divergieran, el
/// precio no sería una imagen rota sino **caché partida**: cada host generando
/// su propio derivado del mismo objeto, pagando el doble y ocupando el doble.
/// Es el patrón que ya costó KRO-302.
void main() {
  group('la lista de anchos', () {
    test('es cerrada y ordenada', () {
      // Cerrada a propósito: con ancho libre, cualquiera fabrica miles de
      // objetos pidiendo `?w=101`, `?w=102`…
      expect(derivedWidths, [96, 240, 480, 960, 1600]);
    });
  });

  group('snapDerivedWidth', () {
    test('redondea HACIA ARRIBA, nunca hacia abajo', () {
      // Servir menos píxeles que la celda se ve borroso, y evitarlo es medio
      // motivo de que este sistema exista.
      expect(snapDerivedWidth(1), 96);
      expect(snapDerivedWidth(97), 240);
      expect(snapDerivedWidth(330), 480);
      expect(snapDerivedWidth(961), 1600);
    });

    test('un ancho exacto se queda como está', () {
      for (final w in derivedWidths) {
        expect(snapDerivedWidth(w), w, reason: 'con $w');
      }
    });

    test('un ancho desmedido se acota al mayor', () {
      // En vez de fabricar un objeto a medida para quien pida 9000.
      expect(snapDerivedWidth(9000), 1600);
    });

    test('lo que no es un ancho usable devuelve null', () {
      // `null` significa «no se pidió», y el host sirve el original. Inventar un
      // ancho por defecto serviría una imagen que nadie pidió.
      for (final v in [null, 0, -5, double.nan, double.infinity, 'ancho']) {
        expect(snapDerivedWidth(v), isNull, reason: 'con «$v»');
      }
    });

    test('un número en texto SÍ vale', () {
      // Llega por querystring, así que es texto por naturaleza.
      expect(snapDerivedWidth('480'), 480);
      expect(snapDerivedWidth('300'), 480);
    });
  });
}
