import type { Card, CardValue, Color } from "@congcard/shared";
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

const WILD_GEMS: Array<{ key: Color; fill: string }> = [
  { key: "red", fill: "#ff4f5e" },
  { key: "yellow", fill: "#ffd84d" },
  { key: "green", fill: "#36e18e" },
  { key: "blue", fill: "#58a6ff" }
];

export function CardView({ card, hidden, small, playable, dimmed, disabled, onClick }: CardViewProps) {
  if (hidden || !card) {
    return (
      <div className={`${small ? "card-face small" : "card-face"} card-back grid place-items-center`} aria-label="Hidden card">
        <div className="relative z-10 grid place-items-center">
          <div className="card-back-mark">
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
      <CornerIndex card={card} small={small} position="tl" />
      <CornerIndex card={card} small={small} position="br" />

      <div className="absolute inset-0 z-[5] grid place-items-center">
        <div className={`cartouche ${small ? "cartouche-sm" : ""}`}>
          {isWild ? (
            <WildBadge small={small} value={card.value} />
          ) : card.value === "draw2" ? (
            <DrawActionGlyph small={small} />
          ) : isActionValue(card.value) ? (
            <ActionGlyph value={card.value} small={small} />
          ) : (
            <div className="grid place-items-center gap-1 text-center">
              <ColorSymbol color={card.color} />
              <span
                className="card-center-number font-black uppercase leading-none"
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
      ? "card-corner-tl items-start"
      : "card-corner-br items-end rotate-180";
  const amount = drawAmount(card.value);
  return (
    <div className={`card-corner absolute z-10 flex flex-col gap-0.5 ${place}`}>
      {amount ? (
        <DrawAmountLabel amount={amount} small={small} corner />
      ) : isActionValue(card.value) ? (
        <ActionGlyph value={card.value} small corner />
      ) : (
        <span
          className="card-corner-number font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        >
          {String(card.value)}
        </span>
      )}
    </div>
  );
}

function isActionValue(value: CardValue): value is Extract<CardValue, string> {
  return typeof value === "string";
}

function drawAmount(value: CardValue): "+2" | "+4" | null {
  if (value === "draw2") return "+2";
  if (value === "wild4") return "+4";
  return null;
}

function WildBadge({ small, value }: { small?: boolean; value: CardValue }) {
  return (
    <div className="grid place-items-center gap-1 text-center">
      <svg className="card-wild-badge" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="cc-star" x1="0" y1="5" x2="0" y2="59" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff4ba" />
            <stop offset="0.52" stopColor="#ffd257" />
            <stop offset="1" stopColor="#f69c25" />
          </linearGradient>
        </defs>
        {WILD_GEMS.map((gem, index) => {
          const points = [
            [32, 6],
            [58, 32],
            [32, 58],
            [6, 32]
          ] as const;
          const [x, y] = points[index]!;
          return (
            <rect
              key={gem.key}
              x={x - 5}
              y={y - 5}
              width="10"
              height="10"
              rx="2"
              fill={gem.fill}
              stroke="rgba(255,255,255,0.68)"
              strokeWidth="1"
              transform={`rotate(45 ${x} ${y})`}
            />
          );
        })}
        <path
          d="M32 8 38.8 24.6 56 25.8 42.7 37.4 46.6 55 32 45.6 17.4 55 21.3 37.4 8 25.8 25.2 24.6Z"
          fill="url(#cc-star)"
          stroke="#5a3608"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {value === "wild4" ? <DrawAmountLabel amount="+4" small={small} /> : null}
    </div>
  );
}

function DrawAmountLabel({ amount, small, corner }: { amount: "+2" | "+4"; small?: boolean; corner?: boolean }) {
  return (
    <span
      className={[
        "card-draw-label font-black leading-none text-current drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]",
        corner ? "corner" : ""
      ].join(" ")}
    >
      {amount}
    </span>
  );
}

function DrawActionGlyph({ small }: { small?: boolean }) {
  return (
    <div className="card-draw-glyph relative w-full text-center">
      <span className="absolute left-1/2 top-0 -translate-x-1/2">
        <ActionGlyph value="draw2" small={small} />
      </span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <DrawAmountLabel amount="+2" small={small} />
      </span>
    </div>
  );
}

function ActionGlyph({ value, small, corner }: { value: Extract<CardValue, string>; small?: boolean; corner?: boolean }) {
  const stroke = corner ? 3.2 : 2.4;
  const className = `card-action-glyph ${corner ? "corner" : ""} drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]`;

  if (value === "skip") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
        <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth={stroke + 3} />
        <path d="M14 34 34 14" fill="none" stroke="currentColor" strokeWidth={stroke + 4} strokeLinecap="round" />
      </svg>
    );
  }

  if (value === "reverse") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
        <path d="M15 18h15c5 0 8 3 8 8s-3 8-8 8h-2" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" />
        <path d="m18 10-8 8 8 8" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33 30H18c-5 0-8-3-8-8s3-8 8-8h2" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" />
        <path d="m30 38 8-8-8-8" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (value === "draw2") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
        <rect x="11" y="12" width="18" height="25" rx="4" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} transform="rotate(-8 20 24.5)" />
        <rect x="19" y="9" width="18" height="25" rx="4" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} transform="rotate(8 28 21.5)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path d="M24 4 29 18 44 19 32 28 36 43 24 34 12 43 16 28 4 19 19 18Z" fill="currentColor" />
    </svg>
  );
}

function ColorSymbol({ color }: { color: Color | null }) {
  if (color === "red") {
    return (
      <svg className="card-color-symbol" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M25 4c7 8 13 15 13 25 0 9-6 15-14 15S10 38 10 29c0-7 4-12 9-18-1 6 1 9 5 11 3-5 3-10 1-18Z" />
      </svg>
    );
  }

  if (color === "blue") {
    return (
      <svg className="card-color-symbol wide" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M6 28c6-8 13-8 20-3 5 4 9 4 16-3-2 10-9 16-18 14-6-1-10-6-18-8Zm0 10c6-5 12-5 19-1 6 3 10 2 17-4-3 8-10 12-19 10-6-1-10-4-17-5Z" />
      </svg>
    );
  }

  if (color === "green") {
    return (
      <svg className="card-color-symbol" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M42 8C25 8 11 17 9 34c12 3 25-3 33-26ZM10 39c7-11 16-18 29-26-10 9-18 18-23 30l-6-4Z" />
      </svg>
    );
  }

  if (color === "yellow") {
    return (
      <svg className="card-color-symbol narrow" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M28 3 9 28h14l-3 17 19-25H25l3-17Z" />
      </svg>
    );
  }

  return null;
}
