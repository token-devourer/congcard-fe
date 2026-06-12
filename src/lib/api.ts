import { API_BASE_URL } from "./config";

export interface RoomLookup {
  code: string;
  roomId: string;
}

export async function createRoom(): Promise<RoomLookup> {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error("Room could not be created.");
  }

  return response.json() as Promise<RoomLookup>;
}

export async function resolveRoom(code: string): Promise<RoomLookup> {
  const response = await fetch(`${API_BASE_URL}/rooms/${code.toUpperCase()}`);

  if (!response.ok) {
    throw new Error("Room was not found.");
  }

  return response.json() as Promise<RoomLookup>;
}
