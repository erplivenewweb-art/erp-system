import fs from "node:fs";
import {
  cssName,
  cssValue,
  generatedCssPath,
  generatedTypePath,
  loadTokenSource,
  validateTokenSource,
} from "./token-utils.mjs";

const source = loadTokenSource();
const errors = validateTokenSource(source);
if (errors.length) throw new Error(errors.join("\n"));

const base = source.tokens.filter((token) => !token.name.startsWith("theme."));
const dark = source.tokens.filter((token) => token.name.startsWith("theme.dark."));
const festival = source.tokens.filter((token) => token.name.startsWith("theme.festival."));

const lines = [
  "/* GENERATED from src/tokens/tokens.json. Do not edit. */",
  ":root {",
  ...base.map((token) => `  ${cssName(token.name)}: ${cssValue(token.value)};`),
  "}",
  "",
  '[data-theme="dark"] {',
  ...dark.map((token) => {
    const semantic = token.name.replace("theme.dark.", "");
    return `  ${cssName(semantic)}: ${cssValue(token.value)};`;
  }),
  "}",
  "",
  '[data-festival-theme] {',
  ...festival.map((token) => `  ${cssName(token.name.replace("theme.festival.", "festival."))}: ${cssValue(token.value)};`),
  "}",
  "",
  '[data-seasonal-theme] {',
  ...source.tokens
    .filter((token) => token.name.startsWith("theme.seasonal."))
    .map((token) => `  ${cssName(token.name.replace("theme.seasonal.", "seasonal."))}: ${cssValue(token.value)};`),
  "}",
  "",
].join("\n");

const typeLines = [
  "/* GENERATED from src/tokens/tokens.json. Do not edit. */",
  "export const tokenNames = " + JSON.stringify(source.tokens.map((token) => token.name), null, 2) + " as const;",
  "export type TokenName = (typeof tokenNames)[number];",
  "export const tokenCount = " + source.tokens.length + " as const;",
  "",
].join("\n");

fs.writeFileSync(generatedCssPath, lines, "utf8");
fs.writeFileSync(generatedTypePath, typeLines, "utf8");
console.log(`Generated CSS and TypeScript metadata for ${source.tokens.length} tokens.`);
