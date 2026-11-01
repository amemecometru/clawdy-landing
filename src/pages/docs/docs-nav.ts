export type DocsRoute =
  | { kind: "landing" }
  | { kind: "page"; slug: string }
  | { kind: "redirect"; to: string };

export const BASE = "https://mcp.clawdyclaw.com";
export const PREVIEW = "https://clawdyclaw.mllm.workers.dev";

export const DOCS_PAGES: Array<{ slug: string; title: string; description: string; icon: string }> = [
  { slug: "cli-reference", title: "CLI Reference", description: "Drive the worker from your terminal.", icon: "›_" },
];

export type DocCommand = {
  label: string;
  code: string;
  comment?: string;
  method?: string;
  path?: string;
  commandKey?: string;
};

export const DOC_COMMANDS: DocCommand[] = [
  {
    label: "Install",
    code: "node cli/clawdy.mjs status   # or: curl -fsSL https://raw.githubusercontent.com/amemecometru/clawdy-landing/main/cli/clawdy.mjs | node - status",
    comment: "zero-dependency · Node ≥ 18 (npm package publish pending approval)",
  },
  {
    label: "Point at your worker",
    code: `export CLAWDYCLAW_BASE_URL=${BASE}`,
    comment: "defaults to the live edge worker already",
  },
  {
    label: "Health",
    code: "clawdy status",
    method: "GET",
    path: "/api/health",
    commandKey: "status",
  },
  {
    label: "Model registry",
    code: "clawdy models",
    method: "GET",
    path: "/api/v1/models",
    commandKey: "models",
  },
  {
    label: "Approval queue",
    code: "clawdy tasks pending",
    method: "GET",
    path: "/api/v1/tasks",
    commandKey: "tasks",
  },
  {
    label: "Execution feed",
    code: "clawdy telemetry",
    method: "GET",
    path: "/api/v1/telemetry",
    commandKey: "telemetry",
  },
  {
    label: "API Vault status",
    code: "clawdy integrations",
    method: "GET",
    path: "/api/v1/integrations",
    commandKey: "integrations",
  },
  {
    label: "Dashboard widgets",
    code: "clawdy widgets",
    method: "GET",
    path: "/api/v1/portal/widgets",
    commandKey: "widgets",
  },
  {
    label: "Live feed stream",
    code: "clawdy feed medium  # youtube | medium | substack | hackernoon",
    method: "GET",
    path: "/api/v1/feeds/",
    commandKey: "feed",
  },
  {
    label: "Push a payload into the economy",
    code: "clawdy webhook github '{\"event\":\"star\",\"repo\":\"amemecometru/clawdyclaw-landing\"}'",
    method: "POST",
    path: "/api/v1/webhook/ingress",
    commandKey: "webhook",
  },
  {
    label: "Dry-run sandbox trace",
    code: "clawdy simulate '{\"document\":{\"text\":\"Urgent: reset the staging API key\"}}'",
    method: "POST",
    path: "/api/v1/sandbox/simulate",
    commandKey: "simulate",
  },
  {
    label: "OAuth connect URLs",
    code: "clawdy auth",
    commandKey: "auth",
  },
];

export function resolveDocsRoute(pathname: string): DocsRoute {
  if (pathname === "/studio/cli" || pathname.startsWith("/studio/cli/")) {
    return { kind: "redirect", to: "/docs/cli-reference" };
  }
  if (pathname === "/docs" || pathname === "/docs/") {
    return { kind: "landing" };
  }
  if (pathname === "/docs/cli-reference") {
    return { kind: "page", slug: "cli-reference" };
  }
  if (pathname.startsWith("/docs/")) {
    return { kind: "redirect", to: "/docs" };
  }
  return { kind: "redirect", to: "/docs" };
}
