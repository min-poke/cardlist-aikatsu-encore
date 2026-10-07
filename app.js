/* =========================================================
   アイカツ！アンコール
   カード所持率チェッカー
========================================================= */


/* =========================================================
   設定
========================================================= */

const STORAGE_KEY = "aikatsu_encore_owned";

const GRID_STORAGE_KEY = "aikatsu_encore_grid";

const MAX_OWNED = 3;


/* =========================================================
   所持データ
========================================================= */

let owned = {};


/*
  タブごとの表示枚数

  例：
  {
    all: 3,
    "1": 6,
    promo: 3
  }
*/

let gridSettings = {
  all: 3,
  "1": 3,
  promo: 3
};


/* =========================================================
   所持データ読み込み
========================================================= */

function loadOwned() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

    if (
      saved &&
      typeof saved === "object"
    ) {
      owned = saved;
    } else {
      owned = {};
    }

  } catch {

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
   表示設定読み込み
========================================================= */

function loadGridSettings() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(GRID_STORAGE_KEY)
      );

    if (
      saved &&
      typeof saved === "object"
    ) {

      gridSettings = {
        ...gridSettings,
        ...saved
      };

    }

  } catch {

    gridSettings = {
      all: 3,
      "1": 3,
      promo: 3
    };

  }

}


/* =========================================================
   表示設定保存
========================================================= */

function saveGridSettings() {

  localStorage.setItem(
    GRID_STORAGE_KEY,
    JSON.stringify(gridSettings)
  );

}


/* =========================================================
   現在のタブ取得
========================================================= */

function getActiveTab() {

  const activeTab =
    document.querySelector(
      ".tab.active"
    );

  return activeTab
    ? activeTab.dataset.tab
    : "all";

}


/* =========================================================
   現在の表示枚数取得
========================================================= */

function getCurrentColumns() {

  const tab =
    getActiveTab();

  return gridSettings[tab] === 6
    ? 6
    : 3;

}


/* =========================================================
   所持カード数
========================================================= */

function getOwnedCount() {

  return Object.values(owned)
    .filter(
      count => Number(count) > 0
    )
    .length;

}


/* =========================================================
   所持率
========================================================= */

function getPercentage() {

  return CARDS.length

    ? (
        getOwnedCount()
        /
        CARDS.length
        *
        100
      ).toFixed(1)

    : "0.0";

}


/* =========================================================
   カードグリッドの枚数反映
========================================================= */

function applyGridColumns() {

  const grid =
    document.getElementById(
      "cardGrid"
    );

  if (!grid) return;

  const columns =
    getCurrentColumns();

  grid.classList.toggle(
    "columns-3",
    columns === 3
  );

  grid.classList.toggle(
    "columns-6",
    columns === 6
  );


  /*
    現在選択されているボタン
  */

  document
    .querySelectorAll(
      ".grid-size-btn"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        Number(
          button.dataset.columns
        ) === columns
      );

    });

}


/* =========================================================
   カード描画
========================================================= */

function render() {

  const activeTab =
    getActiveTab();

  const grid =
    document.getElementById(
      "cardGrid"
    );

  grid.innerHTML = "";


  /*
    表示枚数
  */

  applyGridColumns();


  /*
    タブでカードを絞り込み
  */

  const list =
    CARDS.filter(card =>

      activeTab === "all"
        ||
      card.series === activeTab

    );


  /*
    カード生成
  */

  list.forEach(card => {

    const count =
      Math.min(
        Number(
          owned[card.id] || 0
        ),
        MAX_OWNED
      );


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
      画像
    */

    const img =
      document.createElement(
        "img"
      );

    img.src =
      card.image;

    img.alt =
      card.name;

    img.loading =
      "lazy";


    /*
      横長カードを90度回転
    */

    const rotateIfLandscape =
      () => {

        if (
          img.naturalWidth >
          img.naturalHeight
        ) {

          img.classList.add(
            "rotate-90"
          );

        }

      };


    img.onload =
      rotateIfLandscape;


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


    /*
      3枚以上は 3+
    */

    badge.textContent =
      count >= 3
        ? "3+"
        : String(count);


    /*
      カードクリック
    */

    item.addEventListener(
      "click",
      () => {

        const current =
          Number(
            owned[card.id] || 0
          );


        /*
          0 → 1 → 2 → 3 → 0
        */

        const next =
          (current + 1)
          %
          (MAX_OWNED + 1);


        if (next === 0) {

          delete owned[card.id];

        } else {

          owned[card.id] =
            next;

        }


        saveOwned();

        render();

        updateStats();

        shareToX();

      }
    );


    item.append(
      img,
      badge
    );

    grid.appendChild(
      item
    );

  });

}


/* =========================================================
   所持率表示
========================================================= */

function updateStats() {

  document
    .getElementById(
      "totalCount"
    )
    .textContent =
      CARDS.length;


  document
    .getElementById(
      "ownedCount"
    )
    .textContent =
      getOwnedCount();


  document
    .getElementById(
      "ownedPercentage"
    )
    .textContent =
      getPercentage();

}


/* =========================================================
   共有URL
=========================================================

   1カード = 2bit

   0 = 0枚
   1 = 1枚
   2 = 2枚
   3 = 3枚

   4カード = 8bit = 1byte

   その後 Base64URL 化。

   さらに末尾の 0カードを削ることで、
   未所持カードが多い状態ではURLを短縮する。
========================================================= */


/*
  Base64URLエンコード
*/

function base64UrlEncode(bytes) {

  let binary = "";

  bytes.forEach(
    byte => {
      binary += String.fromCharCode(
        byte
      );
    }
  );


  return btoa(binary)

    .replace(
      /\+/g,
      "-"
    )

    .replace(
      /\//g,
      "_"
    )

    .replace(
      /=/g,
      ""
    );

}


/*
  Base64URLデコード
*/

function base64UrlDecode(str) {

  const base64 =
    str

      .replace(
        /-/g,
        "+"
      )

      .replace(
        /_/g,
        "/"
      );


  const padding =
    "=".repeat(
      (4 - (base64.length % 4)) % 4
    );


  const binary =
    atob(
      base64 + padding
    );


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


/*
  状態を圧縮
*/

function encodeState() {

  /*
    まずカードごとの値を作る
  */

  const counts =
    CARDS.map(card =>
      Math.min(
        Number(
          owned[card.id] || 0
        ),
        MAX_OWNED
      )
    );


  /*
    末尾の0を削除

    例：

    [1,2,0,0,0,0]

    ↓

    [1,2]
  */

  let length =
    counts.length;


  while (
    length > 0 &&
    counts[length - 1] === 0
  ) {

    length--;

  }


  /*
    0枚しかない場合

    → 空文字

    つまり

    URL#xxx

    ではなく

    URL

    にできる
  */

  if (length === 0) {
    return "";
  }


  /*
    4カード = 1byte

    2bitずつ詰める

    card 0 : bit 7-6
    card 1 : bit 5-4
    card 2 : bit 3-2
    card 3 : bit 1-0
  */

  const byteLength =
    Math.ceil(
      length / 4
    );


  const bytes =
    new Uint8Array(
      byteLength
    );


  for (
    let i = 0;
    i < length;
    i++
  ) {

    const value =
      counts[i] & 3;


    const byteIndex =
      Math.floor(i / 4);


    const shift =
      6 -
      (i % 4) * 2;


    bytes[byteIndex] |=
      value << shift;

  }


  return base64UrlEncode(
    bytes
  );

}


/*
  共有状態を復元
*/

function decodeState(hash) {

  try {

    if (!hash) {
      return {};
    }


    const bytes =
      base64UrlDecode(
        hash
      );


    const result = {};


    /*
      1byteから4カードを復元
    */

    for (
      let i = 0;
      i < CARDS.length;
      i++
    ) {

      const byteIndex =
        Math.floor(i / 4);


      /*
        URLのデータより先なら
        0枚扱い
      */

      if (
        byteIndex >=
        bytes.length
      ) {

        break;

      }


      const shift =
        6 -
        (i % 4) * 2;


      const count =
        (
          bytes[byteIndex]
          >>
          shift
        ) & 3;


      if (count > 0) {

        result[
          CARDS[i].id
        ] = count;

      }

    }


    return result;

  } catch {

    return null;

  }

}


/* =========================================================
   ハッシュを適用
========================================================= */

function applyHash() {

  const hash =
    location.hash.slice(1);


  /*
    ハッシュがない
    → 通常の保存データを使用
  */

  if (!hash) {
    return;
  }


  const decoded =
    decodeState(hash);


  if (decoded !== null) {

    owned =
      decoded;

    saveOwned();

  }

}


/* =========================================================
   X共有URL
========================================================= */

function shareToX() {

  const state =
    encodeState();


  const baseUrl =
    location.origin +
    location.pathname +
    location.search;


  /*
    何も所持していない場合は
    ハッシュ自体を付けない
  */

  const url =
    state

      ? baseUrl + "#" + state

      : baseUrl;


  const text =
    "アイカツ！アンコール カード所持率チェッカー\n"
    +
    `あなたのカード所持率は${getPercentage()}%でした。`;


  const shareUrl =
    "https://twitter.com/intent/tweet"
    +
    "?text="
    +
    encodeURIComponent(text)
    +
    "&url="
    +
    encodeURIComponent(url)
    +
    "&hashtags="
    +
    encodeURIComponent(
      "アイカツ,アイカツアンコール,aikatsu,aikatsuencore"
    );


  const shareBtn =
    document.getElementById(
      "shareBtn"
    );


  shareBtn.href =
    shareUrl;

}


/* =========================================================
   URLを現在状態に更新
========================================================= */

function updateHash() {

  const state =
    encodeState();


  const baseUrl =
    location.pathname +
    location.search;


  const newUrl =
    state

      ? baseUrl + "#" + state

      : baseUrl;


  history.replaceState(
    null,
    "",
    newUrl
  );

}


/* =========================================================
   表示設定の開閉
========================================================= */

function initGridToggle() {

  const button =
    document.getElementById(
      "gridToggleBtn"
    );

  const panel =
    document.getElementById(
      "gridSettings"
    );

  const icon =
    document.getElementById(
      "gridToggleIcon"
    );


  if (
    !button ||
    !panel ||
    !icon
  ) {

    return;

  }


  button.addEventListener(
    "click",
    () => {

      const isOpen =
        button.getAttribute(
          "aria-expanded"
        ) === "true";


      const nextOpen =
        !isOpen;


      button.setAttribute(
        "aria-expanded",
        String(nextOpen)
      );


      panel.classList.toggle(
        "open",
        nextOpen
      );


      icon.textContent =
        nextOpen
          ? "−"
          : "＋";

    }
  );

}


/* =========================================================
   横3枚 / 横6枚
========================================================= */

function initGridSizeButtons() {

  document
    .querySelectorAll(
      ".grid-size-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const columns =
            Number(
              button.dataset.columns
            );


          const tab =
            getActiveTab();


          /*
            タブごとに保存
          */

          gridSettings[tab] =
            columns === 6
              ? 6
              : 3;


          saveGridSettings();

          applyGridColumns();

        }
      );

    });

}


/* =========================================================
   タブ切り替え
========================================================= */

function initTabs() {

  document
    .querySelectorAll(
      ".tab"
    )
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".tab"
            )
            .forEach(t => {

              t.classList.remove(
                "active"
              );

            });


          tab.classList.add(
            "active"
          );


          render();

          updateStats();

        }
      );

    });

}


/* =========================================================
   すべてクリア
========================================================= */

function initClearButton() {

  const clearBtn =
    document.getElementById(
      "clearBtn"
    );


  clearBtn.addEventListener(
    "click",
    () => {

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


      /*
        URLの共有状態も削除
      */

      updateHash();


      shareToX();

    }
  );

}


/* =========================================================
   画像保存
=========================================================

   外部ライブラリ不要。

   現在のタブに表示されているカードを
   Canvasへ描画してPNGとして保存する。

========================================================= */

function initImageSave() {

  const button =
    document.getElementById(
      "saveImageBtn"
    );


  button.addEventListener(
    "click",
    saveCurrentTabAsImage
  );

}


/*
  カード画像をCanvasに描画
*/

async function loadImage(src) {

  return new Promise(
    (resolve, reject) => {

      const img =
        new Image();

      img.onload =
        () => resolve(img);

      img.onerror =
        () => reject(
          new Error(
            `画像を読み込めませんでした: ${src}`
          )
        );

      img.src =
        src;

    }
  );

}


/*
  現在のタブを画像保存
*/

async function saveCurrentTabAsImage() {

  const button =
    document.getElementById(
      "saveImageBtn"
    );


  const originalText =
    button.textContent;


  button.disabled =
    true;

  button.textContent =
    "作成中…";


  try {

    const activeTab =
      getActiveTab();


    const columns =
      getCurrentColumns();


    /*
      現在のタブのカード
    */

    const cards =
      CARDS.filter(card =>
        activeTab === "all"
          ||
        card.series === activeTab
      );


    if (!cards.length) {

      alert(
        "保存するカードがありません。"
      );

      return;

    }


    /*
      画像サイズ

      PCで見ても十分な横幅にする。

      横3枚なら大きめ、
      横6枚なら横長。
    */

    const cardWidth =
      columns === 6
        ? 220
        : 300;


    const cardHeight =
      Math.round(
        cardWidth * 86 / 59
      );


    const gap =
      18;


    const padding =
      30;


    const titleHeight =
      110;


    const columnsCount =
      columns;


    const rows =
      Math.ceil(
        cards.length /
        columnsCount
      );


    const canvasWidth =
      padding * 2
      +
      columnsCount *
      cardWidth
      +
      (columnsCount - 1) *
      gap;


    const canvasHeight =
      padding * 2
      +
      titleHeight
      +
      rows *
      cardHeight
      +
      (rows - 1) *
      gap;


    /*
      高解像度化
    */

    const scale =
      2;


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      canvasWidth * scale;

    canvas.height =
      canvasHeight * scale;


    const ctx =
      canvas.getContext(
        "2d"
      );


    ctx.scale(
      scale,
      scale
    );


    /*
      背景
    */

    ctx.fillStyle =
      "#fff7fd";

    ctx.fillRect(
      0,
      0,
      canvasWidth,
      canvasHeight
    );


    /*
      タイトル
    */

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";


    ctx.fillStyle =
      "#e65c9d";


    ctx.font =
      "bold 28px sans-serif";


    ctx.fillText(
      "アイカツ！アンコール",
      canvasWidth / 2,
      padding + 24
    );


    ctx.fillStyle =
      "#666";


    ctx.font =
      "bold 18px sans-serif";


    const tabName =
      activeTab === "all"
        ? "すべて"
        : activeTab === "promo"
          ? "プロモーション"
          : `${activeTab}弾`;


    ctx.fillText(
      `${tabName}　所持率 ${getPercentage()}%`,
      canvasWidth / 2,
      padding + 66
    );


    /*
      カード画像を順番に描画
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
          i / columnsCount
        );


      const column =
        i % columnsCount;


      const x =
        padding
        +
        column *
        (cardWidth + gap);


      const y =
        padding
        +
        titleHeight
        +
        row *
        (cardHeight + gap);


      /*
        カード背景
      */

      ctx.fillStyle =
        "#2a2a2a";


      ctx.fillRect(
        x,
        y,
        cardWidth,
        cardHeight
      );


      try {

        const img =
          await loadImage(
            card.image
          );


        /*
          画像の縦横を判定
        */

        const landscape =
          img.naturalWidth >
          img.naturalHeight;


        ctx.save();


        /*
          クリッピング
        */

        ctx.beginPath();

        ctx.rect(
          x,
          y,
          cardWidth,
          cardHeight
        );

        ctx.clip();


        if (!landscape) {

          /*
            通常の縦長画像
          */

          const ratio =
            Math.min(
              cardWidth /
                img.naturalWidth,
              cardHeight /
                img.naturalHeight
            );


          const width =
            img.naturalWidth *
            ratio;


          const height =
            img.naturalHeight *
            ratio;


          ctx.drawImage(
            img,
            x +
              (cardWidth - width) / 2,
            y +
              (cardHeight - height) / 2,
            width,
            height
          );

        } else {

          /*
            横長画像を90度回転
          */

          ctx.save();


          ctx.translate(
            x + cardWidth / 2,
            y + cardHeight / 2
          );


          ctx.rotate(
            Math.PI / 2
          );


          const rotatedWidth =
            cardHeight;

          const rotatedHeight =
            cardWidth;


          const ratio =
            Math.min(
              rotatedWidth /
                img.naturalWidth,
              rotatedHeight /
                img.naturalHeight
            );


          const width =
            img.naturalWidth *
            ratio;


          const height =
            img.naturalHeight *
            ratio;


          ctx.drawImage(
            img,
            -width / 2,
            -height / 2,
            width,
            height
          );


          ctx.restore();

        }


        ctx.restore();


        /*
          未所持カードをグレー表示
        */

        const count =
          Number(
            owned[card.id] || 0
          );


        if (count === 0) {

          ctx.save();

          ctx.globalAlpha =
            0.35;

          ctx.fillStyle =
            "#777";

          ctx.fillRect(
            x,
            y,
            cardWidth,
            cardHeight
          );

          ctx.restore();

        }


        /*
          所持数バッジ
        */

        if (count > 0) {

          const badgeText =
            count >= 3
              ? "3+"
              : String(count);


          const badgeRadius =
            18;


          const badgeX =
            x +
            cardWidth -
            28;


          const badgeY =
            y +
            28;


          ctx.beginPath();

          ctx.arc(
            badgeX,
            badgeY,
            badgeRadius,
            0,
            Math.PI * 2
          );


          ctx.fillStyle =
            "#ff4757";

          ctx.fill();


          ctx.fillStyle =
            "#fff";

          ctx.font =
            "bold 15px sans-serif";

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

      } catch {

        /*
          画像読み込み失敗時
        */

        ctx.fillStyle =
          "#999";

        ctx.textAlign =
          "center";

        ctx.textBaseline =
          "middle";

        ctx.font =
          "14px sans-serif";


        ctx.fillText(
          card.name,
          x + cardWidth / 2,
          y + cardHeight / 2
        );

      }

    }


    /*
      PNG化
    */

    const dataUrl =
      canvas.toDataURL(
        "image/png"
      );


    /*
      ダウンロード
    */

    const link =
      document.createElement(
        "a"
      );


    const tabFileName =
      activeTab === "all"
        ? "all"
        : activeTab === "promo"
          ? "promo"
          : `E${activeTab}`;


    link.download =
      `aikatsu-encore-${tabFileName}-collection.png`;


    link.href =
      dataUrl;


    link.click();

  } catch (error) {

    console.error(
      error
    );

    alert(
      "画像の作成に失敗しました。"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      originalText;

  }

}


/* =========================================================
   ヘッダー高さを取得
========================================================= */

function updateStickyHeaderHeight() {

  const header =
    document.getElementById(
      "siteHeader"
    );


  if (!header) {
    return;
  }


  const height =
    header.offsetHeight;


  document.documentElement
    .style
    .setProperty(
      "--header-height",
      `${height}px`
    );

}


/* =========================================================
   初期化
========================================================= */

function init() {

  /*
    保存データ読み込み
  */

  loadOwned();


  /*
    表示設定読み込み
  */

  loadGridSettings();


  /*
    URLの共有データを適用
  */

  applyHash();


  /*
    初回描画
  */

  render();

  updateStats();

  shareToX();


  /*
    ヘッダー高さ
  */

  updateStickyHeaderHeight();


  /*
    表示設定開閉
  */

  initGridToggle();


  /*
    横3 / 横6
  */

  initGridSizeButtons();


  /*
    タブ
  */

  initTabs();


  /*
    クリア
  */

  initClearButton();


  /*
    画像保存
  */

  initImageSave();


  /*
    リサイズ時に
    sticky位置を再計算
  */

  window.addEventListener(
    "resize",
    updateStickyHeaderHeight
  );

}


/* =========================================================
   実行
========================================================= */

init();
