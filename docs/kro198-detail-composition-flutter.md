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
6. **NUEVO 2026-06-22 (§10)** — 4 puntos de render más (todos meta, render-only): `conditionalStyle` (estilo por valor, integrar en `resolveSlot`), chips/tabla/stats **temables**, paridad del **badge** (opacity/shadow + color dinámico), y el contenedor raíz del **detalle llena la pantalla**. Acabados (THEME_PRESETS) y contraste = **solo-edición, Flutter los ignora**.
7. **NUEVO 2026-06-22 (§11)** — decoración: el **wrapper raíz** sigue el radius del surface (4 esquinas), la **caja de imagen** toma `appearance.bgColor`, y nuevo `ContainerSurface.cornerRadii` (radio por esquina, render-only).
8. **NUEVO 2026-06-22 (§12)** — la **raya de acento ya no aplana** las esquinas de su lado (se curva con el radius → 4 esquinas uniformes), y nuevo `screenBgHex(bgColor)`: la **pantalla** (lista/detalle) toma el acabado un punto más oscuro que las cartas → éstas resaltan por elevación.
9. **NUEVO 2026-06-22 (§13)** — **relleno POR LADO** (`ContainerSurface.paddingSides` + `SlotAppearance.paddingSides` → `EdgeInsets.only`, prevalece sobre el padding uniforme), y **separador de lista opcional** (`ViewComposition.listStyle.separator`, `Divider` entre items solo si true; **OFF por defecto**, cambia el aspecto de las listas existentes).
10. **NUEVO 2026-06-22 (§14)** — acento en BLOQUES: la raya se pinta en la **capa del fondo del root** (no la tapa el acabado), y el **slot cuyo `color_hex` alimenta el acento NO se pinta como celda** (`extractAccentSettings` expone `colorFieldKey`; suprimir esa hoja).
11. **NUEVO 2026-06-23 (§15)** — **fondo de PANTALLA desacoplado**: nuevo `ContainerSurface.screenBgColor`; la pantalla = `screenBgHex(screenBgColor ?? bgColor)` (fallback); el acabado setea ambos → editar el fondo de la card ya no mueve la pantalla.

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
- `'stats'` (**NUEVO `da0007f`**): fila de estadísticas — cada field = VALOR
  grande (números tabulares) + ETIQUETA debajo en mayúsculas, en columnas iguales
  con borde superior/inferior. Replica el componente `stats_row`. Sin etiquetas
  (array-de-un-field) → cae a `chips`. **Importante:** al *descomponer* el
  componente `stats_row` en bloques, Studio auto-setea `composableDisplay:'stats'`
  en el slot resultante para no perder el estilo.

> **Colores TEMABLES (NUEVO `a99f11d`):** en `chips`, `table` y `stats` el color de
> cada pastilla/valor/etiqueta se deriva ahora de la appearance del slot
> (`paletteClass(bgColor,'bg')`/`textColor` con fallback muted), NO hardcodeado. En
> chips el fondo va EN las pastillas (wrapper a transparente). Espéjalo: tus
> chips/tabla/stats deben tomar el color de la appearance.

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

## 10. Cambios 2026-06-22 — más render que espejar (KRO-198 cont.)

Cuatro puntos de RENDER nuevos (todos **meta / render-only**, NO bumpean
`PROTOCOL_VERSION`; contract-drift VERDE). Commits SDK: `a99f11d`, `581ff9d`,
`5bebd85`, `f00d55d`. **Antes de tocar el detalle: el detalle se construye con el
MISMO motor que las SECCIONES** (misma `SlotComposition` + `LayoutRenderer` +
recetas + `resolveSlot`). Investiga cómo tienes montado el render de SECCIONES en
`core_dart` y reutilízalo — no es un sistema nuevo.

### 10.1 — `SlotComposition.conditionalStyle` (estilo por valor) · `5bebd85`

NUEVO campo opcional en `SlotComposition`. Modelo:

```
ConditionalStyle { fieldKey: String, cases: List<ConditionalStyleCase> }
ConditionalStyleCase { op?: String, value?: String, appearance?: SlotAppearance }
// op ∈ eq|neq|contains|gt|gte|lt|lte|truthy|falsy  (default 'eq')
```

Semántica: "la apariencia del slot cambia según el valor de un campo del dato"
(color por rareza, rojo si stock 0…). El **PRIMER caso que matchea gana**; su
`appearance` se **MERGE-a sobre la base** (`slot.appearance`). Sin match / sin
item → base intacta. Comparación de texto case-insensitive + trim; gt/gte/lt/lte
numéricas; truthy/falsy ignoran `value`.

Espejo TS puro en `packages/core/src/conditional-style.ts`:
`matchConditionalCase(case, raw)` + `resolveConditionalAppearance(cond, base, item)`.
**Punto de integración: `resolveSlot`** (donde resuelves la appearance efectiva del
slot) — TS hace `appearance: resolveConditionalAppearance(sc.conditionalStyle,
sc.appearance, item)` y TODOS los renders (SlotContent/LayoutRenderer,
ComposableSlot, recetas) heredan. Hazlo en el mismo sitio en Dart → un solo cambio.
Validación estructural en `validate.ts` (ops + appearance de cada caso).

### 10.2 — chips/tabla/stats TEMABLES · `a99f11d`

Ver el blockquote de §8.1: deriva el color de los elementos internos de la
appearance del slot, no fijo. (Antes hardcodeaban `text-muted-foreground`/`bg-muted`).

### 10.3 — Paridad del BADGE · `a99f11d`

Un slot mostrado como badge (`appearance.display == 'badge'`) debe honrar
**opacity/shadow** (effect classes) **+ color DINÁMICO** (color_hex por campo →
estilo inline), igual que el render del motor de bloques (`SlotContent`). En TS lo
arreglé en `CompactCardRecipe` (su pill no recibía esas clases). Revisa tu receta
lista equivalente en Dart: el badge debe pasar las mismas clases/estilo que el
contenido de un slot badge del LayoutRenderer.

### 10.4 — El contenedor raíz del DETALLE llena la pantalla · `f00d55d` + `19e7ce2`

Un detalle es **pantalla completa**: su contenedor raíz debe **estirarse a la
altura disponible**, no quedar a altura-contenido dejando un hueco vacío bajo el
fondo/decoración. En TS (`LayoutRenderer`): cuando `kind == 'detail'`, el wrapper es
`flex flex-col min-h-full` y el contenedor RAÍZ recibe `grow shrink-0`
(= `flex: 1 0 auto`: crece para llenar, **nunca encoge bajo su contenido** → texto
largo scrollea). El host (pantalla) ya da la altura definida. En Flutter: el body
del Scaffold del detalle debe dar altura completa y la composición raíz llenarla
(`Expanded`/`double.infinity` + el fondo/decoración cubre todo). Solo aplica a
`kind == 'detail'`; las listas no cambian.

**Importante — empacar arriba (`19e7ce2`):** al llenar, la raíz (grid) recibe
también `content-start` (`align-content: start`). En CSS grid, `align-content:
normal` se comporta como **stretch** → sin esto, las filas `auto` se ESTIRAN al
tener un box alto y el contenido queda con huecos enormes. Con start, las filas
quedan a altura-contenido **empacadas ARRIBA** y el sobrante (fondo) llena ABAJO.
En Flutter: al expandir el contenedor de detalle, **alinea los hijos al inicio**
(`MainAxisAlignment.start` / no `spaceBetween`/`stretch` de las filas), o tendrás
el mismo bug de huecos. (El host además puede ir **a sangre** bajo una barra de
nav flotante translúcida — eso es decisión de pantalla de cada cliente, no del
motor: Studio quita el `padding-bottom` reservado en el detalle.)

### 10.5 — SOLO-EDICIÓN (Studio): el renderer Dart NO necesita nada

- **Acabados / `THEME_PRESETS`** (`581ff9d`): `applyThemePreset(composition, id)`
  transforma la composición **en EDICIÓN** → produce `appearance`/`surface`
  NORMAL (recolor coordinado y legible). El renderer solo ve el resultado, que ya
  pinta. Como el editor de layout vive solo en Studio (Flutter = renderer puro),
  **no hay mirror necesario**. Si algún día Flutter edita, espejaría el catálogo.
- **Contraste WCAG** (`paletteContrastRatio`/`contrastLevel` + aviso) y
  **validación de `textShadow`/`display`/`textTransform`**: a11y y validación del
  EDITOR. El render no cambia (Flutter ya pinta `textShadow`).

---

## 11. Cambios 2026-06-22 (cont.) — decoración: esquinas + acabado de imagen

Tres puntos de RENDER más (meta/render-only, NO bumpean PROTOCOL_VERSION;
`cornerRadii` NO entra en `ALL_SURFACE_PROPS`). Commits SDK: `b5ecf71`, `74e36ce`,
`c4219cb`.

### 11.1 — El WRAPPER raíz sigue el radius del surface · `b5ecf71`
El `surface.radius` se aplicaba al grid interno, pero el contenedor que RECORTA
(overflow-hidden, cuyas esquinas se ven) era siempre `rounded-lg`. Como el
AccentFrame solo aplana el lado del acento, el opuesto se quedaba redondo →
'Rectas'/none no llegaba a esas esquinas. Ahora el wrapper raíz toma
`radiusClasses(root.surface)` (respeta radiusCorners/cornerRadii) en las 4
esquinas; sin surface-radius, el default. **En Flutter: aplica el radius del
surface al ClipRRect/Container raíz que recorta, no solo al hijo interno.**

### 11.2 — La caja de IMAGEN toma `appearance.bgColor` · `74e36ce`
`ThumbBox` (caja de imagen/placeholder) usaba `bg-muted` fijo → con un acabado
oscuro dejaba un cuadro claro. Ahora el fondo de la caja sigue
`appearance.bgColor` si está fijado (fallback bg-muted). **Flutter: la caja de
imagen usa el bgColor del slot como fondo del placeholder.** (`applyThemePreset`
fija ese bgColor al papel en los slots de imagen, pero eso es EDIT-only Studio —
Flutter solo ve el resultado.)

### 11.3 — `ContainerSurface.cornerRadii` (radio POR ESQUINA) · `c4219cb`
NUEVO campo opcional `cornerRadii?: { tl?, tr?, bl?, br?: 'none'|'sm'|'md'|'lg'|
'xl'|'full' }`. Cada esquina su propio tamaño; PREVALECE sobre `radius`/
`radiusCorners`; esquinas ausentes = 'none'. **Render-only meta** (NO en
`ALL_SURFACE_PROPS` → contract-drift verde, sin bump). Espeja el campo en
`ContainerSurface` de `core_dart` y aplícalo per-corner en el ClipRRect
(`BorderRadius.only(topLeft, topRight, bottomLeft, bottomRight)`). Ref:
`LayoutRenderer.radiusClasses` (rama `cornerRadii` con precedencia).

---

## 12. Cambios 2026-06-22 (cont.) — esquinas uniformes + fondo de pantalla

Dos puntos de RENDER más (meta/render-only, NO bumpean PROTOCOL_VERSION). Commits
SDK: `5ac8e7f` (esquinas), `163f011` (screenBgHex).

### 12.1 — La raya de acento ya NO aplana las esquinas · `5ac8e7f`
`buildAccentBorderStyle` forzaba `borderRadius: 0` en las dos esquinas del lado del
acento ("ticket con cinta") → con el wrapper ya redondeado (§11.1) el lado del
acento (p.ej. top) quedaba RECTO y el opuesto (bottom) REDONDO = esquinas
asimétricas que el publisher percibía como bug. Ahora `buildAccentBorderStyle` solo
aplica el `box-shadow inset` de la raya (que se CURVA con el radius del wrapper) y
NO toca el border-radius → las 4 esquinas siguen el radius uniformemente.
**En Flutter: la raya/borde de acento NO debe aplanar la esquina de su lado; píntala
como una franja que sigue el ClipRRect (inset), no como un borde recto que corta el
redondeo.** Ref: `recipe-utils.buildAccentBorderStyle` (4 ramas top/bottom/left/right,
ya sin overrides de `border*Radius`).

### 12.2 — Fondo de PANTALLA derivado del papel: `screenBgHex` · `163f011`
NUEVO helper `screenBgHex(bgColor): string|null` en `packages/core/src/palette.ts`.
El acabado teñía las CARTAS pero la PANTALLA (lista de sección / detalle) seguía con
el fondo de app → un álbum oscuro dejaba las cartas oscuras sobre un fondo crema.
Ahora la pantalla toma el color del acabado pero un punto MÁS OSCURO que el papel de
las cartas (mezcla el papel 18% hacia negro) → las cartas RESALTAN por elevación.
`screenBgHex` devuelve `null` para tokens de tema (la pantalla conserva el fondo de
app). Es **pura, render-only, fuera del contrato** (no en el `.json`).
**En Flutter: el fondo de la pantalla que aloja la lista de una sección (y el detalle)
= `screenBgHex(composition.layout.surface.bgColor)`; si null, fondo de app. La carta
conserva su `surface.bgColor` pleno → contraste de elevación idéntico al preview de
Studio.** Mismo factor (0.82) para que el resultado coincida pixel a pixel.
Studio lo aplica en `SectionAppPreview` (body del `PhoneFrame`) y en el backdrop del
lienzo de `LayoutEditor`; Flutter lo aplica en el Scaffold/host de la pantalla real.

---

## 13. Cambios 2026-06-22 (cont.) — padding por lado + separador de lista

Dos puntos de RENDER más (meta/render-only, NO bumpean PROTOCOL_VERSION; NO entran en
`ALL_SURFACE_PROPS`/`ALL_APPEARANCE_PROPS`). Commit SDK: `64c0b9d`.

### 13.1 — Relleno POR LADO · `ContainerSurface.paddingSides` + `SlotAppearance.paddingSides`
NUEVOS campos opcionales (render-only, espejan `cornerRadii`):
- `ContainerSurface.paddingSides?: { top?, right?, bottom?, left?: 'none'|'xs'|'sm'|'md'|'lg'|'xl' }`
  — si presente PREVALECE sobre `padding`; lados ausentes = 'none'. Mapeo px (espeja
  `p-0/p-1/p-2/p-3/p-5/p-8`): **none=0, xs=4, sm=8, md=12, lg=20, xl=32**.
- `SlotAppearance.paddingSides?: { top?, right?, bottom?, left?: 'none'|'sm'|'md'|'lg' }`
  — prevalece sobre `paddingY` (que es solo vertical). Mapeo px (espeja `py-0/1/2/4`):
  **none=0, sm=4, md=8, lg=16**.
**En Flutter: `EdgeInsets.only(top/right/bottom/left)` con esos px por lado cuando
`paddingSides` existe; si no, el padding uniforme actual.** Validado en `validateSurface`
(bloque `paddingSides` espeja el de `cornerRadii`). Ref render: `LayoutRenderer`
`PADDING_BY_SIDE` + `paddingClasses`; slot: `recipe-utils` `SLOT_PADDING_BY_SIDE` +
`appearancePaddingClass`.

### 13.2 — Separador de lista OPCIONAL + OFF por defecto · `ViewComposition.listStyle`
NUEVO `ViewComposition.listStyle?: { separator?: boolean }` (render-only). Antes la lista
de una sección SIEMPRE pintaba una línea entre items (un `divide-y` cableado + un `border-b`
propio de `row_text`). Ahora: el `border-b` de `RowTextRecipe` se quitó (se centraliza) y la
línea solo se pinta si `listStyle.separator === true`. **Ausente/false = SIN línea (default
nuevo).** **En Flutter: el host de la lista (la pantalla de sección) usa `Divider` entre items
SOLO si `composition.listStyle?.separator == true`; por defecto sin separador** (`SizedBox`/
nada). ⚠️ Cambia el aspecto por defecto de las listas existentes (pierden la línea hasta que el
publisher la active) — es intencional. Es decisión de PANTALLA (no del motor de bloques, que
opera dentro de un item).

> **C (acento en bloques) NO necesita nada en Flutter**: solo se expuso el control de
> `accentPosition` (ya contrato, ya respetado por el renderer) en el editor de bloques de Studio.

---

## 14. Cambios 2026-06-22 (cont.) — acento: capa del strip + slot de color como acento

Dos puntos de RENDER (meta/render-only, NO bumpean). Commit SDK: `649aaf0`. SOLO afecta
al modo BLOQUES (`LayoutRenderer`); las recetas recipe-mode mantienen su `AccentFrame`.

### 14.1 — La raya de acento se pinta EN LA CAPA DEL FONDO DEL RAÍZ (no la tapa el acabado)
Antes el `box-shadow inset` del acento vivía en un wrapper EXTERNO y el `bgColor` del
contenedor raíz (acabado) lo PINTABA ENCIMA (paint order: el inset del padre queda debajo
del fondo del hijo) → al aplicar un acabado, la raya desaparecía. Ahora el inset se aplica
AL PROPIO DIV del contenedor raíz (el que tiene el `bgColor`): se pinta sobre su propio
fondo y las celdas hijas (con padding/gap) no lo tapan; se curva con el radius del raíz
(invariante §12.1). **En Flutter: pinta el acento en la MISMA capa que el fondo del root
(p.ej. `foregroundDecoration`/`Border` del Container raíz, o un `Stack` clipado por el
`ClipRRect` del root), NO en un wrapper externo — si no, el fondo del acabado lo tapa.**
Ref: `LayoutRenderer` (`extraStyle` al `LayoutNodeView` del root; ya no hay `AccentFrame`).

### 14.2 — El slot cuyo `color_hex` ALIMENTA el acento NO se pinta como celda
`extractAccentSettings` ahora devuelve `colorFieldKey` (en `AccentSettings`). Cuando el
acento está activo (`position != 'none'`), el host deriva el conjunto de slots cuyo `fields`
incluye ese `colorFieldKey` y NO los renderiza como celda (su color YA es la raya; antes se
veía swatch + raya duplicados). **En Flutter: con el acento activo, suprime la hoja/celda del
slot cuyo campo es `accent.colorFieldKey` (su color ya es el strip).** Ref: `LayoutRenderer`
(`accentSlots` en `NodeCtx`; `SlotLeaf` devuelve null). Studio espeja lo mismo en su lienzo.

---

## 15. Cambios 2026-06-23 — fondo de PANTALLA desacoplado del fondo de la card

Un punto de RENDER más (meta/render-only, NO bumpea). Commit SDK: `95917cb`.

### 15.1 — `ContainerSurface.screenBgColor` (independiente de `bgColor`)
Hasta ahora `layout.surface.bgColor` cumplía DOS roles: fondo de la CARD Y semilla del fondo
de PANTALLA (`screenBgHex(bgColor)`). Editar el fondo de la card movía AMBOS. NUEVO campo
`ContainerSurface.screenBgColor?: string` (id de paleta, render-only, fuera del contrato KRP
como `cornerRadii`/`paddingSides`): es el fondo de la PANTALLA que aloja la card, independiente
de `bgColor`.
- **La pantalla se deriva** = `screenBgHex(surface.screenBgColor ?? surface.bgColor)` — MISMO
  helper, MISMO factor (0.82), con FALLBACK a `bgColor` para no romper composiciones ya guardadas.
- **`applyThemePreset` setea AMBOS** (`bgColor` + `screenBgColor` = `paperBg`) → un acabado sigue
  tiñendo la pantalla (cartas resaltan); editar solo `bgColor` (Decoración→Fondo) ya no la mueve.
**En Flutter: el fondo de la pantalla (Scaffold/host de la lista y del detalle) =
`screenBgHex(surface.screenBgColor ?? surface.bgColor)` — añade el campo a `ContainerSurface` de
`core_dart` y aplica el mismo fallback; `applyThemePreset` (si la app edita) escribe ambos.** Los
3 puntos de derivación hoy son Studio-only (SectionAppPreview lista/detalle + backdrop del lienzo);
el render real de Flutter debe leer `screenBgColor` del surface persistido para pintar la pantalla.

---

## 16. Cambios 2026-06-23 — apariencia POR-FIELD en slots composable

Commit SDK: `40c8816` (en `main`). Meta de composición (como `composableDisplay`/
`conditionalStyle`) → **NO** entra al contrato KRP, NO bumpea PROTOCOL_VERSION
(contract-drift verde). **Requiere paridad en `core_dart` (Drift Sync).**

### 16.1 — `SlotComposition.fieldAppearances`
Nuevo campo opcional: `fieldAppearances?: Record<string /* field key */, SlotAppearance>`.
Permite que CADA field de un slot composable lleve su propia apariencia (color de texto/
fondo, etc.) ENCIMA de la base del slot (`appearance`). Caso de uso: una `stats_row`
("Estadísticas") con una estadística en dorado y otra en rojo.

### 16.2 — Merge por entrada en el render (`ComposableSlot`)
En `recipe-utils.tsx`, rama `display !== 'auto'` (chips/list/table/stats/inline): las
entradas ahora conservan su `key`, y el color efectivo de cada una es
`{ ...slot.appearance, ...fieldAppearances[key] }` (base ← override del field). Sin entrada
por-field → base (backward-compatible: sin `fieldAppearances` el render es idéntico). El
caso "array de un solo field" no tiene key por-elemento → usa la base. `resolveSlot` ya
propaga `fieldAppearances` en `ResolvedSlot`.

**En Flutter (`core_dart` + render):**
1. Añade `fieldAppearances: Map<String, SlotAppearance>?` a `SlotComposition`.
2. En el render del composable (equivalente a `ComposableSlot`), resuelve el estilo de cada
   field como `base.merge(fieldAppearances?[key])` y aplícalo POR field (no una sola vez para
   todo el slot). Mismo orden de precedencia: base ← field.
3. Cascada con `conditionalStyle`: base(condicional-resuelto) ← fieldAppearances.

### 16.3 — Editor (Studio, ya hecho — informativo)
En `ViewCompositionEditor`, clicar el chip de un field en el slot composable lo selecciona y
abre un `AppearanceEditor` anclado a `fieldAppearances[key]`. La app Flutter no edita layout →
no necesita esto.

---

## 17. Cambios 2026-06-23 — el detalle deja de FORZAR "Oculto" (Studio-only, sin trabajo Flutter)

Commit Studio: `99042a2`. Solo cambia el SEEDING de qué nodos van al `layout`; **Flutter
renderiza el layout tal cual → sin cambios de código**. Awareness:
- Las plantillas de detalle ya NO colocan `title` ni la imagen en el `layout` por defecto
  (quedan en `slots` → insertables). Se eliminó el `hiddenSlots` forzado del editor y del
  render del modo focus (WYSIWYG: lo colocado se renderiza). El detalle de carta ya no mete
  `'title'` en `hiddenSlots`.
- Se **borró `detail-slots.ts`** (`detailHiddenSlots`/`imageSlotIds`) en Studio → la
  referencia de abajo a ese archivo queda OBSOLETA. `computeHiddenHeroRoles`/`hiddenSlots` del
  SDK siguen intactos (capacidad genérica; ya no la alimenta el detalle de carta).

---

## 18. Cambios 2026-06-23 — StatsRow honra apariencia + mini-cartas sin arte plano

Commit SDK: `505d3b4` (en `main`). Dos arreglos de RENDER (meta, NO bumpea). **Ambos requieren paridad en `core_dart`/`kromia_flutter` (Drift Sync).**

### 18.1 — El componente `stats_row` ahora honra `appearance` + `fieldAppearances`
Bug: la fila de estadísticas la pinta el COMPONENTE prefab `stats_row` → `StatsRow`,
que **ignoraba toda apariencia** (colores `text-foreground`/`text-muted-foreground` a
fuego). `LayoutRenderer` solo le pasaba `resolved.fields`. Por eso ni la apariencia
base del slot ni la por-field (§16) surtían efecto, y el acabado/tema "ganaba".
- `LayoutRenderer` (case `stats_row`) ahora pasa `appearance={resolved.appearance}` +
  `fieldAppearances={resolved.fieldAppearances}` a `StatsRow`.
- `StatsRow` aplica la apariencia base en el wrapper + la apariencia EFECTIVA por
  estadística (base ← `fieldAppearances[key]`, vía `mergeFieldAppearance`) en cada
  VALOR: **no solo color** sino TODO — tipografía (`appearanceTextClasses`), FONDO
  (`bgColor`→pill), RECORTE (`appearanceTruncateClass` + default truncate), CAJA
  (`appearancePaddingClass`) y efecto (`appearanceEffectClasses`). La ETIQUETA solo
  sigue el color (mantiene su identidad de caption). Mismos helpers que la rama 'stats'
  de `ComposableSlot` (anti-drift). `StatsRowField` gana `key?`. (Commit del refinamiento
  completo: `e44e303`; el inicial `505d3b4` solo aplicaba color.)

**En Flutter:** el render del componente stats_row (equivalente a `StatsRow`) debe
recibir y aplicar `appearance` + `fieldAppearances` por estadística con
`base.merge(fieldAppearances?[key])`, y aplicar la apariencia COMPLETA (tipografía,
color, fondo, recorte/maxLines, relleno) en el valor — no solo el color. Hoy en
`core_dart` ese componente probablemente tiene el estilo fijo → mismo bug; replica el
fix. (El gate `display!=='auto'` de §16 NO aplica aquí: el componente nunca pasa por
ComposableSlot.)

### 18.2 — Mini-cartas (card-ref) de cartas SOLO con capas 3D
Una carta referenciada sin arte plano (p.ej. "Ignis", solo composición de capas 3D
KRO-130) salía como placeholder con número en la mini-carta. `CardRefResolver` ahora
admite `layers?: { url: string }[]`; cuando no hay `imageUrl`, `MiniCardRefs` (RefGallery)
APILA esas capas (`absolute inset object-cover`, back→front = el arte en reposo). Studio
rellena `layers` desde `getCardDepthLayers(row)` cuando el row no tiene campo imagen con valor.

**En Flutter:** el resolver de refs (equivalente a `makeCardRefResolver`) debe, si la
carta no tiene imagen plana, devolver las capas (`getCardDepthLayers`), y la mini-carta
apilarlas (Stack de Images back→front) como fallback del `imageUrl` — mismo criterio que
el hero/HoloCard al componer capas, pero en miniatura y estática (sin tilt).

---

## 19. Cambios 2026-06-23 — `display:'badge'` en stats + el detalle rellena el panel con el acabado

### 19.1 — StatsRow honra `appearance.display === 'badge'` (commit `922137e`, paridad core_dart)
Refinamiento de §18.1: una estadística con `appearance.display === 'badge'` (Color →
"Mostrar como: Badge", por field o base) ahora pinta el VALOR como **pastilla**
(`rounded-full` + fondo + color/tipografía) en vez de cifra grande. En `StatsRow` y en
la rama 'stats' de `ComposableSlot`. **En Flutter:** el render de stats debe ramificar en
`display=='badge'` igual que ya hace el slot normal (LayoutRenderer §badge). (Nota: la
opción "Mayús" es NO-OP en valores numéricos — no hay nada que mayusculizar; la etiqueta
ya va en mayúsculas. No es bug.)

### 19.2 — El PANEL del detalle de carta se tiñe con el acabado (Studio-only; nota app Flutter)
Commit Studio: `99a6e76`. El panel `DetailsSheet` (CardFocusOverlay) era `bg-card` (blanco)
con la composición teñida dentro → dejaba huecos blancos arriba/abajo. Ahora, si la
composición de detalle lleva un acabado (su `surface.bgColor` es un tono de paleta), el
PANEL ENTERO toma ese color (`paletteHex(surface.bgColor)`) y la cabecera usa el `textColor`
coordinado del acabado (cualquiera de sus slots; pasa AA). **No es SDK** (chrome de la UI).
**En la app Flutter:** el panel/Scaffold que aloja el detalle de la carta debería pintarse
con el mismo `paletteHex(surface.bgColor)` del acabado (y texto de cabecera con su `textColor`)
para no dejar huecos del color de fondo de la app. Equivale al criterio de `screenBgHex`
(§12/§15) pero SIN oscurecer: aquí el panel iguala el papel para fundirse con la composición.

---

## 20. Cambios 2026-06-23 — `ContainerSurface.textColor`: color de texto GLOBAL del contenedor (cascada)

Commit SDK: `c0becc2` (en `main`). Meta render-only (NO contrato KRP — no está en
`ALL_SURFACE_PROPS`, como `screenBgColor`/`cornerRadii`). **Requiere paridad core_dart.**

### 20.1 — `ContainerSurface.textColor?: string` + cascada
Nuevo campo (id de paleta). `surfaceClasses` lo aplica como **color de texto base** del
contenedor (`paletteClass(s.textColor,'text')` en el div del contenedor) → por **herencia
CSS** lo adoptan TODOS los slots descendientes SIN color propio; un slot que fija su
`appearance.textColor` lo sobreescribe en su elemento. Da un "color de texto global" sin
recolorear slot a slot.

### 20.2 — `applyThemePreset` lo setea GLOBAL (antes era por-slot)
`applyThemePreset` ya **no** pone `theme.textColor` en cada slot; lo pone UNA vez en
`layout.surface.textColor`. Los slots lo heredan por cascada; los badges conservan su
`accent` (que sí va por-slot). Resultado visual idéntico, pero ahora es un punto editable
y overridable. (La FUENTE `theme.font` sigue por-slot.)

**En Flutter (`core_dart` + render):**
1. Añade `textColor` a `ContainerSurface` de `core_dart`.
2. El render del contenedor debe aplicar `surface.textColor` como color de texto por
   DEFECTO del subárbol (DefaultTextStyle/Theme heredado), de modo que un slot sin color
   propio lo herede y uno con `appearance.textColor` lo sobreescriba.
3. `applyThemePreset` (si la app edita): setear `surface.textColor = theme.textColor`
   (global), NO por-slot. Tests de themes (TS) actualizados al nuevo modelo.

### 20.3 — Editor + detalle (Studio, ya hecho)
Studio expone "Color de texto" en Decoración → Fondo del raíz (`set({textColor})`,
commit `85a81e9`), y la cabecera del detalle (CardFocusOverlay) usa `surface.textColor`
(con fallback legacy a un slot). El CTA "Ocultar detalles" se adapta a ese color.

---

## 21. Cambios 2026-06-23 — blanco y negro en la paleta

Commits SDK: `da3ffd1` + `ad542eb`. `PALETTE_NEUTRALS = ['white','black']` (grupo
`'neutro'`, fijos — no adaptan a claro/oscuro), añadidos a `PALETTE` y a `PALETTE_HEX`
(`#ffffff`/`#000000`). `paletteClass` los resuelve por el fallback `${role}-${id}` →
`text-white`/`bg-white`/`text-black`/`bg-black` (Studio los fuerza en el bundle vía
`@source inline`). NO toca el contrato (la paleta no se enumera en el KRP).

**En Flutter:** mapea los ids `'white'`/`'black'` a `Color(0xFFFFFFFF)`/`Color(0xFF000000)`
en el equivalente de `PALETTE_HEX`/`paletteClass` de `core_dart`, y muéstralos en el
picker si la app edita colores.

---

## 22. Cambios 2026-06-23 — color por-chip en composable 'auto' + align del badge

Commit SDK: `93d1f4a`. Dos fixes de render. **Requieren paridad core_dart.**

### 22.1 — `fieldAppearances` (color por-chip) también en `composableDisplay='auto'`
Bug: un slot composable multi-campo con disposición 'auto' (el default) renderizaba
los valores desde `composeSlotValues().items` (`string[]` SIN key) → el color por-field
(§16) no se podía aplicar (solo el color base). Ahora `ComposableSlot` construye
`entries` (con `key`) + `colorFor` UNA vez (hoisted) y los branches 'auto'
vertical/horizontal colorean cada valor por-chip (texto+fondo), igual que los
displays explícitos. `entries.value[] === items[]` (mismo formatScalar/orden/filtro;
los casos array y truncate se resuelven antes) → sin regresión del subtítulo unido.

**En Flutter:** el render del composable en modo 'auto' (multi-campo) debe conservar
la `key` de cada campo y aplicar `base ← fieldAppearances[key]` por valor, no aplanar
a una lista de strings sin key.

### 22.2 — El `align` de un `display:'badge'` va en el contenedor, no en la pastilla
Bug: el align (text-align) se aplicaba a la `BadgePill` (que es `inline-flex`), donde
no la mueve → un badge no se podía centrar. Nuevo helper `appearanceAlignClass` aplicado
al `<div>` BLOQUE exterior (LayoutRenderer rama badge) → `text-center/left/right` ahí SÍ
alinea la pastilla inline; la pill conserva color/peso/size/efectos (con la appearance
sin `align`). Cubre badge single y composable.

**En Flutter:** alinea el badge desde su CONTENEDOR (Align/Row mainAxisAlignment según
`appearance.align`), no con un text-align sobre la propia pastilla.

---

## 23. Cambios 2026-06-23 — insertar cualquier campo como slot genérico + `labelForField`

Commit SDK: `65297e2`. Studio: `490d54c`. **Casi todo Studio-only (editor); el render NO cambia.**

### 23.1 — `labelForField` (SDK, meta/UI)
Nuevo helper `labelForField({type,behavior}) = getBehavior(behavior)?.displayName ??
getFieldType(type)?.displayName ?? type`. Nombra un slot GENÉRICO por el behavior
normalizado del campo (tags→"Etiquetas", iso_date→"Fecha", color_hex→"Color"…). No
duplica catálogo; no toca el contrato. **Paridad core_dart**: solo si la app EDITA
composiciones (nombrar slots-campo); el render no lo usa.

### 23.2 — "Campos del álbum" en el editor (Studio-only)
El editor de bloques (LayoutEditor) ahora ofrece, además de los roles de la receta, un
grupo "Campos del álbum" con CADA campo del schema no colocado, insertable como slot
genérico (`fields:[key]`, sembrado al insertar). Esto rompe el techo de los ~5 roles del
manifest: cualquier campo se puede colocar. **NO afecta a Flutter**: el motor de render
(LayoutRenderer) ya pinta cualquier slot `fields:[key]`; esto es maquinaria del EDITOR
(que vive solo en Studio). El detalle ya tenía un slot por campo (no cambia).

---

## 24. Cambios 2026-06-23 — apariencia por-chip COMPLETA en todas las ramas + slot-campo exento de validación

Commit SDK: `8c4e40e`. **Requiere paridad core_dart.**

### 24.1 — `fieldAppearances` por-chip COMPLETA (no solo color) en `ComposableSlot`
Antes solo el branch `stats` aplicaba la apariencia efectiva completa por entrada; el
resto (chips/list/table/inline/auto/tags/url_list/array) solo el color. Ahora un único
molde por entrada (`styleFor(key)`) aplica en TODAS las ramas: tipografía + color (base
del slot ← `fieldAppearances[key]`), fondo, y RECORTE (`appearanceTruncateClass` +
`truncateChars` cortando el string) + relleno + efecto DEL OVERRIDE del field (no de la
base, para no regresar recetas shipeadas). Causa raíz adicional: las entries de un ARRAY
se creaban SIN key → `fieldAppearances` nunca casaba; ahora llevan `key=f0.key` (el
truncado/color por-chip aplica a cada tag).

**En Flutter:** el render del composable debe aplicar, POR ENTRADA, la apariencia efectiva
(`base.merge(fieldAppearances?[key])`) COMPLETA — no solo color: tipografía, fondo, recorte
(maxLines / corte por `truncateChars`), relleno, efecto. Y conservar la `key` del field en
cada elemento de un array. (El corte por chars = `applyAppearanceTruncate`: `text.length<=n`
? text : `text.slice(0,n).trimEnd()+'…'`.)

### 24.2 — `validateSlot` exime al slot-CAMPO del chequeo de rol
Un slot-CAMPO (id = la clave de SU PROPIO field, `fields:[slotId]`) ya NO se valida contra
el rol homónimo del manifest (su `accepts` real lo da `classifyField` del field). Sin esto,
un campo cuya clave coincide con un id de rol con tipo incompatible (p.ej. un campo `title`
numérico) bloqueaba el guardado. **En Flutter:** si `core_dart` valida, replica el mismo
eximido (`fields.length===1 && fields[0]===slotId` → saltar el chequeo de accepts del rol).

### 24.3 — Editor "Campos del álbum" agrupado por tipo (Studio-only)
La paleta agrupa los campos por su KIND/tipo y nombra el slot por el NOMBRE del campo
(el tipo va como grupo/hint). Sin trabajo Flutter (maquinaria del editor).

---

**Referencias de lectura obligada (TS canónico):**
- `packages/react/src/recipes/RecipeRenderer.tsx` (props `hiddenSlots`, `filteredComposition`, reenvío a hero + LayoutRenderer).
- `packages/react/src/recipes/LayoutRenderer.tsx` (caso `hero_header`, `computeHiddenHeroRoles`).
- `packages/react/src/recipes/HeroHeader.tsx` (`isHidden`, gating banner/avatar/subtitle, `-mt-12` condicional).
- `packages/core/src/layout.ts` (`computeHiddenHeroRoles`), `format-scalar.ts`, `html-inline.ts`.
- `packages/react/src/recipe-utils.tsx` (`ScalarText`/`ComposableSlot`/`HtmlText`/`renderInlineToken`).
- Studio: `src/components/album/recipes/detail-slots.ts` (`detailHiddenSlots`, `imageSlotIds` — fuente única de qué ocultar) · `CardFocusOverlay.tsx` (lo consume) · `detail-templates.ts` (plantillas basadas en campos) · `DetailCompositionEditor.tsx` (selector + lienzo del detalle).
