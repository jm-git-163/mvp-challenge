/**
 * scripts/fix-bad-thumbnails-round2.js
 *
 * 사용자 지적: 스쿼트/언박싱/댄스 썸네일이 맥락에 안 맞거나 선정적.
 * 더 구체적인 키워드 + editors_choice 로 재수집.
 */

const fs = require('fs');
const path = require('path');
const key = fs.readFileSync(path.join(__dirname,'..','픽사베이api.txt'),'utf8').trim();

// target: ['file', 'templateId', queryOptions]
const TARGETS = [
  // Supabase UUID 버전 (홈에서 실제 보이는 것)
  { file: 'supabaseThumbnails', id: 'af337411-5b84-408a-b16a-e4fc04e78ebb', name: '신상템 언박싱',
    candidates: [
      { q: 'smartphone unboxing hands new', cat: 'business', o: 'horizontal' },
      { q: 'opening cardboard box package',  cat: 'business', o: 'horizontal' },
      { q: 'new gadget unboxing review',     cat: 'business', o: 'horizontal' },
    ]},
  // mockData 버전 (fitness 필터 눌렀을 때 폴백으로 보이는 것)
  { file: 'templateThumbnails', id: 'fitness-squat-001', name: '스쿼트 10회',
    candidates: [
      { q: 'squat exercise home mat floor', cat: 'sports', o: 'vertical' },
      { q: 'woman doing squat home workout', cat: 'sports', o: 'vertical' },
      { q: 'fitness squat indoor exercise',  cat: 'sports', o: 'horizontal' },
    ]},
  { file: 'templateThumbnails', id: 'fitness-squat-50', name: '스쿼트 50회',
    candidates: [
      { q: 'home workout squat floor woman athletic wear', cat: 'sports', o: 'vertical' },
      { q: 'squat exercise challenge mat',                  cat: 'sports', o: 'horizontal' },
      { q: 'bodyweight squat training',                     cat: 'sports', o: 'horizontal' },
    ]},
  { file: 'templateThumbnails', id: 'dance-hiphop-001', name: '힙합 댄스',
    candidates: [
      { q: 'hip hop dancer pose street',    cat: 'music', o: 'vertical' },
      { q: 'street dance performance urban', cat: 'music', o: 'vertical' },
      { q: 'hip hop dance silhouette stage', cat: 'music', o: 'vertical' },
    ]},
  { file: 'templateThumbnails', id: 'dance-kpop-001', name: 'K-POP 댄스',
    candidates: [
      { q: 'korean idol dance performance stage', cat: 'music', o: 'vertical' },
      { q: 'dance performance stage lights choreography', cat: 'music', o: 'vertical' },
      { q: 'girl group dance neon stage',               cat: 'music', o: 'vertical' },
    ]},
];

async function fetchFirstOk(candidates, usedIds) {
  for (const opt of candidates) {
    const p = new URLSearchParams({
      key, q: opt.q, image_type: 'photo',
      orientation: opt.o ?? 'all', category: opt.cat ?? '',
      safesearch: 'true', editors_choice: 'false', per_page: '20', lang: 'en',
    });
    try {
      const res = await fetch(`https://pixabay.com/api/?${p}`);
      if (!res.ok) continue;
      const j = await res.json();
      if (!j.hits?.length) continue;
      // 첫 번째 중복 안되고 sensitive tag 없는 것
      for (const hit of j.hits) {
        if (usedIds.has(hit.id)) continue;
        const tags = (hit.tags || '').toLowerCase();
        // 필터: 문신/선정/탱고/스커트/힐 등 컨텍스트 어긋난 것
        if (/tattoo|tango|skirt|heel|bikini|lingerie|sensual|sexy|religion|church|cult|naked/.test(tags)) continue;
        return { hit, query: opt.q };
      }
    } catch { /* next */ }
  }
  return null;
}

async function main() {
  // Load existing files
  const thumbFile    = path.join(__dirname,'..','services','templateThumbnails.ts');
  const supFile      = path.join(__dirname,'..','services','supabaseThumbnails.ts');
  const parseMap = (file) => {
    const src = fs.readFileSync(file,'utf8');
    const jsonStart = src.indexOf('{', src.indexOf('Record<string'));
    const jsonEnd   = src.lastIndexOf('}');
    return { src, header: src.slice(0, jsonStart), map: JSON.parse(src.slice(jsonStart, jsonEnd+1)) };
  };
  const thumb = parseMap(thumbFile);
  const sup   = parseMap(supFile);

  const used = new Set([
    ...Object.values(thumb.map).map(v=>v.pixabayId),
    ...Object.values(sup.map).map(v=>v.pixabayId),
  ]);

  for (const t of TARGETS) {
    // 기존 id 의 pixabayId 는 used 에서 빼서 새 사진 고르도록
    const bag = t.file === 'templateThumbnails' ? thumb.map : sup.map;
    used.delete(bag[t.id]?.pixabayId);
    process.stdout.write(`  [${t.file}] ${t.name} … `);
    const r = await fetchFirstOk(t.candidates, used);
    if (!r) { console.log('MISS'); continue; }
    const h = r.hit;
    bag[t.id] = {
      url: h.webformatURL,
      largeURL: h.largeImageURL,
      tags: h.tags,
      user: h.user,
      pixabayId: h.id,
    };
    used.add(h.id);
    console.log(`OK #${h.id} (${r.query})`);
    await new Promise(r => setTimeout(r, 300));
  }

  fs.writeFileSync(thumbFile, thumb.header + JSON.stringify(thumb.map, null, 2) + ' as const;\n', 'utf8');
  fs.writeFileSync(supFile,   sup.header   + JSON.stringify(sup.map,   null, 2) + ' as const;\n', 'utf8');

  // 중복 재검사
  const all = [...Object.values(thumb.map), ...Object.values(sup.map)];
  const counts = {};
  all.forEach(v => counts[v.pixabayId] = (counts[v.pixabayId]||0)+1);
  const dups = Object.entries(counts).filter(([,c])=>c>1);
  if (dups.length===0) console.log('\n✓ 전체 중복 없음');
  else console.log('\n⚠ 중복:', dups);
}
main().catch(e => { console.error(e); process.exit(1); });
