"use client";

import NumberFlow, { type Value } from "@number-flow/react";
import { cn } from "@/lib/utils";

type NumberTickerProps = {
  value: Value;
  label?: string;
  decimals?: number;
  className?: string;
  live?: boolean;
};

function NumberTicker({
  value,
  label,
  decimals = 0,
  className,
  live = false,
}: NumberTickerProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {live && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-beacon opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-beacon" />
        </span>
      )}
      <NumberFlow
        value={value}
        format={{
          notation: "standard",
          compactDisplay: "short",
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }}
        className={className}
      />
      {label && (
        <span className="text-muted-foreground text-sm font-medium">
          {label}
        </span>
      )}
    </div>
  );
}

export default NumberTicker;