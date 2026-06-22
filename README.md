# YLHG 縮址中心

這是一個可直接部署到免費雲端主機（例如 GitHub Pages）的縮址入口站。

## 特色

- `404.html` 自動接手短碼路由
- `data/links.json` 集中管理短碼與原網址
- 首頁提供查詢、列表與暫存編輯器
- 可先在瀏覽器中編輯，再匯出 JSON 上傳到 repo

## 線上部署

此站已預設為靜態站，可直接用 GitHub Pages 發佈。

## 新增短碼

請編輯 `data/links.json`，加入新項目：

```json
{
  "code": "new-code",
  "title": "標題",
  "url": "https://example.com/path",
  "owner": "承辦單位",
  "updatedAt": "2026-06-23T00:00:00Z"
}
```

## 注意

如果要變成「真正可直接在網站上新增短碼」的正式系統，還需要後端 API、資料庫與權限控管；目前這版是可上線的靜態原型。