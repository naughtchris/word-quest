import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vocabularyDir = join(projectRoot, "vocabulary");
const enhancedDir = join(vocabularyDir, "enhanced");
const outputFile = join(projectRoot, "docs", "vocabulary-data.js");
const requiredHeaders = ["English", "Chinese", "PartOfSpeech", "type", "Class", "Semester", "Unit", "Page"];
const enhancedHeaders = [
  "VocabularyId", "ConceptId", "ContentKind", "AudioText", "AcceptedAnswers", "QuizModes",
  "ExampleSentence", "ExampleChinese", "ExampleStatus", "BaseForm", "PastTense", "PastParticiple",
  "FullForm", "ShortForm", "RelationType", "RelatedTerms", "SingularForm", "PluralForm",
  "ClozePrompt", "ClozeAnswer", "NeedsReview", "ReviewNotes", "SourceKind", "SourceFile",
  "SourceImage", "OCRConfidence",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], records: [] };
  const [headers, ...values] = rows;
  const normalizedHeaders = headers.map((header) => header.replace(/^\uFEFF/, "").trim());
  return {
    headers: normalizedHeaders,
    records: values.map((cells) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, (cells[index] ?? "").trim()]))),
  };
}

function bookTitle(bookId) {
  const match = bookId.match(/^way_to_go_(\d+)$/i);
  return match
    ? `Way to Go ${match[1]}`
    : bookId.split("_").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function stableFallbackId(bookId, record) {
  const signature = [bookId, ...requiredHeaders.map((header) => record[header].normalize("NFKC").toLocaleLowerCase())].join("|");
  return `${bookId}-${createHash("sha256").update(signature).digest("hex").slice(0, 12)}`;
}

function list(value) {
  return String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
}

let enhancedFiles = [];
try { enhancedFiles = (await readdir(enhancedDir)).filter((name) => /_vocabulary_enhanced\.csv$/i.test(name)); }
catch (_) { /* Enhanced data is optional for legacy教材. */ }

const sources = new Map();
for (const filename of enhancedFiles) {
  const bookId = filename.replace(/_vocabulary_enhanced\.csv$/i, "");
  sources.set(bookId, { bookId, filename, path: join(enhancedDir, filename), enhanced: true });
}

const orderedSources = [...sources.values()].sort((a, b) => a.bookId.localeCompare(b.bookId, "en", { numeric: true }));
if (!orderedSources.length) throw new Error("No *_vocabulary_enhanced.csv files found in vocabulary/enhanced/.");

const books = [];
for (const source of orderedSources) {
  const { headers, records } = parseCsv(await readFile(source.path, "utf8"));
  const expectedHeaders = source.enhanced ? [...requiredHeaders, ...enhancedHeaders] : requiredHeaders;
  const missingHeaders = expectedHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`${source.filename}: missing columns ${missingHeaders.join(", ")}`);
  records.forEach((record, index) => {
    const emptyFields = requiredHeaders.filter((header) => !record[header]);
    if (emptyFields.length) throw new Error(`${source.filename}, row ${index + 2}: empty fields ${emptyFields.join(", ")}`);
  });

  const title = bookTitle(source.bookId);
  const words = records.map((record, index) => {
    const legacyId = `${source.bookId}:${index + 1}:${record.English}:${record.Chinese}:${record.Semester}:${record.Unit}:${record.Class}`;
    const audioTextCandidate = record.AudioText || record.English;
    const audioText = /[→↔=<>]/.test(audioTextCandidate) ? "" : audioTextCandidate;
    return {
      id: record.VocabularyId || stableFallbackId(source.bookId, record),
      legacyId,
      conceptId: record.ConceptId || "",
      bookId: source.bookId,
      bookTitle: title,
      english: record.English,
      chinese: record.Chinese,
      partOfSpeech: record.PartOfSpeech,
      type: record.type,
      className: record.Class,
      semester: record.Semester,
      unit: record.Unit,
      page: record.Page,
      contentKind: record.ContentKind || (record.type === "word" ? "word" : "phrase"),
      audioText,
      acceptedAnswers: list(record.AcceptedAnswers || record.English),
      quizModes: list(record.QuizModes || "en_zh_choice|zh_en_choice|listening|spelling"),
      exampleSentence: record.ExampleSentence || "",
      exampleChinese: record.ExampleChinese || "",
      exampleStatus: record.ExampleStatus || "",
      baseForm: record.BaseForm || "",
      pastTense: record.PastTense || "",
      pastParticiple: record.PastParticiple || "",
      fullForm: record.FullForm || "",
      shortForm: record.ShortForm || "",
      relationType: record.RelationType || "",
      relatedTerms: list(record.RelatedTerms),
      singularForm: record.SingularForm || "",
      pluralForm: record.PluralForm || "",
      clozePrompt: record.ClozePrompt || "",
      clozeAnswer: record.ClozeAnswer || "",
      needsReview: String(record.NeedsReview).toLocaleLowerCase() === "yes",
      reviewNotes: record.ReviewNotes || "",
      sourceKind: record.SourceKind || "source_csv",
      sourceImage: record.SourceImage || "",
      ocrConfidence: record.OCRConfidence || "",
    };
  });
  books.push({
    id: source.bookId,
    title,
    filename: source.filename,
    dataLevel: source.enhanced ? "enhanced" : "basic",
    words,
  });
}

const allIds = books.flatMap((book) => book.words.map((word) => word.id));
if (new Set(allIds).size !== allIds.length) throw new Error("Generated vocabulary IDs are not unique.");

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `window.WORDQUEST_BOOKS = ${JSON.stringify(books, null, 2)};\n`, "utf8");
const enhancedCount = books.filter((book) => book.dataLevel === "enhanced").length;
console.log(`Generated ${books.length} books (${enhancedCount} enhanced), ${allIds.length} words, ${new Set(allIds).size} unique IDs.`);
