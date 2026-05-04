// =====================================================================
// Bookmark Audit — dashboard.js
// Analyzes bookmarks against chrome.history and renders verdicts.
// =====================================================================

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// Verdict thresholds (tweakable).
const T = {
  newGraceDays: 14,        // bookmarks newer than this default to NEW
  keepWithinDays: 30,      // last visit within this → KEEP
  keepMinVisits: 2,        // minimum visits to qualify for KEEP/ESSENTIAL
  reviewWithinDays: 180,   // last visit within this (but past KEEP window) → REVIEW
  retireUnvisitedDays: 60, // never visited & older than this → RETIRE
};

// State.
const state = {
  entries: [],     // analyzed bookmarks
  filter: "all",
  sort: "verdict",
  query: "",
  selected: new Set(),
};

// =====================================================================
// 1. Gather bookmarks.
// =====================================================================
async function getAllBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const out = [];

  function walk(node, path) {
    if (node.url) {
      out.push({
        id: node.id,
        title: node.title || node.url,
        url: node.url,
        dateAdded: node.dateAdded || NOW,
        folder: path.length ? path.join(" / ") : "—",
        parentId: node.parentId,
      });
    } else if (node.children) {
      // Don't include the root's empty title in the path.
      const newPath = node.title ? [...path, node.title] : path;
      node.children.forEach((c) => walk(c, newPath));
    }
  }
  tree.forEach((root) => walk(root, []));
  return out;
}

// =====================================================================
// 2. Cross-reference with browsing history.
// =====================================================================
async function getHistoryFor(url) {
  // chrome.history.getVisits returns every visit record for the exact URL.
  // It's the most reliable signal for "have I actually opened this?"
  try {
    const visits = await chrome.history.getVisits({ url });
    if (!visits || visits.length === 0) {
      return { visitCount: 0, lastVisitTime: null };
    }
    let last = 0;
    for (const v of visits) {
      if (v.visitTime && v.visitTime > last) last = v.visitTime;
    }
    return { visitCount: visits.length, lastVisitTime: last || null };
  } catch (err) {
    // Some chrome:// or javascript: URLs throw — ignore.
    return { visitCount: 0, lastVisitTime: null };
  }
}

// =====================================================================
// 3. Score & verdict.
// =====================================================================
function score(b, h) {
  const daysSinceAdded = (NOW - b.dateAdded) / DAY;
  const daysSinceLastVisit =
    h.lastVisitTime ? (NOW - h.lastVisitTime) / DAY : null;
  const visits = h.visitCount;

  let verdict, reason;

  if (daysSinceAdded < T.newGraceDays && visits === 0) {
    verdict = "new";
    reason = "Recently added — give it some time.";
  } else if (
    daysSinceLastVisit !== null &&
    daysSinceLastVisit <= T.keepWithinDays &&
    visits >= T.keepMinVisits
  ) {
    verdict = "keep";
    reason = `Used ${visits}× — last opened ${humanDays(daysSinceLastVisit)} ago.`;
  } else if (
    daysSinceLastVisit !== null &&
    daysSinceLastVisit <= T.keepWithinDays
  ) {
    verdict = "keep";
    reason = `Opened ${humanDays(daysSinceLastVisit)} ago.`;
  } else if (
    daysSinceLastVisit !== null &&
    daysSinceLastVisit <= T.reviewWithinDays
  ) {
    verdict = "review";
    reason = `Last opened ${humanDays(daysSinceLastVisit)} ago.`;
  } else if (daysSinceLastVisit !== null) {
    verdict = "retire";
    reason = `Untouched for ${humanDays(daysSinceLastVisit)}.`;
  } else {
    // Never visited (within history window).
    if (daysSinceAdded > T.retireUnvisitedDays) {
      verdict = "retire";
      reason = `Saved ${humanDays(daysSinceAdded)} ago, never opened on record.`;
    } else {
      verdict = "review";
      reason = `No visits on record yet.`;
    }
  }

  return {
    ...b,
    visits,
    lastVisitTime: h.lastVisitTime,
    daysSinceAdded,
    daysSinceLastVisit,
    verdict,
    reason,
  };
}

function humanDays(days) {
  if (days === null || days === undefined) return "never";
  const d = Math.round(days);
  if (d <= 1) return "today";
  if (d < 14) return `${d} days`;
  if (d < 60) return `${Math.round(d / 7)} weeks`;
  if (d < 365) return `${Math.round(d / 30)} months`;
  const yrs = d / 365;
  return yrs < 2 ? "1 year" : `${Math.round(yrs)} years`;
}

// =====================================================================
// 4. Run audit (with progress).
// =====================================================================
async function runAudit() {
  setStatus("summoning the ledger…");
  const bookmarks = await getAllBookmarks();

  setStatus(`weighing ${bookmarks.length} entries against your history…`);

  const entries = [];
  for (let i = 0; i < bookmarks.length; i++) {
    const b = bookmarks[i];
    const h = await getHistoryFor(b.url);
    entries.push(score(b, h));

    if (i % 10 === 0 || i === bookmarks.length - 1) {
      setProgress((i + 1) / bookmarks.length);
      setStatus(`reviewed ${i + 1} of ${bookmarks.length}…`);
      // Yield so the UI can paint.
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  setStatus("composing verdicts…");
  state.entries = entries;
  await new Promise((r) => setTimeout(r, 250));
  reveal();
}

function setStatus(s) {
  const el = document.getElementById("loaderStatus");
  if (el) el.textContent = s;
}
function setProgress(p) {
  const el = document.getElementById("loaderFill");
  if (el) el.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
}

function reveal() {
  document.getElementById("loader").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  renderSummary();
  renderEntries();
  setMasthead();
}

// =====================================================================
// 5. Render.
// =====================================================================
function setMasthead() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  }).format(new Date());
  document.getElementById("auditDate").textContent = fmt;
  document.getElementById("footDate").textContent = fmt;
  // Use the entry count as a fake "issue number" for flavor.
  const n = String(state.entries.length).padStart(3, "0");
  document.getElementById("auditNo").textContent = n;
}

function renderSummary() {
  const total = state.entries.length;
  const counts = { keep: 0, review: 0, retire: 0, new: 0 };
  for (const e of state.entries) counts[e.verdict]++;
  const pct = (n) => total ? `${Math.round((n / total) * 100)}%` : "0%";

  document.getElementById("sumTotal").textContent = total.toLocaleString();
  document.getElementById("sumKeep").textContent = counts.keep.toLocaleString();
  document.getElementById("sumReview").textContent = counts.review.toLocaleString();
  document.getElementById("sumRetire").textContent = counts.retire.toLocaleString();
  document.getElementById("sumNew").textContent = counts.new.toLocaleString();

  document.getElementById("pctKeep").textContent = pct(counts.keep);
  document.getElementById("pctReview").textContent = pct(counts.review);
  document.getElementById("pctRetire").textContent = pct(counts.retire);
}

const VERDICT_ORDER = { retire: 0, review: 1, keep: 2, new: 3 };

function renderEntries() {
  const root = document.getElementById("entries");
  root.innerHTML = "";

  let list = state.entries.slice();

  // Filter.
  if (state.filter !== "all") {
    list = list.filter((e) => e.verdict === state.filter);
  }
  if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        e.folder.toLowerCase().includes(q)
    );
  }

  // Sort.
  list.sort((a, b) => {
    switch (state.sort) {
      case "verdict": {
        const va = VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
        if (va !== 0) return va;
        // Within verdict, oldest-untouched first for retire/review,
        // newest-touched first for keep/new.
        const aT = a.lastVisitTime || 0;
        const bT = b.lastVisitTime || 0;
        if (a.verdict === "retire" || a.verdict === "review") return aT - bT;
        return bT - aT;
      }
      case "lastVisit":    return (b.lastVisitTime || 0) - (a.lastVisitTime || 0);
      case "lastVisitOld": return (a.lastVisitTime || 8e15) - (b.lastVisitTime || 8e15);
      case "visits":       return b.visits - a.visits;
      case "dateAdded":    return b.dateAdded - a.dateAdded;
      case "dateAddedOld": return a.dateAdded - b.dateAdded;
      case "title":        return a.title.localeCompare(b.title);
      default:             return 0;
    }
  });

  if (list.length === 0) {
    root.innerHTML = '<div class="empty">Nothing to show in this view.</div>';
    return;
  }

  let n = 1;
  for (const e of list) {
    root.appendChild(renderEntry(e, n++));
  }
}

function renderEntry(e, num) {
  const el = document.createElement("article");
  el.className = "entry";
  if (state.selected.has(e.id)) el.classList.add("selected");
  el.dataset.id = e.id;

  const stampLabel = {
    keep: "Keep",
    review: "Review",
    retire: "Retire",
    new: "New",
  }[e.verdict];

  const dateAddedFmt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(e.dateAdded));

  const lastVisitFmt = e.lastVisitTime
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      }).format(new Date(e.lastVisitTime))
    : "—";

  el.innerHTML = `
    <div class="entry-check">
      <input type="checkbox" ${state.selected.has(e.id) ? "checked" : ""} />
    </div>
    <div>
      <div class="stamp stamp-${e.verdict}">${stampLabel}</div>
      <div class="stamp-num">№ ${String(num).padStart(3, "0")}</div>
    </div>
    <div class="entry-body">
      <a class="entry-title" href="${escapeAttr(e.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(e.title)}</a>
      <span class="entry-url">${escapeHtml(e.url)}</span>
      <div class="entry-meta">
        <span class="reason">${escapeHtml(e.reason)}</span>
        <span class="sep">·</span>
        <span>visits&nbsp;<strong>${e.visits}</strong></span>
        <span class="sep">·</span>
        <span>last&nbsp;${lastVisitFmt}</span>
        <span class="sep">·</span>
        <span>added&nbsp;${dateAddedFmt}</span>
        <span class="sep">·</span>
        <span>in&nbsp;<em>${escapeHtml(e.folder)}</em></span>
      </div>
    </div>
    <div class="entry-actions">
      <button class="open">Open</button>
      <button class="delete">Delete</button>
    </div>
  `;

  // Wire actions.
  el.querySelector(".entry-check input").addEventListener("change", (ev) => {
    if (ev.target.checked) state.selected.add(e.id);
    else state.selected.delete(e.id);
    el.classList.toggle("selected", ev.target.checked);
    renderBulkBar();
  });
  el.querySelector(".open").addEventListener("click", () => {
    chrome.tabs.create({ url: e.url, active: false });
  });
  el.querySelector(".delete").addEventListener("click", () => {
    confirmDialog({
      title: "Delete this bookmark?",
      text: `“${e.title}” will be removed from your bookmarks. This cannot be undone from here.`,
      onOk: () => removeBookmarks([e.id]),
    });
  });

  return el;
}

function renderBulkBar() {
  const bar = document.getElementById("bulk");
  const c = state.selected.size;
  document.getElementById("bulkCount").textContent = c;
  bar.classList.toggle("hidden", c === 0);
}

// =====================================================================
// 6. Actions.
// =====================================================================
async function removeBookmarks(ids) {
  for (const id of ids) {
    try { await chrome.bookmarks.remove(id); } catch (err) {
      console.warn("[Bookmark Audit] failed to remove", id, err);
    }
    state.selected.delete(id);
  }
  state.entries = state.entries.filter((e) => !ids.includes(e.id));
  renderSummary();
  renderEntries();
  renderBulkBar();
}

function openMany(urls) {
  // Cap at 20 to avoid tab-tsunami.
  const capped = urls.slice(0, 20);
  for (const u of capped) chrome.tabs.create({ url: u, active: false });
  if (urls.length > 20) {
    alert(`Opened the first 20 of ${urls.length}. Open the rest manually if needed.`);
  }
}

// =====================================================================
// 7. Confirm dialog.
// =====================================================================
function confirmDialog({ title, text, onOk }) {
  const root = document.getElementById("confirm");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = text;
  root.classList.remove("hidden");

  const cancel = document.getElementById("confirmCancel");
  const ok = document.getElementById("confirmOk");

  const close = () => {
    root.classList.add("hidden");
    cancel.removeEventListener("click", onCancel);
    ok.removeEventListener("click", onConfirm);
  };
  const onCancel = () => close();
  const onConfirm = () => {
    close();
    onOk();
  };
  cancel.addEventListener("click", onCancel);
  ok.addEventListener("click", onConfirm);
}

// =====================================================================
// 8. Helpers.
// =====================================================================
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(s) { return escapeHtml(s); }

// =====================================================================
// 9. Wire UI controls.
// =====================================================================
function wireControls() {
  document.getElementById("tabs").addEventListener("click", (e) => {
    if (!e.target.matches(".tab")) return;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active");
    state.filter = e.target.dataset.filter;
    renderEntries();
  });

  document.getElementById("sortSel").addEventListener("change", (e) => {
    state.sort = e.target.value;
    renderEntries();
  });

  let searchTimer = null;
  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = e.target.value.trim();
      renderEntries();
    }, 120);
  });

  document.getElementById("bulkOpen").addEventListener("click", () => {
    const urls = state.entries
      .filter((e) => state.selected.has(e.id))
      .map((e) => e.url);
    openMany(urls);
  });
  document.getElementById("bulkDelete").addEventListener("click", () => {
    const ids = [...state.selected];
    confirmDialog({
      title: `Delete ${ids.length} bookmark${ids.length === 1 ? "" : "s"}?`,
      text: `These bookmarks will be permanently removed. The pages themselves are unaffected.`,
      onOk: () => removeBookmarks(ids),
    });
  });
  document.getElementById("bulkClear").addEventListener("click", () => {
    state.selected.clear();
    renderEntries();
    renderBulkBar();
  });
}

// =====================================================================
// Boot.
// =====================================================================
wireControls();
runAudit().catch((err) => {
  console.error("[Bookmark Audit] fatal:", err);
  setStatus("something went wrong — check the console.");
});
