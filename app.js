const STORAGE_KEY = "aikatsu_encore_owned";
let owned = {}; // { cardId: number (0-5) }

// 初期化
function init() {
  loadOwned();
  applyHash();          // URLハッシュから復元
  render();
  updateStats();

  // タブ切り替え
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      render();
    });
  });

  // クリア
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("すべての所持数を0に戻しますか？")) {
      owned = {};
      saveOwned();
      render();
      updateStats();
      history.replaceState(null, "", location.pathname);
    }
  });

  // X投稿
  document.getElementById("shareBtn").addEventListener("click", shareToX);
}

// 所持データ読み込み
function loadOwned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    owned = raw ? JSON.parse(raw) : {};
  } catch (e) {
    owned = {};
  }
}

function saveOwned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
}

// カード描画
function render() {
  const activeTab = document.querySelector(".tab.active").dataset.tab;
  const grid = document.getElementById("cardGrid");
  grid.innerHTML = "";

  const list = CARDS.filter(c => {
    if (activeTab === "all") return true;
    return c.series === activeTab;
  });

  list.forEach(card => {
    const count = owned[card.id] || 0;
    const item = document.createElement("div");
    item.className = `card-item ${count === 0 ? "unowned" : ""}`;
    item.dataset.id = card.id;

    item.innerHTML = `
      <img src="${card.image}" alt="${card.name}" loading="lazy">
      <div class="badge ${count === 0 ? "hidden" : ""}">${count >= 5 ? "5+" : count}</div>
    `;

    item.addEventListener("click", () => {
      let next = (owned[card.id] || 0) + 1;
      if (next > 5) next = 0;
      owned[card.id] = next;
      if (next === 0) delete owned[card.id];
      saveOwned();
      render();
      updateStats();
    });

    grid.appendChild(item);
  });
}

function updateStats() {
  const total = CARDS.length;
  const ownedNum = Object.keys(owned).filter(id => owned[id] > 0).length;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("ownedCount").textContent = ownedNum;
}

// ========== 共有用圧縮 ==========
// 所持状態を短く圧縮してハッシュにする
function encodeState() {
  // カードID順に所持数を並べる（0-5）
  const ids = CARDS.map(c => c.id);
  const counts = ids.map(id => owned[id] || 0);
  
  // 6進数っぽく圧縮（0-5なので1文字で表現可能）
  // さらにBase64風に短縮
  let str = counts.join("");
  // 簡易圧縮：連続する0を短縮などしても良いが、まずはシンプルに
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeState(hash) {
  try {
    const str = atob(hash.replace(/-/g, "+").replace(/_/g, "/"));
    const counts = str.split("").map(Number);
    const newOwned = {};
    CARDS.forEach((card, i) => {
      if (counts[i] > 0) newOwned[card.id] = counts[i];
    });
    return newOwned;
  } catch (e) {
    return null;
  }
}

function applyHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const decoded = decodeState(hash);
  if (decoded) {
    owned = decoded;
    saveOwned();
  }
}

// X投稿
function shareToX() {
  const state = encodeState();
  const url = location.origin + location.pathname + "#" + state;
  const text = `アイカツ！アンコール カード所持状況\n${url}\n#アイカツ #アイカツアンコール`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(shareUrl, "_blank");
}

// 起動
init();