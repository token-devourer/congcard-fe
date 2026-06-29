import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardView } from "../src/components/CardView";

describe("CardView", () => {
  it("renders original card text", () => {
    render(<CardView card={{ id: "red-7", color: "red", value: 7, deckIndex: 0 }} />);

    expect(screen.getByLabelText("red 7")).toBeInTheDocument();
  });

  it("renders hidden card backs", () => {
    render(<CardView hidden />);

    expect(screen.getByLabelText("Hidden card")).toBeInTheDocument();
  });

  it("renders meme cards with image art when available", () => {
    const { container } = render(
      <>
        <CardView card={{ id: "throwup", color: "green", value: "throwup", deckIndex: 0 }} />
        <CardView card={{ id: "peek", color: null, value: "peek", deckIndex: 1 }} />
      </>
    );

    const images = container.querySelectorAll(".card-meme-image");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/memes/gag-cat.png");
    expect(images[0]).toHaveStyle({ objectFit: "contain" });
    expect(container.querySelector(".card-meme-art-card")).not.toBeInTheDocument();
    expect(container.querySelector(".cartouche-meme-image")).not.toBeInTheDocument();
    expect(container.querySelector("use[href$='icon-meme-throwup']")).not.toBeInTheDocument();
    expect(container.querySelector("use[href$='icon-meme-peek']")).not.toBeInTheDocument();
  });
});
