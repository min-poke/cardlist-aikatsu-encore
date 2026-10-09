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
    cards = cards.filter(card => String(card.series) === String(tab));
  }

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
  if (ownedPercentage) ownedPercentage.textContent = getPercentage(cards);
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
  if (shareBtn) shareBtn.href = shareUrl;
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

      // アニメーションを確実に開始するため、クラスを一度外す。
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
   ヘッダー高さ
   ========================================================= */

function updateStickyHeaderHeight() {
  const header = document.querySelector("header");
  if (!header) return;

  document.documentElement.style.setProperty(
    "--header-height",
    `${header.offsetHeight}px`
  );
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
      const badgeSize = Math.max(22, Math.round(width * 0.20));
      const radius = badgeSize / 2;
      const badgeX = x + width - radius - 5;
      const badgeY = y + radius + 5;

      ctx.fillStyle = count === 0 ? "#1689ff" : "#ff4757";
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(12, Math.round(badgeSize * 0.48))}px sans-serif`;
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
  const minColumns = 4;
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
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      "🎀 アイカツ！アンコール カード所持状況 🎀",
      horizontalPadding,
      18
    );

    const tabLabel = activeTab === "all"
      ? "すべて"
      : getSeriesLabel(activeTab);

    ctx.fillStyle = "#e85b9d";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(tabLabel, horizontalPadding, 58);

    ctx.fillStyle = "#e85b9d";

    const ownedX =
      horizontalPadding + ctx.measureText(tabLabel).width + 24;

    ctx.fillText(
      `所持：${getOwnedCount(cards)} / ${cards.length}枚（${getPercentage(cards)}%）`,
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
   初期化
   ========================================================= */

function init() {
  loadOwned();
  applyHash();
  setupTabs();
  setupAccordionSettings();
  render();
  updateStats();
  shareToX();
  setupSaveImage();
  setupClearButton();
  updateStickyHeaderHeight();

  window.addEventListener("resize", updateStickyHeaderHeight);
}

init();
