import type { Card, GameSnapshot } from "@congcard/shared";

export function canPlayCard(snapshot: GameSnapshot | null, card: Card): boolean {
  if (
    !snapshot?.self ||
    snapshot.self.role !== "player" ||
    snapshot.phase !== "playing" ||
    snapshot.pauseReason ||
    snapshot.oneWindow
  ) {
    return false;
  }

  const handCard = snapshot.self.hand.find((item) => item.id === card.id);
  if (!handCard) {
    return false;
  }

  const selfPlayer = snapshot.players.find((player) => player.id === snapshot.self?.id);
  if (selfPlayer?.finishedRank) {
    return false;
  }

  const canStackCurrentCard = snapshot.pendingStack && canStackCard(handCard, snapshot.pendingStack.kind);
  if (
    snapshot.pendingChallenge &&
    !(
      snapshot.pendingStack?.challengeable &&
      snapshot.pendingStack.targetPlayerId === snapshot.self.id &&
      canStackCurrentCard
    )
  ) {
    return false;
  }

  if (snapshot.pendingStack) {
    if (snapshot.pendingStack.targetPlayerId === snapshot.self.id) {
      return Boolean(canStackCurrentCard);
    }

    return Boolean(snapshot.settings.jumpInEnabled && snapshot.discardTop && isJumpInMatch(handCard, snapshot.discardTop) && stackDrawAmount(handCard));
  }

  if (snapshot.currentPlayerId !== snapshot.self.id) {
    return Boolean(snapshot.settings.jumpInEnabled && snapshot.discardTop && isJumpInMatch(handCard, snapshot.discardTop));
  }

  if (snapshot.self.drawnCardId && snapshot.self.drawnCardId !== handCard.id) {
    return false;
  }

  if (!snapshot.activeColor || !snapshot.discardTop) {
    return false;
  }

  if (handCard.color === null) {
    return true;
  }

  return handCard.color === snapshot.activeColor || handCard.value === snapshot.discardTop.value;
}

function canStackCard(card: Card, kind: "draw2" | "wild4"): boolean {
  return kind === "draw2" ? card.value === "draw2" : card.value === "wild4";
}

function stackDrawAmount(card: Card): number | null {
  if (card.value === "draw2") return 2;
  if (card.value === "wild4") return 4;
  return null;
}

function isJumpInMatch(card: Card, discardTop: Card): boolean {
  return card.value === discardTop.value && card.color === discardTop.color;
}

export function playableCardInHand(snapshot: GameSnapshot | null, card: Card | null): Card | null {
  if (!snapshot?.self || !card) {
    return null;
  }

  const handCard = snapshot.self.hand.find((item) => item.id === card.id);
  return handCard && canPlayCard(snapshot, handCard) ? handCard : null;
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
