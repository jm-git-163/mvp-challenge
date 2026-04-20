/**
 * patch-dist.js
 * expo export 후 자동 실행 — dist/index.html 에 캐시버스터 스크립트 주입.
 *
 * ⚠️ 중요: 이 스크립트는 **번들 JS 내용을 변조하지 않는다.**
 *   - entry-XXX.js 파일명에서 해시만 읽음 (read-only).
 *   - dist/index.html 의 <head>/<body> 에만 meta·script 삽입.
 *   - Terser/esbuild 출력물은 그대로 보존 → `q is not a function` 류 심볼 파손 발생 불가.
 *
 * 호출 경로: package.json scripts.postexport (expo export 후 자동) 또는 scripts.build:web.
 */

const fs   = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. 번들 해시 추출 (entry-XXXXXXXX...)
const bundleMatch = html.match(/entry-([a-f0-9]+)[^"']*.js/);
const buildId = bundleMatch ? bundleMatch[1].slice(0, 8) : String(Date.now());

console.log('[patch-dist] Build ID:', buildId);

// 2. 이미 패치된 경우 스킵
if (html.includes('__mvpBuild')) {
  console.log('[patch-dist] Already patched, skipping.');
  process.exit(0);
}

// 3. Cache-Control 메타 태그 추가 (</head> 앞에)
const cacheMeta = `
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />`;

html = html.replace('</head>', cacheMeta + '\n</head>');

// 4. localStorage 캐시버스터 주입 (<body> 바로 다음)
const cacheBuster = `
    <!-- Cache-buster: forces fresh load when bundle changes. Build: ${buildId}. -->
    <script>
      (function(){
        var BUILD='${buildId}';
        try {
          if(localStorage.getItem('__mvpBuild')!==BUILD){
            localStorage.setItem('__mvpBuild',BUILD);
            var url=location.pathname+'?_b='+BUILD+(location.hash||'');
            location.replace(url);
          }
        } catch(e){}
      })();
    </script>`;

html = html.replace('<body>', '<body>' + cacheBuster);

// 5. 저장
fs.writeFileSync(indexPath, html, 'utf8');
console.log('[patch-dist] index.html patched successfully. Build:', buildId);
