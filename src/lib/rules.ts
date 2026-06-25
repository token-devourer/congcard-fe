import type { Card, GameSnapshot, PendingStack } from "@congcard/shared";

/**
 * True while the local player is the one hunting for a Wild Draw Color. The
 * draw controls + running collection inflate the hand row, so the board and
 * round table both shrink the felt during a self color hunt instead of letting
 * the page grow past the viewport.
 */
export function isSelfColorHunt(snapshot: GameSnapshot | null): boolean {
  const pendingDraw = snapshot?.pendingDraw;
  if (!pendingDraw) {
    return false;
  }
  return pendingDraw.reason === "colorHunt" && pendingDraw.playerId === snapshot?.self?.id;
}

export function canPlayCard(snapshot: GameSnapshot | null, card: Card): boolean {
  if (
    !snapshot?.self ||
    snapshot.self.role !== "player" ||
    snapshot.phase !== "playing" ||
    snapshot.pauseReason ||
    snapshot.pendingBatchPlay ||
    snapshot.pendingFlip ||
    snapshot.pendingDraw ||
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

function canStackCard(card: Card, kind: PendingStack["kind"]): boolean {
  return card.value === kind;
}

function stackDrawAmount(card: Card): number | null {
  if (card.value === "draw2") return 2;
  if (card.value === "draw5") return 5;
  if (card.value === "wild3") return 3;
  if (card.value === "wild4") return 4;
  if (card.value === "wildColor") return 1;
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

export function jumpInCardInHand(snapshot: GameSnapshot | null): Card | null {
  if (
    !snapshot?.self ||
    snapshot.self.role !== "player" ||
    snapshot.phase !== "playing" ||
    snapshot.pauseReason ||
    snapshot.pendingBatchPlay ||
    snapshot.pendingFlip ||
    snapshot.pendingDraw ||
    snapshot.oneWindow ||
    snapshot.currentPlayerId === snapshot.self.id ||
    !snapshot.settings.jumpInEnabled ||
    !snapshot.discardTop
  ) {
    return null;
  }

  const selfPlayer = snapshot.players.find((player) => player.id === snapshot.self?.id);
  if (selfPlayer?.finishedRank) {
    return null;
  }

  return snapshot.self.hand.find((card) => {
    if (!isJumpInMatch(card, snapshot.discardTop!)) {
      return false;
    }

    return snapshot.pendingStack ? stackDrawAmount(card) !== null : true;
  }) ?? null;
}

export function needsColor(card: Card): boolean {
  return card.value === "wild" || card.value === "wild3" || card.value === "wild4" || card.value === "wildColor";
}

export function cardText(card: Pick<Card, "value">): string {
  if (typeof card.value === "number") {
    return String(card.value);
  }

  const labels: Record<string, string> = {
    skip: "Skip",
    reverse: "Reverse",
    draw2: "+2",
    draw5: "+5",
    flip: "Flip",
    wild: "Wild",
    wild3: "+3",
    wild4: "+4",
    wildColor: "Wild Color"
  };

  return labels[String(card.value)] ?? String(card.value);
}
