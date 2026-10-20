import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "ink" | "accent" | "ok" | "danger";
export type BadgeSize = "sm" | "xs";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line bg-elevated text-muted",
  ink: "border-line-strong bg-elevated text-ink",
  accent: "border-accent/40 bg-canvas text-ink",
  ok: "border-ok/45 bg-ok/15 text-ok-text",
  danger: "border-danger/40 bg-danger/15 text-danger-text",
};

const sizes: Record<BadgeSize, string> = {
  sm: "h-[22px] px-2 text-[10px] tracking-[0.12em]",
  xs: "h-[15px] px-1.5 text-[9px] tracking-[0.06em]",
};

export function Badge({
  tone = "neutral",
  size = "sm",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full border font-medium whitespace-nowrap uppercase leading-none",
        sizes[size],
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}