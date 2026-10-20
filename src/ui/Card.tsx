import type { ReactNode } from "react";

export type CardProps = {
  value: string;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  onSelect?: (value: string) => void;
  children?: ReactNode;
};

function spokenLabel(value: string): string {
  if (value === "?") return "carta interrogação";
  if (value === "☕") return "carta café";
  return `carta ${value}`;
}

export function Card({ value, selected = false, disabled = false, label, onSelect, children }: CardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label ?? spokenLabel(value)}
      disabled={disabled}
      data-selected={selected ? "true" : "false"}
      data-value={value}
      onClick={() => onSelect?.(value)}
      className={[
        "vote-card group relative grid min-h-11 w-full place-items-center",
        "aspect-[3/4] rounded-[10px] border",
        "num text-[19px] font-medium sm:text-[20px]",
        "disabled:cursor-not-allowed",
        selected
          ? "border-accent bg-[#1d1811] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_10px_rgba(0,0,0,0.45)]"
          : "border-line bg-elevated text-ink disabled:opacity-35",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span aria-hidden="true">{children ?? value}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2.5 top-2 h-px bg-white/[0.05]"
      />
      {/* Glow sutor radial que acompanha o mouse no card selecionado. */}
      {selected ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[10px]"
          style={{
            background:
              "radial-gradient(120px 80px at 50% 0%, rgba(217,160,91,0.10), transparent 72%)",
          }}
        />
      ) : null}
    </button>
  );
}
