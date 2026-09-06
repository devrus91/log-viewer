import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DocumentationPage from "./page";

describe("DocumentationPage", () => {
  it("documents formulas, window functions, rules, and channel mapping", () => {
    render(<DocumentationPage />);

    expect(screen.getByRole("heading", { name: "Вычисляемые каналы" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Общий язык выражений" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Оконные функции" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Правила анализа лога" })).toBeTruthy();
    expect(screen.getByText("lag(expr, N)")).toBeTruthy();
    expect(screen.getByText("moving_avg(expr, N)")).toBeTruthy();
    expect(screen.getByText("[boost.actual]", { selector: "code" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "RU" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/docs/en");
    expect(screen.getByText(/Все перечисленные ниже функции работают как в выражении вычисляемого канала/)).toBeTruthy();
    expect(screen.getByText(/В левой и правой частях условия можно использовать параметры/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Вернуться|К просмотру/ })).toHaveLength(2);
  });
});
