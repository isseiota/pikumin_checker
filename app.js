const STORAGE_KEY = "pikumin-checker-state-v1";
const TOKEN_KEY = "pikumin-checker-token";
const USER_KEY = "pikumin-checker-user";

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

const searchInput = document.getElementById("searchInput");
const colorFilter = document.getElementById("colorFilter");
const listEl = document.getElementById("pikminList");
const collectedCountEl = document.getElementById("collectedCount");
const totalCountEl = document.getElementById("totalCount");
const completionRateEl = document.getElementById("completionRate");
const progressBarEl = document.getElementById("progressBar");
const emptyStateEl = document.getElementById("emptyState");
const logoutBtn = document.getElementById("logoutBtn");
const checkAllBtn = document.getElementById("checkAllBtn");
const resetBtn = document.getElementById("resetBtn");
const itemDialog = document.getElementById("itemDialog");
const closeItemDialogBtn = document.getElementById("closeItemDialogBtn");
const itemDialogTitle = document.getElementById("itemDialogTitle");
const itemDialogNote = document.getElementById("itemDialogNote");
const itemDialogCheckboxes = document.getElementById("itemDialogCheckboxes");
const resetConfirmDialog = document.getElementById("resetConfirmDialog");
const cancelResetBtn = document.getElementById("cancelResetBtn");
const confirmResetBtn = document.getElementById("confirmResetBtn");

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

function confirmReset() {
  if (!resetConfirmDialog) {
    return Promise.resolve(window.confirm("チェック状態をリセットします。よろしいですか？"));
  }

  return new Promise((resolve) => {
    const finish = (result) => {
      cancelResetBtn?.removeEventListener("click", onCancel);
      confirmResetBtn?.removeEventListener("click", onConfirm);
      resetConfirmDialog.removeEventListener("cancel", onCancelEvent);
      resetConfirmDialog.removeEventListener("click", onOutsideClick);
      if (typeof resetConfirmDialog.close === "function") {
        resetConfirmDialog.close();
      } else {
        resetConfirmDialog.removeAttribute("open");
      }
      resolve(result);
    };

    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);
    const onCancelEvent = (event) => {
      event.preventDefault();
      finish(false);
    };
    const onOutsideClick = (event) => {
      const rect = resetConfirmDialog.getBoundingClientRect();
      const isOutside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (isOutside) {
        finish(false);
      }
    };

    cancelResetBtn?.addEventListener("click", onCancel);
    confirmResetBtn?.addEventListener("click", onConfirm);
    resetConfirmDialog.addEventListener("cancel", onCancelEvent);
    resetConfirmDialog.addEventListener("click", onOutsideClick);

    if (typeof resetConfirmDialog.showModal === "function") {
      resetConfirmDialog.showModal();
    } else {
      resetConfirmDialog.setAttribute("open", "");
    }
  });
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
    checked = await loadState();
    render();
  } catch (err) {
    // ネットワークエラーなどでサーバーに接続できない場合、
    // キャッシュされたトークンと認証情報がある場合は一度アプリを表示
    if (currentToken && currentUser) {
      try {
        await showApp();
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
  const grouped = {
    "その他": categories.filter((cat) => cat.group === "その他"),
    "神社仏閣": categories.filter((cat) => cat.group === "神社仏閣"),
    "漢字シール": categories.filter((cat) => cat.group === "漢字シール"),
    "数字シール": categories.filter((cat) => cat.group === "数字シール"),
    "ひらがなシール": categories.filter((cat) => cat.group === "ひらがなシール"),
    "カタカナシール": categories.filter((cat) => cat.group === "カタカナシール"),
    "アルファベットシール大文字": categories.filter((cat) => cat.group === "アルファベットシール大文字"),
    "アルファベットシール小文字": categories.filter((cat) => cat.group === "アルファベットシール小文字"),
    "駅": categories.filter((cat) => cat.group === "駅"),
    "橋": categories.filter((cat) => cat.group === "橋")
  };

  const groupOrder = ["その他", "神社仏閣", "数字シール", "漢字シール", "ひらがなシール", "カタカナシール", "アルファベットシール大文字", "アルファベットシール小文字", "駅", "橋"];

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

    if (groupName === "駅") {
      const yotsubashiCats = categoryList.filter((cat) => cat.items.some((item) => item.name.startsWith("四つ橋線（")));
      const midosujiCats = categoryList.filter((cat) => cat.items.some((item) => item.name.startsWith("御堂筋線（")));
      const kitaosakakyukoCats = categoryList.filter((cat) => cat.items.some((item) => item.name.startsWith("北大阪急行（")));
      const chueoCats = categoryList.filter((cat) => cat.items.some((item) => item.name.startsWith("中央線（")));
      const jrkyotoCats = categoryList.filter((cat) => cat.items.some((item) => item.name.startsWith("JR京都線（")));

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

      const yotsubashiEl = buildSubGroup("四つ橋線", yotsubashiCats);
      const midosujiEl = buildSubGroup("御堂筋線", midosujiCats);
      const kitaosakakyukoEl = buildSubGroup("北大阪急行", kitaosakakyukoCats);
      const chueoEl = buildSubGroup("中央線", chueoCats);
      const jrkyotoEl = buildSubGroup("JR京都線", jrkyotoCats);
      if (yotsubashiEl) content.appendChild(yotsubashiEl);
      if (midosujiEl) content.appendChild(midosujiEl);
      if (kitaosakakyukoEl) content.appendChild(kitaosakakyukoEl);
      if (chueoEl) content.appendChild(chueoEl);
      if (jrkyotoEl) content.appendChild(jrkyotoEl);
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

logoutBtn?.addEventListener("click", async () => {
  checked = {};
  localStorage.removeItem(STORAGE_KEY);
  clearAuthSession();
  await showAuth();
});

checkAllBtn.addEventListener("click", () => {
  for (const item of getFilteredItems()) {
    checked[item.id] = true;
  }

  saveState();
  render();
});

resetBtn.addEventListener("click", async () => {
  const shouldReset = await confirmReset();
  if (!shouldReset) {
    return;
  }

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

initializeAuth();

window.addEventListener("error", ensureVisibleScreenFallback);
window.addEventListener("unhandledrejection", ensureVisibleScreenFallback);
setTimeout(ensureVisibleScreenFallback, 1200);
