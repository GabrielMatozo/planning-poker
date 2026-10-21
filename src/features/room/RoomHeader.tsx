import { useState } from "react";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Brand } from "../../ui/Brand";
import { CheckIcon, CopyIcon } from "../../ui/icons";
import { Dot } from "../../ui/Dot";
import { displayName } from "./names";

export type RoomIdentity = {
  name: string;
  color: string;
  tag: number | null;
  isHost: boolean;
};

export type RoomHeaderProps = {
  name: string;
  code: string;
  onlineCount: number;
  totalCount: number;
  revealed: boolean;
  round: number;
  identity?: RoomIdentity | null;
};

export function RoomHeader({
  name,
  code,
  onlineCount,
  totalCount,
  revealed,
  round,
  identity = null,
}: RoomHeaderProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  async function copyCode() {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
    }
  }

  async function copyLink() {
    const link = `${window.location.origin}/r/${code}`;
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      setCopiedLink(false);
    }
  }

  const me = identity ? displayName(identity.name) : "";
  const meLabel = identity
    ? `Você é ${me}${identity.tag ? `, pessoa ${identity.tag}` : ""}${identity.isHost ? ", host" : ""}`
    : "";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-[6px]">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <Brand compact />

        <div className="min-w-0 flex-1 border-l border-line pl-3">
          <h1
            dir="auto"
            className="truncate text-left text-[14px] leading-tight font-medium tracking-[-0.01em] sm:text-[15px]"
            title={displayName(name)}
          >
            {displayName(name)}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
            <span className="num whitespace-nowrap">rodada {round}</span>
            <span aria-hidden="true" className="text-line-strong">
              /
            </span>
            <span className="whitespace-nowrap">{revealed ? "revelada" : "em votação"}</span>
          </p>
        </div>

        {identity ? (
          <span className="flex shrink-0 items-center gap-1.5" title={meLabel}>
            <Avatar name={identity.name} color={identity.color} size="sm" />
            <span
              dir="auto"
              className="hidden max-w-[7.5rem] truncate text-left text-[12px] text-muted sm:inline"
            >
              {me}
            </span>
            {identity.tag ? (
              <>
                <span className="num hidden text-[9px] leading-none text-faint sm:inline" aria-hidden="true">
                  #{identity.tag}
                </span>
                <span className="sr-only">pessoa {identity.tag}</span>
              </>
            ) : null}
            <Badge size="xs" tone="ink">
              você
            </Badge>
            {identity.isHost ? (
              <span className="hidden sm:inline-flex">
                <Badge size="xs" tone="accent">
                  host
                </Badge>
              </span>
            ) : null}
          </span>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-line bg-surface px-2"
            title={`${onlineCount} de ${totalCount} pessoas online`}
          >
            <Dot state={onlineCount > 0 ? "online" : "offline"} label={`${onlineCount} de ${totalCount} online`} />
            <span className="num text-[11px] text-muted" aria-hidden="true">
              {onlineCount}
            </span>
          </span>

          <button
            type="button"
            onClick={copyCode}
            aria-label={copiedCode ? "Código copiado" : `Copiar código da sala ${code}`}
            className={[
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-2 transition-colors duration-150",
              copiedCode ? "border-ok/45 bg-ok/10" : "border-line bg-surface hover:border-line-strong hover:bg-elevated",
            ].join(" ")}
          >
            <span className={["micro hidden text-[9px] sm:inline", copiedCode ? "text-ok-text" : ""].join(" ")}>
              {copiedCode ? "copiado" : "código"}
            </span>
            <span className="num text-[12px] tracking-[0.14em] text-ink">{code}</span>
            <span className={copiedCode ? "text-ok-text" : "text-faint"}>
              {copiedCode ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            </span>
          </button>
          <button
            type="button"
            onClick={copyLink}
            aria-label={copiedLink ? "Link copiado" : `Copiar link da sala ${code}`}
            className={[
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-2 transition-colors duration-150",
              copiedLink ? "border-ok/45 bg-ok/10" : "border-line bg-surface hover:border-line-strong hover:bg-elevated",
            ].join(" ")}
          >
            <span className={["micro hidden text-[9px] sm:inline", copiedLink ? "text-ok-text" : ""].join(" ")}>
              {copiedLink ? "copiado" : "link"}
            </span>
            <span className={copiedLink ? "text-ok-text" : "text-faint"}>
              {copiedLink ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            </span>
          </button>
          <span role="status" className="sr-only">
            {copiedCode ? "Código copiado" : copiedLink ? "Link copiado" : ""}
          </span>
        </div>
      </div>
    </header>
  );
}
