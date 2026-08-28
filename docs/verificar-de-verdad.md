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

## 3. Aísla antes de culpar al código

Un fallo bajo carga **no es** una regresión.

- La suite entera dio **177 fallos en 5 suites**; **cuatro pasaron aisladas**.
  Era el mongo en memoria sin arrancar en 10 s con dos emuladores encima.
- Antes de perseguir nada: **relanza la suite sospechosa sola**.
- Mide la máquina (`FreePhysicalMemory`, swap, procesos) — pero ojo: en Windows
  el «libre» bajo suele ser caché reclamable, no presión real.
- **No lances suites, builds ni subagentes mientras el user usa el emulador.**
  Saturé la máquina y le dejé el emulador sin servicio de entrada.

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
