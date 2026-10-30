import * as store from "./store.js";
import {
  computeSchedule, summarize, parseDate, fmtISO, fmtShort, fmtLong, todayUTC,
  addWorkdays, calendarDays,
} from "./schedule.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const moneyK = (n) => (Math.abs(n) >= 10000 ? (n < 0 ? "−" : "") + "$" + (Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100000 ? 0 : 1) + "k" : money(n));
const pct = (n) => `${Math.round(n)}%`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

const EVENT_TYPES = ["note", "milestone", "issue", "inspection", "delivery", "delay", "payment"];

let state = store.load();
let sched = new Map();
let modelView = null;

// ── Tabs ───────────────────────────────────────────────────────────────────

function showTab(name) {
  if (!$(`#tab-${name}`)) name = "overview";
  $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  $$(".tab").forEach((t) => t.toggleAttribute("data-active", t.id === `tab-${name}`));
  if (name === "model") ensureModel();
  if (location.hash.slice(1) !== name) history.replaceState(null, "", `#${name}`);
}
$$(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto]");
  if (g) showTab(g.dataset.goto);
});
window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));

// ── Tooltips for charts ────────────────────────────────────────────────────

const chartTip = $("#chart-tip");
document.addEventListener("mousemove", (e) => {
  const t = e.target.closest?.("[data-tip]");
  if (!t) { chartTip.hidden = true; return; }
  chartTip.innerHTML = t.dataset.tip;
  chartTip.hidden = false;
  const w = chartTip.offsetWidth, h = chartTip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  chartTip.style.left = `${x}px`;
  chartTip.style.top = `${y}px`;
});

// ── Dialog helper ──────────────────────────────────────────────────────────

const dlg = $("#dlg");
function openDialog({ title, body, onSave, onDelete, saveLabel = "Save", onOpen }) {
  $("#dlg-title").textContent = title;
  $("#dlg-body").innerHTML = body;
  $("#dlg-ok").textContent = saveLabel;
  const del = $("#dlg-delete");
  del.hidden = !onDelete;
  del.onclick = async () => {
    if (!confirm("Delete this? This can't be undone.")) return;
    await onDelete();
    dlg.close("deleted");
  };
  const form = $("#dlg-form");
  form.onsubmit = async (e) => {
    if (e.submitter?.value !== "ok") return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = $("#dlg-ok");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const ok = await onSave(new FormData(form), form);
      if (ok !== false) dlg.close("ok");
    } catch (err) {
      alert(`Couldn't save: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = saveLabel;
    }
  };
  dlg.showModal();
  onOpen?.(form);
}

// ── Banners ────────────────────────────────────────────────────────────────

function renderBanners() {
  const ph = state.placeholder || {};
  const parts = [];
  const which = [ph.budget && "budget", ph.schedule && "schedule", ph.model && "3D model"].filter(Boolean);
  if (which.length) {
    parts.push(`<div class="banner"><strong>Placeholder data:</strong> the ${which.join(" and ")} ${which.length > 1 ? "are" : "is"} sample numbers until the contractor's bid and schedule are entered. Edit them here, or in <code>data/project-data.js</code>.</div>`);
  }
  if (store.seedChanged()) {
    parts.push(`<div class="banner">The starting data file has changed since you last saved in this browser. To use it, export a backup first, then <button class="link" data-goto="data">Reset to starting data</button>.</div>`);
  }
  $("#banners").innerHTML = parts.join("");
}

// ── Derived numbers ────────────────────────────────────────────────────────

function budgetRows() {
  const actualBy = {};
  for (const e of state.expenses) actualBy[e.budgetId] = (actualBy[e.budgetId] || 0) + Number(e.amount || 0);
  const rows = state.budget.map((b) => ({ ...b, actual: actualBy[b.id] || 0 }));
  const cats = [];
  for (const r of rows) {
    let c = cats.find((x) => x.name === r.category);
    if (!c) cats.push((c = { name: r.category, budget: 0, actual: 0, items: [] }));
    c.budget += Number(r.budget || 0);
    c.actual += r.actual;
    c.items.push(r);
  }
  const unassigned = state.expenses.filter((e) => !state.budget.some((b) => b.id === e.budgetId)).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalBudget = rows.reduce((s, r) => s + Number(r.budget || 0), 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0) + unassigned;
  const projected = rows.reduce((s, r) => s + Math.max(Number(r.budget || 0), r.actual), 0) + unassigned;
  return { rows, cats, totalBudget, totalActual, projected, unassigned };
}

function recompute() {
  try {
    sched = computeSchedule(state.tasks, state.project.startDate);
  } catch (err) {
    alert(err.message);
    sched = new Map();
  }
}

const tile = (label, value, sub = "") => `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

// ── Overview ───────────────────────────────────────────────────────────────

function renderOverview() {
  const b = budgetRows();
  const s = summarize(state.tasks, sched);
  const over = b.projected - b.totalBudget;
  $("#overview-tiles").innerHTML = [
    tile("Budget", money(b.totalBudget), `${money(b.totalActual)} spent (${pct(b.totalBudget ? (b.totalActual / b.totalBudget) * 100 : 0)})`),
    tile("Projected cost", money(b.projected), over > 0 ? `<span class="status bad">▲ ${money(over)} over budget</span>` : `<span class="status good">✓ On budget</span>`),
    tile("Construction progress", pct(s.percent), `weighted by task duration`),
    tile("Projected finish", s.finish ? fmtLong(s.finish) : "–", s.slip > 0 ? `<span class="status bad">▲ ${plural(s.slip, "working day")} late</span>` : `<span class="status good">✓ On original schedule</span>`),
  ].join("");

  const today = todayUTC();
  const upcoming = state.tasks
    .map((t) => ({ t, r: sched.get(t.id) }))
    .filter(({ t, r }) => r && Number(t.progress) < 100)
    .sort((a, b) => a.r.start - b.r.start)
    .slice(0, 5);
  $("#overview-next").innerHTML = upcoming.length
    ? upcoming.map(({ t, r }) => {
        const status = r.start <= today ? `${t.progress || 0}% done` : `starts ${fmtShort(r.start)}`;
        return `<li><span>${esc(t.name)}${r.slip > 0 ? ` <span class="status bad small">+${r.slip}d</span>` : ""}</span><span class="when">${status}</span></li>`;
      }).join("")
    : `<li class="muted">All tasks complete.</li>`;

  const recent = [...state.events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("#overview-log").innerHTML = recent.length
    ? recent.map((e) => `<li><span><span class="chip ${e.type}">${e.type}</span> ${esc(e.title)}</span><span class="when">${fmtShort(parseDate(e.date))}</span></li>`).join("")
    : `<li class="muted">No entries yet.</li>`;

  $("#overview-budget").innerHTML = budgetChart(b.cats);
}

// ── Budget ─────────────────────────────────────────────────────────────────

function budgetChart(cats) {
  const max = Math.max(1, ...cats.map((c) => Math.max(c.budget, c.actual)));
  return `<div class="bchart">${cats.map((c) => {
    const over = c.actual > c.budget;
    const tip = `<strong>${esc(c.name)}</strong><br>Budget ${money(c.budget)}<br>Actual ${money(c.actual)}<br>${over ? `Over by ${money(c.actual - c.budget)}` : `Remaining ${money(c.budget - c.actual)}`}`;
    return `<div class="lbl">${esc(c.name)}</div>
      <div class="val">${moneyK(c.actual)} of ${moneyK(c.budget)}${over ? ` <span class="status bad">▲</span>` : ""}</div>
      <div class="track" data-tip="${esc(tip)}">
        <div class="b" style="width:${(c.budget / max) * 100}%"></div>
        <div class="a ${over ? "over" : ""}" style="width:${(c.actual / max) * 100}%"></div>
      </div>`;
  }).join("")}</div>`;
}

function renderBudget() {
  const b = budgetRows();
  const remaining = b.totalBudget - b.totalActual;
  const over = b.projected - b.totalBudget;
  $("#budget-tiles").innerHTML = [
    tile("Total budget", money(b.totalBudget), `${b.rows.length} line items`),
    tile("Spent to date", money(b.totalActual), `${pct(b.totalBudget ? (b.totalActual / b.totalBudget) * 100 : 0)} of budget`),
    tile("Remaining", money(remaining), remaining < 0 ? `<span class="status bad">▲ Over budget</span>` : ""),
    tile("Projected cost", money(b.projected), over > 0 ? `<span class="status bad">▲ ${money(over)} over</span>` : `<span class="status good">✓ Within budget</span>`),
  ].join("");
  $("#budget-chart").innerHTML = budgetChart(b.cats);

  $("#budget-table").innerHTML = `
    <thead><tr><th>Item</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th>Used</th></tr></thead>
    <tbody>${b.cats.map((c) => `
      <tr class="cat"><td>${esc(c.name)}</td><td class="num">${money(c.budget)}</td><td class="num">${money(c.actual)}</td><td class="num">${variance(c.budget, c.actual)}</td><td></td></tr>
      ${c.items.map((r) => `<tr class="click" data-line="${esc(r.id)}">
        <td>${esc(r.item)}</td><td class="num">${money(r.budget)}</td><td class="num">${money(r.actual)}</td>
        <td class="num">${variance(r.budget, r.actual)}</td>
        <td>${meter(r.budget, r.actual)}</td></tr>`).join("")}`).join("")}
      ${b.unassigned ? `<tr><td class="muted">Expenses not linked to a line</td><td></td><td class="num">${money(b.unassigned)}</td><td></td><td></td></tr>` : ""}
    </tbody>
    <tfoot><tr><td>Total</td><td class="num">${money(b.totalBudget)}</td><td class="num">${money(b.totalActual)}</td><td class="num">${variance(b.totalBudget, b.totalActual)}</td><td>${meter(b.totalBudget, b.totalActual)}</td></tr></tfoot>`;

  const lineName = (id) => state.budget.find((x) => x.id === id)?.item || "—";
  const exp = [...state.expenses].sort((a, c) => c.date.localeCompare(a.date));
  $("#expense-table").innerHTML = exp.length
    ? `<thead><tr><th>Date</th><th>Vendor</th><th>Budget line</th><th>Note</th><th class="num">Amount</th></tr></thead>
       <tbody>${exp.map((e) => `<tr class="click" data-expense="${esc(e.id)}">
         <td>${fmtShort(parseDate(e.date))} ${parseDate(e.date).getUTCFullYear()}</td><td>${esc(e.vendor)}</td><td>${esc(lineName(e.budgetId))}</td>
         <td class="muted">${esc(e.note)}</td><td class="num">${money(e.amount)}</td></tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="empty">No expenses yet.</td></tr></tbody>`;
}

function variance(budget, actual) {
  const v = budget - actual;
  if (v < 0) return `<span class="status bad">▲ ${money(-v)}</span>`;
  return money(v);
}
function meter(budget, actual) {
  const p = budget ? (actual / budget) * 100 : actual ? 100 : 0;
  return `<div class="meter ${p > 100 ? "over" : ""}" title="${pct(p)} used"><span style="width:${Math.min(100, p)}%"></span></div>`;
}

$("#budget-table").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-line]");
  if (tr) editLine(tr.dataset.line);
});
$("#expense-table").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-expense]");
  if (tr) editExpense(tr.dataset.expense);
});
$("#add-line").onclick = () => editLine(null);
$("#add-expense").onclick = () => editExpense(null);

function editLine(id) {
  const line = state.budget.find((b) => b.id === id) || { category: "", item: "", budget: 0 };
  const cats = [...new Set(state.budget.map((b) => b.category))];
  openDialog({
    title: id ? "Edit budget line" : "Add budget line",
    body: `<div class="form-grid">
      <label class="f full">Item<input name="item" required value="${esc(line.item)}"></label>
      <label class="f">Category<input name="category" required list="cats" value="${esc(line.category)}"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label class="f">Budget ($)<input name="budget" type="number" min="0" step="1" required value="${line.budget}"></label>
    </div>`,
    onSave: (fd) => store.update((s) => {
      const v = { item: fd.get("item").trim(), category: fd.get("category").trim(), budget: Number(fd.get("budget")) };
      if (id) Object.assign(s.budget.find((b) => b.id === id), v);
      else s.budget.push({ id: store.uid("b"), ...v });
    }),
    onDelete: id ? () => store.update((s) => { s.budget = s.budget.filter((b) => b.id !== id); }) : null,
  });
}

function editExpense(id) {
  const ex = state.expenses.find((x) => x.id === id) || { date: fmtISO(todayUTC()), budgetId: state.budget[0]?.id, amount: "", vendor: "", note: "" };
  const opts = (() => {
    const groups = {};
    for (const b of state.budget) (groups[b.category] ||= []).push(b);
    return Object.entries(groups).map(([c, items]) => `<optgroup label="${esc(c)}">${items.map((b) => `<option value="${esc(b.id)}" ${b.id === ex.budgetId ? "selected" : ""}>${esc(b.item)}</option>`).join("")}</optgroup>`).join("");
  })();
  openDialog({
    title: id ? "Edit expense" : "Add expense",
    body: `<div class="form-grid">
      <label class="f">Date<input name="date" type="date" required value="${esc(ex.date)}"></label>
      <label class="f">Amount ($)<input name="amount" type="number" step="0.01" required value="${esc(ex.amount)}"></label>
      <label class="f full">Budget line<select name="budgetId">${opts}</select></label>
      <label class="f full">Paid to<input name="vendor" value="${esc(ex.vendor)}"></label>
      <label class="f full">Note<input name="note" value="${esc(ex.note)}"></label>
    </div>`,
    onSave: (fd) => store.update((s) => {
      const v = { date: fd.get("date"), amount: Number(fd.get("amount")), budgetId: fd.get("budgetId"), vendor: fd.get("vendor").trim(), note: fd.get("note").trim() };
      if (id) Object.assign(s.expenses.find((x) => x.id === id), v);
      else s.expenses.push({ id: store.uid("e"), ...v });
    }),
    onDelete: id ? () => store.update((s) => { s.expenses = s.expenses.filter((x) => x.id !== id); }) : null,
  });
}

// ── Schedule / Gantt ───────────────────────────────────────────────────────

function renderScheduleTiles() {
  const s = summarize(state.tasks, sched);
  const done = state.tasks.filter((t) => Number(t.progress) >= 100).length;
  $("#schedule-tiles").innerHTML = [
    tile("Start", fmtLong(parseDate(state.project.startDate))),
    tile("Projected finish", s.finish ? fmtLong(s.finish) : "–", s.baseFinish ? `Originally ${fmtLong(s.baseFinish)}` : ""),
    tile("Schedule slip", s.slip > 0 ? `<span class="status bad">▲ ${s.slip}</span>` : `<span class="status good">✓ 0</span>`, "working days vs. original plan"),
    tile("Tasks complete", `${done} of ${state.tasks.length}`, `${pct(s.percent)} of the work`),
  ].join("");
}

function renderGantt() {
  const el = $("#gantt");
  const tasks = state.tasks;
  if (!tasks.length) { el.innerHTML = `<div class="empty">No tasks yet.</div>`; return; }
  const narrow = el.clientWidth < 640;
  const labelW = narrow ? 150 : 250;
  const rowH = 30, headH = 44;

  let min = null, max = null;
  for (const t of tasks) {
    const r = sched.get(t.id);
    if (!r) continue;
    for (const d of [r.earliest, r.baseStart]) if (!min || d < min) min = d;
    for (const d of [r.end, r.baseEnd]) if (!max || d > max) max = d;
  }
  const today = todayUTC();
  const start = new Date(min.getTime() - 4 * 86400000);
  const end = new Date(max.getTime() + 14 * 86400000);
  const days = calendarDays(start, end);
  const fitW = (el.clientWidth - labelW - 2) / days;
  const dayW = ganttZoom === "fit" ? Math.max(3, fitW) : Math.max(narrow ? 9 : 13, fitW);
  const W = Math.floor(days * dayW);

  // rows grouped by phase, phases in order of first appearance
  const rows = [];
  const phases = [...new Set(tasks.map((t) => t.phase || "Other"))];
  for (const ph of phases) {
    rows.push({ phase: ph });
    for (const t of tasks) if ((t.phase || "Other") === ph) rows.push({ task: t });
  }
  const H = headH + rows.length * rowH + 8;
  const X = (d) => calendarDays(start, d) * dayW;
  const rowY = new Map();

  let grid = "", head = "", bars = "", labels = "", deps = "";
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const dow = d.getUTCDay();
    if ((dow === 0 || dow === 6) && dayW >= 6) grid += `<rect class="weekend" x="${i * dayW}" y="${headH}" width="${dayW}" height="${H - headH}"/>`;
    if (dow === 1 && (dayW >= 5 || Math.floor(i / 7) % 2 === 0)) {
      grid += `<line class="gridline" x1="${i * dayW}" x2="${i * dayW}" y1="${headH - 6}" y2="${H}"/>`;
      head += `<text class="tick" x="${i * dayW + 3}" y="${headH - 10}">${d.getUTCDate()}</text>`;
    }
    if (d.getUTCDate() === 1 || i === 0) {
      head += `<text class="tick" x="${i * dayW + 3}" y="16" font-weight="600">${d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" })}</text>`;
      if (i) grid += `<line class="sep" x1="${i * dayW}" x2="${i * dayW}" y1="4" y2="${H}"/>`;
    }
  }
  grid += `<line class="sep" x1="0" x2="${W}" y1="${headH}" y2="${headH}"/>`;

  rows.forEach((row, i) => {
    const y = headH + i * rowH;
    if (row.phase) {
      labels += `<text class="lbl-phase" x="10" y="${y + rowH - 9}">${esc(row.phase)}</text>`;
      return;
    }
    const t = row.task, r = sched.get(t.id);
    if (!r) return;
    rowY.set(t.id, y);
    const name = narrow && t.name.length > 20 ? t.name.slice(0, 19) + "…" : t.name;
    labels += `<g class="row" data-task="${esc(t.id)}"><rect class="rowbg" x="0" y="${y}" width="${labelW}" height="${rowH}"/><text class="lbl" x="18" y="${y + rowH / 2 + 4}">${esc(name)}</text></g>`;

    const bx = X(r.start), bw = X(addEnd(r.end)) - bx;
    const by = y + 6, bh = 14;
    const tip = esc(`<strong>${esc(t.name)}</strong><br>${fmtShort(r.start)} – ${fmtShort(r.end)} · ${plural(Number(t.duration) + r.extend, "working day")}<br>${t.progress || 0}% done` +
      (r.startDelay || r.extend ? `<br>Delays: ${r.startDelay ? `${r.startDelay}d start` : ""}${r.startDelay && r.extend ? ", " : ""}${r.extend ? `${r.extend}d longer` : ""}` : "") +
      (r.slip > 0 ? `<br><span style="color:var(--critical)">▲ ${r.slip} working days behind original plan</span>` : ""));
    let g = `<g class="row" data-task="${esc(t.id)}" data-tip="${tip}"><rect class="rowbg" x="0" y="${y}" width="${W}" height="${rowH}"/>`;
    // original plan
    g += `<rect class="base" x="${X(r.baseStart)}" y="${y + rowH - 7}" width="${Math.max(2, X(addEnd(r.baseEnd)) - X(r.baseStart))}" height="3" rx="1.5"/>`;
    // start delay
    if (r.startDelay) {
      const dx = X(r.earliest);
      g += `<rect class="delay" x="${dx}" y="${by}" width="${Math.max(2, bx - dx - 2)}" height="${bh}" rx="2"/>`;
    }
    if (t.milestone && Number(t.duration) <= 1 && !r.extend) {
      const cx = bx + bw / 2, cy = by + bh / 2;
      g += `<path class="${Number(t.progress) >= 100 ? "bar-done" : "bar"}" d="M${cx} ${cy - 8} L${cx + 8} ${cy} L${cx} ${cy + 8} L${cx - 8} ${cy} Z" stroke="var(--series-actual)" stroke-width="1.5"/>`;
    } else {
      g += `<rect class="bar" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4"/>`;
      const p = Math.min(100, Number(t.progress) || 0);
      if (p > 0) g += `<rect class="bar-done" x="${bx}" y="${by}" width="${(bw * p) / 100}" height="${bh}" rx="4"/>`;
      if (r.extend) {
        const ex = X(addWorkdays(r.start, Number(t.duration)));
        g += `<rect class="delay" x="${ex}" y="${by}" width="${Math.max(2, bx + bw - ex)}" height="${bh}" rx="2"/>`;
      }
    }
    if (r.slip > 0) g += `<text class="slip" x="${bx + bw + 6}" y="${by + bh - 3}">+${r.slip}d</text>`;
    g += `</g>`;
    bars += g;
  });

  // dependency connectors
  for (const t of tasks) {
    const r = sched.get(t.id), y = rowY.get(t.id);
    if (!r || y == null) continue;
    for (const dep of t.dependsOn || []) {
      const dr = sched.get(dep), dy = rowY.get(dep);
      if (!dr || dy == null) continue;
      const x1 = X(addEnd(dr.end)), y1 = dy + 13, x2 = X(r.startDelay ? r.earliest : r.start), y2 = y + 13;
      const xm = Math.max(x1 + 4, Math.min(x2 - 4, x1 + 8));
      deps += `<path class="dep" d="M${x1} ${y1} H${xm} V${y2} H${x2 - 1}"/>`;
    }
  }

  const todayLine = today >= start && today <= end
    ? `<line class="today" x1="${X(today)}" x2="${X(today)}" y1="${headH - 4}" y2="${H}"/><text class="today-lbl" x="${X(today) + 4}" y="${headH - 22}">Today</text>`
    : "";

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:${labelW}px minmax(0,1fr)">
      <svg width="${labelW}" height="${H}" style="border-right:1px solid var(--axis)">
        <text class="tick" x="10" y="${headH - 10}">Task</text>
        <line class="sep" x1="0" x2="${labelW}" y1="${headH}" y2="${headH}"/>${labels}</svg>
      <div style="overflow-x:auto" id="gantt-scroll">
        <svg width="${W}" height="${H}">
          <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="color-mix(in srgb, var(--critical) 12%, transparent)"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--critical)" stroke-width="2"/></pattern></defs>
          ${grid}${head}${deps}${bars}${todayLine}
        </svg>
      </div>
    </div>`;
  // scroll so today (or the start) is in view
  const sc = $("#gantt-scroll");
  const focus = today >= start && today <= end ? X(today) - 80 : 0;
  sc.scrollLeft = Math.max(0, focus);
}
const addEnd = (d) => new Date(d.getTime() + 86400000); // bar runs through the end day

$("#gantt").addEventListener("click", (e) => {
  const g = e.target.closest("[data-task]");
  if (g) editTask(g.dataset.task);
});
$("#add-task").onclick = () => editTask(null);
let ganttZoom = "fit";
$$("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
  ganttZoom = b.dataset.zoom;
  $$("[data-zoom]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderGantt();
}));
let ganttW = 0;
new ResizeObserver(() => {
  const w = $("#gantt").clientWidth;
  if (w && Math.abs(w - ganttW) > 40) { ganttW = w; renderGantt(); }
}).observe($("#gantt"));

function editTask(id) {
  const t = state.tasks.find((x) => x.id === id) || { name: "", phase: "", duration: 5, dependsOn: [], progress: 0, delays: [] };
  const r = id ? sched.get(id) : null;
  const phases = [...new Set(state.tasks.map((x) => x.phase).filter(Boolean))];
  let delays = [...(t.delays || [])];
  const others = state.tasks.filter((x) => x.id !== id);

  const delayList = () => delays.length
    ? delays.map((d, i) => `<div class="d"><span><strong>+${d.days}d</strong> ${d.kind === "extend" ? "longer" : "later start"} · ${esc(d.reason || "no reason")} <span class="muted">(${esc(d.date || "")})</span></span><button type="button" class="link" data-rm="${i}">Remove</button></div>`).join("")
    : `<div class="muted small">No delays recorded.</div>`;

  openDialog({
    title: id ? t.name : "Add task",
    body: `<div class="form-grid">
      ${r ? `<p class="full muted small" style="margin:0">${fmtLong(r.start)} – ${fmtLong(r.end)}${r.slip > 0 ? ` · <span class="status bad">▲ ${r.slip} working days behind plan</span>` : ""}</p>` : ""}
      <label class="f full">Progress: <output id="pv">${t.progress || 0}%</output><input type="range" name="progress" min="0" max="100" step="5" value="${t.progress || 0}" oninput="pv.value=this.value+'%'"></label>
      <fieldset class="full"><legend>Delays</legend>
        <div class="delays" id="delay-list">${delayList()}</div>
        <div class="form-grid" style="margin-top:8px">
          <label class="f">Days<input type="number" id="nd-days" min="1" step="1" placeholder="e.g. 3"></label>
          <label class="f">Type<select id="nd-kind"><option value="start">Starts later</option><option value="extend">Takes longer</option></select></label>
          <label class="f full">Reason<input id="nd-reason" placeholder="e.g. Waiting on foundation inspection"></label>
          <label class="f">Date<input type="date" id="nd-date" value="${fmtISO(todayUTC())}"></label>
          <label class="check" style="align-self:end"><input type="checkbox" id="nd-log" checked> Add to log</label>
          <div class="full"><button type="button" class="btn" id="nd-add">Add delay</button></div>
        </div>
      </fieldset>
      <label class="f full">Task name<input name="name" required value="${esc(t.name)}"></label>
      <label class="f">Phase<input name="phase" list="phases" value="${esc(t.phase || "")}"><datalist id="phases">${phases.map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>
      <label class="f">Duration (working days)<input name="duration" type="number" min="1" step="1" required value="${t.duration}"></label>
      <label class="check full"><input type="checkbox" name="milestone" ${t.milestone ? "checked" : ""}> Milestone or inspection</label>
      <fieldset class="full"><legend>Starts after</legend><div class="deps">${others.map((o) => `<label><input type="checkbox" name="dep" value="${esc(o.id)}" ${(t.dependsOn || []).includes(o.id) ? "checked" : ""}>${esc(o.name)}</label>`).join("") || `<span class="muted">No other tasks</span>`}</div></fieldset>
    </div>`,
    onOpen(form) {
      const list = $("#delay-list", form);
      list.onclick = (e) => {
        const i = e.target.dataset.rm;
        if (i != null) { delays.splice(Number(i), 1); list.innerHTML = delayList(); }
      };
      $("#nd-add", form).onclick = () => {
        const days = Number($("#nd-days", form).value);
        if (!days) { $("#nd-days", form).focus(); return; }
        delays.push({ days, kind: $("#nd-kind", form).value, reason: $("#nd-reason", form).value.trim(), date: $("#nd-date", form).value, log: $("#nd-log", form).checked });
        list.innerHTML = delayList();
        $("#nd-days", form).value = ""; $("#nd-reason", form).value = "";
      };
    },
    onSave(fd) {
      const deps = fd.getAll("dep");
      const v = { name: fd.get("name").trim(), phase: fd.get("phase").trim(), duration: Number(fd.get("duration")), progress: Number(fd.get("progress")), milestone: fd.get("milestone") === "on", dependsOn: deps };
      const tid = id || store.uid("t");
      // reject cycles
      const test = state.tasks.filter((x) => x.id !== tid).concat([{ ...t, ...v, id: tid, delays: [] }]);
      try { computeSchedule(test, state.project.startDate); } catch (err) { alert(`That would make a loop: ${err.message}`); return false; }
      store.update((s) => {
        const newLogs = delays.filter((d) => d.log);
        const cleaned = delays.map(({ log, ...d }) => d);
        if (id) Object.assign(s.tasks.find((x) => x.id === id), v, { delays: cleaned });
        else s.tasks.push({ id: tid, ...v, delays: cleaned });
        for (const d of newLogs) {
          s.events.push({ id: store.uid("ev"), date: d.date || fmtISO(todayUTC()), type: "delay", title: `${v.name}: ${d.days}-day delay`, note: `${d.kind === "extend" ? "Task takes longer" : "Start pushed back"}. ${d.reason || ""}`.trim(), photos: [], taskId: tid });
        }
      });
    },
    onDelete: id ? () => store.update((s) => {
      s.tasks = s.tasks.filter((x) => x.id !== id);
      s.tasks.forEach((x) => (x.dependsOn = (x.dependsOn || []).filter((d) => d !== id)));
    }) : null,
  });
}

// ── Log ────────────────────────────────────────────────────────────────────

const logFilter = $("#log-filter");
logFilter.innerHTML = `<option value="">All types</option>` + EVENT_TYPES.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("");
logFilter.onchange = () => renderLog();

function renderLog() {
  const f = logFilter.value;
  const items = [...state.events].filter((e) => !f || e.type === f).sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
  $("#log-list").innerHTML = items.length
    ? items.map((e) => `<article class="entry">
        <div class="entry-head"><span class="chip ${e.type}">${e.type}</span><h3>${esc(e.title)}</h3><span class="date">${fmtLong(parseDate(e.date))}</span><span class="spacer"></span><button class="link" data-edit-event="${esc(e.id)}">Edit</button></div>
        ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
        ${(e.photos || []).length ? `<div class="thumbs">${e.photos.map((p) => `<img data-photo="${esc(p)}" alt="Photo for ${esc(e.title)}">`).join("")}</div>` : ""}
      </article>`).join("")
    : `<div class="empty">No entries${f ? " of this type" : ""} yet. Use <strong>New entry</strong> to log a site visit, issue, inspection or delivery, with photos.</div>`;
  hydratePhotos($("#log-list"));
}

async function hydratePhotos(root) {
  for (const img of $$("img[data-photo]", root)) {
    const url = await store.photoUrl(img.dataset.photo);
    if (url) img.src = url;
    else img.alt = "Photo not in this browser (import the backup that has it)";
  }
}

$("#log-list").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit-event]");
  if (ed) return editEvent(ed.dataset.editEvent);
  const img = e.target.closest("img[data-photo]");
  if (img?.src) { $("#lightbox-img").src = img.src; $("#lightbox").showModal(); }
});
$("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") e.currentTarget.close(); });
$("#add-event").onclick = () => editEvent(null);

function editEvent(id) {
  const ev = state.events.find((x) => x.id === id) || { date: fmtISO(todayUTC()), type: "note", title: "", note: "", photos: [] };
  let keep = [...(ev.photos || [])];
  openDialog({
    title: id ? "Edit log entry" : "New log entry",
    body: `<div class="form-grid">
      <label class="f">Date<input type="date" name="date" required value="${esc(ev.date)}"></label>
      <label class="f">Type<select name="type">${EVENT_TYPES.map((t) => `<option ${t === ev.type ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="f full">Title<input name="title" required value="${esc(ev.title)}" placeholder="e.g. Footings poured"></label>
      <label class="f full">Notes<textarea name="note" placeholder="What happened, who was there, what's next">${esc(ev.note)}</textarea></label>
      <div class="full"><div class="thumbs" id="ev-photos">${keep.map((p) => `<span style="position:relative"><img data-photo="${esc(p)}" alt=""><button type="button" class="link small" data-rm-photo="${esc(p)}" style="position:absolute;top:2px;right:4px;background:var(--surface);border-radius:4px;padding:0 4px">✕</button></span>`).join("")}</div></div>
      <label class="f full">Add photos<input type="file" name="files" accept="image/*" multiple></label>
    </div>`,
    onOpen(form) {
      hydratePhotos(form);
      $("#ev-photos", form).onclick = (e) => {
        const rm = e.target.dataset.rmPhoto;
        if (rm) { keep = keep.filter((p) => p !== rm); e.target.parentElement.remove(); }
      };
    },
    async onSave(fd) {
      const files = fd.getAll("files").filter((f) => f && f.size);
      const added = [];
      for (const f of files) {
        const pid = store.uid("ph");
        await store.photos.put(pid, await store.downscale(f));
        added.push(pid);
      }
      const removed = (ev.photos || []).filter((p) => !keep.includes(p));
      for (const p of removed) store.photos.delete(p).catch(() => {});
      store.update((s) => {
        const v = { date: fd.get("date"), type: fd.get("type"), title: fd.get("title").trim(), note: fd.get("note").trim(), photos: [...keep, ...added] };
        if (id) Object.assign(s.events.find((x) => x.id === id), v);
        else s.events.push({ id: store.uid("ev"), ...v });
      });
    },
    onDelete: id ? () => {
      for (const p of ev.photos || []) store.photos.delete(p).catch(() => {});
      store.update((s) => { s.events = s.events.filter((x) => x.id !== id); });
    } : null,
  });
}

// ── 3D ─────────────────────────────────────────────────────────────────────

function progressByTask() {
  return Object.fromEntries(state.tasks.map((t) => [t.id, Number(t.progress) || 0]));
}

async function ensureModel() {
  if (modelView) return;
  try {
    const { createModelView } = await import("./model3d.js");
    modelView = createModelView($("#model-canvas"), $("#model-tip"));
    modelView.update(state, progressByTask());
  } catch (err) {
    $("#model-canvas").innerHTML = `<div class="empty">The 3D viewer couldn't load (${esc(err.message)}).</div>`;
  }
  renderModelLegend();
}

function renderModelLegend() {
  const M = state.model.materials || {};
  const mode = $("[data-mode][aria-pressed=true]")?.dataset.mode;
  const items = mode === "progress"
    ? [["#c9a46a", "Framed, siding not done"], ["rgba(90,90,90,.3)", "Not started (ghost)"], [M.roof, "Complete"]]
    : [[M.siding, "Board & batten siding"], [M.brick, "Brick wainscot"], [M.roof, "Standing seam roof"], [M.existingWalls, "Existing house"]];
  $("#model-legend").innerHTML = items.map(([c, l]) => `<div><span class="sw" style="background:${c}"></span>${l}</div>`).join("");
}

$$("[data-mode]").forEach((b) => b.addEventListener("click", () => {
  $$("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  modelView?.set({ mode: b.dataset.mode });
  renderModelLegend();
}));
$$("[data-view]").forEach((b) => b.addEventListener("click", () => modelView?.setView(b.dataset.view)));
$("#opt-existing").onchange = (e) => modelView?.set({ showExisting: e.target.checked });
$("#opt-xray").onchange = (e) => modelView?.set({ xray: e.target.checked });

// ── Data tab ───────────────────────────────────────────────────────────────

$("#export").onclick = async () => {
  const data = await store.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `addition-tracker-${fmtISO(todayUTC())}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("#import").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm("Replace everything in this browser with the backup?")) return;
  try {
    await store.importAll(JSON.parse(await file.text()));
    alert("Backup loaded.");
  } catch (err) {
    alert(`Couldn't import: ${err.message}`);
  }
  e.target.value = "";
};
$("#reset").onclick = () => {
  if (confirm("Discard all changes in this browser and reload the starting data? Export a backup first if you want to keep them.")) store.resetToSeed();
};

const PROJECT_FIELDS = [["name", "Project name"], ["address", "Address"], ["permit", "Permit"], ["contractor", "General contractor"], ["architect", "Architect"], ["structural", "Structural engineer"], ["startDate", "Construction start", "date"]];
function renderProjectForm() {
  $("#project-form").innerHTML = PROJECT_FIELDS.map(([k, l, type]) => `<label class="f ${k === "name" || k === "address" ? "full" : ""}">${l}<input name="${k}" type="${type || "text"}" value="${esc(state.project[k] || "")}"></label>`).join("");
}
$("#save-project").onclick = () => {
  const fd = new FormData($("#project-form"));
  store.update((s) => { for (const [k] of PROJECT_FIELDS) s.project[k] = fd.get(k); });
};

async function renderStorageInfo() {
  let txt = `${state.events.length} log entries, ${state.events.reduce((n, e) => n + (e.photos || []).length, 0)} photos, ${state.expenses.length} expenses.`;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) txt += ` Browser storage used: ${(est.usage / 1e6).toFixed(1)} MB.`;
  } catch {}
  $("#storage-info").textContent = txt;
}

// ── Render all ─────────────────────────────────────────────────────────────

function renderAll() {
  recompute();
  $("#project-name").textContent = state.project.name;
  $("#project-sub").textContent = [state.project.address, state.project.permit && `Permit ${state.project.permit}`].filter(Boolean).join(" · ");
  document.title = `${state.project.name} · Tracker`;
  renderBanners();
  renderOverview();
  renderBudget();
  renderScheduleTiles();
  renderGantt();
  renderLog();
  renderProjectForm();
  renderStorageInfo();
  modelView?.update(state, progressByTask());
}

store.subscribe((s) => { state = s; renderAll(); });
renderAll();
showTab(location.hash.slice(1) || "overview");
