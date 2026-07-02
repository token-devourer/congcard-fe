// The server writes actionLog messages in English from a small, known set of
// templates (BE/src/engine/game.ts). We translate them client-side by pattern
// so the log follows the UI locale without protocol changes.

export type Translate = (key: string, values?: Record<string, string | number>) => string;

interface Pattern {
  re: RegExp;
  key: string;
  values?: (match: RegExpMatchArray, t: Translate) => Record<string, string | number>;
}

const CARD_VALUE_KEYS: Record<string, string> = {
  skip: "log.valSkip",
  reverse: "log.valReverse",
  draw1: "log.valDraw1",
  draw2: "log.valDraw2",
  draw5: "log.valDraw5",
  flip: "log.valFlip",
  wild: "log.valWild",
  wild2: "log.valWild2",
  wild3: "log.valWild3",
  wild4: "log.valWild4",
  wildColor: "log.valWildColor",
  flashbang: "log.valFlashbang",
  throwup: "log.valThrowup",
  steal: "log.valSteal",
  favor: "log.valFavor",
  peek: "log.valPeek",
  vote: "log.valVote",
  chaosCard: "log.valChaosCard",
  timeskip: "log.valTimeskip",
  mirror: "log.valMirror",
  pandemic: "log.valPandemic",
  magnet: "log.valMagnet",
  jackpot: "log.valJackpot",
  roulette: "log.valRoulette",
  nuke: "log.valNuke",
  mime: "log.valMime"
};

const CARD_VALUE_PATTERN = "\\d|skip|reverse|draw1|draw2|draw5|flip|wild2|wild3|wild4|wildColor|wild|flashbang|throwup|steal|favor|peek|vote|chaosCard|timeskip|mirror|pandemic|magnet|jackpot|roulette|nuke|mime";

function cardName(color: string | undefined, value: string, t: Translate): string {
  const valueLabel = CARD_VALUE_KEYS[value] ? t(CARD_VALUE_KEYS[value]) : value;
  if (!color) {
    return valueLabel;
  }

  return t("log.cardWithColor", { value: valueLabel, color: t(`colors.${color}`) });
}

// Order matters: more specific templates first ("timed out and drew one card"
// would otherwise be swallowed by "drew one card").
const PATTERNS: Pattern[] = [
  { re: /^Round (\d+) dealing started\.$/, key: "dealingStarted", values: (match) => ({ number: Number(match[1]) }) },
  { re: /^(.+) began dealing\.$/, key: "beganDealing" },
  { re: /^(.+) reshuffled the deck\.$/, key: "reshuffledRoundDeck" },
  { re: /^(.+) is now the dealer\.$/, key: "newDealer" },
  { re: /^(.+) timed out and drew one card\.$/, key: "timedOut" },
  { re: /^(.+) lost the challenge and drew (\d+) cards\.$/, key: "lostChallenge", values: (match) => ({ name: match[1], count: Number(match[2]) }) },
  { re: /^(.+) won the challenge\.$/, key: "wonChallenge" },
  { re: /^(.+) took four cards\.$/, key: "tookFour" },
  { re: /^(.+) took (\d+) cards\.$/, key: "tookCards", values: (match) => ({ name: match[1], count: Number(match[2]) }) },
  { re: /^(.+) must choose whether to challenge\.$/, key: "mustChallenge" },
  { re: /^(.+) must choose: challenge, stack, or accept (\d+) cards\.$/, key: "mustChallengeStack", values: (match) => ({ name: match[1], count: Number(match[2]) }) },
  { re: /^Game paused until at least two active players return\.$/, key: "gamePaused", values: () => ({}) },
  { re: /^Game resumed\.$/, key: "gameResumed", values: () => ({}) },
  {
    re: new RegExp(`^(.+) played a batch of (\\d+) (${CARD_VALUE_PATTERN}) cards\\.$`),
    key: "playedBatch",
    values: (match, t) => ({ name: match[1], count: Number(match[2]), value: cardName(undefined, match[3], t) })
  },
  { re: /^(\d+) players were skipped by the batch\.$/, key: "batchSkipped", values: (match) => ({ count: Number(match[1]) }) },
  { re: /^Turn direction changed (\d+) times\.$/, key: "batchReversed", values: (match) => ({ count: Number(match[1]) }) },
  {
    re: new RegExp(`^(.+) played (?:(red|yellow|green|blue|orange|cyan|purple|pink) )?(${CARD_VALUE_PATTERN})\\.$`),
    key: "played",
    values: (match, t) => ({ name: match[1], card: cardName(match[2], match[3], t) })
  },
  { re: /^(.+) drew one card\.$/, key: "drewOne" },
  { re: /^(.+) auto-drew one card while away\.$/, key: "autoDrewOneAway" },
  { re: /^(.+) auto-drew one card while disconnected\.$/, key: "autoDrewOne" },
  { re: /^(.+) drew two cards\.$/, key: "drewTwo" },
  { re: /^(.+) drew (\d+) cards to find (?:\d+ )?(red|yellow|green|blue|orange|cyan|purple|pink)(?: cards?)?\.$/, key: "drewForColor", values: (match, t) => ({ name: match[1], count: Number(match[2]), color: t(`colors.${match[3]}`) }) },
  { re: /^(.+) passed because no cards were left\.$/, key: "passedEmpty" },
  { re: /^(.+) auto-passed while away\.$/, key: "autoPassedAway" },
  { re: /^(.+) auto-passed while disconnected\.$/, key: "autoPassed" },
  { re: /^(.+) passed after drawing\.$/, key: "passed" },
  { re: /^The draw pile ran out of cards\.$/, key: "deckExhausted", values: () => ({}) },
  { re: /^(.+) called One\.$/, key: "calledOne" },
  { re: /^(.+) was skipped\.$/, key: "skipped" },
  { re: /^Turn direction changed\.$/, key: "reversed", values: () => ({}) },
  {
    re: /^Active color is (red|yellow|green|blue|orange|cyan|purple|pink)\.$/,
    key: "activeColor",
    values: (match, t) => ({ color: t(`colors.${match[1]}`) })
  },
  {
    re: /^(.+) won the round with (\d+) points\.$/,
    key: "wonRound",
    values: (match) => ({ name: match[1], points: Number(match[2]) })
  },
  { re: /^Round (\d+) started\.$/, key: "roundStarted", values: (match) => ({ number: Number(match[1]) }) },
  { re: /^Discard pile was shuffled into the draw pile\.$/, key: "reshuffled", values: () => ({}) },
  { re: /^(.+) caught (.+)\.$/, key: "caught", values: (match) => ({ name: match[1], target: match[2] }) },
  { re: /^(.+) joined the room\.$/, key: "joined" },
  { re: /^(.+) joined as a waiting player\.$/, key: "joinedWaiting" },
  { re: /^(.+) joined as a spectator\.$/, key: "joinedSpectator" },
  { re: /^(.+) joined the next round\.$/, key: "joinedNextRound" },
  { re: /^(.+) left the room\.$/, key: "left" },
  { re: /^(.+) reconnected\.$/, key: "reconnected" },
  { re: /^(.+) disconnected\.$/, key: "disconnected" },
  { re: /^(.+) is away\.$/, key: "away" },
  { re: /^(.+) returned to the table\.$/, key: "returned" },
  { re: /^(.+) is on auto play until they reconnect\.$/, key: "autoPlay" },
  { re: /^(.+) is not ready\.$/, key: "notReady" },
  { re: /^(.+) is ready\.$/, key: "ready" },
  { re: /^(.+) was kicked from the room\.$/, key: "kicked" },
  { re: /^(.+) is now the host\.$/, key: "newHost" },
  { re: /^Room settings were updated\.$/, key: "settingsUpdated", values: () => ({}) },
  { re: /^(.+) flipped the deck (\d+) times?\.$/, key: "flipped", values: (match) => ({ name: match[1], count: Number(match[2]) }) }
];

export function translateLog(message: string, t: Translate): string {
  for (const pattern of PATTERNS) {
    const match = message.match(pattern.re);
    if (match) {
      return t(`log.${pattern.key}`, pattern.values ? pattern.values(match, t) : { name: match[1] });
    }
  }

  // Unknown template (e.g. emotes like "Name: Hello!"), show as-is.
  return message;
}

export const LOG_ICON: Record<string, string> = {
  batch: "*",
  deal: "#",
  room: "👥",
  play: "🎴",
  draw: "🃏",
  skip: "⛔",
  reverse: "🔄",
  wild: "🌈",
  challenge: "⚔️",
  one: "☝️",
  round: "🏁",
  error: "⚠️"
};
