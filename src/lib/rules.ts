import type { Card, GameSnapshot } from "@kartu-satu/shared";

export function canPlayCard(snapshot: GameSnapshot | null, card: Card): boolean {
  if (!snapshot?.self || snapshot.phase !== "playing" || snapshot.pendingChallenge) {
    return false;
  }

  if (snapshot.currentPlayerId !== snapshot.self.id) {
    return false;
  }

  if (snapshot.self.drawnCardId && snapshot.self.drawnCardId !== card.id) {
    return false;
  }

  if (card.color === null) {
    return true;
  }

  return card.color === snapshot.activeColor || card.value === snapshot.discardTop?.value;
}

export function needsColor(card: Card): boolean {
  return card.value === "wild" || card.value === "wild4";
}

export function cardText(card: Card): string {
  if (typeof card.value === "number") {
    return String(card.value);
  }

  const labels: Record<string, string> = {
    skip: "Skip",
    reverse: "Reverse",
    draw2: "+2",
    wild: "Wild",
    wild4: "+4"
  };

  return labels[String(card.value)] ?? String(card.value);
}
