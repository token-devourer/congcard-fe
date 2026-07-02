import type { Card, CardValue, Color, FlipSide, VisibleCardFace } from "@congcard/shared";
import { cardText, isMemeValue, isSpecialValue } from "@/lib/rules";

interface CardViewProps {
  card?: Card | VisibleCardFace;
  hidden?: boolean;
  small?: boolean;
  micro?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

type DisplayCard = Pick<Card, "color" | "value"> & { side?: FlipSide };

export function CardView({ card, hidden, small, micro, playable, dimmed, disabled, onClick }: CardViewProps) {
  const compact = Boolean(small || micro);
  const sizeClass = micro ? "card-micro" : compact ? "card-small" : "card-normal";
  if (hidden || !card) {
    return (
      <div className={`card-face ${sizeClass} card-back grid place-items-center`} aria-label="Hidden card">
        <div className="relative z-10 grid place-items-center">
          <div className="card-back-mark">
            CC
          </div>
        </div>
      </div>
    );
  }

  const isWild = !card.color;
  const isSpecial = isWild && isSpecialValue(card.value);
  const isMeme = isMemeValue(card.value);

  const className = [
    "card-face",
    sizeClass,
    playable ? "playable" : "",
    dimmed ? "dimmed" : "",
    card.side ? `card-side-${card.side}` : "card-side-light",
    card.color ? (isMeme ? `card-${card.color} card-meme-color` : `card-${card.color}`) : isSpecial ? "card-special" : "card-wild",
    !card.color && card.side === "dark" && !isSpecial ? "card-wild-dark-ink" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <CornerIndex card={card} small={compact} position="tl" />
      <CornerIndex card={card} small={compact} position="br" />

      <div className="absolute inset-0 z-[5] grid place-items-center">
        <div className={`cartouche ${compact ? "cartouche-sm" : ""}`}>
          {isSpecial || (isMeme && card.color) ? (
            <SpecialBadge value={card.value} small={compact} />
          ) : isWild ? (
            <WildBadge small={compact} value={card.value} dark={card.side === "dark"} />
          ) : card.value === "draw1" || card.value === "draw2" || card.value === "draw5" ? (
            <DrawActionGlyph small={compact} value={card.value} amount={drawAmount(card.value) ?? "+1"} />
          ) : isActionValue(card.value) ? (
            <ActionGlyph value={card.value} small={compact} />
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
      {isMemeValue(card.value) ? (
        <span className="card-corner-icon text-white drop-shadow-[0_0_6px_rgba(200,0,255,0.4)_0_1px_2px_rgba(0,0,0,0.3)]">✦</span>
      ) : amount ? (
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

function drawAmount(value: CardValue): "+1" | "+2" | "+3" | "+4" | "+5" | null {
  if (value === "draw1") return "+1";
  if (value === "draw2") return "+2";
  if (value === "draw5") return "+5";
  if (value === "wild2") return "+2";
  if (value === "wild3") return "+3";
  if (value === "wild4") return "+4";
  return null;
}

function WildBadge({ small, value, dark = false }: { small?: boolean; value: CardValue; dark?: boolean }) {
  return (
    <div className="grid place-items-center gap-1 text-center">
      <svg className="card-wild-badge" viewBox="0 0 64 64" aria-hidden="true">
        <use href={`/sprites/card-icons.svg#${dark ? "icon-wild-dark" : "icon-wild"}`} />
      </svg>
      {value === "wild3" ? <DrawAmountLabel amount="+3" small={small} /> : null}
      {value === "wild4" ? <DrawAmountLabel amount="+4" small={small} /> : null}
      {value === "wildColor" ? <span className="card-wild-color-label">COLOR</span> : null}
    </div>
  );
}

function DrawAmountLabel({ amount, small, corner }: { amount: "+1" | "+2" | "+3" | "+4" | "+5"; small?: boolean; corner?: boolean }) {
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

function DrawActionGlyph({ small, value, amount }: { small?: boolean; value: Extract<CardValue, string>; amount: "+1" | "+2" | "+3" | "+4" | "+5" }) {
  return (
    <div className="card-draw-glyph relative w-full text-center">
      <span className="absolute left-1/2 top-0 -translate-x-1/2">
        <ActionGlyph value={value === "draw5" ? "draw5" : "draw2"} small={small} />
      </span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <DrawAmountLabel amount={amount} small={small} />
      </span>
    </div>
  );
}

function ActionGlyph({ value, small, corner }: { value: Extract<CardValue, string>; small?: boolean; corner?: boolean }) {
  const iconId = iconForValue(value);
  const className = `card-action-glyph ${corner ? "corner" : ""} drop-shadow-[0_2px_4px_rgba(0,0,0,0.42)]`;

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <use href={`/sprites/card-icons.svg#${iconId}`} />
    </svg>
  );
}

function iconForValue(value: Extract<CardValue, string>): string {
  switch (value) {
    case "skip": return "icon-skip";
    case "reverse": return "icon-reverse";
    case "draw2": return "icon-draw2";
    case "draw5": return "icon-draw5";
    case "flip": return "icon-flip";
    default: return "icon-star";
  }
}

function SpecialBadge({ value, small }: { value: CardValue; small?: boolean }) {
  const iconId = iconForSpecialValue(value);
  const art = memeArtForValue(value);

  if (!art) {
    return (
      <div className="grid place-items-center gap-1 text-center">
        <svg className="card-special-icon" viewBox="0 0 64 64" aria-hidden="true">
          <use href={`/sprites/card-icons.svg#${iconId}`} />
        </svg>
      </div>
    );
  }

  const className = ["card-meme-badge", small ? "compact" : "", `with-${art.mode}`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="card-meme-art">
        <img
          className="card-meme-image"
          src={art.src}
          alt=""
          style={{ objectFit: art.fit, objectPosition: art.position }}
        />
      </div>
    </div>
  );
}

type MemeArt = {
  fit: "contain" | "cover";
  mode: "cutout" | "frame";
  src: string;
  position: string;
};

const MEME_ART: Record<string, MemeArt> = {
  throwup: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/gag-cat.png",
    position: "50% 50%"
  },
  steal: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/muhehehe-cat.png",
    position: "50% 50%"
  },
  flashbang: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/flashbang-cat.png",
    position: "50% 50%"
  },
  favor: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/awowo-cat.png",
    position: "50% 50%"
  },
  peek: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/acumalaka-frog.png",
    position: "50% 50%"
  },
  timeskip: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/timeskip-cat.png",
    position: "50% 50%"
  },
  nuke: {
    fit: "contain",
    mode: "cutout",
    src: "/memes/nuke-cat.png",
    position: "50% 50%"
  }
};

const SPECIAL_ICONS: Record<string, string> = {
  flashbang: "icon-meme-flashbang",
  throwup: "icon-meme-throwup",
  steal: "icon-meme-steal",
  favor: "icon-meme-favor",
  peek: "icon-meme-peek",
  vote: "icon-meme-vote",
  chaosCard: "icon-meme-chaos",
  timeskip: "icon-meme-timeskip",
  mirror: "icon-meme-mirror",
  pandemic: "icon-meme-pandemic",
  magnet: "icon-meme-magnet",
  jackpot: "icon-meme-jackpot",
  roulette: "icon-meme-roulette",
  nuke: "icon-meme-nuke",
  mime: "icon-meme-mime"
};

function iconForSpecialValue(value: CardValue): string {
  return SPECIAL_ICONS[String(value)] ?? "icon-star";
}

function memeArtForValue(value: CardValue): MemeArt | null {
  return MEME_ART[String(value)] ?? null;
}

function ColorSymbol({ color }: { color: Color | null }) {
  if (!color) return null;
  const wideClass = color === "blue" ? "wide" : color === "yellow" ? "narrow" : "";

  return (
    <svg className={`card-color-symbol ${wideClass}`} viewBox="0 0 48 48" aria-hidden="true">
      <use href={`/sprites/card-icons.svg#icon-color-${color}`} />
    </svg>
  );
}
