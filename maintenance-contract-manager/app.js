const DEFAULT_ALERT_DAYS = 60;
const REMEMBERED_LOGIN_ID_KEY = "maintenanceContractManager.rememberedLoginId";
const DOCUMENT_GROUPS_PER_PAGE = 12;
const LIST_ITEMS_PER_PAGE = 20;

const state = {
  view: "dashboard",
  search: "",
  companySearch: { field: "all", query: "" },
  contractSearch: { field: "all", query: "" },
  employeeSearch: { field: "all", query: "" },
  selectedCompanyId: null,
  selectedTab: "basic",
  selectedDocumentTitle: "",
  selectedOrganizationId: "",
  focusedContractId: "",
  calendarMonth: "",
  collapsedOrganizationIds: new Set(),
  documentPage: 1,
  listPages: { companies: 1, contracts: 1, worklogs: 1, users: 1, employees: 1 },
  contractListMode: "all",
  modal: null,
  user: null,
  permissions: [],
  allowedContractOrganizationIds: [],
  data: emptyData(),
  config: { defaultAlertDays: DEFAULT_ALERT_DAYS, uploadDir: "" }
};

const viewTitles = {
  dashboard: "대시보드",
  companies: "업체 관리",
  contracts: "계약 관리",
  worklogs: "유지보수 이력",
  schedule: "일정/알림",
  documents: "문서함",
  stats: "통계",
  users: "사용자 관리",
  organizations: "조직 관리"
};

const viewPermissions = {
  dashboard: "menu.dashboard.view",
  companies: "menu.company.view",
  contracts: "menu.contract.view",
  worklogs: "menu.worklog.view",
  schedule: "menu.schedule.view",
  documents: "menu.document.view",
  stats: "menu.stats.view",
  users: "menu.user.view",
  organizations: "menu.organization.view"
};

let isApplyingRoute = false;

function safeDecodeRoutePart(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (_error) {
    return value || "";
  }
}

function buildRouteHash() {
  const view = state.selectedCompanyId ? "companies" : state.view || "dashboard";
  if (view === "companies" && state.selectedCompanyId) {
    const companyId = encodeURIComponent(String(state.selectedCompanyId));
    const tab = state.selectedTab && state.selectedTab !== "basic" ? `/tab/${encodeURIComponent(state.selectedTab)}` : "";
    return `#companies/${companyId}${tab}`;
  }
  if (view === "contracts" && state.contractListMode && state.contractListMode !== "all") {
    return `#contracts/${encodeURIComponent(state.contractListMode)}`;
  }
  if (view === "documents" && state.selectedDocumentTitle) {
    return `#documents/group/${encodeURIComponent(state.selectedDocumentTitle)}`;
  }
  if (view === "organizations" && state.selectedOrganizationId) {
    return `#organizations/${encodeURIComponent(String(state.selectedOrganizationId))}`;
  }
  return `#${view}`;
}

function updateRouteHash({ replace = false } = {}) {
  if (isApplyingRoute || !state.user) return;
  const nextHash = buildRouteHash();
  if (window.location.hash === nextHash) return;
  if (replace) {
    history.replaceState(null, "", nextHash);
  } else {
    window.location.hash = nextHash;
  }
}

function applyRouteFromHash() {
  if (!state.user) return false;
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash) return false;
  const parts = rawHash.split("/").map(safeDecodeRoutePart);
  const view = parts[0] || "dashboard";
  if (!Object.prototype.hasOwnProperty.call(viewTitles, view)) return false;

  isApplyingRoute = true;
  state.view = view;
  state.selectedCompanyId = null;
  state.selectedDocumentTitle = "";
  state.focusedContractId = "";
  if (view !== "contracts") state.contractListMode = "all";

  if (view === "companies") {
    state.selectedCompanyId = parts[1] || null;
    state.selectedTab = parts[2] === "tab" && parts[3] ? parts[3] : "basic";
  } else if (view === "contracts") {
    state.contractListMode = parts[1] || "all";
  } else if (view === "documents") {
    state.selectedDocumentTitle = parts[1] === "group" && parts[2] ? parts[2] : "";
  } else if (view === "organizations") {
    state.selectedOrganizationId = parts[1] || state.selectedOrganizationId;
  }

  isApplyingRoute = false;
  render({ updateRoute: false });
  updateRouteHash({ replace: true });
  return true;
}

const companyFields = [
  ["name", "업체명", "text", true],
  ["businessNo", "사업자번호", "text"],
  ["representative", "대표자", "text"],
  ["address", "주소", "text"],
  ["memo", "비고", "textarea"]
];

const contractFields = [
  ["companyId", "업체", "company", true],
  ["organizationId", "담당부서", "organization"],
  ["name", "계약명", "text", true],
  ["managerUserId", "담당자", "user"],
  ["startDate", "계약 시작일", "date", true],
  ["endDate", "계약 종료일", "date", true],
  ["amount", "계약 금액", "number"],
  ["billingCycle", "대금 지불방법", "billing"],
  ["status", "상태", "contractStatus"],
  ["renewalDate", "갱신 예정일", "date"],
  ["alertDays", "만료 알림 기준일", "number"],
  ["autoAlert", "갱신 알림", "checkbox"],
  ["memo", "비고", "textarea"]
];

const assetFields = [
  ["companyId", "업체", "company", true],
  ["type", "구분", "assetType", true],
  ["name", "대상명", "text", true],
  ["serial", "관리번호", "text"],
  ["location", "위치", "text"],
  ["memo", "비고", "textarea"]
];

const worklogFields = [
  ["companyId", "업체", "company", true],
  ["contractId", "관련 계약", "contract"],
  ["date", "작업일", "date", true],
  ["category", "작업 구분", "workCategory"],
  ["status", "처리 상태", "workStatus"],
  ["worker", "처리자", "text"],
  ["title", "제목", "text", true],
  ["content", "작업 내용", "textarea"]
];

const documentFields = [
  ["companyId", "업체", "company", true],
  ["contractId", "관련 계약", "contract"],
  ["organizationId", "조직", "organization"],
  ["category", "문서 구분", "docCategory"],
  ["title", "문서명", "text", true],
  ["file", "파일", "file"],
  ["memo", "비고", "textarea"]
];

const pendingFields = [
  ["title", "제목", "text", true],
  ["companyId", "업체", "company"],
  ["contractId", "관련 계약", "contract"],
  ["dueDate", "기한", "date"],
  ["status", "상태", "pendingStatus"],
  ["memo", "비고", "textarea"]
];

const userFields = [
  ["username", "아이디", "text", true],
  ["password", "비밀번호", "password", true],
  ["employeeId", "직원 기준 정보", "employee"],
  ["displayName", "이름", "text"],
  ["email", "이메일", "email"],
  ["organizationId", "조직", "organization"],
  ["role", "권한", "userRole"],
  ["isActive", "사용 여부", "checkbox"]
];

const employeeFields = [
  ["employeeNo", "사원번호", "text", true],
  ["name", "이름", "text", true],
  ["employmentStatus", "재직상태", "employmentStatus", true],
  ["joinedAt", "입사일", "date", true],
  ["resignedAt", "퇴사일", "date", true],
  ["email", "이메일", "email"],
  ["memo", "비고", "textarea"]
];

const organizationFields = [
  ["parentId", "상위 부서", "organizationParent"],
  ["name", "조직명", "text", true],
  ["sortOrder", "정렬순서", "number"],
  ["isActive", "사용 여부", "checkbox"]
];

document.addEventListener("DOMContentLoaded", async () => {
  bindLogin();
  bindChrome();
  window.addEventListener("hashchange", applyRouteFromHash);
  await checkLogin();
});

function bindLogin() {
  const usernameInput = document.getElementById("loginUsername");
  const rememberIdInput = document.getElementById("rememberLoginId");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  document.getElementById("showRegisterBtn")?.addEventListener("click", () => {
    document.getElementById("loginError").textContent = "";
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
  });
  document.getElementById("showLoginBtn")?.addEventListener("click", () => {
    document.getElementById("registerError").textContent = "";
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });
  try {
    const rememberedId = localStorage.getItem(REMEMBERED_LOGIN_ID_KEY) || "";
    if (rememberedId) {
      usernameInput.value = rememberedId;
      rememberIdInput.checked = true;
    }
  } catch (_error) {
    // 브라우저 저장소를 사용할 수 없어도 로그인은 계속 진행합니다.
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.getElementById("loginError");
    const button = event.target.querySelector('button[type="submit"]');
    const formData = new FormData(event.target);
    error.textContent = "";
    button.disabled = true;
    button.textContent = "로그인 중...";
    try {
      const result = await apiJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: String(formData.get("username") || "").trim(),
          password: String(formData.get("password") || "")
        })
      });
      try {
        if (rememberIdInput.checked) {
          localStorage.setItem(REMEMBERED_LOGIN_ID_KEY, String(formData.get("username") || "").trim());
        } else {
          localStorage.removeItem(REMEMBERED_LOGIN_ID_KEY);
        }
      } catch (_error) {
        // 저장 실패가 로그인 성공을 막지 않도록 합니다.
      }
      await startAuthenticatedApp(result.user);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = "로그인";
    }
  });
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.getElementById("registerError");
    const button = event.target.querySelector('button[type="submit"]');
    const formData = new FormData(event.target);
    const password = String(formData.get("password") || "");
    error.textContent = "";
    if (password !== String(formData.get("passwordConfirm") || "")) {
      error.textContent = "비밀번호 확인이 일치하지 않습니다.";
      return;
    }
    button.disabled = true;
    button.textContent = "가입 중...";
    try {
      const employeeNo = String(formData.get("employeeNo") || "").trim();
      const result = await apiJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          employeeNo,
          username: employeeNo,
          email: String(formData.get("email") || "").trim(),
          password
        })
      });
      await startAuthenticatedApp(result.user);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = "가입하기";
    }
  });
}

async function checkLogin() {
  const result = await apiJson("/api/auth/me");
  if (result.user) {
    await startAuthenticatedApp(result.user);
  } else {
    showLogin();
  }
}

async function startAuthenticatedApp(user) {
  state.user = user;
  document.body.classList.add("is-authenticated");
  renderCurrentUserSummary();
  await loadServerData();
  if (!applyRouteFromHash()) render({ replaceRoute: true });
}

function showLogin() {
  state.user = null;
  state.permissions = [];
  document.body.classList.remove("is-authenticated");
  renderCurrentUserSummary();
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginForm")?.classList.remove("hidden");
  document.getElementById("registerForm")?.classList.add("hidden");
}

function renderCurrentUserSummary() {
  const summary = document.getElementById("userSummary");
  const nameEl = document.getElementById("userSummaryName");
  const orgEl = document.getElementById("userSummaryOrg");
  if (!summary || !nameEl || !orgEl) return;
  if (!state.user) {
    summary.hidden = true;
    nameEl.textContent = "";
    orgEl.textContent = "";
    return;
  }
  const displayName = state.user.displayName || state.user.username || "사용자";
  const position = state.user.positionName || state.user.position || "";
  nameEl.textContent = position ? `${displayName} ${position}` : displayName;
  orgEl.textContent = formatUserSummaryOrganization(state.user.organizationName);
  summary.hidden = false;
}

function formatUserSummaryOrganization(name) {
  const text = String(name || "").trim();
  return text ? text.replace(/\s+/g, "") : "조직 미지정";
}

function bindChrome() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      if (state.view === "contracts") state.contractListMode = "all";
      if (state.view === "documents") {
        state.documentPage = 1;
        state.selectedDocumentTitle = "";
      }
      state.selectedCompanyId = null;
      render();
    });
  });

  document.querySelectorAll("[data-brand-home]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "dashboard";
      state.contractListMode = "all";
      state.selectedCompanyId = null;
      state.selectedTab = "basic";
      render();
    });
  });

  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") event.preventDefault();
  });
  document.getElementById("modalForm").addEventListener("submit", saveModal);
  document.getElementById("deleteBtn").addEventListener("click", deleteModalItem);
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

function emptyData() {
  return {
    companies: [],
    contracts: [],
    assets: [],
    worklogs: [],
    pendingItems: [],
    documents: [],
    organizations: [],
    organizationContractLinks: [],
    employees: [],
    users: []
  };
}

async function loadServerData() {
  try {
    const data = await apiJson("/api/bootstrap");
    state.data = {
      companies: data.companies || [],
      contracts: data.contracts || [],
      assets: data.assets || [],
      worklogs: data.worklogs || [],
      pendingItems: data.pendingItems || [],
      documents: data.documents || [],
      organizations: data.organizations || [],
      organizationContractLinks: data.organizationContractLinks || [],
      employees: data.employees || [],
      users: data.users || []
    };
    state.permissions = data.permissions || [];
    state.allowedContractOrganizationIds = (data.allowedContractOrganizationIds || []).map(String);
    state.config = data.config || state.config;
    if (hasPermission("menu.user.manage")) {
      const userData = await apiJson("/api/users");
      state.data.users = userData.users || [];
      state.data.employees = userData.employees || state.data.employees || [];
    }
  } catch (error) {
    document.getElementById("view").innerHTML = `<div class="empty">서버 연결 실패: ${escapeHtml(error.message)}</div>`;
    throw error;
  }
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 && !url.startsWith("/api/auth/")) {
      showLogin();
    }
    let message = text || `${response.status} ${response.statusText}`;
    try {
      const data = JSON.parse(text);
      message = data.detail || data.message || message;
    } catch {
      // Keep plain-text error responses as-is.
    }
    throw new Error(message);
  }
  return response.json();
}

async function logout() {
  await apiJson("/api/auth/logout", { method: "POST" });
  showLogin();
}

function render(options = {}) {
  const currentViewPermission = viewPermissions[state.view];
  if (currentViewPermission && !hasPermission(currentViewPermission)) state.view = "dashboard";
  document.querySelectorAll(".nav-item").forEach((button) => {
    const permission = viewPermissions[button.dataset.view];
    const canView = !permission || hasPermission(permission);
    button.hidden = !canView;
    button.style.display = canView ? "" : "none";
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  document.getElementById("viewTitle").textContent = state.selectedCompanyId ? "업체 상세" : viewTitles[state.view];
  renderView(options);
}

function renderView(options = {}) {
  const view = document.getElementById("view");
  const renderers = {
    dashboard: renderDashboard,
    companies: renderCompanies,
    contracts: renderContracts,
    worklogs: renderWorklogs,
    schedule: renderSchedule,
    documents: renderDocuments,
    stats: renderStats,
    users: renderUsers,
    organizations: renderOrganizations
  };
  view.innerHTML = state.selectedCompanyId ? renderCompanyDetail() : renderers[state.view]();
  bindViewEvents();
  if (options.updateRoute !== false) updateRouteHash({ replace: Boolean(options.replaceRoute) });
}

function renderDashboard() {
  const upcoming = getUpcomingContracts();
  const calendarContracts = getCalendarContracts();
  const pendingItems = state.data.pendingItems.filter((item) => item.status !== "done");
  const activeContracts = state.data.contracts.filter((contract) => contract.status === "active");
  const monthlyRevenue = state.data.contracts
    .filter((contract) => contract.status === "active")
    .reduce((sum, contract) => sum + normalizeMonthlyAmount(contract), 0);

  return `
    <div class="grid stats-grid">
      ${statCard("유지보수 계약 업체", activeContracts.length, { action: "active-contracts" })}
      ${statCard("만료 예정", upcoming.length)}
      ${statCard("미결 내역", pendingItems.length)}
      ${statCard("월 환산 금액", formatMoney(monthlyRevenue))}
    </div>
    <div class="dashboard-layout">
      <section class="calendar-box">
        ${renderExpiryCalendar(calendarContracts)}
      </section>
      <div class="dashboard-side">
        <section class="panel">
          <div class="panel-header">
            <h2>미결 내역</h2>
            ${hasPermission("menu.pending.create") ? `<button class="primary-button" data-add="pending"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>미결 등록</button>` : ""}
          </div>
          ${renderPendingItems(pendingItems.slice(0, 8))}
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2>업체별 계약 금액</h2>
          </div>
          ${renderRevenueList()}
        </section>
      </div>
    </div>
  `;
}

function primaryContact(company) {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  return contacts.find((contact) => contact.isPrimary) || contacts[0] || null;
}

function renderContactSummary(company) {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  const contact = primaryContact(company);
  if (!contact) return escapeHtml(company.manager || "-");
  const extraCount = contacts.length > 1 ? ` 외 ${contacts.length - 1}명` : "";
  const position = contact.position ? ` ${escapeHtml(contact.position)}` : "";
  return `<strong>${escapeHtml(contact.name || "-")}</strong>${position}<br><span class="muted">${extraCount || escapeHtml(contact.email || company.email || "")}</span>`;
}

function renderContactTable(company) {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  if (!contacts.length) {
    return `<span class="muted">등록된 담당자가 없습니다.</span>`;
  }
  return `
    <div class="contact-list">
      ${contacts.map((contact) => `
        <div class="contact-row-view">
          <div>
            <strong>${escapeHtml(contact.name || "-")}</strong>
            ${contact.isPrimary ? `<span class="tag">대표</span>` : ""}
            <span class="muted">${escapeHtml(contact.position || "")}</span>
          </div>
          <div>${escapeHtml(contact.phone || "-")}</div>
          <div>${escapeHtml(contact.email || "-")}</div>
          ${contact.memo ? `<div class="muted">${escapeHtml(contact.memo)}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderExcelActions(kind) {
  if (kind === "employees") {
    return `
      <button type="button" class="ghost-button" data-excel-template="${kind}">직원 일괄등록 양식 내려받기</button>
      ${state.user?.role === "admin" ? `<button type="button" class="secondary-button" data-excel-import="${kind}">직원 일괄등록</button>` : ""}
    `;
  }
  return `
    <button type="button" class="ghost-button" data-excel-template="${kind}">일괄 등록 양식 내려받기</button>
    ${state.user?.role === "admin" ? `<button type="button" class="secondary-button" data-excel-import="${kind}">일괄 등록</button>` : ""}
  `;
}

function paginatedItems(type, items) {
  const totalPages = Math.max(1, Math.ceil(items.length / LIST_ITEMS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(state.listPages[type]) || 1), totalPages);
  state.listPages[type] = page;
  const start = (page - 1) * LIST_ITEMS_PER_PAGE;
  return { items: items.slice(start, start + LIST_ITEMS_PER_PAGE), page, totalPages };
}

function renderListPagination(type, totalItems) {
  if (!totalItems) return "";
  const totalPages = Math.max(1, Math.ceil(totalItems / LIST_ITEMS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(state.listPages[type]) || 1), totalPages);
  return `
    <nav class="list-pagination" aria-label="목록 페이지">
      <button type="button" class="ghost-button" data-list-page="${type}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="이전 페이지">&lt;</button>
      <span>${page} / ${totalPages}</span>
      <button type="button" class="ghost-button" data-list-page="${type}" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="다음 페이지">&gt;</button>
    </nav>
  `;
}

function downloadExcelTemplate(kind) {
  window.location.href = `/api/excel-template/${kind}`;
}

async function selectExcelImport(kind) {
  if (state.user?.role !== "admin") return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const validationForm = new FormData();
      validationForm.append("file", file);
      validationForm.append("commit", "false");
      const validation = await apiJson(`/api/excel-import/${kind}`, { method: "POST", body: validationForm });
      if (validation.errors?.length) {
        const details = validation.errors.slice(0, 10).map((error) => `${error.row}행: ${error.messages.join(" ")}`).join("\n");
        const more = validation.errors.length > 10 ? `\n외 ${validation.errors.length - 10}개 오류` : "";
        alert(`Excel 검증 실패\n정상 ${validation.valid}건 / 오류 ${validation.errors.length}건\n\n${details}${more}`);
        return;
      }
      if (!confirm(`Excel 검증이 완료되었습니다.\n총 ${validation.total}건을 신규 등록하시겠습니까?\n기존 데이터는 수정하거나 삭제하지 않습니다.`)) return;
      const commitForm = new FormData();
      commitForm.append("file", file);
      commitForm.append("commit", "true");
      const result = await apiJson(`/api/excel-import/${kind}`, { method: "POST", body: commitForm });
      alert(`${result.committed}건이 등록되었습니다.`);
      await loadServerData();
      renderView();
    } catch (error) {
      alert(`Excel 등록 실패: ${error.message}`);
    }
  }, { once: true });
  input.click();
}

function renderCompanies() {
  const filteredCompanies = filterCompanies(state.data.companies);
  const { items: companies } = paginatedItems("companies", filteredCompanies);
  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">총 ${filteredCompanies.length}개 업체</span></div>
      <div class="toolbar-right">${renderExcelActions("companies")}<button class="primary-button" data-add="company"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>업체 등록</button></div>
    </div>
    ${companies.length ? `
      <div class="table-wrap companies-table-wrap">
        <table class="companies-table">
          <thead><tr><th>업체명</th><th>대표자</th><th>담당자</th><th>연락처</th><th>계약</th><th>작업 이력</th><th></th></tr></thead>
          <tbody>
            ${companies.map((company) => `
              <tr>
                <td>
                  <button class="company-name-link" data-detail-company="${company.id}">
                    <strong>${escapeHtml(company.name)}</strong>
                  </button>
                  <br><span class="muted">${escapeHtml(company.businessNo || "-")}</span>
                </td>
                <td>${escapeHtml(company.representative || "-")}</td>
                <td>${renderContactSummary(company)}</td>
                <td>${escapeHtml(primaryContact(company)?.phone || company.phone || "-")}</td>
                <td>${state.data.contracts.filter((item) => item.companyId === company.id).length}</td>
                <td>${state.data.worklogs.filter((item) => item.companyId === company.id).length}</td>
                <td>
                  <div class="inline-actions">
                    <button class="row-action" data-detail-company="${company.id}">상세</button>
                    ${canEditCompanies() ? `<button class="row-action" data-edit="company" data-id="${company.id}">수정</button>` : ""}
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>` : empty("등록된 업체가 없습니다.")}
    ${renderListPagination("companies", filteredCompanies.length)}
    ${renderListSearch("company", "업체 검색", [
      ["all", "전체"],
      ["name", "업체명"],
      ["representative", "대표자"],
      ["manager", "담당자"],
      ["contactPhone", "담당자 연락처"],
      ["businessNo", "사업자번호"]
    ], state.companySearch, `${filteredCompanies.length} / ${state.data.companies.length}개 업체`)}
  `;
}

function renderContracts() {
  const sourceContracts = state.contractListMode === "active"
    ? state.data.contracts.filter((contract) => contract.status === "active")
    : state.data.contracts;
  const filteredContracts = filterContracts(sourceContracts);
  const { items: contracts } = paginatedItems("contracts", filteredContracts);
  const listTitle = state.contractListMode === "active" ? "유지중인 계약 목록" : "전체 계약 목록";
  return `
    <div class="toolbar">
      <div class="toolbar-left"><strong>${listTitle}</strong><span class="muted">기본 만료 알림은 ${DEFAULT_ALERT_DAYS}일 전이며 계약별 변경이 가능합니다.</span></div>
      <div class="toolbar-right">
        ${renderExcelActions("contracts")}
        ${state.contractListMode === "active" ? `<button class="ghost-button" data-contract-mode="all">전체 계약 보기</button>` : ""}
        ${canCreateContracts() ? `<button class="primary-button" data-add="contract"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>계약 등록</button>` : ""}
      </div>
    </div>
    ${renderContractTable(contracts, false)}
    ${renderListPagination("contracts", filteredContracts.length)}
    ${renderListSearch("contract", "계약 검색", [
      ["all", "전체"],
      ["name", "계약명"],
      ["organization", "담당부서"],
      ["manager", "담당자"]
    ], state.contractSearch, `${filteredContracts.length} / ${sourceContracts.length}개 계약`)}
  `;
}

function renderListSearch(type, title, optionsList, searchState, resultText) {
  const fieldOptions = optionsList.map(([value, labelText]) => (
    `<option value="${value}" ${searchState.field === value ? "selected" : ""}>${labelText}</option>`
  )).join("");
  return `
    <form class="list-search" data-list-search="${type}">
      <div class="list-search-head">
        <strong>${title}</strong>
        <span class="muted">${resultText}</span>
      </div>
      <div class="list-search-controls">
        <select name="field" aria-label="검색 항목">
          ${fieldOptions}
        </select>
        <input name="query" type="search" value="${escapeHtml(searchState.query)}" placeholder="검색어 입력" autocomplete="off">
        <button type="submit" class="primary-button">검색</button>
        <button type="button" class="ghost-button" data-clear-list-search="${type}">초기화</button>
      </div>
    </form>
  `;
}

function updateListSearch(type, formData) {
  const next = {
    field: String(formData.get("field") || "all"),
    query: String(formData.get("query") || "").trim()
  };
  if (type === "company") state.companySearch = next;
  if (type === "contract") state.contractSearch = next;
  if (type === "employee") state.employeeSearch = next;
}

function renderWorklogs() {
  const filteredLogs = filterWorklogs(state.data.worklogs);
  const { items: logs } = paginatedItems("worklogs", filteredLogs);
  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">방문, 원격, 장애, 부품 교체, 정기점검 이력을 기록합니다.</span></div>
      <div class="toolbar-right">${renderExcelActions("worklogs")}${hasPermission("menu.worklog.create") ? `<button class="primary-button" data-add="worklog"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>작업 등록</button>` : ""}</div>
    </div>
    ${logs.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>작업일</th><th>업체</th><th>구분</th><th>제목</th><th>상태</th><th>처리자</th><th></th></tr></thead>
          <tbody>
            ${logs.map((log) => `
              <tr>
                <td>${formatDate(log.date)}</td>
                <td>${escapeHtml(companyName(log.companyId))}</td>
                <td>${label("workCategory", log.category)}</td>
                <td><strong>${escapeHtml(log.title)}</strong><br><span class="muted">${escapeHtml(log.content || "")}</span></td>
                <td>${workStatusBadge(log.status)}</td>
                <td>${escapeHtml(log.worker || "-")}</td>
                <td>${hasPermission("menu.worklog.update") ? `<button class="row-action" data-edit="worklog" data-id="${log.id}">수정</button>` : ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>` : empty("등록된 작업 이력이 없습니다.")}
    ${renderListPagination("worklogs", filteredLogs.length)}
  `;
}

function renderSchedule() {
  const upcoming = getUpcomingContracts();
  const overdue = state.data.contracts.filter((contract) => daysUntil(contract.endDate) < 0 && contract.status !== "closed");
  const openLogs = state.data.worklogs.filter((log) => log.status !== "done");
  return `
    <div class="grid stats-grid">
      ${statCard("만료 예정", upcoming.length)}
      ${statCard("이미 만료", overdue.length)}
      ${statCard("미처리 요청", openLogs.length)}
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="panel-header">
        <h2>계약 만료 알림</h2>
        ${canCreateContracts() ? `<button class="primary-button" data-add="contract"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>계약 등록</button>` : ""}
      </div>
      ${renderContractTable([...overdue, ...upcoming], true, { allowClose: true })}
    </section>
    <section class="panel" style="margin-top:16px">
      <div class="panel-header"><h2>미처리 요청</h2></div>
      ${renderMiniWorklogs(openLogs)}
    </section>
  `;
}

function renderDocuments() {
  const docs = filterDocuments(state.data.documents);
  const groups = groupDocumentsByCompany(docs);
  const totalPages = Math.max(1, Math.ceil(groups.length / DOCUMENT_GROUPS_PER_PAGE));
  state.documentPage = Math.min(Math.max(1, state.documentPage || 1), totalPages);
  if (state.selectedDocumentTitle && !groups.some((group) => group.key === state.selectedDocumentTitle)) {
    state.selectedDocumentTitle = "";
  }
  const startIndex = (state.documentPage - 1) * DOCUMENT_GROUPS_PER_PAGE;
  const pageGroups = groups.slice(startIndex, startIndex + DOCUMENT_GROUPS_PER_PAGE);
  const selectedGroup = groups.find((group) => group.key === state.selectedDocumentTitle);
  if (selectedGroup) {
    return renderSelectedDocumentGroup(selectedGroup);
  }
  return `
    <div class="toolbar">
      <div class="toolbar-left"></div>
      <div class="toolbar-right">
        ${hasPermission("menu.document.create") ? `<button class="ghost-button" data-bulk-document><svg viewBox="0 0 24 24"><path d="M4 12h16M4 6h16M4 18h16"/></svg>문서 일괄등록</button><button class="primary-button" data-add="document"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>문서 등록</button>` : ""}
      </div>
    </div>
    ${docs.length ? `
      <div class="document-card-grid">
        ${pageGroups.map((group) => renderDocumentGroupCard(group)).join("")}
      </div>
      ${renderDocumentPagination(totalPages)}
    ` : empty("등록된 문서가 없습니다.")}
  `;
}

function groupDocumentsByCompany(docs) {
  const groups = new Map();
  docs.forEach((doc) => {
    const key = String(doc.companyId || "__none");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  });
  return [...groups.entries()].map(([key, items]) => {
    const sortedItems = [...items].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const title = key === "__none" ? "업체 미지정" : companyName(key);
    const documentTitles = [...new Set(sortedItems.map((doc) => doc.title || "문서명 없음").filter(Boolean))];
    const categories = [...new Set(sortedItems.map((doc) => label("docCategory", doc.category)).filter(Boolean))];
    return {
      key,
      title,
      items: sortedItems,
      documentTitles,
      categories,
      latestDate: sortedItems[0]?.createdAt || "",
      fileCount: sortedItems.filter((doc) => doc.fileName).length
    };
  }).sort((a, b) => a.title.localeCompare(b.title, "ko"));
}

function renderDocumentGroupCard(group) {
  const active = group.key === state.selectedDocumentTitle ? " active" : "";
  const documentText = group.documentTitles.length > 1 ? `${group.documentTitles[0]} 외 ${group.documentTitles.length - 1}` : (group.documentTitles[0] || "문서명 없음");
  const categoryText = group.categories.length > 1 ? `${group.categories[0]} 외 ${group.categories.length - 1}` : (group.categories[0] || "-");
  return `
    <article class="document-group-card${active}">
      <button type="button" class="document-group-title" data-doc-group="${escapeHtml(group.key)}">${escapeHtml(group.title)}</button>
      <div class="document-group-meta">
        <span>${escapeHtml(documentText)}</span>
        <span>${escapeHtml(categoryText)}</span>
      </div>
      <button type="button" class="document-group-stats" data-doc-group="${escapeHtml(group.key)}" aria-label="${escapeHtml(group.title)} 문서 ${group.items.length}건 보기">
        <strong>${group.items.length}</strong>
        <span>건</span>
        <em>${group.fileCount}개 파일</em>
      </button>
      <p class="muted">최근 등록 ${formatDate(group.latestDate)}</p>
    </article>
  `;
}

function renderDocumentPagination(totalPages) {
  if (totalPages <= 1) return "";
  return `
    <div class="pagination">
      <button class="ghost-button" data-doc-page="${state.documentPage - 1}" ${state.documentPage <= 1 ? "disabled" : ""}>이전</button>
      <span>${state.documentPage} / ${totalPages}</span>
      <button class="ghost-button" data-doc-page="${state.documentPage + 1}" ${state.documentPage >= totalPages ? "disabled" : ""}>다음</button>
    </div>
  `;
}

function renderSelectedDocumentGroup(group) {
  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="ghost-button" data-doc-list-back>목록</button>
        <span class="muted">${group.items.length}건의 문서가 있습니다.</span>
      </div>
      <div class="toolbar-right">
        ${hasPermission("menu.document.create") ? `<button class="primary-button" data-add="document"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>문서 등록</button>` : ""}
      </div>
    </div>
    <section class="document-detail-panel">
      <div class="panel-header">
        <h2>${escapeHtml(group.title)}</h2>
        <div class="inline-actions">
          <label class="doc-select-all-label"><input type="checkbox" data-doc-select-all> 전체 선택</label>
          <button class="ghost-button" data-download-selected-docs>선택 다운로드</button>
        </div>
      </div>
      <div class="document-detail-list">
        ${group.items.map((doc) => `
          <article class="document-file-card">
            <label class="document-file-check">
              <input type="checkbox" data-doc-select="${doc.id}" ${doc.fileName ? "" : "disabled"} aria-label="${escapeHtml(doc.title)} 선택">
            </label>
            <div class="document-file-main">
              <strong>${escapeHtml(doc.title || "문서명 없음")}</strong>
              <span class="tag">${label("docCategory", doc.category)}</span>
              <p class="muted">${escapeHtml(doc.memo || "메모 없음")}</p>
            </div>
            <div class="document-file-info">
              <span>${formatDate(doc.createdAt)}</span>
              ${doc.fileName ? `<button class="row-action" data-download-doc="${doc.id}">${escapeHtml(doc.fileName)}</button>` : `<span class="muted">파일 없음</span>`}
            </div>
            ${hasPermission("menu.document.update") ? `<button class="row-action" data-edit="document" data-id="${doc.id}">수정</button>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderStats() {
  const revenue = state.data.companies.map((company) => ({
    company,
    monthly: state.data.contracts.filter((contract) => contract.companyId === company.id).reduce((sum, contract) => sum + normalizeMonthlyAmount(contract), 0),
    logs: state.data.worklogs.filter((log) => log.companyId === company.id).length
  })).sort((a, b) => b.monthly - a.monthly);
  const year = new Date().getFullYear().toString();
  const yearlyLogs = state.data.worklogs.filter((log) => (log.date || "").startsWith(year));

  return `
    <div class="grid stats-grid">
      ${statCard("올해 작업", yearlyLogs.length)}
      ${statCard("방문 점검", yearlyLogs.filter((log) => log.category === "visit").length)}
      ${statCard("원격 지원", yearlyLogs.filter((log) => log.category === "remote").length)}
      ${statCard("장애 처리", yearlyLogs.filter((log) => log.category === "incident").length)}
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="panel-header"><h2>업체별 현황</h2></div>
      ${revenue.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>업체</th><th>월 환산 금액</th><th>계약 수</th><th>작업 이력</th><th>문서</th></tr></thead>
            <tbody>
              ${revenue.map(({ company, monthly, logs }) => `
                <tr>
                  <td><strong>${escapeHtml(company.name)}</strong></td>
                  <td>${formatMoney(monthly)}</td>
                  <td>${state.data.contracts.filter((contract) => contract.companyId === company.id).length}</td>
                  <td>${logs}</td>
                  <td>${state.data.documents.filter((doc) => doc.companyId === company.id).length}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>` : empty("통계로 볼 업체가 없습니다.")}
    </section>
  `;
}

function renderUsers() {
  const allUsers = state.data.users || [];
  const { items: users } = paginatedItems("users", allUsers);
  const filteredEmployees = filterEmployees(state.data.employees || []);
  const { items: employees } = paginatedItems("employees", filteredEmployees);
  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">로그인 계정을 관리합니다.</span></div>
      <div class="toolbar-right"><button class="primary-button" data-add="user"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>사용자 등록</button></div>
    </div>
    ${users.length ? `
      <div class="table-wrap">
        <table>
            <thead><tr><th>아이디</th><th>사원번호</th><th>이름</th><th>이메일</th><th>조직</th><th>권한</th><th>상태</th><th>등록일</th><th></th></tr></thead>
          <tbody>
            ${users.map((user) => `
              <tr>
                <td><strong>${escapeHtml(user.username)}</strong></td>
                <td>${escapeHtml(user.employeeNo || "-")}</td>
                <td>${escapeHtml(user.displayName || "-")}</td>
                <td>${escapeHtml(user.email || "-")}</td>
                <td>${escapeHtml(user.organizationName || "-")}</td>
                <td>${label("userRole", user.role)}</td>
                <td>${user.isActive ? `<span class="status status-active">사용</span>` : `<span class="status status-closed">중지</span>`}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td><button class="row-action" data-edit="user" data-id="${user.id}">수정</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>` : empty("등록된 사용자가 없습니다.")}
    ${renderListPagination("users", allUsers.length)}
    <section class="panel employee-panel">
      <div class="panel-header">
        <div>
          <h2>직원 기준 정보</h2>
          <p class="muted">회원가입 검증에 사용할 기준정보를 등록합니다.</p>
        </div>
        <div class="inline-actions">
          ${renderExcelActions("employees")}
          <button class="primary-button" data-add="employee"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>직원 등록</button>
        </div>
      </div>
      ${renderListSearch("employee", "직원 기준정보 검색", [
        ["all", "전체"],
        ["employeeNo", "사원번호"],
        ["name", "이름"],
        ["department", "부서"],
        ["position", "직급"],
        ["status", "재직상태"],
        ["email", "이메일"]
      ], state.employeeSearch, `${filteredEmployees.length} / ${(state.data.employees || []).length}명`)}
      ${employees.length ? `
        <div class="table-wrap employee-table-wrap">
          <table>
            <thead><tr><th>사원번호</th><th>이름</th><th>재직상태</th><th>부서</th><th>직급</th><th>입사일</th><th>퇴사일</th><th>이메일</th><th></th></tr></thead>
            <tbody>
              ${employees.map((employee) => `
                <tr>
                  <td><strong>${escapeHtml(employee.employeeNo || "-")}</strong></td>
                  <td>${escapeHtml(employee.name || "-")}</td>
                  <td>${employeeStatusBadge(employee)}</td>
                  <td>${escapeHtml(employee.departmentName || employee.organizationName || "-")}</td>
                  <td>${escapeHtml(employee.positionName || "-")}</td>
                  <td>${formatDate(employee.joinedAt)}</td>
                  <td>${formatDate(employee.resignedAt)}</td>
                  <td>${escapeHtml(employee.email || "-")}</td>
                  <td><button class="row-action" data-edit="employee" data-id="${employee.id}">수정</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>` : empty("검색 조건에 맞는 직원 기준정보가 없습니다.")}
      ${renderListPagination("employees", filteredEmployees.length)}
    </section>
  `;
}

function renderOrganizations() {
  const organizations = state.data.organizations || [];
  const selected = organizations.find((org) => String(org.id) === String(state.selectedOrganizationId)) || organizations[0] || null;
  if (selected) state.selectedOrganizationId = String(selected.id);
  const childrenCount = selected ? organizations.filter((org) => String(org.parentId || "") === String(selected.id)).length : 0;
  const userCount = selected ? state.data.users.filter((user) => String(user.organizationId || "") === String(selected.id)).length : 0;
  const contractCount = selected ? state.data.contracts.filter((contract) => String(contract.organizationId || "") === String(selected.id)).length : 0;
  const documentCount = selected ? state.data.documents.filter((doc) => String(doc.organizationId || "") === String(selected.id)).length : 0;

  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">상위 부서와 하위 부서, 계약 담당부서 연계를 관리합니다.</span></div>
      <div class="toolbar-right"><button class="primary-button" data-add="organization"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>조직 등록</button></div>
    </div>
    <div class="org-layout">
      <section class="org-tree-panel">
        <div class="org-tree-head">조직도</div>
        ${organizations.length ? `<div class="org-tree">${renderOrganizationTree()}</div>` : empty("등록된 조직이 없습니다.")}
      </section>
      <section class="panel org-detail-panel">
        ${selected ? `
          <div class="panel-header">
            <h2>${escapeHtml(selected.name)}</h2>
            <div class="inline-actions">
              <button class="ghost-button" data-edit="organization" data-id="${selected.id}">수정</button>
              <button class="danger-button" data-delete-organization="${selected.id}">삭제</button>
            </div>
          </div>
          <div class="table-wrap">
            <table><tbody>
              <tr><th>조직명</th><td>${escapeHtml(selected.name)}</td></tr>
              <tr><th>상위 부서</th><td>${escapeHtml(organizationName(selected.parentId) || "-")}</td></tr>
              <tr><th>하위 부서</th><td>${childrenCount}개</td></tr>
              <tr><th>등록 사용자</th><td>${userCount}명</td></tr>
              <tr><th>계약</th><td>${contractCount}건</td></tr>
              <tr><th>문서</th><td>${documentCount}건</td></tr>
            </tbody></table>
          </div>
          ${renderOrganizationContractLinkEditor(selected, organizations)}
        ` : empty("조직을 등록해 주세요.")}
      </section>
    </div>
  `;
}

function linkedContractOrganizationIds(organizationId) {
  const sourceId = String(organizationId || "");
  const linkedIds = new Set();
  (state.data.organizationContractLinks || []).forEach((link) => {
    const a = String(link.organizationAId || "");
    const b = String(link.organizationBId || "");
    if (a === sourceId && b) linkedIds.add(b);
    if (b === sourceId && a) linkedIds.add(a);
  });
  return linkedIds;
}

function renderOrganizationContractLinkEditor(selected, organizations) {
  if (!hasPermission("menu.organization.manage")) return "";
  if (!selected.parentId) {
    return `<div class="item-card" style="margin-top:16px"><h3>계약 담당부서 연계</h3><p class="muted">최상위 조직은 계약 담당부서 연계 대상에서 제외됩니다.</p></div>`;
  }
  const linkedIds = linkedContractOrganizationIds(selected.id);
  const candidates = organizations
    .filter((org) => org.parentId && String(org.id) !== String(selected.id))
    .sort((a, b) => {
      const parentCompare = organizationName(a.parentId).localeCompare(organizationName(b.parentId), "ko");
      return parentCompare || String(a.name).localeCompare(String(b.name), "ko");
    });
  return `
    <form class="item-card org-link-editor" data-org-link-form="${selected.id}">
      <div class="org-link-header">
        <div>
          <h3>계약 담당부서 양방향 연계</h3>
          <p class="muted">선택한 조직끼리는 팀장·팀원이 양쪽 담당부서를 모두 선택할 수 있습니다.</p>
        </div>
        <button type="submit" class="primary-button">연계 저장</button>
      </div>
      <div class="org-link-grid">
        ${candidates.map((org) => `
          <label class="org-link-card ${linkedIds.has(String(org.id)) ? "is-linked" : ""}">
            <input type="checkbox" name="linkedOrganizationId" value="${org.id}" ${linkedIds.has(String(org.id)) ? "checked" : ""}>
            <span class="org-link-name" title="${escapeHtml(org.name)}">${escapeHtml(org.name)}</span>
            <span class="org-link-parent" title="${escapeHtml(organizationName(org.parentId) || "-")}">${escapeHtml(organizationName(org.parentId) || "-")}</span>
          </label>
        `).join("") || `<span class="muted">연계할 수 있는 조직이 없습니다.</span>`}
      </div>
    </form>
  `;
}

function organizationChildren(parentId = "", excludeId = "") {
  return (state.data.organizations || [])
    .filter((org) => String(org.id) !== String(excludeId))
    .filter((org) => String(org.parentId || "") === String(parentId || ""))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.name).localeCompare(String(b.name), "ko"));
}

function organizationById(id) {
  return (state.data.organizations || []).find((org) => String(org.id) === String(id));
}

function isRootOrganization(id) {
  const org = organizationById(id);
  return Boolean(org && !org.parentId);
}

function contractOrganizationPickerOptions() {
  if (hasFullAccess()) {
    return {
      emptyLabel: "선택 안 함",
      selectableIds: (state.data.organizations || []).filter((org) => org.parentId).map((org) => String(org.id))
    };
  }
  return {
    emptyLabel: "선택 안 함",
    allowEmpty: false,
    selectableIds: state.allowedContractOrganizationIds.map(String)
  };
}

function renderOrganizationTree(parentId = "") {
  const children = organizationChildren(parentId);
  if (!children.length) return "";
  return `<ul>${children.map((org) => `
    <li>
      ${renderOrganizationTreeNode(org)}
    </li>
  `).join("")}</ul>`;
}

function renderOrganizationTreeNode(org) {
  const hasChildren = organizationChildren(org.id).length > 0;
  const collapsed = state.collapsedOrganizationIds.has(String(org.id));
  return `
    <div class="org-node-row">
      ${hasChildren ? `<button type="button" class="org-expander" data-toggle-organization="${org.id}" aria-label="${collapsed ? "펼치기" : "접기"}">${collapsed ? "+" : "-"}</button>` : `<span class="org-expander-placeholder"></span>`}
      <button class="org-node ${String(state.selectedOrganizationId) === String(org.id) ? "active" : ""}" data-detail-organization="${org.id}">
        <svg viewBox="0 0 24 24"><path d="M4 20h16M6 20V8h8v12M14 12h4v8M9 11h1M9 15h1"/></svg>
        <span>${escapeHtml(org.name)}</span>
      </button>
    </div>
    ${hasChildren && !collapsed ? renderOrganizationTree(org.id) : ""}
  `;
}

function renderCompanyDetail() {
  const company = state.data.companies.find((item) => item.id === state.selectedCompanyId);
  if (!company) {
    state.selectedCompanyId = null;
    return renderCompanies();
  }
  const tabs = [
    ["basic", "기본정보"],
    ["contracts", "계약"],
    ["assets", "유지보수 대상"],
    ["worklogs", "작업이력"],
    ["documents", "첨부문서"],
    ["memo", "메모"]
  ];

  return `
    <section class="panel">
      <div class="detail-head">
        <div>
          <h2>${escapeHtml(company.name)}</h2>
          <p class="muted">${escapeHtml(company.address || "주소 미등록")} · ${escapeHtml(company.representative || "대표자 미등록")}</p>
        </div>
        <div class="inline-actions">
          <button class="ghost-button" data-back-companies>목록</button>
          ${canEditCompanies() ? `<button class="primary-button" data-edit="company" data-id="${company.id}">업체 수정</button>` : ""}
        </div>
      </div>
      <div class="tabs">
        ${tabs.map(([id, name]) => `<button class="tab ${state.selectedTab === id ? "active" : ""}" data-tab="${id}">${name}</button>`).join("")}
      </div>
      ${renderCompanyTab(company)}
    </section>
  `;
}

function renderCompanyTab(company) {
  if (state.selectedTab === "basic") {
    return `
      <div class="grid stats-grid">
        ${statCard("계약", state.data.contracts.filter((item) => item.companyId === company.id).length)}
        ${statCard("대상", state.data.assets.filter((item) => item.companyId === company.id).length)}
        ${statCard("작업", state.data.worklogs.filter((item) => item.companyId === company.id).length)}
        ${statCard("문서", state.data.documents.filter((item) => item.companyId === company.id).length)}
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table><tbody>
          <tr><th>사업자번호</th><td>${escapeHtml(company.businessNo || "-")}</td></tr>
          <tr><th>대표자</th><td>${escapeHtml(company.representative || "-")}</td></tr>
          <tr><th>담당자</th><td>${renderContactTable(company)}</td></tr>
          <tr><th>주소</th><td>${escapeHtml(company.address || "-")}</td></tr>
        </tbody></table>
      </div>
    `;
  }
  if (state.selectedTab === "contracts") {
    return `<div class="toolbar"><span></span>${canCreateContracts() ? `<button class="primary-button" data-add="contract" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>계약 등록</button>` : ""}</div>${renderContractTable(state.data.contracts.filter((item) => item.companyId === company.id), false)}`;
  }
  if (state.selectedTab === "assets") {
    const assets = state.data.assets.filter((item) => item.companyId === company.id);
    return `<div class="toolbar"><span></span>${hasPermission("menu.asset.create") ? `<button class="primary-button" data-add="asset" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>대상 등록</button>` : ""}</div>${renderAssetCards(assets)}`;
  }
  if (state.selectedTab === "worklogs") {
    const logs = state.data.worklogs.filter((item) => item.companyId === company.id);
    return `<div class="toolbar"><span></span>${hasPermission("menu.worklog.create") ? `<button class="primary-button" data-add="worklog" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>작업 등록</button>` : ""}</div>${renderMiniWorklogs(logs)}`;
  }
  if (state.selectedTab === "documents") {
    const docs = state.data.documents.filter((item) => item.companyId === company.id);
    return `<div class="toolbar"><span></span>${hasPermission("menu.document.create") ? `<div class="inline-actions"><button class="ghost-button" data-bulk-document data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M4 12h16M4 6h16M4 18h16"/></svg>문서 일괄등록</button><button class="primary-button" data-add="document" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>문서 등록</button></div>` : ""}</div>${renderDocumentCards(docs)}`;
  }
  return `<div class="item-card"><h3>메모</h3><p>${escapeHtml(company.memo || "등록된 메모가 없습니다.")}</p></div>`;
}

function bindViewEvents() {
  document.querySelectorAll("[data-excel-template]").forEach((button) => {
    button.addEventListener("click", () => downloadExcelTemplate(button.dataset.excelTemplate));
  });
  document.querySelectorAll("[data-excel-import]").forEach((button) => {
    button.addEventListener("click", () => selectExcelImport(button.dataset.excelImport));
  });
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.go;
      render();
    });
  });
  document.querySelectorAll("[data-stat-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.statAction === "active-contracts") {
        state.view = "contracts";
        state.contractListMode = "active";
        state.listPages.contracts = 1;
        state.selectedCompanyId = null;
        state.focusedContractId = "";
        render();
      }
    });
  });
  document.querySelectorAll("[data-contract-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.contractListMode = button.dataset.contractMode;
      state.listPages.contracts = 1;
      renderView();
    });
  });
  document.querySelectorAll("[data-list-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.listPage;
      state.listPages[type] = Number(button.dataset.page) || 1;
      renderView();
      document.querySelector(".main")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-list-search]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      updateListSearch(form.dataset.listSearch, new FormData(form));
      const pageMap = { company: "companies", contract: "contracts", employee: "employees" };
      const pageType = pageMap[form.dataset.listSearch] || form.dataset.listSearch;
      state.listPages[pageType] = 1;
      renderView();
    });
  });
  document.querySelectorAll("[data-clear-list-search]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.clearListSearch;
      if (type === "company") state.companySearch = { field: "all", query: "" };
      if (type === "contract") state.contractSearch = { field: "all", query: "" };
      if (type === "employee") state.employeeSearch = { field: "all", query: "" };
      const pageMap = { company: "companies", contract: "contracts", employee: "employees" };
      state.listPages[pageMap[type] || type] = 1;
      renderView();
    });
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.add, null, button.dataset.company));
  });
  document.querySelectorAll("[data-bulk-document]").forEach((button) => {
    button.addEventListener("click", () => openDocumentBulkModal(button.dataset.company));
  });
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.edit, button.dataset.id));
  });
  document.querySelectorAll("[data-open-contract]").forEach((button) => {
    button.addEventListener("click", () => openContractFromDashboard(button.dataset.openContract));
  });
  document.querySelectorAll("[data-calendar-month]").forEach((button) => {
    button.addEventListener("click", () => {
      moveCalendarMonth(Number(button.dataset.calendarMonth || 0));
    });
  });
  document.querySelectorAll("[data-toggle-organization]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String(button.dataset.toggleOrganization);
      if (state.collapsedOrganizationIds.has(id)) {
        state.collapsedOrganizationIds.delete(id);
      } else {
        state.collapsedOrganizationIds.add(id);
      }
      renderView();
    });
  });
  document.querySelectorAll("[data-detail-organization]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOrganizationId = button.dataset.detailOrganization;
      renderView();
    });
  });
  document.querySelectorAll("[data-delete-organization]").forEach((button) => {
    button.addEventListener("click", () => deleteOrganization(button.dataset.deleteOrganization));
  });
  document.querySelectorAll("[data-org-link-form]").forEach((form) => {
    form.querySelectorAll('input[name="linkedOrganizationId"]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        checkbox.closest(".org-link-card")?.classList.toggle("is-linked", checkbox.checked);
      });
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const organizationIds = [...form.querySelectorAll('input[name="linkedOrganizationId"]:checked')].map((input) => input.value);
      if (button) {
        button.disabled = true;
        button.textContent = "저장 중...";
      }
      try {
        await apiJson(`/api/organizations/${form.dataset.orgLinkForm}/contract-links`, {
          method: "PUT",
          body: JSON.stringify({ organizationIds })
        });
        await loadServerData();
        renderView();
      } catch (error) {
        alert(`연계 저장 실패: ${error.message}`);
        if (button) {
          button.disabled = false;
          button.textContent = "연계 저장";
        }
      }
    });
  });
  document.querySelectorAll("[data-detail-company]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCompanyId = button.dataset.detailCompany;
      state.selectedTab = "basic";
      state.focusedContractId = "";
      render();
    });
  });
  document.querySelectorAll("[data-back-companies]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCompanyId = null;
      state.view = "companies";
      render();
    });
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTab = button.dataset.tab;
      renderView();
    });
  });
  document.querySelectorAll("[data-download-doc]").forEach((button) => {
    button.addEventListener("click", () => downloadDocument(button.dataset.downloadDoc));
  });
  document.querySelectorAll("[data-doc-group]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDocumentTitle = button.dataset.docGroup || "";
      renderView();
    });
  });
  document.querySelectorAll("[data-doc-list-back]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDocumentTitle = "";
      renderView();
    });
  });
  document.querySelectorAll("[data-doc-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.docPage || 1);
      if (Number.isFinite(page) && page > 0) {
        state.documentPage = page;
        state.selectedDocumentTitle = "";
        renderView();
      }
    });
  });
  document.querySelectorAll("[data-doc-select-all]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      document.querySelectorAll("[data-doc-select]:not(:disabled)").forEach((item) => {
        item.checked = checkbox.checked;
      });
    });
  });
  document.querySelectorAll("[data-download-selected-docs]").forEach((button) => {
    button.addEventListener("click", downloadSelectedDocuments);
  });
  document.querySelectorAll("[data-close-contract]").forEach((button) => {
    button.addEventListener("click", () => closeContractFromAlert(button.dataset.closeContract));
  });
  document.querySelectorAll("[data-complete-pending]").forEach((button) => {
    button.addEventListener("click", () => completePendingItem(button.dataset.completePending));
  });
}

function openModal(type, id = null, companyId = null) {
  const collection = collectionFor(type);
  const item = id ? state.data[collection].find((entry) => entry.id === id) : null;
  const defaults = defaultItem(type, companyId || state.selectedCompanyId);
  state.modal = { type, id, saving: false };
  document.getElementById("modalTitle").textContent = `${modalName(type)} ${id ? "수정" : "등록"}`;
  document.getElementById("modalBody").innerHTML = renderForm(type, item || defaults);
  document.getElementById("deleteBtn").style.display = id && canDelete(type) ? "inline-flex" : "none";
  setModalBusy(false);
  document.getElementById("modalBackdrop").classList.remove("hidden");

  const fileInput = document.querySelector("input[type=file]");
  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      state.modal.fileName = file.name;
      state.modal.fileType = file.type;
    });
  }
  bindSelectSearchFields();
  bindOrganizationPickers();
  if (type === "contract") {
    bindContractRenewalAuto();
    bindContractAmountFormat();
  }
  if (type === "company") {
    bindCompanyOcr();
    bindCompanyContactsEditor();
  }
  if (type === "user") {
    bindUserPasswordChange();
  }
}

function openDocumentBulkModal(companyId = null) {
  const defaults = defaultItem("document", companyId || state.selectedCompanyId);
  state.modal = { type: "documentBulk", id: null, saving: false };
  document.getElementById("modalTitle").textContent = "문서 일괄등록";
  document.getElementById("modalBody").innerHTML = renderDocumentBulkForm(defaults);
  document.getElementById("deleteBtn").style.display = "none";
  setModalBusy(false);
  document.getElementById("modalBackdrop").classList.remove("hidden");
  bindSelectSearchFields();
  bindOrganizationPickers();
  bindDocumentBulkFiles();
}

function closeModal() {
  state.modal = null;
  setModalBusy(false);
  document.getElementById("modalBackdrop").classList.add("hidden");
  document.getElementById("modalForm").reset();
}

function canDelete(type) {
  const permissionByType = {
    company: "menu.company.delete",
    contract: "menu.contract.delete",
    pending: "menu.pending.delete",
    asset: "menu.asset.delete",
    worklog: "menu.worklog.delete",
    document: "menu.document.delete",
    employee: "menu.user.manage",
    user: "menu.user.manage",
    organization: "menu.organization.manage"
  };
  return hasPermission(permissionByType[type]);
}

async function saveModal(event) {
  event.preventDefault();
  if (!state.modal || state.modal.saving) return;
  state.modal.saving = true;
  setModalBusy(true);
  const { type, id } = state.modal;
  const collection = collectionFor(type);
  const fields = type === "documentBulk"
    ? documentFields.filter(([key]) => key !== "title" && key !== "file")
    : fieldsFor(type);
  const formData = new FormData(event.target);
  const item = id ? { ...state.data[collection].find((entry) => String(entry.id) === String(id)) } : {};

  fields.forEach(([key, , inputType]) => {
    if (inputType === "checkbox") {
      item[key] = formData.get(key) === "on";
    } else if (type === "contract" && key === "amount") {
      item[key] = Number(String(formData.get(key) || "").replace(/[^\d]/g, "") || 0);
    } else if (inputType === "number") {
      item[key] = Number(formData.get(key) || 0);
    } else if (inputType !== "file") {
      item[key] = String(formData.get(key) || "").trim();
    }
  });

  if (type === "company") {
    item.contacts = collectCompanyContacts(event.target);
  }

  if (type === "contract") {
    item.alertDays = Number.isFinite(item.alertDays) && item.alertDays > 0 ? item.alertDays : DEFAULT_ALERT_DAYS;
    item.autoAlert = item.autoAlert !== false;
  }

  try {
    if (type === "documentBulk") {
      const bulkForm = new FormData();
      bulkForm.append("companyId", item.companyId || "");
      bulkForm.append("contractId", item.contractId || "");
      bulkForm.append("organizationId", item.organizationId || "");
      bulkForm.append("category", item.category || "contract");
      bulkForm.append("memo", item.memo || "");
      const fileInput = document.getElementById("bulkFiles");
      const files = [...(fileInput?.files || [])];
      if (!files.length) {
        throw new Error("업로드할 파일을 선택해 주세요.");
      }
      files.forEach((file) => bulkForm.append("files", file));
      document.querySelectorAll("[data-bulk-file-category]").forEach((select) => {
        bulkForm.append("categories", select.value || item.category || "contract");
      });
      const result = await apiJson("/api/documents/bulk", {
        method: "POST",
        body: bulkForm
      });
      showDocumentBulkResult(result);
      await loadServerData();
      if (state.modal) {
        state.modal.saving = false;
        setModalBusy(false);
      }
      render();
      return;
    }
    if (type === "document") {
      const documentForm = new FormData();
      documentForm.append("companyId", item.companyId || "");
      documentForm.append("contractId", item.contractId || "");
      documentForm.append("organizationId", item.organizationId || "");
      documentForm.append("category", item.category || "contract");
      documentForm.append("title", item.title || "");
      documentForm.append("memo", item.memo || "");
      const fileInput = document.querySelector("input[type=file]");
      if (fileInput?.files?.[0]) {
        documentForm.append("file", fileInput.files[0]);
      }
      await apiJson(id ? `/api/documents/${id}` : "/api/documents", {
        method: id ? "PUT" : "POST",
        body: documentForm
      });
    } else {
      await apiJson(`${apiPath(type)}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(item)
      });
    }
    await loadServerData();
    closeModal();
    render();
  } catch (error) {
    alert(error.message === "해당 부서 및 담당자 등록 권한이 없습니다" ? error.message : `저장 실패: ${error.message}`);
    if (state.modal) {
      state.modal.saving = false;
      setModalBusy(false);
    }
  }
}

function showDocumentBulkResult(result) {
  const box = document.querySelector("[data-bulk-upload-result]");
  if (!box) return;
  const errors = Array.isArray(result.errors) ? result.errors : [];
  box.hidden = false;
  box.innerHTML = `
    <strong>등록 결과: 성공 ${Number(result.created || 0)}건 / 실패 ${Number(result.failed || 0)}건</strong>
    ${errors.length ? `<ul>${errors.map((item) => `<li>${escapeHtml(item.fileName || "파일")} - ${escapeHtml(item.error || "실패")}</li>`).join("")}</ul>` : `<span>선택한 파일이 정상 등록되었습니다.</span>`}
  `;
}

function setModalBusy(isBusy) {
  const form = document.getElementById("modalForm");
  if (!form) return;
  const saveButton = form.querySelector('button[type="submit"]');
  const cancelButton = document.getElementById("cancelBtn");
  const closeButton = document.getElementById("closeModalBtn");
  const deleteButton = document.getElementById("deleteBtn");
  if (saveButton) {
    saveButton.disabled = isBusy;
    saveButton.textContent = isBusy ? "저장 중..." : "저장";
  }
  if (cancelButton) cancelButton.disabled = isBusy;
  if (closeButton) closeButton.disabled = isBusy;
  if (deleteButton) deleteButton.disabled = isBusy;
}

async function deleteModalItem() {
  const { type, id } = state.modal;
  if (!id) return;
  if (!confirm("삭제하시겠습니까?")) return;
  try {
    await apiJson(`${apiPath(type)}/${id}`, { method: "DELETE" });
    if (type === "company") state.selectedCompanyId = null;
    await loadServerData();
    closeModal();
    render();
  } catch (error) {
    alert(`삭제 실패: ${error.message}`);
  }
}

async function deleteOrganization(id) {
  if (!id) return;
  if (!confirm("조직을 삭제하시겠습니까? 사용 중인 조직은 삭제되지 않습니다.")) return;
  try {
    await apiJson(`/api/organizations/${id}`, { method: "DELETE" });
    if (String(state.selectedOrganizationId) === String(id)) state.selectedOrganizationId = "";
    await loadServerData();
    render();
  } catch (error) {
    alert(`조직 삭제 실패: ${error.message}`);
  }
}

function renderForm(type, item) {
  const ocrPanel = type === "company" ? renderCompanyOcrPanel() : "";
  const contactsPanel = type === "company" ? renderCompanyContactsPanel(item) : "";
  const fields = type === "user" && state.modal?.id
    ? fieldsFor(type).filter(([key]) => key !== "password")
    : fieldsFor(type);
  const passwordPanel = type === "user" && state.modal?.id ? renderUserPasswordChangePanel() : "";
  return `${ocrPanel}<div class="form-grid">${fields.map(([key, labelText, inputType, required]) => {
    const worklogContractRequired = type === "worklog" && key === "contractId" && !hasFullAccess();
    return renderField(key, labelText, inputType, item, required || worklogContractRequired);
  }).join("")}${passwordPanel}</div>${contactsPanel}`;
}

function renderDocumentBulkForm(item) {
  const commonFields = documentFields.filter(([key]) => key !== "title" && key !== "file");
  return `
    <div class="bulk-upload-note">
      <strong>여러 파일을 같은 업체/계약에 한 번에 등록합니다.</strong>
      <span class="muted">문서명은 파일명에서 확장자를 뺀 이름으로 자동 저장됩니다.</span>
    </div>
    <div class="form-grid">
      ${commonFields.map(([key, labelText, inputType, required]) => renderField(key, labelText, inputType, item, required)).join("")}
      <div class="field-wide">
        <label for="bulkFiles">파일 선택</label>
        <input id="bulkFiles" name="files" type="file" multiple required>
        <span class="muted">여러 파일을 한 번에 선택할 수 있습니다. 최대 100개까지 등록합니다.</span>
      </div>
      <div class="field-wide">
        <div class="bulk-file-list" data-bulk-file-list>
          <span class="muted">선택된 파일이 없습니다.</span>
        </div>
      </div>
      <div class="field-wide bulk-upload-result" data-bulk-upload-result hidden></div>
    </div>
  `;
}

function bindDocumentBulkFiles() {
  const input = document.getElementById("bulkFiles");
  const list = document.querySelector("[data-bulk-file-list]");
  if (!input || !list) return;
  input.addEventListener("change", () => {
    const files = [...(input.files || [])];
    const defaultCategory = document.getElementById("category")?.value || "contract";
    if (!files.length) {
      list.innerHTML = `<span class="muted">선택된 파일이 없습니다.</span>`;
      return;
    }
    list.innerHTML = `
      <div class="bulk-file-summary">총 ${files.length}개 파일 선택</div>
      <ul>
        ${files.map((file, index) => `
          <li>
            <span>${escapeHtml(file.name)}</span>
            <select data-bulk-file-category="${index}" aria-label="${escapeHtml(file.name)} 문서구분">
              ${renderDocCategoryOptions(defaultCategory)}
            </select>
            <em>${formatFileSize(file.size)}</em>
          </li>
        `).join("")}
      </ul>
    `;
  });
}

function renderDocCategoryOptions(selected) {
  return options("docCategory").map(([id, name]) => `<option value="${id}" ${selected === id ? "selected" : ""}>${name}</option>`).join("");
}

function formatFileSize(size) {
  const number = Number(size || 0);
  if (number >= 1024 * 1024) return `${(number / 1024 / 1024).toFixed(1)} MB`;
  if (number >= 1024) return `${Math.round(number / 1024)} KB`;
  return `${number} B`;
}

function renderUserPasswordChangePanel() {
  return `
    <div class="field-wide password-change-box">
      <button type="button" class="ghost-button" data-show-password-change>비밀번호 변경</button>
      <div class="password-change-fields" hidden>
        <label for="password">새 비밀번호</label>
        <input id="password" name="password" type="password" autocomplete="new-password" placeholder="변경할 때만 입력">
        <span class="muted">입력하지 않으면 기존 비밀번호가 유지됩니다.</span>
      </div>
    </div>
  `;
}

function bindUserPasswordChange() {
  const button = document.querySelector("[data-show-password-change]");
  const fields = document.querySelector(".password-change-fields");
  const input = document.getElementById("password");
  if (!button || !fields) return;
  button.addEventListener("click", () => {
    const willOpen = fields.hidden;
    fields.hidden = !willOpen;
    button.textContent = willOpen ? "비밀번호 변경 취소" : "비밀번호 변경";
    if (willOpen) {
      input?.focus();
    } else if (input) {
      input.value = "";
    }
  });
}

function renderCompanyContactsPanel(item) {
  const contacts = Array.isArray(item.contacts) && item.contacts.length
    ? item.contacts
    : [{ name: item.manager || "", position: "", phone: item.phone || "", email: item.email || "", memo: "", isPrimary: true }];
  return `
    <section class="contacts-editor">
      <div class="contacts-editor-head">
        <div>
          <strong>담당자</strong>
          <p class="muted">업체별 담당자를 여러 명 등록할 수 있습니다. 대표 담당자는 목록에 우선 표시됩니다.</p>
        </div>
        <button type="button" class="ghost-button" data-add-contact>담당자 추가</button>
      </div>
      <div class="contact-editor-list" data-contact-list>
        ${contacts.map((contact, index) => renderContactEditorRow(contact, index)).join("")}
      </div>
    </section>
  `;
}

function renderContactEditorRow(contact = {}, index = 0) {
  return `
    <div class="contact-editor-row" data-contact-row>
      <label>이름<input name="contactName" type="text" value="${escapeHtml(contact.name || "")}" placeholder="담당자명"></label>
      <label>직책<input name="contactPosition" type="text" value="${escapeHtml(contact.position || "")}" placeholder="부장, 대표 등"></label>
      <label>연락처<input name="contactPhone" type="text" value="${escapeHtml(contact.phone || "")}" placeholder="010-0000-0000"></label>
      <label>이메일<input name="contactEmail" type="email" value="${escapeHtml(contact.email || "")}" placeholder="name@example.com"></label>
      <label class="contact-primary"><input name="contactPrimary" type="radio" value="${index}" ${contact.isPrimary || index === 0 ? "checked" : ""}> 대표</label>
      <button type="button" class="icon-button" data-remove-contact title="담당자 삭제">×</button>
      <label class="wide">메모<input name="contactMemo" type="text" value="${escapeHtml(contact.memo || "")}" placeholder="비고"></label>
    </div>
  `;
}

function bindCompanyContactsEditor() {
  const list = document.querySelector("[data-contact-list]");
  const addButton = document.querySelector("[data-add-contact]");
  if (!list || !addButton) return;

  const refreshPrimaryValues = () => {
    [...list.querySelectorAll("[data-contact-row]")].forEach((row, index) => {
      const radio = row.querySelector('input[name="contactPrimary"]');
      if (radio) radio.value = String(index);
    });
    const checked = list.querySelector('input[name="contactPrimary"]:checked');
    const first = list.querySelector('input[name="contactPrimary"]');
    if (!checked && first) first.checked = true;
  };

  addButton.addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", renderContactEditorRow({}, list.querySelectorAll("[data-contact-row]").length));
    refreshPrimaryValues();
  });

  list.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-contact]");
    if (!removeButton) return;
    const rows = list.querySelectorAll("[data-contact-row]");
    if (rows.length <= 1) {
      rows[0].querySelectorAll("input").forEach((input) => {
        if (input.type === "radio") {
          input.checked = true;
        } else {
          input.value = "";
        }
      });
      return;
    }
    removeButton.closest("[data-contact-row]")?.remove();
    refreshPrimaryValues();
  });
}

function collectCompanyContacts(form) {
  const rows = [...form.querySelectorAll("[data-contact-row]")];
  return rows.map((row) => ({
    name: row.querySelector('[name="contactName"]')?.value.trim() || "",
    position: row.querySelector('[name="contactPosition"]')?.value.trim() || "",
    phone: row.querySelector('[name="contactPhone"]')?.value.trim() || "",
    email: row.querySelector('[name="contactEmail"]')?.value.trim() || "",
    memo: row.querySelector('[name="contactMemo"]')?.value.trim() || "",
    isPrimary: Boolean(row.querySelector('[name="contactPrimary"]')?.checked)
  })).filter((contact) => contact.name || contact.position || contact.phone || contact.email || contact.memo);
}

function renderCompanyOcrPanel() {
  return `
    <div class="ocr-panel">
      <div>
        <strong>스캔본 자동입력</strong>
        <p class="muted">사업자등록증, 명함, 계약서 스캔본을 OCR로 읽어 폼에 채웁니다.</p>
      </div>
      <input id="companyOcrFile" type="file" accept=".png,.jpg,.jpeg,.bmp,.tif,.tiff,.pdf">
      <button type="button" class="ghost-button" id="companyOcrBtn">자동입력</button>
      <span class="muted" id="companyOcrStatus"></span>
    </div>
  `;
}

function bindCompanyOcr() {
  const fileInput = document.getElementById("companyOcrFile");
  const button = document.getElementById("companyOcrBtn");
  const status = document.getElementById("companyOcrStatus");
  if (!fileInput || !button) return;

  button.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      alert("자동입력할 이미지 또는 PDF 파일을 선택해 주세요.");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    button.disabled = true;
    if (status) status.textContent = "인식 중...";

    try {
      const result = await apiJson("/api/ocr/company", { method: "POST", body: form });
      const fields = result.fields || {};
      applyOcrValue("name", fields.name);
      applyOcrValue("businessNo", fields.businessNo);
      applyOcrValue("representative", fields.representative);
      applyOcrValue("address", fields.address);
      applyOcrContactValue("contactEmail", fields.email);
      if (status) status.textContent = "자동입력 완료. 내용을 확인한 뒤 저장하세요.";
    } catch (error) {
      if (status) status.textContent = "";
      alert(`OCR 실패: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
}

function applyOcrValue(fieldId, value) {
  if (!value) return;
  const field = document.getElementById(fieldId);
  if (field && !field.value) field.value = value;
}

function applyOcrContactValue(fieldName, value) {
  if (!value) return;
  const field = document.querySelector(`[name="${fieldName}"]`);
  if (field && !field.value) field.value = value;
}

function bindSelectSearchFields() {
  document.querySelectorAll("[data-select-search-for]").forEach((input) => {
    const select = document.getElementById(input.dataset.selectSearchFor);
    const result = document.querySelector(`[data-select-search-result-for="${input.dataset.selectSearchFor}"]`);
    if (!select) return;

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      let visibleCount = 0;
      let lastVisibleValue = "";

      [...select.options].forEach((option) => {
        const searchableText = (option.dataset.searchText || option.textContent || "").toLowerCase();
        const visible = option.value === "" || !query || searchableText.includes(query);
        option.hidden = !visible;
        option.disabled = !visible;
        if (visible && option.value !== "") {
          visibleCount += 1;
          lastVisibleValue = option.value;
        }
      });

      if (visibleCount === 1) {
        select.value = lastVisibleValue;
      } else if (select.selectedOptions[0]?.disabled) {
        select.value = "";
      }

      if (result) {
        const totalCount = Number(input.dataset.selectSearchTotal || visibleCount);
        const unit = input.dataset.selectSearchUnit || "개";
        result.textContent = query ? `검색 결과 ${visibleCount}${unit}` : `총 ${totalCount}${unit}`;
      }
    });
  });
}

function bindContractRenewalAuto() {
  const endDate = document.getElementById("endDate");
  const renewalDate = document.getElementById("renewalDate");
  if (!endDate || !renewalDate) return;

  const initialAutoDate = nextDateInput(endDate.value);
  if (!renewalDate.value && initialAutoDate) {
    renewalDate.value = initialAutoDate;
  }

  renewalDate.dataset.autoValue = initialAutoDate || renewalDate.value || "";
  renewalDate.dataset.manual = renewalDate.value && renewalDate.value !== initialAutoDate ? "true" : "false";

  renewalDate.addEventListener("input", () => {
    renewalDate.dataset.manual = renewalDate.value && renewalDate.value !== renewalDate.dataset.autoValue ? "true" : "false";
  });

  endDate.addEventListener("change", () => {
    const nextDate = nextDateInput(endDate.value);
    if (!nextDate) return;
    if (renewalDate.dataset.manual !== "true") {
      renewalDate.value = nextDate;
      renewalDate.dataset.autoValue = nextDate;
    }
  });
}

function bindContractAmountFormat() {
  const amount = document.getElementById("amount");
  if (!amount) return;

  amount.value = formatNumberInput(amount.value);
  amount.addEventListener("input", () => {
    amount.value = formatNumberInput(amount.value);
  });
}

function bindOrganizationPickers() {
  document.querySelectorAll("[data-org-picker-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const picker = button.closest("[data-org-picker]");
      const tree = picker?.querySelector(".org-picker-tree");
      if (!tree) return;
      const isHidden = tree.hidden;
      tree.hidden = !isHidden;
      button.setAttribute("aria-expanded", String(isHidden));
      const marker = button.querySelector("strong");
      if (marker) marker.textContent = isHidden ? "-" : "+";
    });
  });

  document.querySelectorAll("[data-form-org-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.formOrgToggle;
      const picker = button.closest("[data-org-picker]");
      const childList = picker?.querySelector(`[data-form-org-children="${CSS.escape(id)}"]`);
      if (!childList) return;
      const isHidden = childList.hidden;
      childList.hidden = !isHidden;
      button.textContent = isHidden ? "-" : "+";
      button.setAttribute("aria-expanded", String(isHidden));
    });
  });

  document.querySelectorAll("[data-form-org-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const picker = button.closest("[data-org-picker]");
      if (!picker) return;
      const key = picker.dataset.orgPicker;
      const input = document.getElementById(key);
      const current = picker.querySelector("[data-org-picker-toggle] span");
      const tree = picker.querySelector(".org-picker-tree");
      const value = button.dataset.formOrgSelect || "";
      if (input) input.value = value;
      if (current) current.textContent = button.dataset.orgName || "선택 안 함";
      picker.querySelectorAll(".org-picker-option").forEach((item) => item.classList.toggle("active", item === button));
      if (tree) tree.hidden = true;
      const toggle = picker.querySelector("[data-org-picker-toggle]");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        const marker = toggle.querySelector("strong");
        if (marker) marker.textContent = "+";
      }
    });
  });
}

function renderOrganizationPicker(key, labelText, value, required, options = {}) {
  const selectedName = organizationName(value) || options.emptyLabel || "선택 안 함";
  const req = required ? "required" : "";
  const allowEmpty = options.allowEmpty !== false;
  const emptyDisabled = allowEmpty ? "" : "disabled";
  return `
    <div class="field field-wide organization-field">
      <label for="${key}">${labelText}</label>
      <input type="hidden" id="${key}" name="${key}" value="${escapeHtml(value)}" ${req}>
      <div class="org-picker" data-org-picker="${key}">
        <button type="button" class="org-picker-current" data-org-picker-toggle aria-expanded="false">
          <span>${escapeHtml(selectedName)}</span>
          <strong>+</strong>
        </button>
        <div class="org-picker-tree" hidden>
          <button type="button" class="org-picker-option ${value ? "" : "active"}" data-form-org-select="" data-org-name="${escapeHtml(options.emptyLabel || "선택 안 함")}" ${emptyDisabled}>${escapeHtml(options.emptyLabel || "선택 안 함")}</button>
          ${renderOrganizationPickerTree(value, "", options)}
        </div>
      </div>
    </div>
  `;
}

function renderOrganizationPickerTree(selectedValue, parentId = "", options = {}) {
  const excludeId = options.excludeId || "";
  const children = organizationChildren(parentId, excludeId);
  if (!children.length) return "";
  return `<ul>${children.map((org) => {
    const hasChildren = organizationChildren(org.id, excludeId).length > 0;
    const selectableIds = Array.isArray(options.selectableIds) ? options.selectableIds.map(String) : null;
    const isSelectable = !selectableIds || selectableIds.includes(String(org.id));
    const disabled = isSelectable ? "" : "disabled";
    return `
      <li>
        <div class="org-picker-row">
          ${hasChildren ? `<button type="button" class="org-picker-expander" data-form-org-toggle="${org.id}" aria-expanded="true">-</button>` : `<span class="org-picker-expander-placeholder"></span>`}
          <button type="button" class="org-picker-option ${String(selectedValue) === String(org.id) ? "active" : ""}" data-form-org-select="${org.id}" data-org-name="${escapeHtml(org.name)}" ${disabled}>
            <svg viewBox="0 0 24 24"><path d="M4 20h16M6 20V8h8v12M14 12h4v8M9 11h1M9 15h1"/></svg>
            <span>${escapeHtml(org.name)}</span>
          </button>
        </div>
        ${hasChildren ? `<div data-form-org-children="${org.id}">${renderOrganizationPickerTree(selectedValue, org.id, options)}</div>` : ""}
      </li>
    `;
  }).join("")}</ul>`;
}

function renderField(key, labelText, inputType, item, required) {
  const value = item[key] ?? "";
  const req = required ? "required" : "";
  const wide = inputType === "textarea" || inputType === "file" ? "field-wide" : "field";
  const base = `<label for="${key}">${labelText}</label>`;
  if (inputType === "textarea") {
    return `<div class="${wide}">${base}<textarea id="${key}" name="${key}" ${req}>${escapeHtml(value)}</textarea></div>`;
  }
  if (inputType === "company") {
    return `<div class="${wide}">${base}<input class="select-search-input" type="search" placeholder="업체명 검색" data-select-search-for="${key}" data-select-search-total="${state.data.companies.length}" data-select-search-unit="개 업체" autocomplete="off"><select id="${key}" name="${key}" ${req}>${state.data.companies.map((company) => `<option value="${company.id}" data-search-text="${escapeHtml(company.name)}" ${value === company.id ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}</select><span class="muted select-search-result" data-select-search-result-for="${key}">총 ${state.data.companies.length}개 업체</span></div>`;
  }
  if (inputType === "contract") {
    return `<div class="${wide}">${base}<input class="select-search-input" type="search" placeholder="계약명 또는 업체명 검색" data-select-search-for="${key}" data-select-search-total="${state.data.contracts.length}" data-select-search-unit="개 계약" autocomplete="off"><select id="${key}" name="${key}"><option value="">선택 안 함</option>${state.data.contracts.map((contract) => `<option value="${contract.id}" data-search-text="${escapeHtml(`${contract.name || ""} ${companyName(contract.companyId)}`)}" ${value === contract.id ? "selected" : ""}>${escapeHtml(contract.name)} (${escapeHtml(companyName(contract.companyId))})</option>`).join("")}</select><span class="muted select-search-result" data-select-search-result-for="${key}">총 ${state.data.contracts.length}개 계약</span></div>`;
  }
  if (inputType === "user") {
    const users = state.data.users || [];
    const hasSelectedUser = users.some((user) => String(user.id) === String(value));
    const fallbackOption = value && !hasSelectedUser
      ? `<option value="${escapeHtml(value)}" selected>${escapeHtml(item.managerUserName || item.manager || "기존 담당자")}</option>`
      : "";
    const userOptions = users.map((user) => {
      const name = user.displayName || user.username;
      const email = user.email ? ` / ${user.email}` : "";
      const org = user.organizationName ? ` (${user.organizationName})` : "";
      const searchText = `${name} ${user.username || ""} ${user.email || ""} ${user.organizationName || ""}`;
      return `<option value="${user.id}" data-search-text="${escapeHtml(searchText)}" ${String(value) === String(user.id) ? "selected" : ""}>${escapeHtml(`${name}${org}${email}`)}</option>`;
    }).join("");
    const fallback = item.manager && !value ? `<span class="muted">기존 담당자: ${escapeHtml(item.manager)}</span>` : "";
    return `<div class="${wide}">${base}<input class="select-search-input" type="search" placeholder="사용자명, 이메일, 부서 검색" data-select-search-for="${key}" data-select-search-total="${users.length}" data-select-search-unit="명" autocomplete="off"><select id="${key}" name="${key}" ${req}><option value="">선택 안 함</option>${fallbackOption}${userOptions}</select><span class="muted select-search-result" data-select-search-result-for="${key}">총 ${users.length}명</span>${fallback}</div>`;
  }
  if (inputType === "employee") {
    const employees = state.data.employees || [];
    const employeeOptions = employees.map((employee) => {
      const searchText = `${employee.employeeNo || ""} ${employee.name || ""} ${employee.email || ""}`;
      return `<option value="${employee.id}" data-search-text="${escapeHtml(searchText)}" ${String(value) === String(employee.id) ? "selected" : ""}>${escapeHtml(`${employee.employeeNo} / ${employee.name}`)}</option>`;
    }).join("");
    return `<div class="${wide}">${base}<input class="select-search-input" type="search" placeholder="사원번호, 이름, 이메일 검색" data-select-search-for="${key}" data-select-search-total="${employees.length}" data-select-search-unit="명" autocomplete="off"><select id="${key}" name="${key}" ${req}><option value="">연결 안 함</option>${employeeOptions}</select><span class="muted select-search-result" data-select-search-result-for="${key}">총 ${employees.length}명</span></div>`;
  }
  if (inputType === "organization") {
    const pickerOptions = state.modal?.type === "contract"
      ? contractOrganizationPickerOptions()
      : { emptyLabel: "선택 안 함" };
    return renderOrganizationPicker(key, labelText, value, required, pickerOptions);
  }
  if (inputType === "organizationParent") {
    const currentId = item.id || state.modal?.id || "";
    return renderOrganizationPicker(key, labelText, value, required, { emptyLabel: "최상위 조직", excludeId: currentId });
  }
  if (inputType === "billing" || inputType === "contractStatus" || inputType === "pendingStatus" || inputType === "assetType" || inputType === "workCategory" || inputType === "workStatus" || inputType === "docCategory" || inputType === "userRole" || inputType === "employmentStatus") {
    return `<div class="${wide}">${base}<select id="${key}" name="${key}" ${req}>${options(inputType).map(([id, name]) => `<option value="${id}" ${value === id ? "selected" : ""}>${name}</option>`).join("")}</select></div>`;
  }
  if (inputType === "checkbox") {
    return `<div class="${wide}">${base}<label class="mini-row" style="justify-content:flex-start"><input type="checkbox" name="${key}" ${value ? "checked" : ""} style="width:auto"> 사용</label></div>`;
  }
  if (inputType === "file") {
    return `<div class="${wide}">${base}<input id="${key}" name="${key}" type="file"><span class="muted">${item.fileName ? `현재 파일: ${escapeHtml(item.fileName)}` : "2MB 이하 파일 첨부 가능"}</span></div>`;
  }
  if (key === "amount") {
    return `<div class="${wide}">${base}<input id="${key}" name="${key}" type="text" inputmode="numeric" value="${escapeHtml(formatNumberInput(value))}" ${req}></div>`;
  }
  return `<div class="${wide}">${base}<input id="${key}" name="${key}" type="${inputType}" value="${escapeHtml(value)}" ${req}></div>`;
}

function renderContractTable(contracts, showAlert, options = {}) {
  const sorted = [...contracts].sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
  if (!sorted.length) return empty("표시할 계약이 없습니다.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>계약명</th><th>업체</th><th>담당부서</th><th>담당자</th><th>기간</th><th>총 금액 / 지급방법</th><th>상태</th>${showAlert ? "<th>알림</th>" : ""}<th></th></tr></thead>
        <tbody>
          ${sorted.map((contract) => `
            <tr class="${String(contract.id) === String(state.focusedContractId) ? "is-focused-contract" : ""}" data-contract-row="${contract.id}">
              <td><strong>${escapeHtml(contract.name)}</strong><br><span class="muted">알림 기준 ${contract.alertDays || DEFAULT_ALERT_DAYS}일 전</span></td>
              <td>${escapeHtml(companyName(contract.companyId))}</td>
              <td>${escapeHtml(contract.organizationName || "-")}</td>
              <td>${escapeHtml(contractManagerName(contract) || "-")}</td>
              <td>${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}</td>
              <td>${formatMoney(contract.amount)} / ${label("billing", contract.billingCycle)}</td>
              <td>${contractStatusBadge(contract)}</td>
              ${showAlert ? `<td>${alertText(contract)}</td>` : ""}
              <td>
                <div class="table-actions">
                  ${canEditContracts() && options.allowClose && contract.status !== "closed" ? `<button class="row-action" data-close-contract="${contract.id}">종료 처리</button>` : ""}
                  ${canEditContracts() ? `<button class="row-action" data-edit="contract" data-id="${contract.id}">수정</button>` : ""}
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderExpiryCalendar(contracts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visibleMonth = currentCalendarMonthDate();
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDate = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0);
  const leadingDays = firstDate.getDay();
  const totalCells = Math.ceil((leadingDays + lastDate.getDate()) / 7) * 7;
  const monthText = `${year}년 ${String(month + 1).padStart(2, "0")}월`;
  const byDay = new Map();

  contracts.forEach((contract) => {
    const date = parseDateInput(contract.endDate);
    if (!date || date.getFullYear() !== year || date.getMonth() !== month) return;
    const day = date.getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(contract);
  });

  return `
    <div class="calendar-month-bar">
      <button type="button" class="calendar-nav-button" data-calendar-month="-1" aria-label="이전 달" title="이전 달">
        <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="calendar-month">${monthText}</div>
      <button type="button" class="calendar-nav-button" data-calendar-month="1" aria-label="다음 달" title="다음 달">
        <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
    <div class="calendar-grid" aria-label="${monthText} 계약 만료 캘린더">
      ${["일", "월", "화", "수", "목", "금", "토"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
      ${Array.from({ length: totalCells }, (_, index) => {
        const day = index - leadingDays + 1;
        const inMonth = day >= 1 && day <= lastDate.getDate();
        const dayContracts = inMonth ? byDay.get(day) || [] : [];
        const isToday = inMonth && day === today.getDate();
        return `
          <div class="calendar-day ${inMonth ? "" : "is-muted"} ${isToday ? "is-today" : ""} ${dayContracts.length ? "has-contract" : ""}">
            ${inMonth ? `
              ${dayContracts[0] ? `<button class="calendar-date" data-open-contract="${dayContracts[0].id}" aria-label="${day}일 만료 계약으로 이동">${day}</button>` : `<span class="calendar-date-label">${day}</span>`}
              <div class="calendar-contracts">
                ${dayContracts.slice(0, 3).map((contract) => `
                  <button class="calendar-contract" data-open-contract="${contract.id}" title="${escapeHtml(contract.name)}">
                    <span>${escapeHtml(contract.name)}</span>
                    <small>${escapeHtml(companyName(contract.companyId))}</small>
                  </button>
                `).join("")}
                ${dayContracts.length > 3 ? `<span class="calendar-more">외 ${dayContracts.length - 3}건</span>` : ""}
              </div>
            ` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function currentCalendarMonthDate() {
  if (state.calendarMonth) {
    const selected = parseDateInput(`${state.calendarMonth}-01`);
    if (selected) return selected;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  state.calendarMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function moveCalendarMonth(delta) {
  if (!Number.isFinite(delta) || delta === 0) return;
  const current = currentCalendarMonthDate();
  current.setMonth(current.getMonth() + delta);
  state.calendarMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  renderView();
}

function getCalendarContracts() {
  return state.data.contracts
    .filter((contract) => contract.status !== "closed" && contract.endDate)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
}

function openContractFromDashboard(id) {
  const contract = state.data.contracts.find((item) => String(item.id) === String(id));
  if (!contract) return;
  state.selectedCompanyId = contract.companyId || null;
  state.selectedTab = "contracts";
  state.focusedContractId = contract.id;
  state.view = "companies";
  render();
  requestAnimationFrame(() => {
    document.querySelector(`[data-contract-row="${CSS.escape(String(contract.id))}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

async function closeContractFromAlert(id) {
  const contract = state.data.contracts.find((item) => String(item.id) === String(id));
  if (!contract) return;
  if (!confirm("이 계약을 종료 처리하고 알림에서 제외하시겠습니까?")) return;

  const payload = { ...contract, status: "closed" };
  try {
    await apiJson(`/api/contracts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    await loadServerData();
    render();
  } catch (error) {
    alert(`종료 처리 실패: ${error.message}`);
  }
}

async function completePendingItem(id) {
  const item = state.data.pendingItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const payload = { ...item, status: "done" };
  try {
    await apiJson(`/api/pending-items/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    await loadServerData();
    render();
  } catch (error) {
    alert(`미결 처리 실패: ${error.message}`);
  }
}

function renderMiniWorklogs(logs) {
  if (!logs.length) return empty("표시할 작업 이력이 없습니다.");
  return `<div class="mini-list">${logs.map((log) => `
    <div class="mini-row">
      <div>
        <strong>${escapeHtml(log.title)}</strong>
        <div class="muted">${formatDate(log.date)} · ${escapeHtml(companyName(log.companyId))} · ${label("workCategory", log.category)}</div>
      </div>
      ${workStatusBadge(log.status)}
    </div>
  `).join("")}</div>`;
}

function renderPendingItems(items) {
  if (!items.length) return empty("미결 내역이 없습니다.");
  return `<div class="mini-list">${items.map((item) => `
    <div class="mini-row">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="muted">${formatDate(item.dueDate)} · ${escapeHtml(companyName(item.companyId))}${item.memo ? ` · ${escapeHtml(item.memo)}` : ""}</div>
      </div>
      <div class="table-actions">
        ${pendingStatusBadge(item.status)}
        ${hasPermission("menu.pending.update") ? `<button class="row-action" data-edit="pending" data-id="${item.id}">수정</button>` : ""}
        ${hasPermission("menu.pending.update") ? `<button class="row-action" data-complete-pending="${item.id}">완료</button>` : ""}
      </div>
    </div>
  `).join("")}</div>`;
}

function renderAssetCards(assets) {
  if (!assets.length) return empty("등록된 유지보수 대상이 없습니다.");
  return `<div class="grid">${assets.map((asset) => `
    <article class="item-card">
      <h3>${escapeHtml(asset.name)} <span class="tag">${label("assetType", asset.type)}</span></h3>
      <p class="muted">${escapeHtml(asset.location || "위치 미등록")} · ${escapeHtml(asset.serial || "관리번호 없음")}</p>
      ${hasPermission("menu.asset.update") ? `<button class="row-action" data-edit="asset" data-id="${asset.id}">수정</button>` : ""}
    </article>
  `).join("")}</div>`;
}

function renderDocumentCards(docs) {
  if (!docs.length) return empty("등록된 첨부문서가 없습니다.");
  return `<div class="grid">${docs.map((doc) => `
    <article class="item-card">
      <h3>${escapeHtml(doc.title)} <span class="tag">${label("docCategory", doc.category)}</span></h3>
      <p class="muted">${escapeHtml(doc.fileName || "파일 없음")}</p>
      <div class="inline-actions">
        ${doc.fileName ? `<button class="row-action" data-download-doc="${doc.id}">다운로드</button>` : ""}
        ${hasPermission("menu.document.update") ? `<button class="row-action" data-edit="document" data-id="${doc.id}">수정</button>` : ""}
      </div>
    </article>
  `).join("")}</div>`;
}

function renderRevenueList() {
  const rows = state.data.companies.map((company) => ({
    name: company.name,
    value: state.data.contracts
      .filter((contract) => contract.companyId === company.id)
      .reduce((sum, contract) => sum + Number(contract.amount || 0), 0)
  })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  if (!rows.length) return empty("계약 금액 데이터가 없습니다.");
  return `<div class="mini-list">${rows.map((row) => `<div class="mini-row"><strong>${escapeHtml(row.name)}</strong><span>${formatMoney(row.value)}</span></div>`).join("")}</div>`;
}

function statCard(labelText, value, options = {}) {
  const valueHtml = options.action
    ? `<button class="stat-value-button" data-stat-action="${options.action}">${value}</button>`
    : `<strong>${value}</strong>`;
  return `<article class="stat-card"><span>${labelText}</span>${valueHtml}</article>`;
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function hasFullAccess() {
  return hasPermission("menu.company.delete") && hasPermission("menu.contract.delete");
}

function hasPermission(permission) {
  if (!permission) return true;
  if (state.permissions.includes(permission)) return true;
  if (state.permissions.length) return false;
  const role = state.user?.role;
  if (role === "admin") return permission.startsWith("menu.");
  if (role === "manager") {
    return permission.startsWith("menu.")
      && !permission.startsWith("menu.user.")
      && !permission.startsWith("menu.organization.");
  }
  if (role === "team_lead") {
    return [
      "menu.dashboard.view",
      "menu.schedule.view",
      "menu.stats.view",
      "menu.company.view",
      "menu.company.create",
      "menu.company.update",
      "menu.contract.view",
      "menu.contract.create",
      "menu.contract.update",
      "menu.pending.view",
      "menu.asset.view",
      "menu.worklog.view",
      "menu.worklog.create",
      "menu.worklog.update",
      "menu.worklog.delete",
      "menu.document.view"
    ].includes(permission);
  }
  if (role === "team_member") {
    return [
      "menu.dashboard.view",
      "menu.schedule.view",
      "menu.stats.view",
      "menu.company.view",
      "menu.company.create",
      "menu.contract.view",
      "menu.contract.create",
      "menu.pending.view",
      "menu.asset.view",
      "menu.worklog.view",
      "menu.worklog.create",
      "menu.document.view"
    ].includes(permission);
  }
  return state.permissions.includes(permission);
}

function canCreateContracts() {
  return hasPermission("menu.contract.create");
}

function canEditContracts() {
  return hasPermission("menu.contract.update");
}

function canEditCompanies() {
  return hasPermission("menu.company.update");
}

function defaultContractOrganizationId() {
  if (hasFullAccess()) {
    return state.data.organizations.find((org) => org.parentId)?.id || "";
  }
  const allowedIds = (state.allowedContractOrganizationIds || []).map(String);
  const userOrganizationId = String(state.user?.organizationId || "");
  if (allowedIds.includes(userOrganizationId)) return userOrganizationId;
  const parentId = String(organizationById(userOrganizationId)?.parentId || "");
  if (parentId && allowedIds.includes(parentId)) return parentId;
  return allowedIds[0] || userOrganizationId;
}

function defaultItem(type, companyId) {
  const today = toDateInput(new Date());
  const defaults = {
    company: {},
    contract: { companyId: companyId || state.data.companies[0]?.id || "", organizationId: defaultContractOrganizationId(), managerUserId: state.user?.role === "team_member" ? String(state.user.id || "") : "", startDate: today, endDate: today, renewalDate: nextDateInput(today), billingCycle: "yearly", status: "active", alertDays: DEFAULT_ALERT_DAYS, autoAlert: true },
    pending: { companyId: companyId || "", dueDate: today, status: "open" },
    asset: { companyId: companyId || state.data.companies[0]?.id || "", type: "equipment" },
    worklog: { companyId: companyId || state.data.companies[0]?.id || "", date: today, category: "visit", status: "done" },
    document: { companyId: companyId || state.data.companies[0]?.id || "", organizationId: state.user?.organizationId || state.data.organizations[0]?.id || "", category: "contract" },
    employee: { employmentStatus: "active", joinedAt: today, resignedAt: today },
    user: { role: "team_member", isActive: true, organizationId: state.data.organizations[0]?.id || "" },
    organization: { parentId: "", sortOrder: state.data.organizations.length + 1, isActive: true }
  };
  return defaults[type] || {};
}

function fieldsFor(type) {
  return { company: companyFields, contract: contractFields, pending: pendingFields, asset: assetFields, worklog: worklogFields, document: documentFields, employee: employeeFields, user: userFields, organization: organizationFields }[type];
}

function collectionFor(type) {
  return { company: "companies", contract: "contracts", pending: "pendingItems", asset: "assets", worklog: "worklogs", document: "documents", employee: "employees", user: "users", organization: "organizations" }[type];
}

function apiPath(type) {
  return { company: "/api/companies", contract: "/api/contracts", pending: "/api/pending-items", asset: "/api/assets", worklog: "/api/worklogs", document: "/api/documents", employee: "/api/employees", user: "/api/users", organization: "/api/organizations" }[type];
}

function modalName(type) {
  return { company: "업체", contract: "계약", pending: "미결 내역", asset: "유지보수 대상", worklog: "작업 이력", document: "문서", employee: "직원 기준 정보", user: "사용자", organization: "조직" }[type];
}

function options(type) {
  const maps = {
    billing: [["once", "일시불"], ["split3", "3분할"], ["split2", "2분할"], ["monthly", "월"]],
    contractStatus: [["active", "진행"], ["pending", "검토"], ["expired", "만료"], ["closed", "종료"]],
    pendingStatus: [["open", "미결"], ["progress", "진행중"], ["done", "완료"], ["hold", "보류"]],
    assetType: [["equipment", "장비"], ["program", "프로그램"], ["server", "서버"], ["network", "네트워크"], ["printer", "프린터"], ["cctv", "CCTV"], ["security", "보안장비"]],
    workCategory: [["visit", "방문 점검"], ["remote", "원격지원"], ["incident", "장애 처리"], ["part", "부품 교체"], ["regular", "정기점검"]],
    workStatus: [["open", "접수"], ["progress", "처리중"], ["done", "완료"], ["hold", "보류"]],
    docCategory: [["contract", "계약서"], ["estimate", "견적서"], ["license", "사업자등록증"], ["report", "점검보고서"], ["photo", "사진"], ["other", "기타"]],
    userRole: [["admin", "관리자"], ["manager", "매니저"], ["team_lead", "팀장"], ["team_member", "팀원"]],
    employmentStatus: [["active", "재직"], ["resigned", "퇴사"], ["leave", "휴직"]]
  };
  return maps[type] || [];
}

function label(type, value) {
  return options(type).find(([id]) => id === value)?.[1] || value || "-";
}

function companyName(id) {
  return state.data.companies.find((company) => company.id === id)?.name || "업체 미지정";
}

function organizationName(id) {
  if (!id) return "";
  return state.data.organizations.find((org) => String(org.id) === String(id))?.name || "";
}

function userName(id) {
  if (!id) return "";
  const user = state.data.users.find((entry) => String(entry.id) === String(id));
  return user ? (user.displayName || user.username || "") : "";
}

function contractManagerName(contract) {
  return contract.managerUserName || userName(contract.managerUserId) || contract.manager || "";
}

function getUpcomingContracts() {
  return state.data.contracts.filter((contract) => {
    if (contract.autoAlert === false || contract.status === "closed") return false;
    const days = daysUntil(contract.endDate);
    const alertDays = contract.alertDays || DEFAULT_ALERT_DAYS;
    return days >= 0 && days <= alertDays;
  });
}

function alertText(contract) {
  const days = daysUntil(contract.endDate);
  if (days < 0) return `<span class="status status-expired">${Math.abs(days)}일 지남</span>`;
  if (days <= (contract.alertDays || DEFAULT_ALERT_DAYS)) return `<span class="status status-pending">${days}일 남음</span>`;
  return `<span class="status status-active">정상</span>`;
}

function contractStatusBadge(contract) {
  const days = daysUntil(contract.endDate);
  const status = days < 0 && contract.status !== "closed" ? "expired" : contract.status;
  const names = { active: "진행", pending: "검토", expired: "만료", closed: "종료" };
  return `<span class="status status-${status || "active"}">${names[status] || "진행"}</span>`;
}

function workStatusBadge(status) {
  const classes = { open: "pending", progress: "pending", done: "active", hold: "closed" };
  return `<span class="status status-${classes[status] || "closed"}">${label("workStatus", status)}</span>`;
}

function pendingStatusBadge(status) {
  const classes = { open: "pending", progress: "pending", done: "active", hold: "closed" };
  return `<span class="status status-${classes[status] || "closed"}">${label("pendingStatus", status)}</span>`;
}

function employeeStatusBadge(employee) {
  if (!employee.isActive || employee.employmentStatus === "resigned") {
    return `<span class="status status-closed">퇴사</span>`;
  }
  if (employee.employmentStatus === "leave") {
    return `<span class="status status-pending">휴직</span>`;
  }
  return `<span class="status status-active">재직</span>`;
}

function filterItems(items, keys) {
  if (!state.search) return items;
  const q = state.search.toLowerCase();
  return items.filter((item) => keys.some((key) => String(item[key] || "").toLowerCase().includes(q)));
}

function filterCompanies(companies) {
  const query = state.companySearch.query.trim().toLowerCase();
  if (!query) return companies;
  return companies.filter((company) => searchValuesForCompany(company, state.companySearch.field)
    .some((value) => String(value || "").toLowerCase().includes(query)));
}

function searchValuesForCompany(company, field) {
  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  const contactNames = contacts.map((contact) => contact.name);
  const contactPhones = contacts.map((contact) => contact.phone);
  const values = {
    name: [company.name],
    representative: [company.representative],
    manager: [company.manager, ...contactNames],
    contactPhone: [company.phone, ...contactPhones],
    businessNo: [company.businessNo],
    all: [
      company.name,
      company.businessNo,
      company.representative,
      company.manager,
      company.phone,
      company.email,
      ...contactNames,
      ...contactPhones,
      ...contacts.map((contact) => contact.email),
      ...contacts.map((contact) => contact.position)
    ]
  };
  return values[field] || values.all;
}

function filterContracts(contracts) {
  const query = state.contractSearch.query.trim().toLowerCase();
  if (!query) return contracts;
  return contracts.filter((contract) => searchValuesForContract(contract, state.contractSearch.field)
    .some((value) => String(value || "").toLowerCase().includes(query)));
}

function searchValuesForContract(contract, field) {
  const organization = contract.organizationName || organizationName(contract.organizationId);
  const values = {
    name: [contract.name],
    organization: [organization],
    manager: [contractManagerName(contract), contract.managerUserEmail],
    all: [
      contract.name,
      organization,
      contractManagerName(contract),
      contract.managerUserEmail,
      companyName(contract.companyId),
      contract.memo
    ]
  };
  return values[field] || values.all;
}

function filterEmployees(employees) {
  const query = state.employeeSearch.query.trim().toLowerCase();
  if (!query) return employees;
  return employees.filter((employee) => searchValuesForEmployee(employee, state.employeeSearch.field)
    .some((value) => String(value || "").toLowerCase().includes(query)));
}

function searchValuesForEmployee(employee, field) {
  const statusText = label("employmentStatus", employee.employmentStatus);
  const department = employee.departmentName || employee.organizationName;
  const values = {
    employeeNo: [employee.employeeNo],
    name: [employee.name],
    department: [department, employee.departmentParentName, employee.organizationName],
    position: [employee.positionName],
    status: [employee.employmentStatus, statusText],
    email: [employee.email],
    all: [
      employee.employeeNo,
      employee.name,
      employee.email,
      employee.memo,
      employee.employmentStatus,
      statusText,
      department,
      employee.departmentParentName,
      employee.organizationName,
      employee.positionName
    ]
  };
  return values[field] || values.all;
}

function filterWorklogs(logs) {
  if (!state.search) return logs;
  const q = state.search.toLowerCase();
  return logs.filter((log) => [log.title, log.content, log.worker, companyName(log.companyId)].some((value) => String(value || "").toLowerCase().includes(q)));
}

function filterDocuments(docs) {
  if (!state.search) return docs;
  const q = state.search.toLowerCase();
  return docs.filter((doc) => [doc.title, doc.fileName, doc.memo, companyName(doc.companyId)].some((value) => String(value || "").toLowerCase().includes(q)));
}

function normalizeMonthlyAmount(contract) {
  const amount = Number(contract.amount || 0);
  return Math.round(amount / 12);
}

function daysUntil(dateText) {
  if (!dateText) return 99999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDateInput(dateText);
  if (!target) return 99999;
  return Math.ceil((target - today) / 86400000);
}

function parseDateInput(dateText) {
  if (!dateText) return null;
  const target = new Date(`${String(dateText).slice(0, 10)}T00:00:00`);
  return Number.isNaN(target.getTime()) ? null : target;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDateInput(dateText) {
  if (!dateText) return "";
  const value = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(value.getTime())) return "";
  value.setDate(value.getDate() + 1);
  return toDateInput(value);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function formatNumberInput(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function downloadDocument(id) {
  const doc = state.data.documents.find((item) => item.id === id);
  if (!doc?.fileName) return;
  window.open(`/api/documents/${id}/download`, "_blank");
}

async function downloadSelectedDocuments() {
  const ids = [...document.querySelectorAll("[data-doc-select]:checked")].map((checkbox) => checkbox.dataset.docSelect);
  if (!ids.length) {
    alert("다운로드할 문서를 선택해 주세요.");
    return;
  }
  try {
    const response = await fetch("/api/documents/bulk-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `문서함_${toDateInput(new Date())}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`선택 다운로드 실패: ${error.message}`);
  }
}

function exportCsvBundle() {
  const rows = [
    ["구분", "업체", "계약명/작업명", "담당부서", "담당자", "시작일/작업일", "종료일", "금액", "상태", "비고"],
    ...state.data.contracts.map((contract) => ["계약", companyName(contract.companyId), contract.name, contract.organizationName || "", contractManagerName(contract), contract.startDate, contract.endDate, contract.amount, label("contractStatus", contract.status), `알림 ${contract.alertDays || DEFAULT_ALERT_DAYS}일`]),
    ...state.data.worklogs.map((log) => ["작업", companyName(log.companyId), log.title, "", log.worker || "", log.date, "", "", label("workStatus", log.status), log.content || ""])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `유지보수_계약관리_${toDateInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
