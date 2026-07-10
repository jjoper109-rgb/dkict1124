/*
  DK groupware approval draft helper

  Usage:
  1. Open the DK groupware proposal form page.
  2. Edit the DATA values below.
  3. Paste this whole script into the browser console and press Enter.

  The script fills the visible proposal fields and clicks "임시보관".
  It never clicks "결재상신".
*/

(() => {
  const DATA = {
    title: "",
    proposalAmount: "",
    supplyAmount: "",
    payee: "",
    body: "",
    autoSaveDraft: true,
  };

  const APPROVAL_SUBMIT_TEXT = "결재상신";
  const DRAFT_TEXT = "임시보관";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getDocuments() {
    const docs = [document];
    const visit = (doc) => {
      for (const frame of doc.querySelectorAll("iframe, frame")) {
        try {
          const child = frame.contentDocument;
          if (child && !docs.includes(child)) {
            docs.push(child);
            visit(child);
          }
        } catch (_) {
          // Cross-origin or blocked frame. Ignore it.
        }
      }
    };
    visit(document);
    return docs;
  }

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
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

  function allElements(selector) {
    return getDocuments().flatMap((doc) => Array.from(doc.querySelectorAll(selector)));
  }

  function findByText(text, selector = "a, button, input, span, div, p, td, th") {
    return allElements(selector).find((element) => {
      const visibleText = normalize(element.innerText || element.textContent || element.value || element.title);
      return visibleText === text;
    });
  }

  function findInputByNamePart(part) {
    return allElements("input, textarea").find((element) => {
      const name = element.getAttribute("name") || "";
      const id = element.id || "";
      return name.includes(part) || id.includes(part);
    });
  }

  function findInputAfterLabel(labelText) {
    for (const doc of getDocuments()) {
      const candidates = Array.from(doc.querySelectorAll("td, th, label, span, div, p"))
        .filter((element) => normalize(element.innerText || element.textContent) === labelText);

      for (const label of candidates) {
        const row = label.closest("tr");
        const scopedInput = row?.querySelector("input:not([type=hidden]), textarea");
        if (scopedInput) return scopedInput;

        let cursor = label;
        for (let i = 0; i < 8 && cursor; i += 1) {
          cursor = cursor.nextElementSibling;
          const input = cursor?.matches?.("input:not([type=hidden]), textarea")
            ? cursor
            : cursor?.querySelector?.("input:not([type=hidden]), textarea");
          if (input) return input;
        }
      }
    }
    return null;
  }

  function fillEditor(text) {
    const editors = allElements("[contenteditable='true'], body[contenteditable='true']");
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clickText(text) {
    const element = findByText(text);
    if (!element) return false;
    element.click();
    return true;
  }

  async function run() {
    const emptyFields = Object.entries(DATA)
      .filter(([key, value]) => key !== "autoSaveDraft" && !String(value || "").trim())
      .map(([key]) => key);

    if (emptyFields.length) {
      throw new Error(`DATA 값을 먼저 채워야 합니다: ${emptyFields.join(", ")}`);
    }

    const submit = findByText(APPROVAL_SUBMIT_TEXT);
    if (submit) {
      submit.dataset.dkAutomationBlocked = "true";
    }

    const title = findInputByNamePart("txtTitle") || findInputAfterLabel("제목");
    const proposalAmount = findInputAfterLabel("품의금액");
    const supplyAmount = findInputAfterLabel("공급가액");
    const payee = findInputAfterLabel("지급처");

    const missing = [];
    if (!title) missing.push("제목");
    if (!proposalAmount) missing.push("품의금액");
    if (!supplyAmount) missing.push("공급가액");
    if (!payee) missing.push("지급처");

    if (missing.length) {
      throw new Error(`입력칸을 찾지 못했습니다: ${missing.join(", ")}`);
    }

    setValue(title, DATA.title);
    setValue(proposalAmount, DATA.proposalAmount);
    setValue(supplyAmount, DATA.supplyAmount);
    setValue(payee, DATA.payee);
    fillEditor(DATA.body);

    await sleep(300);

    if (DATA.autoSaveDraft) {
      const draftClicked = clickText(DRAFT_TEXT);
      if (!draftClicked) {
        throw new Error("임시보관 버튼을 찾지 못했습니다.");
      }
    }

    console.log("[DK approval automation] completed", {
      savedDraft: DATA.autoSaveDraft,
      blockedSubmitButton: Boolean(submit),
    });
  }

  run().catch((error) => {
    console.error("[DK approval automation] failed:", error);
    alert(error.message);
  });
})();
