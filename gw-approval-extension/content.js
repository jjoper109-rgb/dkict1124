(() => {
  const DEFAULTS = {
    employeeNo: "",
    password: "",
    autoLogin: false,
    formName: "품의서",
    title: "",
    proposalAmount: "",
    supplyAmount: "",
    payee: "",
    body: "",
    autoSaveDraft: false,
  };

  const WRITE_PAGE = "http://gw.e-dk.co.kr/Supervise/E-approval/APP_043.aspx";
  const STORAGE_FLAG = "dkApprovalAutomationRunning";
  const COMPLETED_FLAG = "dkApprovalAutomationCompleted";
  const FORM_IDS = {
    "품의서": 9,
    "품의서(물품구매)": 33,
    "품의서(자산구매)": 34,
    "품의서(자재 폐기 · 배출)": 1085,
    "품의서(자재 폐기ㆍ배출)": 1085,
    "품의서(자재 폐기·배출)": 1085,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function status(message) {
    console.log(`[DK approval automation] ${message}`);
    if (window.top !== window) return;

    let badge = document.getElementById("dk-approval-automation-status");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "dk-approval-automation-status";
      badge.style.cssText = [
        "position:fixed",
        "left:12px",
        "top:12px",
        "z-index:2147483647",
        "background:#0f766e",
        "color:white",
        "font:12px/1.4 Malgun Gothic, Arial, sans-serif",
        "padding:8px 10px",
        "border-radius:4px",
        "box-shadow:0 4px 12px rgba(0,0,0,.2)",
        "max-width:320px",
      ].join(";");
      document.documentElement.appendChild(badge);
    }
    badge.textContent = `DK 자동화: ${message}`;
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function visibleText(element) {
    return normalize(element.innerText || element.textContent || element.value || element.title);
  }

  function dispatchInput(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  function setValue(element, value) {
    element.focus();
    element.value = value;
    dispatchInput(element);
  }

  function findInputByPlaceholder(text) {
    return Array.from(document.querySelectorAll("input"))
      .find((element) => {
        const placeholder = normalize(element.placeholder);
        return placeholder === text || placeholder.includes(text);
      });
  }

  function findText(text, selector = "a, button, input, span, div, p, td, th") {
    return Array.from(document.querySelectorAll(selector))
      .find((element) => visibleText(element) === text);
  }

  function findTextLoose(text, selector = "a, button, input, span, div, p, td, th") {
    return Array.from(document.querySelectorAll(selector))
      .find((element) => {
        const value = visibleText(element);
        return value === text || value.endsWith(text) || value.includes(text);
      });
  }

  function findFormNode(text) {
    const candidates = Array.from(document.querySelectorAll("a, li, span, div"))
      .map((element) => ({
        element,
        text: visibleText(element),
      }))
      .filter((item) => {
        const value = item.text;
        if (!value.includes(text)) return false;
        if (value.length > 60) return false;
        return true;
      })
      .sort((a, b) => {
        const aTag = a.element.tagName === "A" ? 0 : 1;
        const bTag = b.element.tagName === "A" ? 0 : 1;
        if (aTag !== bTag) return aTag - bTag;
        return a.text.length - b.text.length;
      });

    return candidates.find((item) => item.text === text)?.element
      || candidates.find((item) => item.text.endsWith(text))?.element
      || candidates[0]?.element;
  }

  function findFormNodeById(formId, formName) {
    const links = Array.from(document.querySelectorAll("a[href*='fnClickNode']"));
    return links.find((element) => {
      const href = element.getAttribute("href") || "";
      return href.includes(`fnClickNode(${formId},`) && href.includes("'form'");
    }) || links.find((element) => {
      const href = element.getAttribute("href") || "";
      return href.includes(`fnClickNode(${formId}`);
    }) || findFormNode(formName);
  }

  function humanClick(element) {
    const target = clickableElement(element);
    target.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["mouseover", "mousemove", "mousedown", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
      }));
    }
  }

  function clickTreeItem(element) {
    const leaf = element.closest?.("li") || element;
    const anchor = leaf.querySelector?.("a") || element;
    const checkbox = leaf.querySelector?.(".jstree-checkbox, input[type='checkbox']");

    leaf.scrollIntoView({ block: "center", inline: "center" });
    if (checkbox) humanClick(checkbox);
    humanClick(anchor);
  }

  function debugPageState(label) {
    const links = Array.from(document.querySelectorAll("a, button, input, span, div"))
      .map((element) => ({
        text: visibleText(element).slice(0, 80),
        id: element.id || "",
        cls: String(element.className || "").slice(0, 80),
        href: element.getAttribute("href") || "",
        value: element.value || "",
      }))
      .filter((item) => /품의|확인|btnPostBack|form|APP_|jstree|기안/.test(`${item.text} ${item.id} ${item.cls} ${item.href} ${item.value}`))
      .slice(0, 30);
    console.log(`[DK approval automation] ${label}`, {
      url: location.href,
      title: document.title,
      hasFnClickNode: typeof window.fnClickNode,
      hasPostBack: typeof window.__doPostBack,
      hdnFormID: document.querySelector("#hdnFormID")?.value,
      hdnFormId: document.querySelector("#hdnFormId")?.value,
      hdnStyleID: document.querySelector("#hdnStyleID")?.value,
      selected: document.querySelector(".jstree-clicked")?.textContent,
      links,
    });
  }

  function clickableElement(element) {
    return element?.closest?.("a, button, input[type='button'], input[type='submit'], [onclick]")
      || element;
  }

  function findClickableText(text) {
    const element = findText(text) || findTextLoose(text);
    return clickableElement(element);
  }

  function pressEnter(element) {
    element.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
    }));
    element.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
    }));
  }

  function runInPage(fn, args = []) {
    const script = document.createElement("script");
    script.textContent = `try { (${fn.toString()})(...${JSON.stringify(args)}); } catch (error) { console.error("[DK approval automation page script]", error); }`;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  }

  function chooseFormInPage(formId, formName) {
    runInPage((id, name) => {
      const normalize = (text) => String(text || "").replace(/\s+/g, " ").trim();
      const anchors = Array.from(document.querySelectorAll("a"));
      const byHref = anchors.find((element) => {
        const href = element.getAttribute("href") || "";
        return href.includes(`fnClickNode(${id}`) && href.includes("'form'");
      });
      const textMatches = anchors
        .map((element) => ({
          element,
          text: normalize(element.innerText || element.textContent),
        }))
        .filter((item) => item.text.includes(name) && item.text.length <= 60)
        .sort((a, b) => a.text.length - b.text.length);
      const byText = textMatches.find((item) => item.text === name)?.element
        || textMatches.find((item) => item.text.endsWith(name))?.element
        || textMatches[0]?.element;
      const target = byHref || byText;

      if (target) {
        const leaf = target.closest("li") || target;
        const checkbox = leaf.querySelector(".jstree-checkbox, input[type='checkbox']");
        const anchor = leaf.querySelector("a") || target;
        leaf.scrollIntoView({ block: "center", inline: "center" });
        if (checkbox) checkbox.click();
        anchor.focus();
      }

      if (typeof window.fnClickNode === "function") {
        window.fnClickNode(id, false, "form", 2, 0);
      }

      if (target) {
        const leaf = target.closest("li") || target;
        const checkbox = leaf.querySelector(".jstree-checkbox, input[type='checkbox']");
        const anchor = leaf.querySelector("a") || target;
        const href = target.getAttribute("href") || "";
        if (href.toLowerCase().startsWith("javascript:")) {
          try {
            window.eval(href.replace(/^javascript:/i, ""));
          } catch (error) {
            console.error("[DK approval automation] href eval failed", error);
          }
        }

        if (checkbox) checkbox.click();
        anchor.click();
        anchor.classList.add("jstree-clicked");
        if (leaf) {
          leaf.setAttribute("aria-selected", "true");
        }
      }
    }, [formId, formName]);
  }

  function confirmFormInPage() {
    const hiddens = Array.from(document.querySelectorAll("input[type='hidden']"))
      .map((input) => ({ id: input.id, name: input.name, value: input.value }))
      .filter((input) => /form|style|node|doc|event|approval|app/i.test(`${input.id} ${input.name}`));
    console.log("[DK approval automation] confirm before", {
      selected: document.querySelector(".jstree-clicked")?.textContent,
      hiddens,
    });

    const confirm = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit'], span, div"))
      .map((element) => ({ element, text: visibleText(element) }))
      .filter((item) => item.text === "확인")
      .sort((a, b) => {
        const ar = a.element.getBoundingClientRect();
        const br = b.element.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })[0]?.element;

    if (confirm) {
      status("보이는 확인 버튼 클릭");
      humanClick(confirm);
      return;
    }

    const postBack = document.getElementById("btnPostBack");
    if (postBack) {
      status("btnPostBack 클릭");
      humanClick(postBack);
      return;
    }

    const form = document.getElementById("form1") || document.forms[0];
    const eventTarget = document.getElementById("__EVENTTARGET") || form?.querySelector("[name='__EVENTTARGET']");
    const eventArgument = document.getElementById("__EVENTARGUMENT") || form?.querySelector("[name='__EVENTARGUMENT']");

    if (form && eventTarget) {
      status("form submit 실행");
      eventTarget.value = "btnPostBack";
      if (eventArgument) eventArgument.value = "";
      form.method = form.method || "post";
      form.submit();
    }
  }

  async function waitForFormSelection(formName, timeoutMs = 2500) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const selectedText = normalize(document.querySelector(".jstree-clicked")?.textContent);
      const checkedText = Array.from(document.querySelectorAll("li[aria-selected='true'], .jstree-checked, .jstree-clicked"))
        .map((element) => normalize(element.textContent))
        .join(" ");

      if (selectedText.includes(formName) || checkedText.includes(formName) || checkedText.includes("품의서")) {
        return true;
      }
      await sleep(150);
    }
    return false;
  }

  function findInputByNamePart(part) {
    return Array.from(document.querySelectorAll("input, textarea")).find((element) => {
      const name = element.getAttribute("name") || "";
      const id = element.id || "";
      return name.includes(part) || id.includes(part);
    });
  }

  function findInputAfterLabel(labelText) {
    const labels = Array.from(document.querySelectorAll("td, th, label, span, div, p"))
      .filter((element) => {
        const text = visibleText(element);
        return text === labelText || text.includes(labelText);
      });

    for (const label of labels) {
      const row = label.closest("tr");
      const rowInput = row?.querySelector("input:not([type=hidden]), textarea");
      if (rowInput) return rowInput;

      let cursor = label;
      for (let i = 0; i < 10 && cursor; i += 1) {
        cursor = cursor.nextElementSibling;
        const input = cursor?.matches?.("input:not([type=hidden]), textarea")
          ? cursor
          : cursor?.querySelector?.("input:not([type=hidden]), textarea");
        if (input) return input;
      }
    }
    return null;
  }

  function findFormSearchInput() {
    return Array.from(document.querySelectorAll("input"))
      .find((element) => {
        const text = [
          element.placeholder,
          element.title,
          element.id,
          element.name,
          element.className,
        ].map(normalize).join(" ");
        return text.includes("양식명") || text.includes("form") || text.includes("search");
      }) || Array.from(document.querySelectorAll("input[type='text'], input:not([type])"))[0];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fillEditor(text) {
    const editors = Array.from(document.querySelectorAll("[contenteditable='true'], body[contenteditable='true']"));
    const editor = editors.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 100 && rect.height > 40;
    }) || editors[0];

    if (!editor) return false;
    editor.focus();
    editor.innerHTML = String(text)
      .split(/\r?\n/)
      .map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>")
      .join("");
    dispatchInput(editor);
    return true;
  }

  function requiredDraftValues(settings) {
    return ["formName", "title", "proposalAmount", "supplyAmount", "payee", "body"]
      .filter((key) => !String(settings[key] || "").trim());
  }

  function isLoginPage() {
    return location.pathname.toLowerCase().startsWith("/logininfo");
  }

  function isPortalPage() {
    return location.pathname.toLowerCase().startsWith("/gwindex");
  }

  function isFormSelectPage() {
    return location.pathname.toLowerCase().includes("/supervise/e-approval/app_043.aspx");
  }

  function hasWriteToolbar() {
    return Boolean(findText("임시보관") && findText("결재상신") && findInputByNamePart("txtTitle"));
  }

  async function login(settings) {
    if (!settings.autoLogin || !settings.employeeNo || !settings.password) {
      status("자동 로그인 설정이 꺼져 있거나 사번/비밀번호가 비어 있습니다.");
      return;
    }

    const inputs = Array.from(document.querySelectorAll("input"));
    const employee = document.getElementById("txtID")
      || findInputByPlaceholder("사번")
      || inputs.find((element) => {
        const type = (element.getAttribute("type") || "text").toLowerCase();
        return type === "text" || type === "";
      });
    const password = document.getElementById("txtPW")
      || findInputByPlaceholder("비밀번호")
      || document.querySelector("input[type='password']");
    const loginButton = document.getElementById("btnLogin")
      || findClickableText("로그인")
      || Array.from(document.querySelectorAll("a, button, input[type='button'], input[type='submit'], div, span"))
        .find((element) => /login/i.test(element.id || element.className || element.name || element.value || ""));
    if (!employee || !password || !loginButton) {
      status("로그인 요소를 찾지 못했습니다. Console 상세 로그를 확인하세요.");
      console.warn("[DK approval automation] 로그인 요소를 찾지 못했습니다.", {
        employee: Boolean(employee),
        password: Boolean(password),
        loginButton: Boolean(loginButton),
      });
      return;
    }

    setValue(employee, settings.employeeNo);
    setValue(password, settings.password);
    sessionStorage.setItem(STORAGE_FLAG, "1");
    status("로그인 입력 완료, 사이트 로그인 함수 실행");
    await sleep(200);
    runInPage((employeeNo, passwordValue) => {
      const id = document.getElementById("txtID");
      const pw = document.getElementById("txtPW");
      const button = document.getElementById("btnLogin");

      if (id) {
        id.value = employeeNo;
        id.dispatchEvent(new Event("input", { bubbles: true }));
        id.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (pw) {
        pw.value = passwordValue;
        pw.dispatchEvent(new Event("input", { bubbles: true }));
        pw.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (window.jQuery && button) {
        window.jQuery(button).trigger("click");
      } else if (button) {
        button.click();
      }
    }, [settings.employeeNo, settings.password]);

    await sleep(700);

    if (isLoginPage()) {
      status("로그인 클릭 후 대기 중, Enter 제출 재시도");
      clickableElement(loginButton).click();
      password.focus();
      pressEnter(password);
      const form = password.closest("form") || employee.closest("form");
      const submit = form?.querySelector?.("input[type='submit'], button[type='submit']");
      if (submit) submit.click();
    }
  }

  async function goToFormSelect() {
    const settings = await chrome.storage.local.get(DEFAULTS);
    const isArmed = settings.autoSaveDraft && !requiredDraftValues(settings).length;
    const hasCompleted = sessionStorage.getItem(COMPLETED_FLAG) === "1";

    if (isPortalPage() && !hasCompleted && (sessionStorage.getItem(STORAGE_FLAG) === "1" || isArmed)) {
      sessionStorage.setItem(STORAGE_FLAG, "1");
      status("메인 화면 확인, 품의서 양식 선택 화면으로 이동");
      await sleep(800);
      location.href = WRITE_PAGE;
    }
  }

  async function selectForm(settings) {
    if (!isFormSelectPage() || hasWriteToolbar()) return;

    debugPageState("양식 선택 전");

    const formId = FORM_IDS[settings.formName];
    if (formId) {
      const directNode = findFormNodeById(formId, settings.formName);
      if (directNode) {
        status(`양식 페이지 내부 선택: ${settings.formName}`);
        clickTreeItem(directNode);
        chooseFormInPage(formId, settings.formName);
      } else {
        status(`양식 함수 호출: ${settings.formName}`);
        chooseFormInPage(formId, settings.formName);
      }
      await sleep(1000);
      debugPageState("양식 함수 호출 후");

      if (!document.querySelector(".jstree-clicked")) {
        const node = findFormNode(settings.formName);
        if (node) {
          status(`양식 실제 클릭: ${settings.formName}`);
          clickTreeItem(node);
          await sleep(1000);
          debugPageState("양식 실제 클릭 후");
        }
      }

      const hasSelection = await waitForFormSelection(settings.formName);
      if (hasSelection) {
        status("확인 실행");
        await sleep(700);
        confirmFormInPage();
        return;
      }

      status("선택 표시 없이 확인 강제 실행");
      await sleep(700);
      confirmFormInPage();
      return;
    }

    const search = findFormSearchInput();
    if (search) {
      status(`양식 검색: ${settings.formName}`);
      setValue(search, settings.formName);
      search.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      }));
      search.dispatchEvent(new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      }));
      const searchButton = findText("검색") || findTextLoose("검색");
      if (searchButton) clickableElement(searchButton).click();
      await sleep(900);
    }

    const target = findText(settings.formName, "a, span, div, li")
      || findFormNode(settings.formName)
      || findTextLoose(settings.formName, "a, span, div, li");
    if (!target) {
      debugPageState("양식을 못 찾음");
      status(`양식을 찾지 못했습니다: ${settings.formName}`);
      return;
    }

    status(`양식 선택: ${settings.formName}`);
    clickTreeItem(target);
    await sleep(500);

    const confirm = findText("확인") || findTextLoose("확인");
    if (confirm) {
      status("확인 클릭");
      await sleep(700);
      humanClick(confirm);
      await sleep(300);
      confirmFormInPage();
    }
  }

  async function fillAndSave(settings) {
    if (!hasWriteToolbar()) return;

    const missingValues = requiredDraftValues(settings);
    if (missingValues.length) {
      status(`설정값이 비어 있어 중단: ${missingValues.join(", ")}`);
      console.warn("[DK approval automation] 설정값이 비어 있어 중단:", missingValues);
      return;
    }

    const title = findInputByNamePart("txtTitle") || findInputAfterLabel("제목");
    const proposalAmount = findInputAfterLabel("품의금액");
    const supplyAmount = findInputAfterLabel("공급가액");
    const payee = findInputAfterLabel("지급처");

    const missingInputs = [];
    if (!title) missingInputs.push("제목");
    if (!proposalAmount) missingInputs.push("품의금액");
    if (!supplyAmount) missingInputs.push("공급가액");
    if (!payee) missingInputs.push("지급처");

    if (missingInputs.length) {
      status(`입력칸을 찾지 못해 중단: ${missingInputs.join(", ")}`);
      console.warn("[DK approval automation] 입력칸을 찾지 못해 중단:", missingInputs);
      return;
    }

    status("품의서 입력 중");
    setValue(title, settings.title);
    setValue(proposalAmount, settings.proposalAmount);
    setValue(supplyAmount, settings.supplyAmount);
    setValue(payee, settings.payee);
    fillEditor(settings.body);

    await sleep(500);

    if (settings.autoSaveDraft) {
      const draft = findText("임시보관");
      if (draft) {
        status("임시보관 클릭");
        draft.click();
      }
    }

    sessionStorage.removeItem(STORAGE_FLAG);
    sessionStorage.setItem(COMPLETED_FLAG, "1");
  }

  chrome.storage.local.get(DEFAULTS, async (settings) => {
    try {
      status("확장 실행됨");
      if (isLoginPage()) {
        await login(settings);
        return;
      }

      await goToFormSelect();
      await selectForm(settings);
      await fillAndSave(settings);
    } catch (error) {
      console.error("[DK approval automation] failed", error);
    }
  });
})();
