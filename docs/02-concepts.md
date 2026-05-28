---
title: Conceptos clave
description: El vocabulario del modelo Kromia — section, field, behavior, recipe, slot, view composition, appearance, action. Imprescindible antes de tocar el SDK o el editor.
category: Empezar aquí
---

# Conceptos clave

Antes de tocar código o leer un helper, asegúrate de tener interiorizados estos 8 conceptos. Sin ellos, los nombres de los exports del SDK suenan a abstracciones sin propósito.

## 1. Section

Una **sección** es una agrupación lógica de cartas con el mismo esquema. Un álbum tiene N secciones.

Ejemplos del catálogo:

- *Mundial 2026* → secciones: `equipos`, `jugadores`, `momentos`.
- *Holy Cards* → secciones: `hermandades`, `pasos`, `imagenes`.
- *Mitos griegos* → secciones: `dioses`, `heroes`, `criaturas`.

Cada sección define:

- Sus **fields** (datos que cada carta tiene: nombre, foto, año, descripción…).
- Su **`primaryKey`** (qué field actúa de identificador único).
- Su **`viewComposition`** (cómo se renderizan las cartas en pantalla — ver sección 5).

## 2. Field

Un **field** es una columna del esquema de una sección. Cada carta tendrá un valor para ese field.

Estructura mínima:

```ts
interface CardFieldDefinition {
  key:        string;      // 'nombre', 'foto', 'año_fundacion'
  label:      string;      // 'Nombre', 'Foto', 'Año de fundación' (visible al publisher)
  type:       FieldType;   // 'text' | 'number' | 'image' | 'array<image>' | 'select' | 'cardRef' | 'array<sectionRef:KEY>'
  required?:  boolean;     // ¿el publisher debe rellenarlo siempre? Default false
  behavior?:  string;      // ¿tratamiento especial? Ver sección 3
  width?:     'xs'|'sm'|'md'|'lg';
}
```

Los **types** son cerrados (lista enumerable). Los **behaviors** son extensibles (cada uno añade reglas extra encima del type base).

## 3. Behavior

Un **behavior** es un tratamiento opcional encima de un field type. Refina cómo se valida, formatea o renderiza.

| Field type | Behaviors disponibles |
|---|---|
| `number` | `year` (4 dígitos, ≥ 1000), `rating` (0-5 estrellas), `percentage` (formato %), `currency` (formato moneda), `incremental` (auto-incremental por carta) |
| `text` | `url` (validar http/s), `email`, `phone`, `color_hex` (#RRGGBB), `iso_date`, `markdown`, `enum`, `ordinal_enum` |
| `array<image>` | `gallery` (grid en detalle) |
| `text` (extendido) | `card_index_list` (CSV → array de refs) |

Sin behavior, el field se renderiza "tal cual" (default: scalar text).

**Ejemplo práctico**: un field `año_fundacion` tipo `number` con behavior `year`. Validación: el publisher no puede escribir `99` (queda rechazado por `>= 1000`). Renderización: aparece como `1873` en la app, no como `1.873` (sin separador de miles, formato año).

## 4. Slot kind

Cuando renderizamos cartas, cada recipe expone **slots** (huecos a llenar). Cada slot tiene un **kind** que define qué fields acepta.

| Kind | Qué acepta |
|---|---|
| `text-short` | Una línea de texto sin formato (nombre, título corto, fecha) |
| `image-avatar` | Una imagen (foto, escudo, ícono). Renderer aplica shape + aspect ratio |
| `badge` | Etiqueta destacada (rareza, categoría, rating con estrellas) |
| `color` | Color asociado al ítem — alimenta el accent del card, raramente visible solo |
| `card-ref` | Array de referencias a otras cartas del álbum (jugadores de un equipo) |
| `section-ref` | Una sección entera del álbum (rara vez) |
| `any` | Cualquier field (para slots experimentales) |

Un slot del kind `image-avatar` rechazará un field type `number` — la matriz de compatibilidad vive en `@kromia/core/classify.ts`.

## 5. Recipe + View composition

Una **recipe** es un layout reutilizable. El catálogo V1 tiene 8:

| Recipe | Kind | Cuándo |
|---|---|---|
| `compact_avatar` | list | Foto circular + nombre + dato corto (lista densa) |
| `compact_card` | list | Imagen cuadrada + título + badge (grid visual) |
| `hero_protagonico` | detail | Banner + título grande + descripción + mini-cards anidadas |
| `row_text` | list | Solo texto, sin imagen (tablas) |
| `editorial` | detail | Card tipo blog post |
| `momento` | detail | Tipo Instagram (foto cuadrada + caption) |
| `accordion_simple` | list | Filas colapsables |
| `accordion_with_actions` | list | Acordeón + CTAs |

Una **view composition** es la elección del publisher: qué recipe usar + qué field va a cada slot.

```ts
const composition: ViewComposition = {
  recipe:        'compact_avatar',       // ← elige la recipe
  action:        'navigate_to_detail',   // ← qué pasa al tocar la carta
  targetRecipe:  'hero_protagonico',     // ← receta de la vista detalle
  slots: {
    avatar:   { fields: ['foto'] },      // ← `foto` (field) va al slot `avatar`
    title:    { fields: ['nombre'] },
    subtitle: { fields: ['posicion'] },
    badge:    { fields: ['rareza'] },
  },
};
```

El editor de Studio renderiza dropdowns para que el publisher elija recipe + slots sin escribir JSON a mano.

## 6. Appearance (por slot)

Cada slot puede personalizar su aspecto via `appearance`. Propiedades cerradas (catálogos en `options.ts`):

```ts
appearance: {
  shape:          'circle' | 'square' | 'rounded',
  aspect:         '1:1' | '16:9' | '4:3' | '3:4' | '9:16' | 'free',
  align:          'left' | 'center' | 'right',
  weight:         'regular' | 'semibold' | 'bold',
  size:           'sm' | 'md' | 'lg' | 'xl',
  truncate:       '1' | '2' | '3' | 'none',
  paddingY:       'none' | 'sm' | 'md' | 'lg',
  accentPosition: 'auto' | 'top' | 'left' | 'right' | 'bottom' | 'none',
}
```

Y **presets** compuestos para un click:

- `avatar` (circle 1:1)
- `banner` (rounded 16:9)
- `portrait` (rounded 3:4 — cromos verticales tipo Magic)
- `story` (rounded 9:16 — móvil-first)
- `polaroid` (rounded 4:3)
- `square` (square 1:1)

Cada recipe declara qué appearance props soporta cada slot (no todos los slots aceptan todas — un slot de texto no usa `shape`).

## 7. Action

Qué pasa cuando el coleccionista toca la carta o un slot:

| Action | Comportamiento |
|---|---|
| `none` | Informativo. Sin respuesta al toque |
| `navigate_to_detail` | Abre vista detalle (recipe definida en `targetRecipe`) |
| `modal` | Abre detalle como overlay sin perder contexto |
| `expand_inline` | Despliega contenido in-line (acordeón) |
| `external_link` | Abre URL externa (web, redes) |

Acciones se eligen a nivel de composition (toda la carta) o per-slot (la imagen abre detalle pero el badge no).

## 8. Accent

El **accent** es la línea de color que rodea o subraya el card. Identifica visualmente cada carta por su color asociado (color del equipo, color de la hermandad).

- Origen: un field tipo `text` con behavior `color_hex` asignado a un slot `color`.
- Posición: configurable per slot (`accentPosition`).
- Default: `auto` — la recipe decide la posición típica (arriba para cards, izquierda para accordion).

---

## Cómo encajan los conceptos: un ejemplo end-to-end

Imagina que un publisher quiere modelar la sección **Equipos** del Mundial 2026.

```ts
// 1. Section
const equipos = {
  displayName: 'Equipos',
  primaryKey: 'nombre',
  fields: [
    { key: 'nombre',     type: 'text',   label: 'Nombre',     required: true },
    { key: 'escudo',     type: 'image',  label: 'Escudo',     required: true },
    { key: 'color',      type: 'text',   label: 'Color',      behavior: 'color_hex' },
    { key: 'fundacion',  type: 'number', label: 'Fundación',  behavior: 'year' },
    { key: 'jugadores',  type: 'array<sectionRef:jugadores>', label: 'Plantilla' },
  ],
  viewComposition: {
    recipe:       'compact_avatar',
    action:       'navigate_to_detail',
    targetRecipe: 'hero_protagonico',
    slots: {
      avatar:   { fields: ['escudo'],     appearance: { shape: 'square', aspect: '1:1' } },
      title:    { fields: ['nombre'] },
      subtitle: { fields: ['fundacion'] },
      color:    { fields: ['color'] },
    },
  },
};
```

Resultado:

- En la lista de equipos: cada equipo se ve como una fila con escudo cuadrado a la izquierda, nombre en negrita, año de fundación debajo. Una línea de color (el color del equipo) acentúa cada card.
- Al tocar un equipo: se abre la vista detalle (`hero_protagonico`) con el escudo grande, la plantilla de jugadores debajo en grid.

Todos los datos están validados por el SDK antes de salir del editor o entrar al backend.

## Para profundizar

- **Quiero montar un cliente con esto** → [Quick start](/docs/03-quickstart).
- **Quiero añadir un behavior nuevo** → `kromia-sdk/playbooks/add-behavior.md`.
- **Quiero añadir una recipe nueva** → `kromia-sdk/playbooks/add-recipe.md`.

---

*Última actualización: 2026-05-29 (KRO-87).*
