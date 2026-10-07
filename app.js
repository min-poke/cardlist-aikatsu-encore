/* =========================================================
   アイカツ！アンコール
   カード所持率チェッカー
========================================================= */


/* =========================================================
   所持データ
========================================================= */

const STORAGE_KEY = "aikatsu_encore_owned";

let owned = {};
// {
//   "E1-01_PR": 3,
//   "E1-05_R": 1,
//   ...
// }


/* =========================================================
   表示設定
========================================================= */

// false = 通常
// true  = 拡大
//
// スマホの場合
// 通常 → 横3枚
// 拡大 → 横6枚
//
// PCでは常に横10枚なので、この設定は実質影響なし。

let isExpanded = false;


/* =========================================================
   所持データ読み込み
========================================================= */

function loadOwned() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      owned = {};
      return;
    }

    const parsed = JSON.parse(saved);

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
    console.warn("所持データの読み込みに失敗しました。", error);
    owned = {};
  }
}


/* =========================================================
   所持データ保存
========================================================= */

function saveOwned() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(owned)
  );
}


/* =========================================================
   所持枚数取得
========================================================= */

function getCardCount(cardId) {
  const count = Number(owned[cardId] || 0);

  if (count < 0) return 0;
  if (count > 3) return 3;

  return count;
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
  const activeTab = document.querySelector(".tab.active");

  return activeTab
    ? activeTab.dataset.tab
    : "all";
}


/* =========================================================
   タブに対応するカード一覧
========================================================= */

function getCardsForTab(tab) {

  if (tab === "all") {
    return CARDS;
  }

  return CARDS.filter(card => {
    return card.series === tab;
  });
}


/* =========================================================
   シリーズ名
========================================================= */

function getSeriesLabel(series) {

  if (series === "promo") {
    return "プロモーション";
  }

  /*
    E1 → 1弾
    E2 → 2弾
    E50 → 50弾

    cards.js側では
    series: "1"
    series: "2"
    ...
    のようにしても、
    "E1" のようにしても対応。
  */

  const number = String(series).match(/\d+/);

  if (number) {
    return `${number[0]}弾`;
  }

  return String(series);
}


/* =========================================================
   タブ生成
========================================================= */

/*
  cards.jsに追加されたシリーズを自動的にタブへ追加する。

  例：

  E1
  E2
  E3
  E4
  promo

  のようにカードが追加されれば、
  タブも自動的に追加される。
*/

function setupTabs() {

  const tabsContainer =
    document.querySelector(".tabs");

  if (!tabsContainer) {
    return;
  }

  /*
    cards.js内に登場するseriesを取得
  */

  const seriesList = [
    ...new Set(
      CARDS.map(card => String(card.series))
    )
  ];

  /*
    数字シリーズを先に並べる。
    promoなど文字列シリーズは最後。
  */

  seriesList.sort((a, b) => {

    const aNumber = a.match(/\d+/);
    const bNumber = b.match(/\d+/);

    if (aNumber && bNumber) {
      return (
        Number(aNumber[0]) -
        Number(bNumber[0])
      );
    }

    if (aNumber) return -1;
    if (bNumber) return 1;

    return a.localeCompare(b);
  });


  /*
    現在のタブを記録
  */

  const currentTab =
    tabsContainer.querySelector(".tab.active")
      ?.dataset.tab || "all";


  /*
    既存タブをすべて削除
  */

  tabsContainer.innerHTML = "";


  /*
    すべて
  */

  const allTab =
    document.createElement("button");

  allTab.className = "tab";

  allTab.type = "button";

  allTab.dataset.tab = "all";

  allTab.textContent = "すべて";

  tabsContainer.appendChild(allTab);


  /*
    各シリーズ
  */

  seriesList.forEach(series => {

    const tab =
      document.createElement("button");

    tab.className = "tab";

    tab.type = "button";

    tab.dataset.tab = series;

    tab.textContent =
      getSeriesLabel(series);

    tabsContainer.appendChild(tab);
  });


  /*
    以前のタブを復元
  */

  const active =
    tabsContainer.querySelector(
      `.tab[data-tab="${CSS.escape(currentTab)}"]`
    );

  if (active) {
    active.classList.add("active");
  } else {
    allTab.classList.add("active");
  }


  /*
    クリックイベント
  */

  tabsContainer
    .querySelectorAll(".tab")
    .forEach(tab => {

      tab.addEventListener("click", () => {

        tabsContainer
          .querySelectorAll(".tab")
          .forEach(item => {
            item.classList.remove("active");
          });

        tab.classList.add("active");

        render();

        updateStats();

        updateDisplayToggle();

        shareToX();
      });

    });
}


/* =========================================================
   カード描画
========================================================= */

function render() {

  const grid =
    document.getElementById("cardGrid");

  if (!grid) {
    return;
  }


  /*
    現在のタブ
  */

  const activeTab =
    getActiveTab();


  /*
    対象カード
  */

  const list =
    getCardsForTab(activeTab);


  /*
    一旦クリア
  */

  grid.innerHTML = "";


  /*
    拡大状態をCSSへ反映
  */

  if (isExpanded) {
    grid.classList.add("expanded");
  } else {
    grid.classList.remove("expanded");
  }


  /*
    カードを生成
  */

  list.forEach(card => {

    const count =
      getCardCount(card.id);


    /*
      カード本体
    */

    const item =
      document.createElement("div");

    item.className =
      `card-item ${count === 0 ? "unowned" : ""}`;

    item.dataset.id =
      card.id;


    /*
      画像
    */

    const img =
      document.createElement("img");

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
        img.naturalWidth > img.naturalHeight
      ) {
        img.classList.add("rotate-90");
      } else {
        img.classList.remove("rotate-90");
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
      document.createElement("div");

    badge.className =
      `badge ${count === 0 ? "hidden" : ""}`;


    if (count >= 3) {
      badge.textContent = "3+";
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
          owned[card.id] = next;
        }


        saveOwned();

        render();

        updateStats();

        shareToX();
      }
    );


    /*
      DOMへ追加
    */

    item.appendChild(img);

    item.appendChild(badge);

    grid.appendChild(item);

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
    document.getElementById("totalCount");

  const ownedCount =
    document.getElementById("ownedCount");

  const ownedPercentage =
    document.getElementById("ownedPercentage");


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
   共有データ圧縮
========================================================= */

/*
  1カード = 2bit

  00 = 0枚
  01 = 1枚
  10 = 2枚
  11 = 3枚

  4カード = 1byte

  例：

  [0, 1, 2, 3]

  ↓

  00 01 10 11

  ↓

  00011011

  ↓

  0x1B


  その後Base64URL化する。

  さらに末尾の0枚カードは
  データそのものから省略する。

  そのため、

  全カード0枚
  → 空文字

  先頭だけ3枚
  → 非常に短い

  というURLになる。
*/


/* =========================================================
   Base64URLエンコード
========================================================= */

function bytesToBase64Url(bytes) {

  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
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


  while (base64.length % 4 !== 0) {
    base64 += "=";
  }


  const binary =
    atob(base64);


  const bytes =
    new Uint8Array(binary.length);


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

function encodeState() {

  /*
    全カードの所持数を取得
  */

  const counts =
    CARDS.map(card => {
      return getCardCount(card.id);
    });


  /*
    末尾の0を削除

    例：

    [3, 1, 0, 0, 0]

    ↓

    [3, 1]
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
    全部0枚なら空文字
  */

  if (last < 0) {
    return "";
  }


  /*
    必要なカード数
  */

  const usedCount =
    last + 1;


  /*
    4枚につき1byte

    Math.ceil(usedCount / 4)
  */

  const byteLength =
    Math.ceil(usedCount / 4);


  const bytes =
    new Uint8Array(byteLength);


  /*
    2bitずつ詰める

    1枚目 → bits 0-1
    2枚目 → bits 2-3
    3枚目 → bits 4-5
    4枚目 → bits 6-7
  */

  for (
    let i = 0;
    i < usedCount;
    i++
  ) {

    const count =
      counts[i] & 0b11;


    const byteIndex =
      Math.floor(i / 4);


    const shift =
      (i % 4) * 2;


    bytes[byteIndex] |=
      count << shift;
  }


  return bytesToBase64Url(bytes);
}


/* =========================================================
   圧縮データ → 所持状況
========================================================= */

function decodeState(hash) {

  try {

    if (!hash) {
      return {};
    }


    const bytes =
      base64UrlToBytes(hash);


    const result = {};


    /*
      1byte = 4カード
    */

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
        (bytes[byteIndex] >> shift) & 0b11;


      if (count > 0) {
        result[CARDS[i].id] =
          count;
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

    → 通常のlocalStorageを使用
  */

  if (!hash) {
    return;
  }


  const decoded =
    decodeState(hash);


  if (decoded === null) {
    return;
  }


  /*
    共有URLを開いた場合は
    URLのデータを優先する
  */

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


  /*
    ハッシュを作成

    0枚だけならハッシュ自体を付けない。
  */

  const hash =
    state
      ? `#${state}`
      : "";


  const url =
    location.origin +
    location.pathname +
    location.search +
    hash;


  /*
    現在のタブの所持率を表示
  */

  const activeTab =
    getActiveTab();


  const list =
    getCardsForTab(activeTab);


  const percentage =
    getPercentage(list);


  const text =
    "アイカツ！アンコール カード所持率チェッカー\n" +
    `あなたのカード所持率は${percentage}%でした。`;


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
    document.getElementById("shareBtn");


  if (shareBtn) {
    shareBtn.href =
      shareUrl;
  }
}


/* =========================================================
   表示設定切り替え
========================================================= */

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
    拡大状態
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
   表示設定ボタンイベント
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


      /*
        小さなアニメーション
      */

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
   ヘッダー高さを取得
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


      img.src = src;
    }
  );
}


/* =========================================================
   キャンバスへカード画像を描画
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
      await loadImage(card.image);


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
      元画像の縦横
    */

    const imageWidth =
      img.naturalWidth ||
      img.width;

    const imageHeight =
      img.naturalHeight ||
      img.height;


    /*
      横長カードか判定
    */

    const landscape =
      imageWidth >
      imageHeight;


    /*
      未所持ならグレースケール
    */

    ctx.save();


    if (count === 0) {

      ctx.filter =
        "grayscale(100%) brightness(0.7)";
    }


    /*
      縦長カード
    */

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


    /*
      横長カード
    */

    } else {

      ctx.translate(
        x + width / 2,
        y + height / 2
      );


      ctx.rotate(
        Math.PI / 2
      );


      /*
        90度回転後のサイズ
      */

      const rotatedWidth =
        imageHeight;

      const rotatedHeight =
        imageWidth;


      const scale =
        Math.min(
          width / rotatedWidth,
          height / rotatedHeight
        );


      const drawWidth =
        rotatedWidth * scale;


      const drawHeight =
        rotatedHeight * scale;


      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
    }


    ctx.restore();


    /*
      所持数バッジ
    */

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
        バッジ文字
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


    /*
      エラー時はカード番号を表示
    */

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
   所持状況を画像として保存
========================================================= */

/*
  現在のタブに表示されているカードを
  横15枚で並べる。

  例：

  [01][02][03]...[15]
  [16][17][18]...[30]
  [31][32][33]...

  PNGとして保存。
*/

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

    button.disabled = true;
  }


  try {

    const activeTab =
      getActiveTab();


    const cards =
      getCardsForTab(activeTab);


    if (!cards.length) {

      alert(
        "保存するカードがありません。"
      );

      return;
    }


    /*
      保存画像の設定
    */

    const columns =
      15;


    /*
      PCで見たときくらいの
      横長画像にする。

      1カードを幅160px程度。
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


    /*
      行数
    */

    const rows =
      Math.ceil(
        cards.length /
        columns
      );


    /*
      キャンバスサイズ
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
      24;


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


    /*
      上部タイトル
    */

    ctx.fillStyle =
      "#e85b9d";

    ctx.font =
      "bold 30px sans-serif";

    ctx.textAlign =
      "left";

    ctx.textBaseline =
      "top";


    ctx.fillText(
      "アイカツ！アンコール カード所持状況",
      horizontalPadding,
      18
    );


    /*
      タブ名
    */

    ctx.fillStyle =
      "#777";

    ctx.font =
      "bold 18px sans-serif";


    const tabLabel =
      activeTab === "all"
        ? "すべて"
        : getSeriesLabel(activeTab);


    ctx.fillText(
      tabLabel,
      horizontalPadding,
      58
    );


    /*
      所持率
    */

    ctx.fillStyle =
      "#e85b9d";

    ctx.font =
      "bold 18px sans-serif";


    ctx.fillText(
      `所持：${getOwnedCount(cards)} / ${cards.length}枚（${getPercentage(cards)}%）`,
      horizontalPadding + 110,
      58
    );


    /*
      カード描画

      Promiseを順番に処理して
      Canvasへの描画順を安定させる。
    */

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


    /*
      PNG化
    */

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


    /*
      ファイル名
    */

    const date =
      new Date();


    const dateString =
      date
        .toISOString()
        .slice(0, 10);


    const fileName =
      `aikatsu-encore-${activeTab}-${dateString}.png`;


    /*
      ダウンロード
    */

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
      後片付け
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


      /*
        所持データ削除
      */

      owned = {};

      saveOwned();


      /*
        表示更新
      */

      render();

      updateStats();

      shareToX();


      /*
        URLの共有ハッシュも削除
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
