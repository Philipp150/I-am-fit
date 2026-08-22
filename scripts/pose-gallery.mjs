/**
 * Renders every authored pose as its own SVG so a human can check that the drawing matches the
 * name. Development tool: `node scripts/pose-gallery.mjs out/pose-gallery.html`, then screenshot.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const outPath = resolve(process.argv[2] ?? "out/pose-gallery.html");
const only = process.argv[3] ? process.argv[3].split(",") : null;
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
// Inside the project so the bundle can resolve react-dom from node_modules.
const work = join(root, ".pose-gallery");
mkdirSync(work, { recursive: true });

const entry = join(work, "entry.tsx");
writeFileSync(
  entry,
  `import { renderToStaticMarkup } from "react-dom/server";
import { StickFigure } from "@/components/StickFigure";
import { POSE_IDS, POSE_LABELS } from "@/lib/poses";
export function gallery(only) {
  const ids = only ? POSE_IDS.filter((id) => only.includes(id)) : POSE_IDS;
  return ids.map((id) => ({
    id,
    label: POSE_LABELS[id],
    svg: renderToStaticMarkup(<StickFigure pose={id} className="figure" />),
  }));
}
`,
);

const bundle = join(work, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  outfile: bundle,
  external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
  absWorkingDir: root,
  alias: { "@": join(root, "src") },
  logLevel: "warning",
});

const { gallery } = await import(pathToFileURL(bundle).href);
const items = gallery(only);

const cells = items
  .map(
    (item) => `    <figure class="cell">
      ${item.svg}
      <figcaption><b>${item.label}</b><span>${item.id}</span></figcaption>
    </figure>`,
  )
  .join("\n");

writeFileSync(
  outPath,
  `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Posen</title>
<style>
  body { margin: 0; background: #FAF6EF; font: 13px/1.3 system-ui, sans-serif; color: #1F3F37; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; padding: 10px; }
  .cell { margin: 0; background: #fff; border-radius: 10px; padding: 4px; text-align: center; }
  .figure { width: 100%; height: 120px; display: block; }
  figcaption { display: flex; flex-direction: column; }
  figcaption span { color: #6B8377; font-size: 11px; }
</style></head>
<body><div class="grid">
${cells}
</div></body></html>
`,
);
mkdirSync(dirname(outPath), { recursive: true });
rmSync(work, { recursive: true, force: true });
console.log(`${items.length} poses -> ${outPath}`);
