import { describe, it, expect } from "vitest";
import { escapeHtml } from "./escapeHtml";

describe("escapeHtml", () => {
  it("escapes special HTML characters properly", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
    );
    expect(escapeHtml('Tom & "Jerry"')).toBe("Tom &amp; &quot;Jerry&quot;");
  });

  it("leaves normal strings unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });
});
