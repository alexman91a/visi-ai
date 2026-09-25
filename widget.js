(function () {
  window.visiAiRender = function (w) {
    var root = document.getElementById(w.general.renderTo);
    if (!root) return;

    var endpoint = "https://mine-relocation-coastal-hansen.trycloudflare.com";
    var localEndpoint = "http://127.0.0.1:11436";
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
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<button data-role="scan" style="height:30px;padding:0 10px;border:1px solid #d7dce5;border-radius:8px;background:#fff;color:#111827;font-size:11px;font-weight:700;cursor:pointer">Сканировать дашборд</button>' +
            '<div><div data-role="status" style="font-size:11px;color:#9ca3af;text-align:right">Проверяю Ollama…</div><div data-role="context" style="font-size:10px;color:#9ca3af;text-align:right;margin-top:2px">Считываю контекст…</div></div>' +
          '</div>' +
        '</div>' +
        '<div style="padding:10px 14px;border-bottom:1px solid #eceff3;background:#fff">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">' +
            '<div style="font-size:12px;font-weight:700">Данные виджета</div>' +
            '<div data-role="preview-count" style="font-size:10px;color:#9ca3af"></div>' +
          '</div>' +
          '<div data-role="preview" style="max-height:145px;overflow:auto;border:1px solid #eceff3;border-radius:9px;background:#fafbfc"></div>' +
        '</div>' +
        '<div data-role="scan-panel" style="display:none;padding:10px 14px;border-bottom:1px solid #eceff3;background:#fff">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">' +
            '<div style="font-size:12px;font-weight:700">Виджеты на листе</div>' +
            '<div data-role="scan-count" style="font-size:10px;color:#9ca3af"></div>' +
          '</div>' +
          '<div data-role="scan-results" style="max-height:170px;overflow:auto;border:1px solid #eceff3;border-radius:9px;background:#fafbfc"></div>' +
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
    var previewEl = root.querySelector('[data-role="preview"]');
    var previewCountEl = root.querySelector('[data-role="preview-count"]');
    var scanEl = root.querySelector('[data-role="scan"]');
    var scanPanelEl = root.querySelector('[data-role="scan-panel"]');
    var scanCountEl = root.querySelector('[data-role="scan-count"]');
    var scanResultsEl = root.querySelector('[data-role="scan-results"]');

    function firstValue(v) {
      if (Array.isArray(v)) return v.length ? v[0] : "";
      if (v === null || v === undefined) return "";
      return v;
    }

    function rowPair(item) {
      if (!item) return ["", ""];
      var k = firstValue(item.formattedKeys);
      var v = firstValue(item.formattedValues);
      if (k === "" || k === undefined) k = firstValue(item.keys);
      if (v === "" || v === undefined) v = firstValue(item.values);

      if (typeof k === "object") {
        try { k = JSON.stringify(k); } catch (_) { k = String(k); }
      }
      if (typeof v === "object") {
        try { v = JSON.stringify(v); } catch (_) { v = String(v); }
      }

      return [String(k === undefined ? "" : k), String(v === undefined ? "" : v)];
    }

    function renderPreview() {
      var items = primaryData && Array.isArray(primaryData.items) ? primaryData.items : [];
      previewEl.innerHTML = "";
      previewCountEl.textContent = rowCount + " строк · показаны первые " + Math.min(items.length, 8);

      var head = document.createElement("div");
      head.style.cssText = "display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:8px;padding:7px 9px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;font-size:10px;font-weight:700;color:#6b7280";
      var h1 = document.createElement("div");
      h1.textContent = "Измерение";
      var h2 = document.createElement("div");
      h2.textContent = "Показатель";
      head.appendChild(h1);
      head.appendChild(h2);
      previewEl.appendChild(head);

      if (!items.length) {
        var empty = document.createElement("div");
        empty.textContent = "К виджету пока не подключены данные";
        empty.style.cssText = "padding:12px;font-size:11px;color:#9ca3af";
        previewEl.appendChild(empty);
        return;
      }

      items.slice(0, 8).forEach(function (item, i) {
        var pair = rowPair(item);
        var row = document.createElement("div");
        row.style.cssText = "display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:8px;padding:7px 9px;border-bottom:" + (i === Math.min(items.length,8)-1 ? "0" : "1px solid #eceff3") + ";font-size:11px";
        var a = document.createElement("div");
        a.textContent = pair[0] || "—";
        a.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        var b = document.createElement("div");
        b.textContent = pair[1] || "—";
        b.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600";
        row.appendChild(a);
        row.appendChild(b);
        previewEl.appendChild(row);
      });
    }

    renderPreview();

    function getGuid(obj) {
      if (!obj || typeof obj !== "object") return "";
      var general = obj.general || {};
      var candidates = [
        obj.guid, obj.Guid, obj.widgetGuid, obj.widgetGUID, obj.id, obj.widgetId,
        general.guid, general.Guid, general.widgetGuid, general.id
      ];
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] !== undefined && candidates[i] !== null && String(candidates[i]).length >= 8) {
          return String(candidates[i]);
        }
      }
      return "";
    }

    function getTitle(obj) {
      if (!obj || typeof obj !== "object") return "";
      var general = obj.general || {};
      var candidates = [
        obj.title, obj.name, obj.caption, obj.displayName, obj.label,
        general.title, general.name, general.caption
      ];
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i] !== undefined && candidates[i] !== null && String(candidates[i]).trim()) {
          return String(candidates[i]);
        }
      }
      return "";
    }

    function getType(obj) {
      if (!obj || typeof obj !== "object") return "";
      var general = obj.general || {};
      return String(obj.type || obj.widgetType || obj.visualizationType || general.type || general.widgetType || "");
    }

    function looksLikeWidget(obj, path) {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      var p = String(path || "").toLowerCase();
      var type = getType(obj).toLowerCase();
      if (p.indexOf("widget") >= 0 && getGuid(obj)) return true;
      if (obj.widgetGuid || obj.widgetId || obj.widgetType) return true;
      if (obj.general && obj.general.type && getGuid(obj)) return true;
      if (type && getGuid(obj) && (
        type.indexOf("chart") >= 0 || type.indexOf("table") >= 0 ||
        type.indexOf("filter") >= 0 || type.indexOf("card") >= 0 ||
        type.indexOf("userwidget") >= 0 || type.indexOf("map") >= 0 ||
        type.indexOf("text") >= 0 || type.indexOf("image") >= 0
      )) return true;
      return false;
    }

    function scanDashboardStructure(dashboard) {
      var widgets = [];
      var sheets = [];
      var seenObjects = [];
      var widgetKeys = {};
      var sheetKeys = {};

      function addSheet(name, guid, path) {
        var key = (guid || "") + "|" + (name || "") + "|" + path;
        if (sheetKeys[key]) return;
        sheetKeys[key] = true;
        sheets.push({ name: name || "Лист", guid: guid || "", path: path || "" });
      }

      function addWidget(obj, path, sheetName, sheetGuid) {
        var guid = getGuid(obj);
        var title = getTitle(obj);
        var type = getType(obj);
        var key = guid ? guid : path + "|" + title + "|" + type;
        if (widgetKeys[key]) return;
        widgetKeys[key] = true;
        widgets.push({
          guid: guid,
          title: title,
          type: type,
          sheet: sheetName || "",
          sheetGuid: sheetGuid || "",
          path: path
        });
      }

      function walk(node, path, sheetName, sheetGuid, depth) {
        if (depth > 12 || node === null || node === undefined) return;
        if (typeof node !== "object") return;
        if (seenObjects.indexOf(node) !== -1) return;
        seenObjects.push(node);

        if (looksLikeWidget(node, path)) addWidget(node, path, sheetName, sheetGuid);

        if (Array.isArray(node)) {
          node.forEach(function (child, i) {
            walk(child, path + "[" + i + "]", sheetName, sheetGuid, depth + 1);
          });
          return;
        }

        Object.keys(node).forEach(function (key) {
          var value;
          try { value = node[key]; } catch (_) { return; }
          var low = key.toLowerCase();
          var nextPath = path ? path + "." + key : key;

          if (value && typeof value === "object") {
            if ((low.indexOf("sheet") >= 0 || low === "pages" || low === "tabs") && Array.isArray(value)) {
              value.forEach(function (sheet, i) {
                var sn = getTitle(sheet) || ("Лист " + (i + 1));
                var sg = getGuid(sheet);
                var sp = nextPath + "[" + i + "]";
                addSheet(sn, sg, sp);
                walk(sheet, sp, sn, sg, depth + 1);
              });
              return;
            }

            if ((low.indexOf("widget") >= 0) && Array.isArray(value)) {
              value.forEach(function (widget, i) {
                var wp = nextPath + "[" + i + "]";
                addWidget(widget, wp, sheetName, sheetGuid);
                walk(widget, wp, sheetName, sheetGuid, depth + 1);
              });
              return;
            }
          }

          walk(value, nextPath, sheetName, sheetGuid, depth + 1);
        });
      }

      walk(dashboard, "dashboard", "", "", 0);
      return { sheets: sheets, widgets: widgets };
    }

    function parseUrlIds() {
      var params = new URLSearchParams(location.search);
      return {
        workspaceId: params.get("workspaceId") || "",
        dashboardGuid: params.get("dashboardGuid") || ""
      };
    }

    function loadFullDashboard(api) {
      var getter = api && (api.getDashboard || api.GetDashboard);
      if (typeof getter === "function") {
        try {
          return Promise.resolve(getter.call(api)).then(function (data) {
            return { source: "visApi.getDashboard", data: data };
          });
        } catch (e) {}
      }

      var ids = parseUrlIds();
      if (!ids.workspaceId || !ids.dashboardGuid) {
        return Promise.reject(new Error("Не удалось определить workspaceId/dashboardGuid"));
      }

      var url = location.origin + "/v3/dashboard-service/api/workspaces/" +
        encodeURIComponent(ids.workspaceId) + "/dashboards/" +
        encodeURIComponent(ids.dashboardGuid);

      return fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      }).then(function (r) {
        if (!r.ok) throw new Error("Dashboard API HTTP " + r.status);
        return r.json();
      }).then(function (data) {
        return { source: "dashboard-service REST", data: data };
      });
    }

    function renderDashboardScan(scan, source, currentWidgets) {
      scanPanelEl.style.display = "block";
      scanResultsEl.innerHTML = "";

      var all = scan.widgets || [];
      var sheets = scan.sheets || [];
      scanCountEl.textContent =
        all.length + " виджетов · " + sheets.length + " листов · " + source;

      if (!all.length && (!currentWidgets || !currentWidgets.length)) {
        var empty = document.createElement("div");
        empty.textContent = "Структура дашборда получена, но виджеты автоматически не распознаны.";
        empty.style.cssText = "padding:12px;font-size:11px;color:#9ca3af";
        scanResultsEl.appendChild(empty);
        return;
      }

      var rows = all.length ? all : currentWidgets.map(function (w, i) {
        return {
          guid: getGuid(w),
          title: getTitle(w),
          type: getType(w),
          sheet: "Текущий лист",
          sheetGuid: "",
          path: "currentSheet.widgets[" + i + "]"
        };
      });

      var lastSheet = null;
      rows.slice(0, 150).forEach(function (info, i) {
        var sheetLabel = info.sheet || "Лист не определён";
        if (sheetLabel !== lastSheet) {
          var sh = document.createElement("div");
          sh.textContent = sheetLabel + (info.sheetGuid ? " · " + info.sheetGuid : "");
          sh.style.cssText = "padding:8px 9px;background:#eef2f7;border-bottom:1px solid #dde3eb;font-size:10px;font-weight:700;color:#374151;position:sticky;top:0";
          scanResultsEl.appendChild(sh);
          lastSheet = sheetLabel;
        }

        var row = document.createElement("div");
        row.style.cssText = "padding:8px 9px;border-bottom:1px solid #eceff3;font-size:11px";

        var title = document.createElement("div");
        title.textContent = (info.title || info.type || "Виджет") +
          (info.type && info.title ? " · " + info.type : "");
        title.style.cssText = "font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

        var guid = document.createElement("div");
        guid.textContent = info.guid ? "GUID: " + info.guid : "GUID не определён";
        guid.style.cssText = "margin-top:3px;color:#6b7280;font-family:Consolas,monospace;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

        var path = document.createElement("div");
        path.textContent = info.path || "";
        path.style.cssText = "margin-top:2px;color:#9ca3af;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

        row.appendChild(title);
        row.appendChild(guid);
        row.appendChild(path);
        scanResultsEl.appendChild(row);
      });
    }

    function scanDashboard() {
      scanEl.disabled = true;
      scanEl.textContent = "Сканирую…";
      scanPanelEl.style.display = "block";
      scanCountEl.textContent = "Получаю структуру дашборда…";
      scanResultsEl.innerHTML = "";

      try {
        if (typeof visApi !== "function") throw new Error("visApi() недоступен");
        var api = visApi();
        if (!api) throw new Error("visApi() вернул пустой объект");

        var methods = Object.keys(api).filter(function (k) {
          return typeof api[k] === "function";
        });

        var currentGetter = api.getWidgets || api.GetWidgets;
        var currentPromise = typeof currentGetter === "function"
          ? Promise.resolve(currentGetter.call(api)).catch(function () { return []; })
          : Promise.resolve([]);

        Promise.all([loadFullDashboard(api), currentPromise])
          .then(function (parts) {
            var full = parts[0];
            var currentRaw = parts[1];
            var currentWidgets = Array.isArray(currentRaw) ? currentRaw :
              currentRaw && Array.isArray(currentRaw.items) ? currentRaw.items :
              currentRaw && Array.isArray(currentRaw.widgets) ? currentRaw.widgets : [];

            var scan = scanDashboardStructure(full.data);
            renderDashboardScan(scan, full.source, currentWidgets);

            fetch(endpoint + "/inspect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                capturedAt: new Date().toISOString(),
                kind: "dashboard-full-scan",
                source: full.source,
                apiMethods: methods,
                dashboardIds: parseUrlIds(),
                sheetCount: scan.sheets.length,
                widgetCount: scan.widgets.length,
                sheets: scan.sheets,
                widgets: scan.widgets,
                currentSheetWidgets: safeSnapshot(currentWidgets, 0, []),
                dashboardShape: safeSnapshot(full.data, 0, [])
              })
            }).catch(function () {});
          })
          .catch(function (e) {
            scanCountEl.textContent = "Ошибка";
            var err = document.createElement("div");
            err.textContent = e.message;
            err.style.cssText = "padding:12px;font-size:11px;color:#b91c1c";
            scanResultsEl.appendChild(err);
          })
          .finally(function () {
            scanEl.disabled = false;
            scanEl.textContent = "Сканировать дашборд";
          });
      } catch (e) {
        scanCountEl.textContent = "Ошибка";
        var err = document.createElement("div");
        err.textContent = e.message;
        err.style.cssText = "padding:12px;font-size:11px;color:#b91c1c";
        scanResultsEl.appendChild(err);
        scanEl.disabled = false;
        scanEl.textContent = "Сканировать дашборд";
      }
    }

    scanEl.onclick = function (e) {
      e.stopPropagation();
      scanDashboard();
    };

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