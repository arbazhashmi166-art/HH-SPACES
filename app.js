const STORAGE_KEY = "site-ledger-data-v1";
const SESSION_KEY = "site-tracker-session-v1";
const REMEMBERED_LOGIN_KEY = "hh-spaces-remembered-login-v1";
const THEME_KEY = "hh-spaces-theme-v1";
const SUPABASE_CONFIG_KEY = "hh-spaces-supabase-config-v1";
const CLOUD_TABLE = "hh_spaces_app_state";
const CLOUD_ROW_ID = "main";
const ALLOWED_USERS = [
  { username: "SAHIL123", password: "DAVID9529", name: "Sahil" },
  { username: "ARBAZ123", password: "BUCKY1081", name: "Arbaz" }
];

const state = loadState();
const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
let supabaseClient = null;
let cloudSaveTimer = null;

const views = {
  dashboard: "Dashboard",
  capital: "Company Capital",
  sites: "Sites & Clients",
  rateList: "Rate List",
  customerBills: "Customer Bills",
  extraWorks: "Extra Site Works",
  wages: "Labour Wages",
  materials: "Material Expenses",
  expenses: "Expense Tracker",
  payments: "Client Payments",
  bills: "Pending Payment Bills",
  measurements: "Measurement Book",
  boq: "BOQ Management",
  schedule: "Schedule & Targets",
  progress: "Work Progress",
  diary: "Site Diary",
  settings: "Settings",
  updates: "Daily Updates"
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme();
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    input.value = today;
  });
  document.getElementById("monthFilter").value = currentMonth;
  document.getElementById("todayLabel").textContent = longDate(today);

  bindAuth();
  bindNavigation();
  bindSearch();
  bindForms();
  bindActions();
  bindCloudSync();
  initSupabaseClient();
  updateAuthView();
  render();
});

function bindAuth() {
  document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);
  document.getElementById("lockApp").addEventListener("click", lockApp);
  document.getElementById("lockAppTop").addEventListener("click", lockApp);
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const username = document.getElementById("authUser").value.trim().toUpperCase();
  const password = document.getElementById("authPass").value.trim();

  if (!username || !password) {
    showAuthMessage("Enter username and password.");
    return;
  }

  const user = ALLOWED_USERS.find((item) => item.username === username && item.password === password);
  if (user) {
    sessionStorage.setItem(SESSION_KEY, user.username);
    localStorage.setItem(REMEMBERED_LOGIN_KEY, user.username);
    clearAuthForm();
    updateAuthView();
    return;
  }

  showAuthMessage("Wrong username or password.");
}

function updateAuthView() {
  const rememberedUser = localStorage.getItem(REMEMBERED_LOGIN_KEY);
  const sessionUser = sessionStorage.getItem(SESSION_KEY);
  const unlocked = Boolean(sessionUser || rememberedUser);
  if (!sessionUser && rememberedUser) {
    sessionStorage.setItem(SESSION_KEY, rememberedUser);
  }
  document.body.classList.toggle("app-locked", !unlocked);
  document.getElementById("authModeText").textContent = "Login once on this device";
  document.getElementById("authSubmit").textContent = "Login";
  document.getElementById("confirmPassWrap")?.classList.add("is-hidden");
  document.getElementById("authPass").setAttribute("autocomplete", "current-password");
}

function lockApp() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBERED_LOGIN_KEY);
  clearAuthForm();
  updateAuthView();
}

function clearAuthForm() {
  document.getElementById("authForm").reset();
  showAuthMessage("");
}

function showAuthMessage(message) {
  document.getElementById("authMessage").textContent = message;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return normalizeState(JSON.parse(saved));
  }

  return normalizeState({
    capital: [],
    sites: [],
    rateList: [],
    customerBills: [],
    extraWorks: [],
    wages: [],
    materials: [],
    expenses: [],
    payments: [],
    bills: [],
    measurements: [],
    boq: [],
    schedule: [],
    progress: [],
    diary: [],
    settings: {},
    updates: []
  });
}

function normalizeState(data) {
  return {
    capital: Array.isArray(data.capital) ? data.capital : [],
    sites: Array.isArray(data.sites) ? data.sites : [],
    rateList: Array.isArray(data.rateList) ? data.rateList : [],
    customerBills: Array.isArray(data.customerBills) ? data.customerBills : [],
    extraWorks: Array.isArray(data.extraWorks) ? data.extraWorks : [],
    wages: Array.isArray(data.wages) ? data.wages : [],
    materials: Array.isArray(data.materials) ? data.materials : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    payments: Array.isArray(data.payments) ? data.payments : [],
    bills: Array.isArray(data.bills) ? data.bills : [],
    measurements: Array.isArray(data.measurements) ? data.measurements : [],
    boq: Array.isArray(data.boq) ? data.boq : [],
    schedule: Array.isArray(data.schedule) ? data.schedule : [],
    progress: Array.isArray(data.progress) ? data.progress : [],
    diary: Array.isArray(data.diary) ? data.diary : [],
    settings: typeof data.settings === "object" && data.settings ? data.settings : {},
    updates: Array.isArray(data.updates) ? data.updates : []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function bindCloudSync() {
  document.getElementById("cloudSync").addEventListener("click", openCloudModal);
  document.getElementById("closeCloud").addEventListener("click", closeCloudModal);
  document.getElementById("saveCloudConfig").addEventListener("click", saveCloudConfig);
  document.getElementById("pullCloud").addEventListener("click", pullCloudState);
  document.getElementById("pushCloud").addEventListener("click", () => pushCloudState(true));
}

function openCloudModal() {
  const config = getSupabaseConfig();
  document.getElementById("supabaseUrl").value = config.url || "";
  document.getElementById("supabaseAnonKey").value = config.anonKey || "";
  document.getElementById("cloudModal").classList.remove("is-hidden");
  updateCloudStatus(supabaseClient ? "Connected. You can load or save cloud data." : "Not connected. Paste Supabase details.");
}

function closeCloudModal() {
  document.getElementById("cloudModal").classList.add("is-hidden");
}

function getSupabaseConfig() {
  const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
  return saved ? JSON.parse(saved) : {};
}

function saveCloudConfig() {
  const url = document.getElementById("supabaseUrl").value.trim();
  const anonKey = document.getElementById("supabaseAnonKey").value.trim();
  if (!url || !anonKey) {
    updateCloudStatus("Enter Project URL and anon public key.");
    return;
  }
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, anonKey }));
  initSupabaseClient();
  updateCloudStatus(supabaseClient ? "Connected. Press Save To Cloud once." : "Could not connect. Check URL/key.");
}

function initSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) {
    supabaseClient = null;
    return;
  }
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
}

function queueCloudSave() {
  if (!supabaseClient || (!sessionStorage.getItem(SESSION_KEY) && !localStorage.getItem(REMEMBERED_LOGIN_KEY))) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => pushCloudState(false), 1200);
}

async function pushCloudState(showResult) {
  if (!supabaseClient) {
    if (showResult) updateCloudStatus("Not connected. Save Supabase URL and anon key first.");
    return;
  }
  const payload = JSON.parse(JSON.stringify(state));
  const { error } = await supabaseClient
    .from(CLOUD_TABLE)
    .upsert({ id: CLOUD_ROW_ID, payload, updated_at: new Date().toISOString() });

  if (error) {
    updateCloudStatus(`Cloud save failed: ${error.message}`);
    return;
  }
  updateCloudStatus(`Saved to cloud at ${new Date().toLocaleTimeString("en-IN")}.`);
}

async function pullCloudState() {
  if (!supabaseClient) {
    updateCloudStatus("Not connected. Save Supabase URL and anon key first.");
    return;
  }
  const { data, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .select("payload, updated_at")
    .eq("id", CLOUD_ROW_ID)
    .maybeSingle();

  if (error) {
    updateCloudStatus(`Cloud load failed: ${error.message}`);
    return;
  }
  if (!data?.payload) {
    updateCloudStatus("No cloud data found. Press Save To Cloud first.");
    return;
  }

  Object.assign(state, normalizeState(data.payload));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  updateCloudStatus(`Loaded cloud data from ${data.updated_at ? new Date(data.updated_at).toLocaleString("en-IN") : "Supabase"}.`);
}

function updateCloudStatus(message) {
  const status = document.getElementById("cloudStatus");
  if (status) status.textContent = message;
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      activateView(button.dataset.view);
    });
  });

  document.querySelectorAll(".nav-jump").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.view));
  });

  document.getElementById("siteFilter").addEventListener("change", render);
  document.getElementById("monthFilter").addEventListener("change", render);
}

function bindSearch() {
  document.getElementById("globalSearch").addEventListener("input", renderSearchResults);
  document.getElementById("clearSearch").addEventListener("click", () => {
    document.getElementById("globalSearch").value = "";
    renderSearchResults();
  });

  document.getElementById("searchResultsList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-view]");
    if (!button) return;
    activateView(button.dataset.searchView);
  });
}

function activateView(viewName) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.getElementById(viewName).classList.add("active");
  document.getElementById("viewTitle").textContent = views[viewName];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindForms() {
  bindForm("capitalForm", (data) => {
    state.capital.push({
      id: makeId(),
      date: data.date,
      type: data.type,
      source: data.source,
      amount: number(data.amount)
    });
  });

  bindForm("siteForm", (data) => {
    state.sites.push({
      id: makeId(),
      name: data.name,
      client: data.client,
      phone: data.phone,
      location: data.location,
      contract: number(data.contract),
      startDate: data.startDate,
      status: data.status
    });
  });

  bindForm("rateListForm", (data) => {
    state.rateList.push({
      id: makeId(),
      date: data.date,
      category: data.category,
      work: data.work,
      unit: data.unit,
      rate: number(data.rate),
      note: data.note
    });
  });

  bindForm("customerBillForm", (data) => {
    const site = findSite(data.siteId);
    const quantity = number(data.quantity || 1);
    const rate = number(data.rate);
    const amount = quantity * rate;
    const discount = number(data.discount);
    const tax = number(data.tax);
    const total = Math.max(amount - discount + tax, 0);
    state.customerBills.push({
      id: makeId(),
      date: data.date,
      billNo: data.billNo,
      siteId: data.siteId,
      client: data.client || site.client || "",
      work: data.work,
      unit: data.unit,
      quantity,
      rate,
      amount,
      discount,
      tax,
      total,
      status: data.status,
      note: data.note
    });
  });

  bindForm("extraWorkForm", (data) => {
    state.extraWorks.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      work: data.work,
      approvedBy: data.approvedBy,
      note: data.note,
      amount: number(data.amount)
    });
  });

  bindForm("wageForm", async (data, form) => {
    const attendance = data.attendance || "Present";
    const days = attendance === "Absent" ? 0 : number(data.days);
    const photoFile = form.elements.photo?.files?.[0];
    state.wages.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      worker: data.worker,
      phone: data.phone,
      photo: photoFile ? await fileToDataUrl(photoFile) : "",
      attendance,
      workType: data.workType,
      days,
      rate: number(data.rate),
      amount: days * number(data.rate)
    });
  });

  bindForm("materialForm", (data) => {
    state.materials.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      item: data.item,
      category: data.category,
      unit: data.unit,
      quantityReceived: number(data.quantityReceived),
      quantityUsed: number(data.quantityUsed),
      supplier: data.supplier,
      billNo: data.billNo,
      amount: number(data.amount)
    });
  });

  bindForm("expenseForm", (data) => {
    state.expenses.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      type: data.type,
      title: data.title,
      paidTo: data.paidTo,
      amount: number(data.amount),
      notes: data.notes
    });
  });

  bindForm("paymentForm", (data) => {
    const site = findSite(data.siteId);
    state.payments.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      client: data.client || site.client,
      mode: data.mode,
      reference: data.reference,
      amount: number(data.amount)
    });
  });

  bindForm("billForm", (data) => {
    state.bills.push({
      id: makeId(),
      date: data.date,
      dueDate: data.dueDate,
      siteId: data.siteId,
      party: data.party,
      detail: data.detail,
      amount: number(data.amount),
      status: "Pending"
    });
  });

  bindForm("measurementForm", (data) => {
    const plaster = number(data.plasterSqft);
    const pop = number(data.popSqft);
    const tile = number(data.tileSqft);
    const waterproofing = number(data.waterproofingSqft);
    const painting = number(data.paintingSqft);
    const electrical = number(data.electricalPoints);
    const runningFeet = number(data.runningFeet);
    state.measurements.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      area: data.area,
      plasterSqft: plaster,
      popSqft: pop,
      tileSqft: tile,
      waterproofingSqft: waterproofing,
      paintingSqft: painting,
      electricalPoints: electrical,
      runningFeet,
      total: plaster + pop + tile + waterproofing + painting + electrical + runningFeet,
      notes: data.notes
    });
  });

  bindForm("boqForm", (data) => {
    const estimatedCost = number(data.estimatedCost);
    const actualCost = number(data.actualCost);
    state.boq.push({
      id: makeId(),
      siteId: data.siteId,
      item: data.item,
      unit: data.unit,
      estimatedQuantity: number(data.estimatedQuantity),
      estimatedCost,
      actualQuantity: number(data.actualQuantity),
      actualCost,
      variance: actualCost - estimatedCost,
      notes: data.notes
    });
  });

  bindForm("scheduleForm", (data) => {
    state.schedule.push({
      id: makeId(),
      date: data.date,
      targetDate: data.targetDate,
      siteId: data.siteId,
      task: data.task,
      targetPercent: clamp(number(data.targetPercent || 100), 0, 100),
      assignedTo: data.assignedTo,
      status: data.status,
      notes: data.notes
    });
  });

  bindForm("progressForm", (data) => {
    state.progress.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      stage: data.stage,
      percent: clamp(number(data.percent), 0, 100),
      notes: data.notes
    });
  });

  bindForm("diaryForm", (data) => {
    state.diary.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      weather: data.weather,
      dailyNotes: data.dailyNotes,
      labourIssues: data.labourIssues,
      materialIssues: data.materialIssues,
      clientInstructions: data.clientInstructions
    });
  });

  bindForm("settingsForm", async (data, form) => {
    const logoFile = form.elements.logo?.files?.[0];
    state.settings = {
      companyName: data.companyName,
      gstNumber: data.gstNumber,
      phone: data.phone,
      address: data.address,
      pdfHeader: data.pdfHeader,
      pdfFooter: data.pdfFooter,
      logo: logoFile ? await fileToDataUrl(logoFile) : state.settings.logo || ""
    };
  });

  bindForm("updateForm", async (data, form) => {
    const photoFiles = Array.from(form.elements.photos?.files || []);
    state.updates.push({
      id: makeId(),
      date: data.date,
      siteId: data.siteId,
      labourCount: number(data.labourCount),
      weather: data.weather,
      workDone: data.workDone,
      nextPlan: data.nextPlan,
      photos: await filesToDataUrls(photoFiles)
    });
  });
}

function bindForm(formId, onSubmit) {
  const form = document.getElementById(formId);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.sites.length && !["siteForm", "capitalForm", "rateListForm", "settingsForm"].includes(formId)) {
      alert("Add at least one site first.");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    await onSubmit(data, form);
    saveState();
    form.reset();
    form.querySelectorAll('input[type="date"]').forEach((input) => {
      input.value = today;
    });
    const days = form.querySelector('input[name="days"]');
    if (days) days.value = 1;
    render();
  });
}

function bindActions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    const [collection, id] = button.dataset.delete.split(":");
    state[collection] = state[collection].filter((item) => item.id !== id);
    saveState();
    render();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-paid]");
    if (!button) return;
    const bill = state.bills.find((item) => item.id === button.dataset.paid);
    if (bill) {
      bill.status = "Paid";
      saveState();
      render();
    }
  });

  document.getElementById("resetDemo").addEventListener("click", () => {
    if (!confirm("Clear all saved data from this browser?")) return;
    Object.keys(state).forEach((key) => {
      state[key] = [];
    });
    saveState();
    render();
  });

  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.getElementById("exportWord").addEventListener("click", exportWordReport);
  document.getElementById("exportExcel").addEventListener("click", exportExcelReport);
  document.getElementById("exportPdf").addEventListener("click", exportPdfReport);
  document.getElementById("printReport").addEventListener("click", printReportPreview);
  document.getElementById("closeReport").addEventListener("click", closeReportPreview);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  document.body.classList.toggle("dark-mode", theme === "dark");
  const button = document.getElementById("themeToggle");
  if (button) button.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function toggleTheme() {
  const next = document.body.classList.contains("dark-mode") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
}

function render() {
  renderSiteFilter();
  renderSiteSelects();
  renderSearchResults();
  renderDashboard();
  renderCapital();
  renderSites();
  renderRateList();
  renderCustomerBills();
  renderExtraWorks();
  renderWages();
  renderMaterials();
  renderExpenses();
  renderPayments();
  renderBills();
  renderMeasurements();
  renderBoq();
  renderSchedule();
  renderProgress();
  renderDiary();
  renderSettings();
  renderUpdates();
}

function renderSearchResults() {
  const input = document.getElementById("globalSearch");
  const query = input?.value.trim().toLowerCase() || "";
  const panel = document.getElementById("searchResultsPanel");
  const list = document.getElementById("searchResultsList");
  const title = document.getElementById("searchResultsTitle");
  if (!query) {
    panel.classList.add("is-hidden");
    list.innerHTML = "";
    return;
  }

  const results = buildSearchRecords()
    .filter((record) => record.searchText.includes(query))
    .slice(0, 40);

  panel.classList.remove("is-hidden");
  title.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for "${input.value.trim()}"`;
  list.innerHTML = results.length
    ? results.map(searchResultCard).join("")
    : `<div class="activity-card"><p>No matching records found.</p></div>`;
}

function buildSearchRecords() {
  const records = [];
  state.sites.forEach((site) => {
    records.push(makeSearchRecord("Sites & Clients", "sites", site.name, site.client, site, [
      ["Phone", site.phone],
      ["Location", site.location],
      ["Contract", formatMoney(site.contract)],
      ["Total", formatMoney(siteTotalAmount(site.id))]
    ]));
  });
  state.capital.forEach((item) => {
    records.push(makeSearchRecord("Company Capital", "capital", item.source, item.type, item, [
      ["Date", dateText(item.date)],
      ["Amount", formatMoney(item.amount)]
    ]));
  });
  state.rateList.forEach((item) => {
    records.push(makeSearchRecord("Rate List", "rateList", item.work, item.category, item, [
      ["Date", dateText(item.date)],
      ["Unit", item.unit],
      ["Rate", formatMoney(item.rate)],
      ["Note", item.note]
    ]));
  });
  state.customerBills.forEach((item) => {
    records.push(makeSearchRecord("Customer Bills", "customerBills", item.billNo || item.work, item.client || plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Site", plainSiteName(item.siteId)],
      ["Work", item.work],
      ["Quantity", `${item.quantity} ${item.unit || ""}`],
      ["Total", formatMoney(item.total)],
      ["Status", item.status]
    ]));
  });
  state.extraWorks.forEach((item) => {
    records.push(makeSearchRecord("Extra Works", "extraWorks", item.work, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Approved", item.approvedBy],
      ["Amount", formatMoney(item.amount)]
    ]));
  });
  state.wages.forEach((item) => {
    records.push(makeSearchRecord("Labour Wages", "wages", item.worker, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Mobile", item.phone],
      ["Work", item.workType],
      ["Attendance", item.attendance],
      ["Amount", formatMoney(item.amount)]
    ]));
  });
  state.materials.forEach((item) => {
    records.push(makeSearchRecord("Material Expenses", "materials", item.item, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Category", item.category],
      ["Stock", `${number(item.quantityReceived) - number(item.quantityUsed)} ${item.unit || ""}`],
      ["Supplier", item.supplier],
      ["Bill", item.billNo],
      ["Amount", formatMoney(item.amount)]
    ]));
  });
  state.expenses.forEach((item) => {
    records.push(makeSearchRecord("Expense Tracker", "expenses", item.title, item.type, item, [
      ["Date", dateText(item.date)],
      ["Site", plainSiteName(item.siteId)],
      ["Paid To", item.paidTo],
      ["Amount", formatMoney(item.amount)]
    ]));
  });
  state.payments.forEach((item) => {
    records.push(makeSearchRecord("Client Payments", "payments", item.client || plainSiteName(item.siteId), item.mode, item, [
      ["Date", dateText(item.date)],
      ["Site", plainSiteName(item.siteId)],
      ["Ref", item.reference],
      ["Amount", formatMoney(item.amount)]
    ]));
  });
  state.bills.forEach((item) => {
    records.push(makeSearchRecord("Pending Bills", "bills", item.party, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Due", item.dueDate ? dateText(item.dueDate) : ""],
      ["Detail", item.detail],
      ["Amount", formatMoney(item.amount)],
      ["Status", item.status]
    ]));
  });
  state.measurements.forEach((item) => {
    records.push(makeSearchRecord("Measurement Book", "measurements", item.area, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Total", item.total],
      ["Notes", item.notes]
    ]));
  });
  state.boq.forEach((item) => {
    records.push(makeSearchRecord("BOQ Management", "boq", item.item, plainSiteName(item.siteId), item, [
      ["Unit", item.unit],
      ["Estimated", formatMoney(item.estimatedCost)],
      ["Actual", formatMoney(item.actualCost)],
      ["Variance", formatMoney(item.variance)]
    ]));
  });
  state.schedule.forEach((item) => {
    records.push(makeSearchRecord("Schedule & Targets", "schedule", item.task, plainSiteName(item.siteId), item, [
      ["Target", dateText(item.targetDate)],
      ["Assigned", item.assignedTo],
      ["Status", item.status],
      ["Notes", item.notes]
    ]));
  });
  state.progress.forEach((item) => {
    records.push(makeSearchRecord("Work Progress", "progress", item.stage, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Progress", `${item.percent}%`],
      ["Notes", item.notes]
    ]));
  });
  state.diary.forEach((item) => {
    records.push(makeSearchRecord("Site Diary", "diary", item.dailyNotes, plainSiteName(item.siteId), item, [
      ["Date", dateText(item.date)],
      ["Weather", item.weather],
      ["Client", item.clientInstructions]
    ]));
  });
  state.updates.forEach((item) => {
    records.push(makeSearchRecord("Daily Updates", "updates", plainSiteName(item.siteId), item.workDone, item, [
      ["Date", dateText(item.date)],
      ["Labour", item.labourCount],
      ["Weather", item.weather],
      ["Next", item.nextPlan],
      ["Photos", Array.isArray(item.photos) ? item.photos.length : 0]
    ]));
  });
  return records;
}

function makeSearchRecord(section, view, title, subtitle, item, details) {
  const safeDetails = details.filter(([, value]) => value !== undefined && value !== null && value !== "");
  const itemValues = Object.entries(item)
    .filter(([key, value]) => !["photo", "photos"].includes(key) && ["string", "number", "boolean"].includes(typeof value))
    .map(([, value]) => value);
  const haystack = [
    section,
    view,
    title,
    subtitle,
    ...itemValues,
    ...safeDetails.flatMap(([label, value]) => [label, value])
  ].join(" ").toLowerCase();
  return { section, view, title: title || section, subtitle: subtitle || "", details: safeDetails, searchText: haystack };
}

function searchResultCard(record) {
  const details = record.details
    .slice(0, 5)
    .map(([label, value]) => `<span><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</span>`)
    .join("");
  return `<article class="search-card">
    <div>
      <span class="search-section">${escapeHtml(record.section)}</span>
      <h4>${escapeHtml(record.title)}</h4>
      <p>${escapeHtml(record.subtitle)}</p>
      <div class="search-detail-row">${details}</div>
    </div>
    <button class="secondary-light-btn" data-search-view="${record.view}" type="button">Open</button>
  </article>`;
}

function renderSiteFilter() {
  const filter = document.getElementById("siteFilter");
  const selected = filter.value || "all";
  filter.innerHTML = '<option value="all">All sites</option>' + state.sites
    .map((site) => `<option value="${site.id}">${escapeHtml(site.name)}</option>`)
    .join("");
  filter.value = state.sites.some((site) => site.id === selected) ? selected : "all";
}

function renderSiteSelects() {
  const options = state.sites.length
    ? state.sites.map((site) => `<option value="${site.id}">${escapeHtml(site.name)} - ${escapeHtml(site.client)}</option>`).join("")
    : '<option value="">Add a site first</option>';

  document.querySelectorAll('select[name="siteId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = options;
    if (state.sites.some((site) => site.id === current)) {
      select.value = current;
    }
  });
}

function renderDashboard() {
  const capital = filtered(state.capital);
  const wages = filtered(state.wages);
  const materials = filtered(state.materials);
  const expenses = filtered(state.expenses);
  const extraWorks = filtered(state.extraWorks);
  const customerBills = filtered(state.customerBills);
  const payments = filtered(state.payments);
  const bills = filtered(state.bills).filter((bill) => bill.status !== "Paid");
  const paidBills = filtered(state.bills).filter((bill) => bill.status === "Paid");
  const capitalAdded = sum(capital.filter((item) => item.type === "add"), "amount");
  const capitalWithdrawn = sum(capital.filter((item) => item.type === "withdraw"), "amount");
  const companyCapital = capitalAdded - capitalWithdrawn;
  const usedPayment = sum(wages, "amount") + sum(materials, "amount") + sum(expenses, "amount") + sum(paidBills, "amount");
  const totalContract = visibleSites().reduce((total, site) => total + siteTotalAmount(site.id), 0);
  const profitLoss = totalContract - usedPayment;
  const clientPending = visibleSites().reduce((total, site) => {
    const contract = siteTotalAmount(site.id);
    const paid = sum(state.payments.filter((item) => item.siteId === site.id), "amount");
    return total + Math.max(contract - paid, 0);
  }, 0);
  const cashInHand = companyCapital + sum(payments, "amount") - usedPayment;
  const todayWages = wages.filter((item) => item.date === today);
  const todayMaterials = materials.filter((item) => item.date === today);
  const selectedSite = selectedSiteName();

  document.getElementById("selectedSiteLine").textContent = selectedSite;
  document.getElementById("metricSiteSpend").textContent = formatMoney(sum(wages, "amount") + sum(materials, "amount"));
  document.getElementById("metricSpendLabour").textContent = formatMoney(sum(wages, "amount"));
  document.getElementById("metricSpendMaterials").textContent = formatMoney(sum(materials, "amount"));
  document.getElementById("metricTodayLabour").textContent = formatMoney(sum(todayWages, "amount"));
  document.getElementById("metricTodayWorkers").textContent = `${uniqueCount(todayWages, "worker")} workers`;
  document.getElementById("metricTodayMaterials").textContent = formatMoney(sum(todayMaterials, "amount"));
  document.getElementById("metricTodayItems").textContent = `${todayMaterials.length} items`;
  document.getElementById("metricCash").textContent = formatMoney(cashInHand);
  document.getElementById("metricTotalSites").textContent = visibleSites().length;
  document.getElementById("metricProfitLoss").textContent = formatMoney(profitLoss);
  document.getElementById("metricCapital").textContent = formatMoney(companyCapital);
  document.getElementById("metricWages").textContent = formatMoney(sum(wages, "amount"));
  document.getElementById("metricMaterials").textContent = formatMoney(sum(materials, "amount"));
  document.getElementById("metricPayments").textContent = formatMoney(sum(payments, "amount"));
  document.getElementById("metricCustomerBills").textContent = formatMoney(sum(customerBills, "total"));
  document.getElementById("metricExtraWorks").textContent = formatMoney(sum(extraWorks, "amount"));
  document.getElementById("metricUsed").textContent = formatMoney(usedPayment);
  document.getElementById("metricExpenses").textContent = formatMoney(sum(expenses, "amount"));
  document.getElementById("metricBills").textContent = formatMoney(sum(bills, "amount"));
  document.getElementById("metricClientPending").textContent = formatMoney(clientPending);
  renderNotifications();
  document.getElementById("todayEmptyCard").classList.toggle("is-hidden", Boolean(todayWages.length || todayMaterials.length));

  const rows = visibleSites().map((site) => {
    const contract = siteTotalAmount(site.id);
    const paid = sum(state.payments.filter((item) => item.siteId === site.id), "amount");
    const balance = contract ? contract - paid : 0;
    const progress = latestProgress(site.id);
    return `<tr>
      <td><strong>${escapeHtml(site.name)}</strong><br><span>${escapeHtml(site.location || "")}</span></td>
      <td>${escapeHtml(site.client)}</td>
      <td>${progressCell(progress.percent, progress.stage)}</td>
      <td class="amount">${contract ? formatMoney(balance) : "-"}</td>
    </tr>`;
  }).join("");
  document.getElementById("siteSummaryRows").innerHTML = rows || emptyRow(4);

  const updates = filtered(state.updates)
    .sort(byDateDesc)
    .slice(0, 5)
    .map(updateCard)
    .join("");
  document.getElementById("latestUpdates").innerHTML = updates || emptyCard("No daily updates yet.");

  const targets = filtered(state.schedule)
    .filter((item) => item.status !== "Done")
    .sort(byTargetDateAsc)
    .slice(0, 4)
    .map(targetCard)
    .join("");
  document.getElementById("targetRows").innerHTML = targets || emptyCard("No upcoming targets yet.");
}

function renderNotifications() {
  const materialAlerts = state.materials
    .map((item) => {
      const received = number(item.quantityReceived);
      const used = number(item.quantityUsed);
      const balance = received - used;
      return { ...item, balance };
    })
    .filter((item) => number(item.quantityReceived) > 0 && item.balance <= Math.max(number(item.quantityReceived) * 0.15, 1))
    .map((item) => `<article class="activity-card"><h4>Low stock: ${escapeHtml(item.item)}</h4><p>${siteName(item.siteId)} | Balance approx. ${item.balance}</p></article>`);

  const labourAlerts = state.wages
    .filter((item) => number(item.amount) > 0 && item.attendance !== "Absent")
    .slice(0, 3)
    .map((item) => `<article class="activity-card"><h4>Labour payment reminder</h4><p>${escapeHtml(item.worker)} | ${siteName(item.siteId)} | ${formatMoney(item.amount)}</p></article>`);

  const billAlerts = state.customerBills
    .filter((item) => item.status !== "Paid")
    .map((item) => `<article class="activity-card"><h4>Client bill due</h4><p>${escapeHtml(item.billNo || item.work)} | ${escapeHtml(item.client || "-")} | ${formatMoney(item.total)}</p></article>`);

  const alerts = [...materialAlerts, ...labourAlerts, ...billAlerts].slice(0, 6).join("");
  document.getElementById("notificationRows").innerHTML = alerts || emptyCard("No alerts right now.");
}

function selectedSiteName() {
  const siteId = document.getElementById("siteFilter")?.value || "all";
  if (siteId === "all") return "All sites";
  const site = findSite(siteId);
  return site.name ? `${site.name}${site.location ? ` - ${site.location}` : ""}` : "Selected site";
}

function renderCapital() {
  const rows = filtered(state.capital).sort(byDateDesc).map((item) => {
    const isAdd = item.type === "add";
    return `<tr>
      <td>${dateText(item.date)}</td>
      <td><span class="status-pill ${isAdd ? "success-pill" : "warning-pill"}">${isAdd ? "Added" : "Withdrawn"}</span></td>
      <td>${escapeHtml(item.source)}</td>
      <td class="amount">${formatMoney(item.amount)}</td>
      <td><button class="delete-btn" data-delete="capital:${item.id}" type="button">Delete</button></td>
    </tr>`;
  }).join("");
  document.getElementById("capitalRows").innerHTML = rows || emptyRow(5);
}

function renderSites() {
  const rows = visibleSites().map((site) => `<tr>
    <td><strong>${escapeHtml(site.name)}</strong><br><span>${escapeHtml(site.location || "")}</span></td>
    <td>${escapeHtml(site.client)}</td>
    <td>${escapeHtml(site.phone || "-")}</td>
    <td class="amount">${site.contract ? formatMoney(site.contract) : "-"}</td>
    <td class="amount">${formatMoney(siteExtraTotal(site.id))}</td>
    <td class="amount">${formatMoney(siteTotalAmount(site.id))}</td>
    <td>${escapeHtml(site.status)}</td>
    <td><button class="delete-btn" data-delete="sites:${site.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("siteRows").innerHTML = rows || emptyRow(8);
}

function renderRateList() {
  const rows = state.rateList.sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${escapeHtml(item.category || "-")}</td>
    <td><strong>${escapeHtml(item.work)}</strong></td>
    <td>${escapeHtml(item.unit || "-")}</td>
    <td class="amount">${formatMoney(item.rate)}</td>
    <td>${escapeHtml(item.note || "-")}</td>
    <td><button class="delete-btn" data-delete="rateList:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("rateListRows").innerHTML = rows || emptyRow(7);
}

function renderCustomerBills() {
  const rows = filtered(state.customerBills).sort(byDateDesc).map((bill) => `<tr>
    <td>${dateText(bill.date)}</td>
    <td>${escapeHtml(bill.billNo || "-")}</td>
    <td>${siteName(bill.siteId)}</td>
    <td>${escapeHtml(bill.client || "-")}</td>
    <td><strong>${escapeHtml(bill.work)}</strong><br><span>${escapeHtml(bill.note || "")}</span></td>
    <td>${bill.quantity} ${escapeHtml(bill.unit || "")}</td>
    <td class="amount">${formatMoney(bill.rate)}</td>
    <td class="amount">${formatMoney(bill.total)}</td>
    <td><span class="status-pill ${bill.status === "Paid" ? "success-pill" : bill.status === "Part Paid" ? "warning-pill" : "danger-pill"}">${escapeHtml(bill.status || "Unpaid")}</span></td>
    <td><button class="delete-btn" data-delete="customerBills:${bill.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("customerBillRows").innerHTML = rows || emptyRow(10);
}

function renderExtraWorks() {
  const rows = filtered(state.extraWorks).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td><strong>${escapeHtml(item.work)}</strong><br><span>${escapeHtml(item.note || "")}</span></td>
    <td>${escapeHtml(item.approvedBy || "-")}</td>
    <td class="amount">${formatMoney(item.amount)}</td>
    <td><button class="delete-btn" data-delete="extraWorks:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("extraWorkRows").innerHTML = rows || emptyRow(6);
}

function renderWages() {
  const rows = filtered(state.wages).sort(byDateDesc).map((wage) => `<tr>
    <td>${dateText(wage.date)}</td>
    <td>${siteName(wage.siteId)}</td>
    <td>${labourCell(wage)}</td>
    <td>${escapeHtml(wage.phone || "-")}</td>
    <td><span class="status-pill ${attendanceClass(wage.attendance)}">${escapeHtml(wage.attendance || "Present")}</span></td>
    <td>${escapeHtml(wage.workType || "-")}</td>
    <td>${wage.days}</td>
    <td class="amount">${formatMoney(wage.amount)}</td>
    <td><button class="delete-btn" data-delete="wages:${wage.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("wageRows").innerHTML = rows || emptyRow(9);
}

function labourCell(wage) {
  const photo = wage.photo
    ? `<img class="labour-photo" src="${wage.photo}" alt="">`
    : `<span class="labour-avatar">${initials(wage.worker)}</span>`;
  return `<div class="labour-person">${photo}<strong>${escapeHtml(wage.worker)}</strong></div>`;
}

function attendanceClass(attendance) {
  if (attendance === "Absent") return "danger-pill";
  if (attendance === "Half day") return "warning-pill";
  return "success-pill";
}

function renderMaterials() {
  const rows = filtered(state.materials).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td>${escapeHtml(item.item)}</td>
    <td>${escapeHtml(item.category || "-")}</td>
    <td>${number(item.quantityReceived) - number(item.quantityUsed)} ${escapeHtml(item.unit || "")}</td>
    <td>${escapeHtml(item.supplier || "-")}</td>
    <td>${escapeHtml(item.billNo || "-")}</td>
    <td class="amount">${formatMoney(item.amount)}</td>
    <td><button class="delete-btn" data-delete="materials:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("materialRows").innerHTML = rows || emptyRow(9);
}

function renderExpenses() {
  const rows = filtered(state.expenses).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td>${escapeHtml(item.type)}</td>
    <td><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.notes || "")}</span></td>
    <td>${escapeHtml(item.paidTo || "-")}</td>
    <td class="amount">${formatMoney(item.amount)}</td>
    <td><button class="delete-btn" data-delete="expenses:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("expenseRows").innerHTML = rows || emptyRow(7);
}

function renderPayments() {
  const rows = filtered(state.payments).sort(byDateDesc).map((payment) => `<tr>
    <td>${dateText(payment.date)}</td>
    <td>${siteName(payment.siteId)}</td>
    <td>${escapeHtml(payment.client || "-")}</td>
    <td>${escapeHtml(payment.mode)}</td>
    <td>${escapeHtml(payment.reference || "-")}</td>
    <td class="amount">${formatMoney(payment.amount)}</td>
    <td><button class="delete-btn" data-delete="payments:${payment.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("paymentRows").innerHTML = rows || emptyRow(7);
}

function renderBills() {
  const rows = filtered(state.bills).filter((bill) => bill.status !== "Paid").sort(byDateDesc).map((bill) => `<tr>
    <td>${dateText(bill.date)}</td>
    <td>${bill.dueDate ? dateText(bill.dueDate) : "-"}</td>
    <td>${siteName(bill.siteId)}</td>
    <td>${escapeHtml(bill.party)}</td>
    <td>${escapeHtml(bill.detail || "-")}</td>
    <td class="amount">${formatMoney(bill.amount)}</td>
    <td>
      <button class="paid-btn" data-paid="${bill.id}" type="button">Paid</button>
      <button class="delete-btn" data-delete="bills:${bill.id}" type="button">Delete</button>
    </td>
  </tr>`).join("");
  document.getElementById("billRows").innerHTML = rows || emptyRow(7);
}

function renderMeasurements() {
  const rows = filtered(state.measurements).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td>${escapeHtml(item.area || "-")}</td>
    <td>${item.plasterSqft}</td>
    <td>${item.popSqft}</td>
    <td>${item.tileSqft}</td>
    <td>${item.waterproofingSqft}</td>
    <td>${item.paintingSqft}</td>
    <td>${item.electricalPoints}</td>
    <td>${item.runningFeet}</td>
    <td><strong>${item.total}</strong></td>
    <td><button class="delete-btn" data-delete="measurements:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("measurementRows").innerHTML = rows || emptyRow(12);
}

function renderBoq() {
  const rows = filtered(state.boq).map((item) => `<tr>
    <td>${siteName(item.siteId)}</td>
    <td><strong>${escapeHtml(item.item)}</strong><br><span>${escapeHtml(item.notes || "")}</span></td>
    <td>${escapeHtml(item.unit || "-")}</td>
    <td>${item.estimatedQuantity}</td>
    <td class="amount">${formatMoney(item.estimatedCost)}</td>
    <td>${item.actualQuantity}</td>
    <td class="amount">${formatMoney(item.actualCost)}</td>
    <td class="amount">${formatMoney(item.variance)}</td>
    <td><button class="delete-btn" data-delete="boq:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("boqRows").innerHTML = rows || emptyRow(9);
}

function renderSchedule() {
  const rows = filtered(state.schedule).sort(byTargetDateAsc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${dateText(item.targetDate)}</td>
    <td>${siteName(item.siteId)}</td>
    <td><strong>${escapeHtml(item.task)}</strong><br><span>${escapeHtml(item.notes || "")}</span></td>
    <td>${progressCell(item.targetPercent, "")}</td>
    <td>${escapeHtml(item.assignedTo || "-")}</td>
    <td><span class="status-pill ${scheduleStatusClass(item.status)}">${escapeHtml(item.status || "Planned")}</span></td>
    <td><button class="delete-btn" data-delete="schedule:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("scheduleRows").innerHTML = rows || emptyRow(8);
}

function targetCard(item) {
  return `<article class="activity-card target-card">
    <header>
      <div>
        <h4>${escapeHtml(item.task)}</h4>
        <time>${siteName(item.siteId)} | Target: ${dateText(item.targetDate)}</time>
      </div>
      <span class="status-pill ${scheduleStatusClass(item.status)}">${escapeHtml(item.status || "Planned")}</span>
    </header>
    <p><strong>Target:</strong> ${item.targetPercent || 0}% | <strong>Assigned:</strong> ${escapeHtml(item.assignedTo || "-")}</p>
    <p>${escapeHtml(item.notes || "")}</p>
  </article>`;
}

function scheduleStatusClass(status) {
  if (status === "Done") return "success-pill";
  if (status === "Delayed") return "danger-pill";
  if (status === "In Progress") return "warning-pill";
  return "neutral-pill";
}

function renderProgress() {
  const rows = filtered(state.progress).sort(byDateDesc).map((item) => `<tr>
    <td>${dateText(item.date)}</td>
    <td>${siteName(item.siteId)}</td>
    <td>${escapeHtml(item.stage)}</td>
    <td>${progressCell(item.percent, "")}</td>
    <td>${escapeHtml(item.notes || "-")}</td>
    <td><button class="delete-btn" data-delete="progress:${item.id}" type="button">Delete</button></td>
  </tr>`).join("");
  document.getElementById("progressRows").innerHTML = rows || emptyRow(6);
}

function renderUpdates() {
  const rows = filtered(state.updates).sort(byDateDesc).map(updateCard).join("");
  document.getElementById("updateRows").innerHTML = rows || emptyCard("No daily updates yet.");
}

function renderDiary() {
  const rows = filtered(state.diary).sort(byDateDesc).map((item) => `<article class="activity-card">
    <header>
      <div>
        <h4>${siteName(item.siteId)}</h4>
        <time>${dateText(item.date)} | ${escapeHtml(item.weather || "Weather not set")}</time>
      </div>
      <button class="delete-btn" data-delete="diary:${item.id}" type="button">Delete</button>
    </header>
    <p><strong>Notes:</strong> ${escapeHtml(item.dailyNotes || "-")}</p>
    <p><strong>Labour:</strong> ${escapeHtml(item.labourIssues || "-")}</p>
    <p><strong>Material:</strong> ${escapeHtml(item.materialIssues || "-")}</p>
    <p><strong>Client:</strong> ${escapeHtml(item.clientInstructions || "-")}</p>
  </article>`).join("");
  document.getElementById("diaryRows").innerHTML = rows || emptyCard("No diary entries yet.");
}

function renderSettings() {
  const form = document.getElementById("settingsForm");
  if (!form) return;
  Object.entries(state.settings || {}).forEach(([key, value]) => {
    if (key === "logo") return;
    if (form.elements[key]) form.elements[key].value = value || "";
  });
}

function updateCard(update) {
  const photos = Array.isArray(update.photos) ? update.photos : [];
  const gallery = photos.length
    ? `<div class="site-photo-grid">${photos.map((photo) => `<img src="${photo}" alt="Site update photo">`).join("")}</div>`
    : "";
  return `<article class="activity-card">
    <header>
      <div>
        <h4>${siteName(update.siteId)}</h4>
        <time>${dateText(update.date)} | Labour: ${update.labourCount || 0} | ${escapeHtml(update.weather || "Weather not set")} | Photos: ${photos.length}</time>
      </div>
      <button class="delete-btn" data-delete="updates:${update.id}" type="button">Delete</button>
    </header>
    <p><strong>Done:</strong> ${escapeHtml(update.workDone)}</p>
    <p><strong>Next:</strong> ${escapeHtml(update.nextPlan || "-")}</p>
    ${gallery}
  </article>`;
}

function filtered(collection) {
  const siteId = document.getElementById("siteFilter")?.value || "all";
  const month = document.getElementById("monthFilter")?.value || "";
  return collection.filter((item) => {
    const siteMatch = siteId === "all" || item.siteId === siteId || item.id === siteId;
    const monthMatch = !month || !item.date || item.date.startsWith(month) || item.startDate?.startsWith(month);
    return siteMatch && monthMatch;
  });
}

function visibleSites() {
  const siteId = document.getElementById("siteFilter")?.value || "all";
  return state.sites.filter((site) => siteId === "all" || site.id === siteId);
}

function latestProgress(siteId) {
  const latest = state.progress.filter((item) => item.siteId === siteId).sort(byDateDesc)[0];
  return latest || { percent: 0, stage: "Not started" };
}

function progressCell(percent, stage) {
  const safePercent = clamp(number(percent), 0, 100);
  return `<div><strong>${safePercent}%</strong> ${escapeHtml(stage || "")}<div class="progress-track"><div class="progress-bar" style="width:${safePercent}%"></div></div></div>`;
}

function exportCsv() {
  const sections = [
    ["capital", state.capital],
    ["sites", state.sites],
    ["rate_list", state.rateList],
    ["customer_bills", state.customerBills],
    ["extra_works", state.extraWorks],
    ["wages", state.wages.map(({ photo, ...row }) => ({ ...row, photo: photo ? "Saved in app" : "" }))],
    ["materials", state.materials],
    ["expenses", state.expenses],
    ["payments", state.payments],
    ["pending_bills", state.bills],
    ["measurement_book", state.measurements],
    ["boq", state.boq],
    ["schedule_targets", state.schedule],
    ["progress", state.progress],
    ["site_diary", state.diary],
    ["daily_updates", state.updates.map(({ photos, ...row }) => ({ ...row, photos: Array.isArray(photos) && photos.length ? `${photos.length} saved in app` : "" }))]
  ];

  const csv = sections.map(([name, rows]) => {
    if (!rows.length) return `${name}\nNo records\n`;
    const headers = Object.keys(rows[0]);
    const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(","));
    return `${name}\n${headers.join(",")}\n${lines.join("\n")}\n`;
  }).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hh-spaces-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportWordReport() {
  downloadFile(reportDocumentHtml(), `hh-spaces-report-${today}.doc`, "application/msword");
}

function exportExcelReport() {
  downloadFile(reportWorkbookHtml(), `hh-spaces-report-${today}.xls`, "application/vnd.ms-excel");
}

function exportPdfReport() {
  const frame = document.getElementById("reportFrame");
  frame.srcdoc = reportDocumentHtml();
  document.getElementById("reportModal").classList.remove("is-hidden");
}

function printReportPreview() {
  const frame = document.getElementById("reportFrame");
  if (!frame.srcdoc) {
    frame.srcdoc = reportDocumentHtml();
  }
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
}

function closeReportPreview() {
  document.getElementById("reportModal").classList.add("is-hidden");
}

function reportDocumentHtml() {
  const report = buildReportData();
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>H&amp;H SPACES Report</title>
        <style>${reportCss()}</style>
      </head>
      <body>
        <h1>H&amp;H SPACES Report</h1>
        <p class="muted">Generated on ${longDate(today)} | ${escapeHtml(selectedSiteName())}</p>
        <section class="summary">${report.summary.map((item) => `<div><span>${item.label}</span><strong>${item.value}</strong></div>`).join("")}</section>
        ${reportSection("Site Summary", report.sites)}
        ${reportSection("Rate List", report.rateList)}
        ${reportSection("Customer Bills", report.customerBills)}
        ${reportSection("Extra Site Works", report.extraWorks)}
        ${reportSection("Labour Wages", report.wages)}
        ${reportSection("Material Expenses", report.materials)}
        ${reportSection("Expenses", report.expenses)}
        ${reportSection("Client Payments", report.payments)}
        ${reportSection("Pending Bills", report.bills)}
        ${reportSection("Measurement Book", report.measurements)}
        ${reportSection("BOQ", report.boq)}
        ${reportSection("Schedule & Targets", report.schedule)}
        ${reportSection("Work Progress", report.progress)}
        ${reportSection("Site Diary", report.diary)}
        ${reportSection("Daily Updates", report.updates)}
      </body>
    </html>`;
}

function reportWorkbookHtml() {
  const report = buildReportData();
  return `<!doctype html>
    <html>
      <head><meta charset="utf-8"><title>H&amp;H SPACES Excel Report</title></head>
      <body>
        <h1>H&amp;H SPACES Report</h1>
        ${excelTable("Summary", report.summary.map((item) => ({ Particular: item.label, Amount: item.value })))}
        ${excelTable("Site Summary", report.sites)}
        ${excelTable("Rate List", report.rateList)}
        ${excelTable("Customer Bills", report.customerBills)}
        ${excelTable("Extra Site Works", report.extraWorks)}
        ${excelTable("Labour Wages", report.wages)}
        ${excelTable("Material Expenses", report.materials)}
        ${excelTable("Expenses", report.expenses)}
        ${excelTable("Client Payments", report.payments)}
        ${excelTable("Pending Bills", report.bills)}
        ${excelTable("Measurement Book", report.measurements)}
        ${excelTable("BOQ", report.boq)}
        ${excelTable("Schedule Targets", report.schedule)}
        ${excelTable("Work Progress", report.progress)}
        ${excelTable("Site Diary", report.diary)}
        ${excelTable("Daily Updates", report.updates)}
      </body>
    </html>`;
}

function buildReportData() {
  const wages = filtered(state.wages);
  const materials = filtered(state.materials);
  const expenses = filtered(state.expenses);
  const extraWorks = filtered(state.extraWorks);
  const customerBills = filtered(state.customerBills);
  const payments = filtered(state.payments);
  const pendingBills = filtered(state.bills).filter((bill) => bill.status !== "Paid");
  const paidBills = filtered(state.bills).filter((bill) => bill.status === "Paid");
  const capital = filtered(state.capital);
  const capitalTotal = sum(capital.filter((item) => item.type === "add"), "amount") - sum(capital.filter((item) => item.type === "withdraw"), "amount");
  const used = sum(wages, "amount") + sum(materials, "amount") + sum(expenses, "amount") + sum(paidBills, "amount");
  const received = sum(payments, "amount");
  const cash = capitalTotal + received - used;

  return {
    summary: [
      { label: "Cash In Hand", value: formatMoney(cash) },
      { label: "Company Capital", value: formatMoney(capitalTotal) },
      { label: "Client Payments", value: formatMoney(received) },
      { label: "Customer Bills", value: formatMoney(sum(customerBills, "total")) },
      { label: "Extra Site Works", value: formatMoney(sum(extraWorks, "amount")) },
      { label: "Payment Used", value: formatMoney(used) },
      { label: "Pending Bills", value: formatMoney(sum(pendingBills, "amount")) },
      { label: "Labour Wages", value: formatMoney(sum(wages, "amount")) },
      { label: "Material Expenses", value: formatMoney(sum(materials, "amount")) },
      { label: "Other Expenses", value: formatMoney(sum(expenses, "amount")) }
    ],
    sites: visibleSites().map((site) => {
      const paid = sum(state.payments.filter((item) => item.siteId === site.id), "amount");
      const extra = siteExtraTotal(site.id);
      const total = siteTotalAmount(site.id);
      return {
        Site: site.name,
        Client: site.client,
        Phone: site.phone || "",
        Location: site.location || "",
        Contract: formatMoney(site.contract),
        "Extra Work": formatMoney(extra),
        "Total Amount": formatMoney(total),
        Received: formatMoney(paid),
        Balance: formatMoney(total - paid),
        Status: site.status
      };
    }),
    rateList: state.rateList.map((item) => ({
      Date: dateText(item.date),
      Category: item.category || "",
      Work: item.work,
      Unit: item.unit || "",
      Rate: formatMoney(item.rate),
      Note: item.note || ""
    })),
    customerBills: customerBills.map((item) => ({
      Date: dateText(item.date),
      Bill: item.billNo || "",
      Site: plainSiteName(item.siteId),
      Client: item.client || "",
      Work: item.work,
      Quantity: item.quantity,
      Unit: item.unit || "",
      Rate: formatMoney(item.rate),
      Amount: formatMoney(item.amount),
      Discount: formatMoney(item.discount),
      Tax: formatMoney(item.tax),
      Total: formatMoney(item.total),
      Status: item.status || "Unpaid"
    })),
    extraWorks: extraWorks.map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Work: item.work,
      "Approved By": item.approvedBy || "",
      Note: item.note || "",
      Amount: formatMoney(item.amount)
    })),
    wages: wages.map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Labour: item.worker,
      Phone: item.phone || "",
      Attendance: item.attendance || "Present",
      Work: item.workType || "",
      Days: item.days,
      Rate: formatMoney(item.rate),
      Amount: formatMoney(item.amount)
    })),
    materials: materials.map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Material: item.item,
      Category: item.category || "",
      Unit: item.unit || "",
      Received: item.quantityReceived || 0,
      Used: item.quantityUsed || 0,
      Balance: number(item.quantityReceived) - number(item.quantityUsed),
      Supplier: item.supplier || "",
      Bill: item.billNo || "",
      Amount: formatMoney(item.amount)
    })),
    expenses: expenses.map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Type: item.type,
      Title: item.title,
      "Paid To": item.paidTo || "",
      Amount: formatMoney(item.amount),
      Notes: item.notes || ""
    })),
    payments: payments.map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Client: item.client || "",
      Mode: item.mode,
      Reference: item.reference || "",
      Amount: formatMoney(item.amount)
    })),
    bills: pendingBills.map((item) => ({
      Date: dateText(item.date),
      Due: item.dueDate ? dateText(item.dueDate) : "",
      Site: plainSiteName(item.siteId),
      Party: item.party,
      Detail: item.detail || "",
      Amount: formatMoney(item.amount)
    })),
    measurements: filtered(state.measurements).map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Area: item.area || "",
      Plaster: item.plasterSqft,
      POP: item.popSqft,
      Tile: item.tileSqft,
      Waterproofing: item.waterproofingSqft,
      Painting: item.paintingSqft,
      Points: item.electricalPoints,
      RFT: item.runningFeet,
      Total: item.total,
      Notes: item.notes || ""
    })),
    boq: filtered(state.boq).map((item) => ({
      Site: plainSiteName(item.siteId),
      Item: item.item,
      Unit: item.unit,
      "Estimated Qty": item.estimatedQuantity,
      "Estimated Cost": formatMoney(item.estimatedCost),
      "Actual Qty": item.actualQuantity,
      "Actual Cost": formatMoney(item.actualCost),
      Variance: formatMoney(item.variance),
      Notes: item.notes || ""
    })),
    schedule: filtered(state.schedule).map((item) => ({
      Plan: dateText(item.date),
      Target: dateText(item.targetDate),
      Site: plainSiteName(item.siteId),
      Work: item.task,
      "Target %": item.targetPercent,
      Assigned: item.assignedTo || "",
      Status: item.status,
      Notes: item.notes || ""
    })),
    progress: filtered(state.progress).map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Stage: item.stage,
      Progress: `${item.percent}%`,
      Notes: item.notes || ""
    })),
    diary: filtered(state.diary).map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Weather: item.weather || "",
      Notes: item.dailyNotes || "",
      LabourIssues: item.labourIssues || "",
      MaterialIssues: item.materialIssues || "",
      ClientInstructions: item.clientInstructions || ""
    })),
    updates: filtered(state.updates).map((item) => ({
      Date: dateText(item.date),
      Site: plainSiteName(item.siteId),
      Labour: item.labourCount || 0,
      Weather: item.weather || "",
      WorkDone: item.workDone,
      NextPlan: item.nextPlan || "",
      Photos: Array.isArray(item.photos) ? item.photos.length : 0
    }))
  };
}

function reportSection(title, rows) {
  return `<h2>${escapeHtml(title)}</h2>${reportTable(rows)}`;
}

function reportTable(rows) {
  if (!rows.length) return `<p class="muted">No records.</p>`;
  const headers = Object.keys(rows[0]);
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function excelTable(title, rows) {
  return `<h2>${escapeHtml(title)}</h2>${reportTable(rows)}`;
}

function reportCss() {
  return `body{font-family:Arial,sans-serif;color:#17152f;margin:28px}h1{color:#4f46e5}h2{margin-top:26px;color:#312e81}.muted{color:#6f7285}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.summary div{border:1px solid #e6e3f4;border-radius:10px;padding:12px}.summary span{display:block;color:#6f7285;font-size:12px}.summary strong{display:block;margin-top:6px;font-size:18px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{background:#f8f7ff;color:#312e81}@media print{body{margin:16px}.summary{grid-template-columns:repeat(2,1fr)}}`;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function siteName(siteId) {
  return escapeHtml(findSite(siteId).name || "Unknown site");
}

function plainSiteName(siteId) {
  return findSite(siteId).name || "Unknown site";
}

function findSite(siteId) {
  return state.sites.find((site) => site.id === siteId) || {};
}

function siteExtraTotal(siteId) {
  return sum(state.extraWorks.filter((item) => item.siteId === siteId), "amount");
}

function siteTotalAmount(siteId) {
  const site = findSite(siteId);
  return number(site.contract) + siteExtraTotal(siteId);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + number(row[key]), 0);
}

function uniqueCount(rows, key) {
  return new Set(rows.map((row) => String(row[key] || "").trim()).filter(Boolean)).size;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function filesToDataUrls(files) {
  return Promise.all(files.map(fileToDataUrl));
}

function initials(value) {
  return String(value || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function number(value) {
  return Number(value) || 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function byDateDesc(a, b) {
  return String(b.date || "").localeCompare(String(a.date || ""));
}

function byTargetDateAsc(a, b) {
  return String(a.targetDate || a.date || "").localeCompare(String(b.targetDate || b.date || ""));
}

function formatMoney(value) {
  return moneyFormatter.format(number(value));
}

function dateText(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function longDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="empty">No records yet.</td></tr>`;
}

function emptyCard(text) {
  return `<div class="activity-card"><p>${escapeHtml(text)}</p></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
