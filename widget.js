(function () {
  window.visiAiRender = function (w) {
    const root = document.getElementById(w.general.renderTo);
    if (!root) return;

    root.innerHTML = "";

    const box = document.createElement("div");
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
      "background:#111827",
      "color:#fff",
      "border-radius:12px"
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "VISI AI CONNECTED";
    title.style.cssText = "font-size:20px;font-weight:700;letter-spacing:.04em";

    const sub = document.createElement("div");
    sub.textContent = "Код загружен из GitHub";
    sub.style.cssText = "font-size:13px;opacity:.72";

    const stamp = document.createElement("div");
    stamp.textContent = "build: 0.1.0";
    stamp.style.cssText = "font-size:11px;opacity:.45";

    box.append(title, sub, stamp);
    root.appendChild(box);

    console.log("[visi-ai] remote widget loaded", {
      renderTo: w.general.renderTo,
      widget: w
    });
  };
})();