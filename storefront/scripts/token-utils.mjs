import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const tokenSourcePath = path.join(root, "src", "tokens", "tokens.json");
export const generatedCssPath = path.join(root, "src", "styles", "tokens.generated.css");
export const generatedTypePath = path.join(root, "src", "tokens", "tokens.generated.ts");

export function loadTokenSource() {
  return JSON.parse(fs.readFileSync(tokenSourcePath, "utf8"));
}

export function cssName(name) {
  return `--sf-${name.replaceAll(".", "-")}`;
}

export function cssValue(value) {
  return value.replace(/\{([a-z][a-z0-9.-]+)\}/g, (_, name) => `var(${cssName(name)})`);
}

export function validateTokenSource(source) {
  const errors = [];
  if (source.notice !== "STOREFRONT CANONICAL TOKEN SOURCE") {
    errors.push("Canonical token notice is missing.");
  }
  if (!Array.isArray(source.tokens) || source.tokens.length === 0) {
    errors.push("Token list must be non-empty.");
    return errors;
  }
  const seen = new Set();
  const supportedTypes = new Set([
    "color", "fontFamily", "dimension", "number", "duration",
    "cubicBezier", "shadow", "reference",
  ]);
  const supportedCategories = new Set([
    "color", "typography", "spacing", "radius", "border", "elevation",
    "motion", "layout", "breakpoint", "z-index", "component", "theme",
  ]);
  for (const [index, token] of source.tokens.entries()) {
    if (!token || typeof token.name !== "string" || !/^[a-z][a-z0-9.-]+$/.test(token.name)) {
      errors.push(`Token ${index} has an invalid name.`);
    }
    if (seen.has(token.name)) errors.push(`Duplicate token: ${token.name}`);
    seen.add(token.name);
    if (typeof token.value !== "string" || token.value.length === 0) {
      errors.push(`Token ${token.name ?? index} has no string value.`);
    }
    if (!supportedTypes.has(token.type)) {
      errors.push(`Token ${token.name ?? index} has an unsupported type.`);
    }
    if (!supportedCategories.has(token.category)) {
      errors.push(`Token ${token.name ?? index} has an unsupported category.`);
    }
  }
  for (const token of source.tokens) {
    for (const match of token.value.matchAll(/\{([^}]+)\}/g)) {
      if (!seen.has(match[1])) errors.push(`Token ${token.name} references missing token ${match[1]}.`);
    }
  }
  return errors;
}
