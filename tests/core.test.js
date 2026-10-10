const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = {};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/core.js"), "utf8"), context, { filename: "src/core.js" });
const CFSS = context.CFSS;

function createDoc() {
  const doc = {
    createElement(tag) {
      return make(tag);
    }
  };
  function make(tag) {
    const el = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      className: "",
      classList: null,
      childNodes: [],
      children: [],
      parentNode: null,
      textContent: "",
      ownerDocument: doc,
      hidden: false,
      inert: false,
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === "hidden") this.hidden = true;
      },
      removeAttribute(name) {
        delete this.attributes[name];
        if (name === "hidden") this.hidden = false;
      },
      appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        sync(this);
        return child;
      },
      insertBefore(child, ref) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        const index = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
        this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child);
        sync(this);
        return child;
      },
      removeChild(child) {
        this.childNodes = this.childNodes.filter((node) => node !== child);
        if (child.parentNode === this) child.parentNode = null;
        sync(this);
        return child;
      }
    };
    return el;
  }
  function sync(el) {
    el.children = el.childNodes.filter((node) => node.nodeType === 1);
    el.textContent = el.childNodes.map((node) => node.textContent || "").join("");
  }
  return { doc, make, sync };
}

function articleWith(children) {
  const { doc, make } = createDoc();
  const root = make("div");
  children.forEach((child) => root.appendChild(child));
  return root;
}

test("groups paragraphs, lists, equations, tables, and figures without splitting them", () => {
  const { make } = createDoc();
  const paragraph = make("p");
  paragraph.textContent = "Use covered for the reach.";
  const code = make("code");
  code.textContent = "covered";
  paragraph.appendChild(code);
  const list = make("ul");
  const item = make("li");
  item.textContent = "Sort the poles.";
  list.appendChild(item);
  const equation = make("div");
  equation.className = "equation";
  equation.textContent = "covered = position + radius";
  const table = make("table");
  const cell = make("td");
  cell.textContent = "Open";
  table.appendChild(cell);
  const figure = make("figure");
  const svg = make("svg");
  svg.textContent = "diagram";
  figure.appendChild(svg);
  const blocks = CFSS.collectBlocks(articleWith([paragraph, list, equation, table, figure]));
  assert.equal(blocks.length, 5);
  assert.equal(blocks.map((block) => block.tag).join(","), "P,UL,DIV,TABLE,FIGURE");
  assert.equal(blocks.every((block) => block.kind === "explanation"), true);
  assert.equal(blocks[2].textLength > 0, true);
});

test("treats standalone code as code and leaves inline code inside the paragraph", () => {
  const { make } = createDoc();
  const paragraph = make("p");
  paragraph.textContent = "Call dp[i] here, then stop.";
  const inline = make("code");
  inline.textContent = "dp[i]";
  paragraph.appendChild(inline);
  const pre = make("pre");
  pre.textContent = "function solve() { return 1; }";
  const wrap = make("div");
  const inner = make("pre");
  inner.textContent = "return 2;";
  wrap.appendChild(inner);
  const blocks = CFSS.collectBlocks(articleWith([paragraph, pre, wrap]));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].kind, "explanation");
  assert.equal(blocks[1].kind, "code");
  assert.equal(blocks[2].kind, "code");
});

test("keeps a native spoiler and its nested paragraphs as one block", () => {
  const { make } = createDoc();
  const spoiler = make("div");
  spoiler.className = "spoiler";
  const title = make("div");
  title.className = "spoiler-title";
  title.textContent = "Worked example";
  const content = make("div");
  content.className = "spoiler-content";
  const inner = make("p");
  inner.textContent = "The next open departure is 8.";
  const hiddenCode = make("pre");
  hiddenCode.textContent = "next = 8;";
  content.appendChild(inner);
  content.appendChild(hiddenCode);
  spoiler.appendChild(title);
  spoiler.appendChild(content);
  const blocks = CFSS.collectBlocks(articleWith([spoiler]));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "explanation");
  assert.equal(blocks[0].tag, "DIV");
});

test("splits suggested sections on problem headings and leaves unlabeled notes out", () => {
  const { make } = createDoc();
  const intro = make("p");
  intro.textContent = "Welcome to the round.";
  const first = make("h2");
  first.textContent = "A. Lantern Count";
  const body = make("p");
  body.textContent = "Count the dark poles after placing lanterns from the left.";
  const second = make("h2");
  second.textContent = "B. Ferry Schedule";
  const more = make("p");
  more.textContent = "Find the next open boat without scanning every minute of the day.";
  const code = make("pre");
  code.textContent = "function nextFerry() { return 8; }";
  const note = make("p");
  note.textContent = "Implementation notes";
  const tail = make("p");
  tail.textContent = "Keep the two solutions in separate functions so the samples stay clear.";
  const blocks = CFSS.collectBlocks(articleWith([intro, first, body, second, more, code, note, tail]));
  const sections = CFSS.suggestSections(blocks);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].title, "A. Lantern Count");
  assert.equal(sections[0].explanationCount, 1);
  assert.equal(sections[1].codeCount, 1);
  assert.equal(sections[1].explanationCount, 3);
});

test("reveal and hide move only explanation progress and keep code hidden", () => {
  const blocks = [
    { kind: "explanation" },
    { kind: "code" },
    { kind: "explanation" }
  ];
  let progress = CFSS.createProgress(CFSS.countKinds(blocks).explanation, null);
  assert.equal(progress.revealed, 0);
  progress = CFSS.revealNext(progress);
  progress = CFSS.revealNext(progress);
  assert.equal(progress.revealed, 2);
  assert.equal(progress.codeRevealed, false);
  progress = CFSS.hideLast(progress);
  assert.equal(progress.revealed, 1);
  assert.equal(progress.highWater, 2);
  progress = CFSS.revealNext(progress);
  assert.equal(progress.highWater, 2);
  progress = CFSS.setCodeRevealed(progress, true);
  assert.equal(progress.codeRevealed, true);
  assert.equal(progress.revealed, 2);
});

test("repeated reveal and hide does not inflate the distinct explanation count", () => {
  let progress = CFSS.createProgress(3, null);
  progress = CFSS.revealNext(progress);
  progress = CFSS.hideLast(progress);
  progress = CFSS.revealNext(progress);
  progress = CFSS.hideLast(progress);
  progress = CFSS.revealNext(progress);
  assert.equal(progress.highWater, 1);
  assert.equal(progress.revealed, 1);
});

test("stores independent progress for two sections on one editorial", () => {
  let state = CFSS.normalizeState(null);
  const url = CFSS.normalizeUrl("https://codeforces.com/blog/entry/15?utm_source=x#comment");
  state = CFSS.upsertEntry(state, url, {
    id: "a", title: "A. Lantern Count", anchorTitle: "A. Lantern Count", fingerprint: "e:p:s:0",
    revealed: 1, codeRevealed: false, highWater: 2, updatedAt: 10
  });
  state = CFSS.upsertEntry(state, url, {
    id: "b", title: "B. Ferry Schedule", anchorTitle: "B. Ferry Schedule", fingerprint: "e:p:m:0",
    revealed: 4, codeRevealed: true, highWater: 4, updatedAt: 11
  });
  assert.equal(state.entries[url].a.revealed, 1);
  assert.equal(state.entries[url].a.highWater, 2);
  assert.equal(state.entries[url].b.revealed, 4);
  assert.equal(state.entries[url].b.codeRevealed, true);
  assert.equal(url, "https://codeforces.com/blog/entry/15");
});

test("matches a saved section only when the structural fingerprint still fits", () => {
  const { make } = createDoc();
  const heading = make("h2");
  heading.textContent = "A. Lantern Count";
  const body = make("p");
  body.textContent = "Count the dark poles after placing lanterns from the left.";
  const blocks = CFSS.collectBlocks(articleWith([heading, body]));
  const section = CFSS.suggestSections(blocks)[0];
  const matched = CFSS.findMatch(blocks, section);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].node, body);

  body.textContent = "A completely different explanation. ".repeat(40);
  const changed = CFSS.collectBlocks(articleWith([heading, body]));
  assert.equal(CFSS.findMatch(changed, section), null);
});

test("manual selection rejects a heading-only range and accepts a custom range", () => {
  const { make } = createDoc();
  const note = make("p");
  note.textContent = "Implementation notes";
  const body = make("p");
  body.textContent = "Keep the sweep and the ferry formula apart.";
  const code = make("pre");
  code.textContent = "function checkSamples() { return true; }";
  const blocks = CFSS.collectBlocks(articleWith([note, body, code]));
  assert.equal(CFSS.buildManualSection(blocks, 0, 0).section.blocks.length, 1);
  const selected = CFSS.buildManualSection(blocks, 1, 2).section;
  assert.equal(selected.explanationCount, 1);
  assert.equal(selected.codeCount, 1);
  assert.equal(selected.anchorTitle, "");
  assert.equal(CFSS.buildManualSection(blocks, -1, 1).error.includes("outside"), true);
});

test("removing a shield restores the original nodes in order", () => {
  const { make } = createDoc();
  const first = make("p");
  first.textContent = "First explanation stays intact.";
  const second = make("pre");
  second.textContent = "function solve(){return 1}";
  const root = articleWith([first, second]);
  const blocks = CFSS.collectBlocks(root);
  const slots = CFSS.shieldBlocks(blocks);
  const progress = CFSS.setCodeRevealed(CFSS.revealNext(CFSS.createProgress(1, null)), false);
  CFSS.applyVisibility(slots, progress);
  assert.equal(slots[0].content.hidden, false);
  assert.equal(slots[1].content.hidden, true);
  assert.equal(slots[1].content.inert, true);
  assert.equal(slots[1].placeholder.textContent, "Hidden code");
  assert.equal(slots[1].placeholder.textContent.includes("function"), false);
  CFSS.unshield(slots);
  assert.deepEqual(root.children.map((node) => node.tagName), ["P", "PRE"]);
  assert.equal(root.children[0].textContent, "First explanation stays intact.");
  assert.equal(root.children[1].textContent, "function solve(){return 1}");
  assert.equal(root.textContent.includes("cfss"), false);
});
