import { loadTokenSource, validateTokenSource } from "./token-utils.mjs";

const source = loadTokenSource();
const errors = validateTokenSource(source);
if (errors.length > 0) {
  for (const error of errors) console.error(`TOKEN ERROR: ${error}`);
  process.exit(1);
}
console.log(`Token validation passed: ${source.tokens.length} unique tokens.`);

