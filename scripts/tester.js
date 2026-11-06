// npm test : construit le site deux fois, puis lance tous les tests.
//   _site  : avec les vrais contenus (src/_data), comme en ligne : il doit se construire et ses liens être valides ;
//   _test  : avec des contenus figés (tests/donnees, état du 6 novembre 2026), comparés aux pages de tests/reference.
// Ainsi, les modifications faites par Belle dans l'admin ne font pas échouer les tests de mise en page.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const eleventy = path.join("node_modules", "@11ty", "eleventy", "cmd.cjs");
const lancer = (args, env = {}) => {
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status || 1);
};

lancer([eleventy, "--quiet"]);
lancer([eleventy, "--quiet"], { CB_DONNEES: "tests/donnees", CB_SORTIE: "_test" });
const fichiers = fs.readdirSync("tests").filter(f => f.endsWith(".test.js")).map(f => path.join("tests", f));
lancer(["--test", ...fichiers]);
