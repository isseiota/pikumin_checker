const STORAGE_KEY = "pikumin-checker-state-v1";
const TOKEN_KEY = "pikumin-checker-token";

// 認証管理
let currentToken = localStorage.getItem(TOKEN_KEY);
let currentUser = null;

async function showApp() {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
}

async function showAuth() {
  document.getElementById("authContainer").style.display = "flex";
  document.getElementById("appContainer").style.display = "none";
  currentToken = null;
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
}

function getAuthHeader() {
  return currentToken ? { "Authorization": `Bearer ${currentToken}` } : {};
}

// ログイン処理
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("authError");

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      const err = await res.json();
      errorEl.textContent = err.error || "ログイン失敗";
      errorEl.style.display = "block";
      return;
    }

    const data = await res.json();
    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem(TOKEN_KEY, currentToken);
    errorEl.style.display = "none";

    document.getElementById("loginForm").reset();
    showApp();
    loadState().then((state) => {
      checked = state;
      render();
    });
  } catch (err) {
    errorEl.textContent = "通信エラー";
    errorEl.style.display = "block";
  }
});

// 登録処理
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("registerUsername").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const errorEl = document.getElementById("authError");

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    if (!res.ok) {
      const err = await res.json();
      errorEl.textContent = err.error || "登録失敗";
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    document.getElementById("registerForm").reset();
    
    // 自動ログイン
    const loginRes = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (loginRes.ok) {
      const loginData = await loginRes.json();
      currentToken = loginData.token;
      currentUser = loginData.user;
      localStorage.setItem(TOKEN_KEY, currentToken);
      showApp();
      loadState().then((state) => {
        checked = state;
        render();
      });
    }
  } catch (err) {
    errorEl.textContent = "通信エラー";
    errorEl.style.display = "block";
  }
});

// フォーム切り替え
document.getElementById("toggleToRegister")?.addEventListener("click", () => {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("registerSection").style.display = "block";
  document.getElementById("authError").style.display = "none";
});

document.getElementById("toggleToLogin")?.addEventListener("click", () => {
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("registerSection").style.display = "none";
  document.getElementById("authError").style.display = "none";
});

const HIRAGANA_CHARS = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん"
];

const UPPERCASE_ALPHA_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWERCASE_ALPHA_CHARS = "abcdefghijklmnopqrstuvwxyz".split("");

const KATAKANA_CHARS = [
  "ア", "イ", "ウ", "エ", "オ",
  "カ", "キ", "ク", "ケ", "コ",
  "サ", "シ", "ス", "セ", "ソ",
  "タ", "チ", "ツ", "テ", "ト",
  "ナ", "ニ", "ヌ", "ネ", "ノ",
  "ハ", "ヒ", "フ", "ヘ", "ホ",
  "マ", "ミ", "ム", "メ", "モ",
  "ヤ", "ユ", "ヨ",
  "ラ", "リ", "ル", "レ", "ロ",
  "ワ", "ヲ", "ン"
];

const COLOR_OPTIONS = [
  { code: "red", label: "赤" },
  { code: "yellow", label: "黄" },
  { code: "blue", label: "青" },
  { code: "purple", label: "紫" },
  { code: "white", label: "白" },
  { code: "wing", label: "羽" },
  { code: "rock", label: "岩" }
];

const JOYO_KANJI_CHARS = Array.isArray(window.JOYO_KANJI_CHARS)
  ? window.JOYO_KANJI_CHARS.filter((char) => char && char !== "\uFEFF")
  : [];

const BASE_TYPE_NAMES = [
  "はっぱ（苗）",
  ...Array.from({ length: 10 }, (_, n) => `数字シール（${n}）`),
  ...JOYO_KANJI_CHARS.map((char) => `漢字シール（${char}）`),
  ...HIRAGANA_CHARS.map((char) => `ひらがなシール（${char}）`),
  ...KATAKANA_CHARS.map((char) => `カタカナシール（${char}）`),
  ...UPPERCASE_ALPHA_CHARS.map((char) => `アルファベットシール大文字（${char}）`),
  ...LOWERCASE_ALPHA_CHARS.map((char) => `アルファベットシール小文字（${char}）`),
  "森",
  "水辺",
  "レストラン",
  "カフェ",
  "スイーツ",
  "ベーカリー",
  "映画館",
  "薬局",
  "動物園",
  "空港",
  "駅",
  "海辺",
  "山",
  "学校",
  "オフィス街",
  "公園",
  "美術館",
  "音楽ホール",
  "橋",
  "バス停",
  "郵便局",
  "スーパー",
  "コンビニ",
  "ラーメン",
  "ハンバーガー",
  "ピザ",
  "すし",
  "ホテル",
  "神社仏閣（大吉）",
  "神社仏閣（吉）",
  "神社仏閣（中吉）",
  "神社仏閣（小吉）",
  "神社仏閣（末吉）",
  "祭り",
  "フラワーカード",
  "レイン"
];

const PIKMIN_TYPES = BASE_TYPE_NAMES.flatMap((name, nameIndex) =>
  COLOR_OPTIONS.map((color) => ({
    id: `type-${nameIndex}-${color.code}`,
    name,
    color: color.label
  }))
);

const searchInput = document.getElementById("searchInput");
const colorFilter = document.getElementById("colorFilter");
const listEl = document.getElementById("pikminList");
const collectedCountEl = document.getElementById("collectedCount");
const totalCountEl = document.getElementById("totalCount");
const completionRateEl = document.getElementById("completionRate");
const progressBarEl = document.getElementById("progressBar");
const emptyStateEl = document.getElementById("emptyState");
const checkAllBtn = document.getElementById("checkAllBtn");
const resetBtn = document.getElementById("resetBtn");
const itemDialog = document.getElementById("itemDialog");
const closeItemDialogBtn = document.getElementById("closeItemDialogBtn");
const itemDialogTitle = document.getElementById("itemDialogTitle");
const itemDialogNote = document.getElementById("itemDialogNote");
const itemDialogCheckboxes = document.getElementById("itemDialogCheckboxes");

let activeCategory = null;

let checked = {};

async function loadState() {
  if (!currentToken) return {};

  try {
    const res = await fetch("/api/state", {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    return typeof data === "object" && data !== null && !Array.isArray(data) ? data : {};
  } catch {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
}

async function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  
  if (!currentToken) return;

  try {
    await fetch("/api/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(checked)
    });
  } catch {
    // ネットワークエラーはサイレント
  }
}

function getFilteredItems() {
  const query = searchInput.value.trim().toLowerCase();
  const color = colorFilter.value;

  return PIKMIN_TYPES.filter((item) => {
    const matchesColor = color === "all" || item.color === color;
    const matchesQuery = !query || item.name.toLowerCase().includes(query);
    return matchesColor && matchesQuery;
  });
}

function getGroupName(item) {
  if (item.name.startsWith("漢字シール（")) {
    return "漢字シール";
  }
  if (item.name.startsWith("数字シール（")) {
    return "数字シール";
  }
  if (item.name.startsWith("ひらがなシール")) {
    return "ひらがなシール";
  }
  if (item.name.startsWith("カタカナシール")) {
    return "カタカナシール";
  }
  if (item.name.startsWith("アルファベットシール大文字（")) {
    return "アルファベットシール大文字";
  }
  if (item.name.startsWith("アルファベットシール小文字（")) {
    return "アルファベットシール小文字";
  }
  if (item.name.startsWith("神社仏閣（")) {
    return "神社仏閣";
  }
  return "その他";
}

function getCategoryLabel(item) {
  return item.name;
}

function getCategoryKey(item) {
  return `${getGroupName(item)}::${getCategoryLabel(item)}`;
}

function buildCategories(items) {
  const map = new Map();

  for (const item of items) {
    const key = getCategoryKey(item);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getCategoryLabel(item),
        group: getGroupName(item),
        items: []
      });
    }
    map.get(key).items.push(item);
  }

  return [...map.values()];
}

function openItemDialog() {
  if (typeof itemDialog.showModal === "function") {
    itemDialog.showModal();
  } else {
    itemDialog.setAttribute("open", "");
  }
}

function closeItemDialog() {
  if (typeof itemDialog.close === "function") {
    itemDialog.close();
  } else {
    itemDialog.removeAttribute("open");
  }
}

function getOptionLabel(item, category) {
  if (category.label === "ひらがなシール" || category.label === "カタカナシール") {
    return item.name;
  }
  if (category.items.length > 1) {
    return `${item.color} ${item.name}`;
  }
  return item.name;
}

function renderCategoryDialog(category) {
  itemDialogTitle.textContent = category.label;
  itemDialogNote.textContent = category.items.length > 1
    ? "この項目のバリエーションをチェックできます。"
    : "この項目のチェックを変更できます。";

  itemDialogCheckboxes.innerHTML = "";

  for (const item of category.items) {
    const row = document.createElement("label");
    row.className = "dialog-option";

    const text = document.createElement("span");
    text.textContent = getOptionLabel(item, category);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(checked[item.id]);
    checkbox.addEventListener("change", () => {
      checked[item.id] = checkbox.checked;
      saveState();
      updateStats();
      render();
      if (activeCategory) {
        const refreshed = buildCategories(getFilteredItems()).find((cat) => cat.key === activeCategory.key);
        if (refreshed) {
          activeCategory = refreshed;
          renderCategoryDialog(refreshed);
        }
      }
    });

    row.append(text, checkbox);
    itemDialogCheckboxes.appendChild(row);
  }
}

function render() {
  const filtered = getFilteredItems();
  const query = searchInput.value.trim();

  listEl.innerHTML = "";
  const categories = buildCategories(filtered);
  const grouped = {
    "その他": categories.filter((cat) => cat.group === "その他"),
    "神社仏閣": categories.filter((cat) => cat.group === "神社仏閣"),
    "漢字シール": categories.filter((cat) => cat.group === "漢字シール"),
    "数字シール": categories.filter((cat) => cat.group === "数字シール"),
    "ひらがなシール": categories.filter((cat) => cat.group === "ひらがなシール"),
    "カタカナシール": categories.filter((cat) => cat.group === "カタカナシール"),
    "アルファベットシール大文字": categories.filter((cat) => cat.group === "アルファベットシール大文字"),
    "アルファベットシール小文字": categories.filter((cat) => cat.group === "アルファベットシール小文字")
  };

  const groupOrder = ["その他", "神社仏閣", "数字シール", "漢字シール", "ひらがなシール", "カタカナシール", "アルファベットシール大文字", "アルファベットシール小文字"];

  for (const groupName of groupOrder) {
    const categoryList = grouped[groupName];
    if (categoryList.length === 0) {
      continue;
    }

    const details = document.createElement("details");
    details.className = "group";
    details.open = query.length > 0;

    const summary = document.createElement("summary");

    const label = document.createElement("span");
    label.className = "group-label";
    label.textContent = groupName;

    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = `${categoryList.length}件`;

    summary.append(label, count);

    const content = document.createElement("div");
    content.className = "group-content";

    for (const category of categoryList) {
      const selected = category.items.reduce((sum, item) => sum + (checked[item.id] ? 1 : 0), 0);

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "category-trigger";
      trigger.innerHTML = `
        <span>${category.label}</span>
        <span class="hint">${selected}/${category.items.length} チェック済み</span>
      `;
      trigger.addEventListener("click", () => {
        activeCategory = category;
        renderCategoryDialog(category);
        openItemDialog();
      });

      content.appendChild(trigger);
    }

    details.append(summary, content);
    listEl.appendChild(details);
  }

  emptyStateEl.hidden = filtered.length > 0;
  totalCountEl.textContent = String(PIKMIN_TYPES.length);
  updateStats();
}

function updateStats() {
  const collected = PIKMIN_TYPES.reduce((sum, item) => sum + (checked[item.id] ? 1 : 0), 0);
  const total = PIKMIN_TYPES.length;
  const rate = total === 0 ? 0 : Math.round((collected / total) * 100);

  collectedCountEl.textContent = String(collected);
  completionRateEl.textContent = `${rate}%`;
  progressBarEl.style.width = `${rate}%`;
}

searchInput.addEventListener("input", render);
colorFilter.addEventListener("change", render);

checkAllBtn.addEventListener("click", () => {
  for (const item of getFilteredItems()) {
    checked[item.id] = true;
  }

  saveState();
  render();
});

resetBtn.addEventListener("click", async () => {
  checked = {};
  localStorage.removeItem(STORAGE_KEY);
  await saveState();
  render();
});

closeItemDialogBtn.addEventListener("click", closeItemDialog);

itemDialog.addEventListener("click", (event) => {
  const rect = itemDialog.getBoundingClientRect();
  const isOutside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;
  if (isOutside) {
    closeItemDialog();
  }
});

itemDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeItemDialog();
});

loadState().then((state) => {
  checked = state;
  render();
});

// 初期化：ログイン状態をチェック
if (currentToken) {
  showApp();
} else {
  showAuth();
}
