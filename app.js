const STORAGE_KEY = "aikatsu_encore_owned";
let owned = {}; // { cardId: number (0-5) }

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

    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    img.loading = "lazy";

    // 横長判定（再回転防止）
    img.onload = function() {
      if (!this.dataset.checked) {
        this.dataset.checked = "true";
        if (this.naturalWidth > this.naturalHeight) {
          this.classList.add("rotate-90");
        }
      }
    };

    // キャッシュ済み画像対応
    if (img.complete && img.naturalWidth > 0) {
      if (img.naturalWidth > img.naturalHeight) {
        img.classList.add("rotate-90");
      }
    }

    const badge = document.createElement("div");
    badge.className = `badge ${count === 0 ? "hidden" : ""}`;
    badge.textContent = count >= 5 ? "5+" : count;

    item.appendChild(img);
    item.appendChild(badge);

    item.addEventListener("click", () => {
      let next = (owned[card.id] || 0) + 1;
      if (next > 5) next = 0;
      owned[card.id] = next;
      if (next === 0) delete owned[card.id];
      saveOwned();
      render();
      updateStats();
      shareToX(); // 所持数変更後にリンク更新
    });

    grid.appendChild(item);
  });
}

function updateStats() {
  const total = CARDS.length;
  const ownedNum = Object.keys(owned).filter(id => owned[id] > 0).length;

  // 所持率を計算（小数第1位まで）
  const percentage = total > 0
    ? (ownedNum / total * 100).toFixed(1)
    : "0.0";

  document.getElementById("totalCount").textContent = total;
  document.getElementById("ownedCount").textContent = ownedNum;
  document.getElementById("ownedPercentage").textContent = percentage;
}

// ========== 共有用圧縮 ==========
function encodeState() {
  const ids = CARDS.map(c => c.id);
  const counts = ids.map(id => owned[id] || 0);
  const str = counts.join("");
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

// X投稿リンクを更新
function shareToX() {
  const state = encodeState();
  const url = location.origin + location.pathname + (location.search || "") + "#" + state;
  const text = "アイカツ！アンコール カード所持状況";
  const hashtags = "アイカツ,アイカツアンコール";

  const shareUrl =
    "https://twitter.com/intent/tweet" +
    "?text=" + encodeURIComponent(text) +
    "&url=" + encodeURIComponent(url) +
    "&hashtags=" + encodeURIComponent(hashtags);

  const btn = document.getElementById("shareBtn");
  if (btn) btn.href = shareUrl;
}

// 初期化（1つだけ）
function init() {
  loadOwned();
  applyHash();
  render();
  updateStats();
  shareToX();

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
      history.replaceState(null, "", location.pathname + location.search);
      shareToX();
    }
  });

  // 投稿ボタンクリック時に最新状態でリンク更新
  document.getElementById("shareBtn").addEventListener("click", () => {
    shareToX();
  });
}

// 起動
init();
