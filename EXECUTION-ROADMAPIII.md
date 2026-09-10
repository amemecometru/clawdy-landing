# Instruction for Opencode: Block 1 — Public Header Navigation & Dynamic Social Widget Builder

Implement the updated public header navigation and the modular social widget builder framework for the studio dashboard.

## 1. Public Header Navigation Overhaul
Update the main layout header to display the exact requested navigation sequence with working dropdown functionality:
- **[Models]** (Dropdown: Claude, Gemini, Grok, openWeights)
- **[Product]** (Dropdown: Agents, Cloud, Mobile, Automations, CLI, Marketplace-mcp*)
- **[Resources]**
- **[Sandbox]**
- **[Studio]**
- **[Pricing]**
- **[Sign In]**

## 2. Dynamic Social Widget Builder System
- Implement a functional **`[ + WidgetFeed ]`** action within the Studio interface (accessible via sidebar).
- Clicking the action must open a selection menu allowing operators to mount modular social media and content feed widgets onto their dashboard grid.
- Ensure the widget selection drawer supports multiple platform options dynamically (non-hardcoded configuration slots):
  - **X (Twitter)**
  - **Facebook**
  - **YouTube**
  - **HackerNoon**
  - **Medium**
  - **Substack**
- Make Proper Platform Connections via browser "live" feed, via webhook "notifications", "events" etc, user needs access to live information feeds through the widgets (IMPORTANT).

## 3. Connection Cloudflare Cloud & Models 
- **[Models]** cf-workers-ai for most models, flux-imaging, huggingface will connect openWeight models, we will connect legacy: anthropic, grok, google-gemini-models, flow, omni.
- **[CLI]** create the cli, to current project. 
- add Huggingface-mcp -> Tool-Registry: implementation human operator/agent-mcp schema.
[ That's it for this round, We MUST REMEMBER we're building a developers/agent-mcp schema side studio, but we're also building a human operators side-a Client-Side that's who will be paying the bills so the destintion between these two needs to be stark, the dev side json is fine, but the client side of this studio CANNOT be json wrapped up a little more presentable, that won't work, the human operator side MUST have the backend functions happening "Behind-the-Curtain", human facing components must act out backend function (IMPORTANT).
