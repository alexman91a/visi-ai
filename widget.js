(function () {
  window.visiAiRender = function (w) {
    var root = document.getElementById(w.general.renderTo);
    if (!root) return;

    var endpoint = "https://mine-relocation-coastal-hansen.trycloudflare.com";
    var localEndpoint = "http://127.0.0.1:11436";
    var model = "qwen3-harness8k:14b";
    var version = "0.8.7";
    var dashboardGuidForHistory = "";
    try {
      dashboardGuidForHistory = new URLSearchParams(location.search).get("dashboardGuid") || location.pathname;
    } catch (_) {
      dashboardGuidForHistory = location.pathname;
    }
    var historyKey = "visi-ai-history:" + dashboardGuidForHistory;
    var pendingKey = "visi-ai-pending:" + dashboardGuidForHistory;
    var sessionContextKey = "visi-ai-session-context-v2:" + dashboardGuidForHistory;
    var history = [];
    var historySignature = "";
    var lastDiagnostic = null;

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
          '<div><div style="display:flex;align-items:center;gap:7px"><div style="font-size:15px;font-weight:700">VISI AI</div><div style="font-size:9px;font-weight:700;color:#6b7280;background:#eef2f7;border-radius:999px;padding:2px 6px">v' + version + '</div></div><div style="font-size:11px;color:#6b7280;margin-top:2px">' + model + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<button data-role="diagnostics" style="height:30px;padding:0 9px;border:1px solid #d7dce5;border-radius:8px;background:#fff;color:#6b7280;font-size:10px;font-weight:700;cursor:pointer">Копировать диагностику</button>' +
            '<button data-role="history-clear" style="height:30px;padding:0 9px;border:1px solid #d7dce5;border-radius:8px;background:#fff;color:#6b7280;font-size:10px;font-weight:700;cursor:pointer">Очистить историю</button>' +
            '<button data-role="scan" style="height:30px;padding:0 10px;border:1px solid #d7dce5;border-radius:8px;background:#fff;color:#111827;font-size:11px;font-weight:700;cursor:pointer">Сканировать дашборд</button>' +
            '<div><div data-role="status" style="font-size:11px;color:#9ca3af;text-align:right">Проверяю Ollama…</div><div data-role="context" style="font-size:10px;color:#9ca3af;text-align:right;margin-top:2px">Считываю контекст…</div></div>' +
          '</div>' +
        '</div>' +
        '<div data-role="pending-banner" style="display:none;padding:7px 14px;border-bottom:1px solid #fde68a;background:#fffbeb;color:#92400e;font-size:10px;font-weight:700">● Запрос выполняется… применяю фильтры и собираю данные. Виджет может кратко перерисоваться.</div>' +
        '<div data-role="session-context-bar" style="display:none;padding:6px 14px;border-bottom:1px solid #e5e7eb;background:#f8fafc;font-size:10px;color:#475569">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
            '<div><b>Контекст:</b> <span data-role="session-context-text"></span></div>' +
            '<button data-role="session-context-clear" style="border:0;background:transparent;color:#64748b;font-size:10px;font-weight:700;cursor:pointer;padding:0">Сбросить</button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:8px 14px;border-bottom:1px solid #eceff3;background:#fff">' +
          '<div data-role="preview-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none">' +
            '<div><div style="font-size:12px;font-weight:700">Данные для ответа</div><div style="font-size:9px;color:#9ca3af;margin-top:1px">Что именно VISI AI получил из Visiology для текущего вопроса</div></div>' +
            '<div style="display:flex;align-items:center;gap:8px"><div data-role="preview-count" style="font-size:10px;color:#9ca3af"></div><div data-role="preview-arrow" style="font-size:11px;color:#6b7280">▾</div></div>' +
          '</div>' +
          '<div data-role="preview-wrap" style="display:none;margin-top:7px">' +
            '<div data-role="preview" style="max-height:145px;overflow:auto;border:1px solid #eceff3;border-radius:9px;background:#fafbfc"></div>' +
          '</div>' +
        '</div>' +
        '<div data-role="scan-panel" style="padding:6px 14px;border-bottom:1px solid #eceff3;background:#fafbfc">' +
          '<div data-role="scan-count" style="font-size:10px;color:#6b7280">Структура дашборда: ещё не просканирована</div>' +
        '</div>' +
        '<div data-role="messages" style="flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#fff"></div>' +
        '<div style="padding:10px;border-top:1px solid #eceff3;background:#fafbfc">' +
          '<div style="display:flex;gap:8px;align-items:flex-end">' +
            '<textarea data-role="input" placeholder="Спроси о любом листе, виджете или его данных…" style="flex:1;resize:none;min-height:42px;max-height:120px;border:1px solid #cfd5df;border-radius:10px;padding:10px 12px;box-sizing:border-box;font:13px Arial;outline:none"></textarea>' +
            '<button data-role="send" style="height:42px;padding:0 16px;border:0;border-radius:10px;background:#111827;color:white;font-weight:700;cursor:pointer">Отправить</button>' +
          '</div>' +
          '<div style="margin-top:6px;font-size:10px;color:#9ca3af">Ollama на вашем ПК · HTTPS-туннель с локальным резервом · история сохраняется в этом браузере</div>' +
        '</div>' +
      '</div>';

    var messagesEl = root.querySelector('[data-role="messages"]');
    var inputEl = root.querySelector('[data-role="input"]');
    var sendEl = root.querySelector('[data-role="send"]');
    var statusEl = root.querySelector('[data-role="status"]');
    var contextEl = root.querySelector('[data-role="context"]');
    var previewEl = root.querySelector('[data-role="preview"]');
    var previewCountEl = root.querySelector('[data-role="preview-count"]');
    var previewWrapEl = root.querySelector('[data-role="preview-wrap"]');
    var previewToggleEl = root.querySelector('[data-role="preview-toggle"]');
    var previewArrowEl = root.querySelector('[data-role="preview-arrow"]');
    var pendingBannerEl = root.querySelector('[data-role="pending-banner"]');
    var sessionContextBarEl = root.querySelector('[data-role="session-context-bar"]');
    var sessionContextTextEl = root.querySelector('[data-role="session-context-text"]');
    var sessionContextClearEl = root.querySelector('[data-role="session-context-clear"]');
    var scanEl = root.querySelector('[data-role="scan"]');
    var diagnosticsEl = root.querySelector('[data-role="diagnostics"]');
    var clearHistoryEl = root.querySelector('[data-role="history-clear"]');
    var scanPanelEl = root.querySelector('[data-role="scan-panel"]');
    var scanCountEl = root.querySelector('[data-role="scan-count"]');

    var autoFollowChat = true;
    var autoScrollThreshold = 64;

    function isChatNearBottom() {
      return (messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight) <= autoScrollThreshold;
    }

    function scrollChatToBottom(force) {
      if (!force && !autoFollowChat) return;
      requestAnimationFrame(function () {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }

    messagesEl.addEventListener("scroll", function () {
      autoFollowChat = isChatNearBottom();
    }, { passive: true });

    var previewExpanded = false;

    function setPreviewExpanded(expanded) {
      previewExpanded = !!expanded;
      previewWrapEl.style.display = previewExpanded ? "block" : "none";
      previewArrowEl.textContent = previewExpanded ? "▴" : "▾";
    }

    previewToggleEl.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setPreviewExpanded(!previewExpanded);
    }, true);

    previewToggleEl.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    }, true);

    setPreviewExpanded(false);

    function updatePendingUi() {
      var pending = getPendingState();
      if (pending) {
        pendingBannerEl.style.display = "block";
        pendingBannerEl.textContent = "● " + (pending.phase || "Запрос выполняется…") + " · " + pending.question;
        sendEl.disabled = true;
        inputEl.disabled = true;
        sendEl.style.opacity = ".55";
        sendEl.textContent = "Выполняется…";
      } else {
        pendingBannerEl.style.display = "none";
        sendEl.disabled = false;
        inputEl.disabled = false;
        sendEl.style.opacity = "1";
        sendEl.textContent = "Отправить";
      }
    }

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

    function renderAnswerData(context, question) {
      previewEl.innerHTML = "";

      if (!context) {
        previewCountEl.textContent = "ожидает вопрос";
        var empty = document.createElement("div");
        empty.textContent = "После запроса здесь появятся виджеты и строки данных, которые VISI AI передал модели для ответа.";
        empty.style.cssText = "padding:11px;font-size:10px;line-height:1.4;color:#9ca3af";
        previewEl.appendChild(empty);
        return;
      }

      var sources = Array.isArray(context.selectedWidgetData) ? context.selectedWidgetData : [];
      var searched = context.searchedWidgetCount || 0;
      var matched = context.matchedWidgetCount || 0;
      previewCountEl.textContent = searched + " проверено · " + matched + " совпадений";

      if (question) {
        var q = document.createElement("div");
        q.style.cssText = "padding:7px 9px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;font-size:10px;color:#4b5563";
        q.innerHTML = "<b>Запрос:</b> " + escapeChatHtml(question);
        previewEl.appendChild(q);
      }

      if (!sources.length) {
        var noData = document.createElement("div");
        noData.textContent = "Подходящие данные из других виджетов для этого ответа не получены.";
        noData.style.cssText = "padding:11px;font-size:10px;color:#9ca3af";
        previewEl.appendChild(noData);
        return;
      }

      sources.slice(0, 12).forEach(function (source) {
        var info = source.info || {};
        var targeted = source.data || {};
        var matches = Array.isArray(targeted.matches) ? targeted.matches : [];

        var card = document.createElement("div");
        card.style.cssText = "padding:8px 9px;border-bottom:1px solid #eceff3;font-size:10px";

        var head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:8px";

        var sourceName = document.createElement("div");
        sourceName.style.cssText = "font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        sourceName.textContent = (info.sheet ? info.sheet + " · " : "") + (info.title || info.type || "Виджет");

        var badge = document.createElement("div");
        badge.style.cssText = "white-space:nowrap;color:#6b7280;font-size:9px";
        badge.textContent = source.error ? "ошибка" : (matches.length ? matches.length + " совп." : "данные");

        head.appendChild(sourceName);
        head.appendChild(badge);
        card.appendChild(head);

        if (source.error) {
          var err = document.createElement("div");
          err.textContent = source.error;
          err.style.cssText = "margin-top:4px;color:#b91c1c";
          card.appendChild(err);
        } else if (matches.length) {
          matches.slice(0, 3).forEach(function (match) {
            var row = document.createElement("div");
            var valueText = match && match.text ? String(match.text) : "";
            row.textContent = valueText || (match && match.path ? match.path : "Совпадение");
            row.style.cssText = "margin-top:5px;padding:5px 6px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;color:#374151;line-height:1.35;cursor:pointer;max-height:44px;overflow:hidden";
            row.title = "Нажмите, чтобы скопировать значение";
            row.onclick = function (e) {
              e.stopPropagation();
              copyValue(valueText || JSON.stringify(match && match.value ? match.value : match));
            };
            card.appendChild(row);
          });
        } else {
          var note = document.createElement("div");
          note.textContent = "Совпадение по тексту не найдено; модели передан обзор данных этого виджета.";
          note.style.cssText = "margin-top:4px;color:#9ca3af";
          card.appendChild(note);
        }

        previewEl.appendChild(card);
      });
    }

    renderAnswerData(null, "");

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
      if (dashboard && Array.isArray(dashboard.sheets)) {
        var directSheets = [];
        var directWidgets = [];
        dashboard.sheets.forEach(function (sheet, si) {
          var sheetName = smartText(sheet.name, 0) || getTitle(sheet) || ("Лист " + (si + 1));
          var sheetGuid = getGuid(sheet);
          var ws = sheet && Array.isArray(sheet.widgets) ? sheet.widgets : [];
          directSheets.push({ name: sheetName, guid: sheetGuid, path: "dashboard.sheets[" + si + "]" });
          ws.forEach(function (widget, wi) {
            directWidgets.push({
              guid: getGuid(widget),
              title: getTitle(widget),
              type: getType(widget),
              sheet: sheetName,
              sheetGuid: sheetGuid,
              path: "dashboard.sheets[" + si + "].widgets[" + wi + "]"
            });
          });
        });
        return { sheets: directSheets, widgets: directWidgets };
      }

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
      var all = scan.widgets || [];
      var sheets = scan.sheets || [];
      var widgetCount = all.length || (currentWidgets ? currentWidgets.length : 0);
      scanPanelEl.style.display = "block";
      scanCountEl.textContent =
        "Просканировано: " + widgetCount + " виджетов · " + sheets.length + " листов";
    }

    function scanDashboard() {
      scanEl.disabled = true;
      scanEl.textContent = "Сканирую…";
      scanPanelEl.style.display = "block";
      scanCountEl.textContent = "Сканирую структуру дашборда…";

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
            scanCountEl.textContent = "Ошибка сканирования: " + e.message;
          })
          .finally(function () {
            scanEl.disabled = false;
            scanEl.textContent = "Сканировать дашборд";
          });
      } catch (e) {
        scanCountEl.textContent = "Ошибка сканирования: " + e.message;
        scanEl.disabled = false;
        scanEl.textContent = "Сканировать дашборд";
      }
    }

    function triggerDashboardScan(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (scanEl.disabled) return;
      scanDashboard();
    }

    scanEl.style.pointerEvents = "auto";
    scanEl.style.position = "relative";
    scanEl.style.zIndex = "20";

    scanEl.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    }, true);

    scanEl.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    }, true);

    scanEl.addEventListener("click", triggerDashboardScan, true);

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

    function postDiagnostic(payload) {
      try {
        return fetch(endpoint + "/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(function () {});
      } catch (_) {
        return Promise.resolve();
      }
    }

    diagnosticsEl.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      var payload = lastDiagnostic || {
        version: version,
        capturedAt: new Date().toISOString(),
        dashboardGuid: dashboardGuidForHistory,
        note: "Диагностика вопроса еще не сформирована."
      };

      copyValue(JSON.stringify(payload, null, 2), diagnosticsEl);
    };

    diagnosticsEl.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    }, true);

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
      scrollChatToBottom(false);

      return {
        setText: function (next) {
          text = next;
          if (role === "assistant") bubble.innerHTML = renderMarkdown(next);
          else bubble.textContent = next;
          scrollChatToBottom(false);
        }
      };
    }

    function loadSavedHistory() {
      try {
        var raw = localStorage.getItem(historyKey);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(function (m) {
          return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
        }).slice(-40);
      } catch (_) {
        return [];
      }
    }

    function loadSessionContext() {
      try {
        var raw = localStorage.getItem(sessionContextKey);
        if (!raw) return null;
        var ctx = JSON.parse(raw);
        if (!ctx || (!ctx.entity && !ctx.sheet)) return null;
        return ctx;
      } catch (_) {
        return null;
      }
    }

    function saveSessionContextFromAnswer(ctx, question) {
      if (!ctx || typeof ctx !== "object") return;
      var filter = ctx.filterAction || {};
      var entity = filter.value || ctx.entityHint || "";
      var sheet = filter.sheet || (ctx.requestedSheet && ctx.requestedSheet[0]) || "";
      var sheetGuid = filter.sheetGuid || "";

      if (!entity && !sheet) return;

      var session = {
        entity: entity,
        sheet: sheet,
        sheetGuid: sheetGuid,
        filterGuid: filter.guid || "",
        lastQuestion: question || "",
        updatedAt: Date.now()
      };

      try {
        localStorage.setItem(sessionContextKey, JSON.stringify(session));
      } catch (_) {}
      renderSessionContextUi();
    }

    function clearSessionContext() {
      try { localStorage.removeItem(sessionContextKey); } catch (_) {}
      renderSessionContextUi();
    }

    function renderSessionContextUi() {
      var ctx = loadSessionContext();
      if (!ctx) {
        sessionContextBarEl.style.display = "none";
        sessionContextTextEl.textContent = "";
        return;
      }

      var parts = [];
      if (ctx.entity) parts.push(ctx.entity);
      if (ctx.sheet) parts.push(ctx.sheet);
      sessionContextTextEl.textContent = parts.join(" · ");
      sessionContextBarEl.style.display = "block";
    }

    function shouldInheritSessionContext(question) {
      var ctx = loadSessionContext();
      if (!ctx || !ctx.entity) return false;

      if (extractEntityHint(question)) return false;

      var normalized = normalizeSearchText(question);
      var words = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
      if (!words.length) return false;

      if (/сброс.*контекст|нов(?:ый|ая|ое).*тема|друг(?:ой|ая|ое).*объект/i.test(normalized)) return false;

      // Явно самостоятельные бытовые/общие вопросы не должны наследовать BI-контекст.
      if (/(который час|сколько сейчас времени|текущее время|какая сегодня дата|какое сегодня число|погод|курс валют|кто такой|что такое)/i.test(normalized)) {
        return false;
      }

      var explicitFollowup =
        /^(а |и |теперь |покажи|выведи|дай|перечисли|подробнее|раскрой|расшифруй|сравни|найди все|все )/i.test(normalized) ||
        /(из них|по ним|по нему|по ней|эти|этим|этого|эта выборка|текущий объект|текущая линия|просроч|выполн|не начат|в работе|истекает срок|список|детал|остальн|кто отвечает|ответственн)/i.test(normalized);

      return explicitFollowup;
    }

    function buildAnalysisQuestion(question) {
      var ctx = loadSessionContext();
      if (!ctx || !shouldInheritSessionContext(question)) {
        return {
          text: question,
          inherited: false,
          context: null
        };
      }

      var suffix = "\n\nКонтекст предыдущего запроса: ";
      if (ctx.entity) suffix += "объект «" + ctx.entity + "». ";
      if (ctx.sheet) suffix += "Используй лист «" + ctx.sheet + "». ";
      suffix += "Это продолжение предыдущего вопроса; сохраняй эту сущность и область анализа, пока пользователь явно не задаст новую.";

      return {
        text: question + suffix,
        inherited: true,
        context: ctx
      };
    }

    sessionContextClearEl.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      clearSessionContext();
    };

    sessionContextClearEl.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    }, true);

    renderSessionContextUi();

    function getPendingState() {
      try {
        var raw = localStorage.getItem(pendingKey);
        if (!raw) return null;
        var pending = JSON.parse(raw);
        if (!pending || !pending.startedAt) return null;
        if (Date.now() - pending.startedAt > 300000) {
          localStorage.removeItem(pendingKey);
          return null;
        }
        return pending;
      } catch (_) {
        return null;
      }
    }

    function storageStateSignature() {
      try {
        return (localStorage.getItem(historyKey) || "") + "|" + (localStorage.getItem(pendingKey) || "") + "|" + (localStorage.getItem(sessionContextKey) || "");
      } catch (_) {
        return String(Date.now());
      }
    }

    function saveHistory() {
      try {
        localStorage.setItem(historyKey, JSON.stringify(history.slice(-40)));
        historySignature = storageStateSignature();
      } catch (_) {}
    }

    function setPendingState(question, phase) {
      try {
        localStorage.setItem(pendingKey, JSON.stringify({
          question: question,
          phase: phase || "Собираю данные…",
          startedAt: Date.now()
        }));
        historySignature = storageStateSignature();
      } catch (_) {}
      updatePendingUi();
    }

    function updatePendingPhase(phase) {
      try {
        var pending = getPendingState();
        if (!pending) return;
        pending.phase = phase || pending.phase;
        localStorage.setItem(pendingKey, JSON.stringify(pending));
      } catch (_) {}
      updatePendingUi();
    }

    function clearPendingState() {
      try {
        localStorage.removeItem(pendingKey);
      } catch (_) {}
      updatePendingUi();
    }

    function renderHistoryState(showRestoredLabel) {
      history = loadSavedHistory();
      messagesEl.innerHTML = "";

      history.forEach(function (m) {
        addMessage(m.role, m.content);
      });

      var pending = getPendingState();
      if (pending) {
        addMessage("assistant", (pending.phase || "Запрос выполняется…") + "\n\n_Запрос ещё выполняется; это сообщение обновится после завершения._");
      }

      if (showRestoredLabel && history.length) {
        var divider = document.createElement("div");
        divider.textContent = "История восстановлена · " + Math.ceil(history.length / 2) + " диалогов";
        divider.style.cssText = "text-align:center;font-size:9px;color:#9ca3af;padding:2px 0";
        messagesEl.appendChild(divider);
      }

      historySignature = storageStateSignature();
      updatePendingUi();
      renderSessionContextUi();
      scrollChatToBottom(true);
    }

    clearHistoryEl.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      history = [];
      try {
        localStorage.removeItem(historyKey);
        localStorage.removeItem(pendingKey);
        localStorage.removeItem(sessionContextKey);
      } catch (_) {}
      renderHistoryState(false);
      addMessage("assistant", "История запросов очищена.");
    };

    clearHistoryEl.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    }, true);

    renderHistoryState(true);

    window.__visiAiHistoryPollers = window.__visiAiHistoryPollers || {};
    var pollerKey = String(w.general.renderTo || root.id || "visi-ai");
    if (window.__visiAiHistoryPollers[pollerKey]) {
      clearInterval(window.__visiAiHistoryPollers[pollerKey]);
    }

    window.__visiAiHistoryPollers[pollerKey] = setInterval(function () {
      if (!document.body.contains(root)) {
        clearInterval(window.__visiAiHistoryPollers[pollerKey]);
        delete window.__visiAiHistoryPollers[pollerKey];
        return;
      }

      var latestSignature = storageStateSignature();
      if (latestSignature !== historySignature) {
        renderHistoryState(false);
      } else {
        updatePendingUi();
      }
    }, 350);

    function setBusy(busy) {
      if (busy) {
        sendEl.disabled = true;
        inputEl.disabled = true;
        sendEl.style.opacity = ".55";
        sendEl.textContent = "Думаю…";
      } else {
        updatePendingUi();
      }
    }

    function normalizeSearchText(text) {
      return String(text == null ? "" : text)
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[«»„“”"]/g, " ")
        .replace(/[^a-zа-я0-9_-]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function questionTokens(text) {
      var stop = {
        "какие":1,"какой":1,"какая":1,"какое":1,"есть":1,"про":1,"что":1,"где":1,
        "покажи":1,"скажи":1,"данные":1,"виджет":1,"виджеты":1,"лист":1,"листе":1,
        "дашборд":1,"дашборде":1,"мне":1,"его":1,"их":1,"по":1,"на":1,"в":1,"и":1,
        "статистика":1,"статистике":1,"задания":1,"заданиям":1,"заданий":1,
        "объект":1,"объекта":1,"объекте":1,"информация":1,"информацию":1,
        "сколько":1,"всего":1,"для":1,"или":1,"это":1,"этот":1,"эта":1,"этом":1
      };
      return normalizeSearchText(text)
        .split(/\s+/)
        .filter(function (x) { return x.length >= 3 && !stop[x]; });
    }

    function compactPrimitiveText(value, depth) {
      depth = depth || 0;
      if (depth > 4 || value === null || value === undefined) return "";
      var t = typeof value;
      if (t === "string" || t === "number" || t === "boolean") return " " + String(value);
      if (Array.isArray(value)) {
        var arr = "";
        for (var i = 0; i < value.length && i < 30; i++) {
          arr += compactPrimitiveText(value[i], depth + 1);
        }
        return arr;
      }
      if (t !== "object") return "";
      var out = "";
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length && k < 80; k++) {
        if (keys[k] === "metadata") continue;
        try { out += compactPrimitiveText(value[keys[k]], depth + 1); } catch (_) {}
      }
      return out;
    }

    function tokenRoot(token) {
      var t = normalizeSearchText(token);
      if (t.length <= 5) return t;
      return t.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ей|ам|ям|ах|ях|ом|ем|ам|ям|ов|ев|ей|ы|и|а|я|у|ю|е|о)$/i, "");
    }

    function normalizedContainsToken(text, token) {
      var normalized = normalizeSearchText(text);
      var root = tokenRoot(token);
      if (!root) return false;
      if (normalized.indexOf(root) >= 0) return true;
      return normalized.split(/\s+/).some(function (word) {
        return tokenRoot(word) === root;
      });
    }

    function extractEntityHint(question) {
      var raw = String(question || "");
      var value = "";

      var guillemet = raw.match(/объект(?:у|а|е|ом)?\s+«([\s\S]*?)»/i);
      if (guillemet && guillemet[1]) value = guillemet[1];

      if (!value) {
        var quoted = raw.match(/объект(?:у|а|е|ом)?\s+["“]([\s\S]*?)["”]/i);
        if (quoted && quoted[1]) value = quoted[1];
      }

      if (!value) {
        var plain = raw.match(/объект(?:у|а|е|ом)?\s+(.+?)(?=\s+(?:какая|какой|какие|сколько|статистика|покажи|дай|есть|найди)(?:\s|[?.!,]|$)|[?.!,]|$)/i);
        if (plain && plain[1]) value = plain[1];
      }

      if (!value && /статист|задан|информац|сведен/i.test(raw)) {
        var byTail = raw.match(/по\s+([a-zа-яё0-9_-]{4,})\s*[?.!]*$/i);
        if (byTail && byTail[1] && !/^(данным|заданиям|статистике|объекту|проекту)$/i.test(byTail[1])) {
          value = byTail[1];
        }
      }

      value = value.replace(/^[\s«»„“”"']+|[\s«»„“”"'.]+$/g, "").trim();
      return value;
    }

    function strongEntityTokens(question) {
      var hint = normalizeSearchText(extractEntityHint(question));
      if (!hint) return [];
      var weak = {
        "перегон":1,"станция":1,"ст":1,"от":1,"до":1,"объект":1,"объекта":1,
        "участок":1,"этап":1,"проект":1,"проектирование":1
      };
      return hint.split(/\s+/).map(tokenRoot).filter(function (x) {
        return x.length >= 4 && !weak[x];
      });
    }

    function targetedDataSnapshot(data, question) {
      var tokens = questionTokens(question);
      var entityHint = extractEntityHint(question);
      var strongTokens = strongEntityTokens(question);
      var matches = [];
      var visited = 0;
      var seen = [];

      function scoreText(text) {
        var normalized = normalizeSearchText(text);
        var score = 0;
        var strongHits = 0;

        strongTokens.forEach(function (token) {
          if (normalizedContainsToken(normalized, token)) strongHits++;
        });

        if (strongTokens.length && strongHits < strongTokens.length) {
          return { score: 0, strongHits: strongHits, exactEntity: false };
        }

        tokens.forEach(function (token) {
          if (normalizedContainsToken(normalized, token)) score += token.length >= 6 ? 3 : 1;
        });

        if (strongTokens.length && strongHits === strongTokens.length) score += 30;
        var normalizedHint = normalizeSearchText(entityHint);
        var exactEntity = !!normalizedHint && normalized.indexOf(normalizedHint) >= 0;
        if (exactEntity) score += 50;

        return { score: score, strongHits: strongHits, exactEntity: exactEntity };
      }

      function walk(node, path, depth) {
        if (visited > 10000 || depth > 9 || node === null || node === undefined) return;
        if (typeof node !== "object") return;
        if (seen.indexOf(node) !== -1) return;
        seen.push(node);
        visited++;

        if (Array.isArray(node)) {
          for (var i = 0; i < node.length && i < 1500; i++) {
            var item = node[i];
            if (item && typeof item === "object") {
              var text = compactPrimitiveText(item, 0);
              var scored = scoreText(text);
              if (scored.score > 0) {
                matches.push({
                  score: scored.score,
                  strongHits: scored.strongHits,
                  exactEntity: scored.exactEntity,
                  path: path + "[" + i + "]",
                  text: String(text).trim().slice(0, 3500),
                  value: safeSnapshot(item, 0, [])
                });
              }
            }
            walk(item, path + "[" + i + "]", depth + 1);
          }
          return;
        }

        var keys = Object.keys(node);
        for (var k = 0; k < keys.length && k < 160; k++) {
          var key = keys[k];
          try { walk(node[key], path ? path + "." + key : key, depth + 1); } catch (_) {}
        }
      }

      walk(data, "data", 0);
      matches.sort(function (a, b) { return b.score - a.score; });

      return {
        entityHint: entityHint,
        strongEntityTokens: strongTokens,
        queryTokens: tokens,
        matchCount: matches.length,
        matches: matches.slice(0, 40),
        overview: safeSnapshot(data, 0, [])
      };
    }

    function extractRowsForAi(widgetData, maxRows) {
      var frame = widgetData && widgetData.data && widgetData.data.primaryData
        ? widgetData.data.primaryData
        : widgetData && widgetData.primaryData
          ? widgetData.primaryData
          : null;

      var items = frame && Array.isArray(frame.items) ? frame.items : [];
      var rows = [];

      items.slice(0, maxRows || 120).forEach(function (item) {
        if (!item || typeof item !== "object") return;

        var cols = Array.isArray(item.cols) && item.cols.length
          ? item.cols
          : (frame && Array.isArray(frame.cols) ? frame.cols : []);

        var keyValues = Array.isArray(item.formattedKeys) && item.formattedKeys.length
          ? item.formattedKeys
          : (Array.isArray(item.keys) ? item.keys : []);

        var measureValues = Array.isArray(item.formattedValues) && item.formattedValues.length
          ? item.formattedValues
          : (Array.isArray(item.values) ? item.values : []);

        var values = keyValues.concat(measureValues);
        var row = {};

        if (cols.length && values.length) {
          for (var i = 0; i < Math.min(cols.length, values.length); i++) {
            row[String(cols[i] == null ? ("col" + i) : cols[i])] = values[i];
          }
        } else {
          row.keys = keyValues;
          row.values = measureValues;
        }

        rows.push(row);
      });

      return rows;
    }

    function summarizeRows(rows) {
      var columns = {};
      rows.forEach(function (row) {
        Object.keys(row || {}).forEach(function (key) {
          var value = row[key];
          if (value === null || value === undefined || value === "") return;
          var text = String(value);
          if (!columns[key]) columns[key] = {};
          columns[key][text] = (columns[key][text] || 0) + 1;
        });
      });

      var summary = {};
      Object.keys(columns).forEach(function (key) {
        summary[key] = Object.keys(columns[key])
          .map(function (value) { return { value: value, count: columns[key][value] }; })
          .sort(function (a, b) { return b.count - a.count; })
          .slice(0, 30);
      });
      return summary;
    }

    function setFilterAsync(api, guid, values) {
      var setter = api.setFilterSelectedValues || api.SetFilterSelectedValues;
      if (typeof setter !== "function") return Promise.resolve(false);

      return new Promise(function (resolve) {
        var finished = false;
        function done(ok) {
          if (finished) return;
          finished = true;
          setTimeout(function () { resolve(ok); }, 650);
        }

        try {
          setter.call(api, guid, values, function () { done(true); });
          setTimeout(function () { done(true); }, 1600);
        } catch (_) {
          done(false);
        }
      });
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
        var rawByGuid = {};
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
            if (guid) rawByGuid[guid] = widget;
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

        var q = normalizeSearchText(question);
        var tokens = questionTokens(question);
        var entityHint = extractEntityHint(question);
        var strongTokens = strongEntityTokens(question);

        var explicitSheets = sheetIndex.filter(function (sheet) {
          var sn = normalizeSearchText(sheet.name);
          return sn && (q.indexOf(sn) >= 0 || tokens.some(function (t) { return sn.indexOf(t) >= 0; }));
        });

        var aiWidgetGuid = w && w.general ? String(w.general.guid || w.general.renderTo || "") : "";
        var usableWidgets = widgetIndex.filter(function (item) {
          if (!item.guid) return false;
          if (aiWidgetGuid && item.guid === aiWidgetGuid) return false;
          return !/imagewidget/i.test(item.type);
        });

        var pool;
        if (explicitSheets.length) {
          var sheetGuids = {};
          explicitSheets.forEach(function (sheet) { sheetGuids[sheet.guid] = true; });
          pool = usableWidgets.filter(function (item) { return !!sheetGuids[item.sheetGuid]; });
        } else {
          var currentPool = usableWidgets.filter(function (item) { return item.current; });
          pool = currentPool.length ? currentPool : usableWidgets;
        }

        var dataGetter = api.getWidgetDataByGuid || api.GetWidgetDataByGuid;
        var selectedGetter = api.getSelectedValues || api.GetSelectedValues;
        var widgetGetter = api.getWidgetByGuid || api.GetWidgetByGuid;

        function getSelected(guid) {
          if (typeof selectedGetter !== "function") return [];
          try {
            var value = selectedGetter.call(api, guid);
            return Array.isArray(value) ? value : [];
          } catch (_) {
            return [];
          }
        }

        function getData(info) {
          var selectedValues = /filter/i.test(info.type) ? getSelected(info.guid) : null;
          var runtime = null;
          if (typeof widgetGetter === "function" && info.current) {
            try { runtime = widgetGetter.call(api, info.guid); } catch (_) {}
          }

          var rawSummary = compactPrimitiveText(rawByGuid[info.guid], 0).trim().slice(0, 3000);

          if (typeof dataGetter !== "function") {
            return Promise.resolve({
              info: info,
              selectedValues: selectedValues,
              rawSummary: rawSummary,
              runtime: safeSnapshot(runtime, 0, []),
              error: "getWidgetDataByGuid() недоступен",
              relevance: selectedValues && selectedValues.length ? 15 : 0
            });
          }

          return Promise.resolve()
            .then(function () { return dataGetter.call(api, info.guid); })
            .then(function (data) {
              var targeted = targetedDataSnapshot(data, question);
              var rows = extractRowsForAi(data, explicitSheets.length ? 160 : 80);
              var rowSummary = summarizeRows(rows);

              var relevance = targeted.matchCount ? targeted.matches[0].score : 0;
              if (selectedValues && selectedValues.length) relevance = Math.max(relevance, 15);

              var hay = normalizeSearchText(
                [info.title, info.type, info.sheet, rawSummary, compactPrimitiveText(runtime, 0)].join(" ")
              );
              tokens.forEach(function (token) {
                if (hay.indexOf(token) >= 0) relevance += 3;
              });

              return {
                info: info,
                selectedValues: selectedValues,
                rawSummary: rawSummary,
                runtime: safeSnapshot(runtime, 0, []),
                relevance: relevance,
                data: targeted,
                rows: rows,
                columnSummary: rowSummary
              };
            })
            .catch(function (e) {
              return {
                info: info,
                selectedValues: selectedValues,
                rawSummary: rawSummary,
                runtime: safeSnapshot(runtime, 0, []),
                relevance: selectedValues && selectedValues.length ? 15 : 0,
                error: e && e.message ? e.message : String(e)
              };
            });
        }

        function intentSheetBonus(sheetGuid) {
          var qn = normalizeSearchText(question);
          var score = 0;
          var wantsTasks = /задан|задач|статист/i.test(qn);
          var wantsInteraction = /график.*взаимодейств|взаимодейств/i.test(qn);

          widgetIndex.forEach(function (widgetInfo) {
            if (widgetInfo.sheetGuid !== sheetGuid) return;
            var raw = compactPrimitiveText(rawByGuid[widgetInfo.guid], 0);
            var hay = normalizeSearchText([widgetInfo.title, widgetInfo.type, raw].join(" "));

            if (wantsTasks) {
              if (hay.indexOf("количество заданий") >= 0) score += 8;
              if (hay.indexOf("статистика по заданиям") >= 0) score += 18;
              if (hay.indexOf("статус задач") >= 0 || hay.indexOf("статус задан") >= 0) score += 5;
              if (hay.indexOf("просроч") >= 0 || hay.indexOf("выполн") >= 0 || hay.indexOf("истекает срок") >= 0) score += 3;
            }

            if (wantsInteraction && hay.indexOf("график") >= 0) score += 4;
          });

          return Math.min(score, 80);
        }

        function findAndApplyEntityFilter() {
          if (!tokens.length || typeof dataGetter !== "function") {
            return Promise.resolve({ applied: false });
          }

          var roots = tokens.map(tokenRoot).filter(function (x) { return x.length >= 4; });
          var genericRoots = {
            "проблем":1,"вопрос":1,"лини":1,"метр":1,"задач":1,"задан":1,
            "статистик":1,"объект":1,"проект":1,"данн":1,"показател":1,
            "статус":1,"просроч":1,"выполн":1,"работ":1,"срок":1,"начат":1,
            "информац":1,"сведен":1,"покаж":1,"собер":1,"найд":1
          };
          var distinctiveRoots = (strongTokens.length ? strongTokens : roots.filter(function (root) {
            return !genericRoots[root];
          }));

          function sheetAffinity(sheetGuid) {
            var score = 0;
            widgetIndex.forEach(function (widgetInfo) {
              if (widgetInfo.sheetGuid !== sheetGuid) return;
              var raw = compactPrimitiveText(rawByGuid[widgetInfo.guid], 0);
              var hay = normalizeSearchText([widgetInfo.title, raw].join(" "));
              roots.forEach(function (rootToken) {
                if (normalizedContainsToken(hay, rootToken)) score++;
              });
            });
            return Math.min(score, 25);
          }

          function pickFilterValue(best) {
            var valueObj = best && best.value ? best.value : {};
            var candidates = [];

            ["formattedValues","values","formattedKeys","keys"].forEach(function (key) {
              var arr = Array.isArray(valueObj[key]) ? valueObj[key] : [];
              arr.forEach(function (value) {
                if (value !== null && value !== undefined && String(value).trim()) {
                  candidates.push(String(value));
                }
              });
            });

            if (!candidates.length && best && best.text) candidates.push(String(best.text));
            if (!candidates.length && entityHint) candidates.push(entityHint);

            candidates = candidates.filter(function (value, idx) {
              return candidates.indexOf(value) === idx;
            });

            var targetRoots = distinctiveRoots.length ? distinctiveRoots : (strongTokens.length ? strongTokens : roots);
            candidates.sort(function (a, b) {
              function score(value) {
                var s = 0;
                targetRoots.forEach(function (rootToken) {
                  if (normalizedContainsToken(value, rootToken)) s += 35;
                });
                roots.forEach(function (rootToken) {
                  if (normalizedContainsToken(value, rootToken)) s += 3;
                });
                if (entityHint && normalizeSearchText(value) === normalizeSearchText(entityHint)) s += 60;
                s -= Math.min(String(value).length / 100, 4);
                return s;
              }
              return score(b) - score(a);
            });

            return candidates.length ? candidates[0] : "";
          }

          var filters = pool.filter(function (item) {
            return /filter/i.test(item.type);
          });

          return Promise.all(filters.map(function (filterInfo) {
            return Promise.resolve()
              .then(function () { return dataGetter.call(api, filterInfo.guid); })
              .then(function (data) {
                var targeted = targetedDataSnapshot(data, question);
                var best = targeted.matches && targeted.matches.length ? targeted.matches[0] : null;
                var normalizedTitle = normalizeSearchText(filterInfo.title);
                var titleBonus = 0;
                roots.forEach(function (rootToken) {
                  if (normalizedContainsToken(normalizedTitle, rootToken)) titleBonus += 18;
                });
                if (/объект|подобъект/i.test(normalizedTitle) && /объект|подобъект/i.test(q)) titleBonus += 18;

                var sheetMeta = sheetIndex.filter(function (sheet) {
                  return sheet.guid === filterInfo.sheetGuid;
                })[0];
                var visibilityBonus = sheetMeta && !sheetMeta.hidden ? 12 : -4;

                var affinityBonus = sheetAffinity(filterInfo.sheetGuid) * 2;
                var intentBonus = intentSheetBonus(filterInfo.sheetGuid);
                var filterValue = best ? pickFilterValue(best) : "";

                var distinctiveHits = 0;
                distinctiveRoots.forEach(function (rootToken) {
                  if (normalizedContainsToken(filterValue, rootToken)) distinctiveHits++;
                });
                var distinctiveBonus = distinctiveHits * 45;
                var distinctivePenalty = distinctiveRoots.length && distinctiveHits === 0 ? -80 : 0;

                return {
                  info: filterInfo,
                  targeted: targeted,
                  score: best
                    ? best.score + titleBonus + visibilityBonus + affinityBonus + intentBonus + distinctiveBonus + distinctivePenalty
                    : 0,
                  best: best,
                  filterValue: filterValue,
                  distinctiveHits: distinctiveHits
                };
              })
              .catch(function () {
                return { info: filterInfo, score: 0, best: null, filterValue: "" };
              });
          })).then(function (candidates) {
            candidates.sort(function (a, b) { return b.score - a.score; });
            var winner = candidates[0];

            if (!winner || !winner.best || winner.score <= 0 || !winner.filterValue) {
              return {
                applied: false,
                reason: "Подходящий фильтр сущности не найден",
                candidates: candidates.slice(0, 5).map(function (x) {
                  return { title: x.info.title, sheet: x.info.sheet, score: x.score, value: x.filterValue, distinctiveHits: x.distinctiveHits || 0 };
                })
              };
            }

            var previous = getSelected(winner.info.guid);

            return setFilterAsync(api, winner.info.guid, [[winner.filterValue]]).then(function (ok) {
              return {
                applied: !!ok,
                guid: winner.info.guid,
                title: winner.info.title,
                sheet: winner.info.sheet,
                sheetGuid: winner.info.sheetGuid,
                value: winner.filterValue,
                previous: previous,
                candidates: candidates.slice(0, 5).map(function (x) {
                  return { title: x.info.title, sheet: x.info.sheet, score: x.score, value: x.filterValue };
                })
              };
            });
          });
        }

        return findAndApplyEntityFilter().then(function (filterAction) {
          var effectivePool = filterAction.applied && filterAction.sheetGuid
            ? pool.filter(function (item) { return item.sheetGuid === filterAction.sheetGuid; })
            : pool;

          var scored = effectivePool.map(function (item) {
            var rawSummary = compactPrimitiveText(rawByGuid[item.guid], 0);
            var hay = normalizeSearchText([item.title, item.type, item.sheet, rawSummary, item.guid].join(" "));
            var score = item.current ? 1 : 0;

            tokens.forEach(function (token) {
              if (normalizedContainsToken(hay, token)) score += 5;
            });
            if (item.guid && q.indexOf(item.guid.toLowerCase()) >= 0) score += 50;
            if (/filter|userwidget|textwidget|datagrid/i.test(item.type)) score += 2;

            return { item: item, score: score };
          });

          scored.sort(function (a, b) { return b.score - a.score; });

          var broadAnalysis = /аномал|отклон|проблем|риск|обратить внимание|сводн|общ.*анализ|проанализ/i.test(question);
          var selectedLimit = (explicitSheets.length || filterAction.applied) ? 40 : (broadAnalysis ? 55 : 24);
          var selected = scored.slice(0, Math.min(scored.length, selectedLimit)).map(function (x) { return x.item; });

          return Promise.all(selected.map(getData)).then(function (allWidgetData) {
            var restorePromise = Promise.resolve();
            if (filterAction.applied) {
              restorePromise = setFilterAsync(api, filterAction.guid, filterAction.previous || []);
            }

            return restorePromise.then(function () {
              allWidgetData.forEach(function (item) {
                var rows = Array.isArray(item.rows) ? item.rows : [];
                var summaryKeys = item.columnSummary ? Object.keys(item.columnSummary) : [];
                var numericSignals = 0;
                rows.slice(0, 40).forEach(function (row) {
                  Object.keys(row || {}).forEach(function (key) {
                    var value = row[key];
                    if (value !== null && value !== "" && !isNaN(Number(String(value).replace(",", ".")))) {
                      numericSignals++;
                    }
                  });
                });
                item.analysisScore =
                  (item.relevance || 0) +
                  Math.min(rows.length, 20) +
                  Math.min(summaryKeys.length * 2, 12) +
                  Math.min(numericSignals, 10);
              });

              allWidgetData.sort(function (a, b) {
                return (b.analysisScore || 0) - (a.analysisScore || 0);
              });

              var matched = allWidgetData.filter(function (x) { return (x.relevance || 0) > 0; });
              var ownTargeted = targetedDataSnapshot(w && w.data ? w.data.primaryData : null, question);

              var dataToSend;
              if (explicitSheets.length || filterAction.applied) {
                dataToSend = allWidgetData.slice(0, 30);
              } else if (broadAnalysis) {
                dataToSend = allWidgetData.slice(0, 22);
              } else {
                dataToSend = matched.length ? matched.slice(0, 18) : allWidgetData.slice(0, 14);
              }

              function deriveMetric(item) {
                if (!item || !Array.isArray(item.rows) || item.rows.length !== 1) return null;
                var row = item.rows[0] || {};
                var keys = Object.keys(row);
                if (keys.length !== 1) return null;

                var column = keys[0];
                var value = row[column];
                if (value === null || value === undefined || value === "") return null;

                var raw = String(item.rawSummary || "");
                var label = "";
                var m = raw.match(/filterValue\[0\]\[0\]\s*==\s*["']([^"']+)["']/i);
                if (m && m[1]) label = m[1];

                var normalizedColumn = normalizeSearchText(column);
                if (!label) {
                  if (normalizedColumn === "количество заданий новое" || normalizedColumn.indexOf("количество заданий новое") >= 0) label = "Всего";
                  else if (normalizedColumn.indexOf("выполнено") >= 0) label = "Выполнено";
                  else if (normalizedColumn.indexOf("в работе") >= 0) label = "В работе";
                  else if (normalizedColumn.indexOf("истекает срок") >= 0) label = "Истекает срок";
                  else if (normalizedColumn.indexOf("не начато") >= 0) label = "Не начато";
                  else if (normalizedColumn.indexOf("просрочено") >= 0) label = "Просрочено";
                }

                if (!label) return null;
                return {
                  label: label,
                  value: value,
                  sourceColumn: column,
                  sourceWidgetGuid: item.info && item.info.guid || "",
                  sourceWidgetTitle: item.info && item.info.title || ""
                };
              }

              var metricMap = {};
              allWidgetData.forEach(function (item) {
                var metric = deriveMetric(item);
                if (metric && !metricMap[metric.label]) metricMap[metric.label] = metric;
              });
              var metricOrder = ["Всего", "Выполнено", "В работе", "Просрочено", "Не начато", "Истекает срок"];
              var derivedMetrics = metricOrder.map(function (label) {
                return metricMap[label];
              }).filter(Boolean);

              var compactSources = dataToSend.map(function (item) {
                return {
                  info: item.info,
                  selectedValues: item.selectedValues,
                  error: item.error,
                  relevance: item.relevance,
                  rows: Array.isArray(item.rows) ? item.rows.slice(0, 100) : [],
                  columnSummary: item.columnSummary || {},
                  matches: item.data && Array.isArray(item.data.matches) ? item.data.matches.slice(0, 8) : []
                };
              });

              var context = {
                dashboard: {
                  guid: getGuid(dashboard),
                  name: smartText(dashboard.name, 0),
                  sheets: sheetIndex
                },
                requestedSheet: explicitSheets.map(function (x) { return x.name; }),
                entityHint: entityHint,
                strongEntityTokens: strongTokens,
                queryTokens: tokens,
                filterAction: filterAction,
                derivedMetrics: derivedMetrics,
                allWidgets: widgetIndex,
                searchedWidgetCount: selected.length,
                matchedWidgetCount: matched.length,
                selectedWidgetData: dataToSend,
                ownWidgetData: ownTargeted,
                note:
                  "Если в вопросе указана сущность и найден соответствующий фильтр, VISI AI временно применяет фильтр, " +
                  "считывает данные виджетов целевого листа и затем восстанавливает прежнее значение фильтра. " +
                  "derivedMetrics — показатели, восстановленные по фактическим карточкам дашборда; их label соответствует подписи карточки."
              };

              postDiagnostic({
                capturedAt: new Date().toISOString(),
                kind: "question-context",
                version: version,
                question: question,
                context: context
              });

              var aiContext = {
                dashboardName: context.dashboard.name,
                requestedSheet: context.requestedSheet,
                entityHint: entityHint,
                filterAction: filterAction,
                derivedMetrics: derivedMetrics,
                searchedWidgetCount: selected.length,
                matchedWidgetCount: matched.length,
                selectedWidgetData: compactSources,
                note:
                  "При ответе в первую очередь используй derivedMetrics: это значения карточек целевого листа после применения фильтра сущности. " +
                  "Не переименовывай метрики по sourceColumn, если label уже задан."
              };

              return JSON.stringify(aiContext);
            });
          });
        });
      }).catch(function (e) {
        return JSON.stringify({
          error: e && e.message ? e.message : String(e),
          ownWidgetData: targetedDataSnapshot(w && w.data ? w.data.primaryData : null, question)
        });
      });
    }

    function send() {
      var text = inputEl.value.trim();
      if (!text) return;

      var existingPending = getPendingState();
      if (existingPending) {
        addMessage("assistant", "Предыдущий запрос ещё выполняется. Дождитесь завершения — ответ появится автоматически.");
        return;
      }

      inputEl.value = "";
      history = loadSavedHistory();
      addMessage("user", text);
      history.push({ role: "user", content: text });
      setPendingState(text, "Собираю данные и определяю нужный лист…");
      saveHistory();
      renderHistoryState(false);
      setBusy(true);

      var contextJson = "{}";
      var contextObject = null;
      var analysisRequest = buildAnalysisQuestion(text);

      function persistAssistant(answer) {
        history = loadSavedHistory();
        var last = history.length ? history[history.length - 1] : null;
        if (!last || last.role !== "assistant" || last.content !== answer) {
          history.push({ role: "assistant", content: answer });
        }
        saveHistory();
        clearPendingState();
      }

      function makeSystemPrompt() {
        return (
          "Ты AI-аналитик внутри BI-системы Visiology. Отвечай на русском, кратко и содержательно. " +
          "Используй Markdown: заголовки, списки и таблицы, когда это улучшает читаемость. " +
          "Не выдумывай отсутствующие значения и не предлагай пользователю проверять фильтры, если VISI AI уже получил данные. " +
          "Если в контексте есть derivedMetrics, считай их приоритетным фактическим представлением карточек дашборда после фильтрации. " +
          "Используй label и value из derivedMetrics буквально. Не переименовывай метрику по sourceColumn. " +
          "Если filterAction.applied=true, сущность была найдена и фильтр реально применён; не утверждай, что объект отсутствует. " +
          "При широком аналитическом вопросе ищи конкретные отклонения только в фактически переданных rows/columnSummary и отделяй факт от предположения. " +
          "Если вопрос про проблемы, в первую очередь анализируй источники с названиями «Проблемные вопросы», «Задачи», «Проблемы» или близкими по смыслу после применения найденного фильтра. " +
          "Если это продолжение предыдущего запроса, сохраняй объект и лист из filterAction/context и трактуй слова «все», «их», «эти», «просроченные» как относящиеся к текущей сущности, а не ко всему дашборду. " +
          "Ниже передан компактный контекст текущего вопроса.\n\n" + contextJson
        );
      }

      function buildDirectMetricAnswer(ctx) {
        if (!ctx || !Array.isArray(ctx.derivedMetrics) || !ctx.derivedMetrics.length) return "";
        if (!/статист|задан|сколько|всего|выполн|просроч|в работе|не начат|истекает срок/i.test(text)) return "";
        if (/покажи|выведи|перечисли|список|детал|все\s+просроч|все\s+выполн/i.test(text)) return "";

        var order = ["Всего", "Выполнено", "В работе", "Просрочено", "Не начато", "Истекает срок"];
        var map = {};
        ctx.derivedMetrics.forEach(function (metric) {
          if (metric && metric.label) map[metric.label] = metric.value;
        });

        var available = order.filter(function (label) {
          return Object.prototype.hasOwnProperty.call(map, label);
        });
        if (available.length < 3) return "";

        var entity = ctx.filterAction && ctx.filterAction.value
          ? ctx.filterAction.value
          : (ctx.entityHint || "");
        var sheet = ctx.filterAction && ctx.filterAction.sheet
          ? ctx.filterAction.sheet
          : (ctx.requestedSheet && ctx.requestedSheet[0] ? ctx.requestedSheet[0] : "");

        var out = "### Статистика по заданиям";
        if (entity) out += "\n**Объект:** " + entity;
        if (sheet) out += "\n**Лист:** " + sheet;
        out += "\n\n| Показатель | Значение |\n|---|---:|";
        available.forEach(function (label) {
          out += "\n| " + label + " | **" + map[label] + "** |";
        });
        return out;
      }

      function requestChat(targetEndpoint) {
        var latestHistory = loadSavedHistory();
        var priorUserMessages = latestHistory.filter(function (m) {
          return m.role === "user";
        });
        var usePrior = text.length < 45 || /^(а\b|а по|теперь|сравни|что насчет|что по|а если)/i.test(text);
        var userMessages = usePrior
          ? priorUserMessages.slice(-3)
          : [{ role: "user", content: text }];

        if (!userMessages.length || userMessages[userMessages.length - 1].content !== text) {
          userMessages.push({ role: "user", content: text });
        }

        return fetch(targetEndpoint + "/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: makeSystemPrompt()
              }
            ].concat(userMessages)
          })
        }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
      }

      collectDashboardContext(analysisRequest.text)
      .then(function (ctx) {
        contextJson = ctx;
        try {
          contextObject = JSON.parse(ctx);
          renderAnswerData(contextObject, text);
          saveSessionContextFromAnswer(contextObject, text);
          lastDiagnostic = {
            kind: "question-context",
            version: version,
            capturedAt: new Date().toISOString(),
            question: text,
            endpoint: endpoint,
            dashboardGuid: dashboardGuidForHistory,
            inheritedConversationContext: analysisRequest.inherited ? analysisRequest.context : null,
            analysisQuestion: analysisRequest.text,
            context: contextObject
          };
        } catch (_) {
          contextObject = null;
          renderAnswerData(null, text);
        }

        var directAnswer = buildDirectMetricAnswer(contextObject);
        if (directAnswer) {
          updatePendingPhase("Формирую ответ по полученным показателям…");
          return Promise.resolve({ message: { content: directAnswer }, direct: true });
        }

        updatePendingPhase("Анализирую данные…");
        return requestChat(endpoint);
      })
      .catch(function (e) {
        if (endpoint === localEndpoint) throw e;
        endpoint = localEndpoint;
        try {
          statusEl.textContent = "Интернет недоступен · пробую локально";
        } catch (_) {}
        return requestChat(localEndpoint);
      })
      .then(function (data) {
        var answer = data && data.message && data.message.content ? data.message.content : "Пустой ответ";
        persistAssistant(answer);

        lastDiagnostic = {
          kind: "question-result",
          version: version,
          capturedAt: new Date().toISOString(),
          question: text,
          endpoint: endpoint,
          dashboardGuid: dashboardGuidForHistory,
          inheritedConversationContext: analysisRequest.inherited ? analysisRequest.context : null,
          analysisQuestion: analysisRequest.text,
          answer: answer,
          context: contextObject
        };
        postDiagnostic(lastDiagnostic);
      })
      .catch(function (e) {
        var errorText = "**Ошибка:** " + (e && e.message ? e.message : String(e));
        persistAssistant(errorText);

        lastDiagnostic = {
          kind: "question-result",
          version: version,
          capturedAt: new Date().toISOString(),
          question: text,
          endpoint: endpoint,
          dashboardGuid: dashboardGuidForHistory,
          inheritedConversationContext: analysisRequest.inherited ? analysisRequest.context : null,
          analysisQuestion: analysisRequest.text,
          error: e && e.message ? e.message : String(e),
          context: contextObject
        };
        postDiagnostic(lastDiagnostic);
      })
      .finally(function () {
        try {
          setBusy(false);
          inputEl.focus();
        } catch (_) {}
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
        setTimeout(function () {
          if (!scanEl.disabled) {
            scanDashboard();
          }
        }, 700);
      })
      .catch(function (e) {
        statusEl.textContent = "Нет связи";
        statusEl.style.color = "#b91c1c";
        addMessage("assistant", "**Нет связи с Ollama:** " + e.message);
      });
  };
})();