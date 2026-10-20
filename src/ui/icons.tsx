type IconProps = { size?: number; className?: string };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
}

export function CopyIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
      <path d="M10.5 5.5V3.6A1.1 1.1 0 0 0 9.4 2.5H3.6A1.1 1.1 0 0 0 2.5 3.6v5.8a1.1 1.1 0 0 0 1.1 1.1h1.9" />
    </svg>
  );
}

export function CheckIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 8.4 6.2 11.6 13 4.4" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 6.25 8 10.25 12 6.25" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 9.75 8 5.75 12 9.75" />
    </svg>
  );
}

export function LockIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3.2" y="7" width="9.6" height="6.4" rx="1.4" />
      <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" />
    </svg>
  );
}

export function AlertIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 2.8 14 13H2L8 2.8Z" />
      <path d="M8 6.6v3.1M8 11.4v.1" />
    </svg>
  );
}

export function UsersIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="6" cy="5.6" r="2.1" />
      <path d="M2.4 13c0-2 1.6-3.4 3.6-3.4S9.6 11 9.6 13" />
      <path d="M10.6 4.1a2 2 0 0 1 0 3.5M11.6 13c0-1.4-.5-2.5-1.3-3.2 2 .1 3.3 1.4 3.3 3.2" />
    </svg>
  );
}

export function WifiOffIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.4 6.2A12 12 0 0 1 6 4.3M10 4.3a12 12 0 0 1 3.6 1.9M4.6 9a8.6 8.6 0 0 1 2-1.1M9.4 7.9a8.6 8.6 0 0 1 2 1.1" />
      <circle cx="8" cy="12" r=".9" fill="currentColor" stroke="none" />
      <path d="M2 2l12 12" />
    </svg>
  );
}

export function RefreshIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13.2 2.6v2.8h-2.8" />
    </svg>
  );
}

export function SearchIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="7" cy="7" r="4.2" />
      <path d="M10.2 10.2 13.5 13.5" />
    </svg>
  );
}

export function CrownIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 11.5 5.5 7 8 9.5 10.5 7 13 11.5" />
      <rect x="2.5" y="11.5" width="11" height="2.2" rx="0.8" />
      <circle cx="5.5" cy="5.2" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="5.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TrashIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M2.5 3.5h11" />
      <path d="M5.5 3.5V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8v.7" />
      <path d="M4 3.5v8.7a.8.8 0 0 0 .8.8h4.4a.8.8 0 0 0 .8-.8V3.5" />
    </svg>
  );
}
