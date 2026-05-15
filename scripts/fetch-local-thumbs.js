#!/usr/bin/env node
/**
 * scripts/fetch-local-thumbs.js
 *
 * 13 챌린지 썸네일을 Pixabay API 로 검색·다운로드해 public/thumbs/ 에 영구 저장.
 * Pixabay /get/...?token URL 은 며칠 만에 만료되므로 로컬 호스팅으로 전환.
 *
 * 사람·인물 요소가 포함된 결과는 가능한 한 회피 (tags 검사).
 * HTTP 200 + 1KB 이상 검증, 실패 시 fallback 키워드로 재시도.
 *
 * 결과: public/thumbs/<id>.jpg, <id>-1280.jpg + meta.json
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const API_KEY = "55520438-cfb3658186c47dab8ca765daf";
const OUT_DIR = path.join(__dirname, "..", "public", "thumbs");

const TARGETS = [
  { id: "daily-vlog-001",          q1: "vlog camera tripod desk",        q2: "smartphone gimbal coffee" },
  { id: "news-anchor-002",         q1: "newspaper microphone studio desk", q2: "broadcast mixer desk" },
  { id: "english-lesson-003",      q1: "english book dictionary alphabet", q2: "abc letters notebook" },
  { id: "fairy-tale-004",          q1: "fairy tale book pages illustration", q2: "open storybook colorful" },
  { id: "travel-cert-005",         q1: "eiffel tower paris",              q2: "angkor wat sunrise" },
  { id: "product-unbox-006",       q1: "package box delivery cardboard",  q2: "parcel unboxing tape" },
  { id: "kpop-idol-007",           q1: "concert stage lights neon",       q2: "stage microphone purple lights" },
  { id: "fitness-squat-master-008",q1: "barbell weight gym",              q2: "kettlebell dumbbell floor" },
  { id: "english-speak-009",       q1: "globe world map books",           q2: "language learning textbook" },
  { id: "kids-story-010",          q1: "children illustration toy bear",  q2: "teddy bear pastel toys" },
  { id: "travel-vlog-011",         q1: "luggage suitcase passport map",   q2: "vintage suitcase travel" },
  { id: "hiphop-cypher-012",       q1: "vintage microphone studio black", q2: "retro mic stand metal" },
  { id: "dance-hiphop-001",        q1: "dance studio mirror wood floor",  q2: "graffiti wall street" },
];

const PERSON_WORDS = ["person","people","woman","man","women","men","girl","boy","child","kid","face","portrait","model","baby","toddler"];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode + " " + url));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(outPath);
        return reject(new Error("download HTTP " + res.statusCode));
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => {
        const size = fs.statSync(outPath).size;
        if (size < 1024) {
          fs.unlinkSync(outPath);
          return reject(new Error("file too small " + size));
        }
        resolve(size);
      }));
    }).on("error", (e) => { file.close(); try{fs.unlinkSync(outPath);}catch{} reject(e); });
  });
}

function pickBestHit(hits) {
  // 사람·인물 단어 포함 tags 회피, 가로형, 큰 사진 우선
  const scored = hits.map((h) => {
    const tags = (h.tags || "").toLowerCase();
    const personHits = PERSON_WORDS.filter((w) => tags.includes(w)).length;
    return { h, personHits, w: h.imageWidth || 0 };
  });
  scored.sort((a, b) => {
    if (a.personHits !== b.personHits) return a.personHits - b.personHits;
    return b.w - a.w;
  });
  return scored[0]?.h || null;
}

async function searchOnce(q) {
  const url = `https://pixabay.com/api/?key=${API_KEY}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=10`;
  const json = await fetchJson(url);
  if (!json.hits || !json.hits.length) return null;
  return pickBestHit(json.hits);
}

async function processOne(target) {
  for (const q of [target.q1, target.q2]) {
    try {
      const hit = await searchOnce(q);
      if (!hit) { console.log(`  no hits for "${q}"`); continue; }

      const smPath = path.join(OUT_DIR, `${target.id}.jpg`);
      const lgPath = path.join(OUT_DIR, `${target.id}-1280.jpg`);

      const smSize = await download(hit.webformatURL, smPath);
      const lgSize = await download(hit.largeImageURL, lgPath);

      console.log(`  OK [${q}] sm=${(smSize/1024).toFixed(0)}KB lg=${(lgSize/1024).toFixed(0)}KB id=${hit.id} user=${hit.user}`);
      return {
        id: target.id,
        keyword: q,
        fallback: q === target.q2,
        pixabayId: hit.id,
        user: hit.user,
        tags: hit.tags,
        pageURL: hit.pageURL,
        smSize, lgSize,
      };
    } catch (e) {
      console.log(`  FAIL [${q}]: ${e.message}`);
    }
  }
  return { id: target.id, error: "both keywords failed" };
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const meta = [];
  for (const t of TARGETS) {
    console.log(`\n=== ${t.id} ===`);
    const r = await processOne(t);
    meta.push(r);
    await new Promise((r) => setTimeout(r, 400)); // rate-limit politeness
  }
  fs.writeFileSync(path.join(OUT_DIR, "_meta.json"), JSON.stringify(meta, null, 2));
  const ok = meta.filter((m) => !m.error).length;
  const totalKB = meta.filter((m) => !m.error).reduce((s, m) => s + (m.smSize || 0) + (m.lgSize || 0), 0) / 1024;
  console.log(`\n=== DONE: ${ok}/${meta.length} success, total ${(totalKB/1024).toFixed(2)} MB ===`);
})();
