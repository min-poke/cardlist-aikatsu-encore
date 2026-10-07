const STORAGE_KEY = "aikatsu_encore_owned";
let owned = {}; // { cardId: number (0-3) }

// ==================== 所持データ ====================

function loadOwned() {
  try {
    owned = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    owned = {};
  }
}

function saveOwned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
}

// 所持カード数
function getOwnedCount() {
  return Object.values(owned).filter(count => count > 0).length;
}

// 所持率
function getPercentage() {
  return CARDS.length
    ? (getOwnedCount() / CARDS.length * 100).toFixed(1)
    : "0.0";
}

// ==================== カード描画 ====================

function render() {
  const activeTab = document.querySelector(".tab.active").dataset.tab;
  const grid = document.getElementById("cardGrid");
  grid.innerHTML = "";

  const list = CARDS.filter(card =>
    activeTab === "all" || card.series === activeTab
  );

  list.forEach(card => {
    const count = Math.min(owned[card.id] || 0, 3);

    const item = document.createElement("div");
    item.className = `card-item ${count === 0 ? "unowned" : ""}`;
    item.dataset.id = card.id;

    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    img.loading = "lazy";

    // 横長カードを90度回転
    const rotateIfLandscape = () => {
      if (img.naturalWidth > img.naturalHeight) {
        img.classList.add("rotate-90");
      }
    };

    img.onload = rotateIfLandscape;

    if (img.complete && img.naturalWidth > 0) {
      rotateIfLandscape();
    }

    // 所持数バッジ
    const badge = document.createElement("div");
    badge.className = `badge ${count === 0 ? "hidden" : ""}`;
    badge.textContent = count >= 3 ? "3+" : count;

    item.append(img, badge);

    // 0 → 1 → 2 → 3 → 0
    item.addEventListener("click", () => {
      const next = ((owned[card.id] || 0) + 1) % 4;

      if (next === 0) {
        delete owned[card.id];
      } else {
        owned[card.id] = next;
      }

      saveOwned();
      render();
      updateStats();
      shareToX();
    });

    grid.appendChild(item);
  });
}

// ==================== 所持率表示 ====================

function updateStats() {
  document.getElementById("totalCount").textContent = CARDS.length;
  document.getElementById("ownedCount").textContent = getOwnedCount();
  document.getElementById("ownedPercentage").textContent = getPercentage();
}

// ==================== Base64URL ====================

// Uint8Array → Base64URL
function bytesToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Base64URL → Uint8Array
function base64UrlToBytes(str) {
  const base64 = str
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);

  const binary = atob(padded);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// ==================== ハッシュ圧縮 ====================

// 0〜3を2bitずつ詰める
//
// 例:
// 0 = 00
// 1 = 01
// 2 = 10
// 3 = 11
//
// 4枚なら
// 00 01 10 11
// ↓
// 00011011
// ↓
// 1 byte
//
// さらにBase64URL化する。

function encodeState() {
  const counts = CARDS.map(card =>
    Math.min(owned[card.id] || 0, 3)
  );

  // 必要なバイト数
  const byteLength = Math.ceil(counts.length / 4);

  const bytes = new Uint8Array(byteLength);

  for (let i = 0; i < counts.length; i++) {
    const count = counts[i];

    // 1byteに4カード分を詰める
    //
    // 1枚目: bit 7-6
    // 2枚目: bit 5-4
    // 3枚目: bit 3-2
    // 4枚目: bit 1-0
    //
    const byteIndex = Math.floor(i / 4);
    const shift = 6 - (i % 4) * 2;

    bytes[byteIndex] |= count << shift;
  }

  // 新形式であることを示す "v2" を先頭につける
  return "v2" + bytesToBase64Url(bytes);
}

// ==================== ハッシュ復元 ====================

function decodeState(hash) {
  try {
    // ==========================
    // 新形式
    // ==========================
    if (hash.startsWith("v2")) {
      const encoded = hash.slice(2);
      const bytes = base64UrlToBytes(encoded);

      return CARDS.reduce((result, card, i) => {
        const byteIndex = Math.floor(i / 4);
        const shift = 6 - (i % 4) * 2;

        if (byteIndex >= bytes.length) {
          return result;
        }

        const count =
          (bytes[byteIndex] >> shift) & 0b11;

        if (count > 0) {
          result[card.id] = count;
        }

        return result;
      }, {});
    }

    // ==========================
    // 旧形式
    // ==========================
    //
    // 以前の形式:
    // btoa(counts.join(""))
    //
    // 旧ハッシュも読み込めるようにする。
    //

    const str = atob(
      hash
        .replace(/-/g, "+")
        .replace(/_/g, "/")
    );

    return CARDS.reduce((result, card, i) => {
      const count = Math.min(
        Number(str[i] || 0),
        3
      );

      if (count > 0) {
        result[card.id] = count;
      }

      return result;
    }, {});

  } catch {
    return null;
  }
}

// ==================== ハッシュ適用 ====================

function applyHash() {
  const hash = location.hash.slice(1);

  if (!hash) return;

  const decoded = decodeState(hash);

  if (decoded) {
    owned = decoded;
    saveOwned();
  }
}

// ==================== X共有 ====================

function shareToX() {
  const state = encodeState();

  const url =
    location.origin +
    location.pathname +
    location.search +
    "#" +
    state;

  const text =
    "アイカツ！アンコール カード所持率チェッカー\n" +
    `あなたのカード所持率は${getPercentage()}%でした。`;

  const shareUrl =
    "https://twitter.com/intent/tweet" +
    "?text=" + encodeURIComponent(text) +
    "&url=" + encodeURIComponent(url) +
    "&hashtags=" + encodeURIComponent(
      "アイカツ,アイカツアンコール,aikatsu,aikatsuencore"
    );

  document.getElementById("shareBtn").href = shareUrl;
}

// ==================== 初期化 ====================

function init() {
  loadOwned();
  applyHash();

  render();
  updateStats();
  shareToX();

  // タブ切り替え
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab")
        .forEach(t => t.classList.remove("active"));

      tab.classList.add("active");

      render();
    });
  });

  // すべてクリア
  document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("すべての所持数を0に戻しますか？")) return;

    owned = {};
    saveOwned();

    render();
    updateStats();

    history.replaceState(
      null,
      "",
      location.pathname + location.search
    );

    shareToX();
  });
}

init();
