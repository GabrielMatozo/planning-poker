import { useEffect, useState } from "react";
import { Brand } from "../../ui/Brand";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Panel } from "../../ui/Panel";
import { limitField, limitName, validateName } from "./validation";
import { loadStoredName, storeName } from "./name-storage";
import { COOLDOWN_MS, getKickRecord, type KickRecord } from "../../lib/kicks";

function formatDuration(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return remain > 0 ? `${minutes} minuto${minutes > 1 ? "s" : ""} e ${remain}s` : `${minutes} minuto${minutes > 1 ? "s" : ""}`;
}

export function KickScreen({ onTryAgain }: { onTryAgain: (newName: string) => void }) {
  const [name, setName] = useState(() => limitField(loadStoredName()));
  const [error, setError] = useState<string | null>(null);
  // Tenta recuperar o registro de kick do nome atual, senão busca qualquer um
  const [record, setRecord] = useState<KickRecord | null>(() => {
    const r = getKickRecord(name);
    if (r) return r;
    // Se não achou pelo nome, pega o mais recente qualquer que seja
    try {
      const raw = localStorage.getItem("pp:kicks");
      if (!raw) return null;
      const kicks = JSON.parse(raw) as KickRecord[];
      return Array.isArray(kicks) && kicks.length > 0 ? kicks[kicks.length - 1]! : null;
    } catch {
      return null;
    }
  });
  const [remaining, setRemaining] = useState(() => {
    const r = getKickRecord(name);
    return r ? Math.max(0, COOLDOWN_MS - (Date.now() - r.kickedAt)) : 0;
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const tick = () => {
      const r = getKickRecord(name);
      if (!r) {
        setRemaining(0);
        return;
      }
      const left = Math.max(0, COOLDOWN_MS - (Date.now() - r.kickedAt));
      setRemaining(left);
      if (left > 0) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [name, remaining]);

  useEffect(() => {
    // Tenta pelo nome atual, senão pega qualquer registro ativo
    const r = getKickRecord(name);
    if (r) {
      setRecord(r);
      return;
    }
    try {
      const raw = localStorage.getItem("pp:kicks");
      if (!raw) {
        setRecord(null);
        return;
      }
      const kicks = JSON.parse(raw) as KickRecord[];
      setRecord(Array.isArray(kicks) && kicks.length > 0 ? kicks[kicks.length - 1]! : null);
    } catch {
      setRecord(null);
    }
  }, [name]);

  function handleSubmit() {
    const problem = validateName(name);
    setError(problem);
    if (problem) return;
    const finalName = limitName(name);
    storeName(finalName);
    onTryAgain(finalName);
  }

  const canEnter = remaining === 0;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-9 px-5 py-8 sm:px-8 sm:py-12 lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_408px] lg:content-center lg:gap-y-0 lg:gap-x-20 lg:py-20">
        <div className="order-1 flex flex-col gap-7 lg:col-start-1 lg:row-start-1">
          <Brand />
          <div className="flex max-w-[540px] flex-col gap-4">
            <h1 className="text-[34px] leading-[1.06] font-semibold tracking-[-0.038em] text-balance sm:text-[46px] lg:text-[54px]">
              Você foi expulso.
            </h1>
            <p className="max-w-[46ch] text-[15px] leading-[1.65] text-muted">
              O host da sala{" "}
              <bdi dir="auto" className="font-medium text-ink">
                {record?.roomName ?? "uma sala"}
              </bdi>{" "}
              decidiu que você não pode mais participar. Aguarde o tempo limite ou mude de nome para tentar entrar em outra sala.
            </p>
          </div>
        </div>

        <div className="order-2 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center">
          <Panel bodyClassName="p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="micro">tempo restante</span>
                <p className="num text-[32px] leading-none text-ink">
                  {canEnter ? (
                    <span className="text-ok">liberado</span>
                  ) : (
                    formatDuration(remaining)
                  )}
                </p>
                {record ? (
                  <p className="text-[12px] text-faint">
                    Expulso em{" "}
                    <time dateTime={new Date(record.kickedAt).toISOString()}>
                      {new Date(record.kickedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {record.roomId ? ` · sala ${record.roomId}` : ""}
                  </p>
                ) : null}
              </div>

              <Input
                id="pp-kick-nome"
                label="Seu nome"
                value={name}
                onChange={(e) => setName(limitField(e.target.value))}
                onBlur={() => setError(validateName(name))}
                error={error ?? undefined}
                hint="Trocar de nome permite entrar em outras salas imediatamente."
                autoComplete="name"
                enterKeyHint="go"
              />

              <Button
                fullWidth
                onClick={handleSubmit}
                disabled={!canEnter && record !== null}
                variant={canEnter ? "primary" : "ghost"}
              >
                {canEnter ? "Entrar com este nome" : "Trocar de nome e tentar"}
              </Button>

              <Button variant="ghost" fullWidth onClick={() => (window.location.href = "/")}>
                Voltar ao início
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
