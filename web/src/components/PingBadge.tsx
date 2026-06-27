"use client";

const PING_COLOR = (ping: number) =>
  ping < 100 ? "text-green-300" :
  ping < 200 ? "text-yellow-300" :
               "text-red-300";

export function PingBadge({ ping }: { ping: number }) {
  return (
    <span className={`ml-1 text-[10px] font-bold tabular-nums ${PING_COLOR(ping)}`}>
      {ping}ms
    </span>
  );
}
