# COORDINACIÓN entre chats: Studio/Backend ↔ Flutter

Dos agentes (Claude Code) construyen Kromia en paralelo. Este doc es el **acuerdo
de trabajo** para no pisarse ni driftar, y la **fuente de verdad del reparto y de
la cola de handoffs**. Vive en el SDK porque es el repo que ambos comparten.

## Reparto — quién toca qué (regla dura)

| Chat | Repos / propiedad |
|---|---|
| **Studio** (sesión *"Kromia studio"*) | `@kromia/core` (TS **canónico**) · `@kromia/react` · `kromia-studio` · `Kromia_NodeJS` (backend) |
| **Efectos** (sesión especialista en efectos/iridiscente) | Todo lo de Studio en materia de EFECTOS **+ el espejo Dart de EFECTOS en `core_dart`** (`visual_effects.dart`, `foil_recipe.dart`, `custom_foil_recipe.dart`, modelo `EffectLayer`/efectos de `tag_styles`, + su corpus de tests) — decisión del user 2026-07-12: paridad de efectos de punta a punta en un solo chat |
| **Flutter** (sesión *"Kromia flutter"*, `local_a987e3aa-6bba-47b2-b9b6-e34cb9b1c7ae`, cwd `Downloads/kromia-mobile`) | `core_dart` (resto, NO-efectos) · `kromia_flutter` · la app — incluido el RENDER de efectos en la app (shaders/widgets/giroscopio), coordinado con el chat de Efectos vía Drift Sync |

> **Nadie edita los ficheros del otro.** Si crees que el otro lado debe cambiar,
> **pídelo** por el canal (abajo) — no lo toques. Si aparece WIP sin commitear del
> otro chat (p.ej. `auth.controller.ts`), NO lo commitees.

## El contrato es la frontera (contract-first)

- La lógica/forma **compartida** vive en **`@kromia/core` (TS) = fuente única**.
  Flutter la **espeja** en `core_dart` (mismas APIs, otra plataforma). Ver
  `AGENTS.md` del SDK (mapa de helpers + matriz SemVer + bump).
- ¿Flutter necesita un cambio de contrato? → lo **pide** → **Studio lo hace en
  `@kromia/core`** (+ bump SemVer + tag) → Flutter **espeja** en `core_dart`. Nunca
  al revés (no se edita el TS desde el chat de Flutter).
- Lo que **NO** entra al `.json` del contrato (data de álbum/carta: foil, capas 3D,
  colección, ownership…) se documenta igualmente como **spec en `docs/`** para que
  ambas plataformas rendericen/implementen idéntico. Ese es justo el hueco donde el
  drift-sync NO mira → la spec lo cubre.

## Canal de handoff (de más a menos directo)

1. **Directo — `send_message`** (`mcp__ccd_session_mgmt__send_message`): llega al
   otro chat como turno *"From {título}"* con enlace de vuelta; **pide confirmación
   al user**. Para pasar trabajo, pedir un cambio de contrato o avisar de un hallazgo.

   **Las DOS sesiones (al 2026-08-11)** — si un id falla, reconfírmalo con `list_sessions`:

   | Chat | `session_id` | cwd |
   |---|---|---|
   | **Kromia Brain** (Studio: editor web + backend + SDK, **efectos incluidos**) | `local_13e92463-5a04-40c8-b4bb-e182142b2f94` | `Downloads/kromia-studio` |
   | **Kromia mobile** (Flutter: `core_dart` + app + su render) | `local_a987e3aa-6bba-47b2-b9b6-e34cb9b1c7ae` | `Downloads/kromia-mobile` |

   ⚠️ **2026-08-27 — el destinatario ya NO se direcciona por `local_<uuid>`, sino por
   NOMBRE**, y el nombre CAMBIA entre sesiones. Ese día Mobile pasó a llamarse
   `kromia-mobile-67` y este chat `kromia-studio-45`; el `local_a987e3aa-…` de la tabla
   rebotó con *«No agent named … is reachable»*. Y horas después `kromia-mobile-67`
   también rebotó, porque la sesión había terminado.

   **O sea: esta tabla no puede ser la fuente de la dirección.** Saca el nombre de
   `ListAgents` justo antes de escribir — es lo único que está vivo. Los ids de aquí
   sirven para saber QUIÉN es quién, no para direccionar.

   ℹ️ **2026-08-21/22 — el id de Mobile estuvo ARCHIVADO unas horas** y `send_message`
   rebotaba. Se desarchivó y volvió a funcionar con el MISMO id. Lección: cuando
   rebote, **NO adivines** — en `Downloads/kromia-mobile` hay tres sesiones y la que
   tenía actividad reciente («Ondine») no era la buena. El título manda; si ninguna
   encaja, el handoff se encola aquí y se pregunta al user.

   ⚠️ **El chat de Efectos SE DISUELVE (decisión del user, 2026-08-11).** Llevaba sin
   actividad desde el 24 de julio y su terreno se quedó sin dueño: durante ese tiempo
   el sistema de efectos no lo mantuvo nadie, y se notó — el caso de Zapdos en blanco
   estuvo un día abierto sin quien lo cogiera. **Todo lo de efectos pasa a Kromia
   Brain**: `visual-effects.ts`, `foil-recipe.ts`, `custom-foil-recipe.ts`,
   `border-svg.ts`, `effect-resolve.ts` y su render en Studio. El espejo Dart de los
   efectos lo lleva Mobile, como el resto de `core_dart`.

   Id retirado: `local_bbf3e3ef-…` (Efectos). No escribir ahí.

   ⚠️ Otros ids MUERTOS: `local_18daf528-…` (Flutter viejo, lanzado desde
   `Downloads/GameHub` — carpeta borrada). **Una sesión archivada o con su cwd borrado
   hace que `send_message` rebote**; en ese caso deja el handoff en la *Cola* de abajo.
2. **Durable — spec en `kromia-sdk/docs/<tema>.md`**: para cualquier cosa no trivial,
   el mensaje **apunta** a la spec (no metas el detalle largo en el mensaje). Ej:
   `docs/holographic-3d-foil-spec.md`.
3. **Tracking — Jira (KRO)**: cada ticket cross-platform lleva **nota de reparto**;
   los issues de paridad usan el status **Drift Sync** (id `10091`); cross-link entre
   issues hermanos (p.ej. Epic KRO-215).

## Red de seguridad anti-drift (mecánica, no confianza)

- `packages/core/tests/contract-drift.test.ts` — regenera el `.json` del KRP y
  compara; salta si tocaste un registry sin `pnpm gen`.
- Tests de paridad TS↔Dart en `core_dart/test/` (corpus 1:1).
- `tests/validate-album-data-coverage.test.ts` — behaviors sin validador.

## Checklist al hacer un cambio cross-platform

1. ¿Es **contrato**? → `@kromia/core` (Studio) + bump + tag. Si no → **spec en `docs/`**.
2. **Avisa** al otro chat por `send_message`: *qué* · link a la spec · ticket KRO.
3. El otro **espeja** (`core_dart`) / **implementa** (app o Studio) y responde.
4. **Verifica** con los tests de drift / paridad.

## Cola de handoffs abierta (vivo — mantener)

> ### ✅ BARRIDO 2026-08-19 — la cola de efectos está VACÍA
>
> Mobile repasó las entradas marcadas «NUEVO» y confirmó que **KRO-264, KRO-256,
> KRO-257 y KRO-259 están en `main` de la app**. En particular la de KRO-264
> (degradado multibanda del marco), que seguía abierta como pendiente: hoy está
> resuelta en `iridescent_foil.dart:908` con `isMultibandGradient`,
> `foilGradientPositions`, el ciclo y el paneo por giroscopio de
> `foilMultibandPan`, y cubierta en `test/iridescent_foil_test.dart`.
>
> **Las entradas de abajo se conservan como historial, NO como trabajo pendiente.**
> No las reenvíes.
>
> Lección que deja este barrido: una cola que solo se escribe y nunca se cierra
> deja de ser una cola y pasa a ser ruido — y peor, ruido que parece trabajo. Al
> cerrar un handoff, márcalo aquí en el mismo movimiento en que se cierra el ticket.


- **Studio → Mobile** · 🔴 **SIN ENTREGAR (2026-08-27) — KRO-386: al elegir qué
  cartas ofreces no se ve el cromo.** `hoja_de_cartas.dart` no tiene ningún widget
  `Image`; la celda pinta un `Container` con color, número y nombre.

  **No es MinIO** — que era la sospecha, y por eso conviene decirlo antes que nada:
  el `MINIO_ENDPOINT_HOST` del backend ya apunta a `s3.minio.hdglabs.com`, y en el
  mismo dispositivo y la misma sesión la parrilla del álbum pinta las seis cartas
  con su foto. La imagen no falla al cargar: no se pide nunca. La parrilla del álbum
  ya resuelve bien la URL, así que hay de dónde copiarla.

  Suelto y aparte: en la cabecera del álbum el publisher sale como «Un desconocido».

- **Studio → Mobile** · 🔴 **SIN ENTREGAR (2026-08-27) — contrato de KRO-384: cambiar
  de álbum dentro de la sala.** Mobile lo estaba esperando y había parado a propósito
  para no empezar sin él; cuando lo tuve escrito, su sesión ya había terminado y
  `send_message` rebotó.

  **El contrato entero está en la descripción de KRO-384** (evento, los cuatro estados
  de salida, qué pinta cada uno y por qué), así que no hay que reconstruirlo: basta con
  apuntar allí. Backend en `main` del backend, `a29f236`.

  Lo que NO está en el ticket y hay que decirle a la cara:

  - El user lo pidió en primera persona («el álbum de las cartas que ofrezco») y **lo
    implementé como álbum DEL TRUEQUE**, uno solo para los dos. Si al montar la
    pantalla se ve que quería lo otro, el cambio es de Studio, no suyo.
  - `offer_wrong_album` es un aviso **para el cliente**, no para el usuario: significa
    que la app mandó el álbum viejo tras un `album_changed` que no aplicó.

  Pendiente también de entregarle: la copia exacta del toast sin conexión que pidió el
  user — **«Sin conexión, revisa tu conexión»**, sin detalle debajo.

- **Studio → Mobile** · ✅ **ENTREGADO 2026-08-22 — `precisionM` no se manda nunca**,
  junto con la pregunta del user de si están listos para la build.

  Su `dondeEstoy` (`sala_de_trueque.dart:411`) manda `{'lat','lng'}` y nada más; la
  palabra `precision` no aparece en toda la feature. **Con eso el margen del GPS no se
  aplica jamás**: `sePuedeCerrar` suma el margen de los dos antes de comparar con los
  300 m, y sin el campo el margen es cero — se puede cerrar estando a ~340 m reales.

  Poco grave en la práctica (al aire libre son 5-20 m), pero **falla hacia el lado
  equivocado**: todo el modelo está hecho para fallar CERRADO y esto abre la puerta en
  vez de cerrarla. Y es otra vez el mismo bicho de la semana — una regla escrita,
  probada y VERDE que no corre porque nadie la activa, igual que
  `recuperarSesionDeDisco` en KRO-371. Mis tests del margen pasan; el margen no se
  aplica en producción.

  Si su paquete de geolocalización da `accuracy`, es mandarlo tal cual: el servidor lo
  usa si viene y lo ignora si no.

  Lo demás está: con `f9598f1` (ubicación) y `62fa5d0` (elegir cartas) el flujo está
  entero por los dos lados. KRO-364 queda en **verificación**, no completado — el
  código está, pero eso no lo decide el código.

- **Studio → Mobile** · ✅ **ENTREGADO 2026-08-22 — invitar a gente DESCONECTADA
  (`911433c`) + varias propuestas a la vez (`6b4b26e`)**. Lo segundo les cambia el
  flujo: **hay que hacer `trade:join` antes de operar sobre una sala**, porque con
  varias abiertas la sala ya no se resuelve por persona sino por socket.

  - **`invite_user_offline` YA NO EXISTE.** Que lo quiten. Se puede invitar a alguien
    desconectado: recibe una notificación, no un evento de socket. Era un resto de
    cuando las salas vivían solo en memoria — contradecía su `espera` y los 14 días,
    y hacía que la pantalla de a quién proponer fuera un generador de fallos (esa
    lista es gente que estará desconectada casi siempre).
  - **Invitar dos veces a la misma persona devuelve `invite_reused` con el
    `roomSessionId` de la sala QUE YA HABÍA**, no uno nuevo. Hizo falta porque ahora
    lo normal es que la sala esté en disco y fuera de memoria, y la comprobación solo
    miraba el `Map`: se creaban dos y la notificación vieja llevaba a una muerta.
  - `invite_failed` partido en `invite_self` e `invite_user_not_found`.
  - **`session_expired` reescrito**: su descripción decía «ha caducado» e inducía a
    confundirlo con `expired`. Ahora las dos entradas se señalan entre sí. Dato que
    no tenían: desde KRO-371 `session_expired` no puede dispararse sobre un
    apalabrado.

  ⚠️ **Sin decidir y avisado al user**: cuántas propuestas abiertas puede tener una
  persona. Hoy depende de si tu sala seguía en memoria, que es incoherente. Si su
  pantalla asume una u otra cosa, que lo digan.

- **Studio → Mobile** · ✅ **ENTREGADO 2026-08-22 — 7 estados nuevos en avisos de
  trueque** (`db3e0d9`). Estuvo unos minutos en cola: su sesión se archiva sola en
  cuanto deja de estar en primer plano, y hubo que pedirle al user que la abriera.

  Decidieron —con razón— no pintar el `message` del servidor. Comprobado que Studio no
  consume ni un socket de trueque, así que son el único cliente y ese texto no lo
  renderiza nadie. **Pero eso dejaba SIETE avisos mudos**: su único contenido era esa
  frase, sin `status`. `delete_RoomSession` era el peor — tres significados metidos en
  una sola frase en castellano.

  Ahora llevan estado: `invite_sent` · `invite_reused` · `invite_failed` · `joined` ·
  `session_closed` · `session_denied` · `participant_disconnected`.

  Lo que más les afecta al montar la sala:
  - **`invite_sent` vs `invite_reused`**: para quien invita no es lo mismo «se ha
    enviado» que «ya estabais en una». Antes solo se distinguían por el texto.
  - **No confundir `session_closed` / `expired` / `rejected`**: los dos últimos cuentan
    POR QUÉ acabó; el primero solo dice que la sala se soltó. Tratarlos igual hace que
    un caducado y un rechazado se lean como lo mismo, y en el historial no lo son.
  - Que se suelte la sala **no borra el trueque**: si estaba apalabrado sigue en disco
    y se vuelve con `trade:join`. Es su propio punto de que un aviso perdido no puede
    ser la única forma de enterarse de nada.

  La entrada `trade:session#(sin status)` del mapa deja de tapar cinco cosas y pasa a
  ser un centinela. Todo en `docs/SOCKETS_MAP.md`.

- **Studio → Mobile** · ✅ **ENTREGADO 2026-08-22** — KRO-367 + KRO-371 + respuestas a
  sus tres preguntas de KRO-366. Estuvo encolado unas horas porque su id estaba
  archivado. Contenido: los 5 eventos nuevos de KRO-367 (`trade:reject`, `rejected`,
  `reject_too_late`, `expired`, `close_expired`), el `not_a_participant` de KRO-371,
  el tercer motivo que les faltaba (`posicion_vieja`), y el aviso de que **su pantalla
  de historial revienta con un trueque rechazado** (unión discriminada: un rechazado
  no trae `diste`/`recibiste`). Nada pendiente por este lado.

- **Efectos → Flutter** · **NUEVO 2026-07-18 — KRO-264 · KRP 5.9.0 (minor) —
  degradado MULTIBANDA del marco**: `border_gradient_hex` acepta ahora 2–16
  colores con peso opcional `#RRGGBB@1.4` (ancho relativo de banda) + param
  nuevo `border_gradient_cycle` (6–100, default 45: % del cuadro por ciclo).
  Origen: QA del user contra la Zapdos ex FÍSICA (el foil real = ~15 bandas
  estrechas irregulares con casi-blancos intercalados, no un degradado suave).
  **core_dart YA espejado por el chat de Efectos** (contrato 5.9.0 embebido +
  `parseFoilGradientSpec`/`foilGradientPositions`/`isMultibandGradient` +
  `FoilBorderFill.stops`; 744 tests verdes). **A Mobile le queda SOLO el
  render**: en el kind `custom-gradient`, si `isMultibandGradient(stops, cycle)`
  → `LinearGradient` con las posiciones de `foilGradientPositions(stops,
  foilMultibandCycle(cycle))`, `tileMode: repeated`, a lienzo
  `foilMultibandPan.sizePct` (200 %) del cuadro **paneado por giroscopio** (QA:
  las bandas deben deslizarse al inclinar, como el foil); si no, camino clásico
  intacto. Spec: `iridescent-foil-render-spec.md` **§3-ter**. Issue paraguas de
  render: KRO-257 (comentado).

> **✅ 2026-07-12 noche — KRO-257 + KRO-259 (render) COMPLETADOS por Mobile**:
> app PR #95 merged, 384 tests verdes, build iOS en curso — motion (§4.1),
> destellos por giroscopio (§4.2, +`foilShiftY` en el HoloCard), banda afilada
> (§4.3), canto (§4.5, 4 copias ±1.2px) y troquel custom (§3-bis, instancia
> propia del shader `irid_mask`). Jira KRO-257 comentado por Efectos (Mobile
> sin auth) → verificación/QA del user con la Zapdos 051. Las dos entradas de
> abajo quedan como REGISTRO.

- **Efectos → Flutter** · **NUEVO 2026-07-12 — KRO-259 · KRP 5.8.0 (minor) —
  diseño de borde PERSONALIZADO**: `border_style` gana `'custom'` +
  `border_custom_url` (troquel del creador, blanco = diseño, por LUMINANCIA).
  El troquel sustituye al borderSVG como máscara; fill/sheen/canto se aplican
  igual encima; `border_fill`/`border_width` no aplican; `border_margin` =
  inset (margin/300). **core_dart YA espejado por el chat de Efectos**
  (contrato embebido 5.8.0, 740 tests). A Mobile: solo el render — spec
  `iridescent-foil-render-spec.md` **§3-bis**. Mismo issue paraguas de render:
  KRO-257 (comentado).

- **Efectos → Flutter** · **NUEVO 2026-07-12 — KRO-256 · KRP 5.7.0 (minor) —
  "vida" del iridiscente**: 3 params aditivos en `iridescent_foil` — `motion`
  (auto/deriva/tono/total: movimiento autónomo a elección; velocidad =
  `shimmer`), `mask_sparkle` (no/pastel/vivo: cada perforación de la máscara con
  su color propio, rotando — look "cosmos") y `border_sheen`
  (no/metalico/iridiscente: banda especular que barre el marco — "borde metálico
  por capas"). **core_dart YA espejado por el chat de Efectos** (contrato 5.7.0
  embebido + recetas `foilMotion*`/`foilMaskSparkle*`/`foilBorderSheen` +
  tests; 740 verdes). **A Mobile le queda SOLO el render de la app** — spec:
  `iridescent-foil-render-spec.md` **§4** (¡leer §4.4 PERF: en Studio animar el
  filter en el elemento enmascarado CONGELÓ la página; vuestro single-pass ya lo
  evita!). Origen: feedback QA del user comparando la Zapdos 051 con la física.

> **📣 Efectos → Flutter 2026-07-12 — SDK PUSHEADO a `origin/main`** (con OK del
> user): `24bf276..72451df`, los 11 commits de efectos — incluye `7f257c0`
> (core_dart 5.4→5.6) — + tags `krp/v5.4.0`/`v5.5.0`/`v5.6.0`. El blocker de la
> build iOS (símbolos `foilNeutralSheen`/`isIridescentLayer`/etc. ausentes en
> GitHub) está resuelto → **Flutter: re-dispara la build cuando leas esto**.
> (Tu sesión estaba archivada; `send_message` rebotó — por eso va por aquí.)

> **✅ 2026-07-12 — KRO-251/252/253/254 COMPLETADOS end-to-end**: core_dart de
> efectos por el chat de Efectos + RENDER de la app por el chat de Flutter
> (PRs mobile #89–#92 merged; shader `irid_mask.frag`; 375+ tests). Los 4 en
> verificación/QA (build iOS 42 del user). Las 4 entradas de handoff de abajo
> quedan como REGISTRO — no hay trabajo pendiente en ellas. Seguimiento
> abierto: optimizar el enmascarado de Mobile a single-pass (hoy duplica el
> render del arte) — propuesta del chat de Efectos: un solo fragment shader
> `color = mix(arte, blend(arte, foil), maskLuma)` con arte+máscara como
> samplers (y el gradiente generado en el propio shader), en vez de
> arte-solo + arte+efecto recortado encima.
>
> Nota original del handoff (histórico):
> `visual_effects.dart` regenerado desde el contrato **5.6.0** (26 params del
> iridiscente) · `foil_recipe.dart` (+`foilPatternNone`, `foilNeutralSheen`,
> `resolveFoilBorderFill`/`FoilBorderFill`) · `custom_foil_recipe.dart`
> (+`foilMaskLayouts`/`foilMaskTile`/`foilMaskLayout`, `iridescentLayerKind`/
> `isIridescentLayer`) · `card_layers.dart` (`EffectLayer` +`config`/
> `maskLayout`/`maskScale`, `isEffectLayerKind`) · `tag_styles.dart` (validador
> alineado: rama custom_foil KRO-122/123, dup por valor+efecto KRO-127, capa
> procedural KRO-250) · `version_compat`+pubspec → **5.6.0**. `flutter test`:
> **736 tests verdes**. **Al chat de Flutter le queda SOLO el RENDER de la app**
> (`kromia_flutter`/`kromia-mobile`): pintar `pattern:'none'` (sheen neutro),
> máscara luma→alfa con tile (wrap-repeat), fill del marco por kind, y el
> despacho de la capa `iridescent` al shader — specs §1-bis/§1-ter/§3/§4-bis.

- **Studio → Flutter** · **NUEVO 2026-07-12 — KRO-250 · DATA (sin bump, KRP
  sigue 5.6.0)**: pila UNIFICADA — `EffectLayer.kind` gana **`'iridescent'`**
  (capa PROCEDURAL) + `EffectLayer.config` (params del catálogo embebidos) +
  `textureUrl` pasa a OPCIONAL. Espejar en `core_dart`: (a) modelo
  `EffectLayer` (kind nuevo + config + textureUrl opcional); (b)
  `custom_foil_recipe.dart` — `IRIDESCENT_LAYER_KIND` + `isIridescentLayer`
  (+ `isEffectLayerKind` acepta el kind; `EFFECT_LAYER_KINDS` sigue siendo solo
  texturas); (c) validación: capa procedural sin textura NO avisa; su config se
  valida contra el catálogo; (d) render: al pintar `customLayers`, despachar la
  capa iridiscente al MISMO shader del `iridescent_foil` con `layer.config`
  (todo lo demás de la capa se ignora — config gobierna), insertada en el
  z-order del array. Spec: `custom-foil-render-spec.md` **§4-bis**. Jira:
  KRO-250 (+ issue Drift Sync). ⚠️ Recomendado espejar 251→252→253→254 en orden
  (5.4→5.6 + este) — cada uno asume el anterior.
- **Studio → Flutter** · **NUEVO 2026-07-12 — KRO-249 · KRP 5.6.0 (minor)**: el
  MARCO del `iridescent_foil` gana **fill libre**. Espejar: (a)
  `visual_effects.dart` — `border_color` +4 opciones (oilslick/sunset/mint/
  midnight = gradientes FIJOS; 'spectrum' sigue significando "como el foil") +
  `border_gradient_hex` (2–4 hex, ciclo 45%) + `border_texture_url` (5.6.0);
  (b) `foil_recipe.dart` — **`resolveFoilBorderFill(config)` + `FoilBorderFill`**
  (precedencia: textura > hex sólido > degradado custom > enum; NO
  reimplementarla a mano); (c) render: el borderSVG sigue de máscara, el fill se
  pinta según el kind (imagen cover por el proxy / color / LinearGradient de los
  stops / SweepGradient aurora / degradado oscuro card-bg); gradientes a
  `scale%`; blend screen SOLO con el blanco base. Spec:
  `iridescent-foil-render-spec.md` §3. Jira: KRO-249 (+ issue Drift Sync).
- **Studio → Flutter** · **NUEVO 2026-07-11 — KRO-248 · KRP 5.5.0 (minor)**: el
  `iridescent_foil` gana **máscara importable por LUMINANCIA** (`mask_url` +
  `mask_layout` cover|tile + `mask_scale` 5–100=25) y `EffectLayer` gana
  `maskLayout?`/`maskScale?` (tipo `EffectMaskLayout`; DATA, ausente = cover).
  Espejar: (a) `visual_effects.dart` (3 params, 5.5.0); (b)
  `custom_foil_recipe.dart` — `FOIL_MASK_LAYOUTS` + `FOIL_MASK_TILE` +
  `foilMaskLayout(layout, scale)` (fuente única del layout); (c) modelo
  `EffectLayer` Dart con los 2 campos; (d) render: máscara luma→alfa (`dstIn`)
  SOLO sobre foil+sheen (glare/grano/borde no); `tile` = wrap-repeat de la
  tesela a `scale%` del ancho (alto auto), anclada a la esquina. Combinable con
  paleta `none`. Spec: `iridescent-foil-render-spec.md` §1-ter +
  `custom-foil-render-spec.md` §4. Jira: KRO-248 (+ issue Drift Sync).
- **Studio → Flutter** · **NUEVO 2026-07-11 — KRO-247 · KRP 5.4.0 (minor)**: el
  `iridescent_foil` gana la paleta **`none`** ("Ninguna") = lámina NEUTRA sin
  gradiente de color. Espejar: (a) `visual_effects.dart` — opción `none` en el
  enum `pattern` (contrato 5.4.0); (b) `foil_recipe.dart` — `FOIL_PATTERN_NONE`
  + `FOIL_NEUTRAL_SHEEN` (barrido blanco 115°, alpha 0→0.9→0, NO repeating) +
  `foilNeutralSheenCss` equivalente (Flutter construye su LinearGradient de los
  stops). Render con `none` (sin `pattern_hex` válido — el hex sigue MANDANDO):
  NO se pinta la capa de color del foil (hue/brightness/contrast/scale/blend/
  geometry/warp no aplican); el sheen usa el barrido neutro y hereda el vaivén
  de rejilla / paneo por tilt; glare, grano y marco no cambian. Spec:
  `docs/iridescent-foil-render-spec.md` §1-bis. Jira: KRO-247 (+ issue Drift Sync).
- **Studio → Flutter** · Sistema holográfico 3D / foil / contornos → implementar en
  `core_dart` + app según `docs/holographic-3d-foil-spec.md` (espejar `card_layers.dart`;
  añadir `fieldKey`/`customLayers` a `tag_styles.dart`; máscara por **luminancia**;
  **parallax diferencial** 0.15/0.45/1.0 con giroscopio; alineación de máscara `cover`).
- **Studio → Flutter** · KRO-214 colección sin QR → UI "Mi colección" (endpoints
  `addCards`/`removeCards`/`?owned`, repetidas por `quantity`) + **aviso de
  responsabilidad** en álbumes self-declared. Backend listo.
- **Studio → Flutter** · KRO-198 composición de detalle de carta (modo focus) →
  `docs/kro198-detail-composition-flutter.md` (ACTUALIZADO 2026-06-22, **§0 nuevo**).
  Render-only (NO bumpea PROTOCOL_VERSION). ⚠️ **Modelo ahora BASADO EN CAMPOS**: el
  `slot.id` de una `detailComposition` es la **clave de un campo** (no un rol); receta
  portadora `detail_profile`; plantillas = pilas de campos. **No cambia el trabajo de
  Flutter** (renderiza `layout`+`slots`+`hiddenSlots` igual), solo qué SON los ids — ver §0.
  Paridad Dart pendiente de:
  (1) `hiddenSlots` en RecipeRenderer (strip + reenvío a HeroHeader) + consumir
  `CardSchema.detailComposition` con `hiddenSlots = [claves de campo imagen] + clave del título`;
  (2) **`computeHiddenHeroRoles`** + `hiddenSlots` en `LayoutRenderer`/`hero_header`
  (defensivo: el hero casi nunca aparece en una composición por campos); (3) **render por
  behavior**: currency/measurement por `behaviorConfig`, `parseInlineHtml` (allowlist seguro),
  code/url/email/phone/tags/url_list/email_list. SDK-TS `5410852` + Studio `385d36f` +
  backend `de13c54` listos. El editor de lienzo (canvas) es Studio-only; Flutter = renderer puro.
  **(4) NUEVO `8e8e700`/`da0007f`** — `SlotComposition.composableDisplay`
  (`auto|inline|list|chips|table|stats`): variante de render del slot composable, meta de
  composición (NO contrato, NO bump). Espejar el campo en `core_dart` + las 6 ramas en el
  ComposableSlot de Flutter. `'auto'` = comportamiento histórico (backward-compatible).
  `'stats'` replica el componente stats_row. Ver `docs/kro198-detail-composition-flutter.md` §8.1.
  **(5) NUEVO 2026-06-22 (§10, commits `a99f11d`/`581ff9d`/`5bebd85`/`f00d55d`)** — 4 puntos de
  render más, todos META/render-only (NO bump): **(a)** `SlotComposition.conditionalStyle`
  (estilo por valor: `{fieldKey, cases:[{op,value,appearance}]}`; primer caso que matchea
  MERGE-a su appearance sobre la base — integrar en `resolveSlot` vía `resolveConditionalAppearance`);
  **(b)** chips/tabla/stats **temables** (color desde appearance, no muted fijo); **(c)** paridad
  del **badge** (opacity/shadow + color dinámico); **(d)** contenedor raíz del **detalle llena la
  pantalla** (kind=detail → raíz `grow shrink-0`, host da la altura). **Acabados (THEME_PRESETS)
  y contraste WCAG = SOLO-EDICIÓN Studio → Flutter renderer los ignora.** El detalle usa el MISMO
  motor que las secciones: reutiliza tu render de secciones. Ver §10 + §8.1 del doc.
  **(6) NUEVO 2026-06-22 §11 (commits `b5ecf71`/`74e36ce`/`c4219cb`)** — decoración: (a) el
  WRAPPER raíz sigue el radius del surface (no solo el grid) → las 4 esquinas; (b) la caja de
  IMAGEN (ThumbBox) usa `appearance.bgColor` de fondo (el acabado la tiñe); (c) NUEVO
  `ContainerSurface.cornerRadii` (radio POR ESQUINA, render-only, NO en ALL_SURFACE_PROPS → sin
  bump) → espéjalo per-corner en el ClipRRect. Ver §11 del doc.
  **(7) NUEVO 2026-06-22 §12 (commits `5ac8e7f`/`163f011`)** — (a) la raya de acento
  (`buildAccentBorderStyle`) ya NO aplana las esquinas de su lado: el inset se curva con el
  radius → las 4 esquinas uniformes (en Flutter: la franja de acento sigue el ClipRRect, no
  corta el redondeo); (b) NUEVO `screenBgHex(bgColor)` en `core/palette.ts`: la PANTALLA
  (lista de sección / detalle) toma el acabado un punto más oscuro que las cartas (papel ×0.82)
  → las cartas RESALTAN por elevación; null para tokens de tema. Render-only, fuera del
  contrato. En Flutter: fondo del Scaffold/host = `screenBgHex(layout.surface.bgColor)`. Ver §12.
  **(8) NUEVO 2026-06-22 §13 (commit `64c0b9d`)** — (a) **relleno POR LADO**: nuevos
  `ContainerSurface.paddingSides` (escala 6 → px 0/4/8/12/20/32) y `SlotAppearance.paddingSides`
  (escala 4 → px 0/4/8/16), render-only (NO en ALL_SURFACE_PROPS/ALL_APPEARANCE_PROPS), prevalecen
  sobre el padding uniforme → en Flutter `EdgeInsets.only`; (b) **separador de lista opcional**:
  `ViewComposition.listStyle.separator` (render-only) → la pantalla de lista pinta `Divider` entre
  items SOLO si true, **OFF por defecto** (`RowTextRecipe` ya no pinta su border-b propio). ⚠️ cambia
  el aspecto de listas existentes. C (acento en bloques) = Studio-only, sin trabajo Flutter. Ver §13.
  **(9) NUEVO 2026-06-22 §14 (commit `649aaf0`)** — acento en modo BLOQUES (LayoutRenderer): (a) la
  raya (box-shadow inset) se pinta AHORA en la capa del fondo del CONTENEDOR RAÍZ (no en un wrapper
  externo) → el `bgColor` del acabado ya no la tapa (en Flutter: foregroundDecoration/Border del
  Container raíz o Stack clipado, NO wrapper externo); (b) `extractAccentSettings` expone `colorFieldKey`
  y el slot cuyo campo lo mapea NO se pinta como celda con el acento activo (en Flutter: suprimir esa
  hoja). Render-only, solo bloques (recetas recipe-mode mantienen AccentFrame). Ver §14.
  **(10) NUEVO 2026-06-23 §15 (commit `95917cb`)** — fondo de PANTALLA DESACOPLADO del fondo de la
  card: nuevo `ContainerSurface.screenBgColor` (id de paleta, render-only). La pantalla =
  `screenBgHex(surface.screenBgColor ?? surface.bgColor)` (fallback a bgColor = sin regresión);
  `applyThemePreset` setea AMBOS (bgColor+screenBgColor=paperBg). En Flutter: añade el campo a
  `ContainerSurface` de core_dart y pinta el fondo del Scaffold/host con ese fallback. Ver §15.
  **(11) NUEVO 2026-06-23 §16 (commit `40c8816`)** — **apariencia POR-FIELD** en slots
  composable: nuevo `SlotComposition.fieldAppearances?: Record<fieldKey, SlotAppearance>`
  (meta, NO bumpea). `ComposableSlot` resuelve el color de CADA chip/estadística como
  `base ← fieldAppearances[key]`. **Requiere paridad core_dart**: añade el campo + el merge
  por-field en el render del composable (no un único estilo para todo el slot). Ver §16.
  **§17 (Studio-only, SIN trabajo Flutter)** — el detalle de carta deja de FORZAR ocultos:
  ya no mete `'title'` en `hiddenSlots`, las plantillas no colocan título/imagen por defecto,
  y se borró `detail-slots.ts` en Studio. Flutter renderiza el layout tal cual. Ver §17.
  **(12) NUEVO 2026-06-23 §18 (commit `505d3b4`)** — dos fixes de render. (18.1) el COMPONENTE
  `stats_row` → `StatsRow` ignoraba TODA apariencia (colores a fuego); ahora `LayoutRenderer`
  le pasa `appearance`+`fieldAppearances` y StatsRow aplica la apariencia COMPLETA por estadística
  (tipografía, color, FONDO, recorte, caja — no solo color; commit `e44e303`). **Requiere paridad
  core_dart** (mismo bug probable allí; el gate de §16 NO aplica, no pasa por ComposableSlot). (18.2) `CardRefResolver` admite `layers?:{url}[]`: una
  carta SOLO con capas 3D (sin arte plano, p.ej. Ignis) → la mini-carta APILA las capas en vez
  del placeholder. **Paridad core_dart**: resolver devuelve capas + mini-carta las apila. Ver §18.
  **(13) NUEVO 2026-06-23 §19** — (19.1, commit `922137e`) una estadística con
  `appearance.display==='badge'` pinta el VALOR como pastilla (StatsRow + rama 'stats').
  **Paridad core_dart**: ramificar en `display=='badge'` también en stats. (19.2, Studio
  `99a6e76`, nota app) el PANEL del detalle se tiñe con el acabado (`paletteHex(surface.bgColor)`)
  para no dejar huecos blancos → la app Flutter debería pintar igual su panel de detalle. Ver §19.
  **(14) NUEVO 2026-06-23 §20 (commit `c0becc2`)** — `ContainerSurface.textColor`: color de
  texto GLOBAL del contenedor (id de paleta, meta render-only). `surfaceClasses` lo aplica
  como color base → CASCADA por herencia a los slots sin color propio (los que fijan el suyo
  ganan). `applyThemePreset` lo setea GLOBAL en `surface.textColor` (antes por-slot; badges
  conservan accent). **Paridad core_dart**: añade el campo + aplica el color como DefaultTextStyle
  heredado del subárbol + applyThemePreset global. Studio: control "Color de texto" en Decoración
  + cabecera del detalle usa `surface.textColor`. Ver §20.
  **(15) NUEVO 2026-06-23 §21 (commits `da3ffd1`/`ad542eb`)** — blanco y negro en la paleta:
  `PALETTE_NEUTRALS=['white','black']` (grupo 'neutro', fijos) + sus hex en `PALETTE_HEX`.
  `paletteClass` los resuelve por fallback (`text-white`…). NO toca el contrato. **Paridad
  core_dart**: mapear ids 'white'/'black' a Color blanco/negro + mostrarlos en el picker. Ver §21.
  **(16) NUEVO 2026-06-23 §22 (commit `93d1f4a`)** — dos fixes de render. (22.1) el color
  POR-CHIP (`fieldAppearances`) ahora aplica también en `composableDisplay='auto'` multi-campo
  (antes el branch 'auto' usaba `items` sin key → solo color base). **Paridad core_dart**:
  conservar la key por campo en 'auto' + merge `base ← fieldAppearances[key]` por valor.
  (22.2) el `align` de un `display:'badge'` va en el CONTENEDOR (helper `appearanceAlignClass`
  en el `<div>` block), no en la pastilla inline-flex. **Paridad core_dart**: alinear el badge
  desde su contenedor (Align/Row), no con text-align sobre la pastilla. Ver §22.
  **(17) NUEVO 2026-06-23 §23 (commit `65297e2`)** — (23.1) helper SDK `labelForField`
  (behavior→displayName, fallback type) para nombrar slots genéricos. Solo paridad core_dart
  si la app EDITA (el render no lo usa). (23.2) el EDITOR de bloques permite insertar CUALQUIER
  campo del schema como slot genérico ("Campos del álbum") → **Studio-only, SIN trabajo Flutter**
  (el render ya pinta cualquier slot `fields:[key]`; es maquinaria del editor). Ver §23.
  **(18) NUEVO 2026-06-23 §24 (commit `8c4e40e`)** — (24.1) `fieldAppearances` por-chip
  ahora aplica COMPLETA (tipografía+fondo+RECORTE/truncateChars+caja) en TODAS las ramas de
  ComposableSlot (antes solo color, y solo stats completo); las entries de array llevan key
  del field. **Paridad core_dart**: aplicar la apariencia efectiva + corte por chars POR
  ENTRADA. (24.2) `validateSlot` exime al slot-CAMPO (`fields:[slotId]`) del chequeo de rol
  homónimo → no bloquea el guardado por colisión clave-campo↔id-rol. **Paridad core_dart** si
  valida. (24.3) editor "Campos del álbum" agrupado por tipo = Studio-only. Ver §24.
  **(19) NUEVO 2026-06-24 §25 (commits `e71f704`+`ae06635`)** — ESTILO de la franja de acento
  `accentStyle: 'bar'|'rounded'|'glow'|'gradient'|'ambient'` (DATA, NO bumpea). `buildAccentBorderStyle`
  varía el box-shadow inset por estilo (bar=banda, glow=+halo blur w*4, gradient=difuminado, ambient=
  `linear-gradient` con alpha 0x40 — NO box-shadow). RECTO vs CURVO lo decide el HOST: `curvedAccent`
  conserva el radius SOLO si `style==='rounded'`. **Paridad core_dart+flutter**: AUSENTE hoy
  (`_AccentFrame` ignora el estilo). Tracking: issue Drift Sync (acento). Ver §25.
  **(20) NUEVO 2026-06-24 §26 (commits `19e92fc`/`d5571cd`/`f58b5c7`/`cc1c9d0`/`3927742`)** — disposición
  de chips: `chipGrid{columns,gap}`+`chipPlacements[fieldKey]` (rejilla 2D que REUSA `GridPlacement` de
  bloques; ausente=flex-wrap retro-compat) · `chipWidth 'fill'|'content'` (fill=estira+align→justify-content,
  content=content-fit+align→justify-self) · display `text`/`badge` por-chip + `composableDisplay` explícito
  manda en slot de 1 campo. **Paridad core_dart+flutter (GAP MAYOR)**: AUSENTE (`_badgeRow` usa apariencia
  base para todos, ignora display/align por-chip) → builder de chip ÚNICO por apariencia efectiva. Prereq
  §16/§18/§22/§24. Tracking: issue Drift Sync (chips). Ver §26.
- **Studio → Flutter** · **Flip al reverso v2** (KRO-227 cont.; render-only, NO bump) →
  `docs/card-flip-3d-spec.md`. Vuestro `CardFlip` (mobile#8) rota la carta PLANA; la versión
  buena gira el **MODELO 3D entero** (cara + canto de cartulina + dorso como cara del sólido,
  620ms `cubic-bezier(.3,.7,.35,1)`, reduced-motion instantáneo, el tilt sigue vivo volteada)
  y se dispara con el **gesto de forzar el giro** (arrastre con overshoot `|rawX-0.5|*2 ≥ 1.25`,
  una vez por gesto, pointer capture; botón ⟳ Reverso/Anverso como fallback). Gate `hasBack` =
  imagen || (qr && physicalTracking=='qr'), con `section:null` (acordado). Extra menor DATA:
  `chipWidth:'fill'` aplica también al badge de slot ÚNICO (SDK `f633dd1`, rama BadgeSlot).
- **Studio → Flutter** · **KRO-230 siluetas de carta** (DATA, NO bump) → espejar
  `packages/core/src/card-shapes.ts` en `core_dart` y renderizar en la app con un
  `CustomClipper<Path>` que recorte TODAS las vistas de carta (grid, focus con canto 3D, reverso,
  efectos). **NO hay siluetas de ejemplo** (feedback del user): `CARD_SHAPES` = solo `'standard'`
  (deselección); la forma la aporta el creador → `shape:'custom'` + `shapePath` (Studio importa un
  SVG o vectoriza una imagen con alfa). GRAMÁTICA canónica del path = SOLO `M/L/C/Q/Z` absolutos,
  coords 0..1, un subpath cerrado (sin arcos: el parser Dart es un switch de 4 comandos;
  `validateShapePath` = validador puro a espejar). **Nuevo `CardFormat.shapeScale`** [0.5,1]
  (ausente ⇒ 1): escala uniforme de la silueta sobre su centro (0.5,0.5) — `scaleShapePath`
  reproyecta `v' = 0.5 + (v−0.5)·s`; en Flutter, escalar el Path sobre su centro. **Sombra**: con
  silueta NO uses box-shadow (rectangular, no lo recorta el clip → halo); usa un shadow que siga
  la forma (en web = capa clip + blur en un ancestro; en Flutter = shadow del propio Path). `shape`
  ausente/'standard' ⇒ rect redondeado por cornerRadius; con silueta cornerRadius se IGNORA. La
  silueta se estira con el aspect (0..1 en ambos ejes, intencional). Backend persiste
  enum{standard,custom} + shapePath + shapeScale.
- **Studio → Flutter** · **KRO-16 backbone QR construido** (SDK `2b1036e` + backend `5152a8b`;
  el user decidió ir por delante del gate del piloto). Espejar `packages/core/src/card-qr.ts`
  en `core_dart` (**ECDSA P-256 + SHA-256**, sig IEEE-P1363 base64url, pubkey JWK;
  `cardQrSigningInput` = bytes canónicos `v\nkind\nid\nalbumId\ncardIndex\nserial`; `parse/
  serialize`, `verifyCardQrSignature` con la JWK de `GET /cards/public-key`) + app: **scanner
  de cámara** → `POST /cards/scan {qr}` (respuestas `claimed`/`already-yours`/`transferred`/
  403 `owned-by-other`); **transferir** (dueño → `POST /cards/transfer {identityId}` → token
  que el receptor aporta al escanear); **colección verificada** `GET /cards/mine` fusionada con
  la declarada (KRO-214) vía `ownershipBadge`. Detalle completo en `docs/physical-cards-foundation-spec.md`
  §10. El export para imprenta (KRO-216) sigue bloqueado; esto es solo el backbone DIGITAL.
  - **[Flutter] Estado**: **Parte A (espejo `core_dart`) HECHO y mergeado — sdk#24** (`card_qr.dart`:
    anchor `cardQrSigningInput` + base64url + parse/serialize/validate + `verifyCardQrSignature`
    ECDSA P-256 con `pointycastle`, 1ª dependency de runtime; test = vector interoperable
    node/WebCrypto↔pointycastle; corpus 669, drift verde, sin bump).
  - **Parte B (app) núcleo HECHO y mergeado — mobile#14**: feature `physical_cards/` (modelos
    puros del scan + `CardScanResult.fromResponse` mapeando el contrato §10, servicio Dio
    scan/transfer/mine/publicKey/mint, scanner con gate `parseCardQrPayload` + dev paste bar,
    `mergeOwnershipBadges` verificada⊕declarada vía `ownershipBadge`; ruta `/cards/scan` + tile en
    Ajustes; **14 tests verdes**, analyze limpio). **FALTA (wiring, no bloqueante)**: badge
    verificada/declarada en la rejilla del álbum + pantalla de transferencia. **E2E del scan
    bloqueado** hasta desplegar el backend `5152a8b` (probable en emulador con el paste bar +
    `POST /cards/mint`) → **pide al user el push del backend**.
- **abierto** · reconciliar conteo de iconos en `core_dart` (81) vs canónico SDK (79).

## Last updated

2026-06-22 — sesión Studio. KRO-198 ampliado: auditoría del sistema de decoración/
apariencia → 7 mejoras shipped en TS/Studio (contraste WCAG, chips/stats temables,
paridad badge, THEME_PRESETS/acabados, conditionalStyle/estilo por valor, validación,
microcopy) + fix de altura del contenedor de detalle + decoración §11 (wrapper sigue
radius, caja de imagen tematizada, cornerRadii) + §12 (esquinas uniformes sin aplanar +
`screenBgHex` = fondo de pantalla derivado del acabado, cartas resaltan) + §13 (relleno
POR LADO `paddingSides` surface+slot, y separador de lista opcional `listStyle.separator`
OFF por defecto) + §14 (acento en bloques: la raya en la capa del fondo del root para que
el acabado no la tape, y el slot de color se vuelve la raya en vez de celda) + §15 (fondo de
PANTALLA desacoplado del de la card vía `ContainerSurface.screenBgColor`) + §16 (apariencia
POR-FIELD `fieldAppearances` en slots composable: color por chip/estadística — REQUIERE paridad
core_dart) + §17 (el detalle deja de forzar 'title' oculto, Studio-only sin trabajo Flutter)
+ §18 (StatsRow honra appearance+fieldAppearances —el componente stats_row ignoraba TODA
apariencia—; y mini-cartas apilan capas 3D para cartas sin arte plano como Ignis. REQUIERE
paridad core_dart). Todo META (NO bump).
Handoff Flutter en la cola (§10–§18 del doc). Mantener cola al día.

2026-06-24 — sesión Studio (KRO-198 cont.). Render-only nuevo a espejar: §25 acento
`accentStyle` (5 estilos, DATA) + §26 disposición de chips (`chipGrid`/`chipPlacements`/
`chipWidth`/display-por-chip, DATA) + font ampliado a 11 familias (CONTRATO, KRO-218).
Issues Drift Sync: KRO-218 (font) + 2 nuevos (acento §25, chips §26). NINGUNO bumpea
PROTOCOL_VERSION salvo font (aditivo, sigue 4.0.0). SDK en `b0840ef`.

2026-06-29 — sesión Flutter. Sync TS→Dart contra `origin/main` `d3418dc`. **Estado real
reconciliado**: KRO-219/220/221 (acento/chips/fieldAppearances) YA mergeados (batch
`d92a1f3`); api-parity = 38 símbolos, 0 sin espejar; drift-CI rojo SOLO por versión
(core_dart 3.3.0 vs TS 5.1.0 + protocolVersion); corpus `dart test` 626 verde.
**KRO-217 (paridad de fixes del motor 6346aea) — HECHO** ([kromia-sdk#13], Jira→En revisión):
`section_title` honra apariencia (color/tamaño/peso/align/recorte/efecto/padding) + galerías
de bloque propagan apariencia por celda (`_galleryCell`: objectFit/encuadre/zoom/forma/efectos);
`badge_row` ya estaba (KRO-220). Render-only, sin bump. Suite 70/70. Pendiente del ticket: los
recipe-presets siguen en TS (diferidos). **Cola Flutter restante**: KRO-224 (iridescent_foil 5
capas), KRO-228 (CardBack+resolveCardBack+QR), KRO-215 (tipos cartas físicas DATA), subir versión
core_dart→5.1.0 (cierra drift-CI), KRO-222 (mergear PR #11), KRO-212 (suscripciones app).

2026-06-30 — sesión Flutter. **Sync TS→Dart CERRADO + drift-CI VERDE.** Todo mergeado a `main`
(SDK `489e22f`, mobile `3fa8aa2`): **KRO-222** stats truncateChars/break-words (#11) · **KRO-217**
apariencia presets (#13) · **KRO-224** catálogo iridescent_foil core_dart (#14) + render 5 capas
en la app (mobile #7, `IridescentFoil`: foil/sheen/glare/noise/border, BlendMask) · **KRO-228**
modelo `CardBack`+`resolveCardBack`+`matchConditionalCase` core_dart (#15) + render reverso/flip/QR
en la app (mobile #8, `CardBackView`/`CardFlip`) · **KRO-215** tipos cartas físicas DATA
(`CardIdentity`/`CardOwnership`/`TransferToken`/`CardQrPayload`+`ownershipBadge`, #16) · **bump
core_dart 3.3.0→5.1.0** pubspec+protocolVersion (#17). **drift-CI verde**: version-drift TS 5.1.0
== Dart 5.1.0, corpus `dart test` 646, api-parity 38 símbolos sincronizados. **Hallazgo**: el
"Estilo por valor" (`matchConditionalCase`) NO estaba espejado en core_dart → añadido (lo reúsa el
reverso). **Notas para Studio**: (a) iridescent_foil — aproximaciones en la app pendientes de tu
verificación visual: noise (Flutter no tiene feTurbulence → speckle), pattern `midnight` (sin stops
en KRO-224 → provisional; ¿me pasas los stops?), 9 bordes ornamentales SVG → anillo sólido; (b)
CardBack — `showQr` gateado a false hasta KRO-216, y `__section__` con `section:null` (la condición
por-campo sí va). **Resto de la cola**: KRO-212 (suscripciones app, UI propia) sigue pendiente —
NO es paridad de render. Aprobaciones Jira a "En revisión": KRO-217/224/228; KRO-215 (Epic)
comentado.

2026-07-02 — sesión Studio. **Flip al reverso v2** (spec `docs/card-flip-3d-spec.md`): en Studio
el flip pasó a girar el MODELO 3D entero (canto incluido, dorso = cara del sólido) + gesto de
"forzar el giro" por overshoot de arrastre. El `CardFlip` de mobile#8 quedó por detrás → handoff
en la cola (issue Drift Sync nuevo, hermano de KRO-228). `__section__` queda `section:null`
(decisión confirmada). Extra: `chipWidth:'fill'` en badge de slot único (SDK `f633dd1`).

2026-07-02 — sesión Flutter. **KRO-231 flip v2 HECHO + mergeado** (mobile#11, Jira→En revisión):
capa FLIP propia del `HoloCard` entre perspectiva y tilt (620ms `Cubic(.3,.7,.35,1)`,
`disableAnimations`→instantáneo, tilt vivo volteada); tapa kraft `-(N+1)` + DORSO como cara del
sólido `-(N+1.5)` rotateY(180°) — nota Flutter: sin backface-culling/orden Z, el orden de pintado
del dorso cambia en el medio giro (de perfil, invisible); gesto overshoot `|rawX-0.5|×2 ≥ 1.25`
una vez por gesto (reset al soltar), armado solo con `hasBack = image || (showQr && qr)`; pill
fallback Reverso/Anverso bajo la carta; placeholder del dorso `#1a1713`+halo dorado; `CardFlip`
plano ELIMINADO. Extra `chipWidth:'fill'` en badge de slot ÚNICO espejado (sdk#19, conformidad
26/26). Suite app 305/305. **KRO-228 → Completado** (autorizado por Studio; el v2 vive en KRO-231).
Pendiente: verificación visual del flip en dispositivo (captura → afinar).
2026-07-03 — sesión Flutter. **KRO-232 siluetas de carta HECHO + mergeado** (core_dart sdk#21 + app mobile#12, Jira→En revisión). Espejo 1:1 de `card-shapes.ts` (`ba91e02`): `CardFormat.shape/shapePath/shapeScale` + catálogo MÍNIMO (solo `standard`, SIN presets ni arcos — la descripción vieja del ticket con 6 presets/`A` está obsoleta) + `validateShapePath` (validador puro) + `cardShapePath`/`clampShapeScale`/`scaleShapePath`. Render app (`card_shape.dart`): parser M/L/C/Q/Z (0..1→tamaño+escala sobre el centro 0.5) + `CardShapeClipper`/`CardShapeClip` + `CardShapeShadow` (drawShadow siguiendo el path, no BoxShadow). Recorta el modelo 3D del focus ENTERO (cara+canto+dorso, el flip conserva la silueta) + la rejilla; `cornerRadius` se ignora con silueta; estándar = rect redondeado (sin regresión). +19 tests, corpus 659 / suite app 311. DATA, sin bump. Importador SVG/vectorizado + PhoneFrame = Studio-only. Polish pendiente: glow "rara" con forma en la rejilla + verificación visual con un shapePath real.

2026-07-09 — sesiones Studio+Flutter (**KRO-224** foil, device-QA A32). ⚠️ En sesión
ambos chats lo llamamos "KRO-133" por error — el ticket REAL del iridescent_foil es
**KRO-224** (KRO-133 = otra feature, Completado). **DIVERGENCIA DE
PARIDAD INTENCIONAL — el foil AVANZADO se renderiza en Studio/React pero NO en Flutter
(por ahora).** El user reportó que en la app el arte salía LAVADO (degradado iridiscente
brillante que tapaba la ilustración) en rejilla/foco, tanto con arte plano (Céfiro/034)
como con capas 3D (Ignis/006). Diagnóstico Flutter (verificado en A32, mobile#46 mergeado):
la causa NO es el blend ni la opacidad (probó foil 0.05→0.45, idéntico; y Skia == Impeller)
sino el **compositing de Flutter**: el arte se pinta en una CAPA DE COMPOSITING AISLADA
(`KromiaImage` con su `AnimatedSwitcher` cross-fade + `DepthLayerStack` con `Transform`),
así que el `saveLayer` del foil (color-dodge/screen) compone contra el FONDO CLARO de la
celda, NO contra el arte → satura a blanco. El navegador (mix-blend-mode, sin capas
aisladas) compone contra el arte real → se ve bien. **Decisión Flutter**: `VisualEffectLayers`
DESCARTA los 3 foils avanzados (`iridescent_foil`/`holographic_effect`/`custom_foil`) en la app
→ todas las cartas muestran su arte, idéntico en rejilla/foco/carrusel. Los efectos que NO
lavan se MANTIENEN (glow_border, crown_badge, frozen, vintage_filter, signed).
- **⚠️ SUPERSEDE** la línea del 2026-06-30 (KRO-224 "render 5 capas en la app, mobile#7"):
  ese render de `IridescentFoil` (foil/sheen/glare/noise/border con BlendMask) es el que
  lavaba → queda DESACTIVADO en mobile#46 (no borrado; el SET de topes 0.45/0.22/0.18/0.12
  que pasó Studio queda documentado en su código para la reimpl).
- **Studio/React SIN cambios** — su `VisualEffectLayers` renderiza los 3 foils vía CSS
  `mix-blend-mode` (color-dodge preserva negro → el arte oscuro sobrevive). Composición
  canónica (orden + gradientes + blends + valores) entregada a Flutter por `send_message`.
- **Reimpl pendiente (NO urge, el arte ya se ve)**: Flutter especifica `docs/foil-flutter.md`
  — reactivar el foil SIN `saveLayer`-contra-fondo, p.ej. un **fragment shader** que reciba
  el arte como sampler y aplique color-dodge PÍXEL a píxel contra el arte real, o una máscara
  por luminancia del propio arte. Tracking: **KRO-224** (Drift Sync — reimpl **ShaderMask
  HECHA** y verificada en iPhone 2026-07-09; cerrando solo la paridad del CONFIG: schema
  canónico en el comentario del ticket. El `hue` es GRADOS, el `blend` del config solo va
  a la capa foil, falta `saturate(1.25)` — gotchas típicos del drift de render).
- **✅ UPDATE 2026-07-09 (cierre KRO-224)**: Flutter **revirtió el descarte** de
  `iridescent_foil` + `holographic_effect` (mobile#54): reimplementados vía **ShaderMask**
  (envuelve el arte → `color-dodge(arte, foil)` real), verificado en iPhone, cero lavado →
  **KRO-224 Completado**. La divergencia de arriba YA NO aplica a esos 2; **solo `custom_foil`
  sigue descartado** (hasta el shader-con-textura, KRO-122). El lavado de Ignis/006 NO era la
  máscara por-capa de Flutter (correcta), sino el tagStyle del **albumSchema** `rareza=Rara →
  iridescent_foil {pattern:midnight, opacity:62}` sobre-todo (paridad con React) → el user lo
  ajusta por DATO en el editor de efectos-por-valor de Studio. (Los tagStyles viven en el
  albumSchema, no el cardSchema.)

2026-07-04 — sesión Studio. **KRO-129 favoritos/escaparate — slice BACKEND hecho; la UI Flutter es TUYA.** Feature colector-facing (NO Studio, lo dice el ticket). Contrato compartido: SDK tipos `Favorite`/`FavoriteCardRef` + helper `favoriteKey(albumId,cardIndex)` (normaliza `cardIndex` a String) en `@kromia/core` (`e60d953`, DATA, no bump). Backend módulo `Favorites` (`ee3e91d`): `GET /api/favorites?albumId=` → `{favorites:[{id,userId,albumId,cardIndex,order,createdAt}], total}` (curado por `order`); `POST /api/favorites/toggle {albumId,cardIndex}` → `{favorited:bool, favorite?}` (idempotente; índice único `userId+albumId+cardIndex`). Auth por `req.user.userId`, sin permiso especial. **Flutter (app coleccionista)**: (1) acción "anclar a favoritos" desde la carta / modo focus (KRO-128); (2) pantalla "Mi galería / escaparate" (grid de favoritos, reusa grid vivo + focus; usa `favoriteKey` para marcar el estado en la rejilla). NO es paridad de render — es UI+API nueva. Diferido (no bloquea): `reorder`/curaduría (el campo `order` ya está en el modelo, falta endpoint + UX), escaparate público/compartible (KRO-66), estantes múltiples. Contrato completo en el comentario de KRO-129.

2026-07-11 — sesión Studio. **`custom_foil` (foil PERSONALIZADO) — receta de render centralizada en el SDK → KRO-245 (Drift Sync).** El user reportó que la app pinta el custom foil como un **amarillo plano que tapa el arte**. Es el mismo lavado de KRO-224 pero para la pila de capas (textura+máscara+fusión+intensidad): el `custom_foil` quedó DESCARTADO en la app tras KRO-224 (solo él; iridiscente+holographic ya reactivados vía ShaderMask). Studio centralizó la RECETA de compositing (antes hardcodeada en `FoilLayer.tsx` = drift) en **`@kromia/core/custom-foil-recipe.ts`** (SDK `48a7564`, DATA render-only, NO bumpea el KRP): `EFFECT_LAYER_KINDS`, `EFFECT_BLEND_MODES`+guards, `CUSTOM_FOIL_LAYER_DEFAULTS`, `foilLayerOpacity` (default 0.6+clamp), `foilTextureLayout` (pattern tesela 160%/auto · foil-glitter lámina 250%×100%), **`CUSTOM_FOIL_MASK` (máscara por LUMINANCIA, no alfa)**, `CUSTOM_FOIL_TILT`, `CUSTOM_FOIL_SHIMMER`, **`EFFECT_BLEND_TO_FLUTTER`** (mapeo fusión→`BlendMode`). Spec canónica: **`docs/custom-foil-render-spec.md`** (orden de capas, compositing CONTRA EL ARTE, máscara luma→alfa `dstIn`, layout por kind, tilt, checklist). **Flutter (KRO-245)**: espejar la receta en `foil_recipe.dart` + reactivar el custom_foil vía ShaderMask/shader con el arte como sampler (blend píxel a píxel contra el arte real, no contra el fondo de la celda), máscara luma→alfa, textura+máscara por el proxy autenticado. Studio ya consume la receta (`67b968d`, valores idénticos test-locked). 2 causas típicas del amarillo plano: (a) blend contra el fondo, (b) máscara por alfa en vez de luminancia.

2026-07-11 — sesión Studio. **Panel de DETALLE de carta: texto oscuro sobre fondo oscuro (ilegible) → KRO-217 (Drift Sync).** El user reportó el detalle en la app con las stats en verde marca sobre navy vs Studio (tema fuego: fondo rojo, texto blanco). **Causa raíz (mapeada con 2 exploradores):** NO hay elección de color de texto en runtime en ninguna plataforma — la legibilidad se garantiza en EDICIÓN (`applyThemePreset` elige pares fondo↔texto WCAG-AA y PERSISTE `layout.surface.textColor` global). En web se propaga por **cascada CSS**; **Flutter no tiene cascada** → pinta `surface.bgColor` pero NO aplica `surface.textColor` → el texto cae al `foreground` del tema de app = oscuro sobre oscuro. **El modelo YA es DATA portable** (ViewComposition/SlotAppearance/ContainerSurface + `paletteHex`/`screenBgHex`/`extractAccentSettings`/contraste en `@kromia/core`, ya en `core_dart`) — **NO falta centralizar nada**; el gap es WIRING en la ruta del detalle de Flutter. **Fixes (Flutter):** (1) envolver el subárbol del detalle en un `DefaultTextStyle` con `paletteHex(surface.textColor)` (slot con color propio → override); (2) pantalla = `screenBgHex(surface.screenBgColor ?? surface.bgColor)`, panel = `paletteHex(surface.bgColor)`; (3) StatsRow aplica la apariencia EFECTIVA por stat (hoy hardcodea foreground/muted → stats verdes); (4) acento por `extractAccentSettings`+`accentStyle`. **Spec consolidada nueva: `docs/detail-appearance-parity-spec.md`** (SDK `8b84316`) — el algoritmo de color del detalle en un sitio + checklist. Complementa `kro198-detail-composition-flutter.md` (§12/§15/§18.1/§19.2/§20). Relacionado: KRO-220/221 (chips/fieldAppearances, en revisión).
