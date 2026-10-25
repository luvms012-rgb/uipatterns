// index.html의 window.DATA에서 서비스별 이미지 목록 추출 → style/services-<p>.json
const fs=require('fs'),path=require('path');
for(const p of ['mo','web']){
  const html=fs.readFileSync(path.join(__dirname,'..',p,'index.html'),'utf8');
  const a=html.indexOf('// __DATA_START__'), b=html.indexOf('// __DATA_END__');
  const chunk=html.slice(a,b); const DATA=JSON.parse(chunk.slice(chunk.indexOf('['), chunk.lastIndexOf(']')+1)).filter(d=>d.category!=='icons');
  const svcs={};
  for(const d of DATA){ const svc=d.name.split('_')[0]; (svcs[svc]=svcs[svc]||[]).push({c:d.category,p:d.path}); }
  fs.writeFileSync(path.join(__dirname,`services-${p}.json`),JSON.stringify(svcs));
  const counts=Object.entries(svcs).map(([k,v])=>v.length).sort((a,b)=>a-b);
  console.log(p,DATA.length,'svcs',Object.keys(svcs).length,'min',counts[0],'median',counts[counts.length>>1],'max',counts.at(-1),'<10:',counts.filter(x=>x<10).length);
  console.log(JSON.stringify(DATA[0]));
}
