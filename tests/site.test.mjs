/**
 * 单元/冒烟测试：用 jsdom 通过进程内静态服务器加载真实页面。
 * 运行：npm install && npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const BASE = `http://127.0.0.1:${server.address().port}/`;
test.after(() => server.close());

const POLYFILLS = (window) => {
  // prefers-reduced-motion: reduce → 走 30ms 快速转动路径
  window.matchMedia = (query) => ({
    matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
};

async function boot({ prefs } = {}) {
  const dom = await JSDOM.fromURL(BASE, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    beforeParse(window) {
      POLYFILLS(window);
      if (prefs) window.localStorage.setItem("shiguang:prefs:v1", JSON.stringify(prefs));
    },
  });
  await new Promise((resolve) => dom.window.addEventListener("load", resolve));
  await new Promise((resolve) => setTimeout(resolve, 40));
  return dom;
}

const app = (dom) => dom.window.__shiguang__;
const chip = (dom, group, value) => dom.window.document.querySelector(`#${group} .chip[data-value='${value}']`);
const spinOnce = async (dom) => {
  dom.window.document.getElementById("randomize").click();
  await new Promise((resolve) => setTimeout(resolve, 150));
};

// —— 为避免共享实例串扰，每个用例独立 boot ——
test("数据一致性：ID 唯一、图片引用与磁盘文件双向对齐", async () => {
  const dom = await boot();
  const data = dom.window.SHIGUANG_DATA;
  const api = app(dom);
  for (const mode of ["home", "takeout"]) {
    const ids = [...api.byId[mode].keys()];
    assert.equal(ids.length, data[mode === "home" ? "homeRecipes" : "takeoutRecipes"].length + data[mode === "home" ? "homeCatalog" : "takeoutCatalog"].length);
    assert.equal(new Set(ids).size, ids.length, `${mode} 池存在重复 ID`);
  }
  // 目录菜 ID 均由哈希生成（模式前缀 + base36），不应再出现顺序序号
  for (const dish of api.pools.home) {
    if (dish.brief) assert.match(dish.id, /^home-brief-[0-9a-z]+$/);
  }
  // FOOD_PHOTOS 引用的文件都存在
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const photoFiles = [...html.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const file of photoFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, "assets/food-photos", file)), `页面引用的图片缺失: ${file}`);
  }
  // 磁盘上的图片都被页面引用（防止死资源再次堆积）
  for (const name of fs.readdirSync(path.join(ROOT, "assets/food-photos"))) {
    if (!/\.(jpe?g|png)$/i.test(name)) continue;
    assert.ok(photoFiles.includes(name), `未引用的死图: ${name}`);
    const readme = fs.readFileSync(path.join(ROOT, "assets/food-photos/README.md"), "utf8");
    assert.ok(readme.includes(`\`${name}\``), `许可表缺少登记: ${name}`);
  }
});

test("页面启动：转盘 8 格、计数正确、标题层级从 h1 开始", async () => {
  const dom = await boot();
  const doc = dom.window.document;
  assert.equal(doc.title, "食光 · 今天吃什么");
  assert.equal(doc.querySelectorAll(".wheel-slot").length, 8);
  const data = dom.window.SHIGUANG_DATA;
  assert.ok(doc.getElementById("choice-count").textContent.includes(`${data.homeRecipes.length + data.homeCatalog.length} 道家常菜`));
  const firstHeading = doc.querySelector("h1, h2");
  assert.equal(firstHeading.tagName, "H1", "首个标题应为 h1（摸摸奶蛙区已降级为 p）");
  assert.equal(doc.getElementById("spin-bar").getAttribute("aria-hidden"), null, "spin-bar 不应再挂在 aria-hidden 容器里");
});

test("回归 #1：外卖菜收藏后，在家做模式下点击收藏会自动切换模式打开", async () => {
  const dom = await boot();
  const doc = dom.window.document;
  doc.querySelector(".mode-button[data-mode='takeout']").click();
  await spinOnce(dom);
  const dishName = doc.getElementById("dish-name").textContent;
  assert.equal(app(dom).state.mode, "takeout");
  doc.querySelector("[data-action='favorite']").click();
  assert.equal(app(dom).state.favorites.length, 1);
  doc.querySelector(".mode-button[data-mode='home']").click();
  const savedChip = doc.querySelector("#saved-list .ghost-button");
  assert.ok(savedChip, "收藏列表应显示该外卖菜");
  savedChip.click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(app(dom).state.mode, "takeout", "应自动切回外卖模式");
  assert.equal(doc.getElementById("dish-name").textContent, dishName);
});

test("回归 #10/#14：人数换算处理『半』并恢复下拉框焦点", async () => {
  const dom = await boot();
  const doc = dom.window.document;
  app(dom).openDish("kung-pao-chicken");
  assert.ok(doc.getElementById("recipe-result").textContent.includes("鸡胸肉 250 g"));
  assert.ok(doc.querySelector(".portion-hint"), "应显示用量换算提示");
  const select = doc.getElementById("portion-select");
  select.value = "4";
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  const text = doc.getElementById("recipe-result").textContent;
  assert.ok(text.includes("鸡胸肉 500 g"), "250g × 2 应换算为 500g");
  assert.ok(text.includes("黄瓜1根"), "『黄瓜半根』× 2 应换算为 1 根");
  assert.ok(text.includes("干辣椒 10 个"), "5 个 × 2 应换算为 10 个");
  assert.ok(text.includes("生抽、醋、糖、淀粉适量"), "『适量』保持原样");
  assert.equal(doc.activeElement?.id, "portion-select", "重渲染后焦点应回到人数下拉框");
});

test("无结果筛选出现重置按钮，点击后恢复", async () => {
  const dom = await boot();
  const doc = dom.window.document;
  chip(dom, "region-filters", "川菜").click();
  chip(dom, "spice-filters", "清淡").click();
  assert.ok(doc.getElementById("choice-count").textContent.includes("没有符合条件的菜品"));
  assert.equal(doc.getElementById("randomize").disabled, true);
  doc.querySelector("#choice-count .filter-reset").click();
  const data = dom.window.SHIGUANG_DATA;
  assert.ok(doc.getElementById("choice-count").textContent.includes(`${data.homeRecipes.length + data.homeCatalog.length} 道家常菜`));
  assert.equal(doc.getElementById("randomize").disabled, false);
});

test("回归 #2：localStorage 中的旧格式/无效 ID 会被安全过滤", async () => {
  const dom = await boot({
    prefs: { mode: "home", region: "全部", spice: "全部", liked: ["home-brief-001", "kung-pao-chicken", "bogus-id"], favorites: ["gone"], recent: { home: ["tomato-eggs"], takeout: [] } },
  });
  const state = app(dom).state;
  assert.deepEqual([...state.liked], ["kung-pao-chicken"], "旧顺序 ID 与无效 ID 应被清除");
  assert.deepEqual([...state.favorites], []);
  assert.deepEqual([...state.recent.home], ["tomato-eggs"]);
});

test("回归 #11：指针停在的悬赏槽类别与菜品类别一致", async () => {
  const dom = await boot();
  const doc = dom.window.document;
  await spinOnce(dom);
  const api = app(dom);
  const dish = api.byId.home.get(api.state.currentId);
  const winnerSlot = doc.querySelector(".wheel-slot.is-winner");
  assert.ok(winnerSlot, "应有中标槽");
  const known = api.posterCategories.some((t) => t.category === dish.category);
  if (known) assert.equal(winnerSlot.dataset.category, dish.category, "悬赏槽类别应与菜品类别一致");
});

test("回归 #12：揭晓海报可 Escape 关闭且焦点回到主按钮", async () => {
  const dom = await boot();
  const doc = dom.window.document;
  await spinOnce(dom);
  const reveal = doc.getElementById("spin-reveal");
  assert.equal(reveal.hidden, false, "转动后应出现悬赏海报");
  doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(reveal.hidden, true);
  assert.equal(doc.activeElement, doc.getElementById("randomize"));
});
