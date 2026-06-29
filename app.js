const STORAGE_KEY = "xianyu-deal-scout:v1";

const form = document.querySelector("#dealForm");
const scoreValue = document.querySelector("#scoreValue");
const scoreRing = document.querySelector("#scoreRing");
const verdict = document.querySelector("#verdict");
const summary = document.querySelector("#summary");
const priceMetric = document.querySelector("#priceMetric");
const qualityMetric = document.querySelector("#qualityMetric");
const sellerMetric = document.querySelector("#sellerMetric");
const actionList = document.querySelector("#actionList");
const riskList = document.querySelector("#riskList");
const offerRange = document.querySelector("#offerRange");
const saveState = document.querySelector("#saveState");
const resetButton = document.querySelector("#resetButton");
const guideList = document.querySelector("#guideList");

const positiveWords = ["自用", "一手", "无拆", "无修", "验货宝", "同城", "面交", "国行", "发票", "保修", "实拍"];
const riskWords = ["急出", "不退", "不议价", "微瑕", "渠道", "库存", "批发", "靓机", "资源机", "定金", "绕平台", "秒发"];

const guides = [
  ["价格", "先比 3-5 个同型号成交价，低于市场 15%-30% 才算有捡漏空间。"],
  ["成色", "让卖家补边角、屏幕、接口、序列号遮挡图和功能测试视频。"],
  ["卖家", "主页长期大量同类商品、图片风格统一、话术重复时，按二道贩子处理。"],
  ["交易", "优先同城验机或平台验货服务，不跳平台，不付定金，不私下转账。"],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getChecked(name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function getFormData() {
  return {
    itemName: form.itemName.value.trim(),
    askPrice: Number(form.askPrice.value || 0),
    marketPrice: Number(form.marketPrice.value || 0),
    condition: Number(form.condition.value),
    proof: Number(form.proof.value),
    description: form.description.value.trim(),
    sellerSignals: getChecked("sellerSignals"),
    tradeSignals: getChecked("tradeSignals"),
  };
}

function analyze(data) {
  const discount = data.marketPrice > 0 ? 1 - data.askPrice / data.marketPrice : 0;
  const priceScore = clamp(42 + discount * 190, 15, 100);

  const text = data.description.toLowerCase();
  const positiveHits = positiveWords.filter((word) => text.includes(word.toLowerCase())).length;
  const riskHits = riskWords.filter((word) => text.includes(word.toLowerCase())).length;

  const qualityScore = clamp(data.condition * 0.58 + data.proof * 0.28 + positiveHits * 4 - riskHits * 5, 10, 100);

  let sellerRisk = 38;
  if (data.sellerSignals.includes("personal")) sellerRisk -= 12;
  if (data.sellerSignals.includes("realPhotos")) sellerRisk -= 10;
  if (data.sellerSignals.includes("inspection")) sellerRisk -= 12;
  if (data.tradeSignals.includes("sameCity")) sellerRisk -= 6;
  if (data.tradeSignals.includes("platformPay")) sellerRisk -= 8;
  if (data.tradeSignals.includes("noDeposit")) sellerRisk -= 6;
  if (data.sellerSignals.includes("bulkSeller")) sellerRisk += 26;
  if (data.sellerSignals.includes("stockCopy")) sellerRisk += 18;
  if (data.sellerSignals.includes("avoidDetail")) sellerRisk += 28;
  sellerRisk += riskHits * 7;
  sellerRisk = clamp(sellerRisk, 0, 100);

  const safetyScore = 100 - sellerRisk;
  const total = Math.round(priceScore * 0.34 + qualityScore * 0.34 + safetyScore * 0.32);
  const ask = data.askPrice || data.marketPrice || 0;
  const lowOffer = Math.max(0, Math.round(ask * (sellerRisk > 50 ? 0.82 : 0.88)));
  const highOffer = Math.max(lowOffer, Math.round(ask * (sellerRisk > 50 ? 0.9 : 0.95)));

  return {
    total,
    discount,
    priceScore: Math.round(priceScore),
    qualityScore: Math.round(qualityScore),
    sellerRisk: Math.round(sellerRisk),
    lowOffer,
    highOffer,
    positiveHits,
    riskHits,
  };
}

function verdictFor(score, sellerRisk) {
  if (score >= 82 && sellerRisk <= 35) return ["值得重点跟进", "价格和可信度都不错，适合进入验货和压价阶段。"];
  if (score >= 68) return ["可以谨慎捡漏", "有价格优势，但仍要把关键验货项问清楚。"];
  if (score >= 52) return ["只适合观望", "亮点不够稳定，建议继续比价或等卖家补充证据。"];
  return ["不建议入手", "价格、成色或卖家信号存在明显短板，容易踩坑。"];
}

function buildActions(data, result) {
  const actions = [];
  if (result.discount >= 0.18) actions.push("先收藏并尽快沟通，低价商品容易被拍走。");
  if (!data.sellerSignals.includes("realPhotos")) actions.push("要求补实拍细节图，特别是边角、屏幕、接口和配件。");
  if (!data.sellerSignals.includes("inspection")) actions.push("询问是否支持验货宝或同城验机，不支持就下调预算。");
  if (data.proof < 70) actions.push("追问购买来源、保修状态和序列号，不能自洽就放弃。");
  actions.push("按建议出价区间先低后高，保留“验货不符可退”的聊天记录。");
  return actions;
}

function buildRisks(data, result) {
  const risks = [];
  if (result.sellerRisk >= 55) risks.push("卖家风险偏高，疑似商家/二道贩子或交易条件不够安全。");
  if (data.sellerSignals.includes("bulkSeller")) risks.push("主页大量同类商品，按职业卖家定价，不要用个人闲置标准判断。");
  if (data.sellerSignals.includes("stockCopy")) risks.push("批量话术会掩盖真实瑕疵，需要逐项让卖家确认。");
  if (data.sellerSignals.includes("avoidDetail")) risks.push("拒绝补图或拒绝解释细节是强风险信号。");
  if (result.riskHits > 0) risks.push("描述里出现急出、库存、定金等风险词，交易前要降低信任。");
  if (risks.length === 0) risks.push("暂未发现强风险，但仍需完成验货清单。");
  return risks;
}

function renderList(node, items) {
  node.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    node.appendChild(li);
  });
}

function renderGuides() {
  guideList.innerHTML = "";
  guides.forEach(([title, text]) => {
    const card = document.createElement("article");
    card.className = "guide-card";
    card.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
    guideList.appendChild(card);
  });
}

function render() {
  const data = getFormData();
  const result = analyze(data);
  const [verdictText, summaryText] = verdictFor(result.total, result.sellerRisk);
  const colorClass = result.total >= 75 ? "score-good" : result.total >= 58 ? "score-warn" : "score-bad";

  scoreValue.textContent = result.total;
  scoreValue.className = colorClass;
  scoreRing.style.setProperty("--score-deg", `${result.total * 3.6}deg`);
  verdict.textContent = verdictText;
  summary.textContent = summaryText;
  priceMetric.textContent = `${Math.round(result.discount * 100)}% 优惠`;
  qualityMetric.textContent = `${result.qualityScore}/100`;
  sellerMetric.textContent = `${result.sellerRisk}/100`;
  sellerMetric.className = result.sellerRisk > 55 ? "score-bad" : result.sellerRisk > 35 ? "score-warn" : "score-good";
  offerRange.textContent = `¥${result.lowOffer.toLocaleString()} - ¥${result.highOffer.toLocaleString()}`;

  renderList(actionList, buildActions(data, result));
  renderList(riskList, buildRisks(data, result));
  save();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData()));
  saveState.textContent = "已自动保存";
}

function restore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    form.itemName.value = data.itemName || "";
    form.askPrice.value = data.askPrice || "";
    form.marketPrice.value = data.marketPrice || "";
    form.condition.value = String(data.condition || 88);
    form.proof.value = String(data.proof || 82);
    form.description.value = data.description || "";

    form.querySelectorAll("input[type='checkbox']").forEach((input) => {
      const group = input.name === "sellerSignals" ? data.sellerSignals : data.tradeSignals;
      input.checked = Array.isArray(group) && group.includes(input.value);
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

form.addEventListener("input", () => {
  saveState.textContent = "正在保存";
  render();
});

form.addEventListener("change", render);

resetButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

renderGuides();
restore();
render();
