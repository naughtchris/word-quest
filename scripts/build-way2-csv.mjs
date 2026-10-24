import { writeFile } from "node:fs/promises";

const out = "vocabulary/enhanced/way_to_go_2_vocabulary_enhanced.csv";
const img = {
  p02: "20261024_111940.jpg", p03: "20261024_111944.jpg", p04: "20261024_111954.jpg",
  p05: "20261024_111957.jpg", p06: "20261024_112007.jpg", p07: "20261024_112010.jpg",
  p08: "20261024_112022.jpg"
};
const rows = [];
const add = (src, cls, unit, page, english, chinese, pos, type = "word", extra = {}) => rows.push({ src, cls: `Class ${cls}`, semester: "First Semester", unit, page: `p.${page}`, english, chinese, pos, type, ...extra });
const list = (src, cls, unit, page, entries, defaultPos = "noun") => entries.forEach(([e, c, p = defaultPos, t = "word", x = {}]) => add(src, cls, unit, page, e, c, p, t, x));
const v = (src, cls, unit, page, e, c, x = {}) => add(src, cls, unit, page, e, c, "verb", "word", x);
const phrase = (src, cls, unit, page, e, c, pos = "phrase", x = {}) => add(src, cls, unit, page, e, c, pos, "phrase", x);
const contraction = (src, cls, unit, page, e, c, full, short) => add(src, cls, unit, page, e, c, "grammar", "contraction_phrase", { fullForm: full, shortForm: short });

list(img.p02, 4, "U1", "2, 3", [
  ["not so well", "不太好", "adjective", "phrase", { notes: "教材註記：不造對話" }], ["see", "看一下", "verb"], ["hurt", "感到疼痛", "verb"], ["How are you?", "你好嗎？", "phrase", "phrase", { notes: "教材註記：不造句" }], ["How about <+ N>?", "那……呢？", "phrase", "grammar_form", { notes: "句型模板" }]
]);
contraction(img.p02, 5, "U1", 6, "I am = I'm", "我是", "I am", "I'm");
contraction(img.p02, 5, "U1", 6, "you are = you're", "你是", "you are", "you're");
contraction(img.p02, 5, "U1", 6, "he is = he's", "他是", "he is", "he's");
contraction(img.p02, 5, "U1", 6, "she is = she's", "她是", "she is", "she's");
list(img.p02, 6, "U1", 14, [["can", "會（做某事）", "verb"], ["can't = can not = cannot", "不會", "grammar", "contraction_phrase", { notes: "否定形式", fullForm: "cannot", shortForm: "can't" }], ["skate", "溜冰", "verb"], ["ski", "滑雪", "verb"], ["sing", "唱歌", "verb"]]);

list(img.p03, 7, "U2", "14, 15", [["dance", "跳舞", "verb"], ["swim", "游泳", "verb"], ["fly a kite", "放風箏", "verb_phrase", "phrase"], ["ride a bike", "騎腳踏車", "verb_phrase", "phrase"]]);
list(img.p03, 8, "U2", "10, 11", [["Sunday", "星期日"], ["Monday", "星期一"], ["Tuesday", "星期二"], ["Wednesday", "星期三"]]);
list(img.p03, 9, "U2", 11, [["Thursday", "星期四"], ["Friday", "星期五"], ["Saturday", "星期六"]]);
list(img.p03, 9, "U2", 12, [["school", "學校"], ["go out", "出去", "verb_phrase", "phrase"]]);

list(img.p04, 10, "U2", "10, 11", [["wake up", "醒來", "verb_phrase", "phrase"], ["let's", "讓我們", "grammar", "contraction_phrase", { fullForm: "let us", shortForm: "let's" }], ["but", "但是", "conjunction"], ["ready", "做好準備", "adjective"]]);
list(img.p04, 11, "U2", 13, [["walk", "走路", "verb"], ["run", "跑步", "verb"], ["hop", "單腳跳", "verb"], ["jump", "雙腳跳", "verb"]]);
phrase(img.p04, 11, "U2", 12, "What day is today?", "今天星期幾？", "phrase", { notes: "教材註記：造對話" });
list(img.p04, 12, "U3", 22, [["like", "喜歡", "verb"], ["don't = do not", "不（否定）", "grammar", "contraction_phrase", { notes: "否定形式", fullForm: "do not", shortForm: "don't" }], ["salad", "沙拉"], ["fish", "魚肉"], ["rice", "米飯"]]);

list(img.p05, 13, "U3", "22, 23", [["bread", "麵包"], ["cola", "可樂"], ["milk", "牛奶"], ["water", "水"], ["juice", "果汁"]]);
list(img.p05, 14, "U3", 19, [["chicken", "雞肉"], ["pizza", "披薩"], ["cake", "蛋糕"]]);
phrase(img.p05, 14, "U3", 19, "Here you are.", "拿去吧。", "phrase", { notes: "教材註記：不造句" });
list(img.p05, 15, "U3", 21, [["smell", "聞起來", "verb"], ["taste", "品嚐", "verb"], ["eat", "吃（東西）", "verb"], ["drink", "喝（東西）", "verb"], ["hamburger", "漢堡"]]);

list(img.p06, 16, "U3", 18, [["breakfast", "早餐"], ["lunch", "午餐"], ["dinner", "晚餐"], ["hungry", "餓的", "adjective"]]);
list(img.p06, 17, "U4", 30, [["have", "有；擁有", "verb"], ["comic book", "漫畫書", "noun_phrase", "phrase"], ["radio", "收音機"], ["map", "地圖"], ["backpack", "背包"]]);
list(img.p06, 18, "U4", 31, [["flashlight", "手電筒"], ["camera", "照相機"], ["video game", "電動遊戲", "noun_phrase", "phrase"], ["water bottle", "水壺", "noun_phrase", "phrase"]]);

list(img.p07, 19, "U4", "26, 27", [["umbrella", "雨傘"], ["hat", "（有邊緣的）帽子"], ["sweater", "毛衣"], ["dad", "爸爸"]]);
phrase(img.p07, 19, "U4", "26, 27", "Have fun.", "好好去玩。", "phrase", { notes: "教材註記：不造句" });
list(img.p07, 20, "U4", "26, 27", [["careful", "小心的", "adjective"], ["rainy", "下雨的", "adjective"], ["big", "大的", "adjective"], ["share", "分享", "verb"], ["thanks", "謝謝", "interjection"]]);
list(img.p07, 21, "U4", 28, [["weather", "天氣"], ["sunny", "晴朗的", "adjective"], ["cloudy", "多雲的", "adjective"], ["windy", "多風的", "adjective"], ["snowy", "下雪的", "adjective"]]);

list(img.p08, 22, "U4", 29, [["get on", "上車", "verb_phrase", "phrase"], ["get off", "下車", "verb_phrase", "phrase"], ["bus", "公車"], ["step", "腳步"], ["seat", "座位"]]);

const headers = ["English","Chinese","PartOfSpeech","type","Class","Semester","Unit","Page","VocabularyId","ConceptId","ContentKind","AudioText","AcceptedAnswers","QuizModes","ExampleSentence","ExampleChinese","ExampleStatus","BaseForm","PastTense","PastParticiple","FullForm","ShortForm","RelationType","RelatedTerms","SingularForm","PluralForm","ClozePrompt","ClozeAnswer","NeedsReview","ReviewNotes","SourceKind","SourceFile","SourceImage","OCRConfidence"];
const esc = (value) => { const s = String(value ?? ""); return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const csv = [headers.join(","), ...rows.map((r) => {
  const content = r.type === "grammar_form" ? "grammar_pattern" : r.type === "contraction_phrase" ? "contraction" : r.type === "phrase" ? "phrase" : "word";
  const audio = /[<>=/]/.test(r.english) ? "" : r.english;
  const modes = r.type === "grammar_form" || r.type === "contraction_phrase" ? "en_zh_choice|zh_en_choice" : "en_zh_choice|zh_en_choice|listening|spelling";
  const vals = [r.english,r.chinese,r.pos,r.type,r.cls,r.semester,r.unit,r.page,"","",content,audio,r.english,modes,"","","missing","","","",r.fullForm || "",r.shortForm || "",r.type === "contraction_phrase" ? "contraction" : "","","","","","", "No",r.notes || "","ocr","way_to_go_2_images_20261024",r.src,"0.98"];
  return vals.map(esc).join(",");
})].join("\n") + "\n";
await writeFile(out, csv, "utf8");
console.log(`Wrote ${rows.length} Way to Go 2 records to ${out}`);
