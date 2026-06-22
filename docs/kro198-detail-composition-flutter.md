# HANDOFF · KRO-198 — Paridad Flutter: `hiddenSlots` + `CardSchema.detailComposition` (Drift Sync)

**Para:** chat Flutter (`core_dart` + `kromia_flutter`)
**De:** chat SDK-TS / Studio
**Tipo:** Drift Sync · **render-only** (NO bumpea `PROTOCOL_VERSION`, contract-drift debe quedar VERDE)
**Fuente canónica TS:** `packages/react/src/recipes/RecipeRenderer.tsx` + `HeroHeader.tsx`

---

## TL;DR

Ya shipeado en TS:
1. `RecipeRenderer` acepta `hiddenSlots?: string[]` → (a) **strip** de esos slot ids de `composition.slots` antes de despachar y (b) **reenvío** del array a `HeroProtagonicoRecipe → HeroHeader`, que con esos ids **no pinta ni el slot ni su placeholder** (banner degradado / avatar con inicial).
2. `CardSchema.detailComposition` (`ViewComposition` opcional, **render-only**, validada con `validateComposition` contra `cardFields`) ya persiste en backend.
3. En Studio, el panel "Detalles" del modo focus renderiza esa composición con `hiddenSlots = [slots de imagen del recipe] + 'title'` → panel "solo datos" (la imagen ya es la HoloCard 3D, el título ya está en la cabecera de la hoja).
4. **NUEVO (5410852)** — el detalle se construye en el **lienzo** (árbol `layout`). Para que siga siendo "solo datos" con layout-tree, `LayoutRenderer` también acepta `hiddenSlots` y oculta los roles del `hero_header` cuyo slotId esté en la lista. La decisión vive en core: **`computeHiddenHeroRoles(roles, nodeHidden, nodeSlots, hiddenSlots)`** (pura) → ver §7.
5. **NUEVO (53808fb)** — render por **behavior** completo: currency/measurement con `behaviorConfig`, `html` seguro (`parseInlineHtml`, allowlist), code/url/email/phone/tags/url_list/email_list → ver §8.

Flutter debe replicar **exactamente** esta semántica en su renderer Dart.

---

## 0. Modelo de autoría: **BASADO EN CAMPOS** (actualización 2026-06-22)

> **Lee esto primero.** El detalle evolucionó de "elegir una receta con roles
> abstractos" a un modelo **basado en campos**. Esto **NO cambia el trabajo de
> Flutter** (sigues renderizando `detailComposition.layout` + `slots` con
> `hiddenSlots`), pero sí cambia **qué SON los slots** — para que no te confunda
> ver ids que no son `banner`/`avatar`/`title` sino claves de campo.

Qué cambió en la autoría (Studio, canónico):

- **Un slot por CAMPO, no por rol.** El `slot.id` de una `detailComposition` es la
  **clave de un campo** de la carta (`numero`, `nombre`, `arte`, `descubierta`…),
  no un rol de receta. `slot.fields = [esa misma clave]`.
- **Receta portadora `detail_profile`.** La composición declara `recipe:
  'detail_profile'` solo para pasar la validación del SDK; el render usa el árbol
  **`layout`**, no los roles de esa receta. Slots con id de campo que no están en
  el manifest de `detail_profile` son **WARN, no ERROR** en `validateComposition`
  (backend solo bloquea errores) → la composición valida igual.
- **Plantillas = pilas de campos.** Las plantillas pre-diseñadas (Lista,
  Destacado, Reportaje, Efeméride) las construye Studio clasificando los campos por
  tipo y arreglándolos en un `layout` (título destacado, fila de stats, cuerpo…).
  Son **layouts de campos ya armados**, no recetas con roles. Flutter **no** las
  conoce ni las necesita — solo consume el `detailComposition` resultante.
- **`hero_header` casi nunca aparece** en una `detailComposition` por campos (las
  plantillas son grids planos de campos). El gating de §7 (`computeHiddenHeroRoles`)
  sigue siendo **obligatorio espejarlo** por robustez: el publisher *puede* insertar
  un componente hero a mano vía INSERTAR, y si lo hace debe ocultarse igual.

Implicación para `hiddenSlots` (§2/§3): el conjunto a ocultar son las **claves de
campo de tipo imagen** (`arte`, …) **+ la clave del campo título** (el `text`/PK
que actúa de nombre), no roles. Studio lo deriva con `detailHiddenSlots(recipe)` en
`detail-slots.ts` (ver referencias al final). El mecanismo de ocultado es idéntico
al descrito abajo.

**Resumen normativo:** el contrato de render Flutter es el MISMO; solo cambia la
naturaleza de los ids de slot (claves de campo). Renderiza `layout` + `slots`,
aplica `hiddenSlots`, formatea por behavior. No hay nada nuevo que persistir.

---

## 1. Renderer Dart — añadir `hiddenSlots`

Añadir un parámetro opcional `List<String> hiddenSlots = const []` al entry-point del renderer (equivalente Dart de `RecipeRenderer`).

**Regla A — strip ANTES de despachar (todas las recetas):**
Si `hiddenSlots` no está vacío, filtra `composition.slots` quitando las entradas cuyo id esté en `hiddenSlots`, y despacha con esa composición filtrada.

```
final filtered = hiddenSlots.isEmpty
    ? composition
    : composition.copyWith(
        slots: { for (final e in composition.slots.entries)
                   if (!hiddenSlots.contains(e.key)) e.key: e.value },
      );
```

- Recetas como `editorial` / `momento` (y las block-native vía `LayoutRenderer`/`recipeToComposition`) **omiten su imagen al faltar el slot, sin placeholder** → para ellas el strip basta.
- **Importante (paridad de referencia):** sin `hiddenSlots` (ausente/vacío) debe devolverse **la misma composición sin clonar** → cero cambio de comportamiento. No reconstruyas el mapa siempre.

**Regla B — reenvío a la cabecera de imagen (`hero_protagonico`):**
`hero_protagonico` cae a un **banner degradado** y a un **avatar con la inicial del título** cuando no hay slot. Por eso el strip NO basta: hay que **reenviar `hiddenSlots`** a `HeroProtagonicoRecipe → HeroHeader` para que tampoco pinte esos placeholders.

Semántica exacta de `HeroHeader` (a replicar en el `HeroHeader` Dart):
- `isHidden(id) = hiddenSlots.contains(id)`.
- `banner` oculto → no pinta ni la imagen ni el `GradientBanner` fallback **y** se omite el solape (`-mt-12`): sin banner no hay nada que solapar.
- `avatar` oculto → no pinta el avatar (ni el círculo con inicial del título).
- `subtitle` oculto → no pinta el subtítulo.
- `title`: la cabecera lo gobierna por `hiddenSlots` igual que el resto **pero** en Studio el panel de detalle lo oculta vía el strip de `slots` (no hace falta caso especial en el header; con el slot fuera del mapa, `resolveSlot('title')` no resuelve).

> Pasa `composition` **filtrada** a las recetas Y además `hiddenSlots` a las que tienen cabecera de imagen (hero). Las que solo leen `slots` (editorial/momento/compact/row/accordion) reciben únicamente la composición filtrada.

---

## 2. Consumir `CardSchema.detailComposition` en el detalle de carta

- `CardSchema.detailComposition` es un `ViewComposition` **opcional** y **render-only** (no afecta a la edición ni al contrato de datos). Ya viene en el payload del schema desde backend.
- Validación: backend ya la valida con `validateComposition` contra `cardFields`. Flutter **no** revalida estructura; solo la renderiza si está presente. Si es `null`/ausente → no renderizar panel de detalle de datos (sin fallback inventado).
- En la pantalla de **detalle de carta** (la HoloCard 3D abierta), renderiza `detailComposition` con el renderer Dart pasándole:

```
hiddenSlots = [ ...<ids de slots de imagen del recipe>, 'title' ]
```

donde, en el modelo **basado en campos** (§0), "slots a ocultar" = las **claves de los campos de tipo imagen** (`type: image` / `array<image>`) **+** la **clave del campo título** (el campo de texto que actúa de nombre de la carta). Deriva ese conjunto igual que hace Studio (`detailHiddenSlots(recipe)` en `src/components/album/recipes/detail-slots.ts`); **no lo hardcodees** a `'banner'`/`'avatar'`/`'title'`: dependen de la estructura de la carta, no de la receta.

Racional: la imagen ya la muestra la HoloCard 3D y el título ya está en la cabecera de la hoja de detalle → el panel debe ser **"solo datos"**, sin duplicar imagen ni título.

---

## 3. Regla "solo datos" (resumen normativo)

En el panel/sheet de detalle de carta:
- Oculta SIEMPRE: todos los slots de imagen del recipe **+** `'title'`.
- El resto de slots (campos de texto/escalares/related) se renderizan normal.
- Ningún placeholder de imagen debe aparecer (ni banner degradado, ni avatar-inicial): por eso el reenvío de `hiddenSlots` a la cabecera es obligatorio, no opcional.

---

## 4. Drift / contrato

- **NO** se añade ni cambia ningún campo del KRP serializado: `hiddenSlots` es un parámetro **de render del host**, no se persiste en la `ViewComposition`. `detailComposition` ya estaba contemplado en el schema TS y persiste igual.
- Por tanto: **NO bumpear `PROTOCOL_VERSION`**, y el test de **contract-drift debe permanecer VERDE** tras estos cambios en Dart.
- Paridad esperada: dado el mismo `ViewComposition` + `item` + `fieldDefs` + el mismo `hiddenSlots`, el árbol renderizado (qué slots aparecen y la ausencia de placeholders en la cabecera) debe coincidir 1:1 con la salida TS.

---

## 5. Checklist de aceptación Flutter

- [ ] Renderer Dart acepta `hiddenSlots` (default vacío) y hace strip de `slots` antes de despachar.
- [ ] `hiddenSlots` vacío/ausente ⇒ misma composición (sin reconstruir el mapa), comportamiento idéntico al actual.
- [ ] `HeroHeader` Dart respeta `isHidden` para `banner` (incl. quitar el solape `-mt-12`), `avatar`, `subtitle`; sin pintar placeholders.
- [ ] Detalle de carta consume `CardSchema.detailComposition` (si existe) con `hiddenSlots = [slots de imagen del recipe] + 'title'`.
- [ ] `detailComposition` ausente ⇒ no se renderiza panel de datos (sin fallback).
- [ ] `PROTOCOL_VERSION` sin tocar; contract-drift verde.

---

## 7. LayoutRenderer (árbol `layout`) — `hiddenSlots` + `computeHiddenHeroRoles`

El detalle de carta se diseña en el **lienzo** → la composición trae un árbol `layout`
y se renderiza por el motor genérico (`LayoutRenderer`), no por el componente de receta.
El strip de `slots` (§1.A) ya hace que las hojas-slot ocultas resuelvan a nada. **Pero**
el componente prefab `hero_header` reconstruye sus slots desde `node.slots` (mapeo
rol→slotId) y, si falta el slot, pinta el placeholder degradado → hay que cruzarlo con
los `hiddenSlots` globales.

Regla canónica (core, **pura, ya en TS — espejar en Dart**):

```
// computeHiddenHeroRoles(roles, nodeHidden, nodeSlots, hiddenSlots) -> List<String>
// Un rol se oculta si: lo marcó el publisher (nodeHidden) O su slotId
// (nodeSlots[role]) está en los hiddenSlots globales.
Set<String> out = { ...(nodeHidden ?? []) };
for (final role in roles) {                 // roles = [banner, avatar, title, subtitle]
  final sid = nodeSlots?[role];
  if (sid != null && hiddenSlots.contains(sid)) out.add(role);
}
return out.toList();
```

En el `LayoutRenderer` Dart, al pintar un `hero_header`:
- `hiddenRoles = computeHiddenHeroRoles([banner,avatar,title,subtitle], node.hidden, node.slots, hiddenSlots)`.
- NO añadir a `heroSlots` los roles en `hiddenRoles`.
- Pasar `hiddenRoles` como `hiddenSlots` del `HeroHeader` (para que tampoco pinte placeholder).
- `RecipeRenderer` Dart debe **reenviar `hiddenSlots` al `LayoutRenderer`** (ruta layout + default), igual que en TS.

---

## 8. Render por **behavior** del valor de un slot

Cierra los behaviors que caían a texto plano. **Formateo** en core (espejar en `core_dart`),
**presentación** en cada cliente.

**core (`format-scalar` + `html-inline`):**
- `currency` (number): símbolo por `behaviorConfig.currency` (ISO: EUR/USD/GBP/JPY/…; JPY/KRW sin decimales; código desconocido → se usa el propio código). Símbolo SIEMPRE tras el número (es-ES). Default EUR.
- `measurement` (number): unidad por `behaviorConfig.unit` (`"12.5 cm"`); sin unidad → número plano.
- `parseInlineHtml(html)` (behavior `html`): tokeniza un **allowlist** (b/strong, i/em, code, a[href], br, p/li) a los MISMOS `MarkdownToken` que markdown. **Seguro por construcción**: href sanitizado (solo http/https/mailto/tel), entidades decodificadas como texto, tags fuera de la allowlist eliminados, `<script>`/`onerror` fuera. **NUNCA** innerHTML/DOMPurify. Dart: replicar el allowlist + render por tokens (`TextSpan`).

**presentación (cada cliente):**
- `code`: monoespaciado con fondo sutil.
- `url`/`email`/`phone`: enlace navegable con href saneado (`url` sin esquema → `https://`; `email`→`mailto:`; `phone`→`tel:`).
- `tags` (array): chips.
- `url_list`/`email_list` (array): un enlace navegable por elemento (NO el JSON crudo del array).
- markdown: links **inertes** (no navegables) en el preview; html: links **clicables**.

### 8.1 — `SlotComposition.composableDisplay` (NUEVO, `8e8e700`)

Variante de RENDER de un slot COMPOSABLE (cómo se disponen sus varios fields/
valores), elegible por el publisher. **Meta de composición** (como
orientation/separator) → NO entra al contrato KRP, NO bumpea PROTOCOL_VERSION.
Catálogo es-ES en `OPTIONS_COMPOSABLE_DISPLAY` (core/options.ts). **Espejar el
campo en `core_dart` + las 5 ramas en el ComposableSlot de Flutter:**

- `'auto'` (default, y compositions históricas sin el campo): comportamiento
  histórico por behavior — tags→chips, url_list/email_list→enlaces, resto = join
  por `separator` respetando `orientation`. **Backward-compatible: cero drift.**
- `'inline'`: todos los valores en una línea, unidos por `separator`.
- `'list'`: un valor por línea (apilados).
- `'chips'`: cada valor como pastilla/badge.
- `'table'`: filas etiqueta–valor (usa la etiqueta de cada field;
  array-de-un-field sin etiquetas → cae a `list`).

Ref TS: `packages/react/src/recipe-utils.tsx` `ComposableSlot` (rama
`display !== 'auto'`) + `resolveSlot` (`composableDisplay: sc.composableDisplay ??
'auto'`). Validación: `validate.ts` (junto a `orientation`).

---

## 9. Follow-ups conocidos (NO bloquean)

- ~~Layout-tree explícito → reenviar hiddenSlots al LayoutRenderer~~ **RESUELTO** (§7, `5410852`).
- **Editor de lienzo (canvas DnD)**: en Studio el publisher elige una plantilla
  **basada en campos** (un bloque por campo, sembrada como `layout`) y la edita en el
  `LayoutEditor` — incluida la apariencia por campo (tipografía/color/recorte…). En el
  detalle se ocultan los controles que vuelven al modelo por-roles ("Plantillas",
  "Volver a la receta"). Flutter es **renderer puro**: consume el `detailComposition`
  resultante (con su `layout` + `slots` + `appearance`) — no necesita editor.
- `<u>` (underline) en `html`: no soportado en V1 (su contenido cae a texto).

---

**Referencias de lectura obligada (TS canónico):**
- `packages/react/src/recipes/RecipeRenderer.tsx` (props `hiddenSlots`, `filteredComposition`, reenvío a hero + LayoutRenderer).
- `packages/react/src/recipes/LayoutRenderer.tsx` (caso `hero_header`, `computeHiddenHeroRoles`).
- `packages/react/src/recipes/HeroHeader.tsx` (`isHidden`, gating banner/avatar/subtitle, `-mt-12` condicional).
- `packages/core/src/layout.ts` (`computeHiddenHeroRoles`), `format-scalar.ts`, `html-inline.ts`.
- `packages/react/src/recipe-utils.tsx` (`ScalarText`/`ComposableSlot`/`HtmlText`/`renderInlineToken`).
- Studio: `src/components/album/recipes/detail-slots.ts` (`detailHiddenSlots`, `imageSlotIds` — fuente única de qué ocultar) · `CardFocusOverlay.tsx` (lo consume) · `detail-templates.ts` (plantillas basadas en campos) · `DetailCompositionEditor.tsx` (selector + lienzo del detalle).
