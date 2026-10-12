
/* =========================================================
   アイカツ！アンコール カード所持率チェッカー
========================================================= */

const STORAGE_KEY = "aikatsu_encore_owned";
let owned = {};

// 表示設定
let isExpanded = true;
let showParallel = false;
let countFilters = new Set(["0", "1", "2", "3plus"]);
let rarityFilters = new Set(["PR", "R", "N", "ER"]);
let unownedDisplay = "gray"; // gray / color

/* =========================================================
   所持データ
========================================================= */

function loadOwned() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      owned = {};
      return;
    }

    const parsed = JSON.parse(saved);

    owned = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.warn("所持データの読み込みに失敗しました。", error);
    owned = {};
  }
}

function saveOwned() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
  } catch (error) {
    console.warn("所持データの保存に失敗しました。", error);
  }
}

function getCardCount(cardId) {
  const count = Number(owned[cardId] || 0);

  if (!Number.isFinite(count) || count < 0) return 0;

  return Math.min(3, Math.floor(count));
}

function getOwnedCount(cardList = CARDS) {
  return cardList.filter(card => getCardCount(card.id) > 0).length;
}

function getPercentage(cardList = CARDS) {
  if (!cardList.length) return "0.0";

  return (getOwnedCount(cardList) / cardList.length * 100).toFixed(1);
}

/* =========================================================
   カード取得・シリーズ情報
========================================================= */

function getParallelBaseId(card) {
  if (!card || card.parallel !== true || !card.id.endsWith("_p1")) {
    return null;
  }

  return card.id.slice(0, -3);
}

function getNormalCards() {
  return CARDS.filter(card => !card.parallel);
}

function getActiveTab() {
  return document.querySelector(".tab.active")?.dataset.tab || "all";
}

function getSeriesLabel(series) {
  if (series === "promo") return "プロモーション";

  const number = String(series).match(/\d+/);

  return number ? `${number[0]}弾` : String(series);
}

/*
 * CARDSの配列順は共有URLのカードindexに使うため変更しない。
 * 表示時のみ、通常カードの直後に対応するパラレルカードを挿入する。
 */
function getCardsForTab(tab) {
  const normalCards = getNormalCards().filter(card =>
    tab === "all" || String(card.series) === String(tab)
  );

  const result = [];

  normalCards.forEach(card => {
    const parallelCard = showParallel
      ? CARDS.find(candidate =>
          candidate.parallel === true &&
          getParallelBaseId(candidate) === card.id
        )
      : null;

    [card, ...(parallelCard ? [parallelCard] : [])].forEach(candidate => {
      const count = getCardCount(candidate.id);

      // 選択なしは該当カードなし。全選択時は全種類が選択済み。
      if (!countFilters.has(String(count === 3 ? "3plus" : count))) return;
      if (!rarityFilters.has(String(candidate.rarity))) return;

      result.push(candidate);
    });
  });

  return result;
}

function getCardsForStats(tab = getActiveTab()) {
  let cards = getNormalCards();

  if (tab !== "all") {
    cards = cards.filter(
      card => String(card.series) === String(tab)
    );
  }

  // パラレル表示設定を集計にも反映
  if (showParallel) {
    const baseIds = new Set(cards.map(card => card.id));

    cards = [
      ...cards,
      ...CARDS.filter(card =>
        card.parallel === true &&
        baseIds.has(getParallelBaseId(card))
      )
    ];
  }

  // レアリティフィルターは集計に反映
  cards = cards.filter(card =>
    rarityFilters.has(String(card.rarity))
  );

  // 枚数フィルターは集計に適用しない
  return cards;
}

/* =========================================================
   タブ
========================================================= */

function setupTabs() {
  const tabsContainer = document.querySelector(".tabs");

  if (!tabsContainer) return;

  const seriesList = [
    ...new Set(getNormalCards().map(card => String(card.series)))
  ];

  seriesList.sort((a, b) => {
    const aNumber = a.match(/\d+/);
    const bNumber = b.match(/\d+/);

    if (aNumber && bNumber) {
      return Number(aNumber[0]) - Number(bNumber[0]);
    }

    if (aNumber) return -1;
    if (bNumber) return 1;

    return a.localeCompare(b);
  });

  const currentTab =
    tabsContainer.querySelector(".tab.active")?.dataset.tab || "all";

  tabsContainer.innerHTML = "";

  const allTab = document.createElement("button");
  allTab.className = "tab";
  allTab.type = "button";
  allTab.dataset.tab = "all";
  allTab.textContent = "すべて";

  tabsContainer.appendChild(allTab);

  seriesList.forEach(series => {
    const tab = document.createElement("button");

    tab.className = "tab";
    tab.type = "button";
    tab.dataset.tab = series;
    tab.textContent = getSeriesLabel(series);

    tabsContainer.appendChild(tab);
  });

  let activeTab = null;

  try {
    activeTab = tabsContainer.querySelector(
      `.tab[data-tab="${CSS.escape(currentTab)}"]`
    );
  } catch {
    activeTab = null;
  }

  (activeTab || allTab).classList.add("active");

  tabsContainer.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      tabsContainer.querySelectorAll(".tab").forEach(item => {
        item.classList.remove("active");
      });

      tab.classList.add("active");

      render();
      updateStats();
      shareToX();
      updateStickyHeaderHeight();
    });
  });
}

/* =========================================================
   カード一覧の描画
========================================================= */

function render() {
  const grid = document.getElementById("cardGrid");

  if (!grid) return;

  const cards = getCardsForTab(getActiveTab());

  grid.innerHTML = "";
  grid.classList.toggle("expanded", !isExpanded);

  cards.forEach(card => {
    const count = getCardCount(card.id);

    const item = document.createElement("div");

    item.className = `card-item${count === 0 ? " unowned" : ""}`;
    item.dataset.id = card.id;

    if (card.parallel) {
      item.classList.add("parallel-card");
    }

    if (count === 0 && unownedDisplay === "color") {
      item.classList.add("unowned-color");
    }

    const img = document.createElement("img");

    img.src = card.image;
    img.alt = card.name || card.id;
    img.loading = "lazy";

    const rotateIfLandscape = () => {
      img.classList.toggle(
        "rotate-90",
        img.naturalWidth > 0 &&
        img.naturalHeight > 0 &&
        img.naturalWidth > img.naturalHeight
      );
    };

    img.addEventListener("load", rotateIfLandscape);

    if (img.complete && img.naturalWidth > 0) {
      rotateIfLandscape();
    }

    const badge = document.createElement("div");

    badge.className =
      `badge${count === 0 && unownedDisplay !== "color" ? " hidden" : ""}` +
      `${count === 0 ? " badge-zero" : ""}`;

    badge.textContent = count >= 3 ? "3+" : String(count);

    item.addEventListener("click", () => {
      const nextCount = (getCardCount(card.id) + 1) % 4;

      if (nextCount === 0) {
        delete owned[card.id];
      } else {
        owned[card.id] = nextCount;
      }

      saveOwned();
      render();
      updateStats();
      shareToX();
    });

    item.append(img, badge);
    grid.appendChild(item);
  });
}

/* =========================================================
   所持率・共有URL
========================================================= */

function updateStats() {
  const cards = getCardsForStats();

  const totalCount = document.getElementById("totalCount");
  const ownedCount = document.getElementById("ownedCount");
  const ownedPercentage = document.getElementById("ownedPercentage");

  if (totalCount) totalCount.textContent = cards.length;
  if (ownedCount) ownedCount.textContent = getOwnedCount(cards);

  if (ownedPercentage) {
    ownedPercentage.textContent = getPercentage(cards);
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  if (!value) return new Uint8Array();

  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");

  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function encodeState() {
  const counts = CARDS.map(card => getCardCount(card.id));

  let last = counts.length - 1;

  while (last >= 0 && counts[last] === 0) {
    last--;
  }

  if (last < 0) return "";

  const usedCount = last + 1;
  const bytes = new Uint8Array(Math.ceil(usedCount / 4));

  for (let i = 0; i < usedCount; i++) {
    const byteIndex = Math.floor(i / 4);
    const shift = (i % 4) * 2;

    bytes[byteIndex] |= (counts[i] & 0b11) << shift;
  }

  return bytesToBase64Url(bytes);
}

function decodeState(hash) {
  try {
    if (!hash) return {};

    const bytes = base64UrlToBytes(hash);
    const result = {};
    const maxCards = Math.min(CARDS.length, bytes.length * 4);

    for (let i = 0; i < maxCards; i++) {
      const byteIndex = Math.floor(i / 4);
      const shift = (i % 4) * 2;
      const count = (bytes[byteIndex] >> shift) & 0b11;

      if (count > 0) {
        result[CARDS[i].id] = count;
      }
    }

    return result;
  } catch (error) {
    console.warn("共有データの読み込みに失敗しました。", error);
    return null;
  }
}

function applyHash() {
  const hash = location.hash.slice(1);

  if (!hash) return;

  const decoded = decodeState(hash);

  if (decoded === null) return;

  owned = decoded;
  saveOwned();
}

function shareToX() {
  const state = encodeState();
  const hash = state ? `#${state}` : "";

  const url =
    location.origin +
    location.pathname +
    location.search +
    hash;

  const activeTab = getActiveTab();
  const cards = getCardsForStats(activeTab);
  const percentage = getPercentage(cards);
  const tabLabel = activeTab === "all" ? "" : getSeriesLabel(activeTab);

  const text =
    "🎀アイカツ！アンコール🎀\nカード所持率チェッカー\n" +
    `あなたの${tabLabel}${tabLabel ? "の" : ""}カード所持率は${percentage}%でした。`;

  const shareUrl =
    "https://twitter.com/intent/tweet" +
    "?text=" + encodeURIComponent(text) +
    "&url=" + encodeURIComponent(url) +
    "&hashtags=" +
    encodeURIComponent("アイカツ,アイカツアンコール,aikatsu,aikatsuencore");

  const shareBtn = document.getElementById("shareBtn");

  if (shareBtn) {
    shareBtn.href = shareUrl;
  }
}

/* =========================================================
   設定ボタン
========================================================= */

function syncMultiChoice(setting, selected, values) {
  const allSelected = values.every(value => selected.has(value));

  document.querySelectorAll(
    `.choice-btn[data-setting="${setting}"]`
  ).forEach(button => {
    const value = button.dataset.value;

    const pressed = value === "all"
      ? allSelected
      : selected.has(value);

    button.setAttribute("aria-pressed", String(pressed));
  });
}

function setupAccordionSettings() {
  const toggle = document.getElementById("settingsToggleBtn");
  const panel = document.getElementById("displaySettingsPanel");

  let closeTimer = null;

  /*
   * パネルの開閉状態を更新する。
   * SVGアイコンの中身は変更せず、CSSで回転させる。
   */
  function setPanelOpen(open) {
    if (!toggle || !panel) return;

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    toggle.setAttribute("aria-expanded", String(open));

    if (open) {
      panel.hidden = false;
      panel.classList.remove("is-open");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panel.classList.add("is-open");
        });
      });
    } else {
      panel.classList.remove("is-open");

      closeTimer = setTimeout(() => {
        panel.hidden = true;
        closeTimer = null;
      }, 260);
    }
  }

  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";

      setPanelOpen(!isOpen);
    });

    // 初期状態をHTMLのパネル状態に合わせる。
    const initiallyOpen = !panel.hidden;

    toggle.setAttribute("aria-expanded", String(initiallyOpen));

    if (initiallyOpen) {
      requestAnimationFrame(() => {
        panel.classList.add("is-open");
      });
    }

    /*
     * メニュー外をクリック・タップしたら閉じる。
     * ただしハンバーガーメニュー内のクリックは横取りしない。
     */
    document.addEventListener("click", event => {
      const isOpen =
        toggle.getAttribute("aria-expanded") === "true";

      if (!isOpen) return;

      if (toggle.contains(event.target)) return;
      if (panel.contains(event.target)) return;

      // ハンバーガーメニューを操作できるようにする。
      const navArea = document.getElementById("navArea");

      if (navArea && navArea.contains(event.target)) {
        setPanelOpen(false);
        return;
      }

      // メニュー外へのクリック処理をここで止める。
      event.preventDefault();
      event.stopPropagation();

      setPanelOpen(false);
    }, true);
  }

  const multiValues = {
    count: ["0", "1", "2", "3plus"],
    rarity: ["PR", "R", "N", "ER"]
  };

  document.querySelectorAll(".choice-btn").forEach(button => {
    button.addEventListener("click", () => {
      const { setting, value } = button.dataset;

      if (setting === "size") {
        isExpanded = value === "large";

        document.querySelectorAll(
          '.choice-btn[data-setting="size"]'
        ).forEach(item => {
          item.setAttribute(
            "aria-pressed",
            String(item.dataset.value === value)
          );
        });

        render();
        updateStats();
        shareToX();

      } else if (setting === "parallel") {
        showParallel = value === "show";

        document.querySelectorAll(
          '.choice-btn[data-setting="parallel"]'
        ).forEach(item => {
          item.setAttribute(
            "aria-pressed",
            String(item.dataset.value === value)
          );
        });

        render();
        updateStats();
        shareToX();

      } else if (setting === "count" || setting === "rarity") {
        const values = multiValues[setting];

        const selected = setting === "count"
          ? countFilters
          : rarityFilters;

        if (value === "all") {
          const allSelected = values.every(item => selected.has(item));

          if (allSelected) {
            selected.clear();
          } else {
            values.forEach(item => selected.add(item));
          }
        } else {
          if (selected.has(value)) {
            selected.delete(value);
          } else {
            selected.add(value);
          }
        }

        syncMultiChoice(setting, selected, values);
        render();
        updateStats();
        shareToX();

      } else if (setting === "unowned") {
        unownedDisplay = value;

        document.querySelectorAll(
          '.choice-btn[data-setting="unowned"]'
        ).forEach(item => {
          item.setAttribute(
            "aria-pressed",
            String(item.dataset.value === value)
          );
        });

        render();

      } else {
        return;
      }

      updateStickyHeaderHeight();
    });
  });

  document.querySelectorAll(
    '.choice-btn[data-setting="size"]'
  ).forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.value === (isExpanded ? "large" : "small"))
    );
  });

  document.querySelectorAll(
    '.choice-btn[data-setting="parallel"]'
  ).forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.value === (showParallel ? "show" : "hide"))
    );
  });

  syncMultiChoice("count", countFilters, multiValues.count);
  syncMultiChoice("rarity", rarityFilters, multiValues.rarity);

  document.querySelectorAll(
    '.choice-btn[data-setting="unowned"]'
  ).forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.value === unownedDisplay)
    );
  });
}

/* =========================================================
   ハンバーガーメニュー
========================================================= */

function setupHamburgerMenu() {
  const navArea = document.getElementById("navArea");
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("siteMenu");
  const mask = document.getElementById("menuMask");

  if (!navArea || !toggle || !menu || !mask) return;

  function setMenuOpen(open) {
    navArea.classList.toggle("open", open);

    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "メニューを閉じる" : "メニューを開く"
    );

    menu.setAttribute("aria-hidden", String(!open));
    menu.inert = !open;
  }

  // ボタンで開閉する。
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";

    setMenuOpen(!isOpen);
  });

  // 背景マスクを押したら閉じる。
  mask.addEventListener("click", () => {
    setMenuOpen(false);
  });

  // メニュー内のリンクを押したら閉じる。
  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      setMenuOpen(false);
    });
  });

  // Escキーで閉じる。
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        setMenuOpen(false);
        toggle.focus();
      }
    }
  });
}

/* =========================================================
   ヘッダー高さ
========================================================= */

function updateStickyHeaderHeight() {
  const header = document.querySelector("header");
  const tabs = document.querySelector(".tabs");

  if (header) {
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.offsetHeight}px`
    );
  }

  if (header && tabs) {
    const tabsBottom =
      header.offsetHeight + tabs.offsetHeight;

    document.documentElement.style.setProperty(
      "--tabs-bottom",
      `${tabsBottom}px`
    );
  }
}

/* =========================================================
   画像保存
========================================================= */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = () => reject(
      new Error(`画像を読み込めませんでした: ${src}`)
    );

    img.src = src;
  });
}

async function drawCardToCanvas(ctx, card, count, x, y, width, height) {
  try {
    const img = await loadImage(card.image);

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(x, y, width, height);

    const imageWidth = img.naturalWidth || img.width;
    const imageHeight = img.naturalHeight || img.height;

    if (imageWidth <= imageHeight) {
      const scale = Math.min(
        width / imageWidth,
        height / imageHeight
      );

      const drawWidth = imageWidth * scale;
      const drawHeight = imageHeight * scale;

      ctx.drawImage(
        img,
        x + (width - drawWidth) / 2,
        y + (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    } else {
      const drawWidthBeforeRotate = width * 1.4576;

      const drawHeightBeforeRotate =
        drawWidthBeforeRotate * imageHeight / imageWidth;

      const fitScale = Math.min(
        1,
        width / drawHeightBeforeRotate,
        height / drawWidthBeforeRotate
      );

      const drawWidth = drawWidthBeforeRotate * fitScale;
      const drawHeight = drawHeightBeforeRotate * fitScale;

      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(Math.PI / 2);

      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );

      ctx.restore();
    }

    if (count === 0 && unownedDisplay === "gray") {
      const imageData = ctx.getImageData(
        Math.round(x),
        Math.round(y),
        Math.round(width),
        Math.round(height)
      );

      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray =
          data[i] * 0.2126 +
          data[i + 1] * 0.7152 +
          data[i + 2] * 0.0722;

        data[i] = gray * 0.7;
        data[i + 1] = gray * 0.7;
        data[i + 2] = gray * 0.7;
      }

      ctx.putImageData(
        imageData,
        Math.round(x),
        Math.round(y)
      );
    }

    if (count > 0 || (count === 0 && unownedDisplay === "color")) {
      const badgeText = count >= 3 ? "3+" : String(count);
      const badgeSize = Math.max(28, Math.round(width * 0.25));
      const radius = badgeSize / 2;
      const badgeX = x + width - radius - 5;
      const badgeY = y + radius + 5;

      ctx.fillStyle = count === 0 ? "#1689ff" : "#ff4757";
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = `900 ${Math.max(16, Math.round(badgeSize * 0.52))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, badgeX, badgeY);
    }

  } catch (error) {
    console.warn(
      `カード画像の描画に失敗しました: ${card.id}`,
      error
    );

    ctx.fillStyle = "#eee";
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = "#777";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.id, x + width / 2, y + height / 2);
  }
}

function calculateSaveColumns(cardCount) {
  const minColumns = 2;
  const maxColumns = 12;
  const cardWidth = 160;
  const cardHeight = Math.round(cardWidth * 86 / 59);
  const gap = 8;
  const horizontalPadding = 24;
  const topArea = 100;
  const bottomPadding = 24;
  const targetRatio = 3 / 4;

  let bestColumns = minColumns;
  let bestDifference = Infinity;

  for (let columns = minColumns; columns <= maxColumns; columns++) {
    const rows = Math.ceil(cardCount / columns);

    const canvasWidth =
      horizontalPadding * 2 +
      columns * cardWidth +
      (columns - 1) * gap;

    const canvasHeight =
      topArea +
      rows * cardHeight +
      (rows - 1) * gap +
      bottomPadding;

    const difference = Math.abs(
      canvasWidth / canvasHeight - targetRatio
    );

    if (difference < bestDifference) {
      bestDifference = difference;
      bestColumns = columns;
    }
  }

  return bestColumns;
}

async function saveCollectionImage() {
  const button = document.getElementById("saveImageBtn");

  if (button) {
    button.classList.add("is-saving");
    button.disabled = true;
  }

  try {
    const activeTab = getActiveTab();
    const cards = getCardsForTab(activeTab);
    const statsCards = getCardsForStats(activeTab);

    if (!cards.length) {
      alert("保存するカードがありません。");
      return;
    }

    const columns = calculateSaveColumns(cards.length);
    const cardWidth = 160;
    const cardHeight = Math.round(cardWidth * 86 / 59);
    const gap = 8;
    const horizontalPadding = 24;
    const topArea = 100;
    const bottomPadding = 24;
    const rows = Math.ceil(cards.length / columns);

    const canvas = document.createElement("canvas");

    canvas.width =
      horizontalPadding * 2 +
      columns * cardWidth +
      (columns - 1) * gap;

    canvas.height =
      topArea +
      rows * cardHeight +
      (rows - 1) * gap +
      bottomPadding;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff7fd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#e85b9d";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font = columns < 4
      ? "bold 15px sans-serif"
      : "bold 30px sans-serif";

    ctx.fillText(
      "🎀 アイカツ！アンコール カード所持状況 🎀",
      horizontalPadding,
      18
    );

    const tabLabel = activeTab === "all"
      ? "すべて"
      : getSeriesLabel(activeTab);

    // 選択中のレアリティを取得
    const rarityLabel = ["PR", "R", "N", "ER"]
      .filter(rarity => rarityFilters.has(rarity))
      .join(" / ") || "該当なし";

    ctx.fillStyle = "#e85b9d";
    ctx.font = columns < 4
      ? "bold 9px sans-serif"
      : "bold 18px sans-serif";

    // タブ名
    ctx.fillText(tabLabel, horizontalPadding, 58);

    // レアリティをタブ名の右側に表示
    const tabWidth = ctx.measureText(tabLabel).width;
    const rarityX = horizontalPadding + tabWidth + 16;

    ctx.font = "bold 16px sans-serif";
    ctx.fillText(rarityLabel, rarityX, 59);

    // 所持枚数の表示位置をレアリティの長さに合わせる
    const rarityWidth = ctx.measureText(rarityLabel).width;
    const ownedX = rarityX + rarityWidth + 24;

    ctx.font = columns < 4
      ? "bold 9px sans-serif"
      : "bold 18px sans-serif";
    ctx.fillText(
      `所持：${getOwnedCount(statsCards)} / ${statsCards.length}枚（${getPercentage(statsCards)}%）`,
      ownedX,
      58
    );

    for (let i = 0; i < cards.length; i++) {
      const row = Math.floor(i / columns);
      const column = i % columns;

      const x = horizontalPadding + column * (cardWidth + gap);
      const y = topArea + row * (cardHeight + gap);

      await drawCardToCanvas(
        ctx,
        cards[i],
        getCardCount(cards[i].id),
        x,
        y,
        cardWidth,
        cardHeight
      );
    }

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error("PNGの生成に失敗しました。");
    }

    const dateString = new Date().toISOString().slice(0, 10);
    const fileName = `aikatsu-encore-${activeTab}-${dateString}.png`;
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    console.error("画像保存に失敗しました。", error);

    alert(
      "画像の保存に失敗しました。\n" +
      "画像を読み込めないカードがある可能性があります。"
    );

  } finally {
    if (button) {
      button.classList.remove("is-saving");
      button.disabled = false;
    }
  }
}

function setupSaveImage() {
  const button = document.getElementById("saveImageBtn");

  if (button) {
    button.addEventListener("click", saveCollectionImage);
  }
}

/* =========================================================
   所持データのクリア
========================================================= */

function setupClearButton() {
  const clearBtn = document.getElementById("clearBtn");

  if (!clearBtn) return;

  clearBtn.addEventListener("click", () => {
    if (!confirm("すべての所持数を0に戻しますか？")) return;

    owned = {};
    saveOwned();
    render();
    updateStats();
    shareToX();

    history.replaceState(
      null,
      "",
      location.pathname + location.search
    );
  });
}

/* =========================================================
   メニュー項目の中央ウィンドウ
========================================================= */

function setupInfoModals() {
  const navArea = document.getElementById("navArea");
  const menu = document.getElementById("siteMenu");
  const menuToggle = document.getElementById("menuToggle");

  if (!navArea || !menu || !menuToggle) return;

  // 二重登録を防止
  if (document.querySelector(".info-modal-overlay")) return;

  const modalContents = {

    "about-site": {
      title: "このサイトについて",
      content: `
        <p>「アイカツ！アンコールカード所持率チェッカー」は、カードの所持状況を記録・確認するための非公式ファン制作ツールです。</p>
        <p>カードの所持状況をチェックしたり、画像として保存したり、Xで共有したりできます。</p>
        <p>所持データはお使いのブラウザ内・共有リンクに保存されます。共有リンクには、リンクを作成した時点の所持状況が保存されます。所持データが管理者のサーバーに自動送信されることはありません。</p>
        <p>更新情報や機能についてのご意見・ご要望は、お問い合わせメニューからお寄せください。</p>
      `
    },

    "how-to-use": {
      title: "使い方",
      content: `
        <p>アイカツ！アンコールのカード所持状況を記録できるチェッカーです。</p>
        <ol>
          <li>会員登録・ログイン不要で利用できます。</li>
          <li>所持データはサーバーおよび管理者に送信・収集・保存されません。</li>
          <li>タブで弾を選択できます。</li>
          <li>カードをタップして、所持数を切り替えます。</li>
          <li>所持枚数はタップごとに0→1→2→3+→0と切り替わります。</li>
          <li>「表示」メニューから、カードサイズやレアリティ、所持数などの表示条件を変更できます。</li>
          <li>画像保存やX共有を使って、所持状況を保存・共有できます。</li>
        </ol>
        <p class="notice">所持データは共有リンクに保存されます。ブラウザのデータを削除すると、記録が失われる場合があります。<br>
        リンクをポスト、またはメモ帳などにコピーして保存してください。
        </p>
      `
    },

    "updates": {
      title: "更新情報",
      content: `
        <div class="update-item">
          <span class="update-date">2026年10月13日</span>
          <strong>メニューを追加♪</strong>
          <p>メニューに使い方、更新情報、お問い合わせ、免責事項の項目を追加しました。</p>
          <p>今後の更新内容もこちらに掲載していきます。</p>
          <p>「こんな機能がほしい！」などのご意見・ご要望も、お問い合わせ先までお気軽にお寄せください。</p>
        </div>
        <div class="update-item">
          <span class="update-date">2026年10月10日</span>
          <strong>[表示]ボタンを追加♪</strong>
          <p>[表示]ボタンで表示するカードを絞り込めます。</p>
          <p>従来のカードサイズ、パラレルカード表示、所持未所持絞り込み機能はこちらに移動しました。</p>
          <p>所持未所持絞り込み機能はカード枚数で絞り込みするよう変更しました。</p>
          <p>未所持カード：0枚で絞り込み  所持カード：1枚、2枚、3枚以上で絞り込み</p>
          <p>未所持カードをカラーでも表示できるように更新しました。</p>
        </div>
        <div class="update-item">
          <span class="update-date">2026年10月9日</span>
          <strong>[パラレルを表示]ボタンを追加♪</strong>
          <p>[パラレルを表示]ボタンでパラレルカードの表示/非表示を切り替えられます。</p>
          <p>パラレルイラストのネタバレ防止のためサイトアクセス時は非表示になっています。</p>
        </div>
        <div class="update-item">
          <span class="update-date">2026年10月8日</span>
          <strong>プロモーションカードを追加♪</strong>
          <p>10月8日セブンイレブンにて配布開始のプロモーションカードを追加しました。</p>
        </div>
        <div class="update-item">
          <span class="update-date">2026年10月9日</span>
          <strong>アイカツ！アンコール稼働開始♪</strong>
          <p>アイカツ！アンコール稼働開始に合わせて本サイトをオープンしました！</p>
          <p>アイカツ！アンコールのカードの所持率の確認や所持カードを画像で出力できるサイトです。</p>
          <p>所持カードや未所持カードの確認、交換用の画像作成などにご活用ください！</p>
        </div>
      `
    },

    "contact": {
      title: "お問い合わせ",
      content: `
        <p>不具合の報告、更新情報へのご意見、ご要望などがありましたら、Xのアカウントまでお気軽にご連絡ください。</p>
        <p>更新情報、追加予定の機能など発信していますのでフォローお願いいたします！</p>
        <p style="text-align:center;">
          <a class="contact-link"
             href="https://x.com/_min_pretty"
             target="_blank"
             rel="noopener noreferrer">
            𝕏　@_min_pretty
          </a>
        </p>
        <p>「こんなカード情報がほしい」「ここをもっと使いやすくしてほしい」といったご意見も歓迎しています。</p>
        <p class="notice">当サイトに関して、公式運営元やゲームセンター等へのお問い合わせはご遠慮ください。</p>
      `
    },

    "disclaimer": {
      title: "免責事項",
      content: `
        <p>当サイトは、ファンが制作・運営する非営利の非公式サイトです。作品の公式運営元、権利者、関連企業等とは関係ありません。</p>
        <p>掲載情報は、正確性・完全性・最新性を保証するものではありません。</p>
        <p>当サイトの掲載内容・機能に関して、告知なく変更及び公開を終了する可能性があります。</p>
        <p>当サイトの利用によって生じた損害および利用者間でのトラブルについて、運営者は責任を負いかねます。</p>
        <p>作品名、ロゴ、画像その他の著作物・商標等に関する権利は、それぞれの権利者に帰属します。</p>
      `
    }

  };

  // ウィンドウを生成
  const overlay = document.createElement("div");
  overlay.className = "info-modal-overlay";
  overlay.innerHTML = `
    <section
      class="info-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="infoModalTitle"
      tabindex="-1"
    >
      <header class="info-modal-header">
        <h2 class="info-modal-title" id="infoModalTitle"></h2>
        <button
          type="button"
          class="info-modal-close"
          aria-label="ウィンドウを閉じる"
        >×</button>
      </header>
      <div class="info-modal-content"></div>
    </section>
  `;

  document.body.appendChild(overlay);

  const modal = overlay.querySelector(".info-modal");
  const modalTitle = overlay.querySelector(".info-modal-title");
  const modalContent = overlay.querySelector(".info-modal-content");
  const closeButton = overlay.querySelector(".info-modal-close");

  let previousFocus = null;

  function closeMenu() {
    navArea.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "メニューを開く");
    menu.setAttribute("aria-hidden", "true");
    menu.setAttribute("inert", "");
  }

  function openModal(key) {
    const data = modalContents[key];
    if (!data) return;

    previousFocus = menuToggle;

    // メニューを閉じてからウィンドウを表示
    closeMenu();

    modalTitle.textContent = data.title;
    modalContent.innerHTML = data.content;
    modalContent.scrollTop = 0;

    overlay.classList.add("is-visible");
    document.body.style.overflow = "hidden";

    closeButton.focus();
  }

  function closeModal() {
    if (!overlay.classList.contains("is-visible")) return;

    overlay.classList.remove("is-visible");
    document.body.style.overflow = "";

    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  }

  // メニュー項目をクリック
  menu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-modal]");
    if (!button) return;

    event.preventDefault();
    openModal(button.dataset.modal);
  });

  // × ボタンで閉じる
  closeButton.addEventListener("click", closeModal);

  // ウィンドウの外側をクリックして閉じる
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  // Escape キーで閉じる
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      overlay.classList.contains("is-visible")
    ) {
      closeModal();
    }
  });
}

/* =========================================================
   初期化
========================================================= */

function init() {
  loadOwned();
  applyHash();
  setupTabs();
  setupAccordionSettings();
  setupHamburgerMenu();
  setupInfoModals();
  render();
  updateStats();
  shareToX();
  setupSaveImage();
  setupClearButton();
  updateStickyHeaderHeight();

  window.addEventListener("resize", updateStickyHeaderHeight);
}

init();