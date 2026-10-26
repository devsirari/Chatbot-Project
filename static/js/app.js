/* app.js - frontend logic: chat, insights, history, models, theme */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const messagesEl = $("#messages");
const inputEl = $("#input");
const sendBtn = $("#sendBtn");
let busy = false;

/* ---------- Helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Tiny, safe markdown renderer: code blocks, `code`, **bold**, bullet lists. */
function inline(s) {
  return s.replace(/`([^`]+)`/g, "<code>$1</code>")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function md(text) {
  return esc(text).split("```").map((part, i) => {
    if (i % 2) return `<pre><code>${part.replace(/^\w*\n/, "")}</code></pre>`;
    return part.split(/\n{2,}/).map((p) => {
      p = p.trim();
      if (!p) return "";
      const lines = p.split("\n");
      if (lines.every((l) => /^\s*[*-] /.test(l)))
        return "<ul>" + lines.map((l) => `<li>${inline(l.replace(/^\s*[*-] /, ""))}</li>`).join("") + "</ul>";
      return "<p>" + inline(p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }).join("");
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/** fetch wrapper: returns parsed JSON or throws an Error with the server message. */
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- Tabs ---------- */
function showTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
  if (name === "insights") loadStats();
  if (name === "history") loadHistory();
}
$$(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

/* ---------- Chat ---------- */
function addMessage(role, html, meta = "") {
  $("#empty")?.remove();
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  wrap.innerHTML = `<div class="bubble">${html}</div>${meta ? `<div class="meta">${meta}</div>` : ""}`;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function setBusy(state) {
  busy = state;
  sendBtn.disabled = state;
  inputEl.disabled = state;
  if (!state) inputEl.focus();
}

async function sendMessage(text) {
  text = text.trim();
  if (!text || busy) return;

  setBusy(true);
  addMessage("user", esc(text));
  inputEl.value = "";
  autosize();

  const typing = addMessage("bot", '<div class="typing"><span></span><span></span><span></span></div>');
  try {
    const data = await api("/api/chat", { method: "POST", body: JSON.stringify({ message: text }) });
    typing.remove();
    addMessage("bot", md(data.answer), `answered in ${data.seconds}s`);
  } catch (err) {
    typing.remove();
    addMessage("bot error", esc(err.message));
  } finally {
    setBusy(false);
  }
}

$("#composer").addEventListener("submit", (e) => { e.preventDefault(); sendMessage(inputEl.value); });
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(inputEl.value); }
});
function autosize() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
}
inputEl.addEventListener("input", autosize);
$$(".chip").forEach((c) => c.addEventListener("click", () => sendMessage(c.textContent)));

/* ---------- New chat (reset) ---------- */
$("#resetBtn").addEventListener("click", async () => {
  try {
    await api("/api/reset", { method: "POST" });
    messagesEl.innerHTML = `<div class="empty" id="empty"><div class="logo big">✦</div>
      <h2>New conversation</h2><p>Gemini has forgotten the previous chat.</p></div>`;
    showTab("chat");
    toast("Conversation reset");
  } catch (err) { toast(err.message); }
});

/* ---------- Insights ---------- */
async function loadStats() {
  const box = $("#statCards");
  try {
    const s = await api("/api/stats");
    if (!s.total) { box.innerHTML = '<p class="muted">No chats yet. Ask a question first!</p>'; return; }
    const card = (label, value) => `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
    box.innerHTML =
      card("Total chats", s.total) +
      card("Avg response", s.avg_time.toFixed(2) + " s") +
      card("Median response", s.median_time.toFixed(2) + " s") +
      card("Slowest", s.max_time.toFixed(2) + " s") +
      card("Avg answer length", Math.round(s.avg_words) + " words") +
      (s.prediction !== null ? card("Predicted for 10-word Q", Math.round(s.prediction) + " words") : "");
  } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
}

$("#chartsBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = "Generating…";
  try {
    const data = await api("/api/charts", { method: "POST" });
    $("#chartGrid").innerHTML = data.charts
      .map((c) => `<figure><img src="${c.url}" alt="${esc(c.title)}"><figcaption>${esc(c.title)}</figcaption></figure>`)
      .join("");
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = "Generate charts"; }
});

/* ---------- History ---------- */
async function loadHistory() {
  const body = $("#historyBody");
  try {
    const { history } = await api("/api/history");
    body.innerHTML = history.length
      ? history.map((r) => `<tr>
          <td>${r.chat_no}</td><td>${esc(r.timestamp)}</td>
          <td class="clip" title="${esc(r.question)}">${esc(r.question)}</td>
          <td class="clip" title="${esc(r.answer)}">${esc(r.answer)}</td>
          <td>${r.response_time_sec}</td></tr>`).join("")
      : '<tr><td colspan="5" class="muted">No chats saved yet.</td></tr>';
  } catch (err) { body.innerHTML = `<tr><td colspan="5">${esc(err.message)}</td></tr>`; }
}

/* ---------- Models dialog ---------- */
$("#modelsBtn").addEventListener("click", async () => {
  const list = $("#modelsList");
  list.innerHTML = "<li>Loading…</li>";
  $("#modelsDialog").showModal();
  try {
    const { models } = await api("/api/models");
    list.innerHTML = models.map((m) => `<li>${esc(m)}</li>`).join("") || "<li>No models found.</li>";
  } catch (err) { list.innerHTML = `<li>${esc(err.message)}</li>`; }
});
$("#closeModels").addEventListener("click", () => $("#modelsDialog").close());

/* ---------- Theme toggle (remembered) ---------- */
const root = document.documentElement;
try { const saved = localStorage.getItem("theme"); if (saved) root.dataset.theme = saved; } catch (_) {}
$("#themeBtn").addEventListener("click", () => {
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (_) {}
});
