import * as store from "./store.js?v=20261031c";
import DOCS from "../data/documents.js?v=20261031c";
import {
  computeSchedule, summarize, parseDate, fmtISO, fmtShort, fmtLong, todayUTC,
  addWorkdays, calendarDays,
} from "./schedule.js?v=20261031c";

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

// In-page confirm and status messages (browser alert/confirm are blocked
// when the tracker runs as an Artifact).
function ask(message, okLabel = "Delete") {
  const d = $("#ask");
  $("#ask-msg").textContent = message;
  $("#ask-ok").textContent = okLabel;
  d.returnValue = "";
  d.showModal();
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true }));
}
let toastTimer;
function toast(message, tone = "") {
  const t = $("#toast");
  t.textContent = message;
  t.className = `toast ${tone}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 5000);
}
store.onError((msg) => toast(msg, "bad"));

const dlg = $("#dlg");
function openDialog({ title, body, onSave, onDelete, saveLabel = "Save", onOpen }) {
  $("#dlg-title").textContent = title;
  $("#dlg-body").innerHTML = body;
  $("#dlg-ok").textContent = saveLabel;
  const del = $("#dlg-delete");
  del.hidden = !onDelete;
  del.onclick = async () => {
    if (!(await ask("Delete this? This can't be undone."))) return;
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
      toast(`Couldn't save: ${err.message}`, "bad");
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
  const cs = store.cloud.status;
  if (cs === "connecting") parts.push(`<div class="banner info">Loading the tracker's saved data…</div>`);
  if (cs === "unavailable") parts.push(`<div class="banner">Sign in to claude.ai to see and update the tracker's budget, schedule and log. The 3D model works without signing in.</div>`);
  if (cs === "readonly") parts.push(`<div class="banner info">You can view this tracker. Changes need edit access from its owner.</div>`);
  const which = [ph.budget && "budget", ph.schedule && "schedule", ph.model && "3D model"].filter(Boolean);
  if (which.length) {
    parts.push(`<div class="banner"><strong>Placeholder data:</strong> the ${which.join(" and ")} ${which.length > 1 ? "are" : "is"} sample numbers until the contractor's bid and schedule are entered. Edit them here${store.backend === "local" ? `, or in <code>data/project-data.js</code>` : ""}.</div>`);
  }
  if (store.seedChanged()) {
    parts.push(`<div class="banner">The starting data file has changed since you last saved in this browser. To use it, export a backup first, then <button class="link" data-goto="data">Reset to starting data</button>.</div>`);
  }
  $("#banners").innerHTML = parts.join("");
}

// ── Derived numbers ────────────────────────────────────────────────────────

function budgetRows() {
  const actualBy = {};
  // An expense can be split across lines: `splits: [{ budgetId, amount }]`.
  const allocations = (e) => e.splits?.length ? e.splits : [{ budgetId: e.budgetId, amount: e.amount }];
  let unassigned = 0;
  for (const e of state.expenses) {
    let left = Number(e.amount || 0);
    for (const a of allocations(e)) {
      const amt = Number(a.amount || 0);
      if (state.budget.some((b) => b.id === a.budgetId)) { actualBy[a.budgetId] = (actualBy[a.budgetId] || 0) + amt; left -= amt; }
    }
    if (Math.abs(left) > 0.005) unassigned += left;
  }
  const rows = state.budget.map((b) => ({ ...b, actual: actualBy[b.id] || 0 }));
  const cats = [];
  for (const r of rows) {
    let c = cats.find((x) => x.name === r.category);
    if (!c) cats.push((c = { name: r.category, budget: 0, actual: 0, items: [] }));
    c.budget += Number(r.budget || 0);
    c.actual += r.actual;
    c.items.push(r);
  }
  const totalBudget = rows.reduce((s, r) => s + Number(r.budget || 0), 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0) + unassigned;
  // Payments not split by line (e.g. contractor draws) count against unspent budget, not on top of it.
  const projected = Math.max(rows.reduce((s, r) => s + Math.max(Number(r.budget || 0), r.actual), 0), totalActual);
  return { rows, cats, totalBudget, totalActual, projected, unassigned };
}

// Permitting steps tied to a permit field (`permitField: "applied" | "issued"`)
// take their date from the Permit tab once it's filled in.
function scheduleTasks() {
  return state.tasks.map((t) => {
    const d = t.permitField && state.permit?.[t.permitField];
    return d ? { ...t, startDate: d, endDate: "" } : t;
  });
}

function recompute() {
  try {
    sched = computeSchedule(scheduleTasks(), state.project.startDate);
  } catch (err) {
    toast(err.message, "bad");
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
    ...(paymentSummary().draws.length ? [(() => { const p = paymentSummary(); return tile("Next contractor payment", p.next ? money(p.next.amount) : "–", p.next ? `${payStatusPill(p.next)} ${esc(p.next.trigger || p.next.name)}` : `<span class="status good">✓ All paid</span>`); })()] : []),
    ...(state.permit ? [(() => { const c = inspectionCounts(state.permit); return tile("Permit inspections", `${c.passed} of ${c.total}`, `<button class="link" data-goto="permit">${esc(state.permit.number || "Permit")} →</button>`); })()] : []),
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
    : `<li class="muted">${state.tasks.length ? "All tasks complete." : "No schedule yet."}</li>`;

  const recent = [...state.events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("#overview-log").innerHTML = recent.length
    ? recent.map((e) => `<li><span><span class="chip ${e.type}">${e.type}</span> ${esc(e.title)}</span><span class="when">${fmtShort(parseDate(e.date))}</span></li>`).join("")
    : `<li class="muted">No entries yet.</li>`;

  $("#overview-budget").innerHTML = budgetChart(b);
}

// ── Budget ─────────────────────────────────────────────────────────────────

// Categories, plus a Total row (on its own scale) and contract draws that
// haven't been split across budget lines.
function budgetChart(b) {
  const cats = [...b.cats];
  if (b.unassigned) cats.push({ name: "Contractor draws (not split by line)", budget: 0, actual: b.unassigned, draws: true });
  const max = Math.max(1, ...cats.map((c) => Math.max(c.budget, c.actual)));
  const total = { name: "Total", budget: b.totalBudget, actual: b.totalActual, total: true };
  return `<div class="bchart">${[total, ...cats].map((c) => {
    const over = !c.draws && c.actual > c.budget;
    const scale = c.total ? Math.max(1, c.budget, c.actual) : max;
    const tip = c.draws
      ? `<strong>${esc(c.name)}</strong><br>Paid ${money(c.actual)}<br>Counts toward the total; not yet assigned to a category`
      : `<strong>${esc(c.name)}</strong><br>Budget ${money(c.budget)}<br>Actual ${money(c.actual)}<br>${over ? `Over by ${money(c.actual - c.budget)}` : `Remaining ${money(c.budget - c.actual)}`}`;
    return `<div class="lbl"${c.total ? ' style="font-weight:600"' : ""}>${esc(c.name)}</div>
      <div class="val">${c.draws ? `${moneyK(c.actual)} paid` : `${moneyK(c.actual)} of ${moneyK(c.budget)}`}${over ? ` <span class="status bad">▲</span>` : ""}</div>
      <div class="track" data-tip="${esc(tip)}">
        <div class="b" style="width:${(c.budget / scale) * 100}%"></div>
        <div class="a ${over ? "over" : ""}" style="width:${(c.actual / scale) * 100}%"></div>
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
  $("#budget-chart").innerHTML = budgetChart(b);

  $("#budget-table").innerHTML = `
    <thead><tr><th>Item</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Variance</th><th>Used</th></tr></thead>
    <tbody>${b.cats.map((c) => `
      <tr class="cat"><td>${esc(c.name)}</td><td class="num">${money(c.budget)}</td><td class="num">${money(c.actual)}</td><td class="num">${variance(c.budget, c.actual)}</td><td></td></tr>
      ${c.items.map((r) => `<tr class="click" data-line="${esc(r.id)}">
        <td>${esc(r.item)}</td><td class="num">${money(r.budget)}</td><td class="num">${money(r.actual)}</td>
        <td class="num">${variance(r.budget, r.actual)}</td>
        <td>${meter(r.budget, r.actual)}</td></tr>`).join("")}`).join("")}
      ${b.unassigned ? `<tr><td class="muted">Payments not split by line (contractor draws)</td><td></td><td class="num">${money(b.unassigned)}</td><td></td><td></td></tr>` : ""}
    </tbody>
    <tfoot><tr><td>Total</td><td class="num">${money(b.totalBudget)}</td><td class="num">${money(b.totalActual)}</td><td class="num">${variance(b.totalBudget, b.totalActual)}</td><td>${meter(b.totalBudget, b.totalActual)}</td></tr></tfoot>`;

  const lineName = (id, e) => e?.splits?.length ? `Split across ${e.splits.length} lines`
    : state.budget.find((x) => x.id === id)?.item || (e?.paymentId ? "Contract payment" : "Contractor draw (not split by line)");
  const exp = [...state.expenses].sort((a, c) => c.date.localeCompare(a.date));
  $("#expense-table").innerHTML = exp.length
    ? `<thead><tr><th>Date</th><th>Vendor</th><th>Budget line</th><th>Note</th><th class="num">Amount</th></tr></thead>
       <tbody>${exp.map((e) => `<tr class="click" data-expense="${esc(e.id)}">
         <td>${fmtShort(parseDate(e.date))} ${parseDate(e.date).getUTCFullYear()}</td><td>${esc(e.vendor)}</td><td>${esc(lineName(e.budgetId, e))}</td>
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
    return `<option value="" ${!ex.budgetId ? "selected" : ""}>Contractor draw (not split by line)</option>` + Object.entries(groups).map(([c, items]) => `<optgroup label="${esc(c)}">${items.map((b) => `<option value="${esc(b.id)}" ${b.id === ex.budgetId ? "selected" : ""}>${esc(b.item)}</option>`).join("")}</optgroup>`).join("");
  })();
  openDialog({
    title: id ? "Edit expense" : "Add expense",
    body: `<div class="form-grid">
      <label class="f">Date<input name="date" type="date" required value="${esc(ex.date)}"></label>
      <label class="f">Amount ($)<input name="amount" type="number" step="0.01" required value="${esc(ex.amount)}"></label>
      ${ex.splits?.length
        ? `<div class="f full"><span>Split across budget lines</span><ul class="list small" style="margin:4px 0 0">${ex.splits.map((sp) => `<li>${esc(state.budget.find((b) => b.id === sp.budgetId)?.item || "Not split")}: ${money(sp.amount)}</li>`).join("")}</ul>
           <label class="check" style="margin-top:6px"><input type="checkbox" name="unsplit"> Remove the split and use one line</label></div>`
        : ""}
      <label class="f full">Budget line${ex.splits?.length ? " (only if you remove the split)" : ""}<select name="budgetId">${opts}</select></label>
      <label class="f full">Paid to<input name="vendor" value="${esc(ex.vendor)}"></label>
      <label class="f full">Note<input name="note" value="${esc(ex.note)}"></label>
    </div>`,
    onSave: (fd) => store.update((s) => {
      const v = { date: fd.get("date"), amount: Number(fd.get("amount")), budgetId: fd.get("budgetId"), vendor: fd.get("vendor").trim(), note: fd.get("note").trim() };
      if (id) {
        const e = s.expenses.find((x) => x.id === id);
        if (e.splits?.length && fd.get("unsplit") !== "on") v.budgetId = e.budgetId;
        if (fd.get("unsplit") === "on") delete e.splits;
        Object.assign(e, v);
      }
      else s.expenses.push({ id: store.uid("e"), ...v });
    }),
    onDelete: id ? () => store.update((s) => { s.expenses = s.expenses.filter((x) => x.id !== id); }) : null,
  });
}

// ── Contract payments ──────────────────────────────────────────────────────────
// `payments`: { id, kind: "draw" | "change", name, trigger, covers, amount,
//   status: "Upcoming" | "Due" | "Paid", dueDate, paidDate, note, expenseId }

const PAY_STATUSES = ["Upcoming", "Due", "Paid"];
const PAY_GRACE_DAYS = 10; // contract Section 6: interest starts 10 days after due

function paymentSummary() {
  const draws = state.payments || [];
  const sum = (xs) => xs.reduce((s, x) => s + Number(x.amount || 0), 0);
  const total = sum(draws);
  const paid = sum(draws.filter((x) => x.status === "Paid"));
  const next = draws.find((x) => x.status === "Due") || draws.find((x) => x.status !== "Paid");
  return { draws, total, paid, next, changeTotal: sum(draws.filter((x) => x.kind === "change")) };
}

function isLate(p) {
  if (p.status !== "Due" || !p.dueDate) return false;
  return calendarDays(parseDate(p.dueDate), todayUTC()) > PAY_GRACE_DAYS;
}

function payStatusPill(p) {
  if (isLate(p)) return `<span class="pill failed">Late</span>`;
  const cls = p.status === "Paid" ? "passed" : p.status === "Due" ? "scheduled" : "";
  return `<span class="pill ${cls}">${p.status === "Paid" ? "✓ " : ""}${esc(p.status || "Upcoming")}</span>`;
}

function renderPayments() {
  const s = paymentSummary();
  if (!s.draws.length) {
    $("#payment-tiles").innerHTML = "";
    $("#payment-table").innerHTML = `<tbody><tr><td class="empty">${store.cloud.status === "connecting" ? "Loading payments…" : "No contract payments yet."}</td></tr></tbody>`;
    return;
  }
  $("#payment-tiles").innerHTML = [
    tile("Contract total", money(s.total), s.changeTotal ? `incl. ${money(s.changeTotal)} in change orders` : "no change orders yet"),
    tile("Paid", money(s.paid), `${pct(s.total ? (s.paid / s.total) * 100 : 0)} of contract`),
    tile("Left to pay", money(s.total - s.paid), `${s.draws.filter((x) => x.status !== "Paid").length} payments`),
    tile("Next payment", s.next ? money(s.next.amount) : "–", s.next ? `${payStatusPill(s.next)} ${esc(s.next.trigger || "")}` : `<span class="status good">✓ All paid</span>`),
  ].join("");
  let n = 0;
  $("#payment-table").innerHTML = `
    <thead><tr><th>Payment</th><th>Due when</th><th>Status</th><th>Date</th><th class="num">Amount</th></tr></thead>
    <tbody>${s.draws.map((p) => `<tr class="click" data-payment="${esc(p.id)}">
      <td><strong>${p.kind === "change" ? "CO · " : `${++n}. `}${esc(p.name)}</strong>${p.covers ? `<br><span class="muted small">${esc(p.covers)}</span>` : ""}</td>
      <td>${esc(p.trigger || "")}</td>
      <td>${payStatusPill(p)}</td>
      <td class="num">${p.status === "Paid" && p.paidDate ? `Paid ${fmtShort(parseDate(p.paidDate))}` : p.dueDate ? `Due ${fmtShort(parseDate(p.dueDate))}` : "—"}</td>
      <td class="num">${money(p.amount)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td><td></td><td></td><td class="num">${money(s.paid)} paid</td><td class="num">${money(s.total)}</td></tr></tfoot>`;
}

$("#payment-table").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-payment]");
  if (tr) editPayment(tr.dataset.payment);
});
$("#add-change-order").onclick = () => editPayment(null);

function editPayment(id) {
  const p = (state.payments || []).find((x) => x.id === id) || { kind: "change", name: "Change order", trigger: "50% at signing, rest with later draws", covers: "", amount: "", status: "Due", dueDate: fmtISO(todayUTC()), paidDate: "", note: "" };
  const wasPaid = p.status === "Paid";
  openDialog({
    title: id ? p.name : "Add change order",
    body: `<div class="form-grid">
      <label class="f full">Name<input name="name" required value="${esc(p.name)}"></label>
      <label class="f full">Due when<input name="trigger" value="${esc(p.trigger || "")}"></label>
      <label class="f full">Covers<textarea name="covers" style="min-height:60px">${esc(p.covers || "")}</textarea></label>
      <label class="f">Amount ($)<input name="amount" type="number" step="0.01" min="0" required value="${esc(p.amount)}"></label>
      <label class="f">Status<select name="status">${PAY_STATUSES.map((st) => `<option ${st === (p.status || "Upcoming") ? "selected" : ""}>${st}</option>`).join("")}</select></label>
      <label class="f">Invoice / due date<input type="date" name="dueDate" value="${esc(p.dueDate || "")}"></label>
      <label class="f">Paid on<input type="date" name="paidDate" value="${esc(p.paidDate || "")}"></label>
      <label class="f full">Note (e.g. paid from which account)<input name="note" value="${esc(p.note || "")}"></label>
      <label class="check full"><input type="checkbox" name="log" ${wasPaid ? "" : "checked"}> When marked paid, add it to the log</label>
      <p class="full muted small" style="margin:0">Marking a payment paid adds it to Expenses as a contractor draw. Changing it back removes that expense.</p>
    </div>`,
    onSave: (fd) => {
      const v = { name: fd.get("name").trim(), trigger: fd.get("trigger").trim(), covers: fd.get("covers").trim(), amount: Number(fd.get("amount")), status: fd.get("status"), dueDate: fd.get("dueDate"), paidDate: fd.get("paidDate"), note: fd.get("note").trim() };
      if (v.status === "Paid" && !v.paidDate) v.paidDate = fmtISO(todayUTC());
      store.update((s) => {
        s.payments ||= [];
        let rec = s.payments.find((x) => x.id === id);
        if (!rec) { rec = { id: store.uid("pay"), kind: "change" }; s.payments.push(rec); }
        Object.assign(rec, v);
        if (v.status === "Paid") {
          const ex = { date: v.paidDate, amount: v.amount, budgetId: "", vendor: "On Point Saliency", note: [v.name, v.note].filter(Boolean).join(". "), paymentId: rec.id };
          const cur = rec.expenseId && s.expenses.find((x) => x.id === rec.expenseId);
          if (cur) Object.assign(cur, ex);
          else { rec.expenseId = store.uid("e"); s.expenses.push({ id: rec.expenseId, ...ex }); }
          if (!wasPaid && fd.get("log") === "on") {
            s.events.push({ id: store.uid("ev"), date: v.paidDate, type: "payment", title: `${v.name} to On Point Saliency: ${money(v.amount)}`, note: v.note, photos: [] });
          }
        } else if (rec.expenseId) {
          s.expenses = s.expenses.filter((x) => x.id !== rec.expenseId);
          rec.expenseId = "";
        }
      });
    },
    onDelete: id && p.kind === "change" ? () => store.update((s) => {
      if (p.expenseId) s.expenses = s.expenses.filter((x) => x.id !== p.expenseId);
      s.payments = s.payments.filter((x) => x.id !== id);
    }) : null,
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
    if (!r || (ganttZoom === "build" && r.fixed)) continue;
    for (const d of [r.earliest, r.baseStart]) if (!min || d < min) min = d;
    for (const d of [r.end, r.baseEnd]) if (!max || d > max) max = d;
  }
  const today = todayUTC();
  const start = new Date(min.getTime() - 4 * 86400000);
  const end = new Date(max.getTime() + 14 * 86400000);
  const days = calendarDays(start, end);
  const fitW = (el.clientWidth - labelW - 2) / days;
  const dayW = ganttZoom === "weeks" ? Math.max(narrow ? 9 : 13, fitW) : Math.max(ganttZoom === "fit" ? 0.3 : 3, fitW);
  const W = Math.floor(days * dayW);

  // rows grouped by phase, phases in order of first appearance
  const rows = [];
  const phases = [...new Set(tasks.map((t) => t.phase || "Other"))];
  for (const ph of phases) {
    const members = tasks.filter((t) => (t.phase || "Other") === ph);
    rows.push({ phase: ph, members });
    if (!collapsedPhases.has(ph)) for (const t of members) rows.push({ task: t });
  }
  const H = headH + rows.length * rowH + 8;
  const allClosed = phases.every((p) => collapsedPhases.has(p));
  $("#gantt-all").textContent = allClosed ? "Expand all" : "Collapse all";
  const X = (d) => calendarDays(start, d) * dayW;
  const rowY = new Map();

  let grid = "", head = "", bars = "", labels = "", deps = "";
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const dow = d.getUTCDay();
    if ((dow === 0 || dow === 6) && dayW >= 6) grid += `<rect class="weekend" x="${i * dayW}" y="${headH}" width="${dayW}" height="${H - headH}"/>`;
    if (dow === 1 && dayW >= 2.5 && (dayW >= 5 || Math.floor(i / 7) % 2 === 0)) {
      grid += `<line class="gridline" x1="${i * dayW}" x2="${i * dayW}" y1="${headH - 6}" y2="${H}"/>`;
      head += `<text class="tick" x="${i * dayW + 3}" y="${headH - 10}">${d.getUTCDate()}</text>`;
    }
    if (d.getUTCDate() === 1 || i === 0) {
      // Multi-year view: thin month lines, label every quarter, year on the second line.
      const m = d.getUTCMonth();
      const label = dayW >= 2.5 || m % 3 === 0 || i === 0;
      if (label) head += `<text class="tick" x="${i * dayW + 3}" y="16" font-weight="600">${d.toLocaleDateString(undefined, { month: "short", ...(dayW >= 2.5 ? { year: "numeric" } : {}), timeZone: "UTC" })}</text>`;
      if (dayW < 2.5 && (m === 0 || i === 0)) head += `<text class="tick" x="${i * dayW + 3}" y="${headH - 10}">${d.getUTCFullYear()}</text>`;
      if (i) grid += `<line class="${dayW < 2.5 && m !== 0 ? "gridline" : "sep"}" x1="${i * dayW}" x2="${i * dayW}" y1="4" y2="${H}"/>`;
    }
  }
  grid += `<line class="sep" x1="0" x2="${W}" y1="${headH}" y2="${headH}"/>`;

  rows.forEach((row, i) => {
    const y = headH + i * rowH;
    if (row.phase) {
      const closed = collapsedPhases.has(row.phase);
      const pr = row.members.map((t) => sched.get(t.id)).filter(Boolean);
      const done = row.members.filter((t) => Number(t.progress) >= 100).length;
      labels += `<g class="row phase" data-phase="${esc(row.phase)}" role="button" tabindex="0" aria-expanded="${!closed}"><rect class="rowbg" x="0" y="${y}" width="${labelW}" height="${rowH}"/>` +
        `<text class="chev" x="10" y="${y + rowH - 9}">${closed ? "▸" : "▾"}</text><text class="lbl-phase" x="24" y="${y + rowH - 9}">${esc(row.phase)}</text>` +
        (closed ? `<text class="tick" x="${labelW - 8}" y="${y + rowH - 9}" text-anchor="end">${done}/${row.members.length}</text>` : "") + `</g>`;
      if (pr.length) {
        // phase span: a thin summary bar, thicker when collapsed
        const ps = new Date(Math.min(...pr.map((r) => +r.start))), pe = new Date(Math.max(...pr.map((r) => +r.end)));
        const sx = X(ps), sw = Math.max(3, X(addEnd(pe)) - sx), h = closed ? 10 : 4;
        const tip = esc(`<strong>${esc(row.phase)}</strong><br>${fmtLong(ps)} – ${fmtLong(pe)}<br>${done} of ${row.members.length} tasks done`);
        bars += `<g class="row phase" data-phase="${esc(row.phase)}" data-tip="${tip}"><rect class="rowbg" x="0" y="${y}" width="${W}" height="${rowH}"/><rect class="phase-bar" x="${sx}" y="${y + rowH / 2 - h / 2 + 2}" width="${sw}" height="${h}" rx="2"/></g>`;
      }
      if (closed) for (const t of row.members) rowY.set(t.id, { y, phase: row.phase });
      return;
    }
    const t = row.task, r = sched.get(t.id);
    if (!r) return;
    rowY.set(t.id, { y });
    const name = narrow && t.name.length > 20 ? t.name.slice(0, 19) + "…" : t.name;
    labels += `<g class="row" data-task="${esc(t.id)}"><rect class="rowbg" x="0" y="${y}" width="${labelW}" height="${rowH}"/><text class="lbl" x="18" y="${y + rowH / 2 + 4}">${esc(name)}</text></g>`;

    const bx = X(r.start), bw = X(addEnd(r.end)) - bx;
    const by = y + 6, bh = 14;
    const tip = esc(`<strong>${esc(t.name)}</strong><br>` + (r.fixed
      ? `${fmtLong(r.start)}${+r.end !== +r.start ? ` – ${fmtLong(r.end)}` : ""}${t.note ? `<br>${esc(t.note)}` : ""}`
      : `${fmtShort(r.start)} – ${fmtShort(r.end)} · ${plural(Number(t.duration) + r.extend, "working day")}<br>${t.progress || 0}% done${t.note ? `<br>${esc(t.note)}` : ""}`) +
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
    const r = sched.get(t.id), ty = rowY.get(t.id);
    if (!r || !ty) continue;
    const y = ty.phase ? ty.y - 4 : ty.y;
    for (const dep of t.dependsOn || []) {
      const dr = sched.get(dep), dyr = rowY.get(dep);
      if (!dr || !dyr || (ty.phase && ty.phase === dyr.phase)) continue;
      const dy = dyr.phase ? dyr.y - 4 : dyr.y;
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

// Collapsed phases are a per-viewer preference, kept in this browser.
const COLLAPSE_KEY = "addition-tracker:gantt-collapsed";
const collapsedPhases = new Set((() => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || []; } catch { return []; } })());
function togglePhase(ph) {
  collapsedPhases.has(ph) ? collapsedPhases.delete(ph) : collapsedPhases.add(ph);
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedPhases])); } catch {}
  renderGantt();
}
$("#gantt").addEventListener("click", (e) => {
  const ph = e.target.closest("[data-phase]");
  if (ph) return togglePhase(ph.dataset.phase);
  const g = e.target.closest("[data-task]");
  if (g) editTask(g.dataset.task);
});
$("#gantt").addEventListener("keydown", (e) => {
  const ph = e.target.closest?.("[data-phase]");
  if (ph && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); togglePhase(ph.dataset.phase); }
});
$("#gantt-all").onclick = () => {
  const phases = [...new Set(state.tasks.map((t) => t.phase || "Other"))];
  const collapse = collapsedPhases.size < phases.length;
  collapsedPhases.clear();
  if (collapse) phases.forEach((p) => collapsedPhases.add(p));
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedPhases])); } catch {}
  renderGantt();
};
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
      <label class="f">Fixed start (optional)<input name="startDate" type="date" value="${esc(t.startDate || "")}"></label>
      <label class="f">Fixed end (optional)<input name="endDate" type="date" value="${esc(t.endDate || "")}"></label>
      <p class="full muted small" style="margin:0">${t.permitField ? `Uses the ${t.permitField} date from the Permit tab once it's filled in. ` : ""}Fixed dates are for steps that already happened, like permitting. They don't move with dependencies or delays.</p>
      <label class="f full">Note<input name="note" value="${esc(t.note || "")}"></label>
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
      const v = { name: fd.get("name").trim(), phase: fd.get("phase").trim(), duration: Number(fd.get("duration")), progress: Number(fd.get("progress")), milestone: fd.get("milestone") === "on", dependsOn: deps,
        startDate: fd.get("startDate") || "", endDate: fd.get("startDate") ? fd.get("endDate") || "" : "", note: fd.get("note").trim() };
      const tid = id || store.uid("t");
      // reject cycles
      const test = state.tasks.filter((x) => x.id !== tid).concat([{ ...t, ...v, id: tid, delays: [] }]);
      try { computeSchedule(test, state.project.startDate); } catch (err) { toast(`That would make a loop: ${err.message}`, "bad"); return false; }
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

// ── Permit ─────────────────────────────────────────────────────────────────

const INSPECTION_STATUSES = ["Not scheduled", "Scheduled", "Passed", "Partial", "Failed", "Not required"];
const PERMIT_FIELDS = [
  ["number", "Permit number"], ["status", "Status"], ["type", "Permit type"], ["jurisdiction", "Issued by"],
  ["address", "Address"], ["applied", "Applied", "date"], ["issued", "Issued", "date"], ["expires", "Expires", "date"],
  ["valuation", "Valuation ($)", "number"], ["fees", "Fees paid ($)", "number"], ["contractor", "Contractor of record"],
  ["codes", "Codes"], ["scope", "Scope of work", "textarea"], ["notes", "Notes", "textarea"],
];
const pillClass = (st) => (st || "").toLowerCase().replace(/\s+/g, "-");

function inspectionCounts(p) {
  const list = (p?.inspections || []).filter((i) => i.status !== "Not required");
  return { passed: list.filter((i) => i.status === "Passed").length, total: list.length, failed: list.filter((i) => i.status === "Failed").length };
}

function renderPermit() {
  const p = state.permit;
  if (!p) {
    $("#permit-tiles").innerHTML = "";
    $("#permit-facts").innerHTML = `<div class="empty">${store.cloud.status === "connecting" ? "Loading the permit…" : "No permit details yet. Use Edit details to add them."}</div>`;
    $("#inspection-table").innerHTML = "";
    return;
  }
  const c = inspectionCounts(p);
  const today = todayUTC();
  const exp = p.expires ? parseDate(p.expires) : null;
  const daysLeft = exp ? calendarDays(today, exp) : null;
  const fmtD = (d) => (d ? fmtLong(parseDate(d)) : "—");
  $("#permit-tiles").innerHTML = [
    tile("Permit", esc(p.number || "—"), esc(p.status || "Status not entered yet")),
    tile("Issued", fmtD(p.issued), p.applied ? `Applied ${fmtD(p.applied)}` : ""),
    tile("Expires", fmtD(p.expires), daysLeft == null ? "Enter from the permit card" : daysLeft < 0 ? `<span class="status bad">▲ Expired</span>` : daysLeft <= 60 ? `<span class="status bad">▲ ${daysLeft} days left</span>` : `${daysLeft} days left`),
    tile("Inspections passed", `${c.passed} of ${c.total}`, c.failed ? `<span class="status bad">▲ ${c.failed} failed</span>` : ""),
  ].join("");
  $("#permit-title").textContent = `Building permit ${p.number || ""}`.trim();
  $("#permit-portal").href = p.portalUrl || "https://aca-prod.accela.com/ARAPAHOE/Default.aspx";
  const val = (k, type) => {
    const v = p[k];
    if (v == null || v === "") return `<span class="missing">Not entered</span>`;
    if (type === "date") return fmtLong(parseDate(v));
    if (type === "number") return money(Number(v));
    return esc(v);
  };
  $("#permit-facts").innerHTML = PERMIT_FIELDS.map(([k, l, type]) => `<dt>${l}</dt><dd>${val(k, type)}</dd>`).join("");

  const taskName = (id) => state.tasks.find((t) => t.id === id)?.name;
  $("#inspection-table").innerHTML = `
    <thead><tr><th>Inspection</th><th>Status</th><th>Date</th><th>Planned with</th><th>Notes</th></tr></thead>
    <tbody>${(p.inspections || []).map((i) => {
      const r = sched.get(i.taskId);
      const planned = taskName(i.taskId) ? `${esc(taskName(i.taskId))}${r ? ` <span class="muted">(${fmtShort(r.end)})</span>` : ""}` : `<span class="muted">—</span>`;
      return `<tr class="click" data-inspection="${esc(i.id)}">
        <td>${esc(i.name)}</td>
        <td><span class="pill ${pillClass(i.status)}">${i.status === "Passed" ? "✓ " : i.status === "Failed" ? "✕ " : ""}${esc(i.status || "Not scheduled")}</span></td>
        <td class="num">${i.date ? fmtShort(parseDate(i.date)) : "—"}</td>
        <td>${planned}</td>
        <td class="muted">${esc(i.notes || i.inspector || "")}</td></tr>`;
    }).join("")}</tbody>`;
}

$("#inspection-table").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-inspection]");
  if (tr) editInspection(tr.dataset.inspection);
});
$("#add-inspection").onclick = () => editInspection(null);
$("#edit-permit").onclick = () => editPermit();

function ensurePermit(s) {
  if (!s.permit) s.permit = { number: "", inspections: [] };
  s.permit.inspections ||= [];
  return s.permit;
}

function editPermit() {
  const p = state.permit || {};
  openDialog({
    title: "Permit details",
    body: `<div class="form-grid">${PERMIT_FIELDS.map(([k, l, type]) => type === "textarea"
      ? `<label class="f full">${l}<textarea name="${k}">${esc(p[k] || "")}</textarea></label>`
      : `<label class="f ${["jurisdiction", "address", "codes", "type"].includes(k) ? "full" : ""}">${l}<input name="${k}" type="${type || "text"}" ${type === "number" ? 'step="0.01" min="0"' : ""} value="${esc(p[k] ?? "")}"></label>`).join("")}
      <label class="f full">County portal link<input name="portalUrl" type="url" value="${esc(p.portalUrl || "")}"></label>
    </div>`,
    onSave: (fd) => {
      store.update((s) => {
        const t = ensurePermit(s);
        for (const [k, , type] of PERMIT_FIELDS) {
          const v = (fd.get(k) || "").trim();
          t[k] = type === "number" ? (v === "" ? null : Number(v)) : v;
        }
        t.portalUrl = (fd.get("portalUrl") || "").trim();
      });
      toast("Permit details saved.");
    },
  });
}

function editInspection(id) {
  const insp = state.permit?.inspections?.find((i) => i.id === id) || { name: "", status: "Not scheduled", taskId: "", date: "", inspector: "", notes: "" };
  openDialog({
    title: id ? insp.name : "Add inspection",
    body: `<div class="form-grid">
      <label class="f full">Inspection<input name="name" required value="${esc(insp.name)}"></label>
      <label class="f">Status<select name="status">${INSPECTION_STATUSES.map((st) => `<option ${st === insp.status ? "selected" : ""}>${st}</option>`).join("")}</select></label>
      <label class="f">Date<input type="date" name="date" value="${esc(insp.date || "")}"></label>
      <label class="f">Inspector<input name="inspector" value="${esc(insp.inspector || "")}"></label>
      <label class="f">Planned with task<select name="taskId"><option value="">None</option>${state.tasks.map((t) => `<option value="${esc(t.id)}" ${t.id === insp.taskId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      <label class="f full">Notes or corrections<textarea name="notes">${esc(insp.notes || "")}</textarea></label>
      <label class="check full"><input type="checkbox" name="log" checked> Add this result to the log</label>
    </div>`,
    onSave: (fd) => {
      const v = { name: fd.get("name").trim(), status: fd.get("status"), date: fd.get("date"), inspector: fd.get("inspector").trim(), taskId: fd.get("taskId"), notes: fd.get("notes").trim() };
      store.update((s) => {
        const p = ensurePermit(s);
        if (id) Object.assign(p.inspections.find((i) => i.id === id), v);
        else p.inspections.push({ id: store.uid("i"), ...v });
        if (fd.get("log") === "on") {
          s.events.push({ id: store.uid("ev"), date: v.date || fmtISO(todayUTC()), type: v.status === "Failed" ? "issue" : "inspection", title: `${v.name} inspection: ${v.status.toLowerCase()}`, note: [v.inspector && `Inspector: ${v.inspector}.`, v.notes].filter(Boolean).join(" "), photos: [] });
        }
      });
    },
    onDelete: id ? () => store.update((s) => { s.permit.inspections = s.permit.inspections.filter((i) => i.id !== id); }) : null,
  });
}

// ── Log ────────────────────────────────────────────────────────────────────

const logFilter = $("#log-filter");
logFilter.innerHTML = `<option value="">All types</option>` + EVENT_TYPES.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("");
logFilter.onchange = () => renderLog();

const logOrder = $("#log-order");
try { logOrder.value = localStorage.getItem("addition-tracker:log-order") || "oldest"; } catch {}
logOrder.onchange = () => { try { localStorage.setItem("addition-tracker:log-order", logOrder.value); } catch {} renderLog(); };

function renderLog() {
  const f = logFilter.value;
  // Chronological by date; same-day entries keep the order they were logged in.
  const dir = logOrder.value === "newest" ? -1 : 1;
  const items = state.events.map((e, i) => [e, i]).filter(([e]) => !f || e.type === f)
    .sort(([a, i], [b, j]) => dir * (a.date.localeCompare(b.date) || i - j)).map(([e]) => e);
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
      <label class="f">Date<input type="date" name="date" required value="${esc(ev.date)}"><span class="muted small" id="ev-date-hint"></span></label>
      <label class="f">Type<select name="type">${EVENT_TYPES.map((t) => `<option ${t === ev.type ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="f full">Title<input name="title" required value="${esc(ev.title)}" placeholder="e.g. Footings poured"></label>
      <label class="f full">Notes<textarea name="note" placeholder="What happened, who was there, what's next">${esc(ev.note)}</textarea></label>
      <div class="full"><div class="thumbs" id="ev-photos">${keep.map((p) => `<span style="position:relative"><img data-photo="${esc(p)}" alt=""><button type="button" class="link small" data-rm-photo="${esc(p)}" style="position:absolute;top:2px;right:4px;background:var(--surface);border-radius:4px;padding:0 4px">✕</button></span>`).join("")}</div></div>
      ${store.canUploadPhotos() ? `<label class="f full">Add photos<input type="file" name="files" accept="image/*" multiple></label>` : `<p class="full muted small">Adding photos needs edit access to this tracker.</p>`}
    </div>`,
    onOpen(form) {
      hydratePhotos(form);
      // Date the entry from the photos' metadata unless it was typed in.
      const dateIn = form.elements.date, hint = $("#ev-date-hint", form);
      let typed = false;
      dateIn.addEventListener("input", () => { typed = true; hint.textContent = ""; });
      form.elements.files?.addEventListener("change", async (e) => {
        const dates = (await Promise.all([...e.target.files].map(store.photoTakenDate))).filter(Boolean).sort();
        if (!dates.length) { hint.textContent = typed ? "" : "No date in the photos"; return; }
        if (typed) return;
        dateIn.value = dates[0];
        hint.textContent = dates[0] === dates.at(-1) ? "From the photos" : `From the photos (taken ${fmtShort(parseDate(dates[0]))} – ${fmtShort(parseDate(dates.at(-1)))})`;
      });
      $("#ev-photos", form).onclick = (e) => {
        const rm = e.target.dataset.rmPhoto;
        if (rm) { keep = keep.filter((p) => p !== rm); e.target.parentElement.remove(); }
      };
    },
    async onSave(fd) {
      const files = fd.getAll("files").filter((f) => f && f.size);
      const added = [];
      for (const f of files) added.push(await store.savePhoto(f));
      const removed = (ev.photos || []).filter((p) => !keep.includes(p));
      for (const p of removed) store.deletePhoto(p);
      store.update((s) => {
        const v = { date: fd.get("date"), type: fd.get("type"), title: fd.get("title").trim(), note: fd.get("note").trim(), photos: [...keep, ...added] };
        if (id) Object.assign(s.events.find((x) => x.id === id), v);
        else s.events.push({ id: store.uid("ev"), ...v });
      });
    },
    onDelete: id ? () => {
      for (const p of ev.photos || []) store.deletePhoto(p);
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
    const { createModelView } = await import("./model3d.js?v=20261031c");
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
  if (state.model.revision) $("#model-legend").insertAdjacentHTML("beforeend", `<div class="muted small">Model: ${esc(state.model.revision)}</div>`);
}

$$("[data-mode]").forEach((b) => b.addEventListener("click", () => {
  $$("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  modelView?.set({ mode: b.dataset.mode });
  renderModelLegend();
}));
$$("[data-view]").forEach((b) => b.addEventListener("click", () => modelView?.setView(b.dataset.view)));
$$("[data-ptz]").forEach((b) => b.addEventListener("click", () => modelView?.nudge(b.dataset.ptz)));
$("#opt-existing").onchange = (e) => modelView?.set({ showExisting: e.target.checked });
$("#opt-xray").onchange = (e) => modelView?.set({ xray: e.target.checked });
$("#opt-interior").onchange = (e) => {
  modelView?.set({ interior: e.target.checked });
  modelView?.setView(e.target.checked ? "inside" : "3d");
};

// ── Data tab ───────────────────────────────────────────────────────────────

$("#export").onclick = async () => {
  try {
    const data = await store.exportAll();
    const ok = await store.saveFile(`addition-tracker-${fmtISO(todayUTC())}.json`, JSON.stringify(data));
    if (!ok) toast("This view can't save files. Open the tracker on claude.ai while signed in.", "bad");
  } catch (err) {
    if (err?.code !== "cancelled") toast(`Couldn't export: ${err.message || err.code}`, "bad");
  }
};
$("#import").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!(await ask("Replace all budget, schedule and log data with this backup?", "Replace"))) return;
  try {
    await store.importAll(JSON.parse(await file.text()));
    toast("Backup loaded.");
  } catch (err) {
    toast(`Couldn't import: ${err.message}`, "bad");
  }
};
$("#reset").hidden = store.backend !== "local";
if (store.backend === "cloud") {
  $("#data-where").innerHTML = "Budget, schedule and log entries are saved with this tracker on claude.ai, so they're the same on every device you open it from. Photos are stored with it too. Export makes a backup file you can keep or import later.";
  $("#seed-h").hidden = true;
  $("#seed-p").hidden = true;
}
$("#reset").onclick = async () => {
  if (await ask("Discard all changes in this browser and reload the starting data? Export a backup first if you want to keep them.", "Reset")) store.resetToSeed();
};

const PROJECT_FIELDS = [["name", "Project name"], ["address", "Address"], ["permit", "Permit"], ["contractor", "General contractor"], ["architect", "Architect"], ["structural", "Structural engineer"], ["startDate", "Construction start", "date"]];
function renderProjectForm() {
  $("#project-form").innerHTML = PROJECT_FIELDS.map(([k, l, type]) => `<label class="f ${k === "name" || k === "address" ? "full" : ""}">${l}<input name="${k}" type="${type || "text"}" value="${esc(state.project[k] || "")}"></label>`).join("");
}
$("#save-project").onclick = () => {
  const fd = new FormData($("#project-form"));
  store.update((s) => { for (const [k] of PROJECT_FIELDS) s.project[k] = fd.get(k); });
  toast("Project details saved.");
};

async function renderStorageInfo() {
  let txt = `${state.events.length} log entries, ${state.events.reduce((n, e) => n + (e.photos || []).length, 0)} photos, ${state.expenses.length} expenses.`;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est && store.backend === "local") txt += ` Browser storage used: ${(est.usage / 1e6).toFixed(1)} MB.`;
  } catch {}
  $("#storage-info").textContent = txt;
}


// ── Documents tab ──────────────────────────────────────────────────────────

const SLOT_LABEL = { 1: "Submittal 1 · initial application", 2: "Submittal 2 · first resubmittal", 3: "Submittal 3", 4: "Submittal 4 · rev 3 drawings", 5: "Submittal 5", 6: "Submittal 6 · September 2025 corrections", 7: "Submittal 7 · ready for construction", 8: "Submittal 8 · mechanical", 9: "Submittal 9 · contractor", 10: "Construction contract" };
function renderDocs() {
  const q = ($("#doc-search")?.value || "").trim().toLowerCase();
  const list = DOCS.filter((d) => !q || `${d.title} ${d.kind} ${d.summary}`.toLowerCase().includes(q));
  const slots = [...new Set(list.map((d) => d.slot))].sort((a, b) => b - a);
  if (!list.length) { $("#doc-list").innerHTML = `<div class="empty">No documents match.</div>`; return; }
  $("#doc-list").innerHTML = slots.map((sl) => `
    <h3 class="doc-group">${esc(SLOT_LABEL[sl] || `Submittal ${sl}`)}${list.some((d) => d.slot === sl && d.current) ? ` <span class="pill passed">Current</span>` : ""}</h3>
    <ul class="doc-list">${list.filter((d) => d.slot === sl).map((d) => `
      <li><a class="doc" href="${esc(d.url)}" target="_blank" rel="noopener">
        <span class="doc-icon" aria-hidden="true">PDF</span>
        <span class="doc-main"><span class="doc-title">${esc(d.title)}</span><span class="doc-sum">${esc(d.summary)}</span></span>
        <span class="doc-meta">${esc(d.kind)}${d.date ? `<br>${fmtLong(parseDate(d.date))}` : ""}<br>${plural(d.pages, "page")}</span>
      </a></li>`).join("")}</ul>`).join("");
}
$("#doc-search").addEventListener("input", renderDocs);

// ── Site map ───────────────────────────────────────────────────────────────
// state.site: { photo, w, h, tx, ty, rot, scale, opacity }. The plan (feet,
// +y north) is drawn at (tx, ty) image pixels, rotated `rot` degrees clockwise,
// `scale` image pixels per foot.

let siteDraft = null; // unsaved alignment while dragging / sliding
const siteStage = $("#site-stage");

function siteShapes() {
  const m = state.model || {};
  const int = m.interior || {};
  const f = int.frames?.wing;
  const toPlan = (frame, p) => (frame === "wing" && f ? [f.origin[0] + p[0] * f.u[0] + p[1] * f.v[0], f.origin[1] + p[0] * f.u[1] + p[1] * f.v[1]] : p);
  return {
    newVols: (m.volumes || []).filter((v) => v.kind === "new"),
    existing: (m.volumes || []).filter((v) => v.kind !== "new"),
    rooms: (int.rooms || []).map((r) => ({ name: r.name, pts: r.poly.map((p) => toPlan(r.frame, p)) })),
  };
}

function renderSite() {
  const s = siteDraft || state.site;
  const has = !!s?.photo;
  $("#site-controls").hidden = !has;
  $("#site-upload-btn").firstChild.textContent = has ? "Replace image" : "Upload aerial image";
  if (!has) {
    siteStage.innerHTML = `<div class="empty">${store.canUploadPhotos() ? "No aerial image yet. Use <strong>Upload aerial image</strong>." : "No aerial image yet."}</div>`;
    return;
  }
  const { newVols, existing, rooms } = siteShapes();
  const pts = (arr) => arr.map(([x, y]) => `${x},${-y}`).join(" ");
  const showEx = $("#site-existing").checked, showRooms = $("#site-rooms").checked;
  const g = `<g transform="translate(${s.tx} ${s.ty}) rotate(${s.rot}) scale(${s.scale})">
    ${showEx ? existing.map((v) => `<polygon class="site-existing" points="${pts(v.footprint)}"/>`).join("") : ""}
    <g opacity="${s.opacity ?? 0.7}">${newVols.map((v) => `<polygon class="site-new" points="${pts(v.footprint)}"><title>${esc(v.label)}</title></polygon>`).join("")}</g>
    ${showRooms ? rooms.map((r) => `<polygon class="site-room" points="${pts(r.pts)}"><title>${esc(r.name)}</title></polygon>`).join("") : ""}
  </g>`;
  const img = siteStage.querySelector("img");
  if (!img || img.dataset.photo !== s.photo) {
    siteStage.innerHTML = `<img data-photo="${esc(s.photo)}" alt="Aerial image of the lot"><svg viewBox="0 0 ${s.w} ${s.h}" preserveAspectRatio="none">${g}</svg>`;
    hydratePhotos(siteStage);
  } else {
    siteStage.querySelector("svg").innerHTML = g;
  }
  $("#site-rot").value = s.rot; $("#site-rot-v").value = `${Number(s.rot).toFixed(1)}°`;
  $("#site-scale").value = s.scale; $("#site-scale-v").value = `${Number(s.scale).toFixed(2)} px/ft`;
  $("#site-opacity").value = s.opacity ?? 0.7;
  $("#site-save").disabled = !siteDraft;
}

const siteEdit = (patch) => { siteDraft = { ...(siteDraft || state.site), ...patch }; renderSite(); };
$("#site-rot").oninput = (e) => siteEdit({ rot: Number(e.target.value) });
$("#site-scale").oninput = (e) => siteEdit({ scale: Number(e.target.value) });
$("#site-opacity").oninput = (e) => siteEdit({ opacity: Number(e.target.value) });
$("#site-existing").onchange = $("#site-rooms").onchange = () => renderSite();
$("#site-reset").onclick = () => { const s = siteDraft || state.site; siteEdit({ tx: s.w / 2, ty: s.h / 2 }); };
$("#site-save").onclick = () => {
  if (!siteDraft) return;
  const next = siteDraft;
  siteDraft = null;
  store.update((st) => { st.site = next; });
  toast("Site map alignment saved");
};

let siteDrag = null;
siteStage.addEventListener("pointerdown", (e) => {
  const svg = e.target.closest("svg");
  if (!svg) return;
  const s = siteDraft || state.site;
  siteDrag = { x: e.clientX, y: e.clientY, tx: s.tx, ty: s.ty, k: s.w / svg.getBoundingClientRect().width };
  svg.setPointerCapture(e.pointerId);
  svg.classList.add("dragging");
});
siteStage.addEventListener("pointermove", (e) => {
  if (!siteDrag) return;
  siteEdit({ tx: siteDrag.tx + (e.clientX - siteDrag.x) * siteDrag.k, ty: siteDrag.ty + (e.clientY - siteDrag.y) * siteDrag.k });
});
const endSiteDrag = () => { siteDrag = null; siteStage.querySelector("svg")?.classList.remove("dragging"); };
siteStage.addEventListener("pointerup", endSiteDrag);
siteStage.addEventListener("pointercancel", endSiteDrag);

$("#site-upload").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const photo = await store.savePhoto(file);
    const old = state.site;
    const base = old ? { tx: old.tx * (w / old.w), ty: old.ty * (h / old.h), rot: old.rot, scale: old.scale * (w / old.w), opacity: old.opacity } : { tx: w / 2, ty: h / 2, rot: 0, scale: w / 160, opacity: 0.7 };
    siteDraft = null;
    store.update((st) => { st.site = { photo, w, h, ...base }; });
    if (old?.photo) store.deletePhoto(old.photo);
    toast("Image added. Line up the outline, then Save alignment.");
  } catch (err) {
    toast(`Couldn't add that image: ${err.message}`, "bad");
  }
};

// ── Render all ─────────────────────────────────────────────────────────────

function renderAll() {
  recompute();
  $("#project-name").textContent = state.project.name;
  $("#project-sub").textContent = [state.project.address, state.project.permit && `Permit ${state.project.permit}`].filter(Boolean).join(" · ");
  document.title = `${state.project.name} · Tracker`;
  renderBanners();
  renderOverview();
  renderBudget();
  renderPayments();
  renderScheduleTiles();
  renderGantt();
  renderPermit();
  renderSite();
  renderLog();
  renderDocs();
  renderProjectForm();
  renderStorageInfo();
  modelView?.update(state, progressByTask());
}

store.subscribe((s) => { state = s; renderAll(); });
renderAll();
showTab(location.hash.slice(1) || "overview");
