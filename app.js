/* =========================================================
   アイカツ！アンコール
   カード所持率チェッカー
========================================================= */


/* =========================================================
   所持データ
========================================================= */

const STORAGE_KEY = "aikatsu_encore_owned";

let owned = {};


/* =========================================================
   表示設定
========================================================= */

// false = 縮小
// true  = 拡大
//
// スマホの場合
// 拡大（true）  → 横3枚
// 縮小（false） → 横6枚
//
// PCでは常に横10枚。

let isExpanded = true;


/* =========================================================
   パラレルカード表示設定
========================================================= */

// false = パラレル非表示
// true  = パラレル表示
//
// 初回アクセス時・共有リンクからのアクセス時も
// 必ず false から開始する。

let showParallel = false;


/* =========================================================
   所持カードのみ表示設定
========================================================= */

// false = すべて表示
// true  = 所持カードのみ表示
//
// 初回アクセス時は必ず false。

let showOwnedOnly = false;


/* =========================================================
   所持データ読み込み
========================================================= */

function loadOwned() {

  try {

    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      owned = {};
      return;
    }

    const parsed =
      JSON.parse(saved);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      owned = parsed;
    } else {
      owned = {};
    }

  } catch (error) {

    console.warn(
      "所持データの読み込みに失敗しました。",
      error
    );

    owned = {};
  }
}


/* =========================================================
   所持データ保存
========================================================= */

function saveOwned() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(owned)
    );

  } catch (error) {

    console.warn(
      "所持データの保存に失敗しました。",
      error
    );
  }
}


/* =========================================================
   所持枚数取得
========================================================= */

function getCardCount(cardId) {

  const count =
    Number(owned[cardId] || 0);

  if (!Number.isFinite(count)) {
    return 0;
  }

  if (count < 0) {
    return 0;
  }

  if (count > 3) {
    return 3;
  }

  return Math.floor(count);
}


/* =========================================================
   パラレルカード判定
========================================================= */

/*
  cards.jsでは、

    E1-01_PR
    E1-01_PR_p1

  のように命名している。

  parallelOfプロパティは使用せず、
  "_p1" を取り除いて通常カードIDを取得する。
*/

function getParallelBaseId(card) {

  if (!card || card.parallel !== true) {
    return null;
  }

  const suffix =
    "_p1";

  if (!card.id.endsWith(suffix)) {
    return null;
  }

  return card.id.slice(
    0,
    -suffix.length
  );
}


/* =========================================================
   通常カード取得
========================================================= */

function getNormalCards() {

  return CARDS.filter(card => {
    return !card.parallel;
  });
}


/* =========================================================
   所持カード種類数
========================================================= */

function getOwnedCount(cardList = CARDS) {

  return cardList.filter(card => {

    return getCardCount(card.id) > 0;

  }).length;
}


/* =========================================================
   所持率
========================================================= */

function getPercentage(cardList = CARDS) {

  if (!cardList.length) {
    return "0.0";
  }

  return (
    getOwnedCount(cardList) /
    cardList.length *
    100
  ).toFixed(1);
}


/* =========================================================
   現在のタブ取得
========================================================= */

function getActiveTab() {

  const activeTab =
    document.querySelector(".tab.active");

  return activeTab
    ? activeTab.dataset.tab
    : "all";
}


/* =========================================================
   タブに対応するカード一覧
========================================================= */

/*
  重要：

  CARDS自体の並び順は絶対に変更しない。

  共有URLではCARDSのindexを使用しているため、
  パラレルカードを途中へ追加してはいけない。

  CARDSでは、

    E1通常カード
    E2通常カード
    ...
    promo
    パラレルカード

  の順番を維持する。

  画面表示時だけ、

    E1-01_PR
    E1-01_PR_p1
    E1-02_PR
    E1-02_PR_p1

  のようにパラレルを通常カードの直後へ挿入する。
*/

function getCardsForTab(tab) {

  /*
    まず通常カードだけを取得。

    ここでパラレルカードを除外することで、
    パラレル表示ON時に

      通常
      ↓
      パラレルを挿入
      ↓
      元々のパラレルも表示

    という二重表示を防ぐ。
  */

  let cards =
    getNormalCards();


  /*
    シリーズ指定
  */

  if (tab !== "all") {

    cards =
      cards.filter(card => {

        return String(card.series) ===
          String(tab);

      });
  }


  /*
    パラレル非表示
  */

  if (!showParallel) {

    /*
      所持のみ表示

      パラレル非表示時は、
      通常カードの中から
      所持しているカードだけを表示。
    */

    if (showOwnedOnly) {

      return cards.filter(card => {

        return getCardCount(card.id) > 0;

      });
    }


    return cards;
  }


  /*
    パラレル表示

    通常カードの直後に、
    対応するパラレルカードを挿入する。
  */

  const result = [];


  cards.forEach(card => {

    /*
      所持のみ表示がONの場合、

      通常カードが未所持
      かつ
      パラレルも未所持

      なら両方表示しない。
    */

    const parallelCard =
      CARDS.find(candidate => {

        return (
          candidate.parallel === true &&
          getParallelBaseId(candidate) ===
            card.id
        );

      });


    if (showOwnedOnly) {

      const normalOwned =
        getCardCount(card.id) > 0;


      const parallelOwned =
        parallelCard
          ? getCardCount(
              parallelCard.id
            ) > 0
          : false;


      /*
        通常・パラレルのどちらかを
        所持していれば表示する。
      */

      if (!normalOwned && !parallelOwned) {
        return;
      }
    }


    /*
      通常カード
    */

    result.push(card);


    /*
      パラレルカード
    */

    if (parallelCard) {

      /*
        所持のみ表示ONの場合、
        未所持パラレルは表示しない。
      */

      if (
        !showOwnedOnly ||
        getCardCount(
          parallelCard.id
        ) > 0
      ) {

        result.push(
          parallelCard
        );
      }
    }
  });


  return result;
}


/* =========================================================
   シリーズ名
========================================================= */

function getSeriesLabel(series) {

  if (series === "promo") {
    return "プロモーション";
  }

  const number =
    String(series).match(/\d+/);

  if (number) {
    return `${number[0]}弾`;
  }

  return String(series);
}


/* =========================================================
   タブ生成
========================================================= */

function setupTabs() {

  const tabsContainer =
    document.querySelector(".tabs");

  if (!tabsContainer) {
    return;
  }


  /*
    cards.js内に存在する
    通常カードのシリーズを取得
  */

  const seriesList = [
    ...new Set(
      CARDS
        .filter(card => !card.parallel)
        .map(card => String(card.series))
    )
  ];


  /*
    E1 → E2 → E3 → ...
    数字シリーズを先に並べる。

    promoなどは最後。
  */

  seriesList.sort((a, b) => {

    const aNumber =
      a.match(/\d+/);

    const bNumber =
      b.match(/\d+/);


    if (aNumber && bNumber) {

      return (
        Number(aNumber[0]) -
        Number(bNumber[0])
      );
    }


    if (aNumber) {
      return -1;
    }


    if (bNumber) {
      return 1;
    }


    return a.localeCompare(b);
  });


  /*
    現在のタブを記録
  */

  const currentTab =
    tabsContainer
      .querySelector(".tab.active")
      ?.dataset.tab || "all";


  /*
    既存タブを削除
  */

  tabsContainer.innerHTML = "";


  /*
    「すべて」
  */

  const allTab =
    document.createElement("button");

  allTab.className =
    "tab";

  allTab.type =
    "button";

  allTab.dataset.tab =
    "all";

  allTab.textContent =
    "すべて";

  tabsContainer.appendChild(
    allTab
  );


  /*
    各シリーズ
  */

  seriesList.forEach(series => {

    const tab =
      document.createElement("button");

    tab.className =
      "tab";

    tab.type =
      "button";

    tab.dataset.tab =
      series;

    tab.textContent =
      getSeriesLabel(series);

    tabsContainer.appendChild(
      tab
    );
  });


  /*
    以前のタブを復元
  */

  let active = null;


  try {

    active =
      tabsContainer.querySelector(
        `.tab[data-tab="${CSS.escape(currentTab)}"]`
      );

  } catch (error) {

    active =
      null;
  }


  if (active) {

    active.classList.add(
      "active"
    );

  } else {

    allTab.classList.add(
      "active"
    );
  }


  /*
    タブクリック
  */

  tabsContainer
    .querySelectorAll(".tab")
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          tabsContainer
            .querySelectorAll(".tab")
            .forEach(item => {

              item.classList.remove(
                "active"
              );
            });


          tab.classList.add(
            "active"
          );


          render();

          updateStats();

          updateDisplayToggle();

          updateParallelToggle();

          updateOwnedOnlyToggle();

          shareToX();
        }
      );
    });
}


/* =========================================================
   カード描画
========================================================= */

function render() {

  const grid =
    document.getElementById(
      "cardGrid"
    );

  if (!grid) {
    return;
  }


  const activeTab =
    getActiveTab();


  const list =
    getCardsForTab(activeTab);


  /*
    一旦クリア
  */

  grid.innerHTML = "";


  /*
    拡大状態

    true  → 横3枚
    false → 横6枚
  */

  if (isExpanded) {

    grid.classList.remove(
      "expanded"
    );

  } else {

    grid.classList.add(
      "expanded"
    );
  }


  /*
    カード生成
  */

  list.forEach(card => {

    const count =
      getCardCount(card.id);


    const item =
      document.createElement(
        "div"
      );


    item.className =
      `card-item ${
        count === 0
          ? "unowned"
          : ""
      }`;


    item.dataset.id =
      card.id;


    /*
      パラレルカードには
      parallelクラスを追加
    */

    if (card.parallel) {

      item.classList.add(
        "parallel-card"
      );
    }


    /*
      画像
    */

    const img =
      document.createElement(
        "img"
      );


    img.src =
      card.image;


    img.alt =
      card.name || card.id;


    img.loading =
      "lazy";


    /*
      横長カードなら90度回転
    */

    const rotateIfLandscape = () => {

      if (
        img.naturalWidth > 0 &&
        img.naturalHeight > 0 &&
        img.naturalWidth >
          img.naturalHeight
      ) {

        img.classList.add(
          "rotate-90"
        );

      } else {

        img.classList.remove(
          "rotate-90"
        );
      }
    };


    img.addEventListener(
      "load",
      rotateIfLandscape
    );


    if (
      img.complete &&
      img.naturalWidth > 0
    ) {

      rotateIfLandscape();
    }


    /*
      所持数バッジ
    */

    const badge =
      document.createElement(
        "div"
      );


    badge.className =
      `badge ${
        count === 0
          ? "hidden"
          : ""
      }`;


    if (count >= 3) {

      badge.textContent =
        "3+";

    } else {

      badge.textContent =
        String(count);
    }


    /*
      カードクリック
    */

    item.addEventListener(
      "click",
      () => {

        /*
          0 → 1
          1 → 2
          2 → 3
          3 → 0
        */

        const next =
          (getCardCount(card.id) + 1) % 4;


        if (next === 0) {

          delete owned[card.id];

        } else {

          owned[card.id] =
            next;
        }


        saveOwned();

        render();

        updateStats();

        updateOwnedOnlyToggle();

        shareToX();
      }
    );


    item.appendChild(
      img
    );

    item.appendChild(
      badge
    );

    grid.appendChild(
      item
    );

  });
}


/* =========================================================
   所持率表示更新
========================================================= */

function updateStats() {

  const activeTab =
    getActiveTab();


  const list =
    getCardsForTab(activeTab);


  const totalCount =
    document.getElementById(
      "totalCount"
    );


  const ownedCount =
    document.getElementById(
      "ownedCount"
    );


  const ownedPercentage =
    document.getElementById(
      "ownedPercentage"
    );


  if (totalCount) {

    totalCount.textContent =
      list.length;
  }


  if (ownedCount) {

    ownedCount.textContent =
      getOwnedCount(list);
  }


  if (ownedPercentage) {

    ownedPercentage.textContent =
      getPercentage(list);
  }
}


/* =========================================================
   Base64URLエンコード
========================================================= */

function bytesToBase64Url(bytes) {

  let binary = "";


  for (
    let i = 0;
    i < bytes.length;
    i++
  ) {

    binary +=
      String.fromCharCode(
        bytes[i]
      );
  }


  const base64 =
    btoa(binary);


  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


/* =========================================================
   Base64URLデコード
========================================================= */

function base64UrlToBytes(str) {

  if (!str) {

    return new Uint8Array();
  }


  let base64 =
    str
      .replace(/-/g, "+")
      .replace(/_/g, "/");


  while (
    base64.length % 4 !== 0
  ) {

    base64 += "=";
  }


  const binary =
    atob(base64);


  const bytes =
    new Uint8Array(
      binary.length
    );


  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(i);
  }


  return bytes;
}


/* =========================================================
   所持状況 → 圧縮データ
========================================================= */

/*
  ここは絶対に表示用リストを使わない。

  共有URLはCARDSのindexを基準にするため、
  必ず元のCARDSを使用する。

  パラレルカードもCARDSの末尾に存在するため、
  その所持状況も共有データへ含まれる。

  既存カードの順番を変更しない限り、
  既存の共有URLは維持される。
*/

function encodeState() {

  const counts =
    CARDS.map(card => {

      return getCardCount(
        card.id
      );

    });


  /*
    末尾の0を削除
  */

  let last =
    counts.length - 1;


  while (
    last >= 0 &&
    counts[last] === 0
  ) {

    last--;
  }


  /*
    全部0枚
  */

  if (last < 0) {
    return "";
  }


  const usedCount =
    last + 1;


  /*
    4カード = 1byte
  */

  const byteLength =
    Math.ceil(
      usedCount / 4
    );


  const bytes =
    new Uint8Array(
      byteLength
    );


  /*
    1カード = 2bit
  */

  for (
    let i = 0;
    i < usedCount;
    i++
  ) {

    const count =
      getCardCount(
        CARDS[i].id
      ) & 0b11;


    const byteIndex =
      Math.floor(i / 4);


    const shift =
      (i % 4) * 2;


    bytes[byteIndex] |=
      count << shift;
  }


  return bytesToBase64Url(
    bytes
  );
}


/* =========================================================
   圧縮データ → 所持状況
========================================================= */

/*
  ここも必ずCARDSを使用する。

  表示用リストにはパラレルが
  動的に挿入されるため、
  共有URLの復号には使わない。
*/

function decodeState(hash) {

  try {

    if (!hash) {
      return {};
    }


    const bytes =
      base64UrlToBytes(hash);


    const result =
      {};


    const maxCards =
      Math.min(
        CARDS.length,
        bytes.length * 4
      );


    for (
      let i = 0;
      i < maxCards;
      i++
    ) {

      const byteIndex =
        Math.floor(i / 4);


      const shift =
        (i % 4) * 2;


      const count =
        (bytes[byteIndex] >>
          shift) & 0b11;


      if (count > 0) {

        result[
          CARDS[i].id
        ] = count;
      }
    }


    return result;

  } catch (error) {

    console.warn(
      "共有データの読み込みに失敗しました。",
      error
    );

    return null;
  }
}


/* =========================================================
   URLハッシュから所持状況を適用
========================================================= */

function applyHash() {

  const hash =
    location.hash.slice(1);


  /*
    ハッシュなし
  */

  if (!hash) {
    return;
  }


  const decoded =
    decodeState(hash);


  if (decoded === null) {
    return;
  }


  owned =
    decoded;


  saveOwned();
}


/* =========================================================
   X共有URL
========================================================= */

function shareToX() {

  const state =
    encodeState();


  const hash =
    state
      ? `#${state}`
      : "";


  const url =
    location.origin +
    location.pathname +
    location.search +
    hash;


  const activeTab =
    getActiveTab();


  const list =
    getCardsForTab(activeTab);


  const percentage =
    getPercentage(list);


  const tabLabel =
    activeTab === "all"
      ? ""
      : getSeriesLabel(activeTab);


  const text =
    "🎀アイカツ！アンコール🎀\nカード所持率チェッカー\n" +
    `あなたの${tabLabel}${tabLabel ? "の" : ""}カード所持率は${percentage}%でした。`;


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


  const shareBtn =
    document.getElementById(
      "shareBtn"
    );


  if (shareBtn) {

    shareBtn.href =
      shareUrl;
  }
}


/* =========================================================
   表示設定切り替え表示
========================================================= */

/*
  スマホのみ使用。

  現在3枚表示
    → 「縮小」
    → −

  現在6枚表示
    → 「拡大」
    → ＋
*/

function updateDisplayToggle() {

  const button =
    document.getElementById(
      "displayToggleBtn"
    );


  if (!button) {
    return;
  }


  const label =
    button.querySelector(
      ".display-toggle-label"
    );


  const icon =
    button.querySelector(
      ".display-toggle-icon"
    );


  /*
    現在の表示状態に応じて、
    「押したらどうなるか」を表示する。

    3枚表示
      → 押すと6枚表示
      → 「縮小 −」

    6枚表示
      → 押すと3枚表示
      → 「拡大 ＋」
  */

  if (isExpanded) {

    if (label) {

      label.textContent =
        "縮小";
    }


    if (icon) {

      icon.textContent =
        "−";
    }


    button.classList.add(
      "is-expanded"
    );


    button.setAttribute(
      "aria-expanded",
      "true"
    );


  } else {

    if (label) {

      label.textContent =
        "拡大";
    }


    if (icon) {

      icon.textContent =
        "+";
    }


    button.classList.remove(
      "is-expanded"
    );


    button.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


/* =========================================================
   表示設定ボタン
========================================================= */

function setupDisplayToggle() {

  const button =
    document.getElementById(
      "displayToggleBtn"
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {

      isExpanded =
        !isExpanded;


      render();

      updateDisplayToggle();


      button.classList.remove(
        "changed"
      );


      void button.offsetWidth;


      button.classList.add(
        "changed"
      );
    }
  );


  updateDisplayToggle();
}


/* =========================================================
   パラレル表示切り替え
========================================================= */

function updateParallelToggle() {

  const button =
    document.getElementById(
      "parallelToggleBtn"
    );


  if (!button) {
    return;
  }


  if (showParallel) {

    /*
      現在パラレル表示中
      → 次の操作は「非表示」
    */

    button.textContent =
      "パラレル非表示";


    button.classList.add(
      "is-active"
    );


    button.setAttribute(
      "aria-pressed",
      "true"
    );


  } else {

    /*
      現在パラレル非表示
      → 次の操作は「表示」
    */

    button.textContent =
      "パラレル表示";


    button.classList.remove(
      "is-active"
    );


    button.setAttribute(
      "aria-pressed",
      "false"
    );
  }
}


function setupParallelToggle() {

  const button =
    document.getElementById(
      "parallelToggleBtn"
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {

      showParallel =
        !showParallel;


      render();

      updateStats();

      updateParallelToggle();

      updateOwnedOnlyToggle();

      shareToX();
    }
  );


  /*
    初期状態

    パラレル非表示
    → 「パラレルを表示」
  */

  updateParallelToggle();
}


/* =========================================================
   所持のみ表示切り替え
========================================================= */

/*
  false
    → すべて表示

  true
    → 所持しているカードだけ表示

  ボタンは、

    OFF → 「所持のみ表示」
    ON  → 「すべて表示」

  とする。
*/

function updateOwnedOnlyToggle() {

  const button =
    document.getElementById(
      "ownedOnlyToggleBtn"
    );


  if (!button) {
    return;
  }


  if (showOwnedOnly) {

    /*
      現在「所持のみ表示」中
      → 次の操作で全カード表示
    */

    button.textContent =
      "すべて表示";


    button.classList.add(
      "is-active"
    );


    button.setAttribute(
      "aria-pressed",
      "true"
    );


  } else {

    /*
      現在すべて表示中
      → 次の操作で所持カードのみ表示
    */

    button.textContent =
      "所持のみ表示";


    button.classList.remove(
      "is-active"
    );


    button.setAttribute(
      "aria-pressed",
      "false"
    );
  }
}


function setupOwnedOnlyToggle() {

  const button =
    document.getElementById(
      "ownedOnlyToggleBtn"
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {

      showOwnedOnly =
        !showOwnedOnly;


      render();

      updateStats();

      updateOwnedOnlyToggle();

      shareToX();
    }
  );


  /*
    初期状態

    すべて表示
    → 「所持のみ表示」
  */

  updateOwnedOnlyToggle();
}


/* =========================================================
   ヘッダー高さ
========================================================= */

function updateStickyHeaderHeight() {

  const header =
    document.querySelector(
      "header"
    );


  if (!header) {
    return;
  }


  const height =
    header.offsetHeight;


  document.documentElement.style
    .setProperty(
      "--header-height",
      `${height}px`
    );
}


/* =========================================================
   画像読み込み
========================================================= */

function loadImage(src) {

  return new Promise(
    (resolve, reject) => {

      const img =
        new Image();


      img.onload = () => {
        resolve(img);
      };


      img.onerror = () => {

        reject(
          new Error(
            `画像を読み込めませんでした: ${src}`
          )
        );
      };


      img.src =
        src;
    }
  );
}


/* =========================================================
   Canvasへカード画像を描画
========================================================= */

async function drawCardToCanvas(
  ctx,
  card,
  count,
  x,
  y,
  width,
  height
) {

  try {

    const img =
      await loadImage(
        card.image
      );


    /*
      カード背景
    */

    ctx.fillStyle =
      "#2a2a2a";


    ctx.fillRect(
      x,
      y,
      width,
      height
    );


    /*
      元画像サイズ
    */

    const imageWidth =
      img.naturalWidth ||
      img.width;


    const imageHeight =
      img.naturalHeight ||
      img.height;


    /*
      横長カード判定
    */

    const landscape =
      imageWidth >
      imageHeight;


    ctx.filter =
      "none";


    /* =====================================================
       縦長カード
    ===================================================== */

    if (!landscape) {

      const scale =
        Math.min(
          width / imageWidth,
          height / imageHeight
        );


      const drawWidth =
        imageWidth * scale;


      const drawHeight =
        imageHeight * scale;


      const drawX =
        x +
        (width - drawWidth) / 2;


      const drawY =
        y +
        (height - drawHeight) / 2;


      ctx.drawImage(
        img,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );


    /* =====================================================
       横長カード
    ===================================================== */

    } else {

      const cssScale =
        1.4576;


      const drawWidthBeforeRotate =
        width * cssScale;


      const drawHeightBeforeRotate =
        drawWidthBeforeRotate *
        imageHeight /
        imageWidth;


      const rotatedWidth =
        drawHeightBeforeRotate;


      const rotatedHeight =
        drawWidthBeforeRotate;


      const fitScale =
        Math.min(
          1,
          width / rotatedWidth,
          height / rotatedHeight
        );


      const finalWidth =
        drawWidthBeforeRotate *
        fitScale;


      const finalHeight =
        drawHeightBeforeRotate *
        fitScale;


      ctx.save();


      ctx.translate(
        x + width / 2,
        y + height / 2
      );


      ctx.rotate(
        Math.PI / 2
      );


      ctx.drawImage(
        img,
        -finalWidth / 2,
        -finalHeight / 2,
        finalWidth,
        finalHeight
      );


      ctx.restore();
    }


    /* =====================================================
       未所持カードを直接グレースケール化
    ===================================================== */

    if (count === 0) {

      const imageData =
        ctx.getImageData(
          Math.round(x),
          Math.round(y),
          Math.round(width),
          Math.round(height)
        );


      const data =
        imageData.data;


      for (
        let i = 0;
        i < data.length;
        i += 4
      ) {

        const gray =
          (
            data[i] * 0.2126 +
            data[i + 1] * 0.7152 +
            data[i + 2] * 0.0722
          );


        const darkGray =
          gray * 0.7;


        data[i] =
          darkGray;


        data[i + 1] =
          darkGray;


        data[i + 2] =
          darkGray;
      }


      ctx.putImageData(
        imageData,
        Math.round(x),
        Math.round(y)
      );
    }


    ctx.filter =
      "none";


    /* =====================================================
       所持数バッジ
    ===================================================== */

    if (count > 0) {

      const badgeText =
        count >= 3
          ? "3+"
          : String(count);


      const badgeSize =
        Math.max(
          22,
          Math.round(
            width * 0.20
          )
        );


      const radius =
        badgeSize / 2;


      const badgeX =
        x +
        width -
        radius -
        5;


      const badgeY =
        y +
        radius +
        5;


      /*
        赤丸
      */

      ctx.fillStyle =
        "#ff4757";


      ctx.beginPath();


      ctx.arc(
        badgeX,
        badgeY,
        radius,
        0,
        Math.PI * 2
      );


      ctx.fill();


      /*
        文字
      */

      ctx.fillStyle =
        "#ffffff";


      ctx.font =
        `bold ${Math.max(
          12,
          Math.round(
            badgeSize * 0.48
          )
        )}px sans-serif`;


      ctx.textAlign =
        "center";


      ctx.textBaseline =
        "middle";


      ctx.fillText(
        badgeText,
        badgeX,
        badgeY
      );
    }


  } catch (error) {

    console.warn(
      `カード画像の描画に失敗しました: ${card.id}`,
      error
    );


    ctx.fillStyle =
      "#eeeeee";


    ctx.fillRect(
      x,
      y,
      width,
      height
    );


    ctx.fillStyle =
      "#777";


    ctx.font =
      "bold 14px sans-serif";


    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    ctx.fillText(
      card.id,
      x + width / 2,
      y + height / 2
    );
  }
}


/* =========================================================
   保存画像の横枚数を自動計算
========================================================= */

/*
  保存画像全体を
  おおよそ「3 : 4（横 : 縦）」に近づける。

  横枚数は6〜12枚の範囲。

  カード自体は 59 : 86 の縦長比率。

  タイトル・タブ名・所持率などの
  上部スペースも計算に含める。

  そのため、単純に

    カード枚数 ÷ 列数

  だけではなく、

    Canvas全体の横幅
    Canvas全体の高さ

  を実際に計算して、
  3:4に最も近い列数を選択する。
*/

function calculateSaveColumns(cardCount) {

  const minColumns =
    6;

  const maxColumns =
    12;


  /*
    カードサイズ

    保存画像では、
    横枚数が変わってもカードが
    小さくなりすぎないようにする。
  */

  const cardWidth =
    160;


  /*
    カード比率

    59 : 86
  */

  const cardHeight =
    Math.round(
      cardWidth *
      86 /
      59
    );


  const gap =
    8;


  const horizontalPadding =
    24;


  const topArea =
    100;


  const bottomPadding =
    24;


  /*
    目標比率

    横 : 縦 = 3 : 4
  */

  const targetRatio =
    3 / 4;


  let bestColumns =
    minColumns;


  let bestDifference =
    Infinity;


  for (
    let columns = minColumns;
    columns <= maxColumns;
    columns++
  ) {

    const rows =
      Math.ceil(
        cardCount /
        columns
      );


    const canvasWidth =
      horizontalPadding * 2 +
      columns * cardWidth +
      (columns - 1) * gap;


    const canvasHeight =
      topArea +
      rows * cardHeight +
      (rows - 1) * gap +
      bottomPadding;


    const ratio =
      canvasWidth /
      canvasHeight;


    /*
      目標3:4からの差
    */

    const difference =
      Math.abs(
        ratio -
        targetRatio
      );


    /*
      より3:4に近いものを採用
    */

    if (
      difference <
      bestDifference
    ) {

      bestDifference =
        difference;

      bestColumns =
        columns;
    }
  }


  return bestColumns;
}


/* =========================================================
   所持状況を画像として保存
========================================================= */

async function saveCollectionImage() {

  const button =
    document.getElementById(
      "saveImageBtn"
    );


  /*
    二重クリック防止
  */

  if (button) {

    button.classList.add(
      "is-saving"
    );

    button.disabled =
      true;
  }


  try {

    const activeTab =
      getActiveTab();


    const cards =
      getCardsForTab(
        activeTab
      );


    if (!cards.length) {

      alert(
        "保存するカードがありません。"
      );

      return;
    }


    /* =====================================================
       保存画像設定
    ===================================================== */

    /*
      横6〜12枚の中から、
      画像全体が3:4に最も近くなる
      列数を自動計算する。
    */

    const columns =
      calculateSaveColumns(
        cards.length
      );


    /*
      カードサイズ

      縦長カード比率
      59 : 86
    */

    const cardWidth =
      160;


    const cardHeight =
      Math.round(
        cardWidth *
        86 /
        59
      );


    const gap =
      8;


    const horizontalPadding =
      24;


    const topArea =
      100;


    const bottomPadding =
      24;


    /*
      行数
    */

    const rows =
      Math.ceil(
        cards.length /
        columns
      );


    /*
      Canvasサイズ
    */

    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      horizontalPadding * 2 +
      columns * cardWidth +
      (columns - 1) * gap;


    canvas.height =
      topArea +
      rows * cardHeight +
      (rows - 1) * gap +
      bottomPadding;


    const ctx =
      canvas.getContext(
        "2d"
      );


    /*
      背景
    */

    ctx.fillStyle =
      "#fff7fd";


    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    /* =====================================================
       タイトル
    ===================================================== */

    ctx.fillStyle =
      "#e85b9d";


    ctx.font =
      "bold 30px sans-serif";


    ctx.textAlign =
      "left";


    ctx.textBaseline =
      "top";


    ctx.fillText(
      "🎀アイカツ！アンコール カード所持状況🎀",
      horizontalPadding,
      18
    );


    /* =====================================================
       タブ名
    ===================================================== */

    ctx.fillStyle =
      "#777";


    ctx.font =
      "bold 18px sans-serif";


    const tabLabel =
      activeTab === "all"
        ? "すべて"
        : getSeriesLabel(
            activeTab
          );


    ctx.fillText(
      tabLabel,
      horizontalPadding,
      58
    );


    /* =====================================================
       所持率
    ===================================================== */

    ctx.fillStyle =
      "#e85b9d";


    ctx.font =
      "bold 18px sans-serif";


    const tabWidth =
      ctx.measureText(
        tabLabel
      ).width;


    const ownedX =
      horizontalPadding +
      tabWidth +
      24;


    ctx.fillText(
      `所持：${getOwnedCount(cards)} / ${cards.length}枚（${getPercentage(cards)}%）`,
      ownedX,
      58
    );


    /* =====================================================
       カード描画
    ===================================================== */

    for (
      let i = 0;
      i < cards.length;
      i++
    ) {

      const card =
        cards[i];


      const row =
        Math.floor(
          i / columns
        );


      const column =
        i % columns;


      const x =
        horizontalPadding +
        column *
          (cardWidth + gap);


      const y =
        topArea +
        row *
          (cardHeight + gap);


      const count =
        getCardCount(
          card.id
        );


      await drawCardToCanvas(
        ctx,
        card,
        count,
        x,
        y,
        cardWidth,
        cardHeight
      );
    }


    /* =====================================================
       PNG生成
    ===================================================== */

    const blob =
      await new Promise(
        resolve => {

          canvas.toBlob(
            resolve,
            "image/png"
          );
        }
      );


    if (!blob) {

      throw new Error(
        "PNGの生成に失敗しました。"
      );
    }


    /* =====================================================
       ファイル名
    ===================================================== */

    const date =
      new Date();


    const dateString =
      date
        .toISOString()
        .slice(0, 10);


    const fileName =
      `aikatsu-encore-${activeTab}-${dateString}.png`;


    /* =====================================================
       ダウンロード
    ===================================================== */

    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      fileName;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    /*
      URL解放
    */

    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      1000
    );


  } catch (error) {

    console.error(
      "画像保存に失敗しました。",
      error
    );


    alert(
      "画像の保存に失敗しました。\n" +
      "画像を読み込めないカードがある可能性があります。"
    );


  } finally {

    if (button) {

      button.classList.remove(
        "is-saving"
      );

      button.disabled =
        false;
    }
  }
}


/* =========================================================
   画像保存ボタン
========================================================= */

function setupSaveImage() {

  const button =
    document.getElementById(
      "saveImageBtn"
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    saveCollectionImage
  );
}


/* =========================================================
   すべてクリア
========================================================= */

function setupClearButton() {

  const clearBtn =
    document.getElementById(
      "clearBtn"
    );


  if (!clearBtn) {
    return;
  }


  clearBtn.addEventListener(
    "click",
    () => {

      const confirmed =
        confirm(
          "すべての所持数を0に戻しますか？"
        );


      if (!confirmed) {
        return;
      }


      owned = {};


      saveOwned();


      render();

      updateStats();

      updateOwnedOnlyToggle();

      shareToX();


      /*
        URL共有データも削除
      */

      history.replaceState(
        null,
        "",
        location.pathname +
        location.search
      );
    }
  );
}


/* =========================================================
   初期化
========================================================= */

function init() {

  /*
    所持データ読み込み
  */

  loadOwned();


  /*
    URL共有データを優先

    showParallelは変更しない。
    showOwnedOnlyも変更しない。

    どちらも初期値falseのまま。
  */

  applyHash();


  /*
    タブ生成
  */

  setupTabs();


  /*
    カード描画
  */

  render();


  /*
    所持率
  */

  updateStats();


  /*
    X共有
  */

  shareToX();


  /*
    表示設定
  */

  setupDisplayToggle();


  /*
    パラレル表示
  */

  setupParallelToggle();


  /*
    所持のみ表示
  */

  setupOwnedOnlyToggle();


  /*
    画像保存
  */

  setupSaveImage();


  /*
    すべてクリア
  */

  setupClearButton();


  /*
    ヘッダー高さ
  */

  updateStickyHeaderHeight();


  /*
    リサイズ時にも更新
  */

  window.addEventListener(
    "resize",
    updateStickyHeaderHeight
  );
}


/* =========================================================
   起動
========================================================= */

init();