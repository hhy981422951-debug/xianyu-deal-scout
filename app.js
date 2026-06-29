const STORAGE_KEY = "xianyu-link-scout:v2";

const dealLink = document.querySelector("#dealLink");
const pasteButton = document.querySelector("#pasteButton");
const analyzeButton = document.querySelector("#analyzeButton");
const clearButton = document.querySelector("#clearButton");
const linkScore = document.querySelector("#linkScore");
const linkStatus = document.querySelector("#linkStatus");
const itemId = document.querySelector("#itemId");
const actionLevel = document.querySelector("#actionLevel");
const actionSummary = document.querySelector("#actionSummary");
const checkGrid = document.querySelector("#checkGrid");
const riskList = document.querySelector("#riskList");
const messageBox = document.querySelector("#messageBox");
const copyMessageButton = document.querySelector("#copyMessageButton");
const historyList = document.querySelector("#historyList");

const defaultChecks = [
  ["价格核对", "打开原链接，比对同型号近 3-5 个在售价，低于常见价 15% 以上再继续。"],
  ["成色核对", "要求补边角、屏幕、接口、配件、序列号遮挡图和开机/功能视频。"],
  ["卖家核对", "点进主页看是否大量同类商品、统一背景图、同款批量文案。"],
  ["交易核对", "优先同城面交或平台验货，不跳平台，不付定金，不私下转账。"],
];

const defaultRisks = [
  "链接只能证明商品入口存在，不能证明价格真实、成色真实或卖家身份真实。",
  "如果链接跳转后要求私聊转账、加微信或先付定金，直接按高风险处理。",
  "如果主页长期卖同类数码/奢品/潮玩，默认不是个人闲置，要按职业卖家标准压价。",
];

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[，。；、)）]+$/, "") : trimmed;
}

function parseLink(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return { ok: false, reason: "还没有粘贴链接", normalized: "", host: "", id: "" };
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "");
    const isXianyu =
      host.includes("goofish.com") ||
      host.includes("xianyu") ||
      host.includes("2.taobao.com") ||
      host.includes("m.tb.cn");
    const id =
      url.searchParams.get("id") ||
      url.searchParams.get("itemId") ||
      url.searchParams.get("item_id") ||
      (url.pathname.match(/(\d{8,})/) || [])[1] ||
      "";

    let score = 48;
    if (isXianyu) score += 28;
    if (id) score += 18;
    if (host.includes("m.tb.cn")) score += 6;
    score = Math.min(score, 98);

    return { ok: true, normalized, host, id, isXianyu, score };
  } catch {
    return { ok: false, reason: "链接格式不太对，建议复制完整分享链接", normalized, host: "", id: "" };
  }
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const history = getHistory().filter((entry) => entry.url !== item.url);
  history.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 5)));
}

function renderChecks() {
  checkGrid.innerHTML = "";
  defaultChecks.forEach(([title, body]) => {
    const card = document.createElement("article");
    card.className = "check-item";
    card.innerHTML = `<strong>${title}</strong><p>${body}</p>`;
    checkGrid.appendChild(card);
  });
}

function renderRisks(extra = []) {
  riskList.innerHTML = "";
  [...extra, ...defaultRisks].forEach((risk) => {
    const li = document.createElement("li");
    li.textContent = risk;
    riskList.appendChild(li);
  });
}

function buildMessage(result) {
  const idText = result.id ? `商品 ID 我看到是 ${result.id}。` : "我从链接里没有直接识别到商品 ID。";
  return `你好，我对这个商品有兴趣，想确认几个细节：\n\n1. ${idText}\n2. 这是你个人自用一手闲置吗？是否有购买记录或保修凭证？\n3. 能否补一下边角、屏幕/外观、接口、配件和功能测试视频？\n4. 是否支持平台担保交易、验货宝或同城当面验货？\n5. 如果验货与描述不一致，是否支持按平台规则处理？\n\n这些都没问题的话，我再根据成色和同款行情认真出价。`;
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = "";
  if (!history.length) {
    historyList.innerHTML = `<div class="history-item"><p>还没有分析记录。</p></div>`;
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `<button type="button">${entry.host || "闲鱼链接"}</button><p>${entry.id || "未识别商品 ID"}</p>`;
    item.querySelector("button").addEventListener("click", () => {
      dealLink.value = entry.url;
      analyze();
    });
    historyList.appendChild(item);
  });
}

function analyze() {
  const result = parseLink(dealLink.value);

  if (!result.ok) {
    linkScore.textContent = "--";
    linkScore.className = "score-bad";
    linkStatus.textContent = result.reason;
    itemId.textContent = "未识别";
    actionLevel.textContent = "先粘贴";
    actionSummary.textContent = "复制闲鱼商品分享链接后再点开始识别。";
    messageBox.value = "粘贴商品链接后，会自动生成给卖家的核验话术。";
    renderRisks(["当前没有可分析的有效链接。"]);
    return;
  }

  linkScore.textContent = `${result.score}`;
  linkScore.className = result.score >= 82 ? "score-good" : result.score >= 62 ? "score-warn" : "score-bad";
  linkStatus.textContent = result.isXianyu ? "识别为闲鱼/淘系商品链接" : "不是典型闲鱼链接，建议谨慎核对来源";
  itemId.textContent = result.id || "待打开确认";
  actionLevel.textContent = result.score >= 82 ? "可以跟进" : "先核验";
  actionSummary.textContent = result.id
    ? "先打开原链接核对价格和卖家主页，再按话术追问细节。"
    : "短链可能隐藏商品信息，先打开链接确认真实商品页。";
  messageBox.value = buildMessage(result);

  const extraRisks = [];
  if (!result.isXianyu) extraRisks.push("这个域名不是典型闲鱼链接，不要在非官方页面登录或付款。");
  if (!result.id) extraRisks.push("短链没有直接暴露商品 ID，需要打开后确认商品是否仍在售。");
  if (result.host.includes("m.tb.cn")) extraRisks.push("这是短链接，可能会跳转失效，建议打开后再复制最终商品页链接保存。");
  renderRisks(extraRisks);
  saveHistory({ url: result.normalized, host: result.host, id: result.id, at: Date.now() });
  renderHistory();
}

pasteButton.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    dealLink.value = normalizeUrl(text);
    analyze();
  } catch {
    dealLink.focus();
    linkStatus.textContent = "浏览器没有给剪贴板权限，可以手动粘贴。";
  }
});

analyzeButton.addEventListener("click", analyze);
dealLink.addEventListener("keydown", (event) => {
  if (event.key === "Enter") analyze();
});

clearButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  dealLink.value = "";
  renderHistory();
  analyze();
});

copyMessageButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(messageBox.value);
    copyMessageButton.textContent = "已复制";
    setTimeout(() => {
      copyMessageButton.textContent = "复制话术";
    }, 1200);
  } catch {
    messageBox.select();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

renderChecks();
renderRisks();
renderHistory();
analyze();
