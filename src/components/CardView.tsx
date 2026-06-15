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
  const amount = drawAmount(card.value);
  return (
    <div className={`absolute z-10 flex flex-col gap-0.5 ${place}`}>
      {amount ? (
        <DrawAmountLabel amount={amount} small={small} corner />
      ) : isActionValue(card.value) ? (
        <ActionGlyph value={card.value} small corner />
      ) : (
        <span
          className={`font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] ${small ? "text-[11px]" : "text-base"}`}
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
  const gemSize = small ? 7 : 10;
  return (
    <div className="grid place-items-center gap-1 text-center">
      <div className={`relative ${small ? "h-8 w-8" : "h-13 w-13"}`}>
        {WILD_GEMS.map((gem, index) => {
          const angle = (index / WILD_GEMS.length) * 360 - 90;
          const radius = small ? 12 : 18;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;
          return (
            <span
              key={gem.key}
              className="absolute left-1/2 top-1/2 block rounded-[2px] shadow-[0_0_8px_rgba(0,0,0,0.55)]"
              style={{
                width: gemSize,
                height: gemSize,
                background: `radial-gradient(circle at 28% 22%, #ffe8a3, ${gem.fill} 34%, rgba(0,0,0,0.28))`,
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(45deg)`,
                border: "1px solid rgba(255,255,255,0.62)"
              }}
              aria-hidden="true"
            />
          );
        })}
        <span
          className="absolute left-1/2 top-1/2 grid place-items-center"
          style={{ transform: "translate(-50%,-50%)" }}
        >
          <svg width={small ? 16 : 24} height={small ? 16 : 24} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id="cc-star" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff4ba" />
                <stop offset="0.52" stopColor="#ffd257" />
                <stop offset="1" stopColor="#f69c25" />
              </linearGradient>
            </defs>
            <path
              d="M12 1l3 7.5L23 9l-6 5.5L18.5 23 12 18.5 5.5 23 7 14.5 1 9l8-0.5z"
              fill="url(#cc-star)"
              stroke="#5a3608"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      {value === "wild4" ? <DrawAmountLabel amount="+4" small={small} /> : null}
    </div>
  );
}

function DrawAmountLabel({ amount, small, corner }: { amount: "+2" | "+4"; small?: boolean; corner?: boolean }) {
  return (
    <span
      className={[
        "font-black leading-none text-current drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]",
        corner ? (small ? "text-[10px]" : "text-[13px]") : small ? "text-sm" : "text-xl"
      ].join(" ")}
    >
      {amount}
    </span>
  );
}

function DrawActionGlyph({ small }: { small?: boolean }) {
  return (
    <div className="grid place-items-center gap-0.5 text-center">
      <ActionGlyph value="draw2" small={small} />
      <DrawAmountLabel amount="+2" small={small} />
    </div>
  );
}

function ActionGlyph({ value, small, corner }: { value: Extract<CardValue, string>; small?: boolean; corner?: boolean }) {
  const size = corner ? (small ? 10 : 14) : small ? 24 : 40;
  const stroke = corner ? 3.2 : 2.4;

  if (value === "skip") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]">
        <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth={stroke + 3} />
        <path d="M14 34 34 14" fill="none" stroke="currentColor" strokeWidth={stroke + 4} strokeLinecap="round" />
      </svg>
    );
  }

  if (value === "reverse") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]">
        <path d="M15 18h15c5 0 8 3 8 8s-3 8-8 8h-2" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" />
        <path d="m18 10-8 8 8 8" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M33 30H18c-5 0-8-3-8-8s3-8 8-8h2" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" />
        <path d="m30 38 8-8-8-8" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (value === "draw2") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]">
        <rect x="11" y="12" width="18" height="25" rx="4" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} transform="rotate(-8 20 24.5)" />
        <rect x="19" y="9" width="18" height="25" rx="4" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} transform="rotate(8 28 21.5)" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]">
      <path d="M24 4 29 18 44 19 32 28 36 43 24 34 12 43 16 28 4 19 19 18Z" fill="currentColor" />
    </svg>
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
