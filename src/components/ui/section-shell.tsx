import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type SectionShellProps = {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  badgeVariant?: "ember" | "rust" | "beacon" | "outline";
  align?: "center" | "left";
  tone?: "light" | "dark";
  className?: string;
  children: React.ReactNode;
};

export function SectionShell({
  eyebrow,
  title,
  description,
  badgeVariant = "ember",
  align = "center",
  tone = "light",
  className,
  id,
  children,
}: SectionShellProps) {
  const isDark = tone === "dark";
  return (
    <section
      id={id}
      className={cn(
        "relative w-full",
        isDark ? "text-porcelain" : "text-obsidian",
        className
      )}
    >
      <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <div
          className={cn(
            "mb-12 md:mb-16 flex flex-col gap-4",
            align === "center" ? "items-center text-center" : "items-start"
          )}
        >
          {eyebrow && (
            <Badge variant={badgeVariant} className="font-mono uppercase">
              {eyebrow}
            </Badge>
          )}
          <h2
            className={cn(
              "max-w-3xl text-3xl font-bold tracking-tight md:text-5xl",
              isDark ? "text-porcelain" : "text-obsidian"
            )}
          >
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                "max-w-2xl text-base md:text-lg leading-relaxed",
                isDark ? "text-porcelain/70" : "text-muted-foreground"
              )}
            >
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}