import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  isRawPath,
  isWritablePath,
  kbRoot,
  rawDir,
  wikiDir,
} from "./kbLayout.js";

const ROOT = "/proj";

test("isRawPath: raw/ 下文件 → true", () => {
  assert.equal(isRawPath(path.join(rawDir(ROOT), "x.md"), ROOT), true);
});

test("isRawPath: raw/ 子目录 → true(全层只读)", () => {
  assert.equal(isRawPath(path.join(rawDir(ROOT), "sub", "y.md"), ROOT), true);
});

test("isRawPath: raw.txt(根级同名伪匹配)→ false", () => {
  assert.equal(isRawPath(path.join(ROOT, "raw.txt"), ROOT), false);
});

test("isRawPath: wiki/raw-x.md(伪 raw 前缀)→ false", () => {
  assert.equal(isRawPath(path.join(wikiDir(ROOT), "raw-x.md"), ROOT), false);
});

test("isRawPath: wiki/ 下 → false", () => {
  assert.equal(isRawPath(path.join(wikiDir(ROOT), "01-主题.md"), ROOT), false);
});

test("isRawPath: kb/ 外(server 文件)→ false", () => {
  assert.equal(isRawPath(path.join(ROOT, "server", "src", "x.ts"), ROOT), false);
});

test("isWritablePath: raw/ 下 → false(只读)", () => {
  assert.equal(isWritablePath(path.join(rawDir(ROOT), "x.md"), ROOT), false);
});

test("isWritablePath: wiki/ 下 → true", () => {
  assert.equal(isWritablePath(path.join(wikiDir(ROOT), "01-主题.md"), ROOT), true);
});

test("isWritablePath: output/ 下 → true", () => {
  assert.equal(isWritablePath(path.join(kbRoot(ROOT), "output", "r.md"), ROOT), true);
});

test("isWritablePath: index.md / log.md → true", () => {
  assert.equal(isWritablePath(path.join(kbRoot(ROOT), "index.md"), ROOT), true);
  assert.equal(isWritablePath(path.join(kbRoot(ROOT), "log.md"), ROOT), true);
});

test("isWritablePath: kb/ 外(server/web)→ false(非 layer1)", () => {
  assert.equal(isWritablePath(path.join(ROOT, "server", "x.ts"), ROOT), false);
});
