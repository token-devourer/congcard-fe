import type { Card, Color } from "@congcard/shared";
import { cardText } from "@/lib/rules";

interface CardViewProps {
  card?: Card;
  hidden?: boolean;
  small?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function CardView({ card, hidden, small, playable, dimmed, disabled, onClick }: CardViewProps) {
  if (hidden || !card) {
    return (
      <div className={`${small ? "card-face small" : "card-face"} card-back grid place-items-center`} aria-label="Hidden card">
        <div className="relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--gold)]/70 text-center text-xs font-black uppercase tracking-[0.14em] text-[var(--gold)]">
          CC
        </div>
      </div>
    );
  }

  const className = [
    "card-face",
    small ? "small" : "",
    playable ? "playable" : "",
    dimmed ? "dimmed" : "",
    card.color ? `card-${card.color}` : "card-wild"
  ]
    .filter(Boolean)
    .join(" ");

  const isYellow = card.color === "yellow";
  const isWild = !card.color;
  const ovalFill = isWild ? "rgba(8,12,10,0.85)" : isYellow ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.12)";

  const content = (
    <>
      <div className={`absolute left-1.5 top-1 z-10 font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${small ? "text-xs" : "text-base"}`}>{cornerText(card)}</div>
      <div className={`absolute bottom-1 right-1.5 z-10 rotate-180 font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${small ? "text-xs" : "text-base"}`}>{cornerText(card)}</div>
      <div className="absolute inset-0 z-[5] grid place-items-center">
        <div
          className={`grid place-items-center ${small ? "h-[68%] w-[78%]" : "h-[64%] w-[74%]"}`}
          style={{
            background: ovalFill,
            borderRadius: "50%",
            transform: "rotate(-22deg)",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35), inset 0 -1px 2px rgba(255,255,255,0.18)"
          }}
        >
          <div className="grid place-items-center gap-1 text-center" style={{ transform: "rotate(22deg)" }}>
            <ColorSymbol color={card.color} small={small} />
            <span
              className={`font-black uppercase leading-none ${small ? "text-sm" : "text-2xl"}`}
              style={{ textShadow: "0 2px 0 rgba(0,0,0,0.35), 0 0 8px rgba(0,0,0,0.25)" }}
            >
              {cardText(card)}
            </span>
          </div>
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

// Corner indices use compact symbols so the rotated bottom-right copy stays
// legible (full words like "Skip" turn into gibberish upside down).
function cornerText(card: Card): string {
  if (typeof card.value === "number") {
    return String(card.value);
  }

  const symbols: Record<string, string> = {
    skip: "Ø",
    reverse: "⇄",
    draw2: "+2",
    wild: "★",
    wild4: "+4"
  };

  return symbols[String(card.value)] ?? cardText(card);
}

function ColorSymbol({ color, small }: { color: Color | null; small?: boolean }) {
  const size = small ? 22 : 36;

  if (color === "red") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M25 4c7 8 13 15 13 25 0 9-6 15-14 15S10 38 10 29c0-7 4-12 9-18-1 6 1 9 5 11 3-5 3-10 1-18Z" />
      </svg>
    );
  }

  if (color === "blue") {
    return (
      <svg width={size + 2} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M6 28c6-8 13-8 20-3 5 4 9 4 16-3-2 10-9 16-18 14-6-1-10-6-18-8Zm0 10c6-5 12-5 19-1 6 3 10 2 17-4-3 8-10 12-19 10-6-1-10-4-17-5Z" />
      </svg>
    );
  }

  if (color === "green") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M42 8C25 8 11 17 9 34c12 3 25-3 33-26ZM10 39c7-11 16-18 29-26-10 9-18 18-23 30l-6-4Z" />
      </svg>
    );
  }

  if (color === "yellow") {
    return (
      <svg width={size - 2} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M28 3 9 28h14l-3 17 19-25H25l3-17Z" />
      </svg>
    );
  }

  return (
    <svg width={size + 6} height={size + 2} viewBox="0 0 52 48" aria-hidden="true">
      <path fill="#db4b3f" d="M26 4 6 16v16l20 12V4Z" />
      <path fill="#e7b83d" d="m26 4 20 12v16L26 44V4Z" />
      <path fill="#2f9b67" d="M6 16h40L26 44 6 16Z" opacity="0.9" />
      <path fill="#3d7edb" d="M6 32h40L26 4 6 32Z" opacity="0.85" />
    </svg>
  );
}
