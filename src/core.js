(function (root) {
  "use strict";

  var STATE_KEY = "cfss-state-v1";
  var SESSION_KEY = "cfss-fast-v1";
  var ATOMIC_TAGS = {
    P: 1, PRE: 1, UL: 1, OL: 1, TABLE: 1, BLOCKQUOTE: 1, FIGURE: 1,
    IMG: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, HR: 1, DL: 1, DETAILS: 1
  };
  var INLINE_TAGS = {
    SPAN: 1, A: 1, B: 1, I: 1, EM: 1, STRONG: 1, CODE: 1, IMG: 1, BR: 1,
    SUB: 1, SUP: 1, SMALL: 1, MARK: 1, U: 1, S: 1, ABBR: 1, KBD: 1, VAR: 1,
    WBR: 1, FONT: 1, BDO: 1, CITE: 1, Q: 1, TIME: 1, TT: 1
  };
  var CONTAINER_TAGS = { DIV: 1, SECTION: 1, ARTICLE: 1, CENTER: 1, MAIN: 1, FONT: 1 };

  function classTokens(el) {
    if (!el) return [];
    if (el.classList && typeof el.classList[Symbol.iterator] === "function") {
      return Array.prototype.slice.call(el.classList);
    }
    var raw = "";
    if (typeof el.className === "string") raw = el.className;
    else if (el.className && typeof el.className.baseVal === "string") raw = el.className.baseVal;
    return raw.split(/\s+/).filter(Boolean);
  }

  function hasClass(el, name) {
    return classTokens(el).indexOf(name) !== -1;
  }

  function isExtensionNode(el) {
    return hasClass(el, "cfss-slot") || hasClass(el, "cfss-host") || hasClass(el, "cfss-placeholder") || hasClass(el, "cfss-content");
  }

  function isSpoiler(el) {
    return hasClass(el, "spoiler");
  }

  function isCodeBlock(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === "PRE") return true;
    if (tag === "CODE" || tag === "SPAN") return false;
    if (tag === "TEXTAREA" && (hasClass(el, "prettyprint") || hasClass(el, "source"))) return true;
    var tokens = classTokens(el);
    var known = { prettyprint: 1, highlight: 1, hljs: 1, "code-block": 1, "program-source": 1 };
    for (var i = 0; i < tokens.length; i++) {
      if (known[tokens[i]]) return true;
    }
    var kids = elementChildren(el);
    if ((tag === "DIV" || tag === "FIGURE") && kids.length === 1 && kids[0].tagName === "PRE") {
      var leftover = (el.textContent || "").replace(kids[0].textContent || "", "").trim();
      if (!leftover) return true;
    }
    return false;
  }

  function isDisplayMath(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === "SPAN" || tag === "CODE" || tag === "P") return false;
    if (hasClass(el, "equation") || hasClass(el, "katex-display") || hasClass(el, "tex-display")) return true;
    if (tag === "DIV" && (hasClass(el, "MathJax") || hasClass(el, "math"))) return true;
    return false;
  }

  function isInlineTag(el) {
    return !!(el && el.nodeType === 1 && INLINE_TAGS[el.tagName] && !isCodeBlock(el) && !isSpoiler(el));
  }

  function elementChildren(el) {
    if (!el) return [];
    if (el.children) return Array.prototype.slice.call(el.children);
    return (el.childNodes || []).filter(function (node) { return node.nodeType === 1; });
  }

  function plainText(el) {
    return (el && el.textContent ? el.textContent : "").replace(/\s+/g, " ").trim();
  }

  function containsMedia(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === "IMG" || tag === "SVG" || tag === "VIDEO" || tag === "CANVAS" || tag === "PICTURE" || tag === "TABLE") return true;
    var kids = elementChildren(el);
    for (var i = 0; i < kids.length; i++) {
      if (containsMedia(kids[i])) return true;
    }
    return false;
  }

  function isHeading(el) {
    if (!el || el.nodeType !== 1 || isCodeBlock(el) || isSpoiler(el)) return false;
    if (/^H[1-4]$/.test(el.tagName)) {
      return plainText(el).length > 0;
    }
    if (el.tagName !== "P" && !CONTAINER_TAGS[el.tagName]) return false;
    var kids = elementChildren(el);
    for (var i = 0; i < kids.length; i++) {
      if (!isInlineTag(kids[i]) && kids[i].tagName !== "BR") return false;
    }
    var text = plainText(el);
    if (text.length < 2 || text.length > 110) return false;
    return /^(?:problem\s+)?(?:[A-H]|[A-H]\d|\d{2,4}[A-H]\d?)\b\s*[:.\-–—]/i.test(text);
  }

  function isPlainContainer(el) {
    return !!(el && CONTAINER_TAGS[el.tagName] && !isSpoiler(el) && !isCodeBlock(el) && !isDisplayMath(el) && !isExtensionNode(el));
  }

  function shouldDescend(el) {
    if (!isPlainContainer(el) || isHeading(el)) return false;
    var kids = elementChildren(el).filter(function (child) { return !isExtensionNode(child); });
    if (!kids.length) return false;
    for (var i = 0; i < kids.length; i++) {
      if (!isInlineTag(kids[i])) return true;
    }
    return false;
  }

  function describe(el, forcedKind) {
    var text = plainText(el);
    var kind = isCodeBlock(el) ? "code" : (forcedKind || "explanation");
    return {
      node: el,
      kind: kind,
      tag: el.tagName || "DIV",
      textLength: text.length,
      heading: kind === "code" ? false : isHeading(el),
      title: kind === "code" ? "" : (isHeading(el) ? text : ""),
      hasMedia: containsMedia(el)
    };
  }

  function isMeaningful(block) {
    if (!block) return false;
    if (block.kind === "code") return true;
    if (block.heading) return true;
    if (block.hasMedia) return true;
    if (block.tag === "HR") return false;
    return block.textLength > 0;
  }

  function collectBlocks(root) {
    var blocks = [];
    function visit(el) {
      if (!el || el.nodeType !== 1 || isExtensionNode(el)) return;
      if (isCodeBlock(el)) {
        blocks.push(describe(el, "code"));
        return;
      }
      if (isSpoiler(el) || isDisplayMath(el) || ATOMIC_TAGS[el.tagName] || isHeading(el) || !shouldDescend(el)) {
        blocks.push(describe(el, "explanation"));
        return;
      }
      var kids = elementChildren(el);
      for (var i = 0; i < kids.length; i++) visit(kids[i]);
    }
    var top = elementChildren(root);
    for (var i = 0; i < top.length; i++) visit(top[i]);
    return blocks.filter(isMeaningful);
  }

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  }

  function hashString(value) {
    var h = 2166136261;
    var str = String(value);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function lengthBucket(length) {
    if (length < 40) return "s";
    if (length < 160) return "m";
    if (length < 500) return "l";
    return "x";
  }

  function fingerprint(blocks) {
    return blocks.map(function (block) {
      return (block.kind === "code" ? "c" : "e") + ":" + String(block.tag || "x").toLowerCase() + ":" + lengthBucket(block.textLength || 0) + ":" + (block.hasMedia ? "1" : "0");
    }).join("|");
  }

  function sectionId(anchorTitle, fp) {
    return hashString((anchorTitle || "") + "|" + fp);
  }

  function countKinds(blocks) {
    var explanation = 0;
    var code = 0;
    blocks.forEach(function (block) {
      if (block.kind === "code") code += 1;
      else explanation += 1;
    });
    return { explanation: explanation, code: code };
  }

  function suggestSections(blocks) {
    var sections = [];
    var current = null;
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.heading) {
        if (current && current.blocks.length) sections.push(finalizeSection(current));
        current = { title: block.title, anchorTitle: block.title, blocks: [] };
        continue;
      }
      if (current) current.blocks.push(block);
    }
    if (current && current.blocks.length) sections.push(finalizeSection(current));
    return sections;
  }

  function finalizeSection(section) {
    var fp = fingerprint(section.blocks);
    var counts = countKinds(section.blocks);
    return {
      id: sectionId(section.anchorTitle, fp),
      title: section.title,
      anchorTitle: section.anchorTitle,
      blocks: section.blocks,
      fingerprint: fp,
      explanationCount: counts.explanation,
      codeCount: counts.code
    };
  }

  function buildManualSection(allBlocks, start, end) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      return { error: "Choose a start block and an end block inside the article." };
    }
    if (start < 0 || end < 0 || start >= allBlocks.length || end >= allBlocks.length) {
      return { error: "That selection is outside the editorial article." };
    }
    var lo = Math.min(start, end);
    var hi = Math.max(start, end);
    var blocks = allBlocks.slice(lo, hi + 1);
    var anchorTitle = "";
    var title = "Custom selection";
    if (blocks[0] && blocks[0].heading) {
      title = blocks[0].title;
      anchorTitle = blocks[0].title;
      blocks = blocks.slice(1);
    } else {
      for (var i = lo - 1; i >= 0; i--) {
        if (allBlocks[i].heading) {
          title = allBlocks[i].title;
          anchorTitle = allBlocks[i].title;
          break;
        }
      }
    }
    if (!blocks.length) return { error: "Select the paragraphs under a heading, not the heading alone." };
    return { section: finalizeSection({ title: title, anchorTitle: anchorTitle, blocks: blocks }) };
  }

  function findMatch(blocks, saved) {
    if (!saved || !saved.fingerprint) return null;
    var parts = String(saved.fingerprint).split("|").filter(Boolean);
    var width = parts.length;
    if (!width || width > blocks.length) return null;
    var hits = [];
    for (var i = 0; i <= blocks.length - width; i++) {
      var slice = blocks.slice(i, i + width);
      if (fingerprint(slice) !== saved.fingerprint) continue;
      var prev = blocks[i - 1];
      var anchorOk = !saved.anchorTitle || !!(prev && prev.heading && prev.title === saved.anchorTitle);
      hits.push({ slice: slice, anchorOk: anchorOk });
    }
    var pool = saved.anchorTitle ? hits.filter(function (hit) { return hit.anchorOk; }) : hits;
    if (pool.length === 1) return pool[0].slice;
    return null;
  }

  function createProgress(explanationCount, saved) {
    var revealed = saved && Number.isInteger(saved.revealed) ? saved.revealed : 0;
    var highWater = saved && Number.isInteger(saved.highWater) ? saved.highWater : revealed;
    revealed = clamp(revealed, 0, explanationCount);
    highWater = clamp(Math.max(highWater, revealed), 0, explanationCount);
    return {
      revealed: revealed,
      codeRevealed: !!(saved && saved.codeRevealed),
      highWater: highWater,
      explanationCount: explanationCount
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function revealNext(progress) {
    if (progress.revealed >= progress.explanationCount) return progress;
    var revealed = progress.revealed + 1;
    return {
      revealed: revealed,
      codeRevealed: progress.codeRevealed,
      highWater: Math.max(progress.highWater, revealed),
      explanationCount: progress.explanationCount
    };
  }

  function hideLast(progress) {
    if (progress.revealed <= 0) return progress;
    return {
      revealed: progress.revealed - 1,
      codeRevealed: progress.codeRevealed,
      highWater: progress.highWater,
      explanationCount: progress.explanationCount
    };
  }

  function revealAll(progress) {
    return {
      revealed: progress.explanationCount,
      codeRevealed: true,
      highWater: progress.explanationCount,
      explanationCount: progress.explanationCount
    };
  }

  function setCodeRevealed(progress, shown) {
    return {
      revealed: progress.revealed,
      codeRevealed: !!shown,
      highWater: progress.highWater,
      explanationCount: progress.explanationCount
    };
  }

  function resetProgress(progress) {
    return {
      revealed: 0,
      codeRevealed: false,
      highWater: 0,
      explanationCount: progress.explanationCount
    };
  }

  function normalizeUrl(href) {
    try {
      var url = new URL(String(href), "https://codeforces.com");
      if (url.protocol === "file:") {
        return url.origin + url.pathname;
      }
      var host = url.hostname.replace(/^www\./, "").replace(/^m\d+\./, "");
      var path = url.pathname.replace(/\/+$/, "") || "/";
      return url.protocol + "//" + host + path;
    } catch (err) {
      return String(href || "").split("#")[0].split("?")[0];
    }
  }

  function normalizeState(raw) {
    var state = raw && typeof raw === "object" ? raw : {};
    var entries = state.entries && typeof state.entries === "object" ? state.entries : {};
    return {
      autoRestore: state.autoRestore !== false,
      entries: entries
    };
  }

  function upsertEntry(state, url, record) {
    var next = normalizeState(state);
    var bucket = Object.assign({}, next.entries[url] || {});
    bucket[record.id] = {
      id: record.id,
      title: record.title,
      anchorTitle: record.anchorTitle || "",
      fingerprint: record.fingerprint,
      revealed: record.revealed,
      codeRevealed: !!record.codeRevealed,
      highWater: record.highWater,
      updatedAt: record.updatedAt || Date.now()
    };
    var entries = Object.assign({}, next.entries);
    entries[url] = bucket;
    return pruneState({ autoRestore: next.autoRestore, entries: entries });
  }

  function removeEntry(state, url, id) {
    var next = normalizeState(state);
    if (!next.entries[url] || !next.entries[url][id]) return next;
    var bucket = Object.assign({}, next.entries[url]);
    delete bucket[id];
    var entries = Object.assign({}, next.entries);
    if (Object.keys(bucket).length) entries[url] = bucket;
    else delete entries[url];
    return { autoRestore: next.autoRestore, entries: entries };
  }

  function pruneState(state) {
    var urls = Object.keys(state.entries);
    if (urls.length <= 40) return state;
    var ranked = urls.map(function (url) {
      var records = Object.keys(state.entries[url]).map(function (id) { return state.entries[url][id]; });
      var latest = records.reduce(function (max, record) { return Math.max(max, record.updatedAt || 0); }, 0);
      return { url: url, latest: latest };
    }).sort(function (a, b) { return b.latest - a.latest; });
    var entries = {};
    ranked.slice(0, 40).forEach(function (item) { entries[item.url] = state.entries[item.url]; });
    return { autoRestore: state.autoRestore, entries: entries };
  }

  function listRecent(state, limit) {
    var rows = [];
    var entries = normalizeState(state).entries;
    Object.keys(entries).forEach(function (url) {
      Object.keys(entries[url]).forEach(function (id) {
        var record = entries[url][id];
        rows.push({
          url: url,
          id: record.id,
          title: record.title,
          revealed: record.revealed,
          highWater: record.highWater,
          codeRevealed: record.codeRevealed,
          updatedAt: record.updatedAt || 0
        });
      });
    });
    rows.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return rows.slice(0, limit || 6);
  }

  function applyVisibility(slots, progress) {
    var explanationIndex = 0;
    var revealedSlot = null;
    slots.forEach(function (slot) {
      var show = false;
      if (slot.block.kind === "code") show = !!progress.codeRevealed;
      else {
        show = explanationIndex < progress.revealed;
        if (show) revealedSlot = slot;
        explanationIndex += 1;
      }
      setShown(slot, show);
    });
    return revealedSlot;
  }

  function setShown(slot, show) {
    slot.content.hidden = !show;
    if (show) slot.content.removeAttribute("hidden");
    else slot.content.setAttribute("hidden", "");
    slot.content.inert = !show;
    slot.content.setAttribute("aria-hidden", show ? "false" : "true");
    slot.placeholder.hidden = !!show;
    if (show) slot.placeholder.setAttribute("hidden", "");
    else slot.placeholder.removeAttribute("hidden");
  }

  function shieldBlocks(blocks) {
    return blocks.map(function (block) {
      var node = block.node;
      var doc = node.ownerDocument;
      var parent = node.parentNode;
      var slot = doc.createElement("div");
      slot.className = "cfss-slot";
      slot.setAttribute("data-cfss-kind", block.kind);
      var placeholder = doc.createElement("div");
      placeholder.className = "cfss-placeholder";
      placeholder.textContent = block.kind === "code" ? "Hidden code" : "Hidden explanation";
      var content = doc.createElement("div");
      content.className = "cfss-content";
      parent.insertBefore(slot, node);
      slot.appendChild(placeholder);
      slot.appendChild(content);
      content.appendChild(node);
      return { block: block, slot: slot, placeholder: placeholder, content: content, node: node };
    });
  }

  function unshield(slots) {
    for (var i = slots.length - 1; i >= 0; i--) {
      var item = slots[i];
      var parent = item.slot.parentNode;
      if (!parent) continue;
      parent.insertBefore(item.node, item.slot);
      parent.removeChild(item.slot);
    }
  }

  function chromeStorageAdapter(chromeRef) {
    return {
      async load() {
        var data = await chromeRef.storage.local.get(STATE_KEY);
        return normalizeState(data[STATE_KEY]);
      },
      async save(state) {
        var payload = {};
        payload[STATE_KEY] = normalizeState(state);
        await chromeRef.storage.local.set(payload);
      }
    };
  }

  function localStorageAdapter(storage) {
    try {
      var probe = "__cfss_probe__";
      storage.setItem(probe, "1");
      storage.removeItem(probe);
    } catch (err) {
      return memoryStorageAdapter();
    }
    return {
      async load() {
        try {
          return normalizeState(JSON.parse(storage.getItem(STATE_KEY) || "null"));
        } catch (err) {
          return normalizeState(null);
        }
      },
      async save(state) {
        storage.setItem(STATE_KEY, JSON.stringify(normalizeState(state)));
      }
    };
  }

  function memoryStorageAdapter(initial) {
    var state = normalizeState(initial);
    return {
      async load() {
        return JSON.parse(JSON.stringify(state));
      },
      async save(next) {
        state = normalizeState(JSON.parse(JSON.stringify(next)));
      }
    };
  }

  function readFastCache(storage) {
    try {
      return JSON.parse(storage.getItem(SESSION_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeFastCache(storage, payload) {
    try {
      storage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      /* Session cache is only a flash guard. */
    }
  }

  root.CFSS = {
    STATE_KEY: STATE_KEY,
    SESSION_KEY: SESSION_KEY,
    classTokens: classTokens,
    isCodeBlock: isCodeBlock,
    isHeading: isHeading,
    collectBlocks: collectBlocks,
    suggestSections: suggestSections,
    buildManualSection: buildManualSection,
    fingerprint: fingerprint,
    findMatch: findMatch,
    sectionId: sectionId,
    countKinds: countKinds,
    createProgress: createProgress,
    revealNext: revealNext,
    hideLast: hideLast,
    revealAll: revealAll,
    setCodeRevealed: setCodeRevealed,
    resetProgress: resetProgress,
    normalizeUrl: normalizeUrl,
    normalizeState: normalizeState,
    upsertEntry: upsertEntry,
    removeEntry: removeEntry,
    listRecent: listRecent,
    applyVisibility: applyVisibility,
    shieldBlocks: shieldBlocks,
    unshield: unshield,
    chromeStorageAdapter: chromeStorageAdapter,
    localStorageAdapter: localStorageAdapter,
    memoryStorageAdapter: memoryStorageAdapter,
    readFastCache: readFastCache,
    writeFastCache: writeFastCache
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
