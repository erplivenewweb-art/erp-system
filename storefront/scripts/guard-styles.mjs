import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

const violations = [];
for (const file of filesUnder(source)) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  if (file.endsWith(".css") && !file.endsWith("tokens.generated.css")) {
    if (/#[0-9a-f]{3,8}\b/i.test(content)) violations.push(`${relative}: hard-coded color`);
    if (/!important/.test(content) && !file.endsWith("globals.css")) violations.push(`${relative}: !important`);
  }
  if (/\.(tsx?|jsx?)$/.test(file)) {
    if (/dangerouslySetInnerHTML/.test(content)) violations.push(`${relative}: unsafe HTML API`);
    if (/style=\{\{/.test(content)) violations.push(`${relative}: inline style object`);
  }
}

if (violations.length) {
  violations.forEach((item) => console.error(`STYLE ERROR: ${item}`));
  process.exit(1);
}
console.log("Style validation passed: no hard-coded component colors, unsafe HTML, or inline style objects.");
