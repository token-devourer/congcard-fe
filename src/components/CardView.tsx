import type { Card, CardValue, Color, FlipSide, VisibleCardFace } from "@congcard/shared";
import { cardText } from "@/lib/rules";

interface CardViewProps {
  card?: Card | VisibleCardFace;
  hidden?: boolean;
  small?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

type DisplayCard = Pick<Card, "color" | "value"> & { side?: FlipSide };

const WILD_GEMS: Array<{ key: Color; fill: string }> = [
  { key: "red", fill: "#ff4f5e" },
  { key: "yellow", fill: "#ffd84d" },
  { key: "green", fill: "#36e18e" },
  { key: "blue", fill: "#58a6ff" }
];
const DARK_WILD_GEMS: Array<{ key: Color; fill: string }> = [
  { key: "orange", fill: "#ff8a34" },
  { key: "cyan", fill: "#39d9f4" },
  { key: "purple", fill: "#9b6dff" },
  { key: "pink", fill: "#ff5fb7" }
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
    card.side ? `card-side-${card.side}` : "card-side-light",
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
            <WildBadge small={small} value={card.value} dark={card.side === "dark"} />
          ) : card.value === "draw2" || card.value === "draw5" ? (
            <DrawActionGlyph small={small} amount={card.value === "draw2" ? "+2" : "+5"} />
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

function CornerIndex({ card, small, position }: { card: DisplayCard; small?: boolean; position: "tl" | "br" }) {
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

function drawAmount(value: CardValue): "+2" | "+3" | "+4" | "+5" | null {
  if (value === "draw2") return "+2";
  if (value === "draw5") return "+5";
  if (value === "wild3") return "+3";
  if (value === "wild4") return "+4";
  return null;
}

function WildBadge({ small, value, dark = false }: { small?: boolean; value: CardValue; dark?: boolean }) {
  const gems = dark ? DARK_WILD_GEMS : WILD_GEMS;
  return (
    <div className="grid place-items-center gap-1 text-center">
      <svg className="card-wild-badge" viewBox="0 0 64 64" aria-hidden="true">
        {gems.map((gem, index) => {
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
              stroke={dark ? "rgba(0,0,0,0.76)" : "rgba(255,255,255,0.9)"}
              strokeWidth="1"
              transform={`rotate(45 ${x} ${y})`}
            />
          );
        })}
        <path
          d="M32 8 38.8 24.6 56 25.8 42.7 37.4 46.6 55 32 45.6 17.4 55 21.3 37.4 8 25.8 25.2 24.6Z"
          fill={dark ? "#11100f" : "#ffffff"}
          stroke={dark ? "#000000" : "rgba(255,255,255,0.92)"}
          strokeWidth="1.3"
          strokeLinejoin="round"
          transform="translate(32 32) scale(0.78) translate(-32 -32)"
        />
      </svg>
      {value === "wild3" ? <DrawAmountLabel amount="+3" small={small} /> : null}
      {value === "wild4" ? <DrawAmountLabel amount="+4" small={small} /> : null}
      {value === "wildColor" ? <span className="card-wild-color-label">COLOR</span> : null}
    </div>
  );
}

function DrawAmountLabel({ amount, small, corner }: { amount: "+2" | "+3" | "+4" | "+5"; small?: boolean; corner?: boolean }) {
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

function DrawActionGlyph({ small, amount }: { small?: boolean; amount: "+2" | "+5" }) {
  return (
    <div className="card-draw-glyph relative w-full text-center">
      <span className="absolute left-1/2 top-0 -translate-x-1/2">
        <ActionGlyph value={amount === "+2" ? "draw2" : "draw5"} small={small} />
      </span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <DrawAmountLabel amount={amount} small={small} />
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
        <path d="M14 15h16l-3.8-3.8a2.2 2.2 0 1 1 3.1-3.1l7.6 7.6-7.6 7.6a2.2 2.2 0 1 1-3.1-3.1L30 19.4H18.2a7.8 7.8 0 0 0-6.7 3.8 2.2 2.2 0 1 1-3.8-2.3A12.2 12.2 0 0 1 18.2 15Z" fill="currentColor" />
        <path d="M34 33H18l3.8 3.8a2.2 2.2 0 1 1-3.1 3.1L11.1 32l7.6-7.6a2.2 2.2 0 1 1 3.1 3.1L18 28.6h11.8a7.8 7.8 0 0 0 6.7-3.8 2.2 2.2 0 1 1 3.8 2.3A12.2 12.2 0 0 1 29.8 33Z" fill="currentColor" />
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

  if (value === "draw5") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
        <rect x="8" y="14" width="16" height="23" rx="3" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} transform="rotate(-12 16 25)" />
        <rect x="17" y="10" width="16" height="23" rx="3" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} />
        <rect x="25" y="13" width="16" height="23" rx="3" fill="none" stroke="currentColor" strokeWidth={stroke + 1.5} transform="rotate(12 33 24)" />
      </svg>
    );
  }

  if (value === "flip") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
        <path d="M9 17h24l-5-5m5 5-5 5M39 31H15l5 5m-5-5 5-5" fill="none" stroke="currentColor" strokeWidth={stroke + 2} strokeLinecap="round" strokeLinejoin="round" />
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

  if (color === "orange") {
    return <svg className="card-color-symbol" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="25" r="15" fill="currentColor" /><path d="M25 10c2-5 7-7 12-5-2 5-6 8-12 8Z" fill="currentColor" /></svg>;
  }
  if (color === "cyan") {
    return <svg className="card-color-symbol" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4C17 15 10 23 10 31a14 14 0 0 0 28 0c0-8-7-16-14-27Z" fill="currentColor" /></svg>;
  }
  if (color === "purple") {
    return <svg className="card-color-symbol" viewBox="0 0 48 48" aria-hidden="true"><path d="m24 3 6 14 15 2-11 10 3 15-13-8-13 8 3-15L3 19l15-2 6-14Z" fill="currentColor" /></svg>;
  }
  if (color === "pink") {
    return <svg className="card-color-symbol" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42S7 32 7 18C7 8 20 5 24 14 28 5 41 8 41 18c0 14-17 24-17 24Z" fill="currentColor" /></svg>;
  }

  return null;
}
