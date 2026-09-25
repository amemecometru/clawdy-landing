Implement only the smallest missing production slice from your report.

Preferred target:
Inbound lead/request → HITL approval task → approved personalized outreach email → execution result → telemetry.

Constraints:
- preserve the existing landing OAuth flow;
- use the existing task database and approval mechanisms;
- use the existing encrypted vault;
- do not create a second task system;
- do not add OmniRoute to production;
- do not modify ~/agentic.clawdy;
- do not delete Studio features yet;
- do not create mock success responses;
- do not add UI unless it is connected to a real backend route;
- do not use anonymous credentials for a user-specific external action;
- keep high-impact actions HITL-intercepted by default.

Use 21st.dev MCP only if a small UI component is genuinely needed. If used, adapt it to the existing design system rather than replacing the current layout.

Before editing:
- list each file to change;
- state the runtime behavior after the change;
- state the required environment variables and Cloudflare bindings.

After editing:
1. run the existing typecheck;
2. run the existing build;
3. run relevant tests;
4. add focused tests for task creation, approval/rejection, and execution;
5. test the API route locally where possible;
6. show the diff summary;
7. identify any remaining production blockers.
