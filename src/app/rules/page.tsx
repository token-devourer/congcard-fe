export default function RulesPage() {
  return (
    <main className="app-shell py-8">
      <article className="panel mx-auto max-w-3xl space-y-6 p-5 md:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Rules</p>
          <h1 className="mt-2 text-3xl font-black">How to play Kartu Satu</h1>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Goal</h2>
          <p className="text-[var(--muted)]">Empty your hand first. The round winner scores points from cards left in every other hand.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Turns</h2>
          <p className="text-[var(--muted)]">Play a card that matches the active color, number, or symbol. Wild cards can be played on any turn.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">Action cards</h2>
          <ul className="list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>Skip makes the next player lose a turn.</li>
            <li>Reverse changes direction. With two players, it acts like Skip.</li>
            <li>Draw Two makes the next player draw two cards and lose a turn.</li>
            <li>Wild lets you choose the active color.</li>
            <li>Wild Draw Four lets you choose a color and forces a challenge choice.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">One call</h2>
          <p className="text-[var(--muted)]">Press One when you have one card left. If you miss it, another player can catch you and you draw two cards.</p>
        </section>
      </article>
    </main>
  );
}
