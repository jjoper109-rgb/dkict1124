const defaults = {
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

const ids = Object.keys(defaults);

function getElement(id) {
  return document.getElementById(id);
}

async function load() {
  const saved = await chrome.storage.local.get(defaults);
  for (const id of ids) {
    const element = getElement(id);
    if (!element) continue;
    if (element.type === "checkbox") {
      element.checked = Boolean(saved[id]);
    } else {
      element.value = saved[id] || "";
    }
  }
}

async function save() {
  const values = {};
  for (const id of ids) {
    const element = getElement(id);
    if (!element) continue;
    values[id] = element.type === "checkbox" ? element.checked : element.value;
  }
  await chrome.storage.local.set(values);
  const status = getElement("status");
  status.textContent = "저장됨";
  setTimeout(() => {
    status.textContent = "";
  }, 1600);
}

document.getElementById("save").addEventListener("click", save);
load();
