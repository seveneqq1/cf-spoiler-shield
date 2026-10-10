(function () {
  "use strict";

  if (!globalThis.CFSS || !document.body) return;

  var app = CFSS.startPage({
    document: document,
    storage: CFSS.chromeStorageAdapter(chrome),
    location: location,
    sessionStorage: sessionStorage
  });

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "cfss:status") {
      app.ready.then(function () { sendResponse(app.getStatus()); });
      return true;
    }
    if (message.type === "cfss:choose") {
      app.ready.then(function () {
        app.openChooser();
        sendResponse({ ok: true });
      });
      return true;
    }
    if (message.type === "cfss:auto-restore") {
      app.setAutoRestore(!!message.enabled).then(function () { sendResponse({ ok: true }); });
      return true;
    }
    if (message.type === "cfss:cleared") {
      app.clearPageShields();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
