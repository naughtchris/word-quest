# WordQuest 教材 CSV 與圖片 OCR 轉檔規則

版本：1.0  
更新日期：2026-08-14

## 1. 目的與不可變原則

本文件是所有 WordQuest 教材的統一資料契約。手動整理、圖片 OCR、AI 輔助或其他來源都必須產生相同結構，才能共用列表、閃卡、發音、測驗與學習紀錄。

- 一份 CSV 只代表一份教材。
- 專案以增強 CSV 為唯一教材來源；目前教材檔放在 `vocabulary/enhanced/`，不再依賴已刪除的舊版匯入檔。
- 原始八欄與原文必須保留，推測內容不可冒充教材原文。
- OCR、AI 例句與自動分類只是草稿；不確定內容一律標示 `NeedsReview=Yes`。
- 同字不同義、不同詞性、不同課次均保留為不同列，不合併。
- 使用 UTF-8（建議含 BOM）、逗號分隔與 RFC 4180 引號規則。

## 2. 檔名與目錄

- 正式教材檔：`vocabulary/enhanced/<教材名稱>_vocabulary_enhanced.csv`
- 檔名使用小寫英數與底線，例如 `way_to_go_12_vocabulary_enhanced.csv`。
- OCR 暫存檔與尚未確認的資料不得放入 `vocabulary/enhanced/`，避免網站誤匯入。

## 3. 基礎八欄（所有教材檔必填）

欄位順序固定為：

```text
English,Chinese,PartOfSpeech,type,Class,Semester,Unit,Page
```

| 欄位 | 規則 | 範例 |
|---|---|---|
| `English` | 保留教材英文；縮寫、撇號、大小寫及結構符號不得遺失 | `should have <Vpp>` |
| `Chinese` | 使用繁體中文；多義用全形分號 `；` | `最少的；最小的` |
| `PartOfSpeech` | 使用標準值；不確定時不可留白，先填最接近值並標記複核 | `noun`, `verb_phrase` |
| `type` | 使用下方內容類型之一 | `irregular_verb` |
| `Class` | 固定格式 `Class N`；不要只填數字 | `Class 3` |
| `Semester` | 僅用 `First Semester` 或 `Second Semester` | `First Semester` |
| `Unit` | 課本單元代碼；同教材內格式一致 | `U3`, `Review 1` |
| `Page` | 固定格式 `p.N`；跨頁可用 `p.24-25` | `p.24` |

### 3.1 `PartOfSpeech` 建議值

`noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `conjunction`, `interjection`, `article`, `determiner`, `number`, `modal`, `phrase`, `noun_phrase`, `verb_phrase`, `adjective_phrase`, `adverb_phrase`, `sentence`, `contraction`, `grammar`

若新教材需要新值，先更新本文件及資料產生器，不可只在單一 CSV 中自創拼法。

### 3.2 `type` 允許值

| type | 用途 | English 寫法 |
|---|---|---|
| `word` | 單字 | `color` |
| `phrase` | 固定片語或完整表達 | `welcome party` |
| `verb_phrase` | 動詞片語 | `stay up` |
| `contraction_phrase` | 全形與縮寫 | `I am = I'm` |
| `irregular_verb` | 動詞三態 | `feel → felt → felt` |
| `grammar_form` | 含句型代號的文法模板 | `should have <Vpp>` |
| `synonym_expression` | 同義或反義關係 | `kid = child`, `least ↔ most` |
| `spelling_confusion` | 單複數或拼字變化 | `thief → thieves` |

## 4. 結構符號規則

- `→`：有順序的變化，如原形 → 過去式 → 過去分詞、單數 → 複數。
- `=`：可互換或縮寫對應。
- `↔`：相反意思；不得標成同義題。
- `/`：教材明確列出的並列選項；若選項語意不同，應拆成多列。
- `<...>`：句型插槽，僅限標準代號，例如 `<Sb>`, `<Sth>`, `<place>`, `<Vr>`, `<Ving>`, `<Vpp>`。
- 答案清單使用半形豎線 `|` 分隔；不可用逗號，以免破壞 CSV。

## 5. 增強欄位

增強檔必須先完整保留基礎八欄，再依序加入：

```text
VocabularyId,ConceptId,ContentKind,AudioText,AcceptedAnswers,QuizModes,
ExampleSentence,ExampleChinese,ExampleStatus,
BaseForm,PastTense,PastParticiple,FullForm,ShortForm,
RelationType,RelatedTerms,SingularForm,PluralForm,ClozePrompt,ClozeAnswer,
NeedsReview,ReviewNotes,SourceKind,SourceFile,SourceImage,OCRConfidence
```

主要規則：

- `VocabularyId`：由教材、位置與內容產生的穩定 ID；不得使用 CSV 列號，原內容不變時重新產生也必須相同。
- `ConceptId`：由標準化英文與中文義項產生；供跨課次分析，不取代 `VocabularyId`。
- `ContentKind`：`word`, `phrase`, `contraction`, `verb_forms`, `grammar_pattern`, `word_relation`, `spelling_change`。
- `AudioText`：只放瀏覽器可自然朗讀的英文；刪除箭頭、關係符號與 `<...>` 代號。無法形成自然英文時留白。
- `AcceptedAnswers`：所有可接受英文答案，以 `|` 分隔；保留必要空格、撇號與縮寫。
- `QuizModes`：以 `|` 分隔，可用 `en_zh_choice`, `zh_en_choice`, `listening`, `spelling`, `dictation`, `cloze`, `contraction_choice`, `contraction_input`, `verb_forms`, `relation`, `spelling_change`。
- `ExampleSentence` / `ExampleChinese`：必須成對出現，且精確對應該列義項。
- `ExampleStatus`：`source_phrase`, `curated`, `draft`, `reviewed`。OCR 或 AI 自動產生的例句先用 `draft`。
- `NeedsReview`：僅 `Yes` 或 `No`；只要有一項不確定就填 `Yes`。
- `ReviewNotes`：明確寫出要確認什麼，不可只寫「待確認」。
- `SourceKind`：`source_csv`, `ocr`, `manual`, `ai_enriched`。
- `SourceFile`：原始 CSV 或圖片批次名稱。
- `SourceImage`：OCR 必填，格式建議 `<教材>_<頁碼>_<序號>.jpg`。
- `OCRConfidence`：0 到 1 的小數；非 OCR 資料可留白。

## 6. 例句與學習內容擴充規則

- 每個例句只突出一個目標單字或句型，難度不得明顯高於教材。
- 同字多義必須各有能辨識義項的例句；選擇題需顯示詞性或例句情境。
- 片語與文法模板要補自然例句後，才可啟用發音、聽寫或填空題。
- 動詞三態必須填滿 `BaseForm`, `PastTense`, `PastParticiple` 才可出三態題。
- 縮寫必須填 `FullForm` 與 `ShortForm`。
- 同／反義資料必須填 `RelationType=synonym` 或 `antonym`，以及 `RelatedTerms`。
- 拼字變化必須填 `SingularForm` 與 `PluralForm`，不可只靠字串猜測。
- AI 例句不可直接標為 `reviewed`；需人工確認語意、文法與程度。

## 7. 圖片 OCR 轉 CSV 標準流程

1. 每張圖片先記錄教材、學期、Unit、Class 與頁碼，圖片名稱可追溯。
2. OCR 只轉錄看得到的內容，不自行補字；看不清處保留原辨識結果並標記複核。
3. 將全形／半形、換行與多餘空白正規化，但不改變英文拼字、撇號或結構符號。
4. 依內容選擇 `PartOfSpeech` 與 `type`，再產生增強欄位。
5. 下列任一情況必須 `NeedsReview=Yes`：
   - `OCRConfidence < 0.95`
   - 含 `<...>`, `→`, `=`, `↔`, `/` 等結構
   - 英文或中文疑似被裁切、跨行或合併
   - 同列包含兩個不同語意
   - 詞性、中文義項或頁碼無法確定
6. 先輸出至暫存或 `enhanced` 目錄，完成複核後才能建立正式 `*_vocabulary_import.csv`。
7. 執行資料驗證及網站資料產生工具，確認筆數與教材篩選後才提交。

## 8. 發布前驗證清單

- [ ] UTF-8 編碼，標題列完全正確且只有一列。
- [ ] 基礎八欄無空白，`Semester`、`Class`、`Unit`、`Page` 格式一致。
- [ ] 每列 `VocabularyId` 唯一且重新產生後穩定。
- [ ] 同字不同義沒有合併，中文多義分隔一致。
- [ ] 三態、縮寫、關係、拼字與文法模板的結構欄位完整。
- [ ] `AudioText` 不含箭頭、等號、反義符號或 `<...>`。
- [ ] 例句英文與中文成對，AI 草稿仍標記待確認。
- [ ] 所有 OCR 低信心與歧義列都有具體 `ReviewNotes`。
- [ ] CSV 筆數等於來源教材經人工核對的筆數。
- [ ] 新教材可依教材、學期、Unit 與 Class 正確篩選。

## 9. 新教材加入步驟

1. 掃描圖片並保留原圖。
2. 依本規則建立 OCR 暫存 CSV。
3. 產生增強欄位與品質報告。
4. 人工處理所有 `NeedsReview=Yes`。
5. 將確認後的完整增強資料另存為 `vocabulary/enhanced/<教材>_vocabulary_enhanced.csv`，不要覆蓋既有教材。
6. 執行 `node scripts/generate-data.mjs`，確認教材與筆數後再使用網站。
