import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EnglishDocumentationPage from "./page";

describe("EnglishDocumentationPage", () => {
  it("provides the complete English guide and a Russian language switch", () => {
    render(<EnglishDocumentationPage />);

    expect(screen.getByRole("heading", { name: "Calculated channels" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Shared expression language" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Window functions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Log analysis rules" })).toBeTruthy();
    expect(screen.getByText("lag(expr, N)")).toBeTruthy();
    expect(screen.getByText("moving_avg(expr, N)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "RU" }).getAttribute("href")).toBe("/docs");
    expect(screen.getByText(/Every function listed below works both in a calculated channel expression/)).toBeTruthy();
    expect(screen.getByText(/Either side of a condition can use parameters/)).toBeTruthy();
  });
});
