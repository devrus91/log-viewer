import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BuiltInRulesEnglishPage from "./page";

describe("BuiltInRulesEnglishPage", () => {
  it("mirrors all built-in rules and links to the Russian version", () => {
    render(<BuiltInRulesEnglishPage />);

    expect(screen.getByRole("heading", { name: "Current diagnostic rules" })).toBeTruthy();
    expect(screen.getAllByTestId("documented-rule")).toHaveLength(26);
    expect(screen.getByRole("heading", { name: "Boost Under Target" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "WOT Pull" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "RU" }).getAttribute("href")).toBe("/docs/rules");
  });
});
