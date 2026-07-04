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
- **F1 (esta)** — lectura + validación. **Pura**: solo `@kromia/core`, sin backend ni auth.
  - `list_recipes` · `list_components` · `list_field_types` · `list_slot_kinds`
  - `list_templates` (por receta) · `describe` (definición completa de un elemento)
  - `validate_composition` (el bucle corrector)
- **F2** — construcción: `create_composition` / `mutate_layout` / `pick_and_adjust_template` / `preview`.
- **F3** — aplicar al álbum real (auth + API del backend).
- **F4** — transporte remoto (HTTP/SSE) para agentes/terceros.

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
