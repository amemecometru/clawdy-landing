import * as React from "react";
import { FEED_PLATFORMS } from "@/lib/feed-platforms";

/**
 * [+ WidgetFeed] selection drawer — mounts modular platform widgets onto the
 * operator dashboard. Platform slots are data-driven (see feed-platforms) so
 * new platforms mount without hardcoded JSX.
 */
export function WidgetFeedDrawer({
  open,
  onClose,
  mounted,
  onMount,
}: {
  open: boolean;
  onClose: () => void;
  mounted: string[];
  onMount: (platformId: string, config?: Record<string, string>) => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const feedTypes = FEED_PLATFORMS.filter((p) => p.type === "feed");
  const eventTypes = FEED_PLATFORMS.filter((p) => p.type === "events");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      <button
        aria-label="Close widget drawer"
        onClick={onClose}
        className="absolute inset-0 bg-obsidian/70 backdrop-blur-sm cursor-pointer"
      />
      <div className="relative flex h-[90vh] w-full max-w-md flex-col border-l border-silver/30 bg-obsidian shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-silver/20 px-5 py-4">
          <div>
            <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-porcelain">
              + WidgetFeed
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mount live information feeds onto your dashboard grid.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md border border-silver/25 text-muted-foreground transition hover:bg-muted/40 hover:text-porcelain cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <SectionLabel>Live feed streams</SectionLabel>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {feedTypes.map((p) => (
              <PlatformCard
                key={p.id}
                platform={p}
                mounted={mounted.includes(p.id)}
                onMount={(config) => onMount(p.id, config)}
              />
            ))}
          </div>

          <SectionLabel>Webhook event streams</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {eventTypes.map((p) => (
              <PlatformCard
                key={p.id}
                platform={p}
                mounted={mounted.includes(p.id)}
                onMount={(config) => onMount(p.id, config)}
              />
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-silver/20 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-mono uppercase tracking-widest text-ember">behind-the-curtain</span>
            <p className="mt-1">
              Feeds are aggregated server-side at the edge. Event streams accept platform
              notifications and webhooks — mount one, then press <strong>Test event</strong> on the
              widget to watch the notification arrive live.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}

function PlatformCard({
  platform,
  mounted,
  onMount,
}: {
  platform: { id: string; name: string; icon: string; color: string; tagline: string; type: string; config?: Array<{ key: string; label: string; placeholder: string; default: string }> };
  mounted: boolean;
  onMount: (config: Record<string, string>) => void;
}) {
  const [config, setConfig] = React.useState<Record<string, string>>(() =>
    (platform.config ?? []).reduce<Record<string, string>>((acc, f) => {
      acc[f.key] = f.default;
      return acc;
    }, {})
  );
  const [arming, setArming] = React.useState(false);

  if (arming) {
    return (
      <div className="col-span-2 rounded-xl border border-ember/40 bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className={`text-base font-black ${platform.color}`}>{platform.icon}</span>
          <span className="text-sm font-semibold text-porcelain">{platform.name}</span>
        </div>
        <div className="space-y-2">
          {platform.config?.length ? (
            platform.config.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {f.label}
                </span>
                <input
                  value={config[f.key] ?? ""}
                  onChange={(e) => setConfig((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-silver/25 bg-obsidian px-2.5 py-1.5 text-xs text-porcelain outline-none transition focus:border-ember/60"
                />
              </label>
            ))
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No config required — accepts default stream.
            </p>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onMount(config)}
            className="flex-1 rounded-md bg-rust px-3 py-1.5 font-mono text-xs font-semibold text-chrome transition hover:bg-ember cursor-pointer"
          >
            Mount widget
          </button>
          <button
            onClick={() => setArming(false)}
            className="rounded-md border border-silver/25 px-3 py-1.5 font-mono text-xs text-muted-foreground transition hover:text-porcelain cursor-pointer"
          >
            back
          </button>
        </div>
        <div className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          source · {platform.id} live pipeline
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setArming(true)}
      disabled={mounted}
      className="group flex flex-col rounded-xl border border-silver/25 bg-card p-3 text-left transition hover:border-ember/50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span className={`text-lg font-black ${platform.color}`}>{platform.icon}</span>
        <span className="text-sm font-semibold text-porcelain">{platform.name}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{platform.tagline}</p>
      <span
        className={
          mounted
            ? "mt-2 inline-flex w-fit rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400"
            : "mt-2 inline-flex w-fit rounded-full bg-ember/15 px-2 py-0.5 font-mono text-[10px] text-ember"
        }
      >
        {mounted ? "mounted ✓" : "+ mount"}
      </span>
    </button>
  );
}