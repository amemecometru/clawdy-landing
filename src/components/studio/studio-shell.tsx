import * as React from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
}

/**
 * Central Station layout shell: collapsible command rail + content column.
 * Dark command-center theme with industrial silver borders.
 */
export function StudioShell({
  nav,
  activePath,
  onNavigate,
  sidebar,
  widgetFeedAction,
  children,
  className,
}: {
  nav: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  sidebar?: React.ReactNode;
  widgetFeedAction?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div className={cn("flex min-h-screen bg-obsidian text-porcelain", className)}>
      <aside
        className={cn(
          "sticky top-0 h-screen shrink-0 border-r border-silver/20 bg-obsidian/95 backdrop-blur transition-[width] duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ember font-mono text-sm font-bold text-chrome">
              文
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-porcelain">Central Station</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  agents.clawdyclaw.com
                </div>
              </div>
            )}
          </div>

          <nav className="flex flex-col gap-1 px-2">
            {nav.map((item) => (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                title={item.label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition cursor-pointer",
                  activePath === item.path
                    ? "bg-rust font-medium text-porcelain"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-porcelain"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center font-mono text-xs">
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="flex-1 truncate text-left">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-ember">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>

          {widgetFeedAction && (
            <div className="px-2 pt-2">
              <button
                onClick={widgetFeedAction}
                title="Mount a live feed widget"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border border-ember/40 bg-rust px-3 py-2.5 text-sm font-semibold text-chrome transition hover:bg-ember cursor-pointer",
                  collapsed && "justify-center px-0"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center font-mono text-base leading-none">+</span>
                {!collapsed && <span className="flex-1 truncate text-left font-mono tracking-wide">WidgetFeed</span>}
              </button>
            </div>
          )}

          {sidebar}

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="mx-3 mt-auto mb-3 flex items-center justify-center gap-2 rounded-md border border-silver/20 py-2 text-xs uppercase tracking-widest text-muted-foreground transition hover:bg-muted/40 hover:text-porcelain cursor-pointer"
          >
            {collapsed ? "»" : "« Collapse"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}