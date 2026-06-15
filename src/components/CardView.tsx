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

// The four play colors, used as gem accents on Wild cards.
const WILD_GEMS: Array<{ key: Color; fill: string }> = [
  { key: "red", fill: "#e64a3d" },
  { key: "yellow", fill: "#f0c63a" },
  { key: "green", fill: "#2faa6f" },
  { key: "blue", fill: "#3d7edb" }
];

export function CardView({ card, hidden, small, playable, dimmed, disabled, onClick }: CardViewProps) {
  if (hidden || !card) {
    return (
      <div className={`${small ? "card-face small" : "card-face"} card-back grid place-items-center`} aria-label="Hidden card">
        <div className="relative z-10 grid place-items-center">
          <div className={`grid place-items-center rounded-full border-2 border-[var(--gold)]/80 bg-black/30 ${small ? "h-8 w-8 text-[10px]" : "h-12 w-12 text-sm"} font-black uppercase tracking-[0.18em] text-[var(--gold)] shadow-[0_0_18px_rgba(242,193,78,0.35)]`}>
            CC
          </div>
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

  const isWild = !card.color;

  const content = (
    <>
      {/* Corner indices — small, elegant, with a tiny color pip underneath. */}
      <CornerIndex card={card} small={small} position="tl" />
      <CornerIndex card={card} small={small} position="br" />

      {/* Heraldic cartouche: vertical gold-framed plaque holding the symbol + value. */}
      <div className="absolute inset-0 z-[5] grid place-items-center">
        <div className={`cartouche ${small ? "cartouche-sm" : ""}`}>
          {isWild ? (
            <WildBadge small={small} />
          ) : (
            <div className="grid place-items-center gap-1 text-center">
              <ColorSymbol color={card.color} small={small} />
              <span
                className={`font-black uppercase leading-none ${small ? "text-sm" : "text-2xl"}`}
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.45), 0 0 10px rgba(0,0,0,0.35)" }}
              >
                {cardText(card)}
              </span>
            </div>
          )}
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

function CornerIndex({ card, small, position }: { card: Card; small?: boolean; position: "tl" | "br" }) {
  const place =
    position === "tl"
      ? "left-1.5 top-1 items-start"
      : "bottom-1 right-1.5 items-end rotate-180";
  return (
    <div className={`absolute z-10 flex flex-col gap-0.5 ${place}`}>
      <span
        className={`font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] ${small ? "text-[11px]" : "text-base"}`}
      >
        {cornerText(card)}
      </span>
    </div>
  );
}

// Corner indices use compact symbols so the rotated bottom-right copy stays legible.
function cornerText(card: Card): string {
  if (typeof card.value === "number") return String(card.value);
  const symbols: Record<string, string> = {
    skip: "Ø",
    reverse: "⇄",
    draw2: "+2",
    wild: "✦",
    wild4: "+4"
  };
  return symbols[String(card.value)] ?? cardText(card);
}

function WildBadge({ small }: { small?: boolean }) {
  const gemSize = small ? 6 : 9;
  return (
    <div className="grid place-items-center gap-1.5 text-center">
      {/* Four gems arranged in a diamond — the four colors, on their own onyx field. */}
      <div className={`relative ${small ? "h-7 w-7" : "h-11 w-11"}`}>
        {WILD_GEMS.map((gem, i) => {
          const angle = (i / WILD_GEMS.length) * 360 - 90;
          const r = small ? 12 : 18;
          const x = Math.cos((angle * Math.PI) / 180) * r;
          const y = Math.sin((angle * Math.PI) / 180) * r;
          return (
            <span
              key={gem.key}
              className="absolute left-1/2 top-1/2 block rounded-[2px] shadow-[0_0_6px_rgba(0,0,0,0.6)]"
              style={{
                width: gemSize,
                height: gemSize,
                background: `linear-gradient(135deg, ${gem.fill}, rgba(0,0,0,0.4))`,
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(45deg)`,
                border: "1px solid rgba(255,255,255,0.35)"
              }}
              aria-hidden="true"
            />
          );
        })}
        {/* Central gilded star */}
        <span
          className="absolute left-1/2 top-1/2 grid place-items-center"
          style={{ transform: "translate(-50%,-50%)" }}
        >
          <svg width={small ? 14 : 22} height={small ? 14 : 22} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id="cc-star" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffe39a" />
                <stop offset="1" stopColor="#b9801f" />
              </linearGradient>
            </defs>
            <path
              d="M12 1l3 7.5L23 9l-6 5.5L18.5 23 12 18.5 5.5 23 7 14.5 1 9l8-0.5z"
              fill="url(#cc-star)"
              stroke="#5a3608"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <span
        className={`font-black uppercase leading-none tracking-[0.08em] ${small ? "text-[10px]" : "text-sm"}`}
        style={{ color: "#ffe39a", textShadow: "0 1px 0 rgba(0,0,0,0.6)" }}
      >
        Wild
      </span>
    </div>
  );
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

  return null;
}
