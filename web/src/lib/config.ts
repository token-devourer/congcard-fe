function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const API_BASE_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:2567");
export const GAME_SERVER_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567");
