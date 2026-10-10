(function (root) {
  "use strict";

  var CFSS = root.CFSS;

  var PANEL_CSS = [
    ":host { all: initial; }",
    ":host, * { box-sizing: border-box; }",
    ".panel {",
    "  position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;",
    "  width: min(340px, calc(100vw - 24px));",
    "  color: #eceaf4; background: #1b1a22; border: 1px solid #343242;",
    "  border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,.35);",
    "  font: 14px/1.45 system-ui, sans-serif;",
    "}",
    ".panel:focus { outline: none; }",
    ".panel:focus-visible { outline: 2px solid #c8c2ff; outline-offset: 3px; }",
    ".bar, .body, .chooser, .ask { padding: 12px 14px; }",
    ".bar { display: flex; align-items: center; gap: 8px; }",
    ".name { font-weight: 650; letter-spacing: -0.01em; }",
    ".grow { flex: 1; }",
    "button, select { font: inherit; color: inherit; }",
    "button {",
    "  border: 1px solid #3c3a4b; background: #262432; border-radius: 10px;",
    "  padding: 7px 10px; cursor: pointer;",
    "}",
    "button:hover:not(:disabled) { border-color: #6f63d8; }",
    "button:focus-visible, select:focus-visible { outline: 2px solid #c8c2ff; outline-offset: 2px; }",
    "button:disabled { opacity: .45; cursor: not-allowed; }",
    "button.primary { background: #7b6cf6; border-color: #7b6cf6; color: #fff; font-weight: 650; }",
    "button.primary:hover:not(:disabled) { background: #6d5eec; }",
    "button.quiet { background: transparent; }",
    "button.danger { border-color: #6d4458; }",
    ".status { color: #b7b3c7; margin: 0 0 10px; }",
    ".title { margin: 0 0 4px; font-size: 15px; }",
    ".stack { display: grid; gap: 8px; }",
    ".row { display: flex; gap: 8px; }",
    ".row > button { flex: 1; }",
    "select { width: 100%; margin-bottom: 8px; background: #262432; border: 1px solid #3c3a4b; border-radius: 10px; padding: 6px 8px; }",
    ".keys { color: #9d99ad; font-size: 12px; margin: 8px 0 0; }",
    ".notice { background: #2a2438; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }",
    ".chooser, .ask {",
    "  position: fixed; left: 50%; top: 12vh; transform: translateX(-50%);",
    "  width: min(440px, calc(100vw - 24px)); max-height: min(70vh, 560px); overflow: auto;",
    "  background: #1b1a22; color: #eceaf4; border: 1px solid #343242; border-radius: 16px;",
    "  box-shadow: 0 16px 40px rgba(0,0,0,.4); z-index: 2147483647; font: 14px/1.45 system-ui, sans-serif;",
    "}",
    ".list { display: grid; gap: 6px; margin: 10px 0; }",
    ".list button { text-align: left; }",
    ".error { color: #f0b4c4; }",
    "@media (max-width: 520px) {",
    "  .panel { left: 8px; right: 8px; width: auto; bottom: 8px; }",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  *, *::before, *::after { transition: none !important; animation: none !important; }",
    "}"
  ].join("\n");

  function startPage(options) {
    var doc = options.document;
    var storage = options.storage;
    var loc = options.location;
    var sessionStorageRef = options.sessionStorage || null;
    var shields = new Map();
    var activeId = null;
    var ui = null;
    var picking = null;
    var needsReselect = [];
    var article = findArticle(doc);
    var url = CFSS.normalizeUrl(loc && loc.href ? loc.href : "");

    function fastPayload(state) {
      var bucket = (state.entries && state.entries[url]) || {};
      return {
        autoRestore: state.autoRestore !== false,
        url: url,
        records: Object.keys(bucket).map(function (id) { return bucket[id]; })
      };
    }

    function remember(state) {
      if (sessionStorageRef) CFSS.writeFastCache(sessionStorageRef, fastPayload(state));
    }

    async function boot() {
      var fast = sessionStorageRef ? CFSS.readFastCache(sessionStorageRef) : null;
      if (fast && fast.autoRestore && fast.url === url && article) {
        applyRecords(fast.records || []);
      }
      var state = await storage.load();
      remember(state);
      if (!article) return;
      if (state.autoRestore === false) {
        Array.from(shields.keys()).forEach(detachShield);
        needsReselect = [];
        if (ui) {
          ui.host.remove();
          ui = null;
        }
        return;
      }
      var bucket = state.entries[url] || {};
      applyRecords(Object.keys(bucket).map(function (id) { return bucket[id]; }));
    }

    function applyRecords(records) {
      if (!article) return;
      var blocks = CFSS.collectBlocks(article);
      var wanted = {};
      var unmatched = [];
      records.forEach(function (record) { wanted[record.id] = record; });
      Array.from(shields.keys()).forEach(function (id) {
        if (!wanted[id]) detachShield(id);
      });
      records.forEach(function (record) {
        var existing = shields.get(record.id);
        if (existing) {
          existing.progress = CFSS.createProgress(existing.explanationCount, record);
          existing.codeConfirmed = !!record.codeRevealed;
          CFSS.applyVisibility(existing.slots, existing.progress);
          return;
        }
        var slice = CFSS.findMatch(blocks, record);
        if (!slice) {
          unmatched.push(record);
          return;
        }
        if (slice.some(function (block) { return block.node.closest && block.node.closest(".cfss-slot"); })) return;
        mountShield(slice, record);
      });
      needsReselect = unmatched;
      if (unmatched.length) ensureUi();
      updatePanel();
    }

    function mountShield(blocks, record) {
      var counts = CFSS.countKinds(blocks);
      var progress = CFSS.createProgress(counts.explanation, record);
      var slots = CFSS.shieldBlocks(blocks);
      CFSS.applyVisibility(slots, progress);
      var shield = {
        id: record.id,
        title: record.title || "Selected section",
        anchorTitle: record.anchorTitle || "",
        fingerprint: CFSS.fingerprint(blocks),
        blocks: blocks,
        slots: slots,
        progress: progress,
        codeConfirmed: !!record.codeRevealed,
        explanationCount: counts.explanation,
        codeCount: counts.code
      };
      shields.set(shield.id, shield);
      activeId = shield.id;
      ensureUi();
      updatePanel();
      return shield;
    }

    function ensureUi() {
      if (ui) return ui;
      var host = doc.createElement("div");
      host.className = "cfss-host";
      var shadow = host.attachShadow({ mode: "open" });
      var style = doc.createElement("style");
      style.textContent = PANEL_CSS;
      shadow.appendChild(style);
      var panel = doc.createElement("div");
      panel.className = "panel";
      panel.tabIndex = 0;
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-label", "CF Spoiler Shield reader");
      shadow.appendChild(panel);
      doc.body.appendChild(host);
      panel.addEventListener("keydown", onKey);
      ui = { host: host, shadow: shadow, panel: panel, collapsed: false };
      return ui;
    }

    function updatePanel() {
      if (!ui && shields.size === 0 && needsReselect.length === 0) return;
      if (!ui) return;
      var panel = ui.panel;
      clear(panel);
      var shield = shields.get(activeId) || null;
      var bar = el("div", "bar");
      var name = el("div", "name");
      name.textContent = "CF Spoiler Shield";
      bar.appendChild(name);
      var spacer = el("div", "grow");
      bar.appendChild(spacer);
      var collapse = button(ui.collapsed ? "Expand" : "Collapse", function () {
        ui.collapsed = !ui.collapsed;
        updatePanel();
      });
      collapse.classList.add("quiet");
      bar.appendChild(collapse);
      panel.appendChild(bar);
      if (ui.collapsed) return;

      var body = el("div", "body");
      if (needsReselect.length) {
        var notice = el("div", "notice");
        notice.textContent = "A saved section no longer matches this editorial. Choose the section again. Nothing new was hidden.";
        body.appendChild(notice);
        var reselect = button("Choose editorial section", openChooser);
        reselect.classList.add("primary");
        body.appendChild(reselect);
      }
      if (!shield) {
        if (!needsReselect.length) {
          var empty = el("p", "status");
          empty.textContent = "Choose a section to start reading gradually.";
          body.appendChild(empty);
          var choose = button("Choose editorial section", openChooser);
          choose.classList.add("primary");
          body.appendChild(choose);
        }
        panel.appendChild(body);
        return;
      }

      if (shields.size > 1) {
        var select = doc.createElement("select");
        select.setAttribute("aria-label", "Shielded section");
        shields.forEach(function (item) {
          var option = doc.createElement("option");
          option.value = item.id;
          option.textContent = item.title;
          if (item.id === shield.id) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener("change", function () {
          activeId = select.value;
          updatePanel();
        });
        body.appendChild(select);
      }

      var title = el("h2", "title");
      title.textContent = shield.title;
      body.appendChild(title);
      var status = el("p", "status");
      status.setAttribute("aria-live", "polite");
      status.textContent = statusText(shield);
      body.appendChild(status);

      var stack = el("div", "stack");
      var next = button("Reveal next paragraph", function () { step(shield, CFSS.revealNext, true); });
      next.classList.add("primary");
      next.disabled = shield.progress.revealed >= shield.explanationCount;
      stack.appendChild(next);

      var row = el("div", "row");
      var hide = button("Hide last paragraph", function () { step(shield, CFSS.hideLast, false); });
      hide.disabled = shield.progress.revealed <= 0;
      var code = button(shield.progress.codeRevealed ? "Hide code" : "Show code", function () { toggleCode(shield); });
      code.disabled = shield.codeCount === 0;
      row.appendChild(hide);
      row.appendChild(code);
      stack.appendChild(row);

      var entire = button("Reveal entire section", function () { revealEntire(shield); });
      entire.disabled = shield.progress.revealed >= shield.explanationCount && shield.progress.codeRevealed;
      stack.appendChild(entire);

      var row2 = el("div", "row");
      var reset = button("Reset progress", function () { resetShield(shield); });
      reset.disabled = shield.progress.revealed === 0 && !shield.progress.codeRevealed && shield.progress.highWater === 0;
      var remove = button("Remove shield", function () { removeShield(shield.id); });
      remove.classList.add("danger");
      row2.appendChild(reset);
      row2.appendChild(remove);
      stack.appendChild(row2);
      body.appendChild(stack);

      var keys = el("p", "keys");
      keys.textContent = "With this panel focused: N next, H hide last, C code, E entire section, 0 reset, Esc collapse.";
      body.appendChild(keys);
      panel.appendChild(body);
    }

    function statusText(shield) {
      if (shield.explanationCount === 0) {
        return shield.codeCount ? "This section has no explanation blocks. Code stays hidden until you show it." : "This section has nothing to reveal.";
      }
      var base = shield.progress.revealed + " of " + shield.explanationCount + " explanation blocks revealed.";
      if (shield.progress.revealed === 0) return "Nothing revealed yet. " + base;
      if (shield.progress.revealed >= shield.explanationCount) {
        return shield.codeCount && !shield.progress.codeRevealed
          ? "All explanation blocks are visible. Code is still hidden. " + base
          : "Section complete. " + base;
      }
      return base;
    }

    function step(shield, mutator, scroll) {
      var before = shield.progress.revealed;
      shield.progress = mutator(shield.progress);
      var slot = CFSS.applyVisibility(shield.slots, shield.progress);
      if (scroll && shield.progress.revealed > before && slot && slot.node && slot.node.scrollIntoView) {
        var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
        slot.node.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      }
      persist(shield);
      updatePanel();
    }

    function toggleCode(shield) {
      if (!shield.progress.codeRevealed && !shield.codeConfirmed) {
        ask("Show every code block in this section? Explanations you have not revealed stay hidden.", "Show code").then(function (yes) {
          if (!yes) return;
          shield.codeConfirmed = true;
          shield.progress = CFSS.setCodeRevealed(shield.progress, true);
          CFSS.applyVisibility(shield.slots, shield.progress);
          persist(shield);
          updatePanel();
        });
        return;
      }
      shield.progress = CFSS.setCodeRevealed(shield.progress, !shield.progress.codeRevealed);
      CFSS.applyVisibility(shield.slots, shield.progress);
      persist(shield);
      updatePanel();
    }

    function revealEntire(shield) {
      ask("Reveal every explanation and code block in this section?", "Reveal entire section").then(function (yes) {
        if (!yes) return;
        shield.codeConfirmed = true;
        shield.progress = CFSS.revealAll(shield.progress);
        CFSS.applyVisibility(shield.slots, shield.progress);
        persist(shield);
        updatePanel();
      });
    }

    function resetShield(shield) {
      ask("Hide this section again and clear its saved progress?", "Reset progress").then(function (yes) {
        if (!yes) return;
        shield.progress = CFSS.resetProgress(shield.progress);
        shield.codeConfirmed = false;
        CFSS.applyVisibility(shield.slots, shield.progress);
        persist(shield);
        updatePanel();
      });
    }

    function persist(shield) {
      storage.load().then(function (state) {
        var next = CFSS.upsertEntry(state, url, {
          id: shield.id,
          title: shield.title,
          anchorTitle: shield.anchorTitle,
          fingerprint: shield.fingerprint,
          revealed: shield.progress.revealed,
          codeRevealed: shield.progress.codeRevealed,
          highWater: shield.progress.highWater,
          updatedAt: Date.now()
        });
        return storage.save(next).then(function () { remember(next); });
      });
    }

    function detachShield(id) {
      var shield = shields.get(id);
      if (!shield) return;
      CFSS.unshield(shield.slots);
      shields.delete(id);
      if (activeId === id) activeId = shields.keys().next().value || null;
    }

    function removeShield(id) {
      detachShield(id);
      storage.load().then(function (state) {
        var next = CFSS.removeEntry(state, url, id);
        return storage.save(next).then(function () { remember(next); });
      });
      if (!shields.size && !needsReselect.length && ui) {
        ui.host.remove();
        ui = null;
      } else updatePanel();
    }

    function openChooser() {
      if (!article) {
        ask("No editorial article was found on this page.", "OK", true);
        return;
      }
      closeChooser();
      var blocks = CFSS.collectBlocks(article);
      var suggestions = CFSS.suggestSections(blocks);
      var host = doc.createElement("div");
      host.className = "cfss-host";
      var shadow = host.attachShadow({ mode: "open" });
      var style = doc.createElement("style");
      style.textContent = PANEL_CSS;
      var box = el("div", "chooser");
      var heading = el("h2", "title");
      heading.textContent = "Choose editorial section";
      var copy = el("p", "status");
      copy.textContent = suggestions.length
        ? "Pick a detected section, or select the paragraphs yourself."
        : "No clear problem headings were found. Select the section manually.";
      box.appendChild(style);
      shadow.appendChild(style);
      box.appendChild(heading);
      box.appendChild(copy);
      var list = el("div", "list");
      suggestions.forEach(function (section) {
        var item = button(section.title, function () {
          closeChooser();
          if (shields.has(section.id)) {
            activeId = section.id;
            ensureUi();
            updatePanel();
            return;
          }
          mountShield(section.blocks, section);
          persist(shields.get(section.id));
        });
        list.appendChild(item);
      });
      box.appendChild(list);
      var manual = button("Select blocks manually", function () {
        closeChooser();
        startPicking(blocks);
      });
      manual.classList.add("primary");
      var cancel = button("Cancel", closeChooser);
      var row = el("div", "row");
      row.appendChild(manual);
      row.appendChild(cancel);
      box.appendChild(row);
      shadow.appendChild(box);
      doc.body.appendChild(host);
      picking = { host: host, mode: "chooser" };
    }

    function closeChooser() {
      if (picking && picking.host) picking.host.remove();
      if (picking && picking.mode === "blocks") stopPicking(false);
      picking = null;
    }

    function startPicking(blocks) {
      stopPicking(false);
      var start = null;
      var end = null;
      blocks.forEach(function (block, index) {
        block.node.classList.add("cfss-candidate");
        block.node.setAttribute("data-cfss-index", String(index));
      });
      function paint() {
        blocks.forEach(function (block) { block.node.classList.remove("cfss-edge"); });
        [start, end].forEach(function (index) {
          if (index === null) return;
          blocks[index].node.classList.add("cfss-edge");
        });
        if (banner) {
          banner.textContent = start === null
            ? "Click the first block in the article."
            : (end === null
              ? "Click the last block. The shield covers that range."
              : "Boundaries marked. You can shield this section.");
        }
        if (apply) apply.disabled = start === null || end === null;
      }
      function onClick(event) {
        var node = event.target.closest ? event.target.closest("[data-cfss-index]") : null;
        if (!node || !article.contains(node)) {
          event.preventDefault();
          event.stopPropagation();
          if (banner) {
            banner.textContent = event.target.closest && event.target.closest(".cfss-slot")
              ? "That block is already shielded. Remove that shield before selecting it again."
              : "Choose blocks inside the editorial article. Other page regions stay unchanged.";
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        var index = Number(node.getAttribute("data-cfss-index"));
        if (node.closest(".cfss-slot")) {
          if (banner) banner.textContent = "That block is already shielded. Remove that shield before selecting it again.";
          return;
        }
        if (start === null || (start !== null && end !== null)) {
          start = index;
          end = null;
        } else end = index;
        paint();
      }
      article.addEventListener("click", onClick, true);
      ensureUi();
      var banner = null;
      var apply = null;
      var body = ui.panel.querySelector(".body");
      if (!body) {
        ui.collapsed = false;
        updatePanel();
        body = ui.panel.querySelector(".body");
      }
      var note = el("div", "notice");
      banner = el("p", "status");
      note.appendChild(banner);
      apply = button("Shield selected section", function () {
        var built = CFSS.buildManualSection(blocks, start, end);
        if (built.error) {
          banner.textContent = built.error;
          return;
        }
        stopPicking(true);
        if (shields.has(built.section.id)) {
          activeId = built.section.id;
          updatePanel();
          return;
        }
        mountShield(built.section.blocks, built.section);
        persist(shields.get(built.section.id));
      });
      apply.classList.add("primary");
      apply.disabled = true;
      var cancel = button("Cancel selection", function () { stopPicking(true); updatePanel(); });
      note.appendChild(apply);
      note.appendChild(cancel);
      body.insertBefore(note, body.firstChild);
      picking = { mode: "blocks", onClick: onClick, blocks: blocks, note: note };
      paint();
    }

    function stopPicking(removeNote) {
      if (!picking || picking.mode !== "blocks") return;
      article.removeEventListener("click", picking.onClick, true);
      picking.blocks.forEach(function (block) {
        block.node.classList.remove("cfss-candidate", "cfss-edge");
        block.node.removeAttribute("data-cfss-index");
      });
      if (removeNote && picking.note && picking.note.parentNode) picking.note.remove();
      picking = null;
    }

    function onKey(event) {
      var target = event.target;
      if (!target) return;
      var tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      var shield = shields.get(activeId);
      var key = event.key.toLowerCase();
      if (key === "escape") {
        ui.collapsed = true;
        updatePanel();
        return;
      }
      if (!shield || ui.collapsed) return;
      if (key === "n") { event.preventDefault(); step(shield, CFSS.revealNext, true); }
      else if (key === "h") { event.preventDefault(); step(shield, CFSS.hideLast, false); }
      else if (key === "c") { event.preventDefault(); toggleCode(shield); }
      else if (key === "e") { event.preventDefault(); revealEntire(shield); }
      else if (key === "0") { event.preventDefault(); resetShield(shield); }
    }

    function ask(message, confirmLabel, alertOnly) {
      return new Promise(function (resolve) {
        var host = doc.createElement("div");
        host.className = "cfss-host";
        var shadow = host.attachShadow({ mode: "open" });
        var style = doc.createElement("style");
        style.textContent = PANEL_CSS;
        var box = el("div", "ask");
        var text = el("p", "status");
        text.textContent = message;
        var row = el("div", "row");
        var yes = button(confirmLabel || "Confirm", function () { host.remove(); resolve(true); });
        yes.classList.add("primary");
        row.appendChild(yes);
        if (!alertOnly) {
          var no = button("Cancel", function () { host.remove(); resolve(false); });
          row.appendChild(no);
        }
        box.appendChild(text);
        box.appendChild(row);
        shadow.appendChild(style);
        shadow.appendChild(box);
        doc.body.appendChild(host);
        yes.focus();
      });
    }

    function el(tag, className) {
      var node = doc.createElement(tag);
      if (className) node.className = className;
      return node;
    }

    function button(label, onClick) {
      var node = doc.createElement("button");
      node.type = "button";
      node.textContent = label;
      node.addEventListener("click", onClick);
      return node;
    }

    function clear(node) {
      while (node.firstChild) node.removeChild(node.firstChild);
    }

    function getStatus() {
      return {
        ok: true,
        article: !!article,
        url: url,
        needsReselect: needsReselect.map(function (record) { return record.title; }),
        shields: Array.from(shields.values()).map(function (shield) {
          return {
            id: shield.id,
            title: shield.title,
            revealed: shield.progress.revealed,
            total: shield.explanationCount,
            codeRevealed: shield.progress.codeRevealed
          };
        })
      };
    }

    function setAutoRestore(enabled) {
      return storage.load().then(function (state) {
        state.autoRestore = !!enabled;
        return storage.save(state).then(function () { remember(state); return state; });
      });
    }

    function clearPageShields() {
      Array.from(shields.keys()).forEach(detachShield);
      needsReselect = [];
      if (ui) {
        ui.host.remove();
        ui = null;
      }
    }

    var ready = boot();
    return {
      ready: ready,
      openChooser: openChooser,
      getStatus: getStatus,
      setAutoRestore: setAutoRestore,
      clearPageShields: clearPageShields,
      articleFound: function () { return !!article; }
    };
  }

  function findArticle(doc) {
    if (!doc || !doc.querySelector) return null;
    var marked = doc.querySelector("[data-cfss-article]");
    if (marked) return marked;
    var nodes = Array.prototype.slice.call(doc.querySelectorAll(".ttypography"));
    nodes = nodes.filter(function (el) {
      return !(el.closest && (el.closest("#comments") || el.closest(".comments") || el.closest(".comment")));
    });
    if (!nodes.length) return null;
    nodes.sort(function (a, b) { return (b.textContent || "").length - (a.textContent || "").length; });
    if ((nodes[0].textContent || "").trim().length < 40) return null;
    return nodes[0];
  }

  CFSS.startPage = startPage;
  CFSS.findArticle = findArticle;
})(typeof globalThis !== "undefined" ? globalThis : this);
