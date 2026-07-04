# @kromia/mcp

Servidor **MCP** de Kromia (KRO-156). Expone el modelo del SDK (`@kromia/core`) —
recetas, componentes, tipos de campo, slot-kinds, plantillas de layout — y la
**validación** como *tools* deterministas, para que un **agente externo** (Claude
en Desktop/Code) diseñe álbumes: explora el catálogo, propone una composición y la
**valida en bucle** contra `validateComposition` hasta que sea renderizable.

> Por qué MCP y no un LLM interno: el V1 (botón "Sugerir diseño" con un modelo
> flojo generando libre) falló por calidad de diseño. Aquí la inteligencia es un
> agente capaz; Kromia solo aporta tools deterministas + el validador.

## Fases
- **F1 ✅** — lectura + validación. **Pura**: solo `@kromia/core`, sin backend ni auth.
  - `list_recipes` · `list_components` · `list_field_types` · `list_slot_kinds`
  - `list_templates` (por receta) · `describe` (definición completa de un elemento)
  - `validate_composition` (el bucle corrector)
- **F2 ✅** — construcción (también pura):
  - `auto_compose` — fields → ViewComposition sensata (heurística del SDK) + validación.
  - `apply_template` — aplica una plantilla de layout a una composición (elegir+ajustar > diseñar desde cero) + validación.
  - `get_template` — inspecciona el árbol de layout que produce una plantilla.
- **F3 ✅** — aplicar al álbum real:
  - `apply_composition` — aplica una ViewComposition a la sección de un schema. **DRY-RUN por defecto** (valida + muestra qué cambiaría, no escribe); escribe solo con `confirm:true`. Requiere env `KROMIA_API_URL` + `KROMIA_TOKEN` (Bearer). Backend versiona (revertible).
- **F4 ✅** — transporte **remoto** (Streamable HTTP) para agentes/terceros. Mismo set de tools servido por HTTP; stateful (sesión por `mcp-session-id`); auth Bearer opcional (`KROMIA_MCP_AUTH_TOKEN`). Endpoint `POST/GET/DELETE /mcp`.

Para escribir (F3), añade al config del cliente MCP:
```json
"env": { "KROMIA_API_URL": "http://localhost:3000/api", "KROMIA_TOKEN": "<tu JWT>" }
```

## Uso remoto (F4, Streamable HTTP)
```bash
pnpm --filter @kromia/mcp start:http   # = tsx src/http.ts
# env: KROMIA_MCP_PORT (default 8790) · KROMIA_MCP_AUTH_TOKEN (opcional)
```
Cliente MCP remoto → URL `http://<host>:8790/mcp` (+ `Authorization: Bearer <token>` si configuraste auth).

Flujo del agente: `auto_compose` (o `apply_template`) → `validate_composition` → corrige por `path` → repite hasta `valid:true`.

## Uso (local, stdio)
```bash
pnpm --filter @kromia/mcp start   # = tsx src/index.ts
```
Config de un cliente MCP (p.ej. Claude Desktop `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "kromia": { "command": "tsx", "args": ["<ruta>/kromia-sdk/packages/mcp/src/index.ts"] }
  }
}
```

## Tests
```bash
pnpm --filter @kromia/mcp test
```
Usa el transporte in-memory del MCP SDK (Client ↔ Server) — sin proceso ni stdio.
