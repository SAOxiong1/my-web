# 食光 · 今天吃什么

一个零依赖、纯静态的单页小站：选好菜系和辣度，转动转盘随机抽一道家常菜或外卖菜，附食材清单（可勾选、按人数换算用量）和步骤清单。营地伙伴「奶蛙」会陪你等转盘停下。

![食光封面](assets/og-cover.png)

## 功能

- **转盘抽菜**：八格西部悬赏风转盘，揭晓海报 + 完整菜谱卡片
- **筛选**：菜系（粤/闽/江浙/川/湘/赣）× 辣度（不辣/微辣/辣），无结果时一键重置
- **两种模式**：在家做（46 道完整菜谱 + 51 道目录菜）/ 点外卖（8 道附在家做法 + 86 道目录菜）
- **菜谱卡片**：食材/步骤可勾选打卡（带进度条）、按人数自动换算用量、屏幕常亮（支持的浏览器）
- **互动**：点赞、收藏、最近抽过记录（localStorage 持久化）；按住奶蛙摸摸它会开心
- **可访问性**：键盘焦点圈闭的揭晓海报、`aria-live` 状态播报、`prefers-reduced-motion` 全套降级

## 本地运行

无需构建，任选其一：

```bash
# 直接用浏览器打开
open index.html

# 或起一个本地静态服务
npm run serve        # 等价于 python3 -m http.server 8000
```

部署到 GitHub Pages 时直接以仓库根目录为站点根即可（`Settings → Pages → Deploy from branch → main / root`）。

## 开发

```
index.html                  # 页面结构 + 全部样式与应用逻辑（内联）
data.js                     # 菜谱与目录数据（window.SHIGUANG_DATA），加菜只改这里
assets/food-photos/         # 菜品实拍图 + 来源/许可表（README.md）
assets/naiwa/               # 奶蛙形象素材
assets/og-cover.png         # 社交分享封面（1200×630）
tests/site.test.mjs         # Node 内置 test runner 的单元/冒烟测试（jsdom）
tests/site.spec.mjs         # Playwright 端到端冒烟测试（可选）
```

### 常用命令

```bash
npm install      # 安装 jsdom（跑单元测试必需）
npm test         # Node --test：数据一致性、ID 稳定性、跨模式收藏、人数换算等
npm run test:e2e # Playwright 端到端冒烟（需先 npm i -D @playwright/test 并 npx playwright install chromium）
```

### 维护数据（data.js）

- `homeRecipes` / `takeoutRecipes`：完整菜谱，字段见文件头注释（`id` 唯一且稳定，删除或新增都不影响其它菜）。
- `homeCatalog` / `takeoutCatalog`：目录菜品（无完整菜谱，页面提供「搜索做法」入口）。**ID 由菜名哈希自动生成**——在任意位置增删条目都不会让用户已收藏的菜失效，但请避免同一数组内菜名重复。
- 食材用量建议写阿拉伯数字（如「生抽 2 勺」）；「半」「小半」也会参与人数换算，「少许」「适量」保持原样。

## 素材与许可

- 菜品照片：见 [`assets/food-photos/README.md`](assets/food-photos/README.md) 的逐张来源与许可表（Pexels 免费许可 / Wikimedia Commons CC 系列并已署名）。
- 奶蛙（Naiwa）形象：[yugh6/Naiwa](https://github.com/yugh6/Naiwa) · **PolyForm Noncommercial 1.0.0（仅限非商业用途）**；多姿态素材来自 [Nailong-Studio/NaiWa-Wallpaper](https://github.com/Nailong-Studio/NaiWa-Wallpaper) · MIT。**因此本项目整体只能用于非商业场景。**
- `assets/og-cover.png`：AI 生成插画 + 文字排版，随本项目按 MIT 分发。
- 站点代码本身：[MIT](LICENSE)。商业使用需自行替换非商业许可的形象素材。

## 修改分享元数据

`index.html` 头部的 `canonical` / `og:url` / `og:image` 目前指向 `https://saoxiong1.github.io/my-web/`。如果你的部署地址不同，请同步修改这三处，否则分享出去不会带封面图。
