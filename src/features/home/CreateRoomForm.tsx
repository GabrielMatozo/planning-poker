import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { readableMessage } from "../room/errors";

export type CreateRoomFormProps = {
  roomName: string;
  onRoomNameChange: (value: string) => void;
  error?: string | null;
  serverError?: string | null;
  pending?: boolean;
  onSubmit: () => void;
};

export function CreateRoomForm({
  roomName,
  onRoomNameChange,
  error,
  serverError,
  pending = false,
  onSubmit,
}: CreateRoomFormProps) {
  const message = readableMessage(serverError, "Não foi possível criar a sala agora. Tente de novo.");

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
        id="pp-nome-sala"
        label="Nome da sala"
        value={roomName}
        onChange={(event) => onRoomNameChange(event.target.value)}
        error={error ?? undefined}
        autoComplete="off"
        enterKeyHint="go"
      />
      {message ? (
        <p role="alert" className="text-[12px] leading-relaxed text-danger-text">
          {message}
        </p>
      ) : null}
      <Button type="submit" fullWidth loading={pending}>
        Criar sala
      </Button>
    </form>
  );
}
