// L'admin ouvert depuis un aperçu Cloudflare (brouillon.…pages.dev) renvoie vers l'admin de l'adresse principale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/admin/_middleware.js";

const suivant = () => new Response("admin");

test("aperçu du brouillon : redirection vers l'admin principal", async () => {
  const r = await onRequest({ request: new Request("https://brouillon.chez-belle-pontaillac.pages.dev/admin/#photos"), next: suivant });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("Location"), "https://chez-belle-pontaillac.pages.dev/admin/#photos");
});

test("adresse principale ou locale : admin servi normalement", async () => {
  for (const u of ["https://chez-belle-pontaillac.pages.dev/admin/", "http://localhost:8765/admin/", "https://chezbelle-pontaillac.fr/admin/"]) {
    const r = await onRequest({ request: new Request(u), next: suivant });
    assert.equal(await r.text(), "admin", u);
  }
});
