const fs=require('fs'),path=require('path');
const key=fs.readFileSync(path.join(__dirname,'..','픽사베이api.txt'),'utf8').trim();
(async()=>{
  const queries=[
    'korean kpop idol stage dance',
    'girl group dance stage performance',
    'kpop dance neon lights',
    'asian woman dancing stage',
    'choreography dance stage spotlight',
  ];
  const thumbFile=path.join(__dirname,'..','services','templateThumbnails.ts');
  const supFile=path.join(__dirname,'..','services','supabaseThumbnails.ts');
  const parse=f=>{const s=fs.readFileSync(f,'utf8');const a=s.indexOf('{',s.indexOf('Record<string'));const b=s.lastIndexOf('}');return{s,h:s.slice(0,a),m:JSON.parse(s.slice(a,b+1))}};
  const t=parse(thumbFile), u=parse(supFile);
  const used=new Set([...Object.values(t.m),...Object.values(u.m)].map(v=>v.pixabayId));
  used.delete(t.m['dance-kpop-001']?.pixabayId);
  used.delete(u.m['e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54']?.pixabayId);
  const bad=/rock|guitar|concert|tattoo|tango|skirt|heel|bikini|lingerie|sensual|sexy|religion|church|cult|naked|guitarist|band/i;
  let picked=null;
  for(const q of queries){
    const p=new URLSearchParams({key,q,image_type:'photo',orientation:'vertical',safesearch:'true',per_page:'30',lang:'en'});
    const r=await fetch('https://pixabay.com/api/?'+p); if(!r.ok)continue;
    const j=await r.json();
    for(const h of (j.hits||[])){
      if(used.has(h.id))continue;
      if(bad.test(h.tags||''))continue;
      picked={h,q};break;
    }
    if(picked)break;
    await new Promise(r=>setTimeout(r,300));
  }
  if(!picked){console.log('no pick');return;}
  console.log('picked',picked.h.id,'q:',picked.q,'tags:',picked.h.tags);
  const val={url:picked.h.webformatURL,largeURL:picked.h.largeImageURL,tags:picked.h.tags,user:picked.h.user,pixabayId:picked.h.id};
  t.m['dance-kpop-001']=val;
  u.m['e2d9cc60-08c3-4200-86ba-3a7cdfa6ad54']=val;
  fs.writeFileSync(thumbFile,t.h+JSON.stringify(t.m,null,2)+' as const;\n','utf8');
  fs.writeFileSync(supFile,u.h+JSON.stringify(u.m,null,2)+' as const;\n','utf8');
  console.log('written');
})();
