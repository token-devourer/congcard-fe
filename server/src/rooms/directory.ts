const codeToRoomId = new Map<string, string>();
const roomIdToCode = new Map<string, string>();

export function registerRoomCode(code: string, roomId: string): void {
  codeToRoomId.set(code, roomId);
  roomIdToCode.set(roomId, code);
}

export function unregisterRoom(roomId: string): void {
  const code = roomIdToCode.get(roomId);
  if (!code) {
    return;
  }

  roomIdToCode.delete(roomId);
  codeToRoomId.delete(code);
}

export function resolveRoomCode(code: string): string | undefined {
  return codeToRoomId.get(code.toUpperCase());
}

export function activeRoomCount(): number {
  return codeToRoomId.size;
}

export function hasRoomCode(code: string): boolean {
  return codeToRoomId.has(code.toUpperCase());
}
