# Detalle de carta — resolución de COLOR/APARIENCIA (spec consolidada · KRO-217)

Fuente canónica del **algoritmo de color** del panel de detalle, para que Flutter
lo espeje 1:1. Consolida en un solo sitio lo que en `kro198-detail-composition-flutter.md`
está repartido por feature (§12/§15/§18.1/§19.2/§20/§25). **Léelo primero si el
detalle sale con texto oscuro sobre fondo oscuro (o colores del tema en vez de los
del acabado).**

Render en Studio (referencia): `CardFocusOverlay` → `DetailsSheet` →
`RecipeRenderer` → `LayoutRenderer`. Modelo: `CardSchema.detailComposition`
(`ViewComposition`, render-only, NO bumpea el KRP).

## 0. La regla de oro (la causa del "dark-on-dark")

**NO existe elección de color de texto en runtime en NINGUNA plataforma.** La
legibilidad se garantiza en EDICIÓN: `applyThemePreset` (Studio) elige pares
fondo↔texto verificados WCAG-AA y **PERSISTE** `layout.surface.textColor` (global)
junto a `layout.surface.bgColor`. El renderer **solo lee y aplica** esos colores;
no los calcula.

→ **Flutter no puede "adivinar" el color de texto: DEBE leer `surface.textColor` y
aplicarlo.** En web ese color se propaga por **cascada CSS** (`paletteClass(
surface.textColor,'text')` en el div raíz → todos los slots sin color propio lo
heredan). Flutter no tiene cascada CSS → si no crea un `DefaultTextStyle` desde
`surface.textColor`, el texto cae al `foreground` del tema de la app → **oscuro
sobre el fondo oscuro del acabado**. Ése es el bug.

## 1. Los colores del contenedor raíz (`layout.surface`)

Todos son **ids de paleta** (o tokens de tema). Helpers en `@kromia/core/palette.ts`
(ya en `core_dart`):

| dato | cómo se resuelve | dónde se aplica |
|---|---|---|
| `surface.bgColor` | `paletteHex(bgColor)` → hex, o `null` si es token de tema | fondo del **panel/sheet** del detalle |
| `surface.screenBgColor` (fallback `bgColor`) | `screenBgHex(screenBgColor ?? bgColor)` (papel 18% hacia negro, factor **0.82**) | fondo de la **PANTALLA** que aloja el panel (para que la card resalte por elevación) |
| `surface.textColor` | `paletteHex(textColor)` → hex, o `null` si token de tema | **color de texto BASE** de TODO el subárbol del detalle (cascada) |

- `paletteHex` devuelve `null` para tokens de tema (`card`/`muted`/`foreground`) y
  `field:` → en ese caso, fondo/texto caen al tema de la app (comportamiento
  correcto: sin acabado, se usa el tema). **Cuando hay acabado, `textColor` SIEMPRE
  es un tono crudo con AA garantizado.**

**Flutter (accionable):**
1. Pantalla (Scaffold/host del detalle): `screenBgHex(surface.screenBgColor ?? surface.bgColor)`; si `null`, fondo de app.
2. Panel/sheet: `paletteHex(surface.bgColor)`; si `null`, token `card`.
3. **`DefaultTextStyle(color: paletteHex(surface.textColor))` envolviendo el subárbol del detalle** ← EL FIX. Un slot con `appearance.textColor` propio lo sobreescribe en su elemento (igual que la cascada CSS: hijo gana sobre raíz).

## 2. Apariencia efectiva POR slot (cascada — espejo de `resolveSlot`)

Para cada slot, la apariencia efectiva se ensambla en este orden (base ← lo de más
a la derecha gana). Ya espejado en `core_dart`/`kromia_flutter` (`mergeFieldAppearance`
+ `resolveConditionalStyling`), pero verifica que la ruta del DETALLE lo use:

1. **Base** = `slot.appearance` (heredando el `surface.textColor` del contenedor si no fija `textColor`).
2. **Condicional** = `resolveConditionalStyling(slot.conditionalStyle, item)` (contempla el `otherwise`/else). Si el caso NO tiene `target` → se mergea sobre la base de todo el slot; si tiene `target[]` (chips) → se mergea en `fieldAppearances[targetKeys]`.
3. **Por-field** = `fieldAppearances[fieldKey]` mergeado sobre la base (`mergeFieldAppearance`, shallow, override por-clave).

`textColor`/`bgColor` de un slot/field son **ids de paleta** → `paletteHex(id)` (o
`resolveFieldColor` para `field:<key>`). Sin color propio → hereda el
`DefaultTextStyle` del §1.3.

## 3. StatsRow — el bug de las "stats verdes" (§18.1)

La fila de stats (TASA DE APARICIÓN / ALTURA / PESO / DESCUBIERTA) la pinta el
prefab `StatsRow`, que **hardcodea** `text-foreground` (valor) y `text-muted-foreground`
(etiqueta) **salvo que el slot fije `appearance.textColor`**. Como esas clases son
EXPLÍCITAS, NO heredan el `DefaultTextStyle` del §1.3 → si el equivalente Dart
hardcodea un color del tema, las stats salen con el color del tema (p.ej. verde
marca sobre navy) aunque el resto del panel herede bien.

**Flutter:** el render de stats (equivalente a `StatsRow`) debe aplicar la
**apariencia EFECTIVA por estadística** (`mergeFieldAppearance(appearance,
fieldAppearances, key)`) COMPLETA — color (valor + etiqueta), tipografía, fondo
(→ pill si `display:'badge'`), recorte, relleno — y, a falta de color propio,
**heredar el `surface.textColor`** (no un `foreground` fijo). El VALOR sigue el
color efectivo; la ETIQUETA mantiene su rol de caption pero sobre el mismo texto
base legible.

## 4. Acento (tinte de la carta)

- Color = primer field con `behavior:'color_hex'` del item → `extractAccentSettings(composition, fields, item)` → `{ color, position, colorFieldKey, style }` (`@kromia/core/extract-accent.ts`).
- Posición: cascada `composition.accentPosition` → `slot.appearance.accentPosition` → default del recipe.
- Estilo (`accentStyle`): `bar`/`rounded`/`glow`/`gradient`/`ambient` — la matemática exacta (box-shadow inset / gradient) está en §25 del handoff grande. **Detalle: ancho `w=4`.**
- El slot cuyo `fields` incluye `colorFieldKey` **NO se pinta como celda** (su color YA es la raya) — §14.2.

## 5. Header del sheet (chrome de la app, NO del motor)

No hay un tipo "header" editable. El header del `DetailsSheet` es chrome de la
pantalla (en Studio, `CardFocusOverlay`; en Flutter, tu Scaffold del detalle):
- Fondo del panel = `paletteHex(surface.bgColor)` (§1.2) — que el panel iguale el papel del acabado, sin dejar huecos del color de app.
- Texto del header + CTA "Ocultar detalles" = `paletteHex(surface.textColor)` (§1.3) — mismo color base legible.
- El título sale de `resolveCardTitle` (prioridad `cardTitleKey`), no de un slot.

Lo que el user llama "modificar el header de detalles" = personalizar `surface.bgColor`
+ `surface.textColor` (Decoración → Fondo / Color de texto, o un Acabado) + elegir el
campo título (`cardTitleKey`).

## Checklist de paridad (el fix del dark-on-dark)

- [ ] Pantalla = `screenBgHex(surface.screenBgColor ?? surface.bgColor)`.
- [ ] Panel/sheet = `paletteHex(surface.bgColor)`.
- [ ] **`DefaultTextStyle` con `paletteHex(surface.textColor)` envolviendo el subárbol del detalle** (el fix). Slot con color propio → override.
- [ ] `null` de `paletteHex`/`screenBgHex` (token de tema) → fallback al tema de la app (no forzar un hex).
- [ ] StatsRow aplica apariencia efectiva por stat (no `foreground`/`muted` fijos).
- [ ] Acento por `extractAccentSettings` + `accentStyle`; suprimir la celda del `colorFieldKey`.
- [ ] Header del sheet = `bgColor`/`textColor` del surface.

> Nada de esto bumpea el KRP (todo render-only / DATA de álbum). El modelo ya es
> portable — la paridad es aplicar estos valores en la ruta del DETALLE, no un
> sistema nuevo. Detalle exhaustivo por feature: `kro198-detail-composition-flutter.md`.
