/* Mostafa Gym — import a training program from PDF / images.
   Pages are read with pdf.js (text) and rendered to images when the text alone can't carry the program
   (photo-based gym sheets, divider pages). Claude reads the pages (via the `sample` capability) into a
   structured program; every exercise is matched to the dashboard's library so it gets images, technique,
   videos, alternatives and missing-machine swaps. */
(function(){
"use strict";
const A=()=>PI.app, t=(k,v)=>A().t(k,v), esc=s=>A().esc(s);
const $=(s,r=document)=>r.querySelector(s);
let busy=false, ctl=null, status=null; // {msg,lvl}

/* ---------- helpers ---------- */
const loc=o=>o==null?"":typeof o==="string"?o:(o[A().S.lang]||o.en||o.ar||"");
const int=v=>{const n=parseInt(v,10); return isNaN(n)?null:n;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let pdfP=null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfP||(pdfP=new Promise((res,rej)=>{const s=document.createElement("script"); s.src=window.PI_LIB_PDFJS||"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc=window.PI_LIB_PDFW||"lib/pdf.worker.min.js";}catch(e){} res(window.pdfjsLib);}; s.onerror=rej; document.head.appendChild(s);}));
}
const canvasBlob=(c,q)=>new Promise(r=>c.toBlob(r,"image/jpeg",q||.82));
async function shrinkImage(file,maxW){
  const url=URL.createObjectURL(file);
  try{ const img=await new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url;});
    const s=Math.min(1,maxW/img.naturalWidth); const c=document.createElement("canvas"); c.width=Math.round(img.naturalWidth*s); c.height=Math.round(img.naturalHeight*s);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height); return await canvasBlob(c,.85);
  } finally { URL.revokeObjectURL(url); }
}
function setStatus(msg,lvl){ status=msg?{msg,lvl:lvl||"info"}:null; const el=$("#progStatus"); if(el){ el.textContent=msg||""; el.className="pstat "+(lvl||"info"); el.hidden=!msg; } }

/* ---------- pages ---------- */
async function filesToPages(files){
  const pages=[]; let total=0;
  for(const f of files){
    if(/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name)){
      const lib=await loadPdfJs(); const doc=await lib.getDocument({data:await f.arrayBuffer()}).promise; total+=doc.numPages;
      const few=doc.numPages<=12;
      for(let i=1;i<=doc.numPages;i++){
        setStatus(t("file_reading_pages",{i,n:doc.numPages,f:f.name}));
        const pg=await doc.getPage(i); const tc=await pg.getTextContent();
        const text=tc.items.map(x=>x.str+(x.hasEOL?"\n":" ")).join("").replace(/[ \t]+/g," ").trim();
        let img=null;
        if(few||text.length<40){ const vp0=pg.getViewport({scale:1}); const sc=Math.min(2.2,1300/vp0.width); const vp=pg.getViewport({scale:sc});
          const c=document.createElement("canvas"); c.width=vp.width; c.height=vp.height; await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise; img=await canvasBlob(c); }
        pages.push({file:f.name,n:i,text,img});
      }
    } else if(/^image\//.test(f.type)||/\.(png|jpe?g|webp)$/i.test(f.name)){
      total++; pages.push({file:f.name,n:1,text:"",img:await shrinkImage(f,1400)});
    }
  }
  return pages;
}
function chunk(pages,maxImg){
  const out=[]; let cur=[], imgs=0, chars=0;
  for(const p of pages){
    const pi=p.img?1:0, pc=p.text.length;
    if(cur.length&&(imgs+pi>maxImg||chars+pc>90000)){ out.push(cur); cur=[]; imgs=0; chars=0; }
    cur.push(p); imgs+=pi; chars+=pc;
  }
  if(cur.length) out.push(cur);
  return out;
}

/* ---------- prompt ---------- */
const LANGN={ar:"Arabic (Egyptian, simple)",en:"English",hi:"Hindi",bn:"Bengali"};
function library(){ return Object.keys(PI.ex).map(id=>`${id}|${PI.ex[id].g}|${PI.ex[id].n.en}`).join("\n"); }
function prompt(part,k,n){
  const S=A().S;
  const pagesTxt=part.map((p,i)=>`--- PAGE ${p.file} #${p.n}${p.img?" (image #"+(part.slice(0,i).filter(x=>x.img).length+1)+" attached)":""} ---\n${p.text||"(no text layer — read the attached image)"}`).join("\n");
  return `You are reading a gym TRAINING PROGRAM (a coach's sheet, a printed plan, an e-book or photos). This is part ${k} of ${n}.
Read every exercise exactly as written: the exercise (from its name, or from the photo when there is no name), sets and reps (e.g. "S: 4 R: 15/12/10/8" → sets 4, reps "15/12/10/8"; "4X25" → sets 4 reps "25"; "3X60SE" → sets 3 reps "60 sec"), and techniques (drop set, super set, giant set, pyramid) and notes.
Group exercises into TRAINING DAYS as the program does. Sections that belong to the same day (e.g. "1st day A — chest" and "1st day A — triceps", or "Push day" pages) are ONE day. Keep the program's day order and give each day a stable key ("D1","D2",…) using the program's own numbering, so parts can be merged.
A block that is not its own training day (abs/core circuit, warm-up, finisher) goes to "extras". Warm-up instructions go to "warmup".
Match every exercise to the closest exercise in this LIBRARY (id|main muscle|name). Use the library id in "id". If the exact machine/variation is not in the library, pick the nearest movement for the same muscle and set "close": true. Use null only when nothing is reasonably close (e.g. battle ropes).
LIBRARY:
${library()}
Muscle keys: ${Object.keys(PI.muscles).join(", ")}.
Write "name" exactly as the program names the exercise (or a short description of the photo), "name_ar" in Arabic, titles in Arabic and English, and "tips" (at most 5, only in the last part or when you see clear issues: safety, missing muscles, imbalance, better alternatives) in ${LANGN[S.lang]}.
Person: ${S.p.sex==="m"?"male":"female"}, ${S.p.age} y, ${S.p.w} kg, goal ${PI.goals[S.p.goal].n.en}${S.p.sex==="f"&&S.p.fs==="preg"?", PREGNANT":""}.
Return ONLY JSON:
{"title":"","coach_or_gym":"","start_date":"YYYY-MM-DD or null","length_days":null,
 "warmup":{"ar":"","en":""},
 "days":[{"key":"D1","title_ar":"","title_en":"","cardio_min":0,"exercises":[{"name":"","name_ar":"","id":"library id or null","close":false,"muscle":"","sets":4,"reps":"15/12/10/8","rest_sec":null,"technique":"none|drop|super|giant|pyramid","note_ar":"","note_en":""}]}],
 "extras":[{"title_ar":"","title_en":"","when_ar":"","when_en":"","exercises":[same shape]}],
 "tips":[""]}
PAGES:
${pagesTxt}`;
}

/* ---------- normalising (AI output and preset share one shape) ---------- */
const STOP=new Set(["the","on","with","a","of","and","machine","seated","standing","press","-"]);
function tokens(s){return String(s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w&&!STOP.has(w));}
function fuzzyId(name,muscle){
  const a=new Set(tokens(name)); if(!a.size) return null; let best=null, bs=0;
  for(const id of Object.keys(PI.ex)){ const e=PI.ex[id]; if(muscle&&PI.muscles[muscle]&&e.g!==muscle) continue;
    const b=new Set(tokens(e.n.en+" "+id.replace(/_/g," "))); let inter=0; a.forEach(w=>{if(b.has(w)) inter++;}); const s=inter/Math.max(a.size,1);
    if(s>bs){bs=s; best=id;} }
  return bs>=.5?best:null;
}
function normEx(e){
  if(!e||typeof e!=="object") return null;
  let id=(e.id&&PI.ex[e.id])?e.id:null, close=!!e.close;
  if(!id){ const f=fuzzyId(e.name,e.muscle); if(f){ id=f; close=true; } }
  const tq=String(e.technique||e.tech||"").toLowerCase();
  const tech=/drop/.test(tq)?"drop":/super|giant/.test(tq)?"super":/pyramid/.test(tq)?"pyr":"";
  const note=e.note&&typeof e.note==="object"?e.note:{ar:String(e.note_ar||"").slice(0,160),en:String(e.note_en||"").slice(0,160)};
  return {id, close, name:String(e.name||e.name_ar||"").slice(0,90), name_ar:String(e.name_ar||"").slice(0,90),
    muscle:PI.muscles[e.muscle]?e.muscle:(id?PI.ex[id].g:null),
    sets:clamp(int(e.sets)||3,1,10), reps:String(e.reps==null?"":e.reps).replace(/\s+/g," ").slice(0,24)||"10–12",
    rest:int(e.rest_sec||e.rest)||null, tech, note:(note.ar||note.en)?note:null};
}
function normProgram(raw,src){
  const days=(raw.days||[]).map(d=>({key:String(d.key||""),title:d.title&&typeof d.title==="object"?d.title:{ar:String(d.title_ar||d.title_en||"").slice(0,60),en:String(d.title_en||d.title_ar||"").slice(0,60)},
    cardio:clamp(int(d.cardio_min!=null?d.cardio_min:d.cardio)||0,0,60), ex:(d.exercises||d.ex||[]).map(normEx).filter(Boolean)})).filter(d=>d.ex.length);
  const extras=(raw.extras||[]).map(x=>({title:x.title&&typeof x.title==="object"?x.title:{ar:String(x.title_ar||x.title_en||"").slice(0,60),en:String(x.title_en||x.title_ar||"").slice(0,60)},
    when:x.when&&typeof x.when==="object"?x.when:{ar:String(x.when_ar||"").slice(0,120),en:String(x.when_en||"").slice(0,120)}, ex:(x.exercises||x.ex||[]).map(normEx).filter(Boolean)})).filter(x=>x.ex.length);
  const warm=raw.warm||raw.warmup;
  return {title:String(raw.title||raw.coach_or_gym||src||"").slice(0,80), src:String(src||raw.src||"").slice(0,120),
    start:/^\d{4}-\d{2}-\d{2}$/.test(raw.start||raw.start_date||"")?(raw.start||raw.start_date):null, lengthDays:int(raw.lengthDays||raw.length_days)||null,
    warm:warm&&typeof warm==="object"?warm:(warm?{ar:String(warm),en:String(warm)}:null), days, extras,
    tips:(raw.tips||[]).map(x=>String(x).slice(0,300)).filter(Boolean).slice(0,6), at:new Date().toISOString().slice(0,10)};
}
function mergeParts(parts){
  const out={title:"",coach_or_gym:"",start_date:null,length_days:null,warmup:null,days:[],extras:[],tips:[]}; const byKey={};
  parts.forEach(p=>{ if(!p||typeof p!=="object") return;
    ["title","coach_or_gym","start_date","length_days"].forEach(k=>{ if(!out[k]&&p[k]) out[k]=p[k]; });
    if(!out.warmup&&p.warmup&&(p.warmup.ar||p.warmup.en)) out.warmup=p.warmup;
    (p.days||[]).forEach(d=>{ const k=String(d.key||d.title_en||d.title_ar||out.days.length); if(byKey[k]){ byKey[k].exercises=(byKey[k].exercises||[]).concat(d.exercises||[]); if(!byKey[k].cardio_min&&d.cardio_min) byKey[k].cardio_min=d.cardio_min; } else { byKey[k]=Object.assign({},d,{exercises:(d.exercises||[]).slice()}); out.days.push(byKey[k]); } });
    (p.extras||[]).forEach(x=>{ const ex=out.extras.find(y=>(y.title_en||y.title_ar)===(x.title_en||x.title_ar)); if(ex) ex.exercises=(ex.exercises||[]).concat(x.exercises||[]); else out.extras.push(Object.assign({},x)); });
    (p.tips||[]).forEach(x=>{ if(out.tips.length<6) out.tips.push(x); });
  });
  return out;
}

/* ---------- import flow ---------- */
async function importFiles(files){
  if(busy||!files.length) return; busy=true; ctl=new AbortController(); draw();
  try{
    const sample=await A().use("sample");
    if(!sample){ setStatus(t("file_off"),"warn"); return; }
    let lim=null; try{ lim=await sample.limits(); }catch(e){}
    const maxImg=lim&&lim.images?Math.max(1,Math.min(8,lim.images.maxCount||8)):0;
    let pages=await filesToPages(files);
    if(!maxImg) pages=pages.map(p=>Object.assign({},p,{img:null}));
    pages=pages.filter(p=>p.img||p.text);
    if(!pages.length){ setStatus(t("file_fail"),"warn"); return; }
    const parts=chunk(pages,Math.max(1,maxImg)); const res=[];
    for(let k=0;k<parts.length;k++){
      setStatus(t("file_ai_part",{k:k+1,n:parts.length}));
      const imgs=parts[k].filter(p=>p.img).map(p=>p.img);
      const r=await sample.json(prompt(parts[k],k+1,parts.length),Object.assign({modelTier:"default",signal:ctl.signal},imgs.length?{images:imgs}:{}));
      res.push(r);
    }
    const prog=normProgram(mergeParts(res),files.map(f=>f.name).join(" + "));
    if(!prog.days.length){ setStatus(t("file_fail"),"warn"); return; }
    adopt(prog);
    const n=prog.days.reduce((a,d)=>a+d.ex.length,0)+prog.extras.reduce((a,x)=>a+x.ex.length,0), m=prog.days.concat(prog.extras).reduce((a,d)=>a+d.ex.filter(e=>e.id).length,0);
    setStatus(t("file_done",{d:prog.days.length,n,m}),"good");
  }catch(e){
    const c=e&&e.code;
    setStatus(c==="cancelled"?t("file_cancelled"):c==="rate_limited"?t("ai_busy"):(c==="not_granted"||c==="sampling_disabled"||c==="not_declared")?t("file_off"):t("file_fail"),"warn");
    console.error(e);
  } finally { busy=false; ctl=null; A().save(); A().render(); }
}
function adopt(prog){
  const S=A().S; S.gym.imp=prog; S.gym.mode="file";
  const n=Math.min(7,Math.max(1,prog.days.length)); if(S.gym.wd.length!==n) S.gym.wd=A().WD_PATTERN[n].slice();
}
function usePreset(){ if(!PI.presetProg) return; adopt(normProgram(JSON.parse(JSON.stringify(PI.presetProg)),PI.presetProg.src)); setStatus(t("file_preset_done"),"good"); A().save(); A().render(); }
function removeProg(){ const S=A().S; S.gym.imp=null; if(S.gym.mode==="file") S.gym.mode="general"; setStatus(t("file_deleted"),"info"); A().save(); A().render(); }

/* ---------- UI (the import card at the top of "program from file") ---------- */
function progDay(){ const P=A().S.gym.imp; if(!P||!P.start) return null; const d=Math.floor((Date.now()-new Date(P.start+"T00:00:00").getTime())/864e5)+1; return d>=1?d:null; }
function card(modes){
  const S=A().S, P=S.gym.imp; const nEx=P?P.days.concat(P.extras).reduce((a,d)=>a+d.ex.length,0):0, nM=P?P.days.concat(P.extras).reduce((a,d)=>a+d.ex.filter(e=>e.id).length,0):0;
  const dn=progDay();
  return `<section class="card progimp">${modes}
    <h3><img src="img/food/clipboard.webp" alt="">${esc(t("file_title"))}</h3>
    <p class="sub" style="margin-top:-4px">${esc(t("file_desc"))}</p>
    <div class="pdrop"><input type="file" id="progFile" accept=".pdf,image/png,image/jpeg,image/webp" multiple ${busy?"disabled":""}>
      <label for="progFile" class="btn pri"><img src="img/food/sparkles.webp" alt="">${esc(t(P?"file_reimport":"file_pick"))}</label>
      <span class="sub">${esc(t("file_drop_hint"))}</span>
      ${busy?`<button class="btn" data-progstop>${esc(t("coach_stop"))}</button>`:""}</div>
    ${PI.presetProg&&!busy?`<div class="row" style="margin-top:10px"><button class="btn sun" data-progpreset><img src="img/food/person_lifting_weights.webp" alt="">${esc(t("file_preset"))}</button></div>`:""}
    <p id="progStatus" class="pstat ${status?status.lvl:""}" ${status?"":"hidden"} role="status">${status?esc(status.msg):""}</p>
    <p class="note" style="margin:6px 0 0">${esc(t("file_cost_note"))}</p>
    ${P?`<div class="psum">
      <div><span>${esc(t("file_prog"))}</span><b>${esc(P.title||P.src)}</b></div>
      <div><span>${esc(t("train_days"))}</span><b class="num">${P.days.length}</b></div>
      <div><span>${esc(t("file_exn"))}</span><b class="num">${nEx}</b></div>
      <div><span>${esc(t("file_matched"))}</span><b class="num">${nM} / ${nEx}</b></div>
      ${P.lengthDays?`<div><span>${esc(t("file_duration"))}</span><b class="num">${dn&&dn<=P.lengthDays?esc(t("file_dayof",{d:dn,n:P.lengthDays})):P.lengthDays+" "+esc(t("days_word"))}</b></div>`:""}
    </div>
    ${P.warm?`<div class="cardio" style="background:var(--sun-soft);margin-top:10px"><img src="img/food/fire.webp" alt=""><span>${esc(loc(P.warm))}</span></div>`:""}
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sm ghost" data-progdel>${esc(t("file_delete"))}</button></div>`:""}
  </section>`;
}
function draw(){ if(A().S.tab==="gym") A().render(); }
document.addEventListener("change",ev=>{ if(ev.target&&ev.target.id==="progFile"){ const fs=[...ev.target.files]; ev.target.value=""; importFiles(fs); } });
document.addEventListener("click",ev=>{ const b=ev.target.closest("button"); if(!b) return; const d=b.dataset;
  if(d.progpreset!=null) usePreset(); else if(d.progdel!=null) removeProg(); else if(d.progstop!=null){ if(ctl) ctl.abort(); } });
PI.prog={card,loc,normProgram,mergeParts,normEx,fuzzyId,progDay,prompt,chunk,adopt};
})();
