/**
 * patch-dist.js
 * expo export 후 자동 실행 — dist/index.html 에 캐시버스터 스크립트 주입
 * vercel.json buildCommand: "npx expo export --platform web && node scripts/patch-dist.js"
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
