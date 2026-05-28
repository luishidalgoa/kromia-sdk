---
title: Visión general
description: Qué es Kromia, qué problema resuelve y qué papel juega el SDK polyglot dentro del ecosistema.
category: Empezar aquí
---

# Visión general

## Qué es Kromia

Kromia es una plataforma para construir **álbumes de cromos coleccionables** modernos.  Un publisher (artista, hermandad, club deportivo, autor) define su álbum: qué cartas tiene, qué datos lleva cada una (nombre, foto, año, estadísticas…), cómo se ven en pantalla. Los coleccionistas las descubren, intercambian y completan en una app móvil.

Tres roles operan sobre el mismo modelo:

| Rol | Qué hace | Dónde |
|---|---|---|
| **Publisher** | Diseña el álbum: estructura, recetas, datos | `kromia-studio` (Next.js web) |
| **Coleccionista** | Descubre cartas, intercambia, completa | `kromia-flutter` (Flutter, móvil — en desarrollo) |
| **Backend** | Persiste, valida, sirve assets | `Kromia_NodeJS` (Express + Mongo) |

El **SDK polyglot** (`kromia-sdk`) es el contrato que asegura que los tres hablan el mismo idioma. Sin él, cualquier cambio en cómo se modela un álbum implica tocar tres repos y rezar para que estén alineados.

## El problema que el SDK resuelve

Antes del SDK polyglot (KRO-71 → KRO-82, 2026-05), Studio y Backend tenían lógica duplicada:

- Studio sabía qué es un "behavior `year`": valida `>= 1000`, renderiza como número de 4 dígitos.
- Backend sabía exactamente lo mismo, pero **en un archivo separado** y mantenido a mano.
- Flutter (cuando existiera) tendría que reimplementarlo por tercera vez.

Cada vez que un publisher pedía un comportamiento nuevo, había que cambiar 2-3 sitios y arriesgar drift. El bug clásico: el frontend permite un valor que el backend rechaza, el usuario invierte 10 minutos rellenando datos y le explota en la cara al guardar.

El SDK invierte la dependencia: **un solo source-of-truth + clientes que consumen, nunca duplican**.

```text
Antes:                            Después:

  Studio    Backend    Flutter      Studio    Backend    Flutter
    │         │           │            ↓         ↓          ↓
    └──drift──┴──drift────┘            └─────@kromia/core───┘
   (catálogos copiados en 3)              (un único registry)
```

## Arquitectura del SDK polyglot

El SDK son tres paquetes que comparten modelo pero divergen en presentación según la plataforma:

```text
                    @kromia/core
              (modelo + helpers puros)
                       ▲
            ┌──────────┴──────────┐
            │                     │
     @kromia/react           @kromia/flutter
     (recipes JSX +         (recipes Dart +
      Tailwind v3+)          Flutter widgets — futuro)
            │                     │
            ▼                     ▼
       kromia-studio        kromia-flutter app
       Backend NodeJS       (móvil coleccionista)
       (solo @kromia/core)
```

Reglas duras:

- **`@kromia/core` no depende de React.** Todo lo lenguaje-neutro vive aquí: tipos, registries (behaviors, recipes, actions, field types), validators, synth de datos sintéticos, helpers de formato. Lo consume cualquier plataforma TypeScript.
- **`@kromia/react` aporta el JSX.** Las 8 recipes (CompactAvatar, HeroProtagónico, …) + utilities (AvatarBox, ScalarText, …). Tailwind v3+ como peer dependency.
- **`@kromia/flutter` espeja la API React en Dart** (en desarrollo, KRO-83).

Backend NodeJS solo consume `@kromia/core` — no necesita renderers, solo modelo + validadores.

## Decisiones clave (resumen)

| Decisión | Por qué |
|---|---|
| **SDK como submodule Git** (no paquete npm publicado) | Producto interno, no abierto. Submodule da SemVer + permite trabajar en SDK y consumer simultáneamente sin `pnpm link` |
| **Source `.ts` / `.tsx` distribuido, no bundle** | El consumer (Next) procesa via `transpilePackages`. Sin build step en el SDK = ciclo de edición rápido + stack traces limpios |
| **Tags `krp/v<X.Y.Z>` en el repo SDK** | KRP = Kromia Recipe Protocol. Versionado independiente del consumer. Bump SemVer estricto por matriz documentada |
| **Catálogos cerrados en `@kromia/core/options.ts`** | Añadir opción aquí = aparece en todos los dropdowns sin tocar Studio. Studio no duplica catálogos, los consume |
| **Validador único cross-repo** (`validateComposition`) | KRO-79/80: Studio + Backend usan EL MISMO validador. Imposible que el frontend permita lo que el backend rechaza |

Detalles de cada decisión: ver carpeta `decisions/` del repo Backend (`Kromia_NodeJS/docs/decisions/`) — el SDK es producto de varios ADRs documentados allí.

## Cómo encajan los repos

```text
kromia-studio (Next.js)         ─┐
  └── kromia-sdk/ (submodule)    ├─ pnpm workspaces apuntando a packages/*
                                 │  via file: deps
Kromia_NodeJS (Express)         ─┘
  └── kromia-sdk/ (submodule)
       └── packages/core/        ─ tsconfig paths + jest moduleNameMapper
                                   apuntando a packages/core/src/index.ts
```

Cada consumer pinea a un **tag específico** (`krp/v2.1.1`, etc.). Bump del pin = PR explícito y consciente. Esto evita que un push al `main` del SDK rompa silenciosamente Studio o Backend.

## Filosofía

> "Source-of-truth ÚNICO + clientes que CONSUMEN, nunca duplican."

Los tres paquetes del SDK son el **mismo modelo expresado en distintos idiomas de plataforma**. Si dos lugares describen "qué es un behavior", solo uno gana — `@kromia/core`. Si Studio necesita un dropdown nuevo, la opción vive en `options.ts` del SDK y Studio la consume; nadie duplica.

## Para empezar

- **Necesitas entender los conceptos primero** → [Conceptos](/docs/02-concepts).
- **Quieres montar un consumer nuevo** → [Quick start](/docs/03-quickstart).
- **Vas a mantener el SDK desde dentro** → `kromia-sdk/AGENTS.md` (mapa de helpers, workflow de bump, gotchas).

---

*Última actualización: 2026-05-29 (KRO-87).*
