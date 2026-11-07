import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const MAX_GZIP_BYTES = 2048;

const root = fileURLToPath(new URL("..", import.meta.url));
mkdirSync(`${root}dist`, { recursive: true });

await build({
  entryPoints: [`${root}src/snippet.js`],
  outfile: `${root}dist/cp.js`,
  minify: true,
  target: "es2017",
  charset: "ascii",
  legalComments: "none",
});

const output = readFileSync(`${root}dist/cp.js`);
const gzipped = gzipSync(output, { level: 9 }).length;
console.log(
  `snippet: ${output.length} bytes minified, ${gzipped} bytes gzipped (budget ${MAX_GZIP_BYTES})`,
);

if (gzipped > MAX_GZIP_BYTES) {
  console.error(`snippet is over the ${MAX_GZIP_BYTES} byte gzip budget`);
  process.exit(1);
}
