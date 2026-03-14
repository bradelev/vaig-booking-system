# MCP Servers & Agent Skills Setup

Guía de configuración para MCP servers y agent skills usados en este proyecto con Claude Code.

---

## MCP Servers

### JIRA (configurado)

Usa `@aashari/mcp-server-atlassian-jira` via npx.

**Configuración en `.claude/mcp_settings.json`:**

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@aashari/mcp-server-atlassian-jira"],
      "env": {
        "ATLASSIAN_BASE_URL": "https://brauliodeleon.atlassian.net",
        "ATLASSIAN_EMAIL": "hi@brauliodeleon.com",
        "ATLASSIAN_API_TOKEN": "${ATLASSIAN_API_TOKEN}"
      }
    }
  }
}
```

**Seguridad:** El token debe vivir en una variable de entorno del sistema, no hardcodeado. Ver sección [Seguridad — Tokens](#seguridad--tokens) más abajo.

**Verificar:** Ejecutar `/mcp` en Claude Code y confirmar que `jira` aparece como servidor activo.

---

### GitHub

Agrega capacidades estructuradas de GitHub (issues, PRs, code search, repos) sin parsear output de terminal.

**Ventaja vs `gh` CLI:** Acceso a herramientas MCP tipadas que Claude puede usar directamente, con contexto estructurado.

**Opción A — Editar `.claude/mcp_settings.json` manualmente:**

```json
{
  "mcpServers": {
    "jira": { "...": "..." },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

**Opción B — Via CLI:**

```bash
claude mcp add --transport http --scope project github https://api.githubcopilot.com/mcp/
```

**Autenticación:** Ejecutar `/mcp` en Claude Code y seguir el flow de OAuth que aparece para GitHub.

---

## Agent Skills

### Vercel Labs (`vercel-labs/agent-skills`)

Skills para React/Next.js con foco en patterns de composición y performance.

**Repo:** https://github.com/vercel-labs/agent-skills

**Instalar todas las skills relevantes:**

```bash
npx --registry https://registry.npmjs.org skills add vercel-labs/agent-skills --skill '*' -a claude-code --yes
```

> **Nota:** Si el proyecto usa un registry privado (JFrog, Artifactory, etc.), usar `--registry https://registry.npmjs.org` para que `npx skills` resuelva desde npm público.

**O instalar skills específicas:**

```bash
npx --registry https://registry.npmjs.org skills add vercel-labs/agent-skills --skill 'react-best-practices' -a claude-code --yes
npx --registry https://registry.npmjs.org skills add vercel-labs/agent-skills --skill 'composition-patterns' -a claude-code --yes
npx --registry https://registry.npmjs.org skills add vercel-labs/agent-skills --skill 'web-design-guidelines' -a claude-code --yes
```

**Skills relevantes para VAIG:**

| Skill | Uso |
|-------|-----|
| `vercel-react-best-practices` | Performance patterns React/Next.js |
| `vercel-composition-patterns` | Compound components, render props, context |
| `web-design-guidelines` | UI review y accessibility |

**Skill NO relevante:** `vercel-react-native-skills` — no aplica, no hacemos mobile.

---

### Addy Osmani (`web-quality-skills`)

Skills para métricas de rendimiento real: Lighthouse, Core Web Vitals, LCP, CLS, accessibility audits. Framework-agnostic.

**Repo:** https://github.com/addyosmani/web-quality-skills

> **Nota:** No existe un repo separado llamado `agent-skills` de Addy Osmani. `web-quality-skills` es el proyecto de agent skills de Addy — el README dice "Agent Skills for optimizing web quality". No hay un segundo repo que agregar.

**Instalar:**

```bash
npx --registry https://registry.npmjs.org skills add addyosmani/web-quality-skills --skill '*' -a claude-code --yes
```

**Complementariedad con Vercel skills:**
- Vercel = patterns de código (cómo escribir)
- Addy = métricas de rendimiento real (qué optimizar y por qué)

**Recomendación:** Instalar ambos — se complementan sin solaparse.

---

## Seguridad — Tokens

El archivo `.claude/mcp_settings.json` contiene el `ATLASSIAN_API_TOKEN` y **no debe commitearse**.

### Pasos para proteger el token

**1. Agregar a `.gitignore`:**

```
.claude/mcp_settings.json
```

**2. Mover el token a una variable de entorno del sistema:**

En `~/.zshrc`:

```bash
export ATLASSIAN_API_TOKEN="tu-token-aqui"
```

Luego recargar: `source ~/.zshrc`

**3. Referenciar la variable en `mcp_settings.json`:**

```json
"ATLASSIAN_API_TOKEN": "${ATLASSIAN_API_TOKEN}"
```

**4. Verificar que el token no está tracked:**

```bash
git status .claude/
git log --all --full-history -- .claude/mcp_settings.json
```

Si ya fue commiteado, rotar el token en https://id.atlassian.com/manage-profile/security/api-tokens.
