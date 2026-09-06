import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BuiltInRulesPage from "./page";

describe("BuiltInRulesPage", () => {
  it("documents all built-in rules and links to the English version", () => {
    render(<BuiltInRulesPage />);

    expect(screen.getByRole("heading", { name: "Текущие правила диагностики" })).toBeTruthy();
    expect(screen.getAllByTestId("documented-rule")).toHaveLength(26);
    expect(screen.getByRole("heading", { name: "Boost Under Target" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "WOT Pull" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/docs/en/rules");
  });
});
