# Verificar de verdad — el método de depuración de Kromia

> Doc **canónica**. La skill `verificar-de-verdad` (en `.claude/skills/`, que no
> se versiona) apunta aquí: si cambias algo, cámbialo en este fichero.
>
> Nace de la sesión de campo del **2026-08-27**, el día que se probó el trueque
> entre dos dispositivos reales de punta a punta. Cada regla lleva el fallo
> concreto que evita, no la buena intención.

# Verificar de verdad

> **La regla madre**: un control que solo sabe decir que sí es indistinguible de
> uno que funciona. Y un test verde que nunca has visto rojo es exactamente eso.

## 1. Rojo antes que verde. Siempre.

Un test que no has visto fallar no sujeta nada.

- **Escribe el test ANTES de arreglar**, contra el código roto. Si pasa, el test
  está mal, no el código.
- Si ya arreglaste, **sabotea el arreglo** y comprueba que cae.
- **Mira el RECUENTO, no solo el color.** `Tests: 0 total` no es rojo: es que la
  suite no compiló. Pasó de verdad — tres sabotajes a la vez rompieron el
  fichero y casi lo doy por verificado.
- **Sabotea de uno en uno.** Juntos no sabes cuál caza qué.
- **Comprueba que cae SOLO lo que debe.** Si el sabotaje tumba también el
  control, tu montaje está mal.

**Lo que esto destapó**: `validateOfferedCardQuantities` recibía la oferta como
si fueran las cartas poseídas — comparaba la oferta consigo misma y **nunca pudo
fallar**. Meses en verde. Y su hermano: una cantidad negativa **invertía el
sentido del intercambio** (ofrecer «menos una» carta era quitársela al otro).

### Si el sabotaje NO lo pone rojo: la precondición no estaba montada

Es el reverso de la regla de arriba, y es el fallo más repetido de los dos
chats: en una sola noche cayeron **cuatro tests** con esta forma exacta. Un test
que **afirma un estado de partida que nunca llegó a montar** pasa en verde
diga lo que diga el código.

Se presenta de tres maneras, y ninguna se ve leyendo el test:

- **El estado de partida por defecto no es el que crees.** Una sala de trueque
  arranca en `espera` y **fuera** de la sala. Un test que dice probar «no se
  manda nada sin haber aceptado» pasaba por el guarda **de al lado** —el del
  estado—, así que el guarda que decía probar se podía **borrar entero** y
  seguía verde. Otro no llegaba a mandar nada porque el montaje estaba fuera de
  la sala, no porque el enlace estuviera bien.
- **El paso anterior no llegó a guardar.** Un «retirado» parecía funcionar
  porque el disco ya decía `propose_trade`: la aceptación nunca se había
  persistido, y el test no lo comprobaba.
- **Mides el efecto de al lado.** Contar llamadas a algo que **el paso previo ya
  hizo**, o fotogramas de una animación que **no es la tuya** (el color va en su
  propio tween, así que siempre hay *algo* moviéndose). El test dice que sí a
  una pregunta que no es la que crees estar haciendo.

**Cómo se caza**: sabotea, y si sigue verde **no lo dejes pasar** — no es que el
código esté especialmente bien, es que el test no lo está tocando. Después
**afirma la precondición dentro del propio test** (`expect` sobre el estado de
partida, antes de actuar) y **ata la medida a la cosa concreta**: no «¿pulsa
algo?», sino «¿pulsa *este*?».

> Un test que pasa por el guarda de al lado protege el guarda de al lado.

### Y su hermana: comprobar la FORMA en vez del EFECTO

La de arriba es que el test no llega a tocar el código. Ésta es peor de detectar
porque el test **sí** lo toca: lo que falla es *qué mira*. Afirma sobre algo
**adyacente** —un valor intermedio, la forma del código, un campo que él mismo
escribió— en vez de sobre lo observable.

El 2026-09-03 salieron **seis casos en un día entre los dos chats**, todos con
esta cara:

- **Un valor intermedio en vez del efecto.** Tests que afirmaban sobre
  `KromiaImage.ancho` —el campo del widget— cuando lo que importa es el `?w=`
  que sale a la red. Entre los dos hay dos funciones que pueden fallar. Verdes
  con el original bajándose igual.
- **Un campo que el propio test escribió.** Un test construía el JSON de
  respuesta con el campo dentro y luego comprobaba que el parser lo leía:
  verificaba **su propia escritura**. Ningún test de modelo puede cazar que el
  servidor deje de mandar un campo — eso vive donde está el riesgo, en el
  endpoint.
- **Que el guarda EXISTA en vez de que GOBIERNE.** Un aserto comprobaba que
  existiera la lista filtrada… y el bucle que la consume podía seguir usando la
  sin filtrar. Guarda impecable que no manda sobre nada.
- **Tokens en vez de comportamiento.** Un aserto pedía que el cuerpo de una
  función contuviera `scope !== 'album'`, `porAlbum` y un `.filter(`. Un
  `return perms;` metido en la primera línea deja los tres tokens **intactos** y
  la función sin filtrar nada. Verde con el fallo puesto.
- **Se cumple por la OTRA ocurrencia.** Un aserto buscaba «un filtro sobre
  `PERMISSION_GROUPS`» y había dos en el fichero: quitar el del render seguía
  verde porque el del envío lo satisfacía.
- **Un sabotaje que no discrimina.** Comparar dos modos de pintado que producen
  el mismo píxel en la zona medida: el test no distinguía cuál estaba puesto.

**El olor común**: si puedes romper el comportamiento sin romper el test, estás
mirando la forma. Y el sabotaje es lo único que lo destapa — los seis casos
salieron ahí, no leyendo.

**Qué hacer**:

- Afirma sobre **lo que sale**: la URL, la fila en la base, el píxel, la
  respuesta HTTP. No sobre el paso de en medio.
- Si el test **fabrica su entrada**, no está comprobando a quién se la pide.
- Un aserto sobre el fuente vale para fijar una regla estructural, pero
  **anclado**: si el patrón que buscas aparece dos veces en el fichero, tu
  aserto se cumple por la copia que no te importa.
- Y cuando puedas, **exporta la función y pruébala llamándola**. Comprobar texto
  es el último recurso, no el primero.

> Si el sabotaje deja el test verde, el problema es del test — aunque el test lo
> hayas escrito para cazar exactamente eso.

## 2. Mira el dato antes de teorizar

Los nombres de las funciones mienten; los datos no.

- Lee **la base**, la **traza**, el **log** — no el nombre del método.
- ¿Un botón no hace nada? Antes de culpar al cliente, **mira si el servidor lo
  registró**. Puede estar llegando y no pintándose. O al revés.
- ¿Un ANR? La **traza del hilo `main`** dice exactamente qué lo bloquea.
- ¿Se movieron las cartas? **Cuéntalas antes y después.**

**Cuidado con lo que solo vive en memoria.** Leer el disco entre dos pasos puede
enseñarte un estado que la pantalla ya superó. Pasó: di por no entregada una
aceptación que sí había llegado — y de tirar de ahí salió que la primera
aceptación **no se persistía** (KRO-395).

### El mensaje de error suele nombrar la causa equivocada

Cuatro veces en una sola sesión, y ninguna se resolvió razonando mejor:

| lo que decía | lo que era |
|---|---|
| un punto verde suelto, «resto de render» | la **ruedecita de carga** girando para siempre — el problema entero |
| `sala e5e1166c inexistente` | existía; lo que pasa es que **terminó** y se olvida de memoria |
| `Instance failed to start` (mongod) | arrancaba bien: **tardaba más de los 10 s** del timeout |
| el GPS «se abre y se cierra a los 4 s» | eran 4 s porque **ya tenía la posición**: era un éxito |

Los cuatro se cerraron **encendiendo algo** —una sonda, el modo depuración, un
test que ejecutara lo que se estaba deduciendo— y no pensando más rato.

**El detalle que no encaja no es un detalle menor: suele ser el síntoma
entero.** Si tu explicación deja algo fuera, la explicación no está terminada.

### Cuando dos explicaciones predicen lo mismo, no elijas: instrumenta

Es la trampa de la que salen los mecanismos inventados. «El emulador cortó la
petición» y «la posición llegó y por eso se cerró» **predicen exactamente el
mismo log**, así que mirarlo otra vez no decide nada, y la que se acaba
eligiendo es la cómoda.

Lo que decide es buscar el sitio donde **solo una de las dos puede dejar
rastro**: aquí, si el servidor había recibido la posición. Una sonda temporal y
`precisionM: 5` cerraron en diez minutos lo que llevaba horas discutiéndose.

Y ojo con el final feliz: **si aciertas sin comprobarlo, el acierto no valida el
mecanismo — lo esconde**, y la costumbre de inventarlo queda intacta.

## 3. Aísla antes de culpar al código

Un fallo bajo carga **no es** una regresión.

- La suite entera dio **177 fallos en 5 suites**; **cuatro pasaron aisladas**.
  Era el mongo en memoria sin arrancar en 10 s con dos emuladores encima.
- Antes de perseguir nada: **relanza la suite sospechosa sola**.
- Mide la máquina (`FreePhysicalMemory`, swap, procesos) — pero ojo: en Windows
  el «libre» bajo suele ser caché reclamable, no presión real.
- **No lances suites, builds ni subagentes mientras el user usa el emulador.**
  Saturé la máquina y le dejé el emulador sin servicio de entrada.

### Y su reverso: si el fallo DESAPARECE al sondearlo, mide otra cosa

Aislar sirve para no culpar al código de lo que es la máquina. Esto es al revés:
**la sonda que exculpa al código y no debía.**

- 2026-09-04, KRO-427. Monté una sonda para probar que un cierre fallido dejaba
  el trueque a una sola pulsación de ejecutarse. Salió **verde**: la segunda
  pulsación daba `close_too_far`. A punto estuve de anotar «no se reproduce».
  Lo que pasaba es que `olvidarPosicionesDe` corre **también** cuando el cierre
  falla, así que mi sonda —que mandaba la posición una sola vez— se quedaba sin
  ubicación. Eso **no es un guarda**: en una quedada de verdad los dos móviles
  siguen mandando ubicación solos. Reenviando posición, como pasa en la
  realidad, el agujero aparece entero y las cartas cambian de dueño.

Un fallo que se esconde detrás de un mecanismo **que no está ahí para eso** está
tapado por un accidente, y los accidentes se caen solos. Antes de escribir «no
se reproduce», pregúntate: *¿lo que lo ha parado existe para pararlo?* Si la
respuesta es no, tu sonda está midiendo otra cosa.

El primo hermano, el mismo día y en el otro chat: un parche correcto puesto en
**la otra ocurrencia de la misma función**, un caso que se le parecía mucho y en
el que justamente no debía aplicarse. Lo cazó que el test seguía rojo, no una
relectura. Los dos casos se vieron **ejerciendo el camino real**, y ninguno se
habría visto leyendo.

## 4. No destruyas tus propias pruebas

Tres veces en un día perdí la evidencia por filtrarla yo mismo:

- `| tail -25` y `| grep` se comieron el motivo de un fallo.
- `2>&1 > fichero` manda stderr al terminal y **pierde el resumen** — el orden
  correcto es `> fichero 2>&1`.
- Un `&&` tras un `grep` que **encontró** «FAILURE» siguió adelante e instaló una
  build vieja en dos dispositivos.

**Captura crudo a fichero y luego filtra.** Y comprueba la ruta de los tests: un
`npx jest tests/unit/x` que no existe dice «0 matches» y **parece que pasó**.

## 5. Antes de reportar un fantasma

Cuatro veces estuve a punto de abrir un ticket de algo que no era:

- **Espera.** «No carga» era carga; a los 25 s aparecía.
- **Scrollea.** «Falta el botón» era el botón tapado por la barra fija.
- **Mira si es estado transitorio.** Un título «Trueque» era un placeholder.
- **Mira la red y la build.** «El móvil no conecta» era mi APK apuntando a
  `10.0.2.2`, que solo existe en el emulador.

Si al final era falsa alarma, **dilo**. Retirar una acusación vale tanto como
levantarla.

## 6. En dispositivo: prueba donde duele

- **El emulador no es la prueba buena.** `adb emu geo fix` inyecta un punto
  suelto, no un flujo de GPS: un `getCurrentPosition` de alta precisión puede no
  volver nunca. Lo que se cuelga ahí puede ir bien en un móvil real — y al
  revés.
- **Prueba también en 720×1600.** Tres fallos de maquetación reales solo se
  veían en el móvil pequeño; en el Pixel del emulador no existían.
- **Comprueba que instalaste lo que crees**: `lastUpdateTime` de `dumpsys
  package` contra el reloj del host. El emulador va en UTC.
- Detalles caros: dos emuladores a la vez → el segundo **no pinta nada** salvo
  con `-gpu swiftshader_indirect`. Y la build para móvil físico necesita
  `--dart-define=API_BASE_URL=http://<IP-LAN>:3000/api` o la de ngrok.

## 7. Analiza la interfaz, no solo el flujo

Que el flujo llegue al servidor no significa que esté bien.

- **Mira la pantalla como un usuario primerizo.** ¿Se entiende qué hace este
  botón? ¿Se ve lo que he venido a ver?
- **Mide cuando puedas.** «Se ve poco» es una queja; «las cartas ocupan el 4 % de
  la pantalla y el pie de página el 22 %» es un argumento — y fue lo que movió
  la prioridad.
- **Nada pulsable puede quedarse mudo.** Un botón que no responde manda a la
  gente a pulsarlo otra vez, y eso empeoró un ANR.
- **El botón dice lo que quieres hacer, no lo que te lo impide.**

## 8. Al escribir el ticket

- **Escenario concreto**: quién manda qué, en qué estado, y qué sale mal. Si no
  sabes escribirlo, no es un hallazgo.
- **Por qué no lo cazó nadie** — suele ser la parte más útil.
- **La salvedad honesta**: lo que NO has podido comprobar, y por qué.
- Nada de «sería bueno añadir». Solo defectos reales.
- Si el asset o el dato no existe, **dilo en el ticket** para que nadie se
  bloquee a mitad.

## 9. Trabajando con el otro chat

- **No edites sus ficheros.** Si el user te lo pide y su sesión no está viva,
  hazlo — y **díselo lo primero** cuando vuelva, con el diff y la suite.
- **Comprueba sus informes contra el código.** «Ya está arreglado» resultó ser
  el fichero equivocado; un `grep` del texto enseñó las dos copias.
- **El destinatario se saca de `ListAgents` justo antes de escribir**: los
  nombres cambian, y recibir un mensaje suyo no garantiza poder contestar.
- Si no está alcanzable: **cola de handoffs en `COORDINATION.md` + el contenido
  entero en el ticket de Jira.**

## 10. Lo que no se hace sin preguntar

- **Deducir dónde vive el user.** Mover un emulador leyendo la distancia hasta
  acertar es triangular su casa. Si autoriza, lee el GPS de su propio móvil —
  no geocodifiques su dirección en un servicio externo.
- **Tocar el firewall**, rotar claves, o meter credenciales en un formulario.
- **Pushear** sin permiso explícito. Y nunca `--no-verify`: si el hook falla por
  entorno, **reintenta**, no lo saltes.

---

## Recordatorio final

El síntoma visible **casi nunca es el fallo**. El mensaje que decía «no tienes
tantas repetidas» tapó durante meses que el control de cantidades no existía. El
botón que «no hacía nada» tapaba una llamada síncrona bloqueando el hilo de
interfaz.

Cuando el diagnóstico acierte, **audita el mecanismo aparte**: el acierto no lo
valida, lo esconde.
