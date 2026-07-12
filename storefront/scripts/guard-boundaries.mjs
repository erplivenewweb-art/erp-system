import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const forbidden = [
  "/internal/v1/",
  "/getStock",
  "/saveBilling",
  "/addStock",
  "/updateStock",
  "/deleteStock",
  "erp_auth_token",
  "MYSQLPASSWORD",
  "MYSQL_URL",
];

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const scanned = filesUnder(sourceRoot).filter(
  (file) =>
    /\.(ts|tsx|css|json)$/.test(file) &&
    !file.includes(`${path.sep}test${path.sep}`),
);
const violations = [];
for (const file of scanned) {
  const content = fs.readFileSync(file, "utf8");
  for (const term of forbidden) {
    if (content.includes(term)) violations.push(`${path.relative(root, file)} contains forbidden term ${term}`);
  }
}
if (violations.length) {
  violations.forEach((item) => console.error(`BOUNDARY ERROR: ${item}`));
  process.exit(1);
}
console.log(`Boundary validation passed across ${scanned.length} storefront source files.`);
