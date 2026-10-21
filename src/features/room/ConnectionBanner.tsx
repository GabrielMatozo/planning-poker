import type { ReactNode } from "react";
import type { RoomState } from "../../types/room";
import { AlertIcon, WifiOffIcon } from "../../ui/icons";
import { Spinner } from "../../ui/Spinner";

export type ConnectionBannerProps = {
  status: RoomState["status"] | "offline";
  notice?: string | null;
  onDismissNotice?: () => void;
  onReload?: () => void;
};

export function ConnectionBanner({ status, notice, onDismissNotice, onReload }: ConnectionBannerProps) {
  let tone: "neutral" | "danger" | "accent" = "neutral";
  let icon: ReactNode = <Spinner size={12} label="Conectando" />;
  let message = "Conectando à sala";
  let action: ReactNode = null;

  if (status === "offline") {
    tone = "danger";
    icon = <WifiOffIcon size={13} />;
    message = "Sem conexão. Tentando reconectar.";
  } else if (status === "error") {
    tone = "danger";
    icon = <AlertIcon size={13} />;
    message = "A conexão com a sala caiu.";
    action = onReload ? (
      <button
        type="button"
        onClick={onReload}
        className="text-[11px] text-danger-text underline underline-offset-2 hover:text-ink"
      >
        Recarregar
      </button>
    ) : null;
  } else if (status === "connecting") {
    tone = "neutral";
    icon = <Spinner size={12} label="Conectando" />;
    message = "Conectando à sala";
  } else if (notice) {
    tone = "accent";
    icon = null;
    message = notice;
  } else {
    return null;
  }

  const tones = {
    neutral: "border-line bg-surface text-muted",
    danger: "border-danger/30 bg-danger/10 text-danger-text",
    accent: "border-accent/30 bg-canvas text-ink",
  };

  return (
    <div
      role="status"
      className={[
        "flex min-h-8 w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b px-4 py-1.5 text-[12px]",
        tones[tone],
      ].join(" ")}
    >
      {icon}
      <span className="min-w-0 text-center">{message}</span>
      {action}
      {tone === "accent" && onDismissNotice ? (
        <button
          type="button"
          onClick={onDismissNotice}
          className="text-[11px] text-accent/80 underline underline-offset-2 hover:text-accent"
        >
          Fechar aviso
        </button>
      ) : null}
    </div>
  );
}
