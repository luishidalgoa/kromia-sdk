# COORDINACIÓN entre chats: Studio/Backend ↔ Flutter

Dos agentes (Claude Code) construyen Kromia en paralelo. Este doc es el **acuerdo
de trabajo** para no pisarse ni driftar, y la **fuente de verdad del reparto y de
la cola de handoffs**. Vive en el SDK porque es el repo que ambos comparten.

## Reparto — quién toca qué (regla dura)

| Chat | Repos / propiedad |
|---|---|
| **Studio** (sesión *"Kromia studio"*) | `@kromia/core` (TS **canónico**) · `@kromia/react` · `kromia-studio` · `Kromia_NodeJS` (backend) |
| **Flutter** (sesión *"Kromia flutter"*, `local_18daf528-575f-4eb5-b26a-ad1f212fabcf`) | `core_dart` (espejo Dart de `@kromia/core`) · `kromia_flutter` · la app |

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
   - Studio → Flutter: `session_id = local_18daf528-575f-4eb5-b26a-ad1f212fabcf`.
   - Flutter → Studio: `list_sessions` → busca la sesión de Studio.
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