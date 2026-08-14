# WordQuest

純前端的英文單字複習、閃卡與測驗工具。教材、程式與樣式都在本專案內，不需要登入、後端或外部資料庫。

## 本機預覽

```powershell
python -m http.server 4173 --directory docs
```

開啟 <http://localhost:4173/>。

## 教材來源

正式教材只放在 `vocabulary/enhanced/`，每一個 `*_vocabulary_enhanced.csv` 代表一份教材。新增教材時請遵循 [CSV 規則](vocabulary/VOCABULARY_CSV_RULES.md)，再執行：

```powershell
node scripts/generate-data.mjs
```

產生器會自動掃描所有增強 CSV，不需要修改網站程式。原始教材欄位仍保留在增強檔的前八欄，後續欄位提供發音、題型、例句、結構化答案與 OCR 品質資訊。

## GitHub Pages

`main` 分支的更新會由 `.github/workflows/pages.yml` 將 `docs/` 部署至 GitHub Pages。

預定網址：<https://naughtchris.github.io/word-quest/>

詳細產品規格請參考 [WORDQUEST_SPEC.md](WORDQUEST_SPEC.md)。
