/// KRO-285 / KRO-295 — el PERFIL PÚBLICO de un creador. Espejo Dart de
/// `@kromia/core/publisher-profile.ts`.
///
/// La división que gobierna el tipo: los campos EDITABLES los escribe el
/// publisher desde Studio; los CALCULADOS los pone el servidor al leer y no se
/// aceptan al escribir — un número de seguidores que el propio publisher pudiera
/// fijar no es un dato, es un cartel.
library;

// ── Quién hay detrás ─────────────────────────────────────────────────────────

/// De qué está hecho el perfil que se está mirando.
///
/// Es una **discriminante, no un tipo distinto**: los tres comparten forma para
/// que el host pinte UNA sola pantalla.
///
/// - `publisher` — una organización; el perfil se ESCRIBE.
/// - `creator` — una persona sin publisher; el perfil se DERIVA de lo que ya se
///   sabe de ella, así que `canManage` es siempre `false` y la banda la neutra.
/// - `unknown` — ya no hay nadie detrás (cuenta dada de baja, álbum huérfano de
///   KRO-267). **No es un error** y no debe pintarse como tal: el álbum existe y
///   quien llegó siguió un enlace que en su día funcionaba.
const List<String> profileKinds = ['publisher', 'creator', 'unknown'];

/// A quién apunta un álbum. Lo resuelve el SERVIDOR y la app solo lo sigue.
///
/// Existe porque el álbum es el punto de entrada al perfil y hasta ahora no
/// llevaba encima nada con lo que enlazar: solo ids crudos.
class AlbumCreatorRef {
  final String kind;

  /// Con qué pedir el perfil completo — el `slug` de un publisher o el
  /// `username` de una persona. **Ausente si `kind` es `unknown`**: no hay
  /// perfil que pedir, y mandar a una petición que va a fallar es peor que
  /// decir desde el principio que no hay nadie.
  final String? ref;

  /// Lo justo para pintar la referencia sin una segunda petición.
  final String? displayName;
  final String? logoUrl;

  const AlbumCreatorRef({
    required this.kind,
    this.ref,
    this.displayName,
    this.logoUrl,
  });

  /// ¿Hay alguien detrás de este álbum?
  ///
  /// Un `kind` que no conozcamos se trata como desconocido: la pantalla del
  /// desconocido es la degradación segura, y seguir un `ref` de un tipo que la
  /// app no sabe abrir acabaría en una pantalla en blanco.
  bool get hayAlguien => (kind == 'publisher' || kind == 'creator') && (ref ?? '').trim().isNotEmpty;

  factory AlbumCreatorRef.fromJson(Map<String, dynamic> json) {
    final ref = json['ref']?.toString().trim();
    return AlbumCreatorRef(
      kind: json['kind']?.toString() ?? 'unknown',
      ref: (ref == null || ref.isEmpty) ? null : ref,
      displayName: _texto(json['displayName']),
      logoUrl: _texto(json['logoUrl']),
    );
  }
}

// ── Color de la banda ────────────────────────────────────────────────────────

/// Los colores que puede tener la banda de la cabecera.
///
/// **Conjunto CERRADO, no un hex libre.** Un selector de color arbitrario deja
/// elegir el gris del fondo o un fucsia que se pelea con todo, y el perfil deja
/// de parecer parte de Kromia.
///
/// `neutral` existe a propósito y es el DEFAULT: es la banda de quien no ha
/// elegido, y tiene que verse deliberada, no a medio hacer.
const List<String> profileBandColors = [
  'neutral', 'green', 'mint', 'peach', 'orange', 'gold', 'violet',
];

const String defaultBandColor = 'neutral';

/// El valor de marca de cada banda, y qué color de texto se lee encima.
///
/// Se guardan los MISMOS literales que la paleta del diseño para que web y app
/// pinten idéntico; aquí son strings y no `Color` a propósito — `core_dart` es
/// Dart puro, sin `dart:ui`, y el host convierte.
///
/// El `fg` va en el contrato y no lo decide cada host porque es lo que garantiza
/// que el nombre se LEA sobre su banda. Dejarlo al criterio de cada uno es cómo
/// aparece un texto blanco sobre oro.
const Map<String, BandColorValue> bandColorValues = {
  'neutral': BandColorValue(bg: '#F5F1E8', fg: '#1A2E1A'),
  'green': BandColorValue(bg: '#2D6B45', fg: '#FFFFFF'),
  'mint': BandColorValue(bg: '#B4DDD8', fg: '#1A2E1A'),
  'peach': BandColorValue(bg: '#F5DEC0', fg: '#B5651D'),
  'orange': BandColorValue(bg: '#E07B39', fg: '#FFFFFF'),
  'gold': BandColorValue(bg: '#F0B429', fg: '#1A2E1A'),
  'violet': BandColorValue(bg: '#6D4AA7', fg: '#FFFFFF'),
};

class BandColorValue {
  final String bg;
  final String fg;
  const BandColorValue({required this.bg, required this.fg});
}

bool isBandColor(Object? v) => v is String && profileBandColors.contains(v);

/// La banda de un perfil, cayendo a la neutra si el color no es del conjunto.
/// Un color inventado no puede dejar la cabecera sin pintar.
BandColorValue bandOf(String? color) =>
    bandColorValues[isBandColor(color) ? color : defaultBandColor]!;

// ── Límites ──────────────────────────────────────────────────────────────────

class _Limite {
  final int min;
  final int max;
  const _Limite({this.min = 0, required this.max});
}

class ProfileLimits {
  /// El nombre visible. Puede diferir del `name` interno del publisher.
  final _Limite displayName;

  /// El lema, de UNA línea. El tope corto es la forma de que lo sea: con 200
  /// caracteres deja de ser un lema y vuelve a ser la descripción, y entonces el
  /// diseño tiene dos párrafos donde quería un gancho.
  final _Limite tagline;
  final _Limite description;

  /// La ciudad. Texto libre a propósito: no hay catálogo de ciudades ni falta.
  final _Limite city;

  const ProfileLimits({
    required this.displayName,
    required this.tagline,
    required this.description,
    required this.city,
  });
}

const profileLimits = ProfileLimits(
  displayName: _Limite(min: 1, max: 60),
  tagline: _Limite(max: 80),
  description: _Limite(max: 600),
  city: _Limite(max: 60),
);

// ── El catálogo ──────────────────────────────────────────────────────────────

/// Una edición concreta dentro del catálogo del perfil.
///
/// `owned` es el distintivo «lo coleccionas» del diseño: lo resuelve el SERVIDOR
/// contra quien mira, porque el host no tiene con qué saberlo sin otra petición.
class ProfileAlbumEdition {
  final String id;
  final String edition;
  final String? albumType;
  final String? cover;
  final String? slug;
  final bool owned;

  const ProfileAlbumEdition({
    required this.id,
    required this.edition,
    this.albumType,
    this.cover,
    this.slug,
    this.owned = false,
  });

  factory ProfileAlbumEdition.fromJson(Map<String, dynamic> json) =>
      ProfileAlbumEdition(
        id: (json['_id'] ?? json['id'] ?? '').toString(),
        edition: json['edition']?.toString() ?? '',
        albumType: _texto(json['albumType']),
        cover: _texto(json['cover']),
        slug: _texto(json['slug']),
        owned: json['owned'] == true,
      );
}

/// Una obra y sus entregas. **Un álbum NO es una edición**: por eso las ediciones
/// cuelgan del nombre en vez de ser filas sueltas, y por eso `albumsCount` y
/// `editionsCount` son cifras distintas.
class ProfileAlbum {
  final String name;
  final List<ProfileAlbumEdition> editions;

  const ProfileAlbum({required this.name, this.editions = const []});

  factory ProfileAlbum.fromJson(Map<String, dynamic> json) => ProfileAlbum(
        name: json['name']?.toString() ?? '',
        editions: [
          for (final e in (json['editions'] as List? ?? const []))
            if (e is Map) ProfileAlbumEdition.fromJson(e.cast<String, dynamic>()),
        ],
      );
}

/// El catálogo agrupado por categoría, **ya ordenado por el servidor** para que
/// todos los hosts enseñen la misma lista.
///
/// `category: null` es el grupo de los que no tienen categoría, y va al FINAL: un
/// álbum publicado que no se ve porque nadie le puso etiqueta es peor que una
/// categoría fea.
class ProfileAlbumGroup {
  final String? category;
  final List<ProfileAlbum> albums;

  const ProfileAlbumGroup({this.category, this.albums = const []});

  factory ProfileAlbumGroup.fromJson(Map<String, dynamic> json) =>
      ProfileAlbumGroup(
        category: _texto(json['category']),
        albums: [
          for (final a in (json['albums'] as List? ?? const []))
            if (a is Map) ProfileAlbum.fromJson(a.cast<String, dynamic>()),
        ],
      );
}

// ── El tipo ──────────────────────────────────────────────────────────────────

/// El perfil tal y como lo devuelve el servidor: lo escrito + lo calculado.
///
/// Un `creator` (persona sin publisher) llega con la MISMA forma y los campos
/// derivados: `followersCount: 0` e `isFollowing: false` son valores de verdad,
/// no huecos — seguir es algo que se le hace a un publisher, y esa persona no
/// tiene ninguno, así que no hay comunidad a la que entrar.
class PublisherProfile {
  final String publisherId;
  final String slug;
  final String displayName;

  /// La key del logo en el bucket, NO una URL. La URL la construye el host con
  /// su proxy: el bucket es privado y su URL cruda da 403.
  final String? logoKey;

  /// La URL con la que se PINTA el logo, ya resuelta por el servidor.
  ///
  /// No es redundante con `logoKey`: la key es lo que se GUARDA y esta lo que se
  /// MUESTRA. Además cae al avatar del dueño cuando el publisher no tiene logo
  /// propio, así que construirla a partir de la key dejaría sin cara justo a
  /// quien no ha elegido ninguna.
  final String? logoUrl;
  final String? bandColor;
  final String? tagline;
  final String? description;
  final String? city;

  final int followersCount;

  /// Un álbum es una obra; sus ediciones son sus entregas. Son cifras DISTINTAS
  /// y las dos se enseñan.
  final int albumsCount;
  final int editionsCount;
  final String? joinedAt;

  /// Puede faltar —un publisher que no ha publicado nada— y eso NO es un error:
  /// es el perfil recién creado, que es un estado normal y frecuente.
  final String? lastPostAt;

  final String? kind;
  final bool isFollowing;
  final bool canManage;

  /// **Esta respuesta viene RECORTADA porque esa persona eligió no mostrarse.**
  ///
  /// No dice «cuál es su ajuste», dice «lo que estás leyendo está recortado»:
  /// quien se mira a sí mismo, o un admin, lo recibe en `false` y con los datos
  /// completos — pintarle «ha preferido no dar su nombre» a su propio dueño
  /// sonaría raro. Un publisher no tiene ajuste de privacidad: ahí siempre
  /// `false`.
  ///
  /// Existe porque sin él la app **no puede distinguir** un perfil privado de
  /// uno simplemente vacío: los dos llegan con el nombre de cuenta y sin
  /// descripción. Deducirlo sería decirle a alguien «ha preferido no dar su
  /// nombre» solo porque no ha rellenado su perfil.
  final bool isPrivate;

  /// Perfil a medio hacer. La calcula el SERVIDOR sobre lo que de verdad va a
  /// servir —que no es siempre lo guardado: un perfil en privado sale sin
  /// descripción—, así que se lee, no se recalcula.
  final bool isBare;

  /// Su catálogo, agrupado y ordenado. Ver [ProfileAlbumGroup].
  final List<ProfileAlbumGroup> albumGroups;

  const PublisherProfile({
    required this.publisherId,
    required this.slug,
    required this.displayName,
    this.logoKey,
    this.logoUrl,
    this.bandColor,
    this.tagline,
    this.description,
    this.city,
    this.followersCount = 0,
    this.albumsCount = 0,
    this.editionsCount = 0,
    this.joinedAt,
    this.lastPostAt,
    this.kind,
    this.isFollowing = false,
    this.canManage = false,
    this.isPrivate = false,
    this.isBare = false,
    this.albumGroups = const [],
  });

  /// Una persona a título personal: no hay comunidad a la que unirse.
  bool get esPersona => kind == 'creator';

  factory PublisherProfile.fromJson(Map<String, dynamic> json) => PublisherProfile(
        publisherId: (json['publisherId'] ?? json['_id'] ?? '').toString(),
        slug: json['slug']?.toString() ?? '',
        displayName: json['displayName']?.toString() ?? '',
        logoKey: _texto(json['logoKey']),
        logoUrl: _texto(json['logoUrl']),
        bandColor: _texto(json['bandColor']),
        tagline: _texto(json['tagline']),
        description: _texto(json['description']),
        city: _texto(json['city']),
        followersCount: _entero(json['followersCount']),
        albumsCount: _entero(json['albumsCount']),
        editionsCount: _entero(json['editionsCount']),
        joinedAt: _texto(json['joinedAt']),
        lastPostAt: _texto(json['lastPostAt']),
        kind: _texto(json['kind']),
        isFollowing: json['isFollowing'] == true,
        canManage: json['canManage'] == true,
        isPrivate: json['isPrivate'] == true,
        isBare: json['isBare'] == true,
        albumGroups: [
          for (final g in (json['albumGroups'] as List? ?? const []))
            if (g is Map) ProfileAlbumGroup.fromJson(g.cast<String, dynamic>()),
        ],
      );
}

// ── Validación ───────────────────────────────────────────────────────────────

class ProfileIssue {
  final String field;
  final String message;
  const ProfileIssue({required this.field, required this.message});
}

class ProfileValidationResult {
  final bool valid;
  final List<ProfileIssue> issues;
  const ProfileValidationResult({required this.valid, required this.issues});
}

/// Valida lo EDITABLE de un perfil. No mira los calculados a propósito: si
/// llegaran en el cuerpo de una escritura el backend los ignora — un cliente que
/// reenvíe el objeto que acaba de leer es un cliente razonable, y hacerle fallar
/// por eso solo obliga a limpiar a mano.
ProfileValidationResult validatePublisherProfile({
  String? displayName,
  String? tagline,
  String? description,
  String? city,
  Object? bandColor,
}) {
  final issues = <ProfileIssue>[];

  final nombre = (displayName ?? '').trim();
  if (nombre.length < profileLimits.displayName.min ||
      nombre.length > profileLimits.displayName.max) {
    issues.add(ProfileIssue(
      field: 'displayName',
      message: 'El nombre debe tener entre ${profileLimits.displayName.min} y '
          '${profileLimits.displayName.max} caracteres.',
    ));
  }

  void tope(String campo, String? valor, int max, String etiqueta) {
    if (valor != null && valor.trim().length > max) {
      issues.add(ProfileIssue(
        field: campo,
        message: '$etiqueta no puede superar $max caracteres.',
      ));
    }
  }

  tope('tagline', tagline, profileLimits.tagline.max, 'El lema');
  tope('description', description, profileLimits.description.max, 'La descripción');
  tope('city', city, profileLimits.city.max, 'La ciudad');

  if (bandColor != null && !isBandColor(bandColor)) {
    issues.add(ProfileIssue(
      field: 'bandColor',
      message: 'Color de banda no válido: $bandColor.',
    ));
  }

  return ProfileValidationResult(valid: issues.isEmpty, issues: issues);
}

/// ¿Está el perfil lo bastante hecho como para que merezca la pena abrirlo?
///
/// No es una validación: un perfil vacío es válido. Es la señal para sugerirle al
/// publisher que lo remate — y para no empujar a nadie a un perfil que no dice
/// nada de quién es.
bool profileIsBare({String? tagline, String? description, String? logoKey}) {
  bool vacio(String? v) => v == null || v.trim().isEmpty;
  return vacio(tagline) && vacio(description) && vacio(logoKey);
}

String? _texto(Object? v) {
  if (v == null) return null;
  final s = v.toString().trim();
  return s.isEmpty ? null : s;
}

int _entero(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
