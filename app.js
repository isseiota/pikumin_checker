const STORAGE_KEY = "pikumin-checker-state-v1";
const TOKEN_KEY = "pikumin-checker-token";
const USER_KEY = "pikumin-checker-user";
const CUSTOM_ITEMS_KEY = "pikumin-custom-items-v1";
const DELETED_ITEM_IDS_KEY = "pikumin-deleted-item-ids-v1";

// 認証管理
let currentToken = localStorage.getItem(TOKEN_KEY);
let currentUser = (() => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

function persistAuthSession(token, user) {
  currentToken = token;
  currentUser = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuthSession() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function showApp() {
  document.getElementById("authContainer").style.display = "none";
  document.getElementById("appContainer").style.display = "block";
}

async function showAuth() {
  document.getElementById("authContainer").style.display = "flex";
  document.getElementById("appContainer").style.display = "none";
  clearAuthSession();
}

function ensureVisibleScreenFallback() {
  const authContainer = document.getElementById("authContainer");
  const appContainer = document.getElementById("appContainer");
  if (!authContainer || !appContainer) return;

  const authHidden = getComputedStyle(authContainer).display === "none";
  const appHidden = getComputedStyle(appContainer).display === "none";

  // 何らかの初期化失敗で両画面が隠れた場合、最低限ログイン画面を表示する
  if (authHidden && appHidden) {
    authContainer.style.display = "flex";
  }
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
    persistAuthSession(data.token, data.user);
    errorEl.style.display = "none";

    document.getElementById("loginForm").reset();
    await showApp();
    checked = await loadState();
    render();
  } catch (err) {
    errorEl.textContent = "通信エラー";
    errorEl.style.display = "block";
  }
});

// 登録処理
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("registerUsername").value;
  const password = document.getElementById("registerPassword").value;
  const errorEl = document.getElementById("authError");

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
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
      persistAuthSession(loginData.token, loginData.user);
      await showApp();
      checked = await loadState();
      render();
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
  "四つ橋線（岸里）",
  "四つ橋線（難波）",
  "四つ橋線（本町）",
  "四つ橋線（西梅田）",
  "四つ橋線（肥後橋）",
  "四つ橋線（四ツ橋）",
  "四つ橋線（北加賀屋）",
  "四つ橋線（玉出）",
  "四つ橋線（大国町）",
  "四つ橋線（住之江公園）",
  "四つ橋線（花園町）",
  "御堂筋線（江坂）",
  "御堂筋線（東三国）",
  "御堂筋線（新大阪）",
  "御堂筋線（西中島南方）",
  "御堂筋線（中津）",
  "御堂筋線（梅田）",
  "御堂筋線（淀屋橋）",
  "御堂筋線（本町）",
  "御堂筋線（心斎橋）",
  "御堂筋線（なんば）",
  "御堂筋線（大国町）",
  "御堂筋線（動物園前）",
  "御堂筋線（天王寺）",
  "御堂筋線（昭和町）",
  "御堂筋線（西田辺）",
  "御堂筋線（長居）",
  "御堂筋線（あびこ）",
  "御堂筋線（北花田）",
  "御堂筋線（新金岡）",
  "御堂筋線（なかもず）",
  "北大阪急行（箕面萱野）",
  "北大阪急行（箕面船場阪大前）",
  "北大阪急行（千里中央）",
  "北大阪急行（桃山台）",
  "北大阪急行（緑地公園）",
  "北大阪急行（江坂）",
  "中央線（夢洲）",
  "中央線（コスモスクエア）",
  "中央線（大阪港）",
  "中央線（朝潮橋）",
  "中央線（弁天町）",
  "中央線（九条）",
  "中央線（阿波座）",
  "中央線（本町）",
  "中央線（堫筋本町）",
  "中央線（谷町四丁目）",
  "中央線（森ノ宮）",
  "中央線（緑橋）",
  "中央線（深江橋）",
  "中央線（高井田）",
  "中央線（長田）",
  "JR京都線（京都）",
  "JR京都線（西大路）",
  "JR京都線（桂川）",
  "JR京都線（向日町）",
  "JR京都線（長岡京）",
  "JR京都線（山崎）",
  "JR京都線（島本）",
  "JR京都線（高槻）",
  "JR京都線（摂津富田）",
  "JR京都線（ＪＲ総持寺）",
  "JR京都線（茨木）",
  "JR京都線（千里丘）",
  "JR京都線（岸辺）",
  "JR京都線（吹田）",
  "JR京都線（東淀川）",
  "JR京都線（新大阪）",
  "JR京都線（大阪）",
  "橋（天保山）",
  "橋（難波橋）",
  "橋（萬年橋）",
  "橋（北浜橋）",
  "橋（水晶橋）",
  "橋（天神橋）",
  "橋（天満橋）",
  "橋（豊後橋）",
  "橋（玉造橋）",
  "橋（桜之宮橋）",
  "橋（毛馬桜之宮橋）",
  "橋（浜寺公園橋）",
  "橋（鶴見橋）",
  "橋（京橋）",
  "橋（柴島大橋）",
  "橋（旭橋）",
  "橋（安治川橋）",
  "橋（八幡橋）",
  "橋（豊里大橋）",
  "橋（淀川大橋）",
  "橋（十三大橋）",
  "橋（神津大橋）",
  "橋（大野橋）",
  "橋（狭山橋）",
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

let customItems = [];
let deletedItemIds = new Set();

function loadCustomItems() {
  try {
    const raw = localStorage.getItem(CUSTOM_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomItems() {
  localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(customItems));
}

function loadDeletedItemIds() {
  try {
    const raw = localStorage.getItem(DELETED_ITEM_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveDeletedItemIds() {
  localStorage.setItem(DELETED_ITEM_IDS_KEY, JSON.stringify([...deletedItemIds]));
}

function getAllItems() {
  return [...PIKMIN_TYPES, ...customItems].filter((item) => !deletedItemIds.has(item.id));
}

const GROUP_PREFIX_MAP = {
  "神社仏閣": (name) => `神社仏閣（${name}）`,
  "橋": (name) => `橋（${name}）`,
  "その他": (name) => name,
};

const DEFAULT_GROUP_ORDER = [
  "その他",
  "神社仏閣",
  "数字シール",
  "漢字シール",
  "ひらがなシール",
  "カタカナシール",
  "アルファベットシール大文字",
  "アルファベットシール小文字",
  "駅",
  "橋"
];

const DEFAULT_ADDABLE_GROUPS = ["その他", "神社仏閣", "橋", "駅"];

const searchInput = document.getElementById("searchInput");
const colorFilter = document.getElementById("colorFilter");
const listEl = document.getElementById("pikminList");
const collectedCountEl = document.getElementById("collectedCount");
const totalCountEl = document.getElementById("totalCount");
const completionRateEl = document.getElementById("completionRate");
const progressBarEl = document.getElementById("progressBar");
const emptyStateEl = document.getElementById("emptyState");
const logoutBtn = document.getElementById("logoutBtn");
const addItemBtn = document.getElementById("addItemBtn");
const addItemDialog = document.getElementById("addItemDialog");
const closeAddItemDialogBtn = document.getElementById("closeAddItemDialogBtn");
const cancelAddItemBtn = document.getElementById("cancelAddItemBtn");
const confirmAddItemBtn = document.getElementById("confirmAddItemBtn");
const addItemGroup = document.getElementById("addItemGroup");
const addItemGroupNewField = document.getElementById("addItemGroupNewField");
const addItemGroupNew = document.getElementById("addItemGroupNew");
const addItemLineSelectField = document.getElementById("addItemLineSelectField");
const addItemLineSelect = document.getElementById("addItemLineSelect");
const addItemLine = document.getElementById("addItemLine");
const addItemLineField = document.getElementById("addItemLineField");
const addItemName = document.getElementById("addItemName");
const addItemNameLabel = document.getElementById("addItemNameLabel");
const addItemError = document.getElementById("addItemError");
const itemDialog = document.getElementById("itemDialog");
const closeItemDialogBtn = document.getElementById("closeItemDialogBtn");
const deleteItemBtn = document.getElementById("deleteItemBtn");
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

  return getAllItems().filter((item) => {
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
  if (item.group) {
    return item.group;
  }
  if (item.name.startsWith("四つ橋線（")) {
    return "駅";
  }
  if (item.name.startsWith("御堂筋線（")) {
    return "駅";
  }
  if (item.name.startsWith("北大阪急行（")) {
    return "駅";
  }
  if (item.name.startsWith("中央線（")) {
    return "駅";
  }
  if (item.name.startsWith("JR京都線（")) {
    return "駅";
  }
  if (item.name.startsWith("橋（")) {
    return "橋";
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

function deleteActiveCategory() {
  if (!activeCategory) {
    return;
  }

  const targetName = activeCategory.label;
  const shouldDelete = window.confirm(`「${targetName}」を削除します。よろしいですか？`);
  if (!shouldDelete) {
    return;
  }

  const targetIds = getAllItems()
    .filter((item) => item.name === targetName)
    .map((item) => item.id);

  if (targetIds.length === 0) {
    return;
  }

  const targetIdSet = new Set(targetIds);
  customItems = customItems.filter((item) => !targetIdSet.has(item.id));

  for (const id of targetIds) {
    deletedItemIds.add(id);
    delete checked[id];
  }

  saveCustomItems();
  saveDeletedItemIds();
  saveState();

  activeCategory = null;
  closeItemDialog();
  render();
}

function getPikminColorLabel(color) {
  return color.endsWith("ピクミン") ? color : `${color}ピクミン`;
}

function getOptionLabel(item, category) {
  if (category.label === "ひらがなシール" || category.label === "カタカナシール") {
    return item.name;
  }
  if (category.items.length > 1) {
    return `${getPikminColorLabel(item.color)} ${item.name}`;
  }
  return item.name;
}

async function initializeAuth() {
  if (!currentToken) {
    checked = {};
    render();
    await showAuth();
    return;
  }

  try {
    const response = await fetch("/api/me", {
      headers: getAuthHeader()
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // トークン無効：ログイン画面に遷移
        clearAuthSession();
        checked = {};
        render();
        await showAuth();
        return;
      }
      // その他のエラーの場合もトークンをクリア
      throw new Error("Session validation failed");
    }

    currentUser = await response.json();
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    await showApp();
    deletedItemIds = new Set(loadDeletedItemIds());
    customItems = loadCustomItems();
    checked = await loadState();
    render();
  } catch (err) {
    // ネットワークエラーなどでサーバーに接続できない場合、
    // キャッシュされたトークンと認証情報がある場合は一度アプリを表示
    if (currentToken && currentUser) {
      try {
        await showApp();
        deletedItemIds = new Set(loadDeletedItemIds());
        customItems = loadCustomItems();
        checked = await loadState();
        render();
        console.warn("Operating in offline mode with cached session");
        return;
      } catch {
        // キャッシュもない場合はログイン画面
      }
    }

    // 最終的にログイン画面に遷移
    clearAuthSession();
    checked = {};
    render();
    await showAuth();
  }
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
  const grouped = new Map();
  for (const category of categories) {
    if (!grouped.has(category.group)) {
      grouped.set(category.group, []);
    }
    grouped.get(category.group).push(category);
  }

  const extraGroups = [...grouped.keys()]
    .filter((group) => !DEFAULT_GROUP_ORDER.includes(group))
    .sort((a, b) => a.localeCompare(b, "ja"));
  const groupOrder = [...DEFAULT_GROUP_ORDER, ...extraGroups];

  for (const groupName of groupOrder) {
    const categoryList = grouped.get(groupName) || [];
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

    if (groupName === "駅") {
      const lineMap = new Map();
      for (const cat of categoryList) {
        const match = cat.label.match(/^(.+?)（/);
        const lineName = match ? match[1] : cat.label;
        if (!lineMap.has(lineName)) lineMap.set(lineName, []);
        lineMap.get(lineName).push(cat);
      }

      const buildSubGroup = (lineName, cats) => {
        if (cats.length === 0) return null;

        const subDetails = document.createElement("details");
        subDetails.className = "group sub-group";
        subDetails.open = query.length > 0;

        const subSummary = document.createElement("summary");

        const subLabel = document.createElement("span");
        subLabel.className = "group-label";
        subLabel.textContent = lineName;

        const subCount = document.createElement("span");
        subCount.className = "group-count";
        subCount.textContent = `${cats.length}件`;

        subSummary.append(subLabel, subCount);

        const subContent = document.createElement("div");
        subContent.className = "group-content";

        for (const category of cats) {
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

          subContent.appendChild(trigger);
        }

        subDetails.append(subSummary, subContent);
        return subDetails;
      };

      for (const [lineName, cats] of lineMap) {
        const el = buildSubGroup(lineName, cats);
        if (el) content.appendChild(el);
      }
    } else {
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
    }

    details.append(summary, content);
    listEl.appendChild(details);
  }

  emptyStateEl.hidden = filtered.length > 0;
  totalCountEl.textContent = String(getAllItems().length);
  updateStats();
}

function updateStats() {
  const allItems = getAllItems();
  const collected = allItems.reduce((sum, item) => sum + (checked[item.id] ? 1 : 0), 0);
  const total = allItems.length;
  const rate = total === 0 ? 0 : Math.round((collected / total) * 100);

  collectedCountEl.textContent = String(collected);
  completionRateEl.textContent = `${rate}%`;
  progressBarEl.style.width = `${rate}%`;
}

searchInput.addEventListener("input", render);
colorFilter.addEventListener("change", render);

logoutBtn?.addEventListener("click", async () => {
  checked = {};
  localStorage.removeItem(STORAGE_KEY);
  clearAuthSession();
  await showAuth();
});

closeItemDialogBtn.addEventListener("click", closeItemDialog);
deleteItemBtn?.addEventListener("click", deleteActiveCategory);

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

// --- カスタム項目追加 ---

function getStationLineName(name) {
  const match = typeof name === "string" ? name.match(/^(.+?)（.+）$/) : null;
  return match ? match[1] : "";
}

function getGroupOptions() {
  const groupSet = new Set(DEFAULT_ADDABLE_GROUPS);

  for (const item of getAllItems()) {
    groupSet.add(getGroupName(item));
  }

  const extras = [...groupSet]
    .filter((group) => !DEFAULT_ADDABLE_GROUPS.includes(group))
    .sort((a, b) => a.localeCompare(b, "ja"));

  return [...DEFAULT_ADDABLE_GROUPS, ...extras];
}

function buildGroupSelect() {
  if (!addItemGroup) {
    return;
  }

  const groups = getGroupOptions();
  addItemGroup.innerHTML = "";

  for (const groupName of groups) {
    const option = document.createElement("option");
    option.value = groupName;
    option.textContent = groupName;
    addItemGroup.appendChild(option);
  }

  const createOption = document.createElement("option");
  createOption.value = "__new__";
  createOption.textContent = "＋ 新規作成";
  addItemGroup.appendChild(createOption);

  addItemGroup.value = groups.includes("その他") ? "その他" : "__new__";
}

function getStationLineOptions() {
  const lineSet = new Set();

  for (const item of getAllItems()) {
    if (getGroupName(item) !== "駅") {
      continue;
    }
    const lineName = getStationLineName(item.name);
    if (lineName) {
      lineSet.add(lineName);
    }
  }

  return [...lineSet].sort((a, b) => a.localeCompare(b, "ja"));
}

function buildStationLineSelect() {
  if (!addItemLineSelect) {
    return;
  }

  const lines = getStationLineOptions();
  addItemLineSelect.innerHTML = "";

  for (const lineName of lines) {
    const option = document.createElement("option");
    option.value = lineName;
    option.textContent = lineName;
    addItemLineSelect.appendChild(option);
  }

  const createOption = document.createElement("option");
  createOption.value = "__new__";
  createOption.textContent = "＋ 新規作成";
  addItemLineSelect.appendChild(createOption);

  addItemLineSelect.value = lines.length > 0 ? lines[0] : "__new__";
}

function updateAddItemGroupUI() {
  const isNewGroup = addItemGroup.value === "__new__";
  const resolvedGroup = isNewGroup ? addItemGroupNew.value.trim() : addItemGroup.value;
  const isStation = resolvedGroup === "駅";

  addItemGroupNewField.style.display = isNewGroup ? "" : "none";
  addItemLineSelectField.style.display = isStation ? "" : "none";
  addItemLineField.style.display = isStation && addItemLineSelect?.value === "__new__" ? "" : "none";
  addItemNameLabel.textContent = isStation ? "駅名" : "項目名";
  addItemName.placeholder = isStation ? "例: テスト駅" : resolvedGroup === "橋" ? "例: テスト橋" : "例: テスト項目";
}

function openAddItemDialog() {
  buildGroupSelect();
  buildStationLineSelect();
  addItemName.value = "";
  if (addItemGroupNew) addItemGroupNew.value = "";
  if (addItemLine) addItemLine.value = "";
  addItemError.style.display = "none";
  updateAddItemGroupUI();
  if (typeof addItemDialog.showModal === "function") {
    addItemDialog.showModal();
  } else {
    addItemDialog.setAttribute("open", "");
  }
}

function closeAddItemDialog() {
  if (typeof addItemDialog.close === "function") {
    addItemDialog.close();
  } else {
    addItemDialog.removeAttribute("open");
  }
}

addItemBtn?.addEventListener("click", openAddItemDialog);
addItemGroup?.addEventListener("change", updateAddItemGroupUI);
addItemGroupNew?.addEventListener("input", updateAddItemGroupUI);
addItemLineSelect?.addEventListener("change", updateAddItemGroupUI);

closeAddItemDialogBtn?.addEventListener("click", closeAddItemDialog);
cancelAddItemBtn?.addEventListener("click", closeAddItemDialog);

addItemDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeAddItemDialog();
});

addItemDialog?.addEventListener("click", (event) => {
  const rect = addItemDialog.getBoundingClientRect();
  const isOutside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;
  if (isOutside) closeAddItemDialog();
});

confirmAddItemBtn?.addEventListener("click", () => {
  const selectedGroup = addItemGroup.value;
  const group = selectedGroup === "__new__" ? addItemGroupNew.value.trim() : selectedGroup;
  const rawName = addItemName.value.trim();

  if (!group) {
    addItemError.textContent = "カテゴリ名を入力してください。";
    addItemError.style.display = "block";
    return;
  }

  if (group === "駅") {
    const selectedLine = addItemLineSelect ? addItemLineSelect.value : "__new__";
    const rawLine = selectedLine === "__new__"
      ? (addItemLine ? addItemLine.value.trim() : "")
      : selectedLine;
    if (!rawLine) {
      addItemError.textContent = selectedLine === "__new__" ? "新規路線名を入力してください。" : "路線を選択してください。";
      addItemError.style.display = "block";
      return;
    }
    if (!rawName) {
      addItemError.textContent = "駅名を入力してください。";
      addItemError.style.display = "block";
      return;
    }
    const name = `${rawLine}（${rawName}）`;
    const duplicate = getAllItems().some((item) => item.name === name);
    if (duplicate) {
      addItemError.textContent = "同じ路線・駅名はすでに存在します。";
      addItemError.style.display = "block";
      return;
    }
    const timestamp = Date.now();
    const newItems = COLOR_OPTIONS.map((color, i) => ({
      id: `custom-${timestamp}-${i}`,
      name,
      color: color.label,
      group: "駅",
    }));
    customItems.push(...newItems);
    saveCustomItems();
    closeAddItemDialog();
    render();
    return;
  }

  if (!rawName) {
    addItemError.textContent = "項目名を入力してください。";
    addItemError.style.display = "block";
    return;
  }

  const formatName = GROUP_PREFIX_MAP[group];
  const name = formatName ? formatName(rawName) : rawName;

  const duplicate = getAllItems().some((item) => item.name === name);
  if (duplicate) {
    addItemError.textContent = "同じ項目名はすでに存在します。";
    addItemError.style.display = "block";
    return;
  }

  const timestamp = Date.now();
  const newItems = COLOR_OPTIONS.map((color, i) => ({
    id: `custom-${timestamp}-${i}`,
    name,
    color: color.label,
    ...(group !== "その他" ? { group } : {}),
  }));

  customItems.push(...newItems);
  saveCustomItems();
  closeAddItemDialog();
  render();
});

initializeAuth();

window.addEventListener("error", ensureVisibleScreenFallback);
window.addEventListener("unhandledrejection", ensureVisibleScreenFallback);
setTimeout(ensureVisibleScreenFallback, 1200);
