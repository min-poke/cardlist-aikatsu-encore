// series: "1" = 1弾, "promo" = プロモーション
// id はユニークであれば何でもOK（カードナンバー推奨）
// image は公式サイトから直接取ってきたURLを入れてください

const CARDS = [
  // ===== 1弾 =====
  // 公式カードリストから画像URLをコピーして追加してください
  // 例:
  // { id: "01-01", name: "オーロラキスキャミソール", series: "1", image: "https://dcd.aikatsu.com/encore/xxxxx.jpg" },
  
  // 仮データ（動作確認用）※実際の画像URLに置き換えてください
  { id: "01-01", name: "オーロラキスキャミソール", series: "1", image: "https://via.placeholder.com/118x172?text=01-01" },
  { id: "01-02", name: "サンプルカード2", series: "1", image: "https://via.placeholder.com/118x172?text=01-02" },
  { id: "01-03", name: "サンプルカード3", series: "1", image: "https://via.placeholder.com/118x172?text=01-03" },

  // ===== プロモーション =====
  { id: "EP-001", name: "ピンクステージベスト＆スカート", series: "promo", image: "https://via.placeholder.com/118x172?text=EP-001" },
  { id: "EP-002", name: "レジェンダリールージュティアラ", series: "promo", image: "https://via.placeholder.com/118x172?text=EP-002" },
  { id: "EP-003", name: "プロモサンプル", series: "promo", image: "https://via.placeholder.com/118x172?text=EP-003" },
];