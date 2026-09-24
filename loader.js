(function () {
  const URL = "https://cdn.jsdelivr.net/gh/alexman91a/visi-ai@main/widget.js?v=" + Date.now();

  const script = document.createElement("script");
  script.src = URL;
  script.async = true;

  script.onload = function () {
    if (typeof window.visiAiRender === "function") {
      window.visiAiRender(w);
    } else {
      console.error("[visi-ai] visiAiRender was not registered");
    }
  };

  script.onerror = function () {
    const root = document.getElementById(w.general.renderTo);
    if (root) {
      root.innerHTML =
        '<div style="padding:16px;font-family:Arial;color:#b91c1c">' +
        'VISI AI: не удалось загрузить widget.js' +
        '</div>';
    }
    console.error("[visi-ai] failed to load", URL);
  };

  document.head.appendChild(script);
})();