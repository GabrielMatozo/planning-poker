import { CrownIcon } from "../../ui/icons";
import { Button } from "../../ui/Button";
import { Switch } from "../../ui/Switch";
import { displayName } from "./names";

export type HostControlsProps = {
  isHost: boolean;
  revealed: boolean;
  autoReveal: boolean;
  hostName: string | null;
  hostTag?: number | null;
  onReveal: () => void;
  onNewRound: () => void;
  onToggleAutoReveal: (next: boolean) => void;
};

export function HostControls({
  isHost,
  revealed,
  autoReveal,
  hostName,
  hostTag = null,
  onReveal,
  onNewRound,
  onToggleAutoReveal,
}: HostControlsProps) {
  if (!isHost) {
    const label = hostName ? displayName(hostName) : "O host";

    return (
      <div className="flex min-h-11 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-elevated text-faint">
          <CrownIcon size={12} />
        </span>
        <p
          className="min-w-0 truncate text-[12px] text-muted"
          title={`${label}${hostTag ? ` · pessoa ${hostTag}` : ""} conduz a sala`}
        >
          <bdi dir="auto" className="text-ink">
            {label}
          </bdi>
          {hostTag ? (
            <span className="num text-[10px] text-faint" aria-hidden="true">
              {" "}
              #{hostTag}
            </span>
          ) : null}
          {revealed ? " abre a próxima rodada." : " conduz o reveal."}
          {autoReveal ? " Revela sozinho quando todos votarem." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1">
      {revealed ? null : (
        <Switch checked={autoReveal} onChange={onToggleAutoReveal} label="Revelar quando todos votarem" />
      )}

      <div className="ml-auto flex items-center gap-2">
        {revealed ? (
          <Button onClick={onNewRound} className="min-w-[132px]">
            Nova rodada
          </Button>
        ) : (
          <Button onClick={onReveal} className="min-w-[104px]">
            Revelar cartas
          </Button>
        )}
      </div>
    </div>
  );
}
