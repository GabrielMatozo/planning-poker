import type { CSSProperties } from "react";

export type AvatarSize = "sm" | "md";

export function initialOf(name: string): string {
  const cleaned = name.trim();
  const match = cleaned.match(/[\p{L}\p{N}]/u);
  if (match) return match[0].toLocaleUpperCase("pt-BR");
  const first = Array.from(cleaned)[0];
  return first ? first.toLocaleUpperCase("pt-BR") : "?";
}

const sizes: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[12px]",
};

export function Avatar({
  name,
  color,
  size = "md",
  className = "",
}: {
  name: string;
  color: string;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-color={color}
      style={{ "--avatar-color": color } as CSSProperties}
      className={["avatar inline-grid shrink-0 place-items-center rounded-full font-semibold", sizes[size], className].join(
        " ",
      )}
    >
      {initialOf(name)}
    </span>
  );
}
