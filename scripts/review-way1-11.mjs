import { readFile, writeFile } from "node:fs/promises";

function parse(text) {
  const rows=[]; let row=[], field="", quoted=false;
  for (let i=0;i<text.length;i++) { const c=text[i], n=text[i+1]; if(c==='"'&&quoted&&n==='"'){field+='"';i++;} else if(c==='"') quoted=!quoted; else if(c===','&&!quoted){row.push(field);field='';} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';} else field+=c; }
  if(field||row.length){row.push(field);rows.push(row);} const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,'').trim()); return {headers,rows:rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])))};
}
const esc=(v)=>{const s=String(v??'');return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
for (const file of ["vocabulary/enhanced/way_to_go_1_vocabulary_enhanced.csv","vocabulary/enhanced/way_to_go_11_vocabulary_enhanced.csv"]) {
  const {headers,rows}=parse(await readFile(file,"utf8")); const out=[];
  for (const r of rows) {
    if (r.English === "must have + <Vpp>") { r.VocabularyId=""; r.ConceptId=""; }
    if (r.English === "color") { r.NeedsReview="No"; r.ReviewNotes=""; }
    if (r.English === "on one's own = by oneself") { r.PartOfSpeech="adverb_phrase"; r.NeedsReview="No"; r.ReviewNotes="詞性已確認為副詞片語。"; }
    if (r.English === "least ↔ most") { r.NeedsReview="No"; r.ReviewNotes="反義關係已確認，保留為同一教材列。"; }
    if (r.English === "feel") { r.PastTense="felt"; r.PastParticiple="felt"; r.NeedsReview="No"; r.ReviewNotes="動詞三態已補齊：feel → felt → felt。"; r.AcceptedAnswers="feel|felt"; }
    if (r.English === "should have <Vpp>") { r.Chinese="當時應該做，卻沒有做"; }
    if (r.English === "may, might/must have + <Vpp>") {
      const copy={...r}; copy.VocabularyId=""; copy.ConceptId=""; copy.English="must have + <Vpp>"; copy.Chinese="一定已經做某事"; copy.AcceptedAnswers=copy.English; copy.ReviewNotes="已拆出 must 語意；仍需教材例句確認。"; out.push(copy);
      r.English="may / might have + <Vpp>"; r.Chinese="可能已經做某事"; r.AcceptedAnswers=r.English; r.ReviewNotes="已拆出 may / might 語意；仍需教材例句確認。";
    }
    out.push(r);
  }
  const csv=[headers.join(','),...out.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n')+'\n'; await writeFile(file,csv,'utf8'); console.log(`${file}: ${out.length} rows`);
}
