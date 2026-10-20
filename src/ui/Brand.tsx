export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-accent">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="1.2" y="5.2" width="9" height="12.6" rx="2" stroke="currentColor" strokeOpacity="0.34" />
          <rect x="4.9" y="3.1" width="9" height="12.6" rx="2" stroke="currentColor" strokeOpacity="0.62" />
          <rect x="8.6" y="1" width="9.2" height="12.6" rx="2" stroke="currentColor" />
        </svg>
      </span>
      {compact ? null : (
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Planning Poker</span>
      )}
    </span>
  );
}
