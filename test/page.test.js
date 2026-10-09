import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const plain = (fragment) => fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// Google wants FAQPage data to repeat the visible text, so the two must not drift apart.
test("the FAQ structured data repeats the questions and answers shown on the page", () => {
  const shown = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map(([, question, answer]) => [plain(question), plain(answer)]);
  const faq = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json))
    .find((data) => data["@type"] === "FAQPage");
  assert.deepEqual(faq?.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), shown);
});
