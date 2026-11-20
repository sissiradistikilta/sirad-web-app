import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";

describe("the entry point", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("renders the app into the root element of the page", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await act(async () => {
      await import("./index");
    });

    expect(screen.getByRole("heading", { name: "SiRad Web" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Vastaanotto" })).toBeInTheDocument();
  });

  it("tells about a page without the root element", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await import("./index");

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Cannot find"));
  });
});
