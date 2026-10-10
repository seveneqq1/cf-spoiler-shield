(function () {
  "use strict";

  document.querySelectorAll(".spoiler-title").forEach(function (title) {
    title.addEventListener("click", function () {
      var content = title.parentNode.querySelector(".spoiler-content");
      if (!content) return;
      content.style.display = content.style.display === "block" ? "none" : "block";
    });
  });

  var storage = CFSS.localStorageAdapter(window.localStorage);
  var app = CFSS.startPage({
    document: document,
    storage: storage,
    location: window.location,
    sessionStorage: window.sessionStorage
  });

  document.getElementById("choose").addEventListener("click", function () {
    app.ready.then(function () { app.openChooser(); });
  });
})();
