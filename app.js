const STORAGE_KEY = "aikatsu_encore_owned";

let owned = {}; // { cardId: number (0-3) }


// ============================================================
// 所持データ
// ============================================================

function loadOwned() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!saved || typeof saved !== "object") {
      owned = {};
      return;
    }

    // 0〜3以外の値を除外
    owned = {};

    for (const [id, count] of Object.entries(saved)) {
      const value = Number(count);

      if (
        value >= 1 &&
        value <= 3 &&
        Number.isInteger(value)
      ) {
        owned[id] = value;
      }
    }
  } catch {
    owned = {};
  }
}


function saveOwned() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(owned)
  );
}


// ============================================================
// 所持カード数
// ============================================================

function getOwnedCount() {
  return Object.values(owned)
    .filter(count => count > 0)
    .length;
}


// ============================================================
// 所持率
// ============================================================

function getPercentage() {
  return CARDS.length
    ? (getOwnedCount() / CARDS.length * 100).toFixed(1)
    : "0.0";
}


// ============================================================
// カード描画
// ============================================================

function render() {
  const activeTab =
    document.querySelector(".tab.active").dataset.tab;

  const grid =
    document.getElementById("cardGrid");

  grid.innerHTML = "";

  const list = CARDS.filter(card =>
    activeTab === "all" ||
    card.series === activeTab
  );

  list.forEach(card => {
    const count = owned[card.id] || 0;

    const item = document.createElement("div");

    item.className =
      `card-item ${count === 0 ? "unowned" : ""}`;

    item.dataset.id = card.id;


    // ----------------------------------------
    // 画像
    // ----------------------------------------

    const img = document.createElement("img");

    img.src = card.image;
    img.alt = card.name;
    img.loading = "lazy";


    // 横長カードを90度回転
    const rotateIfLandscape = () => {
      if (
        img.naturalWidth > img.naturalHeight
      ) {
        img.classList.add("rotate-90");
      }
    };

    img.onload = rotateIfLandscape;

    if (
      img.complete &&
      img.naturalWidth > 0
    ) {
      rotateIfLandscape();
    }


    // ----------------------------------------
    // 所持数バッジ
    // ----------------------------------------

    const badge = document.createElement("div");

    badge.className =
      `badge ${count === 0 ? "hidden" : ""}`;

    badge.textContent =
      count >= 3 ? "3+" : count;


    item.append(img, badge);


    // ----------------------------------------
    // クリックで
    //
    // 0 → 1 → 2 → 3 → 0
    // ----------------------------------------

    item.addEventListener("click", () => {
      const current =
        owned[card.id] || 0;

      const next =
        (current + 1) % 4;

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


// ============================================================
// 所持率表示
// ============================================================

function updateStats() {
  document.getElementById("totalCount")
    .textContent = CARDS.length;

  document.getElementById("ownedCount")
    .textContent = getOwnedCount();

  document.getElementById("ownedPercentage")
    .textContent = getPercentage();
}


// ============================================================
// 共有URL用データ
//
// 1カード = 2bit
//
// 00 = 0枚
// 01 = 1枚
// 10 = 2枚
// 11 = 3枚
//
// 4カード = 8bit = 1byte
//
// 例：
//
// card 0 = 1
// card 1 = 2
// card 2 = 3
// card 3 = 0
//
//   01 10 11 00
//
// → 01101100
// → 0x6C
// ============================================================


// ------------------------------------------------------------
// Base64URL
// ------------------------------------------------------------

function bytesToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlToBytes(str) {
  try {
    const base64 =
      str
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    // Base64の長さを4の倍数に戻す
    const padded =
      base64 +
      "=".repeat(
        (4 - base64.length % 4) % 4
      );

    const binary = atob(padded);

    const bytes =
      new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] =
        binary.charCodeAt(i);
    }

    return bytes;
  } catch {
    return null;
  }
}


// ============================================================
// 所持データ → 圧縮データ
// ============================================================

function encodeState() {
  /*
   * 末尾の0カードを削除することで
   * URLを短くする。
   *
   * 例えば
   *
   * [1, 0, 2, 0, 0, 0, 0, 0]
   *
   * なら最後の0を全部省略して
   *
   * [1, 0, 2]
   *
   * として扱う。
   */

  let lastIndex = -1;

  for (let i = CARDS.length - 1; i >= 0; i--) {
    if (owned[CARDS[i].id] > 0) {
      lastIndex = i;
      break;
    }
  }


  // 何も所持していない
  // → 空文字
  if (lastIndex === -1) {
    return "";
  }


  const cardCount = lastIndex + 1;

  const byteCount =
    Math.ceil(cardCount / 4);

  const bytes =
    new Uint8Array(byteCount);


  for (let i = 0; i < cardCount; i++) {
    const count =
      Math.min(
        3,
        Math.max(
          0,
          Number(
            owned[CARDS[i].id] || 0
          )
        )
      );

    /*
     * 1カード2bit
     *
     * 0枚 = 00
     * 1枚 = 01
     * 2枚 = 10
     * 3枚 = 11
     *
     * 1byteの中に4カードを格納。
     *
     * 先頭カードを上位2bitに入れる。
     */

    const byteIndex =
      Math.floor(i / 4);

    const shift =
      6 - (i % 4) * 2;

    bytes[byteIndex] |=
      count << shift;
  }


  return bytesToBase64Url(bytes);
}


// ============================================================
// 圧縮データ → 所持データ
// ============================================================

function decodeState(hash) {
  if (!hash) {
    return {};
  }


  const bytes =
    base64UrlToBytes(hash);

  if (!bytes) {
    return null;
  }


  const result = {};


  for (
    let byteIndex = 0;
    byteIndex < bytes.length;
    byteIndex++
  ) {
    const byte =
      bytes[byteIndex];


    for (let j = 0; j < 4; j++) {
      const index =
        byteIndex * 4 + j;


      // カード数を超えた部分は無視
      if (index >= CARDS.length) {
        break;
      }


      const shift =
        6 - j * 2;

      const count =
        (byte >> shift) & 0b11;


      if (count > 0) {
        result[CARDS[index].id] =
          count;
      }
    }
  }


  return result;
}


// ============================================================
// ハッシュから所持状況を復元
// ============================================================

function applyHash() {
  const hash =
    location.hash.slice(1);

  // ハッシュなし
  // → localStorageをそのまま使用
  if (!hash) {
    return;
  }


  const decoded =
    decodeState(hash);


  if (decoded === null) {
    return;
  }


  owned = decoded;

  saveOwned();
}


// ============================================================
// X共有
// ============================================================

function shareToX() {
  const state =
    encodeState();


  const url =
    location.origin +
    location.pathname +
    location.search +
    (state ? "#" + state : "");


  const text =
    "アイカツ！アンコール カード所持率チェッカー\n" +
    `あなたのカード所持率は${getPercentage()}%でした。`;


  const shareUrl =
    "https://twitter.com/intent/tweet" +
    "?text=" +
    encodeURIComponent(text) +
    "&url=" +
    encodeURIComponent(url) +
    "&hashtags=" +
    encodeURIComponent(
      "アイカツ,アイカツアンコール,aikatsu,aikatsuencore"
    );


  document.getElementById("shareBtn")
    .href = shareUrl;
}

// ============================================================
// ヘッダーの高さ取得
// ============================================================

function updateStickyHeaderHeight() {
  const header = document.querySelector("header");

  if (!header) return;

  document.documentElement.style.setProperty(
    "--header-height",
    `${header.offsetHeight}px`
  );
}
// 画面サイズが変わったらヘッダー高さを再計算
window.addEventListener("resize", updateStickyHeaderHeight);

// ============================================================
// 初期化
// ============================================================

function init() {
  // ----------------------------------------
  // ヘッダーの高さ取得
  // ----------------------------------------
  updateStickyHeaderHeight();
  // ----------------------------------------
  // localStorage読み込み
  // ----------------------------------------

  loadOwned();


  // ----------------------------------------
  // URLハッシュがあれば
  // 共有された所持状況を優先
  // ----------------------------------------

  applyHash();


  // ----------------------------------------
  // 初期描画
  // ----------------------------------------

  render();
  updateStats();
  shareToX();


  // ----------------------------------------
  // タブ切り替え
  // ----------------------------------------

  document
    .querySelectorAll(".tab")
    .forEach(tab => {

      tab.addEventListener("click", () => {

        document
          .querySelectorAll(".tab")
          .forEach(t =>
            t.classList.remove("active")
          );

        tab.classList.add("active");

        render();
      });

    });


  // ----------------------------------------
  // すべてクリア
  // ----------------------------------------

  document
    .getElementById("clearBtn")
    .addEventListener("click", () => {

      if (
        !confirm(
          "すべての所持数を0に戻しますか？"
        )
      ) {
        return;
      }


      owned = {};

      saveOwned();

      render();
      updateStats();


      // ハッシュも削除
      history.replaceState(
        null,
        "",
        location.pathname +
        location.search
      );


      shareToX();
    });
}


// ============================================================
// START
// ============================================================

init();
