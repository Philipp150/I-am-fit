/**
 * Prints where each pose puts head, hands and feet, and flags poses that leave the drawing area or
 * cross their own legs. Development tool alongside `pose-gallery.mjs`.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const only = process.argv[2] ? process.argv[2].split(",") : null;
const work = join(root, ".pose-gallery");
mkdirSync(work, { recursive: true });

const entry = join(work, "check.ts");
writeFileSync(
  entry,
  `export { POSES, POSE_IDS, POSE_LABELS } from "@/lib/poses";
export { figurePoints, figureBounds, fitsViewBox, VIEW_BOX } from "@/lib/pose-geometry";
`,
);
const bundle = join(work, "check.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  absWorkingDir: root,
  alias: { "@": join(root, "src") },
  logLevel: "warning",
});

const mod = await import(pathToFileURL(bundle).href);
const { POSES, POSE_IDS, POSE_LABELS, figurePoints, figureBounds, fitsViewBox, VIEW_BOX } = mod;
const ids = only ? POSE_IDS.filter((id) => only.includes(id)) : POSE_IDS;
const r = (n) => Math.round(n);

let problems = 0;
for (const id of ids) {
  const pose = POSES[id];
  const p = figurePoints(pose);
  const b = figureBounds(pose);
  const flags = [];
  if (!fitsViewBox(pose)) {
    flags.push(
      `OUTSIDE x[${r(b.minX)},${r(b.maxX)}] y[${r(b.minY)},${r(b.maxY)}] box x[${VIEW_BOX.x},${VIEW_BOX.x + VIEW_BOX.width}] y[${VIEW_BOX.y},${VIEW_BOX.y + VIEW_BOX.height}]`,
    );
  }
  // Sides overlap on purpose once the figure is turned into a profile.
  const front = Math.abs(pose.bodyTilt) < 30;
  if (front && p.leftFoot.x > p.rightFoot.x + 6) flags.push("FEET CROSSED");
  if (front && p.leftHand.x > p.rightHand.x + 40) flags.push("HANDS CROSSED");
  if (flags.length) problems += 1;
  console.log(
    [
      id.padEnd(16),
      POSE_LABELS[id].padEnd(24),
      `head(${r(p.head.x)},${r(p.head.y)})`.padEnd(16),
      `hands L(${r(p.leftHand.x)},${r(p.leftHand.y)}) R(${r(p.rightHand.x)},${r(p.rightHand.y)})`.padEnd(34),
      `feet L(${r(p.leftFoot.x)},${r(p.leftFoot.y)}) R(${r(p.rightFoot.x)},${r(p.rightFoot.y)})`.padEnd(32),
      flags.join(" "),
    ].join(" "),
  );
}
rmSync(work, { recursive: true, force: true });
console.log(`\n${ids.length} poses, ${problems} flagged`);
