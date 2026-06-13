import { normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, roomCodeSchema } from "@congcard/shared";

const INVALID_ROOM_CODE_CHARS = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, "g");

export function formatRoomCodeInput(value: string): string {
  return normalizeRoomCode(value).replace(INVALID_ROOM_CODE_CHARS, "").slice(0, ROOM_CODE_LENGTH);
}

export function parseRoomCode(value: string): string | null {
  const parsed = roomCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
