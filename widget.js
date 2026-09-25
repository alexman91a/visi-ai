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

    function smartText(value, depth) {
      depth = depth || 0;
      if (depth > 3 || value === null || value === undefined) return "";
      if (typeof value === "string") {
        var div = document.createElement("div");
        div.innerHTML = value;
        return (div.textContent || div.innerText || "").trim();
      }
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (Array.isArray(value)) {
        for (var ai = 0; ai < value.length; ai++) {
          var at = smartText(value[ai], depth + 1);
          if (at) return at;
        }
        return "";
      }
      if (typeof value !== "object") return "";
      var keys = ["text","value","name","title","caption","displayName","contentText","content","ru-RU","ru","default"];
      for (var si = 0; si < keys.length; si++) {
        if (Object.prototype.hasOwnProperty.call(value, keys[si])) {
          var st = smartText(value[keys[si]], depth + 1);
          if (st && st !== "[object Object]") return st;
        }
      }
      return "";
    }

    function getTitle(obj) {
      if (!obj || typeof obj !== "object") return "";
      var general = obj.general || {};
      var candidates = [
        obj.title, obj.name, obj.caption, obj.displayName, obj.label, obj.contentText,
        general.title, general.name, general.caption
      ];
      for (var i = 0; i < candidates.length; i++) {
        var text = smartText(candidates[i], 0);
        if (text && text !== "[object Object]") return text;
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
      if (p.indexOf("widgetsexcludedfromimpact") >= 0) return false;
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

    function escapeChatHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderMarkdown(text) {
      var lines = String(text == null ? "" : text).split(/\r?\n/);
      var html = [];
      var inUl = false;
      var inOl = false;

      function inline(s) {
        var x = escapeChatHtml(s);
        x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none">$1</a>');
        x = x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        x = x.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        x = x.replace(/~~([^~]+)~~/g, "<del>$1</del>");
        return x;
      }

      function closeLists() {
        if (inUl) { html.push("</ul>"); inUl = false; }
        if (inOl) { html.push("</ol>"); inOl = false; }
      }

      for (var mi = 0; mi < lines.length; mi++) {
        var line = lines[mi];

        if (line.indexOf("|") >= 0 && mi + 1 < lines.length &&
            /^\s*\|?\s*:?-{3,}[^\n]*\|/.test(lines[mi + 1])) {
          closeLists();
          function cells(row) {
            return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (x) { return x.trim(); });
          }
          var headers = cells(line);
          mi += 2;
          var rows = [];
          while (mi < lines.length && lines[mi].indexOf("|") >= 0 && lines[mi].trim()) {
            rows.push(cells(lines[mi]));
            mi++;
          }
          mi--;
          var table = '<div style="overflow:auto;margin:7px 0"><table style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr>';
          headers.forEach(function (h) {
            table += '<th style="text-align:left;padding:5px 6px;border:1px solid #d1d5db;background:#e5e7eb">' + inline(h) + "</th>";
          });
          table += "</tr></thead><tbody>";
          rows.forEach(function (r) {
            table += "<tr>";
            headers.forEach(function (_, idx) {
              table += '<td style="padding:5px 6px;border:1px solid #d1d5db;vertical-align:top">' + inline(r[idx] || "") + "</td>";
            });
            table += "</tr>";
          });
          table += "</tbody></table></div>";
          html.push(table);
          continue;
        }

        if (/^\s*[-*+]\s+/.test(line)) {
          if (inOl) { html.push("</ol>"); inOl = false; }
          if (!inUl) { html.push('<ul style="margin:4px 0 4px 18px;padding:0">'); inUl = true; }
          html.push("<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>");
          continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
          if (inUl) { html.push("</ul>"); inUl = false; }
          if (!inOl) { html.push('<ol style="margin:4px 0 4px 18px;padding:0">'); inOl = true; }
          html.push("<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>");
          continue;
        }

        closeLists();

        if (!line.trim()) html.push('<div style="height:5px"></div>');
        else if (/^###\s+/.test(line)) html.push('<div style="font-size:13px;font-weight:700;margin:7px 0 3px">' + inline(line.replace(/^###\s+/, "")) + "</div>");
        else if (/^##\s+/.test(line)) html.push('<div style="font-size:14px;font-weight:700;margin:7px 0 3px">' + inline(line.replace(/^##\s+/, "")) + "</div>");
        else if (/^#\s+/.test(line)) html.push('<div style="font-size:15px;font-weight:800;margin:7px 0 3px">' + inline(line.replace(/^#\s+/, "")) + "</div>");
        else if (/^>\s?/.test(line)) html.push('<div style="border-left:3px solid #d1d5db;padding-left:8px;color:#4b5563;margin:4px 0">' + inline(line.replace(/^>\s?/, "")) + "</div>");
        else html.push('<div style="margin:2px 0">' + inline(line) + "</div>");
      }

      closeLists();
      return html.join("");
    }

    function copyValue(value, button) {
      var done = function () {
        if (!button) return;
        var old = button.textContent;
        button.textContent = "Скопировано";
        setTimeout(function () { button.textContent = old; }, 900);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(value)).then(done).catch(function () {});
      }
    }

    function addMessage(role, text) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:" + (role === "user" ? "flex-end" : "flex-start");
      var wrap = document.createElement("div");
      wrap.style.cssText = "max-width:88%;min-width:0";
      var bubble = document.createElement("div");
      bubble.style.cssText =
        "padding:9px 11px;border-radius:12px;font-size:13px;line-height:1.4;word-break:break-word;" +
        (role === "user"
          ? "background:#111827;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap"
          : "background:#f3f4f6;color:#111827;border-bottom-left-radius:4px");
      if (role === "assistant") bubble.innerHTML = renderMarkdown(text);
      else bubble.textContent = text;

      var copy = document.createElement("button");
      copy.textContent = "Копировать";
      copy.style.cssText = "border:0;background:transparent;color:#9ca3af;font-size:9px;padding:2px 3px;cursor:pointer";
      copy.onclick = function (e) {
        e.stopPropagation();
        copyValue(text, copy);
      };

      wrap.appendChild(bubble);
      wrap.appendChild(copy);
      row.appendChild(wrap);
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      return {
        setText: function (next) {
          text = next;
          if (role === "assistant") bubble.innerHTML = renderMarkdown(next);
          else bubble.textContent = next;
        }
      };
    }

    function setBusy(busy) {
      sendEl.disabled = busy;
      inputEl.disabled = busy;
      sendEl.style.opacity = busy ? ".55" : "1";
      sendEl.textContent = busy ? "Думаю…" : "Отправить";
    }

    function questionTokens(text) {
      var stop = {
        "какие":1,"какой":1,"какая":1,"какое":1,"есть":1,"про":1,"что":1,"где":1,
        "покажи":1,"скажи":1,"данные":1,"виджет":1,"виджеты":1,"лист":1,"листе":1,
        "дашборд":1,"дашборде":1,"мне":1,"его":1,"их":1,"по":1,"на":1,"в":1,"и":1
      };
      return String(text || "").toLowerCase()
        .replace(/[^a-zа-яё0-9_-]+/gi, " ")
        .split(/\s+/)
        .filter(function (x) { return x.length >= 3 && !stop[x]; });
    }

    function collectDashboardContext(question) {
      if (typeof visApi !== "function") {
        return Promise.resolve(JSON.stringify({ error: "visApi() недоступен", ownWidgetData: dashboardData }));
      }

      var api = visApi();
      var currentGetter = api.getWidgets || api.GetWidgets;
      var currentPromise = typeof currentGetter === "function"
        ? Promise.resolve(currentGetter.call(api)).catch(function () { return []; })
        : Promise.resolve([]);

      return Promise.all([loadFullDashboard(api), currentPromise]).then(function (parts) {
        var dashboard = parts[0] && parts[0].data ? parts[0].data : {};
        var currentRaw = parts[1];
        var current = Array.isArray(currentRaw) ? currentRaw :
          currentRaw && Array.isArray(currentRaw.items) ? currentRaw.items :
          currentRaw && Array.isArray(currentRaw.widgets) ? currentRaw.widgets : [];

        var currentGuids = {};
        current.forEach(function (x) {
          var g = getGuid(x);
          if (g) currentGuids[g] = true;
        });

        var sheets = dashboard && Array.isArray(dashboard.sheets) ? dashboard.sheets : [];
        var widgetIndex = [];
        var sheetIndex = [];

        sheets.forEach(function (sheet, si) {
          var sheetName = smartText(sheet.name, 0) || getTitle(sheet) || ("Лист " + (si + 1));
          var sheetGuid = getGuid(sheet);
          var ws = sheet && Array.isArray(sheet.widgets) ? sheet.widgets : [];

          sheetIndex.push({
            name: sheetName,
            guid: sheetGuid,
            widgetCount: ws.length,
            hidden: !!sheet.isHidden
          });

          ws.forEach(function (widget, wi) {
            var guid = getGuid(widget);
            widgetIndex.push({
              guid: guid,
              title: getTitle(widget),
              type: getType(widget),
              sheet: sheetName,
              sheetGuid: sheetGuid,
              current: !!currentGuids[guid],
              index: wi
            });
          });
        });

        var tokens = questionTokens(question);
        var q = String(question || "").toLowerCase();

        var scored = widgetIndex.map(function (item) {
          var hay = [item.title, item.type, item.sheet, item.guid].join(" ").toLowerCase();
          var score = item.current ? 1 : 0;
          tokens.forEach(function (token) {
            if (hay.indexOf(token) >= 0) score += 5;
            if (String(item.sheet).toLowerCase().indexOf(token) >= 0) score += 2;
          });
          if (item.guid && q.indexOf(item.guid.toLowerCase()) >= 0) score += 50;
          if (!/imagewidget|textwidget|userwidget/i.test(item.type)) score += 1;
          return { item: item, score: score };
        });

        scored.sort(function (a, b) { return b.score - a.score; });
        var selected = scored
          .filter(function (x) {
            return x.item.guid && !/imagewidget|textwidget|userwidget/i.test(x.item.type);
          })
          .slice(0, 10)
          .map(function (x) { return x.item; });

        var dataGetter = api.getWidgetDataByGuid || api.GetWidgetDataByGuid;
        var dataPromises = selected.map(function (info) {
          if (typeof dataGetter !== "function") {
            return Promise.resolve({ info: info, error: "getWidgetDataByGuid() недоступен" });
          }

          return Promise.resolve()
            .then(function () { return dataGetter.call(api, info.guid); })
            .then(function (data) {
              return { info: info, data: safeSnapshot(data, 0, []) };
            })
            .catch(function (e) {
              return { info: info, error: e && e.message ? e.message : String(e) };
            });
        });

        return Promise.all(dataPromises).then(function (widgetData) {
          var context = {
            dashboard: {
              guid: getGuid(dashboard),
              name: smartText(dashboard.name, 0),
              sheets: sheetIndex
            },
            allWidgets: widgetIndex,
            selectedWidgetData: widgetData,
            ownWidgetData: dashboardData,
            note: "Карта всего дашборда передана полностью. Для вопроса дополнительно запрошены данные до 10 наиболее релевантных недекоративных виджетов."
          };

          var json = JSON.stringify(context);
          if (json.length > 90000) json = json.slice(0, 90000) + "\n[TRUNCATED]";
          return json;
        });
      }).catch(function (e) {
        return JSON.stringify({
          error: e && e.message ? e.message : String(e),
          ownWidgetData: dashboardData
        });
      });
    }

    function send() {
      var text = inputEl.value.trim();
      if (!text) return;

      inputEl.value = "";
      addMessage("user", text);
      history.push({ role: "user", content: text });
      setBusy(true);

      var waitBubble = addMessage("assistant", "Собираю данные релевантных виджетов…");
      var contextJson = "{}";

      collectDashboardContext(text)
      .then(function (ctx) {
        contextJson = ctx;
        waitBubble.setText("Анализирую данные…");

        return fetch(endpoint + "/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content:
                  "Ты AI-аналитик внутри BI-системы Visiology. Отвечай на русском, кратко и содержательно. " +
                  "Используй Markdown: заголовки, списки и таблицы, когда это улучшает читаемость. " +
                  "Не выдумывай отсутствующие значения. Если данных конкретного виджета получить не удалось, прямо укажи это. " +
                  "Если вывод основан на конкретном виджете, называй его лист и название или тип. " +
                  "Ниже передана карта всего дашборда и данные релевантных виджетов для текущего вопроса.\n\n" +
                  contextJson
              }
            ].concat(history)
          })
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var answer = data && data.message && data.message.content ? data.message.content : "Пустой ответ";
        waitBubble.setText(answer);
        history.push({ role: "assistant", content: answer });
      })
      .catch(function (e) {
        if (endpoint !== localEndpoint) {
          endpoint = localEndpoint;
          statusEl.textContent = "Интернет недоступен · пробую локально";
          return fetch(endpoint + "/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "system",
                  content:
                    "Ты AI-аналитик внутри BI-системы Visiology. Используй Markdown. Не выдумывай отсутствующие значения.\n\n" +
                    contextJson
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
            waitBubble.setText(answer);
            history.push({ role: "assistant", content: answer });
            statusEl.textContent = "Ollama подключена локально";
            statusEl.style.color = "#15803d";
          });
        }
        throw e;
      })
      .catch(function (e) {
        waitBubble.setText("**Ошибка связи с Ollama:** " + e.message);
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

    function checkHealth(url, label) {
      return fetch(url + "/health", { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          if (!data || !data.ok) throw new Error("health=false");
          endpoint = url;
          statusEl.textContent = label + " · Ollama подключена";
          statusEl.style.color = "#15803d";
          return data;
        });
    }

    checkHealth(endpoint, "Интернет")
      .catch(function () {
        return checkHealth(localEndpoint, "Локально");
      })
      .then(function () {
        addMessage("assistant", "Связь с Ollama установлена. Можно спрашивать о других листах, виджетах и их данных.");
      })
      .catch(function (e) {
        statusEl.textContent = "Нет связи";
        statusEl.style.color = "#b91c1c";
        addMessage("assistant", "**Нет связи с Ollama:** " + e.message);
      });
  };
})();