(function () {
  "use strict";

  var pageState = document.getElementById("page-state");
  var choose = document.getElementById("choose");
  var auto = document.getElementById("auto");
  var recent = document.getElementById("recent");
  var empty = document.getElementById("empty");
  var demo = document.getElementById("demo");
  var clearButton = document.getElementById("clear");
  var storage = CFSS.chromeStorageAdapter(chrome);

  function isSupported(url) {
    try {
      var parsed = new URL(url);
      return /(^|\.)codeforces\.com$/.test(parsed.hostname) && /\/blog\/entry\//.test(parsed.pathname);
    } catch (err) {
      return false;
    }
  }

  function send(tabId, message) {
    return new Promise(function (resolve) {
      chrome.tabs.sendMessage(tabId, message, function (response) {
        if (chrome.runtime.lastError || !response) resolve(null);
        else resolve(response);
      });
    });
  }

  function renderRecent(state) {
    var rows = CFSS.listRecent(state, 6);
    recent.textContent = "";
    empty.hidden = rows.length > 0;
    rows.forEach(function (row) {
      var item = document.createElement("li");
      var title = document.createElement("strong");
      title.textContent = row.title;
      var meta = document.createElement("span");
      meta.textContent = row.revealed + " explanation blocks open · " + row.url.replace(/^https?:\/\//, "");
      item.appendChild(title);
      item.appendChild(meta);
      recent.appendChild(item);
    });
  }

  storage.load().then(function (state) {
    auto.checked = state.autoRestore !== false;
    renderRecent(state);
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    if (!tab || !tab.url) {
      pageState.textContent = "Open a Codeforces editorial to choose a section.";
      return;
    }
    if (!isSupported(tab.url)) {
      pageState.textContent = "This tab is not a Codeforces editorial. Open a blog entry such as codeforces.com/blog/entry/…";
      return;
    }
    send(tab.id, { type: "cfss:status" }).then(function (status) {
      if (!status) {
        pageState.textContent = "This tab was opened before the extension loaded. Refresh it, then choose a section.";
        return;
      }
      choose.disabled = false;
      if (!status.article) {
        pageState.textContent = "This Codeforces page has no editorial article to shield.";
        choose.disabled = true;
        return;
      }
      if (status.needsReselect && status.needsReselect.length) {
        pageState.textContent = "A saved section no longer matches. Choose it again.";
        return;
      }
      if (status.shields && status.shields.length) {
        pageState.textContent = status.shields.length + " shielded section" + (status.shields.length === 1 ? "" : "s") + " on this page.";
      } else {
        pageState.textContent = "Editorial found. Choose the section you want to read slowly.";
      }
    });
  });

  choose.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) return;
      send(tab.id, { type: "cfss:choose" }).then(function (response) {
        if (!response) pageState.textContent = "This tab was opened before the extension loaded. Refresh it, then choose a section.";
        else window.close();
      });
    });
  });

  auto.addEventListener("change", function () {
    var enabled = auto.checked;
    storage.load().then(function (state) {
      state.autoRestore = enabled;
      return storage.save(state);
    }).then(function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (tab && isSupported(tab.url || "")) send(tab.id, { type: "cfss:auto-restore", enabled: enabled });
      });
    });
  });

  demo.addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
  });

  clearButton.addEventListener("click", function () {
    var yes = confirm("Clear saved progress for every shielded section on this browser?");
    if (!yes) return;
    storage.load().then(function (state) {
      state.entries = {};
      return storage.save(state);
    }).then(function () {
      renderRecent({ entries: {} });
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (tab && isSupported(tab.url || "")) send(tab.id, { type: "cfss:cleared" });
      });
      pageState.textContent = "Saved progress cleared.";
    });
  });
})();
