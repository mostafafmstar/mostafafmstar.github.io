/* Mostafa Gym — body-composition report (InBody or similar): read, review, analyse, build a plan */
(function(){
"use strict";
const A=()=>PI.app;
const t=(k,v)=>A().t(k,v), esc=s=>A().esc(s), fmt=n=>A().fmt(n), nm=o=>A().nm(o);
const $=(s,r=document)=>r.querySelector(s);
const SEGS=["la","ra","tr","ll","rl"];
const FIELDS=[["date","f_date","text"],["w","weight","n"],["h","height","n"],["age","age","n"],["smm","f_smm","n"],["bfm","f_bfm","n"],["pbf","f_pbf","n"],["ffm","f_ffm","n"],["bmr","f_bmr","n"],["bmi","f_bmi","n"],["vfl","f_vfl","n"],["whr","f_whr","n"],["tbw","f_tbw","n"],["protein","f_protein","n"],["minerals","f_minerals","n"],["score","f_score","n"],["tw","f_tw","n"],["fc","f_fc","n"],["mc","f_mc","n"]];
let status={msg:"",lvl:""}, busy=false;

function B(){const S=A().S; if(!S.body) S.body={cur:null,entries:[]}; return S.body;}
const isNum=s=>/^[-+]?\d+(\.\d+)?$/.test(s);
const inR=(v,a,b)=>v!=null&&!isNaN(v)&&v>=a&&v<=b;

/* ---------------- text parser (InBody result sheets) ---------------- */
function parseText(txt){
  const T=txt.replace(/ /g," ").split(/\s+/).filter(Boolean); const m={seg:{}}; const N=s=>parseFloat(s);
  // labelled formats (when labels are real text)
  const L=(re,k,a,b)=>{if(m[k]!=null) return; const x=txt.match(re); if(x){const v=N(x[1]); if(inR(v,a,b)) m[k]=v;}};
  L(/Skeletal\s+Muscle\s+Mass[^0-9]{0,40}(\d+(?:\.\d+)?)/i,"smm",10,80);
  L(/Body\s+Fat\s+Mass[^0-9]{0,40}(\d+(?:\.\d+)?)/i,"bfm",1,120);
  L(/Percent\s+Body\s+Fat[^0-9]{0,40}(\d+(?:\.\d+)?)/i,"pbf",2,70);
  L(/Basal\s+Metabolic\s+Rate[^0-9]{0,40}(\d{3,4})/i,"bmr",800,3500);
  L(/Visceral\s+Fat\s+(?:Level|Area)?[^0-9]{0,40}(\d+(?:\.\d+)?)/i,"vfl",1,30);
  L(/Fat\s+Free\s+Mass[^0-9]{0,40}(\d+(?:\.\d+)?)/i,"ffm",20,130);
  L(/Waist[- ]Hip\s+Ratio[^0-9]{0,40}(\d\.\d+)/i,"whr",.5,1.5);
  // header
  for(let i=0;i<T.length;i++){
    let x=T[i].match(/^(\d{3}(?:\.\d)?)cm$/i); if(x&&m.h==null){m.h=N(x[1]);}
    x=T[i].match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})\.?$/); if(x&&!m.date) m.date=`${x[1]}-${x[2]}-${x[3]}`;
    if(/^\d{6,}$/.test(T[i])&&m.age==null&&/^\d{2}$/.test(T[i+1]||"")) m.age=N(T[i+1]);
    if(/^male$/i.test(T[i])) m.sex="m"; if(/^female$/i.test(T[i])) m.sex="f";
  }
  // composition table: (L) value, then (kg) values
  const li=T.indexOf("(L)"); if(li>=0&&isNum(T[li+1])) m.tbw=N(T[li+1]);
  const kg=[]; for(let i=Math.max(li,0);i<T.length&&kg.length<4;i++){ if(T[i]==="(kg)"&&isNum(T[i+1])) kg.push(N(T[i+1])); }
  if(kg.length===4){ if(m.protein==null) m.protein=kg[0]; if(m.minerals==null) m.minerals=kg[1]; if(m.bfm==null) m.bfm=kg[2]; m.w=kg[3]; }
  // bar charts: value after the 11-number scale
  const after=seq=>{for(let i=0;i<T.length-seq.length;i++){ if(seq.every((s,j)=>T[i+j]===s)){ let j=i+11; while(j<T.length&&!isNum(T[j])) j++; return isNum(T[j]||"")?N(T[j]):null; } } return null;};
  const W=after(["55","70","85","100"]); if(inR(W,25,250)&&m.w==null) m.w=W;
  const SM=after(["70","80","90","100","110"]); if(inR(SM,10,80)&&m.smm==null) m.smm=SM;
  const BF=after(["40","60","80","100","160"]); if(inR(BF,1,120)&&m.bfm==null) m.bfm=BF;
  const BI=after(["10.0","15.0","18.5"]); if(inR(BI,12,60)) m.bmi=BI;
  const PB=after(["0.0","5.0","10.0"]); if(inR(PB,2,70)&&m.pbf==null) m.pbf=PB;
  // segmental: "3.95kg" "106.6%"
  const pairs=[]; for(let i=0;i<T.length-1;i++){ const a=T[i].match(/^(\d+(?:\.\d+)?)kg$/i), b=(T[i+1]||"").match(/^(\d+(?:\.\d+)?)%$/); if(a&&b) pairs.push([N(a[1]),N(b[1])]); }
  if(pairs.length>=10){ SEGS.forEach((k,j)=>{ m.seg[k]={lk:pairs[j][0],lp:pairs[j][1],fk:pairs[j+5][0],fp:pairs[j+5][1]}; }); }
  // history: dd.mm.yy. dates with weight / SMM / PBF before them
  const di=[]; T.forEach((s,i)=>{ if(/^\d{2}\.\d{2}\.\d{2}\.$/.test(s)) di.push(i); });
  if(di.length>=2){ const n=di.length; const nums=[]; for(let i=di[0]-1;i>=0&&nums.length<3*n;i--){ if(isNum(T[i])) nums.unshift(N(T[i])); else if(nums.length) {/* keep scanning across unit labels */} }
    if(nums.length===3*n){ m.hist=di.map((ix,j)=>{const d=T[ix].split("."); return {date:`20${d[0]}-${d[1]}-${d[2]}`,w:nums[j],smm:nums[n+j],pbf:nums[2*n+j]};}); } }
  // research block after serial number
  const sn=T.findIndex(s=>/^S\/N:?$/i.test(s)||/S\/N/i.test(s));
  if(sn>=0){
    const V=[]; for(let i=sn+1;i<T.length&&V.length<16;i++){ const s=T[i]; if(s.includes("~")) continue;
      if(s==="-"&&isNum(T[i+1]||"")){V.push(-N(T[i+1])); i++; continue;}
      if(isNum(s)&&!/^F\d/.test(s)) V.push(N(s)); }
    if(V.length>=10&&inR(V[0],30,110)){
      m.score=V[0]; if(inR(V[1],25,250)) m.tw=V[1]; m.wc=V[2]; m.fc=V[3]; m.mc=V[4];
      let k=5; if(V[5]<1.5&&V[6]<1.5&&V[7]<1.5){ m.whr=m.whr??V[7]; k=8; }
      if(inR(V[k],1,30)) m.vfl=m.vfl??V[k];
      if(inR(V[k+1],20,130)) m.ffm=m.ffm??V[k+1];
      if(inR(V[k+2],800,3500)) m.bmr=m.bmr??V[k+2];
      if(inR(V[k+4],3,15)) m.smi=V[k+4];
      if(inR(V[k+5],1000,6000)) m.rec=V[k+5];
    }
  }
  if(m.ffm==null&&m.w&&m.bfm) m.ffm=Math.round((m.w-m.bfm)*10)/10;
  if(m.pbf==null&&m.w&&m.bfm) m.pbf=Math.round(m.bfm/m.w*1000)/10;
  if(!Object.keys(m.seg).length) delete m.seg;
  return m;
}
function countVals(m){return ["w","smm","bfm","pbf","ffm","bmr","vfl","whr","bmi","h","age"].filter(k=>m[k]!=null&&m[k]!=="").length + (m.seg?5:0);}

/* ---------------- reading files ---------------- */
let pdfP=null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfP||(pdfP=new Promise((res,rej)=>{const s=document.createElement("script"); s.src=window.PI_LIB_PDFJS||"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc=window.PI_LIB_PDFW||"lib/pdf.worker.min.js";}catch(e){} res(window.pdfjsLib);}; s.onerror=rej; document.head.appendChild(s);}));
}
async function pdfToTextAndImage(buf){
  const lib=await loadPdfJs(); const doc=await lib.getDocument({data:buf}).promise; const page=await doc.getPage(1);
  const tc=await page.getTextContent(); const txt=tc.items.map(i=>i.str+(i.hasEOL?"\n":" ")).join("");
  const vp=page.getViewport({scale:1.6}); const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height;
  await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
  const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
  return {txt,blob};
}
const VISION_KEYS=`{"date":"YYYY-MM-DD","sex":"m|f","age":0,"h":0,"w":0,"tbw":0,"protein":0,"minerals":0,"bfm":0,"smm":0,"bmi":0,"pbf":0,"ffm":0,"bmr":0,"vfl":0,"whr":0,"score":0,"tw":0,"wc":0,"fc":0,"mc":0,"smi":0,
"seg":{"la":{"lk":0,"lp":0,"fk":0,"fp":0},"ra":{...},"tr":{...},"ll":{...},"rl":{...}},"hist":[{"date":"YYYY-MM-DD","w":0,"smm":0,"pbf":0}]}`;
async function vision(blob){
  const sample=await A().use("sample"); if(!sample) return null;
  try{const lim=await sample.limits(); if(!lim||!lim.images) return null;}catch(e){return null;}
  status={msg:t("body_ai_reading"),lvl:"info"}; draw();
  const prompt=`This image is a body-composition report (InBody or a similar analyser). Read the numbers exactly as printed and return ONLY a JSON object with these keys (use null for anything not on the report):
${VISION_KEYS}
Units: kg, cm, %, kcal. seg = segmental lean (lk kg, lp % of normal) and segmental fat (fk kg, fp % of normal) for left arm, right arm, trunk, left leg, right leg. fc/wc/mc are the "control" values (negative means lose). hist = body-composition history columns if shown.`;
  try{ return await sample.json(prompt,{images:[blob],modelTier:"default"}); }catch(e){ return null; }
}
function cleanVision(o){
  if(!o||typeof o!=="object") return null; const m={};
  for(const [k] of FIELDS){ if(k==="date"){ if(typeof o.date==="string") m.date=o.date; continue; } const v=parseFloat(o[k]); if(!isNaN(v)) m[k]=v; }
  for(const k of ["wc","smi"]) if(!isNaN(parseFloat(o[k]))) m[k]=parseFloat(o[k]);
  if(o.sex==="m"||o.sex==="f") m.sex=o.sex;
  if(o.seg&&typeof o.seg==="object"){ const s={}; SEGS.forEach(k=>{const g=o.seg[k]; if(g) s[k]={lk:+g.lk||null,lp:+g.lp||null,fk:+g.fk||null,fp:+g.fp||null};}); if(Object.keys(s).length) m.seg=s; }
  if(Array.isArray(o.hist)) m.hist=o.hist.filter(h=>h&&h.w).map(h=>({date:String(h.date||""),w:+h.w,smm:+h.smm||null,pbf:+h.pbf||null}));
  return m;
}
async function handleFile(file){
  if(!file||busy) return; busy=true; status={msg:t("body_reading"),lvl:"info"}; draw();
  let m=null, blob=null;
  try{
    if(/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name)){
      const buf=await file.arrayBuffer(); const r=await pdfToTextAndImage(buf); blob=r.blob; m=parseText(r.txt);
    } else { blob=file; }
    if(!m||countVals(m)<8){ const v=cleanVision(await vision(blob)); if(v) m=Object.assign({},m||{},v); }
  }catch(e){ console.error(e); }
  busy=false;
  const S=A().S; const base={sex:S.p.sex,age:S.p.age,h:S.p.h,w:S.p.w};
  if(m&&countVals(m)>=3){
    const cur=Object.assign(base,m); B().cur=cur; B().file=file.name;
    status={msg:countVals(m)>=8?t("body_read_ok",{n:countVals(m)}):t("body_read_partial"),lvl:countVals(m)>=8?"good":"warn"};
  } else { B().cur=Object.assign(base,{date:new Date().toISOString().slice(0,10)}); status={msg:t("body_read_fail"),lvl:"warn"}; }
  A().save(); draw();
}

/* ---------------- analysis ---------------- */
function prevEntry(m){
  const hs=(m.hist||[]).slice().sort((a,b)=>a.date<b.date?-1:1);
  if(hs.length>=2) return {prev:hs[hs.length-2],last:hs[hs.length-1]};
  const es=(B().entries||[]).filter(e=>e.date&&e.date<(m.date||"9")).sort((a,b)=>a.date<b.date?-1:1);
  if(es.length&&m.smm&&m.pbf) return {prev:es[es.length-1],last:{smm:m.smm,pbf:m.pbf,w:m.w}};
  return null;
}
function analyze(m){
  const f=[]; const male=(m.sex||A().S.p.sex)!=="f";
  const rng=male?[10,20,25]:[18,28,33]; const rs=`${rng[0]}–${rng[1]}%`;
  let goal="recomp", gg="hypertrophy", cardio=0; const focus=new Set();
  const pbf=+m.pbf;
  if(pbf){
    if(pbf<rng[0]){f.push(["warn",t("b_bf_low",{v:pbf,r:rs})]); goal="lean_gain";}
    else if(pbf<=rng[1]){f.push(["good",t("b_bf_ok",{v:pbf,r:rs})]); goal="lean_gain";}
    else if(pbf<=rng[2]){f.push(["warn",t("b_bf_slight",{v:pbf,r:rs})]); goal="recomp"; cardio=Math.max(cardio,20);}
    else {f.push(["bad",t("b_bf_over",{v:pbf,r:rs})]); goal="fat_loss"; gg="hypertrophy"; cardio=Math.max(cardio,25);}
  }
  if(+m.vfl){ if(m.vfl>=10){f.push(["bad",t("b_vf_high",{v:m.vfl})]); cardio=Math.max(cardio,30); if(goal!=="fat_loss") goal="fat_loss";} else f.push(["good",t("b_vf_ok",{v:m.vfl})]); }
  if(+m.whr&&m.whr>(male?.9:.85)) {f.push(["warn",t("b_whr_high",{v:m.whr})]); cardio=Math.max(cardio,20);}
  const sg=m.seg||{};
  if(sg.tr&&+sg.tr.fp>150){ f.push(["bad",t("b_trunk_fat",{v:sg.tr.fp})]); cardio=Math.max(cardio,25); if(goal==="lean_gain") goal="recomp"; }
  const smi=+m.smi||(m.seg&&m.h?Math.round((SEGS.filter(k=>k!=="tr").reduce((a,k)=>a+(+sg[k]?.lk||0),0))/((m.h/100)**2)*10)/10:0);
  if(smi){ if(smi<(male?7:5.7)) {f.push(["bad",t("b_smi_low",{v:smi})]); if(goal==="fat_loss") goal="recomp";} else f.push(["good",t("b_smi_ok",{v:smi})]); }
  if(sg.la&&sg.ra&&sg.ll&&sg.rl&&+sg.la.lp&&+sg.ll.lp){
    const arms=(+sg.la.lp + +sg.ra.lp)/2, legs=(+sg.ll.lp + +sg.rl.lp)/2; let any=false;
    if(legs<arms-4){f.push(["warn",t("b_legs_weak",{v:Math.round(legs),a:Math.round(arms)})]); ["quads","hamstrings","glutes"].forEach(x=>focus.add(x)); any=true;}
    else if(arms<legs-4){f.push(["warn",t("b_arms_weak",{v:Math.round(arms),l:Math.round(legs)})]); ["biceps","triceps","shoulders"].forEach(x=>focus.add(x)); any=true;}
    const da=Math.abs(sg.la.lp-sg.ra.lp), dl=Math.abs(sg.ll.lp-sg.rl.lp);
    if(da>5){f.push(["warn",t("b_imb",{a:t("seg_la"),b:t("seg_ra"),d:Math.round(da)})]); any=true;}
    if(dl>5){f.push(["warn",t("b_imb",{a:t("seg_ll"),b:t("seg_rl"),d:Math.round(dl)})]); focus.add("quads"); any=true;}
    if(!any) f.push(["good",t("b_balanced")]);
  }
  const pe=prevEntry(m);
  if(pe&&+pe.prev.smm&&+pe.last.smm){
    const dm=Math.round((pe.last.smm-pe.prev.smm)*10)/10, df=Math.round(((pe.last.pbf||0)-(pe.prev.pbf||0))*10)/10;
    if(dm<0&&df>0) f.push(["bad",t("b_hist_bad",{m:Math.abs(dm),f:df})]);
    else f.push(["good",t("b_hist_good",{m:(dm>0?"+":"")+dm,f:(df>0?"+":"")+df})]);
  }
  if(+m.tw&&+m.fc<0) f.push(["info",t("b_target",{tw:m.tw,fc:m.fc,weeks:Math.ceil(Math.abs(m.fc)/.5)})]);
  if(+m.bmr) f.push(["info",t("b_bmr",{v:m.bmr})]);
  if(goal==="fat_loss") gg="hypertrophy";
  const days=goal==="fat_loss"?5:4;
  return {f,goal,gg,cardio,focus:[...focus],days};
}

/* ---------------- apply ---------------- */
function apply(){
  const m=B().cur; if(!m) return; const a=analyze(m); const S=A().S;
  if(+m.w) S.p.w=+m.w; if(+m.h) S.p.h=+m.h; if(+m.age) S.p.age=+m.age; if(m.sex) S.p.sex=m.sex;
  if(+m.bmr>800){S.p.bmrR=+m.bmr; S.p.useR=true;} if(+m.ffm>20) S.p.ffm=+m.ffm;
  S.p.goal=a.goal; S.p.mode="auto"; S.p.link=true;
  S.gym.gg=a.gg; S.gym.focus=a.focus; S.gym.cardioMin=a.cardio; if(S.gym.mode==="library") S.gym.mode="general";
  if(S.gym.wd.length<a.days) S.gym.wd=A().WD_PATTERN[a.days].slice();
  A().buildPlan(S.p.style==="tayyibat"?(S.meals.length||2):Math.max(4,S.meals.length));
  const E=B().entries||(B().entries=[]); const key=m.date||new Date().toISOString().slice(0,10);
  const rec={date:key,w:+m.w||null,smm:+m.smm||null,pbf:+m.pbf||null,bfm:+m.bfm||null};
  const ix=E.findIndex(e=>e.date===key); if(ix>=0) E[ix]=rec; else E.push(rec);
  const T=A().targets();
  A().render();
  A().toast(t("body_applied",{goal:nm(PI.goals[a.goal]),kcal:fmt(T.kcal),p:T.P,days:S.gym.wd.length})+(a.focus.length?" "+t("p_focus")+": "+a.focus.map(x=>nm(PI.muscles[x])).join("، "):"")+(a.cardio?" · "+t("p_cardio")+" "+t("p_cardio_v",{m:a.cardio}):""),8000);
}

/* ---------------- rendering ---------------- */
function segGrid(m){
  const sg=m.seg||{}; const cell=k=>{const s=sg[k]||{}; const over=+s.fp>150, lw=+s.lp&&s.lp<90;
    return `<div class="segc ${k}"><b>${esc(t("seg_"+k))}</b>
      <label>${esc(t("lean"))}<input class="in num" data-bseg="${k}.lk" type="number" step="0.01" value="${s.lk??""}"><i>kg</i><input class="in num" data-bseg="${k}.lp" type="number" step="0.1" value="${s.lp??""}"><i>%</i></label>
      <label class="${over?"bad":""}">${esc(t("fatw"))}<input class="in num" data-bseg="${k}.fk" type="number" step="0.1" value="${s.fk??""}"><i>kg</i><input class="in num" data-bseg="${k}.fp" type="number" step="0.1" value="${s.fp??""}"><i>%</i></label>
      ${lw?`<span class="pill p">↓</span>`:""}</div>`;};
  return `<div class="seggrid">${cell("la")}${cell("tr")}${cell("ra")}${cell("ll")}<div class="segfig">${A().bodyMap([],[],60)}</div>${cell("rl")}</div>`;
}
function historyTable(m){
  const rows=[]; const seen=new Set();
  (m.hist||[]).concat(B().entries||[]).forEach(h=>{ if(!h||!h.date||seen.has(h.date)) return; seen.add(h.date); rows.push(h); });
  if(rows.length<2) return "";
  rows.sort((a,b)=>a.date<b.date?-1:1);
  const d=(a,b,good)=>{ if(a==null||b==null) return ""; const x=Math.round((b-a)*10)/10; if(!x) return `<i class="flat">0</i>`; const ok=good==="up"?x>0:x<0; return `<i class="${ok?"up":"down"}">${x>0?"+":""}${x}</i>`; };
  return `<section class="card"><h3><img src="img/food/chart_increasing.webp" alt="">${esc(t("body_history"))}</h3><div class="ptable"><table><thead><tr><th>${esc(t("f_date"))}</th><th>${esc(t("weight"))}</th><th>SMM</th><th>PBF %</th></tr></thead><tbody>
    ${rows.map((r,i)=>{const p=rows[i-1]||{}; return `<tr><td class="num">${esc(r.date)}</td><td class="num">${r.w??"–"} ${i?d(p.w,r.w,"down"):""}</td><td class="num">${r.smm??"–"} ${i?d(p.smm,r.smm,"up"):""}</td><td class="num">${r.pbf??"–"} ${i?d(p.pbf,r.pbf,"down"):""}</td></tr>`;}).join("")}
  </tbody></table></div></section>`;
}
function render(){
  const b=B(), m=b.cur;
  const up=`<section class="card"><h3><img src="img/food/balance_scale.webp" alt="">${esc(t("body_title"))}</h3><p class="sub">${esc(t("body_desc"))}</p>
    <label class="drop" id="bodyDrop"><input type="file" id="bodyFile" accept="application/pdf,.pdf,image/*" hidden><img src="img/food/clipboard.webp" alt=""><b>${esc(t("body_pick"))}</b><span>${esc(t("body_drop"))} · PDF / JPG / PNG</span></label>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-bmanual>${esc(t("body_manual"))}</button>${m?`<button class="btn sm ghost" data-bclear>${esc(t("body_clear"))}</button>`:""}</div>
    <p class="bstatus ${status.lvl}" role="status">${esc(status.msg||"")}</p></section>`;
  if(!m) return up;
  const a=analyze(m);
  const fields=FIELDS.map(([k,l,ty])=>`<label class="f">${esc(t(l))}<input class="in num" data-bk="${k}" type="${ty==="n"?"number":"text"}" ${ty==="n"?'step="any"':""} value="${m[k]??""}"></label>`).join("");
  const S=A().S; const G=PI.goals[a.goal];
  const plan=`<section class="card plan"><h3><img src="img/food/trophy.webp" alt="">${esc(t("body_plan"))}</h3>
    <div class="kpis">
      <div class="kpi hl"><span>${esc(t("p_goal"))}</span><b style="font-size:1.2rem">${esc(nm(G))}</b><i>${esc(G.d[S.lang]||G.d.en)}</i></div>
      <div class="kpi"><span>${esc(t("p_train"))}</span><b style="font-size:1.2rem">${esc(t("gg_"+a.gg))}</b><i>${esc(t("days_n",{n:Math.max(a.days,S.gym.wd.length)}))}</i></div>
      <div class="kpi"><span>${esc(t("p_cardio"))}</span><b style="font-size:1.2rem">${a.cardio?esc(t("p_cardio_v",{m:a.cardio})):esc(t("none"))}</b><i>${esc(t("p_focus"))}: ${a.focus.length?esc(a.focus.map(x=>nm(PI.muscles[x])).join("، ")):esc(t("none"))}</i></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn pri" data-bapply><img src="img/food/sparkles.webp" alt="">${esc(t("body_apply"))}</button><button class="btn sun" data-bai><img src="img/food/robot.webp" alt="">${esc(t("body_ai"))}</button></div>
    <div class="aibox" id="bodyAi" hidden></div></section>`;
  return up+`
  <section class="card"><h3><img src="img/food/flexed_biceps.webp" alt="">${esc(t("body_findings"))}</h3>
    <ul class="finds">${a.f.map(([l,x])=>`<li class="${l}"><span class="dot"></span>${esc(x)}</li>`).join("")}</ul></section>
  ${plan}
  <section class="card"><h3><img src="img/food/clipboard.webp" alt="">${esc(t("body_values"))}${b.file?` <small class="sub">· ${esc(b.file)}</small>`:""}</h3>
    <div class="bgrid">${fields}</div>
    <label class="f" style="margin-top:10px">${esc(t("sex"))}<span class="radio" role="group"><button data-bsex="m" aria-pressed="${(m.sex||S.p.sex)==="m"}">${esc(t("male"))}</button><button data-bsex="f" aria-pressed="${(m.sex||S.p.sex)==="f"}">${esc(t("female"))}</button></span></label></section>
  <section class="card"><h3><img src="img/food/person_lifting_weights.webp" alt="">${esc(t("body_segments"))}</h3>${segGrid(m)}</section>
  ${historyTable(m)}`;
}
function draw(){ const A0=A(); if(A0.S.tab==="body"){ const P=document.getElementById("panel"); if(P) P.innerHTML=render(); } }
function pdfBlock(){
  const m=B().cur; if(!m) return ""; const a=analyze(m);
  const kv=[["weight",m.w,"kg"],["f_smm",m.smm,""],["f_pbf",m.pbf,""],["f_bfm",m.bfm,""],["f_vfl",m.vfl,""],["f_bmr",m.bmr,""]].filter(x=>x[1]!=null&&x[1]!=="");
  return `<div class="rb"><h2>${esc(t("tab_body"))}${m.date?` · <span class="num">${esc(m.date)}</span>`:""}</h2>
    <div class="rk">${kv.slice(0,4).map(([l,v])=>`<div><span>${esc(t(l))}</span><b class="num">${esc(v)}</b></div>`).join("")}</div>
    <ul style="margin:8px 0 0;padding-inline-start:18px;font-size:11px">${a.f.slice(0,7).map(([l,x])=>`<li style="color:${l==="bad"?"#C4170F":l==="warn"?"#8a5c0b":"#14261B"}">${esc(x)}</li>`).join("")}</ul></div>`;
}

/* ---------------- Claude narrative ---------------- */
async function aiAnalysis(btn){
  const out=document.getElementById("bodyAi"); out.hidden=false;
  const sample=await A().use("sample"); if(!sample){out.textContent=t("ai_off"); return;}
  const m=B().cur; const a=analyze(m); const S=A().S; const LN={ar:"Arabic (Egyptian, friendly)",en:"English",hi:"Hindi",bn:"Bengali"}[S.lang];
  const prompt=`You are a sports nutritionist and strength coach. Write in ${LN} only, plain text, no markdown headings, under 220 words.
Body-composition report: ${JSON.stringify(m)}
Rule-based findings: ${a.f.map(x=>x[1]).join(" | ")}
Chosen plan: goal ${PI.goals[a.goal].n.en}, training ${a.gg}, cardio ${a.cardio} min, priority muscles ${a.focus.join(", ")||"none"}, current daily target ${A().targets().kcal} kcal and ${A().targets().P} g protein.
Explain in 5–7 short numbered points what the report means for this person and exactly what to change in food and training over the next 8 weeks, including what result to expect at the next test. Be specific to the numbers.`;
  btn.disabled=true; out.textContent=t("ai_working");
  try{const r=await sample(prompt,{modelTier:"default",onText:({text})=>{out.textContent=text;}}); out.textContent=r.text;}
  catch(e){out.textContent=e&&e.code==="rate_limited"?t("ai_busy"):t("ai_off");}
  btn.disabled=false;
}

/* ---------------- events ---------------- */
document.addEventListener("change",ev=>{ const el=ev.target; if(el.id==="bodyFile"&&el.files&&el.files[0]) handleFile(el.files[0]); });
document.addEventListener("input",ev=>{
  const el=ev.target; const m=B().cur; if(!m) return;
  if(el.dataset.bk){ const k=el.dataset.bk; m[k]=el.type==="number"?(el.value===""?null:+el.value):el.value; A().save(); }
  if(el.dataset.bseg){ const [k,f]=el.dataset.bseg.split("."); m.seg=m.seg||{}; m.seg[k]=m.seg[k]||{}; m.seg[k][f]=el.value===""?null:+el.value; A().save(); }
});
document.addEventListener("focusout",ev=>{ const el=ev.target; if(el.dataset&&(el.dataset.bk||el.dataset.bseg)){ const id=el.dataset.bk||el.dataset.bseg; setTimeout(()=>{ if(!document.activeElement||!(document.activeElement.dataset.bk||document.activeElement.dataset.bseg)){ draw(); } },60); } });
document.addEventListener("click",ev=>{
  const b=ev.target.closest("button"); if(!b) return; const d=b.dataset;
  if(d.bmanual!=null){ const S=A().S; if(!B().cur) B().cur={sex:S.p.sex,age:S.p.age,h:S.p.h,w:S.p.w,date:new Date().toISOString().slice(0,10)}; status={msg:"",lvl:""}; A().save(); draw(); return; }
  if(d.bclear!=null){ B().cur=null; B().file=null; status={msg:"",lvl:""}; A().save(); draw(); return; }
  if(d.bsex){ B().cur.sex=d.bsex; A().save(); draw(); return; }
  if(d.bapply!=null) return apply();
  if(d.bai!=null) return aiAnalysis(b);
});
["dragover","dragenter"].forEach(n=>document.addEventListener(n,ev=>{const z=ev.target.closest&&ev.target.closest("#bodyDrop"); if(z){ev.preventDefault(); z.classList.add("over");}}));
document.addEventListener("dragleave",ev=>{const z=ev.target.closest&&ev.target.closest("#bodyDrop"); if(z) z.classList.remove("over");});
document.addEventListener("drop",ev=>{const z=ev.target.closest&&ev.target.closest("#bodyDrop"); if(z){ev.preventDefault(); z.classList.remove("over"); const f=ev.dataTransfer.files&&ev.dataTransfer.files[0]; if(f) handleFile(f);}});

PI.body={render,pdfBlock,parseText,analyze};
})();
