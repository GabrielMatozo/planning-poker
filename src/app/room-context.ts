import { createContext, useContext } from "react";
import type { RoomContextValue } from "../types/room";

export const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoom precisa ser usado dentro de um provider de sala");
  return value;
}
