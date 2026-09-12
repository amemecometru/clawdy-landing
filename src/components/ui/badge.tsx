import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 font-medium",
  {
    variants: {
      variant: {
        default: "border-silver bg-chrome text-obsidian dark:bg-muted dark:text-porcelain",
        ember: "border-ember bg-ember/10 text-ember dark:text-ember",
        rust: "border-rust bg-rust text-porcelain",
        beacon: "border-beacon bg-beacon/10 text-beacon",
        obsidian: "border-obsidian bg-obsidian text-porcelain",
        outline: "border-silver text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };