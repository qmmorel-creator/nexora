import assert from "node:assert/strict";

const checks = [
  ["Nexora health", "https://nexora-project.org/api/nexora/health", (d) => d.ok === true && d.projectId === "nexora-cb20d"],
  ["MCP health", "https://nexora-chatgpt-mcp.netlify.app/health", (d) => d.ok === true && d.service === "nexora-mcp"],
  ["MCP OAuth metadata", "https://nexora-chatgpt-mcp.netlify.app/.well-known/oauth-authorization-server", (d) => d.issuer === "https://nexora-chatgpt-mcp.netlify.app"],
];

for (const [name, url, validate] of checks) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  const data = await response.json();
  assert.equal(validate(data), true, `${name}: réponse invalide`);
  console.log(`${name}: OK`);
}

