import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface TokenSource {
  notice: string;
  tokens: Array<{ name: string; value: string; type: string }>;
}

const source = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "src", "tokens", "tokens.json"), "utf8"),
) as TokenSource;

describe("design token artifact", () => {
  it("is canonical, valid, and contains unique names", () => {
    expect(source.notice).toBe("STOREFRONT CANONICAL TOKEN SOURCE");
    expect(source.tokens.length).toBeGreaterThan(0);
    const names = source.tokens.map((token) => token.name);
    expect(new Set(names).size).toBe(names.length);
    for (const token of source.tokens) {
      expect(token.name).toMatch(/^[a-z][a-z0-9.-]+$/);
      expect(token.value.length).toBeGreaterThan(0);
    }
  });
});

