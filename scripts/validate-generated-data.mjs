import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const code = await readFile(resolve(projectRoot, "docs", "vocabulary-data.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(code, sandbox, { filename: "vocabulary-data.js" });
const books = sandbox.window.WORDQUEST_BOOKS;
if (!Array.isArray(books) || !books.length) throw new Error("No generated books found.");

const words = books.flatMap((book) => book.words);
const ids = words.map((word) => word.id);
if (new Set(ids).size !== ids.length) throw new Error("Vocabulary IDs are not unique.");

const required = ["id", "bookId", "english", "chinese", "partOfSpeech", "type", "className", "semester", "unit", "page"];
for (const word of words) {
  const missing = required.filter((field) => !word[field]);
  if (missing.length) throw new Error(`${word.bookId}/${word.english}: missing ${missing.join(", ")}`);
  if (word.exampleSentence && !word.exampleChinese) throw new Error(`${word.id}: example translation is missing.`);
  if (word.audioText && /[→↔=<>]/.test(word.audioText)) throw new Error(`${word.id}: AudioText contains a structural symbol.`);
  if (!word.needsReview && word.quizModes.includes("contraction_choice") && (!word.fullForm || !word.shortForm)) throw new Error(`${word.id}: contraction fields are incomplete.`);
  if (!word.needsReview && word.quizModes.some((mode) => mode.startsWith("verb_form")) && (!word.baseForm || !word.pastTense || !word.pastParticiple)) throw new Error(`${word.id}: verb form fields are incomplete.`);
  if (!word.needsReview && word.quizModes.some((mode) => mode.startsWith("form_change")) && (!word.singularForm || !word.pluralForm)) throw new Error(`${word.id}: spelling change fields are incomplete.`);
}

const ready = words.filter((word) => !word.needsReview);
const has = (word, mode) => word.quizModes.includes(mode);
const capabilities = {
  "英翻中": ready.filter((word) => has(word, "en_zh_choice")).length,
  "中翻英": ready.filter((word) => has(word, "zh_en_choice")).length,
  "拼字": ready.filter((word) => has(word, "spelling")).length,
  "可發音": ready.filter((word) => has(word, "listening") && word.audioText).length,
  "縮寫": ready.filter((word) => has(word, "contraction_choice") && word.fullForm && word.shortForm).length,
  "動詞三態": ready.filter((word) => has(word, "verb_form_input") && word.baseForm && word.pastTense && word.pastParticiple).length,
  "詞語關係": ready.filter((word) => has(word, "equivalent_choice") && word.relatedTerms.length >= 2).length,
  "拼字變化": ready.filter((word) => has(word, "form_change_choice") && word.singularForm && word.pluralForm).length,
  "文法辨義": ready.filter((word) => has(word, "grammar_choice")).length,
  "句型填空": ready.filter((word) => has(word, "grammar_cloze") && word.clozePrompt && word.clozeAnswer).length,
};

console.log(JSON.stringify({ books: books.length, words: words.length, uniqueIds: new Set(ids).size, needsReview: words.length - ready.length, capabilities }, null, 2));
