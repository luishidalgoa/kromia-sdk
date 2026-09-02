# Changelog — SDK Kromia

Cambios destacables del **SDK** (`@kromia/core` + `@kromia/react` + `@kromia/mcp`).
Orientado al **consumer del paquete** (qué tipos/helpers/recetas/renderers/tools
cambian), NO un dump del git log.

**Eje de versión = `protocolVersion` del KRP** (== `@kromia/core.version`), que
`generate.ts` auto-bumpea SOLO en cambios de CONTRATO. Los cambios **DATA /
aditivos** (tipos nuevos, helpers, paquetes) **no bumpean** el `protocolVersion` →
se acumulan en `[Unreleased]` hasta el próximo bump de contrato o un corte de
release del SDK. La versión del SDK es independiente de la de las apps
(Studio/backend/Flutter). Los commits de `core_dart`/`flutter` (espejo Dart) son
paridad de otro chat → se resumen como nota, no se listan uno a uno.

> Histórico reconstruido desde 2026-06 (287 commits; límites de versión
> verificados leyendo el `protocolVersion` real del contrato en cada commit).
> Versiones `< 2.2.2` fuera de registro (previas a esta política).

## [Unreleased]
### Added
- `validadorCoincide(ifNoneMatch, etag)` — si el validador que trae el cliente corresponde a este ETag, con la letra pequeña que se olvida al reescribirla: varios separados por coma, el comodín `*`, el prefijo `W/` de los débiles y las comillas de la sintaxis. El backend la tenía desde KRO-346 y Studio **no la tenía en absoluto**, así que sellaba un año de `immutable` sin validador sobre claves que se sobreescriben: el publisher corregía el arte de una carta y seguía viendo el viejo, sin nada que pudiera hacer. Solo la DECISIÓN — calcular el ETag necesita `crypto` de Node y este paquete entra en el bundle del navegador, y escribir el 304 es de cada host (Express / `NextResponse`). NO bumpea el `protocolVersion` (KRO-410)
- `RarityBucket.highlight?: boolean` y `isHighlightRarity(raritySource, valor)` — qué rarezas declara el publisher como «momento». Va en el BUCKET y no en la carta: el publisher declara sus tres o cinco niveles una vez en vez de marcar quinientos cromos. El helper vive aquí porque casar el valor de una carta con su bucket **no es una comparación** (igualdad para `enum`, rango inclusivo para `rating`), y escrito en cada host un álbum por puntuación se celebraría en uno y en el otro no — la familia de KRO-302 y KRO-338. Opcional y ausente = `false`, así que ningún álbum existente cambia. NO bumpea el `protocolVersion` (KRO-349)
- `isResizableImage(key)` — qué objetos admiten un `?w=` y cuáles se sirven tal cual. El SVG queda fuera (es vectorial, ya escala solo, y rasterizarlo da un derivado 19-45× MÁS grande que el original) y el GIF también (se le come la animación). El backend la tenía escrita a mano y Studio no la tenía en absoluto, así que Studio metía los SVG por sharp: misma forma de divergencia que KRO-338 (KRO-343)
### Security
- `mediaCapability` deniega el namespace interno de derivados (`__raster/`) para **toda** acción y **todo el mundo**, admin incluido, y lo hace ANTES del override de admin — igual que `list` en la zona privada. La regla estaba escrita en los hosts, así que estaba en uno y no en el otro: el backend tenía su guard y Studio no, y por ahí se servían las miniaturas de los álbumes privados. En la autoridad, un host que se olvide de comprobarlo falla **cerrado**. Los dos hosts dejan además de reimplementar la regla de `__private/` y le preguntan a `mediaCapability`, que ya la aplicaba desde KRO-288 (KRO-338)


### Added
- `validateAttachmentUpload(kind, mime, size)` y `matchesMagicBytes(mime, head)` — las dos mitades de autorizar una subida de adjunto: una cree lo que declara el cliente (para no subir 60 MB y tirarlos), la otra comprueba el contenido real (sin ella, «solo PDF» es una sugerencia). Viven aquí porque basta con que **un** host sea más permisivo para que el objeto acabe en el bucket (KRO-272)
- `COMMUNITY_LIMITS.image` — tope propio de las imágenes (10 MB), muy por debajo del de los ficheros (KRO-272)
- Convención de keys de los medios de comunidad: `COMMUNITY_MEDIA_PREFIX`, `isCommunityMediaKey`, `channelIdFromCommunityKey`, `communityMediaKey`. El `channelId` va dentro de la ruta para que el permiso de lectura se resuelva sin buscar a qué publicación pertenece el objeto. **`community` queda reservado** como namespace de primer nivel del bucket (KRO-272)

Nada de esto toca un registry: el `protocolVersion` no se mueve.

_Cambios DATA / render-only (NO bumpean el `protocolVersion`)._

### Added
- **El CI corre por fin los tests del TypeScript canónico** (KRO-299). El drift-CI vigilaba el espejo Dart en cada push y **no miraba el original** — el TS del que dependen Studio, el backend y, por espejo, la app. Su único gate era un hook local que además había que instalar a mano con un comando que **no existía**: en un checkout limpio, incluidas las copias del submódulo dentro de los otros repos, el ratchet del contrato estaba inerte. Ahora el CI corre los 1231 tests (entre ellos el que garantiza que el KRP commiteado es el que producen los registries) y `pnpm run hooks:install` existe de verdad, además de instalarse solo con `pnpm install`
- **`auto_compose` del MCP dice qué campos DESCARTÓ** (KRO-156). Salió usándolo de verdad: con cinco campos colocó tres, devolvió `valid:true`, y uno de los descartados era la **rareza** — la que gobierna los efectos. No era un fallo del validador: una composición sin un campo es perfectamente válida. El problema era que el agente no tenía forma de enterarse. Ahora la respuesta trae `sinColocar` y una nota con qué hacer. Y la descripción de `list_behaviors` deja de sugerir «enum» como tipo base —no lo es, es un behavior— porque filtrar por él devuelve vacío y parece que no hay behaviors para opciones predefinidas
- **`PublisherProfile.isPrivate`** (KRO-295): dice que la respuesta viene **RECORTADA** porque esa persona eligió no mostrarse — no cuál es su ajuste. Quien se mira a sí mismo, o un admin, lo recibe en `false` y con los datos completos. Hacía falta porque sin él un host **no puede distinguir** un perfil privado de uno simplemente vacío: los dos llegan con el nombre de cuenta y sin descripción, así que deducirlo por heurística sería decirle a alguien «ha preferido no dar su nombre» solo porque no ha rellenado su perfil. Lo pidió el chat de Mobile al implementar la variante, y con razón: se negó a inferirlo antes que afirmar de una persona algo que puede ser falso
- **El MCP (`@kromia/mcp`) ve por fin el resto del modelo** (KRO-156). Llevaba cerrado desde el 2026-07-04 y desde entonces el grueso de lo construido fueron EFECTOS —el KRP pasó de 5.1 a 5.9—, así que un agente no podía ni nombrarlos: inventaba ids y parámetros. Cinco tools nuevas: `list_behaviors` (los 27 behaviors, que `auto_compose` y `validate_composition` YA pedían en sus campos sin que ninguna tool dijera cuáles existen), `list_effects` + `describe(category:"visual-effect")` (los 7 efectos con sus parámetros reales — `iridescent_foil` tiene 31 — y sus presets de fábrica), `validate_tag_styles` (el mismo bucle propón→valida→corrige que ya existía para el layout, ahora para los efectos), `validate_album_data` (valida las CARTAS y no solo cómo se ven: una composición puede estar perfecta y las 200 cartas llevar el año como texto) y `validate_rarity_source` (la rareza, que es lo que decide qué cartas brillan y cómo se llenan los sobres). Además, **al fallar ahora dicen qué ids son válidos**: un `[]` mudo ante una receta inexistente hacía creer al agente que esa receta no tenía plantillas, y se ponía a construir el layout a mano. De 11 tools a 16
- **Quién hay DETRÁS de un perfil** (KRO-295): `PROFILE_KINDS` (`publisher` · `creator` · `unknown`) y `AlbumCreatorRef`. Es una **discriminante, no un tipo aparte**: los tres comparten forma para que el host pinte UNA sola pantalla, y lo que cambia no es el diseño sino de dónde sale el dato y quién manda — un `creator` se DERIVA de lo que ya se sabe de la persona (sin nada que configurar, `canManage` siempre `false`, banda neutra) y un `unknown` es el álbum que se quedó huérfano al darse de baja su creador. **`unknown` NO es un error** y el host no debe pintarlo como tal: el álbum existe y quien llegó siguió un enlace que funcionaba. `AlbumCreatorRef` es lo que el álbum lleva encima para poder enlazar a su creador — hasta ahora solo llevaba ids crudos, así que la referencia dentro del álbum no se podía pintar sin adivinar; y si no hay nadie detrás **no trae `ref`**, porque mandar al host a una petición que va a fallar es peor que decírselo desde el principio
- **Adjuntos de publicación como unión discriminada** (KRO-272): `PostAttachment` pasa de un objeto plano solo-imagen a una **unión por `kind`** — `image` · `file` (whitelist estricta: solo PDF, tope 60 MB en `COMMUNITY_LIMITS.file`) · `album-ref` (referencia a un álbum, **solo el id**: el preview se resuelve al leer, así no miente si el álbum se renombra) · `link` (solo http/https; `javascript:` y `data:` se rechazan — en un href son XSS). Nuevos helpers `linkDomain` (dominio legible SIN que el servidor visite la URL, que es lo que evita el SSRF), `isKnownAttachment`, `knownAttachments` y `hasUnknownAttachments`. **Tolerancia hacia adelante**: un `kind` desconocido NO invalida la publicación al leer —un cliente viejo ignora el adjunto en vez de dar por rota la publicación entera— pero la puerta de entrada del backend sí lo rechaza con `hasUnknownAttachments`. Diseñado para que añadir `card-ref` mañana sea aditivo.
- **El PERFIL PÚBLICO de un publisher** (KRO-285). Tipo `PublisherProfile` + `validatePublisherProfile` + `profileIsBare`. Hasta aquí un publisher no tenía identidad propia: su modelo era `slug` + `name` + `ownerId` y la cara que se veía era el avatar de la persona dueña de la cuenta. Ahora tiene nombre visible, logo, color de banda, lema, descripción y ciudad. **Los campos se parten en dos y esa división gobierna el tipo**: los EDITABLES los escribe el publisher, los CALCULADOS los pone el servidor al leer y no se aceptan al escribir — un número de seguidores que el propio publisher pudiera fijar no es un dato, es un cartel. El **color de banda es un conjunto CERRADO** (`PROFILE_BAND_COLORS`) y no un hex libre: un selector arbitrario deja elegir el gris del fondo o un fucsia que se pelea con todo, y el perfil deja de parecer parte de Kromia; `BAND_COLOR_VALUES` lleva además el color de TEXTO de cada banda, porque dejarlo al criterio de cada host es cómo aparece un blanco sobre oro. El `logoKey` es la key del bucket y **no una URL**: el bucket es privado y la URL la construye cada host con su proxy. **Un perfil vacío es VÁLIDO** —es el estado de todo publisher recién dado de alta— y para eso está `profileIsBare`, que es una señal y no una validación
- **Los avatares se pueden VER, no solo el tuyo** (KRO-288). `mediaCapability` limitaba la LECTURA de `__private/avatars/` a su dueño, y el efecto era que cada usuario veía su propia cara y la de nadie más: el avatar sale junto al nombre en el ranking del álbum, en descubrir creadores, en los seguidores, en los asistentes de una quedada y en el autor de cada publicación y respuesta — todo eso caía a iniciales por un 403. La confusión estaba en haber cumplido «que la carpeta no se fisgue» prohibiendo **leer**, cuando lo que hacía falta era prohibir **listar**. Ahora: listar sigue denegado para todos (eso es lo que la hace privada), leer un avatar concreto lo puede cualquiera **identificado** (hace falta saber el nombre exacto, que ya se conoce porque viene en la publicación o el asistente que miras), y escribir o borrar siguen siendo solo del dueño — que tu cara la vea cualquiera no significa que cualquiera pueda cambiarla. El resto de `__private/` no se abre
- **Se RETIRA la visibilidad por canal** (decisión del user, 2026-07-29). `CHANNEL_VISIBILITIES` y `Channel.visibility` quedan **`@deprecated`**: ya no se elige entre pública, coleccionistas y seguidores — a una comunidad se entra siguiendo al publisher, y esa es la única regla. Nuevo helper `canSeeCommunity({isTeam, isFollower})`, que es donde vive ahora la decisión para que backend, Studio y la app no puedan discrepar. De las tres opciones que había, **`collectors` nunca hizo nada distinto de `followers`** —la interfaz prometía «solo quien tenga cromos de este publisher» y en realidad bastaba con seguir— y `public` abría el muro a cualquiera con cuenta: una regla clara vale más que tres, una de ellas mintiendo. El campo **se conserva en los datos** en vez de borrarse del contrato: eliminarlo obligaría a un bump de protocolo y a que la app re-espeje el modelo para no ganar nada visible. Ningún host debe leerlo ya para decidir accesos. **Excepción explícita**: el mapa de quedadas y el detalle de una quedada NO aplican esta regla — enseñan quedadas de comunidades que no sigues porque ahí está el descubrimiento; lo que exige ser de la comunidad es participar (KRO-289)
- **HILOS: respuestas dentro de una publicación** (KRO-282). `Post.parentId` opcional —presente = es una respuesta— y `Post.repliesClosed` para cerrar una conversación concreta sin borrar lo dicho. Nuevos `isReply`, `replyBlock` y `validateReply`. Tres decisiones que van en el contrato porque los tres hosts tienen que aplicarlas igual: **un solo nivel** (el padre nunca puede ser a su vez una respuesta — los árboles anidados se leen fatal en móvil), **respuestas sin adjuntos** (la unión por `kind` ya existía y saldría gratis, pero dejar que cualquiera suba una imagen a un muro ajeno es justo lo que obliga a moderar en serio), y **tope propio más corto** (`COMMUNITY_LIMITS.replyBody`, 1000 frente a 2000: un post es un anuncio y una respuesta es un comentario). Nuevo interruptor `Channel.repliesEnabled` que, **al revés que `reactionsEnabled` y `notifyFollowers`, ausente significa NO**: esos dos describen comportamiento que los canales ya tenían, y responder es la primera capacidad que deja escribir a alguien distinto del publisher — encenderla sola convertiría todos los muros existentes en superficie de escritura sin que su dueño lo decidiera. `replyBlock` devuelve el MOTIVO (`channel-off` · `thread-closed` · `parent-deleted` · `nested`) en vez de un booleano, porque un botón que no está y no explica por qué se lee como una avería
- **El COMUNICADO de una quedada** (KRO-283): tipo `MeetupUpdate` + `validateMeetupUpdate`. No es lo mismo que el aviso que se manda al cambiar la hora: un **aviso** llega, se lee y desaparece; un **comunicado se queda publicado**. La diferencia importa en el caso real — quien se apunta el jueves a una quedada que cambió de sitio el martes no se entera con un aviso, pero sí lo lee al abrir la quedada. Lo escribe SOLO quien organiza, así que no abre la superficie de escritura ni arrastra la moderación que exigirán los hilos
- **QUEDADAS: el modelo de un evento de comunidad** (KRO-277, Epic KRO-276). Tipos `Meetup`, `MeetupPlace`, `MeetupRsvp` y `MeetupCheckin`, con `validateMeetup` y los límites en `MEETUP_LIMITS`. Tres decisiones quedan fijadas en el contrato para que los tres hosts no puedan divergir: (1) el sitio de una quedada exige **coordenadas** —al revés que el adjunto de ubicación suelto, que admite solo el nombre—, porque sin ellas no hay radio de fichaje ni punto en el mapa; (2) el **aforo es opcional**, y `spotsLeft` devuelve `null` cuando no lo hay, que no es lo mismo que cero —confundirlos pintaría como llena una quedada sin límite—; (3) el fichaje guarda **cómo** se hizo (`geo` o lista del anfitrión), porque la ubicación que manda un móvil no es de fiar y algún día habrá que decidir a cuál creerle. Helpers puros compartidos: `withinCheckinRadius` (500 m), `checkinWindow` (abre una hora antes, cierra al terminar), `meetupIsOpen`, `distanceMeters` y `isFull`. Se comparten a propósito: el backend DECIDE con ellos y la app pinta el botón con ellos, así que la interfaz nunca ofrece un fichaje que el servidor vaya a rechazar
- **La UBICACIÓN como adjunto de publicación** (KRO-274): `PostLocationAttachment` (`kind: 'location'`) con nombre obligatorio, dirección opcional y `lat`/`lng` **siempre en pareja** — media coordenada no sitúa nada, así que o van las dos o no va ninguna. Límites en `COMMUNITY_LIMITS.location` (nombre 80, dirección 200): es una tarjeta, no una descripción. Helper `mapLinkFor(location)` = a dónde lleva tocarla, y **siempre devuelve una URL `https://`**, que es la única que abre en las tres plataformas: un esquema `geo:` solo existe en Android y en iOS o en la web de escritorio deja el enlace muerto. Con coordenadas busca por `lat,lng` (la chincheta cae en el punto exacto; buscar por el nombre puede acabar en otra ciudad) y sin ellas, por nombre y dirección. Devuelve `null` cuando no hay nada que abrir, para que el host no pinte un enlace muerto.
- **Tope de publicaciones fijadas por canal** (KRO-265): `COMMUNITY_LIMITS.pinnedPerChannel` (3) + helper `canPinAnother`. Ante un contador corrupto deja fijar en vez de bloquear al publisher.
- **Comunidad del publisher — modelo de canales y posts** (KRO-265 / Epic KRO-209): tipos `Channel` (canal de un publisher: `kind` announcements/discussion/events · `visibility` public/collectors/followers · archivado · soft-delete) y `Post` (markdown + adjuntos de imagen + reacciones + edición `editedAt/editedBy` + soft-delete `deletedAt/deletedBy`). Set cerrado `POST_REACTION_EMOJIS` y helpers puros cross-host: `isValidReactionEmoji`, `reactionCount`, `hasReacted`, `channelSlugify`, `isDeleted`, `isEdited`. DATA social (ajena al render de cartas) → no toca el KRP. Espejo `core_dart` pendiente (handoff Mobile).

## [5.9.0] - 2026-07-18

_Bump MINOR del KRP (auto-detectado): degradado multibanda del marco en `iridescent_foil`._

### Added
- **Degradado MULTIBANDA del marco** (KRO-264, del análisis del user contra el foil físico — ~15 bandas estrechas de anchos irregulares con casi-blancos intercalados): `border_gradient_hex` acepta **2–16 colores** con **peso opcional** `#RRGGBB@1.4` (ancho relativo de su banda) + param nuevo **`border_gradient_cycle`** (6–100, default 45 = % del cuadro por ciclo → frecuencia de repetición). Recetas: `parseFoilGradientSpec` (el clásico `parseFoilPatternHex` sigue para `pattern_hex`), `foilGradientPositions` (layout ponderado, fuente única), `foilWeightedGradientCss` (host web), `isMultibandGradient` (retro-compat: 2–4 sin pesos ni ciclo = camino clásico byte a byte) y `FOIL_GRADIENT_SPEC` (límites). `FoilBorderFill.custom-gradient` gana `stops` (color+peso; `colors` se conserva).

## [5.8.0] - 2026-07-12

_Bump MINOR del KRP (auto-detectado): diseño de borde personalizado en `iridescent_foil`._

### Added
- **Diseño de borde PERSONALIZADO** (`border_style: 'custom'` + `border_custom_url`): el creador sube su propio troquel (imagen blanco = diseño, por LUMINANCIA — mismo contrato visual que los borderSVG de fábrica) y este se rellena/brilla/margina como los 9 diseños del catálogo. Con diseño custom, `border_fill`/`border_width` se ocultan (la forma ya viene dibujada); tintes/degradado/textura, `border_sheen` y el canto siguen aplicando. Separa por capas la FORMA del RELLENO del marco (KRO-259).

### Added (render-only, arrastrado de la ronda QA de KRO-256)
- **`FOIL_BORDER_EDGE`** (canto del marco): contorno fino oscuro alrededor de la silueta del marco (exterior + ventana) — el marco se lee como pieza en vez de fundirse con la carta.
- **Banda especular del `border_sheen` AFILADA**: stops re-perfilados a 0/0@42/1.0@50/0@58/0 (una banda ancha y tenue leía como "lavado", no como metal).

## [5.7.0] - 2026-07-12

_Bump MINOR del KRP (auto-detectado): 3 params aditivos en `iridescent_foil` —
"vida" del efecto (feedback QA de la carta Zapdos vs la física)._

### Added
- **Movimiento a elección del diseñador** (`motion`): `auto` (clásico: vaivén en rejilla, sigue la inclinación en focus) | `deriva` (las bandas barren la carta en continuo) | `tono` (el matiz cicla en sitio — la "rotación" del iridiscente) | `total` (ambos). La velocidad la gobierna el `shimmer` existente. Receta `FOIL_MOTION_TIMING` + helpers `foilMotionFlags`/`foilMotionSweepSec`/`foilMotionHueSec` (KRO-256).
- **Destellos de la máscara** (`mask_sparkle`: `no`|`pastel`|`vivo`): campo multicolor de grano fino tras la máscara cuyo matiz cicla en continuo → cada perforación muestra SU color, distinto del vecino, rotando (look "cosmos"; con paleta 'Ninguna' los orificios dejan de ser solo blancos). Receta `FOIL_MASK_SPARKLE` (KRO-256).
- **Brillo del marco** (`border_sheen`: `no`|`metalico`|`iridiscente`): banda especular que barre el marco en continuo como capa aparte encima del fill — el "borde metálico por capas" de las cartas físicas. Receta `FOIL_BORDER_SHEEN` + `foilBorderSheenCss()` (KRO-256).

_Arrastra lo acumulado en Unreleased (KRO-250):_
- **Capa PROCEDURAL iridiscente en la pila unificada** (`EffectLayer.kind: 'iridescent'` + `EffectLayer.config`): una capa del `custom_foil` puede ser el motor del iridiscente completo (paleta, warp, máscara, marco…) en vez de una textura importada — el panel de capas unifica ambos mundos. `textureUrl` pasa a opcional (obligatoria solo en kinds de textura); `IRIDESCENT_LAYER_KIND` + `isIridescentLayer`; `isEffectLayerKind` acepta el kind nuevo; `validateTagStyles` valida el config de la capa contra el catálogo y no exige textura a las procedurales. El efecto `iridescent_foil` clásico ≡ pila de 1 capa (retro-compat, nada migra) (KRO-250).

## [5.6.0] - 2026-07-11

_Bump MINOR del KRP (auto-detectado): fill libre del marco en `iridescent_foil`._

### Added
- **Marco con FILL LIBRE** (`iridescent_foil`): `border_color` gana las paletas restantes del foil como gradientes fijos (`oilslick`/`sunset`/`mint`/`midnight`; `spectrum` conserva "sigue al foil") + `border_gradient_hex` (degradado propio de 2–4 hex, ciclo 45% como `pattern_hex`) + `border_texture_url` (textura importada — metal cepillado, papel, damasco… — que MANDA sobre los tintes). El marco tiene ya la misma libertad que el foil (KRO-249).
- **`resolveFoilBorderFill(config)`** + tipo `FoilBorderFill` (receta render-only): resolver PURO de la precedencia del fill del marco (textura > hex sólido > degradado custom > enum) — antes vivía inline en el render de Studio (drift). Ambos hosts lo consumen (KRO-249).

## [5.5.0] - 2026-07-11

_Bump MINOR del KRP (auto-detectado): 3 params aditivos en `iridescent_foil`._

### Added
- **`iridescent_foil` gana MÁSCARA importable**: `mask_url` (imagen en grises interpretada por **LUMINANCIA** — blanco = el foil asoma) + `mask_layout` (`cover` clásico | **`tile`** = la máscara TESELA el cuadro) + `mask_scale` (% del ancho por tesela, 5–100=25). Recorta las capas foil+sheen (glare/grano/borde no). Con una tesela de puntos → el fondo "papel perforado"/cosmos-holo de las cartas premium físicas (KRO-248).
- **Layout de máscara compartido** en la receta (`custom-foil-recipe.ts`): `FOIL_MASK_LAYOUTS` + `FOIL_MASK_TILE` + `foilMaskLayout(layout, scalePct)` — fuente única para el iridiscente Y el custom_foil. `EffectLayer` gana `maskLayout?`/`maskScale?` (tipo nuevo `EffectMaskLayout`; DATA, ausente = `cover` retro-compat) (KRO-248).

## [5.4.0] - 2026-07-11

_Bump MINOR del KRP (auto-detectado): option aditiva en `iridescent_foil`.
Arrastra lo acumulado en Unreleased (recetas render-only del custom foil y del
warp orgánico, 2026-07-10 → 2026-07-11)._

### Added
- **`iridescent_foil` gana la paleta `none` ("Ninguna")**: lámina NEUTRA sin gradiente de color — quedan el reflejo blanco diagonal (receta nueva `FOIL_NEUTRAL_SHEEN` + `foilNeutralSheenCss` + id reservado `FOIL_PATTERN_NONE`), resplandor, grano y marco. Base para combinar el brillo del iridiscente con capas importadas (`custom_foil`) sin teñirlas de arcoíris. Los params que solo parametrizan el gradiente (angle/hue/opacity/brightness/contrast/scale/blend/geometry/warp) se ocultan en el editor con `none` (`visibleWhen`, editor-only). Aditivo: default sigue `spectrum`, los álbumes existentes no cambian (KRO-247).
- **Receta DATA del render del foil PERSONALIZADO** (`custom-foil-recipe.ts`): las reglas de compositing de la pila de capas del `custom_foil` (textura + máscara + fusión + intensidad) dejan de vivir hardcodeadas en Studio (`FoilLayer.tsx`) y pasan a `@kromia/core` como fuente única cross-platform — `EFFECT_LAYER_KINDS`, `EFFECT_BLEND_MODES` (+ `isEffectBlendMode`/`isEffectLayerKind`), `CUSTOM_FOIL_LAYER_DEFAULTS`, `foilLayerOpacity`, `foilTextureLayout`, `CUSTOM_FOIL_MASK` (máscara por LUMINANCIA), `CUSTOM_FOIL_TILT`, `CUSTOM_FOIL_SHIMMER`, `EFFECT_BLEND_TO_FLUTTER` (mapeo fusión→`BlendMode` de Flutter). Flutter lo espeja para reactivar el custom foil sin lavado. Spec: `docs/custom-foil-render-spec.md` (KRO-122).
- **Receta DATA de la geometría orgánica + orientación del foil iridiscente** (`FOIL_ORGANIC_WARP` + `foilWarpDisplacement` + `foilEffectiveAngle`/`foilPatternBaseAngle`): parámetros del ruido fractal del warp orgánico y ángulo efectivo de las bandas, antes hardcodeados en el render de Studio. Render-only, fuente única cross-platform. Spec: `docs/iridescent-foil-render-spec.md` (KRO-244).

### Changed
- **Detector de bump (`version-bump.ts`)**: AMPLIAR las `options` de un param de efecto (superset — solo añade, nada eliminado) ahora clasifica como **minor** (aditivo: el cliente viejo cae al default/fallback), no major. Eliminar/sustituir options sigue siendo major (KRO-247).
- `visibleWhen` (editor-only) admite ARRAY de condiciones (AND) — p.ej. `warp` exige `geometry='organico'` Y `pattern≠'none'` (KRO-247).

## [5.3.0] - 2026-07-10

_Bump MINOR del KRP (auto-detectado): params aditivos en `iridescent_foil`._

### Added
- **`iridescent_foil` gana `pattern_hex` (paleta personalizada: 2–4 hex `#RRGGBB`) + `angle` (orientación 0–360°)**: el creador puede definir su propia paleta del tornasol y girar las bandas, sin efecto nuevo ni migración (defaults = comportamiento previo; los álbumes existentes no cambian). Helpers `parseFoilPatternHex` + `foilCustomPatternCss` (KRO-244).

## [5.2.0] - 2026-07-10

_Bump MINOR del KRP (auto-detectado): params aditivos en `iridescent_foil`.
Arrastra además lo acumulado en Unreleased desde 5.1.0 (tipos DATA / helpers /
paquete nuevo, 2026-06-29 → 2026-07-10)._

### Added
- **`iridescent_foil` gana `geometry` (`bandas`|`organico`) + `warp` (0–100)**: difracción CURVADA orgánica tipo lámina holográfica real (ref. ticket ISKRA) como evolución del efecto existente — sin efecto nuevo ni migración; default `bandas` = los álbumes existentes no cambian (KRO-244).
- **Tintes del marco ornamental centralizados** (`FOIL_BORDER_SOLID` + `FOIL_CARD_BG` + `foilCardBgCss`) y **re-diferenciados**: los 4 degradados oscuros "fondo carta" (bosque/obsidiana/ciruela/acero) eran casi-negros idénticos y el plateado se confundía con el blanco; ahora cada uno lleva su matiz reconocible. Data cross-platform — Flutter espeja estos hex (KRO-244 QA).
- **`borderSVG`** movido a `@kromia/core` (antes vivía en Studio): generador SVG paramétrico de los 9 marcos ornamentales de carta (`border_style`/`border_fill`/ancho/margen/radio), blanco-sobre-transparente para usar como máscara/relleno teñido. Render-only, TS puro, fuente única cross-platform (Flutter lo espeja en `core_dart`) (KRO-224).
- **`resolveCardEffects`** (resolución PURA tag→efecto) + **receta DATA del foil iridiscente** (`FOIL_PATTERNS` = los 6 patterns como stops estructurados, `foilPatternCss` builder web, `holographicOpacity`) movidos a `@kromia/core`: la lógica de resolución y el COLOR del foil dejan de vivir solo en Studio (era el drift de KRO-224 — se copiaban a Flutter a mano). Fuente única cross-platform; Flutter los espeja (KRO-224).
- Nuevo paquete **`@kromia/mcp`**: servidor MCP de Kromia — catálogo + validación del contrato (F1), tools de construcción `auto_compose`/`apply_template`/`get_template` (F2), `apply_composition` con dry-run por defecto (F3) y transporte remoto Streamable HTTP (F4) (KRO-156).
- Tronco de **cartas físicas**: `CardIdentity`/`CardOwnership`/`TransferToken`/`CardQrPayload` + helper `ownershipBadge` (KRO-215).
- **QR firmado** de carta física: contrato del payload + verificación pública offline ECDSA P-256 (KRO-16).
- Tipo **`CardTransferBundle`**: envoltorio de transferencia A→B por un solo escaneo (KRO-16).
- Modelo del **reverso** de carta: `CardBackComposition` + `resolveCardBack` (KRO-227).
- Entidad **`Tirada`** + `TiradaStatus` + helper `composeTirada` (composición por sobres ponderada por rareza) (KRO-216).
- **Siluetas de carta** `CardFormat.shape`: `shape:'custom'` + `shapePath` + `validateShapePath` (gramática M/L/C/Q/Z), `shapeScale`, catálogo `standard`+`custom` (KRO-230/232).
- Tipos `PrintProviderProfile` + helper `matchProviderToTirada` (directorio de proveedores; fase inerte) (KRO-233).
- Tipo **`Favorite`** + helper `favoriteKey` (KRO-129).

### Fixed
- `validateShapePath` admite triángulos (2 segmentos + cierre Z) (KRO-230).

### Notes
- Paridad Dart (`core_dart`) al día para todo el bloque (cartas físicas, `CardBack`, QR firmado, `CardTransferBundle`, siluetas, `Favorite`) — la lleva el chat de Flutter.
- Research de imprenta + plantillas de contacto (docs, no contrato) (KRO-216).

## [5.1.0] - 2026-06-26
### Added
- Color de borde personalizado del marco iridiscente: `border_color_hex` (KRO-202).

## [5.0.0] - 2026-06-26
### Added
- Patrón `midnight` del `iridescent_foil` + colores de borde "fondo de carta" (KRO-202).

## [4.3.0] - 2026-06-26
### Added
- Parámetro `border_margin` del marco iridiscente (KRO-202).

## [4.2.0] - 2026-06-26
### Added
- Marco ornamental del `iridescent_foil`: `border_style` + `border_fill` (KRO-202).

## [4.1.0] - 2026-06-26
### Added
- Efecto de catálogo **`iridescent_foil`** parametrizable + `EffectTemplate` con validadores (KRO-202).
- Redondeado de carta `CardFormat.cornerRadius` (en %, consistente entre tamaños) (KRO-225).

## [4.0.0] - 2026-06-24
_MAJOR: renombrado del catálogo de componentes (nombres/descripciones genéricos + reorganización de categorías)._
### Changed
- Componentes: nombres y descripciones genéricos + reorganización de categorías (KRO-198).
### Added
- Disposición de chips en rejilla 2D: `chipGrid` + `chipPlacements` + `chipWidth` (`fill`/`content`) + "Mostrar como" (text/badge) por chip (KRO-198/220).
- Apariencia **por-field** en slots componibles (`fieldAppearances`): tipografía/fondo/recorte/caja completos (KRO-198/221).
- Estilos de acento (`accentStyle`): `bar`/`rounded`/`glow`/`gradient`/`ambient` (KRO-198/219).
- Catálogo de tipografías (`font`) ampliado a 11 familias (KRO-198/218).
- "Estilo por valor" v2 (`conditionalStyle`): target por chip + cláusula `otherwise` (KRO-198).
- `GridPlacement.minHeight`, componente `chips_row`, `labelForField`, `ContainerSurface.textColor` (cascada), `PALETTE_NEUTRALS`, `cornerRadii`, padding por lado, `screenBgHex`, `THEME_PRESETS` (KRO-198).
### Fixed
- El detalle llena la altura de pantalla (content-start); el render honra la apariencia por-chip/por-field en todas las ramas; `sans`→`font-sans`, alineación de chips vía `justify-content` (KRO-198).
### Notes
- Paridad Dart del bloque KRO-198 trackeada como Drift Sync KRO-218/219/220/221.

## [3.4.0] - 2026-06-23
### Added
- Componente "Fila de chips" (`chips_row`) — primera versión (KRO-198).

## [3.3.0] - 2026-06-19
### Added
- Contrato de **CONTAINER** (surface + track sizing) volcado al `.json` del KRP (anti-drift) (KRO-133).
- `ImageTransform` + `CalibrationState`: calibración de imágenes por carta; `imageTransform` en el render + `slotImageTransform` (KRO-33).

## [3.2.0] - 2026-06-19
### Added
- Contrato de **APPEARANCE** volcado al `.json` del KRP (anti-drift) (KRO-133).

## [3.1.0] - 2026-06-15
### Added
- Motor de árbol de **LAYOUT** + `LayoutRenderer` genérico: grid 2D con placement (celdas + spans), self-align, track sizing, posición absoluta, `overlap`, altura mínima, contenedores renombrables (KRO-133).
- Nodo `component` + catálogo de **componentes prefabricados**: `hero_header`, `stats_row`, `badge_row`, `section_title`, carruseles, `feature_card`/`split_panel`/`stat_tile`/`cover_band` + config genérico + divider (KRO-133/155).
- `recipeToComposition`, `TargetComposition` editable, `LayoutComponentNode.hidden`; `CardRefResolver` (mini-cartas con apariencia real + `refSize`); `layoutTemplatesFor`/`applyLayoutTemplate` (KRO-133/178).
- `SECTION_ICONS` + `suggestSectionIcon` (+24 iconos, glifos SVG inline) (KRO-189).
- Tipografía rica + caja/efectos por slot (`textShadow`, scrim), decoración de contenedor (borde atómico/multi-lado, radio por esquina), paleta amplia, `font` como prop (KRO-147/155/162/169).
- Validadores de layout (`validateComposition` del layout, geometría canónica + solapes, `pruneLayoutSlots`, ratchet de conformidad, `parseInlineMarkdown`) + render por behavior en el motor + galería con zoom (KRO-131/133/164/165/166/167).
### Changed
- Detalle de carta unificado (Ficha/Perfil) block-native, con fidelidad estructural revisada (KRO-133).
### Notes
- Paridad Dart a 3.1.0 (capas 3D/foil, layout-conformance, markdown, iconos, grid 2D) + motor de render `kromia_flutter`; drift-CI TS↔Dart = fallo DURO (KRO-133/83/78/64).

## [3.0.0] - 2026-06-10
_MAJOR: eliminación de la receta "Ficha" (`detail_panel`)._
### Removed
- Receta "Ficha" (`detail_panel`) — sustituida por el detalle unificado por bloques (KRO-133).
### Added
- Componentes `badge_row` + `section_title` (KRO-155).
### Fixed
- La raya de acento ya no se tapa; Editorial/Momento sin border/rounded en el wrapper (KRO-133).

## [2.8.0] - 2026-06-10
### Added
- Nodo `component` + catálogo de componentes prefabricados (KRO-133 Capa 2); `hero_header` + preset híbrido, carruseles + categoría, `stats_row` (KRO-133).
### Fixed
- Fidelidad fina del detalle por bloques (acento, divisores, body sin truncar) (KRO-133).

## [2.7.0] - 2026-06-09
### Added
- Plantillas de detalle block-native: **Ficha** + **Perfil** (KRO-133).

## [2.6.0] - 2026-06-08
### Added
- 4 recetas "block-native": `feature_card`/`split_panel`/`stat_tile`/`cover_band` (KRO-133).

## [2.5.0] - 2026-06-05
### Added
- Capa pura de ruta/slug de medios por-álbum + cuota; `DRAFT_MEDIA_SLUG` (KRO-132).
- Contrato de capas de profundidad (parallax) por carta (KRO-130).
- `mediaCapability`: autoridad pura de acceso a medios (KRO-101).
### Fixed
- `auto-detail` recipe-aware (mapea a los slots reales del `targetRecipe`); `albumMediaNamespace` preserva el case (KRO-130).
### Notes
- Paridad Dart 2.5.0 (rareza KRO-28 + media-path KRO-132).

## [2.4.0] - 2026-06-04
### Added
- Contrato de **foil** importable: `EffectLayer`/`CardEffect3D` + `TagStyle.customLayers`; `custom_foil` validando capas (KRO-122).
- Insignia con imagen propia + separación ajustable (KRO-123); combinar varios efectos sobre un valor (KRO-127); `TagStyle.fieldKey` (anclar efecto a campo) (KRO-120).
- Render de markdown inline en `body`; validador avisa de slot obligatorio vacío; renderers honran `disabled`.
### Fixed
- Foil personalizado incompleto = warn, no error (KRO-123).

## [2.3.0] - 2026-06-02
### Added
- Contrato SDK de **efectos visuales por valor de tag** (KRO-30) y de **fuente de rareza** (KRO-28, + fix de bump espurio).
- `resolveTapAction` (interactividad pura) (KRO-74); cadena de navegación multi-salto `targetComposition` (`resolveTargetChain`) fase B (KRO-94).
- `buildAutoListComposition` (auto-default de lista); `isSchemaOutdated` (desactualización por MAJOR) (KRO-115).
### Notes
- Paridad Dart 2.3.0 (visual-effects, tag-styles, interaction, `resolveTargetChain`, `isSchemaOutdated`); drift-CI de paridad de API TS↔Dart (KRO-30/74/94/115/118).

---

_`< 2.2.2`: previo a 2026-06, sin registro (esta política de CHANGELOG arranca aquí)._
