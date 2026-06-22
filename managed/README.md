# YLHG Shortlink Pro

正式可管理版的 YLHG 縮址系統，設計給 **Cloudflare Workers + D1**。

## 功能

- 縮址轉址：`/meeting` → 原網址
- 後台管理：新增、編輯、停用、刪除
- 統計：總數、啟用數、點擊數、最近更新、最近點擊
- 安全：API 透過 `ADMIN_TOKEN` 保護

## 專案結構

- `public/`：前端與靜態資源
- `src/worker.js`：Cloudflare Worker 主程式
- `migrations/0001_init.sql`：D1 資料表與初始資料

## 本機檢查

```bash
node tests/worker.test.js
```

## 部署到 Cloudflare

1. 建立 Cloudflare Workers 專案
2. 建立 D1 資料庫
3. 在 `wrangler.toml` 填入 `database_id`
4. 設定環境變數 `ADMIN_TOKEN`
5. 部署：

```bash
npx wrangler deploy
```

## 初始化資料庫

```bash
npx wrangler d1 migrations apply ylhg_shortlink
```

## 管理權杖

前端登入框會把權杖存到 `sessionStorage`。正式環境請使用一組足夠長的隨機字串作為 `ADMIN_TOKEN`。
