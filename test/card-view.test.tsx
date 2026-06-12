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
});
