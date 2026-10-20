import { useId } from "react";
import type { InputHTMLAttributes, Ref } from "react";

export type InputProps = {
  label: string;
  error?: string;
  hint?: string;
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, error, hint, mono = false, id, className = "", ref, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-erro`;
  const hintId = `${inputId}-dica`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="cursor-pointer text-[12px] font-medium text-muted">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          "h-11 w-full rounded-control border bg-elevated px-3 text-[14px] text-ink",
          "transition-colors duration-150 ease-out",
          "placeholder:text-faint/80",
          "hover:border-line-strong focus:border-accent/70",
          error ? "border-danger/70" : "border-line",
          mono ? "num tracking-[0.18em]" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-[12px] leading-relaxed text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[12px] leading-relaxed text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
