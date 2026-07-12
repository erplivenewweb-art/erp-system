import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commercePath } from "@/lib/commerce-path";

const prohibitedSegments = [
  ["internal", "v1"].join("/"),
  ["get", "Stock"].join(""),
  ["save", "Billing"].join(""),
  ["erp", "auth", "token"].join("_"),
];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "test" ? [] : sourceFiles(target);
    }
    return /\.(ts|tsx|css|json)$/.test(entry.name) ? [target] : [];
  });
}

describe("runtime isolation boundaries", () => {
  it("contains no internal or known ERP route references in browser source", () => {
    const content = sourceFiles(path.join(process.cwd(), "src"))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    for (const segment of prohibitedSegments) expect(content).not.toContain(segment);
  });

  it("constructs only approved Commerce API audience paths", () => {
    expect(commercePath("public", "products")).toBe(
      "/commerce/v1/public/products",
    );
    expect(() => commercePath("public", "../private")).toThrow();
  });

  it("has no production database dependencies or ERP imports", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      "next",
      "react",
      "react-dom",
    ]);
  });
});

