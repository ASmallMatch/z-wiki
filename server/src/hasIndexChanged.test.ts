import { test } from "node:test";
import assert from "node:assert/strict";
import { hasIndexChanged } from "./hasIndexChanged.js";

const m = (entries: [string, string][]): Map<string, string> => new Map(entries);

test("null old → changed (首次构建)", () => {
  assert.equal(hasIndexChanged(null, m([["a", "x"]])), true);
});

test("同 size 同内容 → 未变", () => {
  assert.equal(
    hasIndexChanged(m([["a", "x"], ["b", "y"]]), m([["a", "x"], ["b", "y"]])),
    false
  );
});

test("size 不同 → 变", () => {
  assert.equal(hasIndexChanged(m([["a", "x"]]), m([["a", "x"], ["b", "y"]])), true);
});

test("某项内容变 → 变", () => {
  assert.equal(
    hasIndexChanged(m([["a", "x"]]), m([["a", "x2"]])),
    true
  );
});

test("key 替换 size 同 → 变", () => {
  assert.equal(
    hasIndexChanged(m([["a", "x"]]), m([["b", "x"]])),
    true
  );
});
