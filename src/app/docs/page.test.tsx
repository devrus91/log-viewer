import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DocumentationPage from "./page";

describe("DocumentationPage", () => {
  it("documents formulas, window functions, rules, and channel mapping", () => {
    render(<DocumentationPage />);

    expect(screen.getByRole("heading", { name: "Виртуальные (calculated) каналы" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Оконные функции" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Правила анализа лога" })).toBeTruthy();
    expect(screen.getByText("lag(expr, N)")).toBeTruthy();
    expect(screen.getByText("moving_avg(expr, N)")).toBeTruthy();
    expect(screen.getByText("[boost.actual]", { selector: "code" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Вернуться|К просмотру/ })).toHaveLength(2);
  });
});
