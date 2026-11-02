// Schedule math: working-day calendar and dependency-driven task dates.

const DAY = 86400000;

export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtISO(d) {
  return d.toISOString().slice(0, 10);
}
export function fmtShort(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
export function fmtLong(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

export function nextWorkday(d) {
  let x = new Date(d);
  while (isWeekend(x)) x = new Date(x.getTime() + DAY);
  return x;
}

// Move forward n working days (n may be 0).
export function addWorkdays(d, n) {
  let x = nextWorkday(d);
  let left = n;
  while (left > 0) {
    x = new Date(x.getTime() + DAY);
    if (!isWeekend(x)) left--;
  }
  return x;
}

export function workdaysBetween(a, b) {
  // working days from a (inclusive) to b (exclusive); negative if b < a
  const sign = b < a ? -1 : 1;
  let [lo, hi] = sign > 0 ? [a, b] : [b, a];
  let n = 0;
  for (let x = new Date(lo); x < hi; x = new Date(x.getTime() + DAY)) if (!isWeekend(x)) n++;
  return sign * n;
}

export const calendarDays = (a, b) => Math.round((b - a) / DAY);

const sumDelays = (t, kind) => (t.delays || []).filter((d) => d.kind === kind).reduce((s, d) => s + Number(d.days || 0), 0);

// Returns Map id → { start, end, baseStart, baseEnd, startDelay, extend, slip }
// `end` is the last working day of the task (inclusive).
// A task with `startDate` (and optionally `endDate`) is pinned to those dates,
// e.g. permitting steps that already happened; dependencies and delays don't move it.
export function computeSchedule(tasks, startDate) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = new Map();
  const visiting = new Set();
  const projectStart = nextWorkday(parseDate(startDate));

  function calc(id) {
    if (out.has(id)) return out.get(id);
    const t = byId.get(id);
    if (!t) return null;
    if (visiting.has(id)) throw new Error(`Circular dependency at "${t.name}"`);
    visiting.add(id);
    if (t.startDate) {
      const start = parseDate(t.startDate);
      const end = t.endDate ? parseDate(t.endDate) : addWorkdays(start, Math.max(1, Number(t.duration) || 1) - 1);
      const r = { earliest: start, start, end, baseStart: start, baseEnd: end, startDelay: 0, extend: 0, slip: 0, fixed: true };
      visiting.delete(id);
      out.set(id, r);
      return r;
    }
    let earliest = projectStart;
    let baseEarliest = projectStart;
    for (const dep of t.dependsOn || []) {
      const r = calc(dep);
      if (!r) continue;
      const after = addWorkdays(r.end, 1);
      const baseAfter = addWorkdays(r.baseEnd, 1);
      if (after > earliest) earliest = after;
      if (baseAfter > baseEarliest) baseEarliest = baseAfter;
    }
    const startDelay = sumDelays(t, "start");
    const extend = sumDelays(t, "extend");
    const dur = Math.max(1, Number(t.duration) || 1);
    const start = addWorkdays(earliest, startDelay);
    const end = addWorkdays(start, dur + extend - 1);
    const baseStart = baseEarliest;
    const baseEnd = addWorkdays(baseStart, dur - 1);
    const r = { earliest, start, end, baseStart, baseEnd, startDelay, extend, slip: workdaysBetween(baseEnd, end) };
    visiting.delete(id);
    out.set(id, r);
    return r;
  }
  tasks.forEach((t) => calc(t.id));
  return out;
}

export function summarize(tasks, sched) {
  let finish = null, baseFinish = null, totalDur = 0, doneDur = 0, delayDays = 0;
  for (const t of tasks) {
    const r = sched.get(t.id);
    if (!r || r.fixed) continue; // pinned steps (permitting) aren't construction work
    if (!finish || r.end > finish) finish = r.end;
    if (!baseFinish || r.baseEnd > baseFinish) baseFinish = r.baseEnd;
    totalDur += Number(t.duration) || 0;
    doneDur += ((Number(t.duration) || 0) * (Number(t.progress) || 0)) / 100;
    delayDays += r.startDelay + r.extend;
  }
  return {
    finish,
    baseFinish,
    slip: finish && baseFinish ? workdaysBetween(baseFinish, finish) : 0,
    percent: totalDur ? (doneDur / totalDur) * 100 : 0,
    delayDays,
  };
}
