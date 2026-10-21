import { useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Home } from "../routes/Home";
import { Room } from "../routes/Room";
import { MockRoomProvider } from "../data/mock/mock-provider";
import { RoomNotFoundError, createRoom, joinRoom } from "../data/firebase/room-provider";
import { newRoomCode } from "../lib/ids";
import { mockLink, RoomProviderFor, useMockRoom } from "./providers";

const CODE_PATTERN = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

function describeError(error: unknown, fallback: string): string {
  if (error instanceof RoomNotFoundError) return "Sala não encontrada. Confira o código e tente de novo.";
  // Rate limiter anti-DoS
  if (error instanceof Error && error.name === "QuotaExceededError") {
    return "Muitas salas criadas. Aguarde um momento e tente de novo.";
  }
  // Erros do SDK vêm com prefixo técnico; nesse caso vale a mensagem da tela.
  if (error instanceof Error && error.message && !error.message.startsWith("Firebase:")) return error.message;
  return fallback;
}

function HomeRoute() {
  const navigate = useNavigate();
  const mock = useMockRoom();
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleCreate(roomName: string, userName: string) {
    setCreateError(null);
    setJoinError(null);

    if (mock) {
      navigate(mockLink(`/r/${newRoomCode()}`, true));
      return;
    }

    try {
      navigate(`/r/${await createRoom(roomName, userName)}`);
    } catch (error) {
      setCreateError(describeError(error, "Não foi possível criar a sala agora. Tente de novo."));
    }
  }

  async function handleJoin(code: string, userName: string) {
    setCreateError(null);
    setJoinError(null);

    if (mock) {
      navigate(mockLink(`/r/${code}`, true));
      return;
    }

    try {
      await joinRoom(code, userName);
      navigate(`/r/${code}`);
    } catch (error) {
      setJoinError(describeError(error, "Não foi possível entrar na sala agora. Tente de novo."));
    }
  }

  return <Home onCreate={handleCreate} onJoin={handleJoin} createError={createError} joinError={joinError} />;
}

function RoomRoute() {
  const { code = "" } = useParams();
  const roomId = code.trim().toLowerCase();

  if (!CODE_PATTERN.test(roomId)) {
    return (
      <MockRoomProvider key="invalid-code" initial={{ status: "not-found" }}>
        <Room roomId={roomId} />
      </MockRoomProvider>
    );
  }

  return (
    <RoomProviderFor key={roomId} roomId={roomId}>
      <Room roomId={roomId} />
    </RoomProviderFor>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/r/:code" element={<RoomRoute />} />
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
