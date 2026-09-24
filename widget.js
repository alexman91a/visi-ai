(function () {
  window.visiAiRender = function (w) {
    var root = document.getElementById(w.general.renderTo);
    if (!root) return;

    root.innerHTML = "";

    var box = document.createElement("div");
    box.style.cssText = [
      "width:100%",
      "height:100%",
      "box-sizing:border-box",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "gap:8px",
      "font-family:Arial,sans-serif",
      "background:#14532d",
      "color:#fff",
      "border-radius:12px"
    ].join(";");

    var title = document.createElement("div");
    title.textContent = "VISI AI GITHUB API OK";
    title.style.cssText = "font-size:20px;font-weight:700";

    var sub = document.createElement("div");
    sub.textContent = "Последний код получен напрямую из GitHub API";
    sub.style.cssText = "font-size:13px;opacity:.8";

    var stamp = document.createElement("div");
    stamp.textContent = "build: 0.1.2";
    stamp.style.cssText = "font-size:11px;opacity:.55";

    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(stamp);
    root.appendChild(box);
  };
})();