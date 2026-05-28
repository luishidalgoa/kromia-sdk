---
title: Documentación de Kromia SDK
description: Modelo polyglot de coleccionables — recipes, behaviors, validators y renderers compartidos por Studio, Backend y Flutter.
hide:
  - toc
---

# Kromia SDK

El SDK polyglot de Kromia. Un **único modelo** de coleccionables (cromos, álbumes, recipes, behaviors) consumido por:

- :material-monitor-dashboard: **Studio** (Next.js, editor web del publisher)
- :material-server: **Backend NodeJS** (Express + Mongo, persistencia + validación)
- :material-cellphone: **Flutter app** (renderer móvil del coleccionista — en desarrollo)

Esta documentación cubre **qué es Kromia, cómo encaja el SDK y cómo consumirlo** desde un cliente nuevo.

---

## Para empezar

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **[Visión general](01-overview.md)**

    ---

    Qué es Kromia, qué problema resuelve el SDK polyglot, decisiones de arquitectura clave (monorepo, source TS, SemVer estricto).

-   :material-school:{ .lg .middle } **[Conceptos clave](02-concepts.md)**

    ---

    Vocabulario del modelo: section, field, behavior, recipe, slot, view composition, appearance, action. Imprescindible antes de tocar el SDK.

-   :material-lightning-bolt:{ .lg .middle } **[Quick start](03-quickstart.md)**

    ---

    Monta un cliente React que renderiza una carta en 5 minutos. Submodule + install + Next.js + Tailwind + render.

</div>

---

## Para mantener el SDK desde dentro

Si vas a **editar el SDK** (no consumirlo), tienes documentación distinta:

- [`AGENTS.md`](https://github.com/luishidalgoa/kromia-sdk/blob/main/AGENTS.md) — mapa de paquetes, tabla "qué helper para qué", workflow de bump SemVer, gotchas conocidos (pnpm copy en Windows, submodule sync, etc.).
- [`playbooks/`](https://github.com/luishidalgoa/kromia-sdk/tree/main/playbooks) — guías paso-a-paso para añadir behaviors, recipes, actions; bumpear protocol version; ship una tarea, etc.
- [`packages/core/README.md`](https://github.com/luishidalgoa/kromia-sdk/blob/main/packages/core/README.md) — API del paquete model.
- [`packages/react/README.md`](https://github.com/luishidalgoa/kromia-sdk/blob/main/packages/react/README.md) — API del paquete renderers.

---

!!! info "Audiencia"

    Esta documentación es **interna por ahora** (uso del equipo Kromia). Cuando abramos el editor a publishers externos, será la doc de onboarding principal.

!!! tip "Encuentras algo erróneo o incompleto?"

    Cada página tiene icono ":material-file-edit:" arriba a la derecha. Clic → edita el `.md` directamente en GitHub. PRs bienvenidos.
