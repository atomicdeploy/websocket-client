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

    let filter = "all"; // all | ok | warn | err
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
        append("ok", `rx:${msg}`);
      },
      tx(msg) {
        counters.tx++;
        updateCounters();
        append("ok", `tx:${msg}`);
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
      const line = document.createElement("div");
      line.className = `logline log--${level}`;
      line.innerHTML = `
        <div class="logline__ts">${fmtTime()}</div>
        <div class="logline__msg">${escapeHTML(String(msg))}</div>
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
   * HTTP Client (/info parser)
   *****************************/
  const HTTPClient = {
    async get(url, path = "/") {
      const httpUrl = toHttpBase(url) + path;
      Log.info(`http:get:${httpUrl}`);
      const r = await fetch(httpUrl, { cache: "no-store" });
      const txt = await r.text();
      Log.info(`http:status:${r.status}`);
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
   * WS Client (auto reconnect)
   *****************************/
  class WSClient {
    constructor({ onOpen, onClose, onMessage, onError, getUrl, getDelay }) {
      this.onOpen = onOpen;
      this.onClose = onClose;
      this.onMessage = onMessage;
      this.onError = onError;
      this.getUrl = getUrl;
      this.getDelay = getDelay;
      this.ws = null;
      this._reconnectTimer = null;
      this._manualClose = false;
      this._attempt = 0;
    }
    connect() {
      const url = this.getUrl();
      if (!url) return Log.warn("ws:no-url");
      this._manualClose = false;
      try {
        Log.info(`connecting:${url}`);
        const ws = new WebSocket(url);
        this.ws = ws;

        ws.addEventListener("open", () => {
          this._attempt = 0;
          Log.info(`connected:${url}`);
          this.onOpen?.();
        });

        ws.addEventListener("message", (ev) => {
          const text = String(ev.data || "");
          Log.rx(text);
          this.onMessage?.(text);
        });

        ws.addEventListener("error", (ev) => {
          Log.error(`ws:error:${ev.message || "unknown"}`);
          this.onError?.(ev);
        });

        ws.addEventListener("close", (ev) => {
          Log.warn(`closed:code=${ev.code} reason=${ev.reason || "none"}`);
          this.onClose?.(ev);
          if (!this._manualClose && App.state.autoReconnect) {
            this.scheduleReconnect();
          }
        });
      } catch (e) {
        Log.error(`ws:connect-throw:${e.message}`);
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
      Log.warn(`reconnect-in:${Math.round(delay)}ms`);
      this._reconnectTimer = setTimeout(() => this.connect(), delay);
    }
    disconnect() {
      this._manualClose = true;
      clearTimeout(this._reconnectTimer);
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        this.ws.close(1000, "client-close");
      }
      this.ws = null;
    }
    send(text) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(text);
        Log.tx(text);
        return true;
      } else {
        Log.warn("ws:send-failed:not-open");
        return false;
      }
    }
    isOpen() {
      return this.ws?.readyState === WebSocket.OPEN;
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
      if (!fn) return Log.warn(`action:unknown:${name}`);
      try {
        await fn(ctx, el);
      } catch (e) {
        Log.error(`action:error:${name}:${e.message}`);
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
      Log.info(`http:body:${text.slice(0, 500)}${text.length > 500 ? "…" : ""}`);
      if (path === "/info") {
        const info = HTTPClient.parseInfo(text);
        UI.setDeviceInfo(ctx.url(), info);
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
      Log.info(`autoReconnect:${App.state.autoReconnect}`);
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
      deviceList: qs("#deviceList"),
      autoConnect: qs("#autoConnect"),
      autoReconnect: qs("#autoReconnect"),
      reconnectDelay: qs("#reconnectDelay"),
      deviceInfo: qs("#deviceInfo"),
      deviceStateChip: qs("#deviceStateChip"),
      actionsGrid: qs("#actionsGrid"),
      chartRange: qs("#chartRange"),
      // Tools
      paraLength: qs("#paraLength"),
      genParagraphBtn: qs("#genParagraphBtn"),
      startTypingBtn: qs("#startTypingBtn"),
      paragraphText: qs("#paragraphText"),
      countdown: qs("#countdown"),
      typingArea: qs("#typingArea"),
      statWPM: qs("#statWPM"),
      statAcc: qs("#statAcc"),
      statErr: qs("#statErr"),
      statTime: qs("#statTime"),
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

      // Devices dropdown
      el.deviceList.addEventListener("input", () => {
        const url = el.deviceList.value;
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

      // Chart range
      el.chartRange.addEventListener("input", () => {
        Chart.draw();
        Storage.set("chartRange", el.chartRange.value);
      });

      // Tools
      el.genParagraphBtn.addEventListener("click", TypingTest.generateParagraph);
      el.startTypingBtn.addEventListener("click", TypingTest.startCountdown);
      el.typingArea.addEventListener("input", TypingTest.onType);
      el.typingArea.addEventListener("keydown", TypingTest.onKey);

      // Live validation hooks are provided by AppUI.validateInput
      populateFromState();
      populateHistory();
      populateDevices();

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
      el.chartRange.value = Storage.get("chartRange", "30");
    }

    function populateHistory() {
      const recent = Storage.get("recentServers", []);
      el.recentServers.innerHTML = recent.map((u) => `<option value="${escapeHTML(u)}">`).join("");
    }

    function populateDevices() {
      const devices = Storage.get("devices", []); // [{url,name,lastError}]
      el.deviceList.innerHTML = "";
      devices.forEach((d) => {
        const o = document.createElement("option");
        o.value = d.url;
        o.textContent = d.name ? `${d.name} — ${d.url}` : d.url;
        if (d.lastError) o.textContent += ` (err)`;
        el.deviceList.appendChild(o);
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
      addOrUpdateDevice(url, { name: "", lastError: "" });
      populateDevices();
      Toast.ok("Saved to history");
    }

    function addOrUpdateDevice(url, { name, lastError }) {
      const devices = Storage.get("devices", []);
      const i = devices.findIndex((d) => d.url === url);
      if (i === -1) devices.push({ url, name: name || "", lastError: lastError || "" });
      else {
        if (name !== undefined) devices[i].name = name;
        if (lastError !== undefined) devices[i].lastError = lastError;
      }
      Storage.set("devices", devices);
    }

    function setDeviceInfo(url, info) {
      qs('[data-k="host"]', el.deviceInfo).textContent = new URL(url).host;
      qs('[data-k="name"]', el.deviceInfo).textContent = info.name || "—";
      qs('[data-k="firmware"]', el.deviceInfo).textContent = info.firmware || "—";
      qs('[data-k="uptime"]', el.deviceInfo).textContent = info.uptime || "—";
      el.deviceStateChip.textContent = info.name ? `${info.name}` : "Device";
      addOrUpdateDevice(url, { name: info.name || "", lastError: "" });
      populateDevices();
    }

    function setDeviceError(url, errText) {
      addOrUpdateDevice(url, { lastError: errText || "error" });
      populateDevices();
    }

    function updateButtons(connected) {
      el.connectBtn.disabled = connected;
      el.disconnectBtn.disabled = !connected;
    }

    function updateAutoToggle() {
      el.autoReconnect.checked = !!App.state.autoReconnect;
    }

    function clearDeviceInfo() {
      qsa(".kv__v", el.deviceInfo).forEach((n) => (n.textContent = "—"));
      el.deviceStateChip.textContent = "No device";
    }

    function setTypingError(on) {
      el.typingArea.classList.toggle("error", !!on);
    }

    return {
      init,
      setStatus,
      updateButtons,
      updateAutoToggle,
      setDeviceInfo,
      setDeviceError,
      clearDeviceInfo,
      elements: el,
    };
  })();

  /*****************************
   * Validators & AppUI hooks
   *****************************/
  const Validators = {
    url(v) {
      return /^wss?:\/\/([^\s:\/]+)(:\d+)?(\/[^\s]*)?$/.test(v);
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
      } else if (t.id === "paraLength") {
        const ok = Validators.numberIn(t.value, 10, 200);
        AppUI.markInvalid(t, "paraLengthErr", !ok);
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
   * Typing Test (paragraph, WPM, errors, countdown)
   *****************************/
  const TypingTest = (() => {
    const el = UI.elements;
    const WORDS =
      "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu amber neon xenon argon helium lithium beryllium boron carbon nitrogen oxygen fluorine sodium magnesium silicon phosphorus sulfur chlorine potassium calcium titanium chromium manganese iron cobalt nickel copper zinc gallium germanium arsenic selenium bromine krypton rubidium strontium zirconium molybdenum silver tin antimony iodine xenial stellar quantum pixel vertex lambda omega sigma gamma beta atlas comet nebula vector matrix kernel socket thread buffer packet frame stream".split(
        /\s+/
      );
    let target = "";
    let startedAt = 0;
    let lastStatsAt = 0;
    let timer = null;
    let errors = 0;

    function generateParagraph() {
      const n = clamp(Number(el.paraLength.value) || 60, 10, 200);
      const parts = [];
      for (let i = 0; i < n; i++) {
        parts.push(WORDS[(Math.random() * WORDS.length) | 0]);
      }
      target = parts.join(" ");
      el.paragraphText.textContent = target;
      el.typingArea.textContent = "";
      resetStats();
      Log.info(`para:generated:${n}w`);
    }

    function startCountdown() {
      if (!target) generateParagraph();
      showCountdown();
    }

    async function showCountdown() {
      const c = el.countdown;
      c.classList.add("show");
      // retrigger CSS animations
      c.querySelectorAll(".countdown__num").forEach((n) => {
        n.style.animation = "none";
        // eslint-disable-next-line no-unused-expressions
        n.offsetHeight; // reflow
        n.style.animation = "";
      });
      await sleep(4000);
      c.classList.remove("show");
      startTyping();
    }

    function startTyping() {
      el.typingArea.focus();
      startedAt = performance.now();
      lastStatsAt = startedAt;
      errors = 0;
      UI.setTypingError(false);
      updateStats();
    }

    function onKey(e) {
      // prevent multiline (Enter creates newline)
      if (e.key === "Enter") {
        e.preventDefault();
        return false;
      }
      return true;
    }

    function onType() {
      const current = el.typingArea.textContent;
      // realtime error highlighting: mark red state if trailing char mismatches
      const mismatch = firstMismatchIndex(current, target);
      const hasError = mismatch !== -1;
      UI.setTypingError(hasError);

      if (hasError) errors++;
      updateStats();

      // test complete
      if (current.length >= target.length) {
        finish();
      }
    }

    function firstMismatchIndex(a, b) {
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) return i;
      }
      return a.length > b.length ? n : -1;
    }

    function updateStats() {
      const nowT = performance.now();
      const elapsedSec = (nowT - startedAt) / 1000;
      const chars = el.typingArea.textContent.length;
      const words = chars / 5;
      const wpm = elapsedSec > 0 ? (words / elapsedSec) * 60 : 0;
      const acc = target.length
        ? Math.max(0, 100 - (errors / Math.max(chars, 1)) * 100)
        : 100;

      el.statWPM.textContent = Math.round(wpm);
      el.statAcc.textContent = `${Math.round(acc)}%`;
      el.statErr.textContent = errors;
      el.statTime.textContent = `${(elapsedSec || 0).toFixed(1)}s`;

      lastStatsAt = nowT;
    }

    function finish() {
      updateStats();
      const score = {
        time: Date.now(),
        wpm: Number(el.statWPM.textContent),
        acc: Number(el.statAcc.textContent.replace("%", "")),
        err: errors,
      };
      History.add(score);
      Chart.draw();
      Toast.ok(`Finished • WPM ${score.wpm} • Acc ${score.acc}%`);
      Log.info(`typing:done:wpm=${score.wpm} acc=${score.acc} err=${score.err}`);
    }

    function resetStats() {
      el.statWPM.textContent = "0";
      el.statAcc.textContent = "100%";
      el.statErr.textContent = "0";
      el.statTime.textContent = "0.0s";
      UI.setTypingError(false);
    }

    return { generateParagraph, startCountdown, onType, onKey };
  })();

  /*****************************
   * History (scores) + Chart
   *****************************/
  const History = {
    add(entry) {
      const arr = Storage.get("history", []);
      arr.push(entry);
      if (arr.length > 500) arr.shift();
      Storage.set("history", arr);
    },
    get(range = 30) {
      const arr = Storage.get("history", []);
      return arr.slice(-range);
    },
  };

  const Chart = (() => {
    const canvas = qs("#historyChart");
    const ctx = canvas.getContext("2d");

    function draw() {
      const range = Number(qs("#chartRange").value || "30");
      const data = History.get(range);
      resizeForDPR();
      clear();
      axes();
      if (data.length === 0) return;

      const pad = 30;
      const W = canvas.width;
      const H = canvas.height;
      const x0 = pad;
      const y0 = H - pad;
      const x1 = W - pad;
      const y1 = pad;

      const maxWPM = Math.max(60, Math.max(...data.map((d) => d.wpm)) + 10);
      const maxErr = Math.max(5, Math.max(...data.map((d) => d.err)) + 1);

      // line for WPM
      ctx.beginPath();
      data.forEach((d, i) => {
        const x = lerp(x0, x1, i / Math.max(1, data.length - 1));
        const y = map(d.wpm, 0, maxWPM, y0, y1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineWidth = 2;
      ctx.stroke();

      // bars for errors
      const bw = Math.max(2, (x1 - x0) / Math.max(1, data.length * 2));
      data.forEach((d, i) => {
        const x = lerp(x0, x1, i / Math.max(1, data.length - 1));
        const y = map(d.err, 0, maxErr, y0, y1);
        ctx.fillRect(x - bw / 2, y, bw, y0 - y);
      });

      // labels
      ctx.font = `${12 * devicePixelRatio}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillText("WPM", x1 - 40, y1 + 14);
      ctx.fillText("Errors", x1 - 50, y1 + 30);
    }

    function resizeForDPR() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.scale(1 / dpr, 1 / dpr);
    }

    function clear() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function axes() {
      const W = canvas.width;
      const H = canvas.height;
      const pad = 30;
      ctx.beginPath();
      ctx.moveTo(pad, H - pad);
      ctx.lineTo(W - pad, H - pad);
      ctx.moveTo(pad, H - pad);
      ctx.lineTo(pad, pad);
      ctx.stroke();
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function map(v, a1, a2, b1, b2) {
      const t = (v - a1) / (a2 - a1);
      return b1 + (b2 - b1) * (1 - t);
    }

    window.addEventListener("resize", draw);
    return { draw };
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
        return Toast.err("Enter a valid WebSocket URL.");
      }
      App.state.serverUrl = url;
      App.persist();
      UI.updateButtons(true);
      UI.setStatus("warn", "Connecting…");
      UI.clearDeviceInfo();

      // Check availability via /info first
      try {
        const res = await HTTPClient.get(url, "/info");
        if (String(res.status).startsWith("2")) {
          const info = HTTPClient.parseInfo(res.text);
          UI.setDeviceInfo(url, info);
          Log.info("device:available");
        } else {
          UI.setDeviceError(url, `http:${res.status}`);
          Log.warn(`device:info-status:${res.status}`);
        }
      } catch (e) {
        Log.warn(`device:info-failed:${e.message}`);
        UI.setDeviceError(url, e.message);
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
          UI.setDeviceInfo(App.state.serverUrl, info);
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

  // Instantiate WS client
  App.ws = new WSClient({
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
      Toast.err("WebSocket error");
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

    // Wire device availability polling (optional)
    setInterval(async () => {
      const url = App.state.serverUrl;
      if (!url) return;
      try {
        const { status } = await HTTPClient.get(url, "/info");
        if (!String(status).startsWith("2")) {
          UI.setDeviceError(url, `http:${status}`);
        }
      } catch (e) {
        UI.setDeviceError(url, e.message);
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
    App,
  };
})();
