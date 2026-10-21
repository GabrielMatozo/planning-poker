import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { readableMessage } from "../room/errors";

export type JoinRoomFormProps = {
  code: string;
  onCodeChange: (value: string) => void;
  error?: string | null;
  serverError?: string | null;
  pending?: boolean;
  onSubmit: () => void;
};

export function JoinRoomForm({ code, onCodeChange, error, serverError, pending = false, onSubmit }: JoinRoomFormProps) {
  const message = readableMessage(serverError, "Não foi possível entrar na sala agora. Tente de novo.");

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <Input
        id="pp-codigo"
        label="Código da sala"
        mono
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        error={error ?? undefined}
        hint="Seis caracteres do link que você recebeu."
        maxLength={6}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
      {message ? (
        <p role="alert" className="text-[12px] leading-relaxed text-danger-text">
          {message}
        </p>
      ) : null}
      <Button type="submit" variant="ghost" fullWidth loading={pending}>
        Entrar na sala
      </Button>
    </form>
  );
}
