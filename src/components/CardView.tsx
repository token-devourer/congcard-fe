import type { Card, Color } from "@kartu-satu/shared";
import { cardText } from "@/lib/rules";

interface CardViewProps {
  card?: Card;
  hidden?: boolean;
  small?: boolean;
  playable?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function CardView({ card, hidden, small, playable, disabled, onClick }: CardViewProps) {
  const className = [
    "card-face",
    small ? "small" : "",
    playable ? "playable" : "",
    card?.color ? `card-${card.color}` : "card-wild"
  ]
    .filter(Boolean)
    .join(" ");

  if (hidden || !card) {
    return (
      <div className={`${small ? "card-face small" : "card-face"} card-wild grid place-items-center`} aria-label="Hidden card">
        <div className="relative z-10 text-center text-xs font-black uppercase tracking-[0.18em] text-white">KS</div>
      </div>
    );
  }

  const content = (
    <>
      <div className="absolute left-2 top-2 z-10 text-sm font-black">{cardText(card)}</div>
      <div className="absolute bottom-2 right-2 z-10 rotate-180 text-sm font-black">{cardText(card)}</div>
      <div className="absolute inset-0 z-10 grid place-items-center">
        <div className="grid place-items-center gap-1 text-center">
          <ColorSymbol color={card.color} />
          <span className="text-xl font-black uppercase leading-none">{cardText(card)}</span>
        </div>
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} aria-label={`${card.color ?? "wild"} ${cardText(card)}`}>
        {content}
      </div>
    );
  }

  return (
    <button className={className} disabled={disabled} onClick={onClick} aria-label={`Play ${card.color ?? "wild"} ${cardText(card)}`}>
      {content}
    </button>
  );
}

function ColorSymbol({ color }: { color: Color | null }) {
  if (color === "red") {
    return (
      <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M25 4c7 8 13 15 13 25 0 9-6 15-14 15S10 38 10 29c0-7 4-12 9-18-1 6 1 9 5 11 3-5 3-10 1-18Z" />
      </svg>
    );
  }

  if (color === "blue") {
    return (
      <svg width="38" height="36" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M6 28c6-8 13-8 20-3 5 4 9 4 16-3-2 10-9 16-18 14-6-1-10-6-18-8Zm0 10c6-5 12-5 19-1 6 3 10 2 17-4-3 8-10 12-19 10-6-1-10-4-17-5Z" />
      </svg>
    );
  }

  if (color === "green") {
    return (
      <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M42 8C25 8 11 17 9 34c12 3 25-3 33-26ZM10 39c7-11 16-18 29-26-10 9-18 18-23 30l-6-4Z" />
      </svg>
    );
  }

  if (color === "yellow") {
    return (
      <svg width="34" height="36" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M28 3 9 28h14l-3 17 19-25H25l3-17Z" />
      </svg>
    );
  }

  return (
    <svg width="42" height="38" viewBox="0 0 52 48" aria-hidden="true">
      <path fill="#db4b3f" d="M26 4 6 16v16l20 12V4Z" />
      <path fill="#e7b83d" d="m26 4 20 12v16L26 44V4Z" />
      <path fill="#2f9b67" d="M6 16h40L26 44 6 16Z" opacity="0.9" />
      <path fill="#3d7edb" d="M6 32h40L26 4 6 32Z" opacity="0.85" />
    </svg>
  );
}
