// Estimation du prix (src/assets/reservation.js) à partir des tarifs réels (src/_data/tarifs.json)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "../src/assets/reservation.js";

const { estimer, semainesFixes } = globalThis.ChezBelleEstimation;
const D = JSON.parse(fs.readFileSync("src/_data/tarifs.json", "utf8"));

test("mai calme : 3 nuits à 80 €", () => {
  const r = estimer(D, "2027-05-20", "2027-05-23", false);
  assert.equal(r.nights, 3); assert.equal(r.total, 240); assert.equal(r.warn, "");
});
test("pont de l'Ascension sous le minimum : avertissement", () => {
  const r = estimer(D, "2027-05-06", "2027-05-08", false);
  assert.equal(r.total, 190); assert.match(r.warn, /Pont de mai.*3 nuits/);
});
test("séjour à cheval sur deux périodes : deux lignes", () => {
  const r = estimer(D, "2027-07-04", "2027-07-11", false);
  assert.equal(r.total, 3 * 105 + 4 * 115);
  assert.deepEqual(r.lines, ["Début juillet : 3 × 105 €", "Cœur de l’été : 4 × 115 €"]);
});
test("cœur de l'été : 7 nuits = 805 €, moins de 7 nuits averti", () => {
  assert.equal(estimer(D, "2027-07-10", "2027-07-17", false).total, 805);
  assert.match(estimer(D, "2027-07-10", "2027-07-14", false).warn, /7 nuits/);
});
test("chien : 15 € jusqu'à 3 nuits, 25 € au-delà", () => {
  assert.equal(estimer(D, "2027-05-20", "2027-05-23", true).total, 240 + 15);
  assert.equal(estimer(D, "2027-05-20", "2027-05-24", true).total, 320 + 25);
});
test("Noël : semaine imposée", () => {
  assert.equal(estimer(D, "2027-12-18", "2027-12-25", false).warn, "");
  const r = estimer(D, "2027-12-25", "2028-01-01", false);
  assert.equal(r.warn, ""); assert.equal(r.total, 7 * 85);
});
test("Noël : arrivée hors des samedis prévus, message d'origine", () => {
  const r = estimer(D, "2027-12-19", "2027-12-26", false);
  assert.equal(r.warn, "À Noël, le séjour dure une semaine : du 18 au 25 décembre ou du 25 décembre au 1er janvier.");
});
test("dates hors périodes", () => {
  const r = estimer(D, "2027-10-10", "2027-10-12", false);
  assert.equal(r.out, true); assert.match(r.warn, /sort des périodes/);
});
test("départ avant arrivée / dates manquantes", () => {
  assert.match(estimer(D, "2027-05-20", "2027-05-20", false).warn, /doit suivre/);
  assert.match(estimer(D, "", "2027-05-20", false).warn, /Indiquez/);
});
test("semainesFixes", () => assert.equal(semainesFixes(["2027-12-18", "2027-12-25"], 7), "du 18 au 25 décembre ou du 25 décembre au 1er janvier"));
