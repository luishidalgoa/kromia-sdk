# Cartas físicas — Spec de fundación (Epic KRO-215)

> **Estado**: diseño / planificación. Define la **fundación compartida** del ciclo
> de vida de la carta física para que, cuando lleguen los prerequisitos no-código
> (piloto de publisher para KRO-16, research de imprenta para KRO-216), el build
> sea rápido y sin drift. **No es de implementar ahora** — es el contrato.
>
> **Estado de implementación (KRO-215, sesión 2026-06-29)**: el TRONCO de tipos
> (`CardIdentity`/`CardOwnership`/`TransferToken`/`CardQrPayload` + `ownershipBadge`)
> SÍ se aterrizó en `@kromia/core` como contrato SDK-first (DATA, no bumpea el KRP).
>
> **⚡ ACTUALIZACIÓN 2026-07-03 — el BACKBONE DIGITAL de KRO-16 ESTÁ CONSTRUIDO**
> (decisión del user: ir por delante del gate del piloto). Lo digital NO depende
> del research de imprenta (§8) — solo el export listo-para-imprenta (KRO-216)
> sigue bloqueado. Ver **§10** para lo implementado (firma ECDSA + endpoints
> scan/transfer + tests). Espejo `core_dart` de `card-qr.ts` + scanner Flutter =
> handoff abierto.

## 0. Alcance

**Cubre** (diseñable hoy, sin dependencias externas):
- El modelo de datos compartido: **identidad de carta** + **propiedad** (`CardOwnership`) + **transferencia**.
- El contrato del **QR firmado** de carta (distinto del QR de *preview* actual).
- La derivación **Verificada vs Declarada** (el badge).
- El reparto **SDK-first** (`@kromia/core` ↔ `core_dart`, backend, Studio, Flutter).

**NO cubre** (research abierto → §8):
- El protocolo de **imprenta industrial** de KRO-216 (VDP, formato de entrega, quién mintea).

**Estado base verificado en código** (lo que existe hoy):
- `metadata.physicalTracking: 'self-declared' | 'qr'` (default `self-declared`; `'qr'` declarado pero **no seleccionable** en el editor, badge "Próximamente").
- **self-declared operativo**: colección en `user_albums.album.data.ownedCards = [{ index, quantity }]` + endpoints `addCards`/`removeCards` + selector en el wizard. **NO existe `CardOwnership`** rico: hoy es solo `{index, quantity}`.
- **QR de PREVIEW** (KRO-66): `sandbox-token` (JWT, TTL 30 min, **por-álbum**) + `AlbumPreviewQRDialog`. **NO es identidad de carta.**
- **NO existe**: fabricación/sobres/tirada · identidad de instancia física · propiedad verificada.

⇒ Esta spec define la **evolución backward-compatible** desde ese punto.

## 1. La bifurcación (el corazón del epic)

`physicalTracking` se decide **en fabricación**, antes de imprimir la tirada, y **no es migrable**:
- `qr` → rama **verificada** (KRO-16): propiedad probada, anti-fraude, transferencias.
- `self-declared` → rama **declarada** (KRO-214): el user marca lo que tiene; no probada.
- `none` → sin tracking físico. *(Decisión pendiente: hoy el enum solo tiene 2 valores; añadir `none` es trivial pero hay que confirmarlo.)*

Una tirada nueva CON QR es **otra tirada**, no una migración de la SIN QR.

## 2. Modelo de datos (SDK-first — `@kromia/core`, espejo `core_dart`)

### 2.1 `CardIdentity` — la identidad de la instancia física (rama QR) · NUEVO

```ts
interface CardIdentity {
  id:        string;            // token único OPACO = el contenido firmado del QR
  albumId:   string;
  cardIndex: string | number;   // qué carta del álbum es esta instancia
  serial?:   string;            // nº legible de tirada opcional, p.ej. "0123/5000"
  mintedAt:  string;            // ISO — minteado en fabricación (KRO-216)
  // firma: ver §3 (no se guarda en claro; el `id` la incorpora o la resuelve el backend)
}
```
- **Una por instancia física.** Se mintea en KRO-216 y se siembra "sin dueño".
- Es la **identidad** que KRO-16 valida en cada escaneo.

### 2.2 `CardOwnership` — propiedad (compartido por AMBAS ramas)

```ts
type OwnershipSource = 'qr' | 'manual' | 'code' | 'photo';

interface CardOwnership {
  userId:      string;
  albumId:     string;
  cardIndex:   string | number;
  source:      OwnershipSource;
  verified:    boolean;          // true SOLO si source==='qr' y la identidad valida
  quantity:    number;           // self-declared puede ser >1; qr = 1 por identidad
  identityId?: string;           // FK a CardIdentity (solo source==='qr')
  acquiredAt:  string;           // ISO
  photoUrl?:   string;           // self-declared S4 (foto→sugerencia)
}
```

**Evolución desde lo actual** (clave de la compatibilidad):
- Hoy `ownedCards = [{ index, quantity }]` ≡ `{ source:'manual', verified:false }`. **No requiere migración**: los registros existentes se leen como self-declared manual.
- **self-declared se queda simple** (index + quantity, `source:'manual'|'code'|'photo'`, `verified:false`).
- **QR añade** `identityId` + `verified:true` + regla **1-por-identidad** (no hay "quantity" en QR: cada carta física es una identidad única).
- `verified` es **derivado**, no auto-declarable: el backend lo pone true solo tras validar la firma + resolver la identidad.

### 2.3 `TransferToken` — transferencia entre dueños (rama QR, KRO-16) · NUEVO

```ts
interface TransferToken {
  id:         string;
  identityId: string;   // qué carta física se transfiere
  fromUserId: string;
  createdAt:  string;    // ISO
  expiresAt:  string;    // ISO — TTL corto (handshake del intercambio)
}
```
- A genera el token → B escanea el QR + reclama dentro del TTL → la `CardOwnership` se mueve A→B y se registra en el historial.

## 3. El QR firmado de carta (contrato)

- El QR codifica un **payload firmado criptográficamente** con una clave de Kromia/publisher (**asimétrica**: Kromia firma con la privada; cualquiera verifica con la pública → autenticidad sin secreto compartido).
- Payload sugerido:
  ```json
  { "v": 1, "kind": "card-identity", "id": "<opaco>", "albumId": "...", "cardIndex": 5, "serial": "0123/5000", "sig": "<firma del resto>" }
  ```
- **Verificación = 2 capas**: (a) **firma válida** ⇒ es una carta genuina de ese publisher/tirada (autenticidad, offline-verificable); (b) **resolver la identidad en backend** ⇒ propiedad actual.
- **Distinto del QR de preview actual**: el de preview es `sandbox-token` (JWT, TTL 30 min, **por-álbum**, efímero). El de carta es **permanente, por-instancia, firmado para verificación pública**. Se puede **reusar la maquinaria de firma** (la del sandbox) pero sin TTL y por-carta.

## 4. Verificada vs Declarada (el badge)

Helper puro en el SDK (espejo Dart):
```ts
function ownershipBadge(o: CardOwnership): 'verified' | 'declared' {
  return o.source === 'qr' && o.verified ? 'verified' : 'declared';
}
```
- **Verificada**: `source:'qr'` + identidad válida + es tuya.
- **Declarada**: manual / code / photo. **Honestidad de producto**: declarada NO es anti-fraude; el badge hace visible el nivel de confianza.

## 5. Endpoints implicados (sketch, para KRO-16 — NO ahora)

- `POST /cards/scan` `{ qrPayload }` → verifica firma + resuelve identidad:
  - sin dueño → **reclama** (crea `CardOwnership` source='qr', verified).
  - tuya → no-op (ya la tienes).
  - ajena **sin** token de transferencia → **403 anti-fraude** ("registrada por otro coleccionista").
  - ajena **con** `TransferToken` válido → **transfiere** A→B.
- `POST /cards/transfer` `{ identityId }` (dueño) → genera `TransferToken` (TTL).
- self-declared ya tiene `addCards` / `removeCards` (KRO-214).

## 6. Reparto anti-drift (SDK-first)

| Capa | Responsabilidad |
|---|---|
| **`@kromia/core`** (+ `core_dart`) | Tipos `CardIdentity`/`CardOwnership`/`TransferToken` + schema del payload QR + `verifyCardQrSignature` (verificación PURA con clave pública) + `ownershipBadge` + validadores. |
| **Backend** | Persistencia (modelos) · **minteo + FIRMA** (clave privada, SOLO backend) · `/cards/scan` + transfer · anti-fraude · auditoría. |
| **Studio** | El editor declara el modo (ya existe). Cuando exista fabricación (KRO-216): lanzar/descargar la tirada. **El escaneo NO vive aquí.** |
| **Flutter** | Escáner de cámara (scan/transfer) · "Mi colección" con badges Verificada/Declarada · (self-declared: grilla check-off, ya pendiente en KRO-214). |

## 7. Migración / compatibilidad

- `ownedCards` actual (`{index, quantity}`) sigue válido como self-declared manual — **cero migración** inmediata.
- Al añadir los campos ricos (`source`/`verified`/`identityId`), default `source:'manual', verified:false` para lo existente.
- `none` como 3er modo: decisión de producto pendiente (no bloquea el resto).

## 8. Research questions — Fabricación (KRO-216), NO resueltas aquí

Estas son **incógnitas externas** (imprenta industrial) que hay que cerrar antes de implementar KRO-216:
1. **VDP (Variable Data Printing)**: ¿formato de entrega = PDF/X con el QR ya impuesto, o **dataset + plantilla** que impone la imprenta?
2. **Colocación / tamaño / nivel de corrección de error** del QR en el reverso.
3. **¿Quién mintea?** Kromia entrega el paquete completo de QRs firmados, **vs** la imprenta pide los QRs a un endpoint en tiempo de impresión.
4. **Composición de sobres**: pesos por rareza (KRO-28) + **seed reproducible/auditable**.
5. **Serialización**: rango/formato de seriales por tirada; volumen.

## 9. Secuencia recomendada (tronco → ramas)

1. ✅ **self-declared** (KRO-214) — SDK+backend+Studio hechos; **falta Flutter** (handoff redactado).
2. **Esta spec** (fundación) — review + validar el modelo + el contrato QR. **(Tipos aterrizados en `@kromia/core` el 2026-06-29.)**
3. Cuando haya **publisher piloto** (desbloquea KRO-16) **Y** se cierre el **research de imprenta** (KRO-216): implementar `CardIdentity` + minteo/firma + `scan`/`transfer`.
4. **KRO-17** (trades): Fase 1 digital arrancable antes; Fase 2 física/GPS bloqueada por compliance.

## 10. Backbone digital de KRO-16 — CONSTRUIDO (2026-07-03)

Lo digital (firma/verificación + scan/transfer + propiedad) es **independiente**
del research de imprenta (§8). Implementado y testeado; el export para VDP
(KRO-216) sigue bloqueado.

### 10.1 `@kromia/core` · `card-qr.ts` (contrato, SDK-first · commit `2b1036e`)
- **Cripto: ECDSA P-256 + SHA-256**, firma **IEEE P1363** (raw r‖s, 64 bytes)
  base64url; clave pública como **JWK**. Elegido por portabilidad TS↔Dart total.
- `cardQrSigningInput(payload)` = los BYTES EXACTOS firmados (unión por `\n`,
  orden fijo `v,kind,id,albumId,cardIndex,serial`). **Es el ancla cross-platform.**
- `serializeCardQrPayload`/`parseCardQrPayload` (contenido del QR), `validateCardQrPayload`,
  `verifyCardQrSignature(payload, publicJwk)` (WebCrypto, PÚBLICA, offline).
- +9 tests (firma↔verif, manipulación, clave ajena).

### 10.2 Backend · módulo `Cards` (`5152a8b`)
- `cardQrKeys.service`: clave ECDSA (env `CARD_QR_PRIVATE_KEY_JWK` → fichero
  `.card-qr-key.json` gitignored → generar). Firma con Node crypto (P1363).
- Modelo `CardIdentity` (propiedad 1-por-identidad + historial). `TransferToken`
  = JWT (reusa la maquinaria del sandbox, TTL 15min, server-validado).
- Endpoints (todos en el api-map): `GET /cards/public-key` (público) ·
  `POST /cards/mint` (`card:mint` = admin/publisher, minteo de PRUEBA) ·
  `POST /cards/scan` (reclamar / ya-tuya / **anti-fraude 403** / transferir) ·
  `POST /cards/transfer` (dueño → token) · `GET /cards/mine`.
- +6 tests de integración del flujo completo.

### 10.3 Handoff Flutter (abierto)
1. **Espejar `card-qr.ts` en `core_dart`**: `cardQrSigningInput` (misma cadena),
   `parse/serialize`, `verifyCardQrSignature` (ECDSA P-256 con la JWK de
   `GET /cards/public-key`, para verificar offline antes de llamar al server).
2. **Scanner de cámara** → `POST /cards/scan {qr}` → mostrar resultado
   (`claimed`/`already-yours`/`transferred`/`owned-by-other`).
3. **Transferir**: dueño → `POST /cards/transfer {identityId}` → muestra el QR/
   token; el receptor lo aporta al escanear.
4. **Colección verificada**: `GET /cards/mine` → fusionar con la declarada
   (KRO-214) usando `ownershipBadge` (Verificada/Declarada).

### 10.4 Pendiente (fuera del backbone)
- **KRO-216** (export listo-para-imprenta): bloqueado por research de imprenta (§8).
- **Studio**: herramienta de "lanzar tirada" = parte de KRO-216 (el escaneo NO vive en Studio).
- Reflejar la carta reclamada en "Mi colección" declarada = decisión de presentación (Flutter).

---

*Relacionados*: KRO-215 (epic) · KRO-216 (fabricación) · KRO-16 (verificada/QR) · KRO-214 (self-declared) · KRO-17 (trades) · KRO-28 (rareza → composición de sobres).
