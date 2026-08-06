# go-to-prod

**Cuándo aplica**: vas a mover Kromia a un servidor de verdad, o a cambiar
cualquier dominio, IP o host que ya esté en uso (backend, MinIO, túnel, base).

> **El fallo que este playbook existe para evitar**: una dirección se cambia en
> un sitio y se queda vieja en otro. No revienta nada — **la app instala
> perfectamente y no habla con nada**, el correo de activación llega con un
> enlace muerto, la imagen no carga y se pinta el hueco. Nadie se queja, así que
> nadie se entera. Ya nos ha pasado tres veces en un solo día (2026-08-06).

## Las CINCO capas donde vive una dirección

El error de siempre es acordarse de dos y olvidar las otras tres. Están ordenadas
de la más obvia a la más traicionera.

### 1 · `.env` del backend

| Clave | Qué rompe si se queda vieja |
| --- | --- |
| `HOST` | Es la base del `GOOGLE_REDIRECT_URI` por defecto. |
| `FRONT_ACTIVE_URI` | **El enlace del correo de activación.** Si lleva una IP de LAN, nadie de fuera puede activarse. |
| `FRONT_REDIRECT_LOGIN_URI` · `FRONT_RESET_PASSWORD_URI` | Deep links `kromia://`. No llevan host, así que sobreviven — pero exigen que la app tenga registrado ese esquema. |
| `GOOGLE_REDIRECT_URI` | Debe coincidir **EXACTO** con Google Cloud (capa 4). |
| `NGROK_DOMAIN` | Solo dev. En prod sobra: `pnpm tunnel` deja de tener sentido. |
| `MINIO_ENDPOINT_HOST` · `MINIO_ENDPOINT_PORT` | De dónde se sirven las imágenes. |
| `MONGO_ENDPOINT` | La base. |

⚠️ **`nodemon` NO vigila `.env`** → tras tocarlo, reiniciar el backend a mano.

### 2 · Variables de los repos (GitHub Actions)

- `kromia-mobile` → **`API_BASE_URL`** (`gh variable list`). Es la única cosa que
  decide con quién habla la app. Tiene que ser **`https://`**: en release, ATS de
  iOS bloquea el HTTP en claro y el `.ipa` sale mudo.
- El workflow **para** si falta o si no es `https://` (mobile #196). No le pongas
  un default «por comodidad»: el que había (`http://10.0.2.2:3000/api`, alias del
  emulador Android) producía builds que instalaban y no hablaban con nada.

### 3 · Entorno de Studio

`KROMIA_API_URL`, `NEXT_PUBLIC_KROMIA_API_URL`, `NEXT_PUBLIC_MINIO_PUBLIC_URL`
(ver `.env.local.example`). Ojo a los **defaults en el código**
(`src/lib/constants.ts`, `minio-client.ts`, `minio-auth.ts`): si la variable
falta, caen a `localhost` **sin avisar**.

### 4 · Fuera del código — hay que entrar a mano

- **Google Cloud Console** → *Authorized redirect URIs* del cliente
  `542994233038-djhibg5k…` (el que se llama «kromia-flutter» pero es el WEB del
  backend; los otros dos no valen). Debe coincidir carácter a carácter con
  `GOOGLE_REDIRECT_URI`. Los cambios tardan minutos en propagar.
- **DNS / certificado** del dominio nuevo.
- **Atlas** → lista de IPs permitidas, si el servidor cambia de sitio.

### 5 · La base de datos ⚠️ la que se olvida

Hay direcciones **guardadas como dato**, que ningún `.env` cambia:

- **Perfiles de almacenamiento** (`storage-profiles.ts` → `publicUrl`): se
  guardan en Ajustes y **ganan al `.env`**. Cambiar `MINIO_ENDPOINT_HOST` y
  dejar el perfil viejo apuntando a otro sitio es exactamente el bug.
- **URLs absolutas en las cartas** (`data.cards[].images.*`, `__depthLayers[].url`).
  Hoy sobreviven a un cambio de host **por suerte**: nadie usa el host que
  llevan dentro, porque `objectKey()` lo descarta y se queda con la clave. Es lo
  que hace que Holy Cards siga viéndose apuntando a un MinIO muerto.

  **Lo que rompería esa suerte**: pasarle `publicUrl` a `objectKey`. Con base
  conocida exige que el host coincida (`if (u.host !== baseUrl.host) return null`)
  y las URLs viejas devolverían `null`. Si algún día se hace, hay que migrar el
  dato **antes**.

## Pasos

- [ ] Inventariar qué direcciones cambian y **listar las cinco capas** de arriba.
- [ ] Cambiar `.env` del backend y **reiniciarlo** (nodemon no lo ve).
- [ ] `gh variable set API_BASE_URL` en kromia-mobile — **`https://`**.
- [ ] Entorno de Studio, incluidos los defaults del código.
- [ ] Google Cloud: registrar la redirect URI nueva **antes** de cortar la vieja.
- [ ] Mirar los **perfiles de almacenamiento en Ajustes**, no solo el `.env`.
- [ ] Verificar con una petición real, no leyendo config (ver abajo).
- [ ] Cortar build nueva de la app **después**, no antes.

## Cómo verificar (medir, no deducir)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio-nuevo>/api/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<dominio-nuevo>/api/diagnostics
```

- `/api/health` → **200**. No pide token: si no da 200, no sigas.
- Una ruta con Bearer → **401** significa *«existe y la puerta funciona»*. Un
  **404** significa *«esa ruta no está desplegada»*. Distinguirlos ahorra días.
- **Una imagen de verdad**, no la config: el proxy junta `.env`, perfil de
  almacenamiento y clave del objeto. Es donde se ve si alguna de las tres quedó vieja.
- **El correo de activación**: dárselo a alguien fuera de la red. Es la única
  forma de cazar un `FRONT_ACTIVE_URI` con IP de LAN.

## Pitfalls conocidos

- **Un default es una trampa, no una red de seguridad.** Los tres casos del
  2026-08-06 fueron defaults o silencios: `http://10.0.2.2` en el workflow, los
  `localhost` de Studio, y un validador que descartaba un tipo desconocido sin
  decir nada. Si falta una dirección, **fallar es mejor que adivinar**.
- **La app no habla con «producción»: habla con lo que diga su `API_BASE_URL`.**
  Mientras eso sea el túnel, depende de que el portátil esté encendido — y los
  cambios del backend son efectivos en cuanto recarga nodemon, sin desplegar.
- **La query de una URL puede llevar tokens** (KRO-312). Al mover direcciones no
  pegues URLs completas en tickets ni en logs: usa `rutaSinSecretos`.
- **Una ruta con un carácter sin escapar** ya no da 500 (KRO-321), pero sigue
  siendo un 4xx: si migras rutas con acentos —`Córdoba`—, percent-encodéalas por
  segmentos, decodificando antes de codificar.

## Last verified

2026-08-06 — inventario extraído de los tres repos (KRO-323, KRO-325).
