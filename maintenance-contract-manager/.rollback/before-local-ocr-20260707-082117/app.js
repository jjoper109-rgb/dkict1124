const DEFAULT_ALERT_DAYS = 60;

const state = {
  view: "dashboard",
  search: "",
  selectedCompanyId: null,
  selectedTab: "basic",
  contractListMode: "all",
  modal: null,
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
  stats: "통계"
};

const companyFields = [
  ["name", "업체명", "text", true],
  ["businessNo", "사업자번호", "text"],
  ["address", "주소", "text"],
  ["manager", "담당자", "text"],
  ["phone", "연락처", "text"],
  ["email", "이메일", "email"],
  ["memo", "비고", "textarea"]
];

const contractFields = [
  ["companyId", "업체", "company", true],
  ["name", "계약명", "text", true],
  ["startDate", "계약 시작일", "date", true],
  ["endDate", "계약 종료일", "date", true],
  ["amount", "계약 금액", "number"],
  ["billingCycle", "청구 주기", "billing"],
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
  ["category", "문서 구분", "docCategory"],
  ["title", "문서명", "text", true],
  ["file", "파일", "file"],
  ["memo", "비고", "textarea"]
];

document.addEventListener("DOMContentLoaded", async () => {
  bindChrome();
  await loadServerData();
  render();
});

function bindChrome() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      if (state.view === "contracts") state.contractListMode = "all";
      state.selectedCompanyId = null;
      render();
    });
  });

  document.getElementById("globalSearch").addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderView();
  });

  document.getElementById("quickAddBtn").addEventListener("click", () => openModal("company"));
  document.getElementById("exportBtn").addEventListener("click", exportCsvBundle);
  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") event.preventDefault();
  });
  document.getElementById("modalForm").addEventListener("submit", saveModal);
  document.getElementById("deleteBtn").addEventListener("click", deleteModalItem);
}

function emptyData() {
  return {
    companies: [],
    contracts: [],
    assets: [],
    worklogs: [],
    documents: []
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
      documents: data.documents || []
    };
    state.config = data.config || state.config;
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
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response.json();
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  document.getElementById("viewTitle").textContent = state.selectedCompanyId ? "업체 상세" : viewTitles[state.view];
  renderView();
}

function renderView() {
  const view = document.getElementById("view");
  const renderers = {
    dashboard: renderDashboard,
    companies: renderCompanies,
    contracts: renderContracts,
    worklogs: renderWorklogs,
    schedule: renderSchedule,
    documents: renderDocuments,
    stats: renderStats
  };
  view.innerHTML = state.selectedCompanyId ? renderCompanyDetail() : renderers[state.view]();
  bindViewEvents();
}

function renderDashboard() {
  const upcoming = getUpcomingContracts();
  const openLogs = state.data.worklogs.filter((log) => log.status !== "done");
  const activeContracts = state.data.contracts.filter((contract) => contract.status === "active");
  const monthlyRevenue = state.data.contracts
    .filter((contract) => contract.status === "active")
    .reduce((sum, contract) => sum + normalizeMonthlyAmount(contract), 0);
  const recentLogs = [...state.data.worklogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return `
    <div class="grid stats-grid">
      ${statCard("유지보수 계약 업체", activeContracts.length, { action: "active-contracts" })}
      ${statCard("만료 예정", upcoming.length)}
      ${statCard("월 환산 금액", formatMoney(monthlyRevenue))}
    </div>
    <div class="grid two-col" style="margin-top:16px">
      <section class="panel">
        <div class="panel-header">
          <h2>계약 만료 예정</h2>
          <button class="ghost-button" data-go="schedule">전체 보기</button>
        </div>
        ${renderContractTable(upcoming.slice(0, 6), true)}
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>미처리 유지보수</h2>
          <span class="tag">${openLogs.length}건</span>
        </div>
        ${renderMiniWorklogs(openLogs.slice(0, 5))}
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>최근 작업 이력</h2>
          <button class="ghost-button" data-go="worklogs">등록/보기</button>
        </div>
        ${renderMiniWorklogs(recentLogs)}
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>업체별 계약 금액</h2>
        </div>
        ${renderRevenueList()}
      </section>
    </div>
  `;
}

function renderCompanies() {
  const companies = filterItems(state.data.companies, ["name", "businessNo", "manager", "phone", "email"]);
  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">총 ${companies.length}개 업체</span></div>
      <div class="toolbar-right"><button class="primary-button" data-add="company"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>업체 등록</button></div>
    </div>
    ${companies.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>업체명</th><th>담당자</th><th>연락처</th><th>계약</th><th>작업 이력</th><th></th></tr></thead>
          <tbody>
            ${companies.map((company) => `
              <tr>
                <td><strong>${escapeHtml(company.name)}</strong><br><span class="muted">${escapeHtml(company.businessNo || "-")}</span></td>
                <td>${escapeHtml(company.manager || "-")}</td>
                <td>${escapeHtml(company.phone || "-")}</td>
                <td>${state.data.contracts.filter((item) => item.companyId === company.id).length}</td>
                <td>${state.data.worklogs.filter((item) => item.companyId === company.id).length}</td>
                <td class="inline-actions">
                  <button class="row-action" data-detail-company="${company.id}">상세</button>
                  <button class="row-action" data-edit="company" data-id="${company.id}">수정</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>` : empty("등록된 업체가 없습니다.")}
  `;
}

function renderContracts() {
  const sourceContracts = state.contractListMode === "active"
    ? state.data.contracts.filter((contract) => contract.status === "active")
    : state.data.contracts;
  const contracts = filterContracts(sourceContracts);
  const listTitle = state.contractListMode === "active" ? "유지중인 계약 목록" : "전체 계약 목록";
  return `
    <div class="toolbar">
      <div class="toolbar-left"><strong>${listTitle}</strong><span class="muted">기본 만료 알림은 ${DEFAULT_ALERT_DAYS}일 전이며 계약별 변경이 가능합니다.</span></div>
      <div class="toolbar-right">
        ${state.contractListMode === "active" ? `<button class="ghost-button" data-contract-mode="all">전체 계약 보기</button>` : ""}
        <button class="primary-button" data-add="contract"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>계약 등록</button>
      </div>
    </div>
    ${renderContractTable(contracts, false)}
  `;
}

function renderWorklogs() {
  const logs = filterWorklogs(state.data.worklogs);
  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">방문, 원격, 장애, 부품 교체, 정기점검 이력을 기록합니다.</span></div>
      <div class="toolbar-right"><button class="primary-button" data-add="worklog"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>작업 등록</button></div>
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
                <td><button class="row-action" data-edit="worklog" data-id="${log.id}">수정</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>` : empty("등록된 작업 이력이 없습니다.")}
  `;
}

function renderSchedule() {
  const upcoming = getUpcomingContracts();
  const overdue = state.data.contracts.filter((contract) => daysUntil(contract.endDate) < 0 && contract.status !== "closed");
  const openLogs = state.data.worklogs.filter((log) => log.status !== "done");
  return `
    <div class="grid stats-grid">
      ${statCard("기본 알림", `${DEFAULT_ALERT_DAYS}일 전`)}
      ${statCard("만료 예정", upcoming.length)}
      ${statCard("이미 만료", overdue.length)}
      ${statCard("미처리 요청", openLogs.length)}
    </div>
    <section class="panel" style="margin-top:16px">
      <div class="panel-header">
        <h2>계약 만료 알림</h2>
        <button class="primary-button" data-add="contract"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>계약 등록</button>
      </div>
      ${renderContractTable([...overdue, ...upcoming], true)}
    </section>
    <section class="panel" style="margin-top:16px">
      <div class="panel-header"><h2>미처리 요청</h2></div>
      ${renderMiniWorklogs(openLogs)}
    </section>
  `;
}

function renderDocuments() {
  const docs = filterDocuments(state.data.documents);
  return `
    <div class="toolbar">
      <div class="toolbar-left"><span class="muted">계약서, 견적서, 사업자등록증, 점검보고서, 사진을 보관합니다.</span></div>
      <div class="toolbar-right"><button class="primary-button" data-add="document"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>문서 등록</button></div>
    </div>
    ${docs.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>문서명</th><th>업체</th><th>구분</th><th>파일</th><th>등록일</th><th></th></tr></thead>
          <tbody>
            ${docs.map((doc) => `
              <tr>
                <td><strong>${escapeHtml(doc.title)}</strong><br><span class="muted">${escapeHtml(doc.memo || "")}</span></td>
                <td>${escapeHtml(companyName(doc.companyId))}</td>
                <td>${label("docCategory", doc.category)}</td>
                <td>${doc.fileName ? `<button class="row-action" data-download-doc="${doc.id}">${escapeHtml(doc.fileName)}</button>` : "-"}</td>
                <td>${formatDate(doc.createdAt)}</td>
                <td><button class="row-action" data-edit="document" data-id="${doc.id}">수정</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>` : empty("등록된 문서가 없습니다.")}
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
          <p class="muted">${escapeHtml(company.address || "주소 미등록")} · ${escapeHtml(company.manager || "담당자 미등록")}</p>
        </div>
        <div class="inline-actions">
          <button class="ghost-button" data-back-companies>목록</button>
          <button class="primary-button" data-edit="company" data-id="${company.id}">업체 수정</button>
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
          <tr><th>담당자</th><td>${escapeHtml(company.manager || "-")}</td></tr>
          <tr><th>연락처</th><td>${escapeHtml(company.phone || "-")}</td></tr>
          <tr><th>이메일</th><td>${escapeHtml(company.email || "-")}</td></tr>
          <tr><th>주소</th><td>${escapeHtml(company.address || "-")}</td></tr>
        </tbody></table>
      </div>
    `;
  }
  if (state.selectedTab === "contracts") {
    return `<div class="toolbar"><span></span><button class="primary-button" data-add="contract" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>계약 등록</button></div>${renderContractTable(state.data.contracts.filter((item) => item.companyId === company.id), false)}`;
  }
  if (state.selectedTab === "assets") {
    const assets = state.data.assets.filter((item) => item.companyId === company.id);
    return `<div class="toolbar"><span></span><button class="primary-button" data-add="asset" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>대상 등록</button></div>${renderAssetCards(assets)}`;
  }
  if (state.selectedTab === "worklogs") {
    const logs = state.data.worklogs.filter((item) => item.companyId === company.id);
    return `<div class="toolbar"><span></span><button class="primary-button" data-add="worklog" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>작업 등록</button></div>${renderMiniWorklogs(logs)}`;
  }
  if (state.selectedTab === "documents") {
    const docs = state.data.documents.filter((item) => item.companyId === company.id);
    return `<div class="toolbar"><span></span><button class="primary-button" data-add="document" data-company="${company.id}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>문서 등록</button></div>${renderDocumentCards(docs)}`;
  }
  return `<div class="item-card"><h3>메모</h3><p>${escapeHtml(company.memo || "등록된 메모가 없습니다.")}</p></div>`;
}

function bindViewEvents() {
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
        state.selectedCompanyId = null;
        render();
      }
    });
  });
  document.querySelectorAll("[data-contract-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.contractListMode = button.dataset.contractMode;
      renderView();
    });
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.add, null, button.dataset.company));
  });
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.edit, button.dataset.id));
  });
  document.querySelectorAll("[data-detail-company]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCompanyId = button.dataset.detailCompany;
      state.selectedTab = "basic";
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
}

function openModal(type, id = null, companyId = null) {
  const collection = collectionFor(type);
  const item = id ? state.data[collection].find((entry) => entry.id === id) : null;
  const defaults = defaultItem(type, companyId || state.selectedCompanyId);
  state.modal = { type, id };
  document.getElementById("modalTitle").textContent = `${modalName(type)} ${id ? "수정" : "등록"}`;
  document.getElementById("modalBody").innerHTML = renderForm(type, item || defaults);
  document.getElementById("deleteBtn").style.display = id ? "inline-flex" : "none";
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
  bindCompanySearchFields();
  if (type === "contract") bindContractRenewalAuto();
}

function closeModal() {
  state.modal = null;
  document.getElementById("modalBackdrop").classList.add("hidden");
  document.getElementById("modalForm").reset();
}

async function saveModal(event) {
  event.preventDefault();
  const { type, id } = state.modal;
  const collection = collectionFor(type);
  const fields = fieldsFor(type);
  const formData = new FormData(event.target);
  const item = id ? { ...state.data[collection].find((entry) => String(entry.id) === String(id)) } : {};

  fields.forEach(([key, , inputType]) => {
    if (inputType === "checkbox") {
      item[key] = formData.get(key) === "on";
    } else if (inputType === "number") {
      item[key] = Number(formData.get(key) || 0);
    } else if (inputType !== "file") {
      item[key] = String(formData.get(key) || "").trim();
    }
  });

  if (type === "contract") {
    item.alertDays = Number.isFinite(item.alertDays) && item.alertDays > 0 ? item.alertDays : DEFAULT_ALERT_DAYS;
    item.autoAlert = item.autoAlert !== false;
  }

  try {
    if (type === "document") {
      const documentForm = new FormData();
      documentForm.append("companyId", item.companyId || "");
      documentForm.append("contractId", item.contractId || "");
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
    alert(`저장 실패: ${error.message}`);
  }
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

function renderForm(type, item) {
  return `<div class="form-grid">${fieldsFor(type).map(([key, labelText, inputType, required]) => renderField(key, labelText, inputType, item, required)).join("")}</div>`;
}

function bindCompanySearchFields() {
  document.querySelectorAll("[data-company-search-for]").forEach((input) => {
    const select = document.getElementById(input.dataset.companySearchFor);
    const result = document.querySelector(`[data-company-search-result-for="${input.dataset.companySearchFor}"]`);
    if (!select) return;

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      let visibleCount = 0;
      let lastVisibleValue = "";

      [...select.options].forEach((option) => {
        const name = (option.dataset.companyName || option.textContent || "").toLowerCase();
        const visible = !query || name.includes(query);
        option.hidden = !visible;
        option.disabled = !visible;
        if (visible) {
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
        result.textContent = query ? `검색 결과 ${visibleCount}개` : `총 ${state.data.companies.length}개 업체`;
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

function renderField(key, labelText, inputType, item, required) {
  const value = item[key] ?? "";
  const req = required ? "required" : "";
  const wide = inputType === "textarea" || inputType === "file" ? "field-wide" : "field";
  const base = `<label for="${key}">${labelText}</label>`;
  if (inputType === "textarea") {
    return `<div class="${wide}">${base}<textarea id="${key}" name="${key}" ${req}>${escapeHtml(value)}</textarea></div>`;
  }
  if (inputType === "company") {
    return `<div class="${wide}">${base}<input class="company-search-input" type="search" placeholder="업체명 검색" data-company-search-for="${key}" autocomplete="off"><select id="${key}" name="${key}" ${req}>${state.data.companies.map((company) => `<option value="${company.id}" data-company-name="${escapeHtml(company.name)}" ${value === company.id ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}</select><span class="muted company-search-result" data-company-search-result-for="${key}">총 ${state.data.companies.length}개 업체</span></div>`;
  }
  if (inputType === "contract") {
    return `<div class="${wide}">${base}<select id="${key}" name="${key}"><option value="">선택 안 함</option>${state.data.contracts.map((contract) => `<option value="${contract.id}" ${value === contract.id ? "selected" : ""}>${escapeHtml(contract.name)} (${escapeHtml(companyName(contract.companyId))})</option>`).join("")}</select></div>`;
  }
  if (inputType === "billing" || inputType === "contractStatus" || inputType === "assetType" || inputType === "workCategory" || inputType === "workStatus" || inputType === "docCategory") {
    return `<div class="${wide}">${base}<select id="${key}" name="${key}" ${req}>${options(inputType).map(([id, name]) => `<option value="${id}" ${value === id ? "selected" : ""}>${name}</option>`).join("")}</select></div>`;
  }
  if (inputType === "checkbox") {
    return `<div class="${wide}">${base}<label class="mini-row" style="justify-content:flex-start"><input type="checkbox" name="${key}" ${value ? "checked" : ""} style="width:auto"> 사용</label></div>`;
  }
  if (inputType === "file") {
    return `<div class="${wide}">${base}<input id="${key}" name="${key}" type="file"><span class="muted">${item.fileName ? `현재 파일: ${escapeHtml(item.fileName)}` : "2MB 이하 파일 첨부 가능"}</span></div>`;
  }
  return `<div class="${wide}">${base}<input id="${key}" name="${key}" type="${inputType}" value="${escapeHtml(value)}" ${req}></div>`;
}

function renderContractTable(contracts, showAlert) {
  const sorted = [...contracts].sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate));
  if (!sorted.length) return empty("표시할 계약이 없습니다.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>계약명</th><th>업체</th><th>기간</th><th>금액</th><th>상태</th>${showAlert ? "<th>알림</th>" : ""}<th></th></tr></thead>
        <tbody>
          ${sorted.map((contract) => `
            <tr>
              <td><strong>${escapeHtml(contract.name)}</strong><br><span class="muted">알림 기준 ${contract.alertDays || DEFAULT_ALERT_DAYS}일 전</span></td>
              <td>${escapeHtml(companyName(contract.companyId))}</td>
              <td>${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}</td>
              <td>${formatMoney(contract.amount)} / ${label("billing", contract.billingCycle)}</td>
              <td>${contractStatusBadge(contract)}</td>
              ${showAlert ? `<td>${alertText(contract)}</td>` : ""}
              <td><button class="row-action" data-edit="contract" data-id="${contract.id}">수정</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
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

function renderAssetCards(assets) {
  if (!assets.length) return empty("등록된 유지보수 대상이 없습니다.");
  return `<div class="grid">${assets.map((asset) => `
    <article class="item-card">
      <h3>${escapeHtml(asset.name)} <span class="tag">${label("assetType", asset.type)}</span></h3>
      <p class="muted">${escapeHtml(asset.location || "위치 미등록")} · ${escapeHtml(asset.serial || "관리번호 없음")}</p>
      <button class="row-action" data-edit="asset" data-id="${asset.id}">수정</button>
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
        <button class="row-action" data-edit="document" data-id="${doc.id}">수정</button>
      </div>
    </article>
  `).join("")}</div>`;
}

function renderRevenueList() {
  const rows = state.data.companies.map((company) => ({
    name: company.name,
    value: state.data.contracts.filter((contract) => contract.companyId === company.id).reduce((sum, contract) => sum + normalizeMonthlyAmount(contract), 0)
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

function defaultItem(type, companyId) {
  const today = toDateInput(new Date());
  const defaults = {
    company: {},
    contract: { companyId: companyId || state.data.companies[0]?.id || "", startDate: today, endDate: today, renewalDate: nextDateInput(today), billingCycle: "yearly", status: "active", alertDays: DEFAULT_ALERT_DAYS, autoAlert: true },
    asset: { companyId: companyId || state.data.companies[0]?.id || "", type: "equipment" },
    worklog: { companyId: companyId || state.data.companies[0]?.id || "", date: today, category: "visit", status: "done" },
    document: { companyId: companyId || state.data.companies[0]?.id || "", category: "contract" }
  };
  return defaults[type] || {};
}

function fieldsFor(type) {
  return { company: companyFields, contract: contractFields, asset: assetFields, worklog: worklogFields, document: documentFields }[type];
}

function collectionFor(type) {
  return { company: "companies", contract: "contracts", asset: "assets", worklog: "worklogs", document: "documents" }[type];
}

function apiPath(type) {
  return { company: "/api/companies", contract: "/api/contracts", asset: "/api/assets", worklog: "/api/worklogs", document: "/api/documents" }[type];
}

function modalName(type) {
  return { company: "업체", contract: "계약", asset: "유지보수 대상", worklog: "작업 이력", document: "문서" }[type];
}

function options(type) {
  const maps = {
    billing: [["monthly", "월"], ["yearly", "연"], ["once", "일시불"]],
    contractStatus: [["active", "진행"], ["pending", "검토"], ["expired", "만료"], ["closed", "종료"]],
    assetType: [["equipment", "장비"], ["program", "프로그램"], ["server", "서버"], ["network", "네트워크"], ["printer", "프린터"], ["cctv", "CCTV"], ["security", "보안장비"]],
    workCategory: [["visit", "방문 점검"], ["remote", "원격지원"], ["incident", "장애 처리"], ["part", "부품 교체"], ["regular", "정기점검"]],
    workStatus: [["open", "접수"], ["progress", "처리중"], ["done", "완료"], ["hold", "보류"]],
    docCategory: [["contract", "계약서"], ["estimate", "견적서"], ["license", "사업자등록증"], ["report", "점검보고서"], ["photo", "사진"], ["other", "기타"]]
  };
  return maps[type] || [];
}

function label(type, value) {
  return options(type).find(([id]) => id === value)?.[1] || value || "-";
}

function companyName(id) {
  return state.data.companies.find((company) => company.id === id)?.name || "업체 미지정";
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

function filterItems(items, keys) {
  if (!state.search) return items;
  const q = state.search.toLowerCase();
  return items.filter((item) => keys.some((key) => String(item[key] || "").toLowerCase().includes(q)));
}

function filterContracts(contracts) {
  if (!state.search) return contracts;
  const q = state.search.toLowerCase();
  return contracts.filter((contract) => [contract.name, companyName(contract.companyId), contract.memo].some((value) => String(value || "").toLowerCase().includes(q)));
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
  if (contract.billingCycle === "yearly") return Math.round(amount / 12);
  if (contract.billingCycle === "once") return 0;
  return amount;
}

function daysUntil(dateText) {
  if (!dateText) return 99999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateText}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
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

function exportCsvBundle() {
  const rows = [
    ["구분", "업체", "계약명/작업명", "시작일/작업일", "종료일", "금액", "상태", "비고"],
    ...state.data.contracts.map((contract) => ["계약", companyName(contract.companyId), contract.name, contract.startDate, contract.endDate, contract.amount, label("contractStatus", contract.status), `알림 ${contract.alertDays || DEFAULT_ALERT_DAYS}일`]),
    ...state.data.worklogs.map((log) => ["작업", companyName(log.companyId), log.title, log.date, "", "", label("workStatus", log.status), log.content || ""])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `유지보수_계약관리_${toDateInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
