(function () {
  window.visiAiRender = function (w) {
    var root = document.getElementById(w.general.renderTo);
    if (!root) return;

    var endpoint = "http://127.0.0.1:11436";
    var model = "qwen3-harness8k:14b";
    var history = [];

    function safeSnapshot(value, depth, seen) {
      if (depth > 4) return "[MaxDepth]";
      if (value === null || value === undefined) return value;
      var t = typeof value;
      if (t === "string") return value.length > 800 ? value.slice(0, 800) + "…" : value;
      if (t === "number" || t === "boolean") return value;
      if (t === "bigint") return String(value);
      if (t === "function") return "[Function " + (value.name || "anonymous") + "]";
      if (t !== "object") return String(value);

      if (!seen) seen = [];
      if (seen.indexOf(value) !== -1) return "[Circular]";
      seen.push(value);

      try {
        if (value instanceof Element) {
          return "[Element " + value.tagName + (value.id ? "#" + value.id : "") + "]";
        }
      } catch (_) {}

      if (Array.isArray(value)) {
        return value.slice(0, 25).map(function (x) {
          return safeSnapshot(x, depth + 1, seen);
        });
      }

      var out = {};
      Object.keys(value).slice(0, 100).forEach(function (key) {
        try {
          out[key] = safeSnapshot(value[key], depth + 1, seen);
        } catch (e) {
          out[key] = "[Unreadable: " + e.message + "]";
        }
      });
      return out;
    }

    var primaryData = w && w.data ? w.data.primaryData : null;
    var dashboardData = primaryData ? safeSnapshot(primaryData, 0, []) : null;
    var dashboardDataJson = "{}";

    try {
      dashboardDataJson = JSON.stringify(dashboardData || {});
      if (dashboardDataJson.length > 60000) {
        dashboardDataJson = dashboardDataJson.slice(0, 60000) + "\n[TRUNCATED]";
      }
    } catch (e) {
      dashboardDataJson = JSON.stringify({ error: "Не удалось сериализовать данные: " + e.message });
    }

    var rowCount = primaryData && Array.isArray(primaryData.items) ? primaryData.items.length : 0;

    var snapshot = {
      capturedAt: new Date().toISOString(),
      page: location.href,
      renderTo: w && w.general ? w.general.renderTo : null,
      rowCount: rowCount,
      primaryData: dashboardData
    };

    root.innerHTML =
      '<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;background:#fff;border:1px solid #d9dde5;border-radius:14px;overflow:hidden;font-family:Arial,sans-serif;color:#111827">' +
        '<div style="padding:12px 14px;border-bottom:1px solid #eceff3;display:flex;align-items:center;justify-content:space-between;background:#fafbfc">' +
          '<div><div style="font-size:15px;font-weight:700">VISI AI</div><div style="font-size:11px;color:#6b7280">' + model + '</div></div>' +
          '<div><div data-role="status" style="font-size:11px;color:#9ca3af;text-align:right">Проверяю Ollama…</div><div data-role="context" style="font-size:10px;color:#9ca3af;text-align:right;margin-top:2px">Считываю контекст…</div></div>' +
        '</div>' +
        '<div data-role="messages" style="flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fff"></div>' +
        '<div style="padding:10px;border-top:1px solid #eceff3;background:#fafbfc">' +
          '<div style="display:flex;gap:8px;align-items:flex-end">' +
            '<textarea data-role="input" placeholder="Спроси о данных дашборда…" style="flex:1;resize:none;min-height:42px;max-height:120px;border:1px solid #cfd5df;border-radius:10px;padding:10px 12px;box-sizing:border-box;font:13px Arial;outline:none"></textarea>' +
            '<button data-role="send" style="height:42px;padding:0 16px;border:0;border-radius:10px;background:#111827;color:white;font-weight:700;cursor:pointer">Отправить</button>' +
          '</div>' +
          '<div style="margin-top:6px;font-size:10px;color:#9ca3af">Локально через Ollama · контекст сохраняется только на этом ПК</div>' +
        '</div>' +
      '</div>';

    var messagesEl = root.querySelector('[data-role="messages"]');
    var inputEl = root.querySelector('[data-role="input"]');
    var sendEl = root.querySelector('[data-role="send"]');
    var statusEl = root.querySelector('[data-role="status"]');
    var contextEl = root.querySelector('[data-role="context"]');

    function addMessage(role, text) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:" + (role === "user" ? "flex-end" : "flex-start");
      var bubble = document.createElement("div");
      bubble.style.cssText =
        "max-width:82%;padding:9px 11px;border-radius:12px;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word;" +
        (role === "user"
          ? "background:#111827;color:#fff;border-bottom-right-radius:4px"
          : "background:#f3f4f6;color:#111827;border-bottom-left-radius:4px");
      bubble.textContent = text;
      row.appendChild(bubble);
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return bubble;
    }

    function setBusy(busy) {
      sendEl.disabled = busy;
      inputEl.disabled = busy;
      sendEl.style.opacity = busy ? ".55" : "1";
      sendEl.textContent = busy ? "Думаю…" : "Отправить";
    }

    function send() {
      var text = inputEl.value.trim();
      if (!text) return;

      inputEl.value = "";
      addMessage("user", text);
      history.push({ role: "user", content: text });
      setBusy(true);

      var waitBubble = addMessage("assistant", "…");

      fetch(endpoint + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: "Ты локальный ИИ-помощник внутри BI-дашборда Visiology. Отвечай кратко и по делу. Анализируй только данные, переданные ниже. Если данных недостаточно — прямо скажи об этом. ДАННЫЕ ВИДЖЕТА VISOLOGY:\n" + dashboardDataJson
            }
          ].concat(history)
        })
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var answer = data && data.message && data.message.content ? data.message.content : "Пустой ответ";
        waitBubble.textContent = answer;
        history.push({ role: "assistant", content: answer });
      })
      .catch(function (e) {
        waitBubble.textContent = "Ошибка связи с Ollama: " + e.message;
      })
      .finally(function () {
        setBusy(false);
        inputEl.focus();
      });
    }

    sendEl.onclick = function (e) {
      e.stopPropagation();
      send();
    };

    inputEl.onkeydown = function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };

    root.onclick = function (e) {
      e.stopPropagation();
    };

    fetch(endpoint + "/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot)
    })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      contextEl.textContent = "Данные подключены: " + rowCount + " строк";
      contextEl.style.color = "#15803d";
    })
    .catch(function (e) {
      contextEl.textContent = "Контекст: ошибка";
      contextEl.style.color = "#b91c1c";
      console.error("[visi-ai] inspect failed", e);
    });

    fetch(endpoint + "/health", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        statusEl.textContent = data.ok ? "Ollama подключена" : "Ollama недоступна";
        statusEl.style.color = data.ok ? "#15803d" : "#b91c1c";
        addMessage("assistant", "Связь с локальной Ollama установлена.");
      })
      .catch(function (e) {
        statusEl.textContent = "Нет связи";
        statusEl.style.color = "#b91c1c";
        addMessage("assistant", "Не удалось подключиться к локальному мосту: " + e.message);
      });
  };
})();