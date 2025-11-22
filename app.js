/* app.js - WebSocket Client App (ChatGPT5 Edition)
 * Single-file vanilla JS. Modular, extensible, and storage-backed.
 * No external deps. Designed for clarity + power.
 */
(() => {
  "use strict";

  /*****************************
   * Utilities
   *****************************/
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (n, a, b) => Math.min(Math.max(n, a), b);
  const now = () => new Date();
  const fmtTime = (d = now()) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
      d.getSeconds()
    ).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const once = (fn) => {
    let done = false;
    return (...args) => {
      if (!done) {
        done = true;
        return fn(...args);
      }
    };
  };

  /*****************************
   * Storage (localStorage wrapper)
   *****************************/
  const Storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    del(key) {
      localStorage.removeItem(key);
    },
  };

  /*****************************
   * Logger (UI + counters + filters)
   *****************************/
  const Log = (() => {
    const el = {
      body: qs("#logsBody"),
      rx: qs("#rxCount"),
      tx: qs("#txCount"),
      err: qs("#errCount"),
      menuBtn: qs("#logsMenuBtn"),
      menu: qs("#logsMenu"),
      copyBtn: qs("#copyLogsBtn"),
      clearBtn: qs("#clearLogsBtn"),
      downloadBtn: qs("#downloadLogsBtn"),
    };

    let filter = "all"; // all | ok | warn | err | rx | tx
    let counters = { rx: 0, tx: 0, err: 0 };
    
    /** Public API */
    const api = {
      info(msg) {
        append("ok", msg);
      },
      warn(msg) {
        append("warn", msg);
      },
      error(msg) {
        counters.err++;
        updateCounters();
        append("err", msg);
      },
      rx(msg) {
        counters.rx++;
        updateCounters();
        append("rx", msg);
      },
      tx(msg) {
        counters.tx++;
        updateCounters();
        append("tx", msg);
      },
      // New category-specific methods with badges
      http(msg, status) {
        const badge = status ? `HTTP ${status}` : 'HTTP';
        appendWithBadge("ok", badge, msg, "http");
      },
      ws(msg, status = "info") {
        const levelMap = { info: "ok", warn: "warn", error: "err" };
        appendWithBadge(levelMap[status] || "ok", "WS", msg, "ws");
      },
      instance(msg, status = "info") {
        const levelMap = { info: "ok", warn: "warn", error: "err" };
        appendWithBadge(levelMap[status] || "ok", "INST", msg, "instance");
      },
      action(msg, status = "info") {
        const levelMap = { info: "ok", warn: "warn", error: "err" };
        appendWithBadge(levelMap[status] || "ok", "ACT", msg, "action");
      },
      raw(line, level = "ok") {
        append(level, line);
      },
      setFilter(mode) {
        filter = mode;
        applyFilter();
      },
      copyAll() {
        const text = qsa(".logline", el.body).map((n) => n.innerText).join("\n");
        navigator.clipboard.writeText(text).then(() => Toast.ok("Logs copied"));
      },
      clear() {
        el.body.innerHTML = "";
      },
      download() {
        const content = qsa(".logline", el.body).map((n) => n.innerText).join("\n");
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ws-client-logs-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
    };

    function append(level, msg) {
      // Create badge for rx/tx, regular tag for others
      let badge = "";
      if (level === "rx") {
        badge = '<span class="log-badge log-badge--rx">RX</span>';
      } else if (level === "tx") {
        badge = '<span class="log-badge log-badge--tx">TX</span>';
      }
      
      addLogLine(level, badge, msg);
    }

    function appendWithBadge(level, badgeText, msg, badgeType = "info") {
      // Create colored badge based on type
      const badge = `<span class="log-badge log-badge--${badgeType}">${escapeHTML(badgeText)}</span>`;
      addLogLine(level, badge, msg);
    }

    function addLogLine(level, badge, msg) {
      const line = document.createElement("div");
      line.className = `logline log--${level}`;
      
      line.innerHTML = `
        <div class="logline__ts">${fmtTime()}</div>
        <div class="logline__msg">${badge}${escapeHTML(String(msg))}</div>
        <div class="logline__tag">${tagName(level)}</div>
      `;
      el.body.appendChild(line);
      if (el.body.childElementCount > 2000) {
        el.body.removeChild(el.body.firstElementChild);
      }
      if (shouldShow(level)) {
        line.style.display = "";
      } else {
        line.style.display = "none";
      }
      el.body.scrollTop = el.body.scrollHeight + 1000;
    }

    function updateCounters() {
      el.rx.textContent = counters.rx;
      el.tx.textContent = counters.tx;
      el.err.textContent = counters.err;
    }

    function tagName(level) {
      if (level === "ok") return "info";
      if (level === "warn") return "warn";
      if (level === "err") return "error";
      if (level === "rx") return "recv";
      if (level === "tx") return "sent";
      return level;
    }

    function shouldShow(level) {
      return filter === "all" ? true : level === filter;
    }

    function applyFilter() {
      qsa(".logline", el.body).forEach((n) => {
        n.style.display = n.classList.contains(`log--${filter}`) || filter === "all" ? "" : "none";
      });
    }

    function wireMenu() {
      el.menuBtn.addEventListener("click", () => {
        const show = !el.menu.classList.contains("show");
        el.menu.classList.toggle("show", show);
        el.menuBtn.setAttribute("aria-expanded", String(show));
      });
      document.addEventListener("click", (e) => {
        if (!el.menu.contains(e.target) && !el.menuBtn.contains(e.target)) {
          el.menu.classList.remove("show");
          el.menuBtn.setAttribute("aria-expanded", "false");
        }
      });
      el.menu.addEventListener("click", (e) => {
        const t = e.target.closest("[data-filter]");
        if (t) {
          api.setFilter(t.getAttribute("data-filter"));
          el.menu.classList.remove("show");
        }
      });
      el.copyBtn.addEventListener("click", api.copyAll);
      el.clearBtn.addEventListener("click", api.clear);
      el.downloadBtn.addEventListener("click", api.download);
    }

    function escapeHTML(s) {
      return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
    }

    wireMenu();
    return api;
  })();

  /*****************************
   * Toasts
   *****************************/
  const Toast = (() => {
    const host = qs("#toasts");
    function show(msg, kind = "ok", ms = 2600) {
      const el = document.createElement("div");
      el.className = `toast toast--${kind}`;
      el.innerHTML = `
        <svg class="icon">${kind === "err" ? '<use href="#i-power"></use>' : '<use href="#i-check"></use>'}</svg>
        <div>${msg}</div>
        <button class="btn btn--ghost">Close</button>
      `;
      const close = () => el.remove();
      el.querySelector("button").addEventListener("click", close);
      host.appendChild(el);
      setTimeout(close, ms);
    }
    return {
      ok: (m, ms) => show(m, "ok", ms),
      err: (m, ms) => show(m, "err", ms),
    };
  })();

  /*****************************
   * HTTP Client (reusable for fetching instance info)
   *****************************/
  const HTTPClient = {
    async get(url, path = "/") {
      const httpUrl = toHttpBase(url) + path;
      Log.http(`GET ${httpUrl}`);
      const r = await fetch(httpUrl, { cache: "no-store" });
      const txt = await r.text();
      Log.http(`Response from ${path}`, r.status);
      return { status: r.status, text: txt };
    },
    parseInfo(text) {
      const info = {};
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line) => {
          const idx = line.indexOf(":");
          if (idx > -1) {
            const k = line.slice(0, idx).trim().toLowerCase();
            const v = line.slice(idx + 1).trim();
            info[k] = v;
          }
        });
      return info;
    },
  };
  function toHttpBase(wsUrl) {
    try {
      const u = new URL(wsUrl);
      const proto = u.protocol === "wss:" ? "https:" : "http:";
      return `${proto}//${u.host}`;
    } catch {
      return wsUrl;
    }
  }

  /*****************************
   * Unified Connection Client (WebSocket + Socket.IO)
   *****************************/
  class ConnectionClient {
    constructor({ onOpen, onClose, onMessage, onError, getUrl, getDelay }) {
      this.onOpen = onOpen;
      this.onClose = onClose;
      this.onMessage = onMessage;
      this.onError = onError;
      this.getUrl = getUrl;
      this.getDelay = getDelay;
      this.connection = null;
      this.connectionType = null; // 'websocket' or 'socketio'
      this._reconnectTimer = null;
      this._manualClose = false;
      this._attempt = 0;
    }

    _detectConnectionType(url) {
      // Auto-detect: if URL contains 'socket.io' or uses HTTP/HTTPS, prefer Socket.IO
      // Otherwise use native WebSocket
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('socket.io') || lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
        return 'socketio';
      }
      return 'websocket';
    }

    connect() {
      const url = this.getUrl();
      if (!url) return Log.ws("No URL configured", "warn");
      this._manualClose = false;
      
      // Detect connection type
      this.connectionType = this._detectConnectionType(url);
      
      if (this.connectionType === 'socketio') {
        this._connectSocketIO(url);
      } else {
        this._connectWebSocket(url);
      }
    }

    _connectWebSocket(url) {
      try {
        Log.ws(`Connecting via WebSocket to ${url}`);
        const ws = new WebSocket(url);
        this.connection = ws;

        ws.addEventListener("open", () => {
          this._attempt = 0;
          Log.ws(`Connected via WebSocket to ${url}`);
          this.onOpen?.();
        });

        ws.addEventListener("message", (ev) => {
          const text = String(ev.data || "");
          Log.rx(text);
          this.onMessage?.(text);
        });

        ws.addEventListener("error", (ev) => {
          Log.ws(`Error: ${ev.message || "unknown"}`, "error");
          this.onError?.(ev);
        });

        ws.addEventListener("close", (ev) => {
          Log.ws(`Closed (code=${ev.code}, reason=${ev.reason || "none"})`, "warn");
          this.onClose?.(ev);
          if (!this._manualClose && App.state.autoReconnect) {
            this.scheduleReconnect();
          }
        });
      } catch (e) {
        Log.ws(`Connection failed: ${e.message}`, "error");
        this.scheduleReconnect();
      }
    }

    _connectSocketIO(url) {
      try {
        // Convert ws:// or wss:// URLs to http:// or https://
        let ioUrl = url;
        if (url.startsWith('ws://')) {
          ioUrl = url.replace('ws://', 'http://');
        } else if (url.startsWith('wss://')) {
          ioUrl = url.replace('wss://', 'https://');
        }
        
        // Remove any path like /ws from the URL for Socket.IO
        const urlObj = new URL(ioUrl);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        
        Log.ws(`Connecting via Socket.IO to ${baseUrl}`);
        
        // Check if Socket.IO is loaded
        if (typeof io === 'undefined') {
          Log.ws("Socket.IO library not loaded", "error");
          return;
        }
        
        const socket = io(baseUrl, {
          reconnection: false, // We handle reconnection manually
          transports: ['websocket', 'polling'] // Try websocket first, fallback to polling
        });
        this.connection = socket;

        socket.on("connect", () => {
          this._attempt = 0;
          Log.ws(`Connected via Socket.IO to ${baseUrl}`);
          this.onOpen?.();
        });

        socket.on("message", (data) => {
          // Standard message event - keep original format
          const text = typeof data === 'string' ? data : JSON.stringify(data);
          Log.rx(text);
          this.onMessage?.(text);
        });

        // Listen for any custom events as well
        socket.onAny((eventName, ...args) => {
          if (eventName !== 'connect' && eventName !== 'disconnect' && eventName !== 'message' && eventName !== 'error' && eventName !== 'connect_error') {
            // For custom events, we need to indicate the event name somehow
            // Send as-is if single string argument, otherwise wrap with event info
            if (args.length === 1 && typeof args[0] === 'string') {
              Log.rx(args[0]);
              this.onMessage?.(args[0]);
            } else {
              const text = JSON.stringify({ event: eventName, data: args });
              Log.rx(text);
              this.onMessage?.(text);
            }
          }
        });

        socket.on("error", (err) => {
          Log.ws(`Error: ${err.message || "unknown"}`, "error");
          this.onError?.(err);
        });

        socket.on("disconnect", (reason) => {
          Log.ws(`Disconnected (reason: ${reason})`, "warn");
          this.onClose?.({ reason });
          if (!this._manualClose && App.state.autoReconnect) {
            this.scheduleReconnect();
          }
        });

        socket.on("connect_error", (err) => {
          Log.ws(`Connection error: ${err.message}`, "error");
          if (!this._manualClose && App.state.autoReconnect) {
            this.scheduleReconnect();
          }
        });
      } catch (e) {
        Log.ws(`Connection failed: ${e.message}`, "error");
        this.scheduleReconnect();
      }
    }

    scheduleReconnect() {
      clearTimeout(this._reconnectTimer);
      const base = Number(App.state.reconnectDelay) || 1500;
      const jitter = Math.random() * 250;
      const backoff = Math.min(8000, this._attempt * 300);
      const delay = base + jitter + backoff;
      this._attempt++;
      Log.ws(`Reconnecting in ${Math.round(delay)}ms`, "warn");
      this._reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    disconnect() {
      this._manualClose = true;
      clearTimeout(this._reconnectTimer);
      
      if (this.connection) {
        if (this.connectionType === 'socketio') {
          this.connection.disconnect();
        } else if (this.connectionType === 'websocket') {
          if (this.connection.readyState === WebSocket.OPEN || this.connection.readyState === WebSocket.CONNECTING) {
            this.connection.close(1000, "client-close");
          }
        }
      }
      this.connection = null;
    }

    send(text) {
      if (!this.connection) {
        Log.ws("Send failed: not connected", "warn");
        return false;
      }

      if (this.connectionType === 'socketio') {
        if (this.connection.connected) {
          // Try to parse as JSON to send as object, otherwise send as message event
          try {
            const data = JSON.parse(text);
            if (data.event) {
              // If message has event field, emit that event
              this.connection.emit(data.event, data.data || data);
            } else {
              this.connection.emit('message', text);
            }
          } catch {
            this.connection.emit('message', text);
          }
          Log.tx(text);
          return true;
        } else {
          Log.ws("Send failed: Socket.IO not connected", "warn");
          return false;
        }
      } else if (this.connectionType === 'websocket') {
        if (this.connection.readyState === WebSocket.OPEN) {
          this.connection.send(text);
          Log.tx(text);
          return true;
        } else {
          Log.ws("Send failed: connection not open", "warn");
          return false;
        }
      }
      return false;
    }

    isOpen() {
      if (!this.connection) return false;
      if (this.connectionType === 'socketio') {
        return this.connection.connected;
      } else if (this.connectionType === 'websocket') {
        return this.connection.readyState === WebSocket.OPEN;
      }
      return false;
    }
  }

  /*****************************
   * Actions Registry (extensible)
   *****************************/
  const Actions = (() => {
    const registry = new Map();

    function define(name, handler) {
      registry.set(name, handler);
    }

    async function run(name, ctx, el) {
      const fn = registry.get(name);
      if (!fn) return Log.action(`Unknown action: ${name}`, "warn");
      try {
        await fn(ctx, el);
      } catch (e) {
        Log.action(`Error in ${name}: ${e.message}`, "error");
      }
    }

    // Built-ins
    define("ws:send", (ctx, el) => {
      const msg = el?.getAttribute("data-message") || "ping:1";
      ctx.ws.send(msg);
    });

    define("http:get", async (ctx, el) => {
      const path = el?.getAttribute("data-path") || "/";
      const { status, text } = await HTTPClient.get(ctx.url(), path);
      if (text.length <= 500) {
        Log.http(`Response body: ${text}`);
      } else {
        Log.http(`Response body: ${text.slice(0, 500)}... (${text.length} chars)`);
      }
      if (path === "/info") {
        const info = HTTPClient.parseInfo(text);
        UI.setInstanceInfo(ctx.url(), info);
      }
    });

    define("app:clear-logs", () => Log.clear());

    define("app:reconnect", (ctx) => {
      ctx.ws.disconnect();
      ctx.ws.connect();
    });

    define("app:toggle-auto", (ctx) => {
      App.state.autoReconnect = !App.state.autoReconnect;
      UI.updateAutoToggle();
      App.persist();
      Log.action(`Auto-reconnect ${App.state.autoReconnect ? 'enabled' : 'disabled'}`);
    });

    // Example of an easy custom action you can add later:
    // Actions.define('ws:set-led', (ctx) => ctx.ws.send('led:on'));

    return { define, run };
  })();

  /*****************************
   * UI & State
   *****************************/
  const UI = (() => {
    const el = {
      statusDot: qs("#statusDot"),
      statusText: qs("#statusText"),
      connectBtn: qs("#connectBtn"),
      disconnectBtn: qs("#disconnectBtn"),
      themeToggle: qs("#themeToggle"),
      serverUrl: qs("#serverUrl"),
      saveServerBtn: qs("#saveServerBtn"),
      recentServers: qs("#recentServers"),
      instanceList: qs("#instanceList"),
      autoConnect: qs("#autoConnect"),
      autoReconnect: qs("#autoReconnect"),
      reconnectDelay: qs("#reconnectDelay"),
      instanceInfo: qs("#instanceInfo"),
      instanceStateChip: qs("#instanceStateChip"),
      actionsGrid: qs("#actionsGrid"),
      countdown: qs("#countdown"),
    };

    function init() {
      // Theme
      const theme = Storage.get("theme", "dark");
      document.documentElement.setAttribute("data-theme", theme);
      el.themeToggle.addEventListener("click", toggleTheme);

      // Inputs
      el.saveServerBtn.addEventListener("click", saveCurrentServer);
      el.serverUrl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          el.connectBtn.click();
        }
      });

      el.connectBtn.addEventListener("click", App.connect);
      el.disconnectBtn.addEventListener("click", App.disconnect);

      el.autoConnect.addEventListener("input", () => {
        App.state.autoConnect = el.autoConnect.checked;
        App.persist();
      });
      el.autoReconnect.addEventListener("input", () => {
        App.state.autoReconnect = el.autoReconnect.checked;
        App.persist();
      });
      el.reconnectDelay.addEventListener("input", () => {
        App.state.reconnectDelay = clamp(Number(el.reconnectDelay.value) || 0, 250, 60000);
        App.persist();
      });

      // Instance dropdown
      el.instanceList.addEventListener("input", () => {
        const url = el.instanceList.value;
        if (url) {
          el.serverUrl.value = url;
          App.state.serverUrl = url;
          App.persist();
        }
      });

      // Actions grid
      el.actionsGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".action");
        if (!btn) return;
        const name = btn.getAttribute("data-action");
        Actions.run(name, App.ctx(), btn);
      });

      // Live validation hooks are provided by AppUI.validateInput
      populateFromState();
      populateHistory();
      populateInstances();

      // Auto-connect if requested
      if (App.state.autoConnect && App.state.serverUrl) {
        App.connect();
      }
    }

    function populateFromState() {
      const s = App.state;
      el.serverUrl.value = s.serverUrl || "";
      el.autoConnect.checked = !!s.autoConnect;
      el.autoReconnect.checked = s.autoReconnect !== false;
      el.reconnectDelay.value = s.reconnectDelay ?? 1500;
    }

    function populateHistory() {
      const recent = Storage.get("recentServers", []);
      el.recentServers.innerHTML = recent.map((u) => `<option value="${escapeHTML(u)}">`).join("");
    }

    function populateInstances() {
      const instances = Storage.get("instances", []); // [{url,name,lastError}]
      el.instanceList.innerHTML = "";
      instances.forEach((d) => {
        const o = document.createElement("option");
        o.value = d.url;
        o.textContent = d.name ? `${d.name} — ${d.url}` : d.url;
        if (d.lastError) o.textContent += ` (err)`;
        el.instanceList.appendChild(o);
      });
    }

    function setStatus(kind, text) {
      el.statusText.textContent = text;
      el.statusDot.classList.remove("is-ok", "is-err");
      if (kind === "ok") el.statusDot.classList.add("is-ok");
      if (kind === "err") el.statusDot.classList.add("is-err");
    }

    function toggleTheme() {
      const cur = document.documentElement.getAttribute("data-theme") || "dark";
      const next = cur === "dark" ? "auto" : cur === "auto" ? "dark" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      Storage.set("theme", next);
    }

    function saveCurrentServer() {
      const url = el.serverUrl.value.trim();
      if (!Validators.url(url)) {
        AppUI.markInvalid(el.serverUrl, "serverUrlErr", true);
        Toast.err("Invalid WebSocket URL");
        return;
      }
      const recent = Storage.get("recentServers", []);
      if (!recent.includes(url)) {
        recent.unshift(url);
        if (recent.length > 20) recent.pop();
        Storage.set("recentServers", recent);
        populateHistory();
      }
      addOrUpdateInstance(url, { name: "", lastError: "" });
      populateInstances();
      Toast.ok("Saved to history");
    }

    function addOrUpdateInstance(url, { name, lastError }) {
      const instances = Storage.get("instances", []);
      const i = instances.findIndex((d) => d.url === url);
      if (i === -1) instances.push({ url, name: name || "", lastError: lastError || "" });
      else {
        if (name !== undefined) instances[i].name = name;
        if (lastError !== undefined) instances[i].lastError = lastError;
      }
      Storage.set("instances", instances);
    }

    function setInstanceInfo(url, info) {
      qs('[data-k="host"]', el.instanceInfo).textContent = new URL(url).host;
      qs('[data-k="name"]', el.instanceInfo).textContent = info.name || "—";
      qs('[data-k="firmware"]', el.instanceInfo).textContent = info.firmware || "—";
      qs('[data-k="uptime"]', el.instanceInfo).textContent = info.uptime || "—";
      el.instanceStateChip.textContent = info.name ? `${info.name}` : "Instance";
      addOrUpdateInstance(url, { name: info.name || "", lastError: "" });
      populateInstances();
    }

    function setInstanceError(url, errText) {
      addOrUpdateInstance(url, { lastError: errText || "error" });
      populateInstances();
    }

    function updateButtons(connected) {
      el.connectBtn.disabled = connected;
      el.disconnectBtn.disabled = !connected;
    }

    function updateAutoToggle() {
      el.autoReconnect.checked = !!App.state.autoReconnect;
    }

    function clearInstanceInfo() {
      qsa(".kv__v", el.instanceInfo).forEach((n) => (n.textContent = "—"));
      el.instanceStateChip.textContent = "No instance";
    }

    return {
      init,
      setStatus,
      updateButtons,
      updateAutoToggle,
      setInstanceInfo,
      setInstanceError,
      clearInstanceInfo,
      elements: el,
    };
  })();

  /*****************************
   * Validators & AppUI hooks
   *****************************/
  const Validators = {
    url(v) {
      return /^(wss?|https?):\/\/([^\s:\/]+)(:\d+)?(\/[^\s]*)?$/.test(v);
    },
    numberIn(v, min, max) {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max;
    },
  };

  // Expose for HTML inline oninput
  window.AppUI = {
    validateInput(e) {
      const t = e?.target;
      if (!t) return;
      if (t.id === "serverUrl") {
        const ok = Validators.url(t.value.trim());
        AppUI.markInvalid(t, "serverUrlErr", !ok);
      } else if (t.id === "reconnectDelay") {
        const ok = Validators.numberIn(t.value, 250, 60000);
        AppUI.markInvalid(t, "reconnectDelayErr", !ok);
      } else {
        // generic check for required fields
        AppUI.markInvalid(t, "", !t.checkValidity());
      }
    },
    markInvalid(input, errId, invalid) {
      input.setAttribute("aria-invalid", invalid ? "true" : "false");
      if (errId) {
        const e = qs("#" + errId);
        if (e) e.classList.toggle("show", !!invalid);
      }
      input.classList.toggle("invalid", !!invalid);
    },
  };

  /*****************************
   * Countdown Effect (reusable)
   *****************************/
  const Countdown = (() => {
    async function show(el, onComplete) {
      if (!el) return;
      el.classList.add("show");
      // retrigger CSS animations
      el.querySelectorAll(".countdown__num").forEach((n) => {
        n.style.animation = "none";
        // eslint-disable-next-line no-unused-expressions
        n.offsetHeight; // reflow
        n.style.animation = "";
      });
      await sleep(4000);
      el.classList.remove("show");
      if (onComplete) onComplete();
    }

    return { show };
  })();

  /*****************************
   * App Core
   *****************************/
  const App = {
    state: {
      serverUrl: Storage.get("serverUrl", ""),
      autoConnect: Storage.get("autoConnect", false),
      autoReconnect: Storage.get("autoReconnect", true),
      reconnectDelay: Storage.get("reconnectDelay", 1500),
    },
    persist() {
      Storage.set("serverUrl", App.state.serverUrl);
      Storage.set("autoConnect", App.state.autoConnect);
      Storage.set("autoReconnect", App.state.autoReconnect);
      Storage.set("reconnectDelay", App.state.reconnectDelay);
    },
    ctx() {
      return {
        ws: App.ws,
        url: () => App.state.serverUrl,
        log: Log,
      };
    },
    async connect() {
      const url = UI.elements.serverUrl.value.trim();
      if (!Validators.url(url)) {
        AppUI.markInvalid(UI.elements.serverUrl, "serverUrlErr", true);
        return Toast.err("Enter a valid URL (WebSocket or Socket.IO)");
      }
      App.state.serverUrl = url;
      App.persist();
      UI.updateButtons(true);
      UI.setStatus("warn", "Connecting…");
      UI.clearInstanceInfo();

      // Check availability via /info only for WebSocket URLs
      // Socket.IO servers may not have this endpoint
      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        try {
          const res = await HTTPClient.get(url, "/info");
          if (String(res.status).startsWith("2")) {
            const info = HTTPClient.parseInfo(res.text);
            UI.setInstanceInfo(url, info);
            Log.instance("Instance available and responding");
          } else {
            UI.setInstanceError(url, `http:${res.status}`);
            Log.instance(`Instance returned status ${res.status}`, "warn");
          }
        } catch (e) {
          Log.instance(`Failed to fetch instance info: ${e.message}`, "warn");
          UI.setInstanceError(url, e.message);
        }
      }

      App.ws.connect();
    },
    disconnect() {
      App.ws.disconnect();
      UI.updateButtons(false);
      UI.setStatus("err", "Disconnected");
    },
    handleWSMessage(text) {
      // Format is "key:value" (no spaces)
      const idx = text.indexOf(":");
      if (idx === -1) {
        Log.raw(text, "ok");
        return;
      }
      const key = text.slice(0, idx);
      const val = text.slice(idx + 1);

      // Built-in handlers (example)
      switch (key) {
        case "name":
        case "firmware":
        case "uptime": {
          const info = {};
          info[key] = val;
          UI.setInstanceInfo(App.state.serverUrl, info);
          break;
        }
        case "log":
          Log.info(val);
          break;
        case "warn":
          Log.warn(val);
          break;
        case "error":
          Log.error(val);
          break;
        default:
          // Unrecognized => write raw line
          Log.raw(`${key}:${val}`, "ok");
      }
    },
  };

  // Instantiate Connection client (supports WebSocket and Socket.IO)
  App.ws = new ConnectionClient({
    getUrl: () => App.state.serverUrl,
    getDelay: () => App.state.reconnectDelay,
    onOpen: () => {
      UI.setStatus("ok", "Connected");
      UI.updateButtons(true);
      Toast.ok("Connected");
    },
    onClose: () => {
      UI.setStatus("err", "Disconnected");
      UI.updateButtons(false);
    },
    onMessage: (txt) => App.handleWSMessage(txt),
    onError: (ev) => {
      UI.setStatus("err", "Error");
      Toast.err("Connection error");
    },
  });

  /*****************************
   * Boot
   *****************************/
  document.addEventListener("DOMContentLoaded", () => {
    UI.init();

    // Example: extend with your own actions (public API)
    // Add a button like:
    // <button class="action" data-action="custom:hello"></button>
    Actions.define("custom:hello", (ctx) => {
      ctx.log.info("custom:hello-start");
      ctx.ws.send("hello:world");
    });

    // Example: Use countdown effect for custom action
    // Actions.define("custom:countdown-demo", async (ctx) => {
    //   await Countdown.show(UI.elements.countdown, () => {
    //     Toast.ok("Countdown complete!");
    //   });
    // });

    // Wire instance availability polling (optional)
    setInterval(async () => {
      const url = App.state.serverUrl;
      if (!url) return;
      try {
        const { status } = await HTTPClient.get(url, "/info");
        if (!String(status).startsWith("2")) {
          UI.setInstanceError(url, `http:${status}`);
        }
      } catch (e) {
        UI.setInstanceError(url, e.message);
      }
    }, 15000);
  });

  /*****************************
   * Helpers
   *****************************/
  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  // Expose minimal public API for you to customize at runtime if desired
  window.WebSocketClientApp = {
    Actions,
    Log,
    Storage,
    HTTPClient,
    Countdown,
    App,
  };
})();
