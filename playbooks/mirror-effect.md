# mirror-effect

**Cuándo aplica**: vas a **añadir o modificar un efecto visual** (iridiscente, custom
foil, holográfico, capas 3D, marcos) o su RENDER, en cualquier plataforma. Garantiza que
el cambio quede espejado en Studio Y Mobile vía el SDK (contrato). Contexto completo del
sistema → `docs/effects-system.md`.

## Pasos

### 1 · Encuadre (SDK-first, contrato vs render-only)
- [ ] Localiza/crea el issue en Jira (proyecto KRO); pásalo a *In Progress*.
- [ ] Decide la naturaleza del cambio:
  - **¿Toca los `config[]` de un efecto** (`registries/visual-effects.ts`)? → es CONTRATO
    (bumpea el KRP). → paso 2A.
  - **¿Es CÓMO se pinta** (gradiente, warp, máscara, tintes, orden de capas)? → es
    render-only DATA (foil-recipe.ts / custom-foil-recipe.ts / border-svg.ts). → paso 2B.
  - **¿Está hardcodeado en un host** (Studio o Flutter) algo que el otro necesitaría? →
    **primero MUÉVELO a `@kromia/core` como DATA** (esto es el trabajo real anti-drift), luego 2B.

### 2A · Cambio de CONTRATO (params del efecto)
- [ ] Edita `registries/visual-effects.ts` (en el standalone `C:/Users/luish/Downloads/kromia-sdk`).
- [ ] `cd packages/core && pnpm gen` → regenera el `.json` y AUTO-BUMPEA `protocolVersion`
      (minor si aditivo). Verifica `contract-drift.test.ts` VERDE.
- [ ] Actualiza `validateTagStyles` si el nuevo param necesita validación específica.
- [ ] Añade la entrada al `CHANGELOG.md` del SDK bajo la versión bumpeada.

### 2B · Cambio de RECETA (render-only DATA)
- [ ] Edita la receta en `@kromia/core` (`foil-recipe.ts` / `custom-foil-recipe.ts` /
      `border-svg.ts` / `effect-resolve.ts`). Exporta lo nuevo en `index.ts`.
- [ ] Registra el símbolo en `tests/api-snapshot.test.ts` (`EXPECTED_EXPORTS`) + añade un test.
- [ ] `contract-drift.test.ts` debe seguir VERDE (render-only NO bumpea). Acumula la nota en
      `CHANGELOG.md [Unreleased]`.

### 3 · Studio consume la receta (no duplicar)
- [ ] Refactoriza el render de Studio (`src/components/album/visual-effects/*`) para
      CONSUMIR la receta del SDK, no re-declarar constantes. Valores idénticos (test-lockeados).
- [ ] Re-linkea el store: `pnpm add @kromia/core@file:./kromia-sdk/packages/core` (el submódulo
      es COPIA; `pnpm install` no basta — skill `sdk-refresh`). VERIFICA el símbolo en el store.
- [ ] `npx tsc --noEmit` limpio. Si tocaste UI nueva → skill `documentar-ui` (enciclopedia + tooltip).

### 4 · Backend (si valida)
- [ ] Si el efecto se valida server-side (`validateTagStyles`), re-linkea el SDK también en
      `Kromia_NodeJS` (submódulo propio) y reinícialo (nodemon vigila `src/`, no `node_modules`).

### 5 · Espejo en Mobile (handoff — lo ejecuta el chat de Mobile)
- [ ] Escribe/actualiza la **spec de render** en `docs/*.md` (fuente canónica que Flutter espeja).
- [ ] Anota el handoff en `COORDINATION.md` (entrada datada) + issue Jira a status **`Drift Sync`**.
- [ ] `send_message` a la sesión de Mobile (id en `COORDINATION.md`) con: qué cambió, qué
      símbolos espejar en `core_dart`, y las trampas de render (compositing/máscara/ruido).
- [ ] El chat de Mobile espeja `core_dart` + su render Flutter y confirma paridad (tests + build).

### 6 · Commits y verificación
- [ ] Commitea el SDK PRIMERO (standalone), luego el puntero del submódulo en Studio. No pushees sin OK.
- [ ] **Verifica en vivo**: Studio corriendo + (Mobile) build de la app. No cierres con una sola plataforma.
- [ ] Cierra el issue Jira cuando AMBAS plataformas rendericen igual (o deja el Drift Sync abierto hasta que Mobile confirme).

## Pitfalls conocidos
- **Receta hardcodeada en un host = drift.** Si Studio o Flutter declara constantes de render
  que el otro necesita, muévelas a `@kromia/core` (pasó con `FOIL_ORGANIC_WARP` y el custom foil).
- **Blend contra el fondo = lavado a blanco.** El blend del foil compone contra el ARTE; en
  Flutter = ShaderMask con el arte como sampler.
- **Máscara por alfa en vez de luminancia** (custom foil) = tapa el arte. `CUSTOM_FOIL_MASK.mode='luminance'`.
- **`pnpm gen` olvidado** tras tocar un registry → `contract-drift.test` ROJO. Córrelo tú, no esperes al pre-push.
- **Store STALE**: `tsc` puede dar verde en falso si el submódulo no se re-linkeó → grep del símbolo nuevo en `node_modules/@kromia/core`.
- **Editar el fichero del submódulo en vez del standalone**: son 2 checkouts; edita el STANDALONE y sincroniza el submódulo. Si un fichero nuevo aparece solo en `kromia-studio/kromia-sdk`, muévelo al standalone.
- **Golden que no ejercita** un componente/efecto (fixture con slot vacío) = el ratchet no caza su ausencia en Dart (KRO-133). Dale datos reales.

## Last verified
2026-07-11 — creación del harness de efectos (docs/effects-system.md + agente `efectos` + este playbook).
