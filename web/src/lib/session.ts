export function reconnectStorageKey(code: string): string {
  return `congcard:reconnect:${code}`;
}

export function resumeStorageKey(code: string): string {
  return `congcard:resume:${code}`;
}

export function roomSessionKeys(code: string): string[] {
  return [reconnectStorageKey(code), resumeStorageKey(code)];
}

export function clearRoomSession(storage: Pick<Storage, "removeItem">, code: string): void {
  for (const key of roomSessionKeys(code)) {
    storage.removeItem(key);
  }
}
