export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
};

export function Switch({ checked, onChange, label, disabled = false, id }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex h-11 items-center gap-2.5 rounded-[8px] pr-1 text-left disabled:pointer-events-none disabled:opacity-45"
    >
      <span
        className={[
          "relative h-[20px] w-[34px] shrink-0 rounded-full border transition-colors duration-150 ease-out",
          checked ? "border-accent/60 bg-accent/85" : "border-line-strong bg-elevated",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full transition-transform duration-150 ease-out",
            checked ? "translate-x-[14px] bg-[#150f06]" : "bg-muted",
          ].join(" ")}
        />
      </span>
      <span className="text-[12px] font-medium text-muted group-hover:text-ink">{label}</span>
    </button>
  );
}
