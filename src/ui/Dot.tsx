export type DotState = "online" | "offline";

export function Dot({ state, label }: { state: DotState; label?: string }) {
  const online = state === "online";
  return (
    <span
      role="img"
      aria-label={label ?? (online ? "online" : "offline")}
      className={[
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        online ? "bg-ok shadow-[0_0_0_3px_rgba(21,128,61,0.16)]" : "bg-faint",
      ].join(" ")}
    />
  );
}
