/* Analytics reads existing account records; it never writes or synchronizes them. */
const analyticsReportState = { storage: "all", selectedDate: null };
const ANALYTICS_DAY_MS = 86400000;
const ANALYTICS_UTC_OFFSET = 7 * 3600000;

function analyticsDateInfo(timestamp) {
  const date = new Date(timestamp + ANALYTICS_UTC_OFFSET);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return {
    timestamp, dateKey: `${dd}/${mm}`, fullDateKey: `${yyyy}-${mm}-${dd}`,
    displayDate: `${dd}/${mm}/${yyyy}`,
    timeStr: `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function getAccountDateInfo(item) {
  const unknown = { timestamp: 0, dateKey: "Không rõ", fullDateKey: "unknown", displayDate: "Chưa rõ ngày thêm", timeStr: "" };
  if (!item) return unknown;
  let timestamp = Number(item.createdTimestamp);
  if (!(timestamp > 0 && timestamp < 8640000000000000)) {
    const idMatch = String(item.id || "").match(/^(\d{13})(?:\D|$)/);
    timestamp = idMatch ? Number(idMatch[1]) : 0;
  }
  if (timestamp > 0 && timestamp < 8640000000000000) return analyticsDateInfo(timestamp);
  // A date without a year cannot be assigned to the current year reliably.
  const match = String(item.createdAt || "").match(/(?:^|\D)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/);
  if (!match) return unknown;
  const [, day, month, year] = match.map(Number);
  const localDay = new Date(Date.UTC(year, month - 1, day));
  if (localDay.getUTCFullYear() !== year || localDay.getUTCMonth() !== month - 1 || localDay.getUTCDate() !== day) return unknown;
  const info = analyticsDateInfo(localDay.getTime() - ANALYTICS_UTC_OFFSET);
  info.timeStr = "";
  return info;
}

function getAnalyticsScope(now = Date.now()) {
  const today = analyticsDateInfo(now);
  const todayStart = Date.parse(`${today.fullDateKey}T00:00:00+07:00`);
  const days = { today: 1, "7d": 7, "30d": 30 }[currentAnalyticsTimeRange];
  const start = days ? todayStart - (days - 1) * ANALYTICS_DAY_MS : null;
  const storageAccounts = accounts.filter(a => analyticsReportState.storage === "all" ||
    (a.category === "chungsuc" ? "chungsuc" : "rank") === analyticsReportState.storage);
  const selected = storageAccounts.filter(a => {
    if (start === null) return true;
    const info = getAccountDateInfo(a);
    return info.timestamp > 0 && info.timestamp >= start && info.timestamp <= now;
  });
  return { now, today, todayStart, days, start, storageAccounts, accounts: selected };
}

function analyticsUsage(account) {
  const value = Number(account.useCount);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function buildAnalyticsReport(scope) {
  const daily = new Map();
  const contributors = new Map();
  const lastUsers = new Map();
  const rankCounts = new Map();
  let active = 0, usage = 0, rank = 0, unknown = 0, knownLastUsers = 0;
  scope.accounts.forEach(account => {
    const info = getAccountDateInfo(account);
    if (info.fullDateKey === "unknown") unknown++;
    if (!daily.has(info.fullDateKey)) daily.set(info.fullDateKey, { info, accounts: [], rank: 0, event: 0, usage: 0, contributors: new Map() });
    const entry = daily.get(info.fullDateKey);
    const isEvent = account.category === "chungsuc";
    const creator = String(account.createdBy || "").trim() || "Không rõ";
    entry.accounts.push(account);
    entry[isEvent ? "event" : "rank"]++;
    entry.usage += analyticsUsage(account);
    entry.contributors.set(creator, (entry.contributors.get(creator) || 0) + 1);
    contributors.set(creator, (contributors.get(creator) || 0) + 1);
    usage += analyticsUsage(account);
    if (!checkBanStatus(account.unlockDate, account).isBanned) active++;
    if (!isEvent) {
      rank++;
      const group = parseRankGroup(account.rank);
      rankCounts.set(group.key, (rankCounts.get(group.key) || 0) + 1);
    }
    const lastUser = String(account.lastUsedBy || "").trim();
    if (lastUser) {
      lastUsers.set(lastUser, (lastUsers.get(lastUser) || 0) + 1);
      knownLastUsers++;
    }
  });
  const total = scope.accounts.length;
  return { daily, contributors, lastUsers, knownLastUsers, rankCounts, total, active,
    banned: total - active, usage, rank, event: total - rank, unknown,
    activeRate: total ? Math.round(active / total * 100) : null };
}

function setAnalyticsStorage(storage) {
  if (!["all", "rank", "chungsuc"].includes(storage)) return;
  analyticsReportState.storage = storage;
  analyticsReportState.selectedDate = null;
  renderAnalyticsData();
}

function analyticsSetText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
function analyticsSetHtml(id, html) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = html;
}
function analyticsEmpty(columns, text = "Không có dữ liệu phù hợp với bộ lọc.") {
  return `<tr><td colspan="${columns}" class="analytics-empty">${escapeHtml(text)}</td></tr>`;
}
function analyticsBar(label, count, total, color = "#a99bff") {
  const percent = total ? Math.round(count / total * 100) : 0;
  return `<div class="analytics-bar-item"><div class="analytics-bar-labels"><span>${escapeHtml(label)}</span><span>${count} acc · ${percent}%</span></div><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${percent}%;background:${color}"></div></div></div>`;
}

function inspectDailyAccounts(dateKey) {
  analyticsReportState.selectedDate = dateKey;
  const scope = getAnalyticsScope();
  const matched = scope.accounts.filter(a => getAccountDateInfo(a).fullDateKey === dateKey);
  const card = document.getElementById("analytics-daily-detail-card");
  if (!card) return;
  analyticsSetText("analytics-daily-detail-title", `${matched.length} acc · ${matched.length ? getAccountDateInfo(matched[0]).displayDate : dateKey}`);
  analyticsSetHtml("analytics-daily-detail-tbody", matched.map((a, index) => {
    const info = getAccountDateInfo(a);
    const banned = checkBanStatus(a.unlockDate, a).isBanned;
    const label = a.category === "chungsuc" ? "Chung sức" : parseRankGroup(a.rank).name;
    return `<tr><td>${index + 1}</td><td>${escapeHtml(a.username)}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(String(a.uyTin ?? "—"))}</td><td>${escapeHtml(a.createdBy || "Không rõ")}</td><td>${escapeHtml(info.timeStr || "—")}</td><td><span class="${banned ? "analytics-status-ban" : "analytics-status-ready"}">${banned ? "BAN" : "Sẵn sàng"}</span></td></tr>`;
  }).join("") || analyticsEmpty(7));
  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderAnalyticsData() {
  const scope = getAnalyticsScope();
  const report = buildAnalyticsReport(scope);
  const storageLabel = { all: "Tất cả kho", rank: "Chơi rank", chungsuc: "Chung sức" }[analyticsReportState.storage];
  const rangeLabel = { all: "Mọi ngày thêm", today: "Thêm hôm nay", "7d": "Thêm trong 7 ngày", "30d": "Thêm trong 30 ngày" }[currentAnalyticsTimeRange];
  const selector = document.getElementById("analytics-storage-filter");
  if (selector) selector.value = analyticsReportState.storage;
  analyticsSetText("analytics-scope-summary", `${storageLabel} · ${rangeLabel} · ${report.total} acc hiện còn trong kho`);
  analyticsSetText("analytics-updated-at", `Tính lúc ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(scope.now)} · Giờ Việt Nam`);
  const missingDates = scope.storageAccounts.filter(a => getAccountDateInfo(a).fullDateKey === "unknown").length;
  analyticsSetText("analytics-data-note", "Bộ lọc thời gian dựa trên ngày thêm acc. Lượt sao chép là bộ đếm tích lũy của các acc đã chọn, không phải lượt phát sinh trong kỳ. Dữ liệu hiện tại chưa có nhật ký từng lượt; acc đã xóa không nằm trong báo cáo." +
    (missingDates ? ` Có ${missingDates} acc chưa rõ ngày thêm, chỉ xuất hiện khi chọn “Mọi ngày thêm”.` : ""));
  analyticsSetText("analytics-kpi-total", report.total);
  analyticsSetText("analytics-kpi-total-sub", `${report.rank} rank · ${report.event} chung sức`);
  analyticsSetText("analytics-kpi-usage", report.usage.toLocaleString("vi-VN"));
  analyticsSetText("analytics-kpi-usage-sub", "Bộ đếm hiện có của acc đã chọn");
  analyticsSetText("analytics-kpi-contributors", [...report.contributors.keys()].filter(x => x !== "Không rõ").length);
  analyticsSetText("analytics-kpi-contributors-sub", `${report.contributors.get("Không rõ") || 0} acc chưa rõ người thêm`);
  analyticsSetText("analytics-kpi-rate", report.activeRate === null ? "—" : `${report.activeRate}%`);
  analyticsSetText("analytics-kpi-rate-sub", report.total ? `${report.active} sẵn sàng · ${report.banned} BAN` : "Chưa có dữ liệu");

  const newToday = scope.accounts.filter(a => getAccountDateInfo(a).fullDateKey === scope.today.fullDateKey).length;
  const neverUsed = scope.accounts.filter(a => analyticsUsage(a) === 0).length;
  const dueToday = scope.accounts.filter(a => String(a.unlockDate || "").trim() === scope.today.dateKey).length;
  analyticsSetHtml("analytics-daily-pulse-grid", [
    [newToday, "Acc thêm hôm nay", "Trong bộ lọc đang chọn"],
    [neverUsed, "Acc chưa có lượt sao chép", "Theo bộ đếm hiện có"],
    [dueToday, "Có lịch mở BAN hôm nay", "Theo ngày đã nhập, chưa xác minh trong game"],
  ].map(([value, label, note]) => `<div class="daily-pulse-card"><div><div class="daily-pulse-val">${value}</div><div class="daily-pulse-lbl">${label}</div><div class="daily-pulse-sub">${note}</div></div></div>`).join(""));

  const chartLength = scope.days || 7;
  const chartDays = Array.from({ length: chartLength }, (_, i) => {
    const info = analyticsDateInfo(scope.todayStart - (chartLength - 1 - i) * ANALYTICS_DAY_MS);
    return { info, count: report.daily.get(info.fullDateKey)?.accounts.length || 0 };
  });
  const max = Math.max(1, ...chartDays.map(d => d.count));
  analyticsSetText("analytics-chart-title", `Acc hiện còn theo ngày thêm · ${chartLength} ngày gần nhất`);
  analyticsSetText("analytics-chart-subtitle", "Chọn cột để xem acc · Cột 0 không có chiều cao");
  const chart = document.getElementById("analytics-daily-chart-container");
  if (chart) {
    chart.style.setProperty("--analytics-chart-columns", Math.min(10, chartLength));
    chart.innerHTML = chartDays.map(({ info, count }) => `<button type="button" class="daily-chart-col ${info.fullDateKey === scope.today.fullDateKey ? "is-today" : ""}" onclick="inspectDailyAccounts('${info.fullDateKey}')" aria-label="${info.displayDate}: ${count} acc"><span class="daily-chart-val">${count}</span><span class="daily-chart-bar-wrap"><span class="daily-chart-bar-fill" style="height:${count / max * 100}%"></span></span><span class="daily-chart-label">${info.dateKey}</span></button>`).join("");
  }
  const entries = [...report.daily.entries()].sort(([a], [b]) => a === "unknown" ? 1 : b === "unknown" ? -1 : b.localeCompare(a));
  analyticsSetText("analytics-ledger-total-days", `${entries.filter(([key]) => key !== "unknown").length} ngày · ${report.unknown} acc chưa rõ ngày`);
  analyticsSetHtml("analytics-daily-ledger-tbody", entries.map(([key, entry]) => {
    const top = [...entry.contributors].sort((a, b) => b[1] - a[1])[0];
    return `<tr><td>${escapeHtml(entry.info.displayDate)}</td><td>${entry.accounts.length} acc</td><td>${entry.rank} rank · ${entry.event} chung sức</td><td>${escapeHtml(top[0])} (${top[1]})</td><td class="analytics-number">${entry.usage}</td><td><button type="button" class="btn btn-tool" onclick="inspectDailyAccounts('${key}')">Xem (${entry.accounts.length})</button></td></tr>`;
  }).join("") || analyticsEmpty(6));
  // A changed filter must never leave a detail table from the old scope visible.
  const detail = document.getElementById("analytics-daily-detail-card");
  if (detail) detail.style.display = "none";
  analyticsReportState.selectedDate = null;

  analyticsSetText("analytics-rank-total-note", `${report.rankCounts.size} nhóm · ${report.rank} acc chơi rank`);
  analyticsSetHtml("analytics-rank-bars-container", [...report.rankCounts].map(([key, count]) => {
    const config = RANK_CONFIG[key] || RANK_CONFIG.KHAC;
    return analyticsBar(config.name, count, report.rank, config.color);
  }).join("") || '<p class="analytics-empty">Không có acc chơi rank trong bộ lọc.</p>');
  analyticsSetHtml("analytics-storage-compare-container", analyticsBar("Chơi rank", report.rank, report.total) + analyticsBar("Chung sức", report.event, report.total, "#69bcb0"));
  analyticsSetHtml("analytics-status-bars-container", report.total ? analyticsBar("Sẵn sàng theo dữ liệu hiện có", report.active, report.total, "#68d9b0") + analyticsBar("BAN", report.banned, report.total, "#f18b9e") : '<p class="analytics-empty">Chưa có dữ liệu để tính tỷ lệ.</p>');
  analyticsSetText("analytics-total-contributors-count", `${report.contributors.size} nhóm người thêm`);
  analyticsSetHtml("analytics-contributors-tbody", [...report.contributors].sort((a, b) => b[1] - a[1]).map(([name, count], i) => `<tr><td>${i + 1}</td><td>${escapeHtml(name)}</td><td class="analytics-number">${count}</td><td class="analytics-number">${Math.round(count / report.total * 100)}%</td></tr>`).join("") || analyticsEmpty(4));
  analyticsSetHtml("analytics-recent-adds-container", [...scope.accounts].sort((a, b) => getAccountDateInfo(b).timestamp - getAccountDateInfo(a).timestamp).slice(0, 15).map(a => `<div class="analytics-activity-row"><div><strong>${escapeHtml(a.username)}</strong><span>${escapeHtml(a.createdBy || "Không rõ")} · ${a.category === "chungsuc" ? "Chung sức" : "Chơi rank"}</span></div><span>${escapeHtml(getAccountDateInfo(a).displayDate)}</span></div>`).join("") || '<p class="analytics-empty">Không có acc phù hợp.</p>');
  analyticsSetHtml("analytics-hot-accounts-tbody", [...scope.accounts].filter(a => analyticsUsage(a) > 0).sort((a, b) => analyticsUsage(b) - analyticsUsage(a)).slice(0, 10).map((a, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(a.username)}</td><td>${escapeHtml(a.category === "chungsuc" ? "Chung sức" : parseRankGroup(a.rank).name)}</td><td class="analytics-number">${analyticsUsage(a)}</td><td>${escapeHtml(a.lastUsedBy || "Không rõ")}<br><small>${escapeHtml(a.lastUsed || "—")}</small></td></tr>`).join("") || analyticsEmpty(5, "Chưa có acc có lượt sao chép trong nhóm đã chọn."));
  // lastUsedBy identifies only the latest user, never every user behind useCount.
  analyticsSetHtml("analytics-top-users-tbody", [...report.lastUsers].sort((a, b) => b[1] - a[1]).map(([name, count], i) => `<tr><td>${i + 1}</td><td>${escapeHtml(name)}</td><td class="analytics-number">${count} acc</td><td class="analytics-number">${Math.round(count / report.knownLastUsers * 100)}%</td></tr>`).join("") || analyticsEmpty(4, "Chưa có thông tin người sao chép gần nhất."));
}

// Keep keyboard navigation inside the open report, including when panels change.
document.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  const modal = document.getElementById("analytics-modal");
  if (!modal?.classList.contains("show")) return;
  const controls = [...modal.querySelectorAll('button, select, input, summary, [tabindex="0"]')]
    .filter(element => !element.disabled && element.getClientRects().length);
  if (!controls.length) return;
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
});
