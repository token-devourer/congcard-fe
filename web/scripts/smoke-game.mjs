// Smoke test: create a room, join 2 clients, start a round, and exercise the
// message flow the new UI depends on (state snapshots, turns, draw/play).
import { Client } from "@colyseus/sdk";

const API = "http://localhost:2567";
const WS = "ws://localhost:2567";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const created = await fetch(`${API}/rooms`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({})
}).then((res) => res.json());

console.log("room created:", created.code);

const snapshots = { A: null, B: null };

async function join(name, avatarId) {
  const client = new Client(WS);
  const room = await client.joinById(created.roomId, { nickname: name, avatarId });
  room.onMessage("state", (snapshot) => {
    snapshots[name] = snapshot;
  });
  room.onMessage("error", (payload) => {
    console.log(`${name} error:`, payload.code, payload.message);
  });
  return room;
}

const roomA = await join("A", "sun");
const roomB = await join("B", "moon");
await wait(500);

console.log("lobby players:", snapshots.A.players.map((p) => `${p.nickname}${p.isHost ? "(host)" : ""}`).join(", "));

roomB.send("room.ready", { ready: true });
await wait(300);
roomA.send("game.start");
await wait(600);

const a = snapshots.A;
console.log("phase:", a.phase, "| round:", a.roundNumber);
console.log("A hand:", a.self.hand.length, "| B cardCount:", a.players.find((p) => p.nickname === "B").cardCount);
console.log("discardTop:", a.discardTop?.color, a.discardTop?.value, "| activeColor:", a.activeColor);
console.log("currentPlayerId set:", Boolean(a.currentPlayerId), "| turnDeadline set:", Boolean(a.turnDeadline));

// Drive a few turns: current player plays a playable card or draws.
for (let step = 0; step < 6; step += 1) {
  const snap = snapshots.A;
  if (snap.phase !== "playing") break;
  if (snap.pendingChallenge) {
    const challenger = snap.players.find((p) => p.id === snap.pendingChallenge.challengerId);
    const room = challenger.nickname === "A" ? roomA : roomB;
    room.send("game.challenge", { accept: false });
    console.log(`${challenger.nickname} accepted +4 penalty`);
    await wait(400);
    continue;
  }

  const current = snap.players.find((p) => p.id === snap.currentPlayerId);
  const room = current.nickname === "A" ? roomA : roomB;
  const mySnap = snapshots[current.nickname];
  const hand = mySnap.self.hand;
  const playable = hand.find(
    (card) => card.color === null || card.color === mySnap.activeColor || card.value === mySnap.discardTop.value
  );

  if (mySnap.self.drawnCardId) {
    room.send("game.playDrawn", { play: false });
    console.log(`${current.nickname} passed drawn card`);
  } else if (playable) {
    room.send("game.playCard", {
      cardId: playable.id,
      ...(playable.color === null ? { declaredColor: "red" } : {})
    });
    console.log(`${current.nickname} played ${playable.color ?? "wild"} ${playable.value}`);
  } else {
    room.send("game.drawCard");
    console.log(`${current.nickname} drew`);
  }

  await wait(400);
}

const final = snapshots.A;
console.log("final phase:", final.phase, "| seq:", final.seq, "| log entries:", final.actionLog.length);
console.log("direction:", final.direction, "| drawPileCount:", final.drawPileCount);

roomA.leave();
roomB.leave();
console.log("SMOKE OK");
process.exit(0);
