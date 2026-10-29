/* Mostafa Gym — smart gym assistant (chat on the viewer's own Claude via the `sample` capability).
   Reads the person's profile, goal, weekly meal plan and training program, and can change them through
   page tools; every change can be undone from the chat. */
(function(){
"use strict";
const A=()=>PI.app;
const $=(s,r=document)=>r.querySelector(s);
const t=(k,v)=>A().t(k,v), esc=s=>A().esc(s);
const LANG={ar:"Egyptian Arabic (friendly, clear)",en:"English",hi:"Hindi",bn:"Bengali"};
let busy=false, ctl=null, sampleFn=undefined, toolsOk=false;
const undo={}; // msg index -> snapshot before its changes (in-memory for this view)

async function getSample(){
  if(sampleFn!==undefined) return sampleFn;
  sampleFn=await A().use("sample");
  if(sampleFn){ try{const lim=await sampleFn.limits(); toolsOk=!!(lim&&lim.tools);}catch(e){toolsOk=false;} }
  return sampleFn;
}
const hist=()=>{const S=A().S; if(!Array.isArray(S.coach)) S.coach=[]; return S.coach;};
const snap=()=>{const S=A().S; return JSON.stringify({p:S.p,gym:S.gym,week:S.week,day:S.day,prices:S.prices});};
function restore(js){const S=A().S; const o=JSON.parse(js); S.p=o.p; S.gym=o.gym; S.week=o.week; S.day=o.day; S.prices=o.prices; S.meals=S.week[S.day];}

/* ---------- context the assistant reads every turn ---------- */
function context(){
  const H=A().helpers, S=A().S, T=A().targets(), p=S.p;
  const day=i=>H.wdName(i);
  const weekLines=S.week.map((ms,i)=>{const x=H.sumItems(ms.flatMap(m=>m.items)); return `${i}=${day(i)}${S.gym.wd.includes(i)?" (training)":""}: ${Math.round(x.k)} kcal, P${Math.round(x.p)} C${Math.round(x.c)} F${Math.round(x.f)}, cost ${x.cost.toFixed(1)} ${t("cur_"+S.country)}; mains: ${H.dayHeadline(ms)}`;}).join("\n");
  const prog=H.program(); const wdn=PI.T.wd.en;
  const progLines=prog.map(d=>`${wdn[d.wd]}: ${d.title} — ${d.ex.map(e=>PI.ex[e.id].n.en+" "+(e.sets?e.sets+"x"+e.reps:"")).join("; ")}${d.cardio?"; cardio "+d.cardio.min+" min":""}`).join("\n");
  const micro=H.weekMicroAvg(); const R=H.rdaSet(); const low=PI.nutKeys.filter((k,i)=>k!=="na"&&micro[i]/R[k]<.7).map(k=>PI.nutName[k].en+" "+Math.round(micro[PI.nutKeys.indexOf(k)]/R[k]*100)+"%");
  const zs=(p.zones||[]).filter(z=>PI.zones[z]).map(z=>PI.zones[z].n.en+" ("+PI.zones[z].dir+")");
  const E=H.etaInfo();
  const fs=p.sex==="f"?(p.fs==="preg"?"pregnant (trimester "+p.tri+")":p.fs==="post"?("postpartum"+(p.bf?", breastfeeding":"")):"not pregnant"):"";
  const body=S.body&&S.body.cur?S.body.cur:null;
  return `PERSON: ${p.sex==="m"?"male":"female"}${fs?" ("+fs+")":""}, age ${p.age}, ${p.w} kg, ${p.h} cm.${body?` Latest body-composition report: body fat ${body.pbf||"?"}%, skeletal muscle ${body.smm||"?"} kg, visceral fat level ${body.vfl||"?"}.`:""}
GOAL: ${PI.goals[p.goal].n.en}; target weight ${+p.tw>0?p.tw+" kg":"none"}; body areas: ${zs.join(", ")||"none"}; expected time: ${E.kind==="ok"?E.weeks+" weeks":E.kind}.
DAILY TARGET: ${T.kcal} kcal, protein ${T.P} g, carbs ${T.C} g, fat ${T.F} g (BMR ${Math.round(T.bmr)}, TDEE ${Math.round(T.tdee)}).
EATING STYLE: ${p.style==="tayyibat"?"Tayyibat allowed-foods list (no chicken, eggs, legumes, leafy greens, cucumber, liquid milk, whey, bread/pasta/bulgur, peanut butter)":"balanced"}; price tier ${p.tierUsed||p.tier||"std"}${p.tier==="budget"?", monthly budget "+(p.budgets||{})[S.country]:""}; country ${S.country==="sa"?"Saudi Arabia (SAR)":"Egypt (EGP)"}; ${S.meals.length} meals/day.
WEEK PLAN (day index = name):
${weekLines}
Selected day in the app: ${S.day} (${day(S.day)}). Today is ${day((new Date().getDay()+1)%7)} (index ${(new Date().getDay()+1)%7}).
Nutrients below 70% of daily need (weekly average): ${low.join(", ")||"none"}.
TRAINING: ${S.gym.mode} program, goal ${S.gym.gg}, level ${S.gym.level}, equipment ${S.gym.eq}, ${S.gym.wd.length} days, priority muscles: ${(S.gym.focus||[]).join(", ")||"none"}, extra cardio ${S.gym.cardioMin||0} min.
${progLines}`;
}
function rules(){
  const S=A().S;
  return `You are "Mostafa Gym coach", the smart assistant inside the person's nutrition and training dashboard. Reply ONLY in ${LANG[S.lang]}.
Scope: sport, gym training and technique, general health and fitness, diets and nutrition, supplements and making up vitamin/mineral shortfalls. Politely steer anything else back to these topics.
Always tie the answer to THIS person's data below: their goal, targets, meal plan, nutrient gaps and program. Name specific days, meals, foods and exercises from their plan when relevant.
${toolsOk?`You have tools. Read details with the get_ tools when needed. Change the plan ONLY when the person asks for a change or clearly agrees to one; then make it with the tools and say exactly what you changed (it can be undone with one button). Never invent food or exercise ids: use list_foods / the plan.`:`You cannot change the plan in this view; tell the person what to change and where in the dashboard.`}
Safety: you are not a doctor. Give general, evidence-based guidance; for vitamins/minerals prefer food sources from their plan first, mention usual adult intake ranges and suggest a blood test before high-dose supplements (vitamin D, iron, B12). Never advise stopping or changing prescribed medication. For chest pain, fainting, sharp joint pain, blood in stool, sudden weight loss, pregnancy complications or similar warning signs, tell them to see a doctor promptly. In pregnancy/postpartum be conservative.
Style: short and practical (usually under 160 words), plain text, no markdown headings or tables; use "•" for short lists. Numbers in grams/kcal.

${context()}`;
}

/* ---------- tools (page functions the assistant can call) ---------- */
function tools(changes){
  const H=A().helpers, S=A().S;
  const dayOk=d=>{d=Number(d); if(!(d>=0&&d<=6)) throw new Error("day must be 0-6"); return d;};
  const change=(desc)=>{changes.push(desc); status(t("coach_changing"));};
  const foodOk=id=>{id=String(id); if(!PI.foods.find(f=>f.id===id)) throw new Error("unknown food id "+id); if(H.banned(id)) throw new Error(id+" is not allowed in the Tayyibat style"); return id;};
  return [
    {name:"get_day_meals",description:"Meals of one day of the week plan: meal index, meal name, items (food id, grams, method, kcal, protein) and cost. Day 0=Saturday … 6=Friday.",
     inputSchema:{type:"object",properties:{day:{type:"integer",minimum:0,maximum:6}},required:["day"]},
     execute:({day})=>{const d=dayOk(day); status(t("coach_reading")); return S.week[d].map((m,mi)=>({meal_index:mi,meal:m.k,time:m.t,items:m.items.map(it=>{const x=H.calcItem(it); return {food:it.f,name:PI.foods.find(f=>f.id===it.f).n.en,grams:it.g,method:it.m,kcal:Math.round(x.k),protein:Math.round(x.p),cost:+x.cost.toFixed(2)};})}));}},
    {name:"get_micros",description:"Vitamins/minerals as % of the person's daily need, for one day (0-6) or the weekly average when day is omitted.",
     inputSchema:{type:"object",properties:{day:{type:"integer",minimum:0,maximum:6}}},
     execute:({day})=>{status(t("coach_reading")); const v=day==null?H.weekMicroAvg():H.dayMicro(dayOk(day)); const R=H.rdaSet(); return Object.fromEntries(PI.nutKeys.map((k,i)=>[PI.nutName[k].en,Math.round(v[i]/R[k]*100)+"%"]));}},
    {name:"list_foods",description:"Foods the plan may use (respecting the eating style): id, name, category, kcal/protein/carbs/fat per 100 g, price level 1-3. Optional category: protein, carb, veg, fruit, fat, extra.",
     inputSchema:{type:"object",properties:{category:{type:"string"}}},
     execute:({category})=>PI.foods.filter(f=>!H.banned(f.id)&&(!category||f.cat===category)).map(f=>({id:f.id,name:f.n.en,cat:f.cat,k:f.k,p:f.p,c:f.c,f:f.f,price:H.priceTier(f)}))},
    {name:"swap_food",description:"Replace one food in one meal with another, keeping the same protein/carbs/calories (amount is recalculated). Use get_day_meals first to find meal_index.",
     inputSchema:{type:"object",properties:{day:{type:"integer"},meal_index:{type:"integer"},from_food:{type:"string"},to_food:{type:"string"}},required:["day","meal_index","from_food","to_food"]},
     execute:({day,meal_index,from_food,to_food})=>{const d=dayOk(day); const m=S.week[d][Number(meal_index)]; if(!m) throw new Error("no such meal"); const to=foodOk(to_food);
       const i=m.items.findIndex(it=>it.f===String(from_food)); if(i<0) throw new Error(from_food+" is not in that meal"); if(String(from_food)===to) throw new Error("from_food and to_food are the same");
       const g=H.eqGrams(PI.foods.find(f=>f.id===m.items[i].f),m.items[i].g,PI.foods.find(f=>f.id===to)); const old=m.items[i].f;
       m.items[i]={f:to,g,m:H.defMethod(to)}; change(`${H.wdName(d)}: ${A().nm(PI.foods.find(f=>f.id===old))} → ${A().nm(PI.foods.find(f=>f.id===to))} (${g} ${t("g")})`); return {ok:true,grams:g};}},
    {name:"set_food_amount",description:"Set the grams of one food in one meal.",
     inputSchema:{type:"object",properties:{day:{type:"integer"},meal_index:{type:"integer"},food:{type:"string"},grams:{type:"number"}},required:["day","meal_index","food","grams"]},
     execute:({day,meal_index,food,grams})=>{const d=dayOk(day); const m=S.week[d][Number(meal_index)]; if(!m) throw new Error("no such meal"); const it=m.items.find(x=>x.f===String(food)); if(!it) throw new Error("food not in meal");
       const g=Math.max(0,Math.min(1000,Math.round(Number(grams)))); it.g=g; change(`${H.wdName(d)}: ${A().nm(PI.foods.find(f=>f.id===it.f))} = ${g} ${t("g")}`); return {ok:true};}},
    {name:"add_food",description:"Add a food (grams) to one meal of one day.",
     inputSchema:{type:"object",properties:{day:{type:"integer"},meal_index:{type:"integer"},food:{type:"string"},grams:{type:"number"}},required:["day","meal_index","food","grams"]},
     execute:({day,meal_index,food,grams})=>{const d=dayOk(day); const m=S.week[d][Number(meal_index)]; if(!m) throw new Error("no such meal"); const id=foodOk(food);
       const g=Math.max(1,Math.min(1000,Math.round(Number(grams)))); m.items.push({f:id,g,m:H.defMethod(id)}); change(`${H.wdName(d)}: + ${A().nm(PI.foods.find(f=>f.id===id))} ${g} ${t("g")}`); return {ok:true};}},
    {name:"regenerate_day",description:"Replace one day of the week with a new, different set of meals in the same tier and targets.",
     inputSchema:{type:"object",properties:{day:{type:"integer"}},required:["day"]},
     execute:({day})=>{const d=dayOk(day); H.redoDay(d); change(t("day_redone",{d:H.wdName(d)})); return {ok:true};}},
    {name:"set_plan_options",description:"Change meal-plan settings and rebuild the whole week: tier (eco|std|prem|budget), style (normal|tayyibat), meals_per_day (2-6), monthly_budget (number, local currency, sets tier=budget).",
     inputSchema:{type:"object",properties:{tier:{type:"string",enum:["eco","std","prem","budget"]},style:{type:"string",enum:["normal","tayyibat"]},meals_per_day:{type:"integer",minimum:2,maximum:6},monthly_budget:{type:"number"}}},
     execute:(o)=>{const parts=[]; if(o.style){S.p.style=o.style==="tayyibat"?"tayyibat":"normal"; parts.push(t(S.p.style==="tayyibat"?"style_tayyibat":"style_normal"));}
       if(o.monthly_budget>0){H.setBudget(Number(o.monthly_budget)); S.p.tier="budget"; parts.push(t("budget_label")+" "+o.monthly_budget);} else if(o.tier){S.p.tier=String(o.tier); parts.push(t("tier_"+o.tier));}
       const n=o.meals_per_day?Math.max(2,Math.min(6,Number(o.meals_per_day))):S.meals.length; if(o.meals_per_day) parts.push(t("meals_count")+" "+n);
       A().buildPlan(n); change(t("week_title")+": "+parts.join(" · ")); return {ok:true,message:H.lastBudgetMsg()};}},
    {name:"set_goal",description:"Set target weight (kg, 0 = none) and/or body areas, then link the goal to nutrition and training (recomputes calories, rebuilds the week and training focus). Areas: "+Object.keys(PI.zones).join(", ")+".",
     inputSchema:{type:"object",properties:{target_weight:{type:"number"},areas:{type:"array",items:{type:"string"}}}},
     execute:(o)=>{if(o.target_weight!=null) S.p.tw=Math.max(0,Number(o.target_weight)); if(Array.isArray(o.areas)) S.p.zones=o.areas.map(String).filter(z=>PI.zones[z]);
       H.applyGoalQuiet(); const T=A().targets(); change(t("goal_detail")+": "+PI.goals[S.p.goal].n[S.lang]+" · "+T.kcal+" "+t("kcal")); const E=H.etaInfo(); return {ok:true,goal:S.p.goal,kcal:T.kcal,weeks:E.weeks||null};}},
    {name:"set_training",description:"Change the training program: days_per_week (2-6), level (beg|int|adv), equipment (gym|db|bw), training_goal (hypertrophy|strength|fatburn|endurance|tone), focus_muscles (ids: "+Object.keys(PI.muscles).filter(m=>m!=="cardio").join(", ")+"), cardio_minutes.",
     inputSchema:{type:"object",properties:{days_per_week:{type:"integer"},level:{type:"string"},equipment:{type:"string"},training_goal:{type:"string"},focus_muscles:{type:"array",items:{type:"string"}},cardio_minutes:{type:"integer"}}},
     execute:(o)=>{const g=S.gym, parts=[];
       if(o.days_per_week){const n=Math.max(2,Math.min(6,Number(o.days_per_week))); g.wd=A().WD_PATTERN[n].slice(); parts.push(t("days_n",{n}));}
       if(["beg","int","adv"].includes(o.level)){g.level=o.level; parts.push(t("lvl_"+o.level));}
       if(["gym","db","bw"].includes(o.equipment)){g.eq=o.equipment; parts.push(t("eq_"+o.equipment));}
       if(["hypertrophy","strength","fatburn","endurance","tone"].includes(o.training_goal)){g.gg=o.training_goal; parts.push(t("gg_"+o.training_goal));}
       if(Array.isArray(o.focus_muscles)){g.focus=o.focus_muscles.map(String).filter(m=>PI.muscles[m]&&m!=="cardio").slice(0,4); parts.push(t("p_focus")+": "+g.focus.map(m=>A().nm(PI.muscles[m])).join("، "));}
       if(o.cardio_minutes!=null){g.cardioMin=Math.max(0,Math.min(60,Number(o.cardio_minutes))); parts.push("cardio "+g.cardioMin);}
       if(g.mode==="library") g.mode="general";
       change(t("tab_gym")+": "+parts.join(" · ")); return {ok:true};}},
    {name:"get_exercise",description:"Technique steps and target muscle for an exercise id from the program.",
     inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"]},
     execute:({id})=>{const e=PI.ex[String(id)]; if(!e) throw new Error("unknown exercise"); return {name:e.n.en,muscle:e.g,steps:(PI.exEn&&PI.exEn[id])||e.s||null};}}
  ];
}

/* ---------- UI ---------- */
let statusEl=null;
function status(txt){ if(statusEl) statusEl.textContent=txt; }
function bubble(m,i){
  const ch=m.changes&&m.changes.length?`<div class="cchg"><b>${esc(t("coach_changed"))}</b><ul>${m.changes.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>${undo[i]?`<button class="btn sm ghost" data-coachundo="${i}">↶ ${esc(t("coach_undo"))}</button>`:m.undone?`<span class="sub">${esc(t("coach_undone"))}</span>`:""}</div>`:"";
  return `<div class="cmsg ${m.role}"><div class="cb">${esc(m.content)}</div>${ch}</div>`;
}
function suggestions(){return ["coach_q1","coach_q2","coach_q3","coach_q4","coach_q5","coach_q6"].map(k=>`<button class="chip sm" data-coachq="${esc(t(k))}">${esc(t(k))}</button>`).join("");}
function render(){
  const h=hist();
  return `<section class="card coach"><div class="coachhead"><img class="coachhero" src="img/coach.svg" alt="${esc(t("coach_name"))}"><div><h3>${esc(t("coach_title"))}</h3>
    <p class="hi">${esc(t("coach_hello"))}</p><p class="sub" style="margin:0">${esc(t("coach_desc"))}</p></div></div>
    <div class="chatlog" id="chatlog">${h.length?h.map(bubble).join(""):`<div class="cempty">${esc(t("coach_empty"))}</div>`}</div>
    <div class="chips cq">${suggestions()}</div>
    <div class="chatbar"><textarea class="in" id="coachIn" rows="2" placeholder="${esc(t("coach_ph"))}"></textarea>
      <button class="btn pri" data-coachsend>${esc(t("coach_send"))}</button><button class="btn" data-coachstop hidden>${esc(t("coach_stop"))}</button></div>
    <div class="row" style="justify-content:space-between;margin-top:8px"><span class="sub" id="coachNote"></span>${h.length?`<button class="btn sm ghost" data-coachclear>${esc(t("coach_clear"))}</button>`:""}</div>
    <p class="note" style="margin-top:8px">${esc(t("coach_disclaimer"))}</p></section>`;
}
function scrollLog(){const l=$("#chatlog"); if(l) l.scrollTop=l.scrollHeight;}
async function send(text){
  text=String(text||"").trim(); if(!text||busy) return;
  const sample=await getSample();
  const log=$("#chatlog"); const note=$("#coachNote");
  if(!sample){ if(note) note.textContent=t("coach_off"); return; }
  const h=hist(); h.push({role:"user",content:text});
  if(log){ const e=log.querySelector(".cempty"); if(e) e.remove(); log.insertAdjacentHTML("beforeend",bubble(h[h.length-1],h.length-1)+`<div class="cmsg assistant pending"><div class="cb">${esc(t("ai_working"))}</div><div class="cstat"></div></div>`); scrollLog(); }
  const pend=log&&log.querySelector(".pending"); const out=pend&&pend.querySelector(".cb"); statusEl=pend&&pend.querySelector(".cstat");
  const inp=$("#coachIn"); if(inp) inp.value="";
  busy=true; ctl=new AbortController(); $("[data-coachsend]").disabled=true; $("[data-coachstop]").hidden=false;
  const before=snap(); const changes=[];
  const turns=[{role:"user",content:rules()}].concat(h.slice(-12).map(m=>({role:m.role,content:m.content})));
  let reply="";
  try{
    const r=await sample(turns,Object.assign({cache:false,signal:ctl.signal,modelTier:"default",onText:({text})=>{reply=text; if(out) out.textContent=text; scrollLog();}},toolsOk?{tools:tools(changes)}:{}));
    reply=r.text;
  }catch(e){
    reply=(e&&e.text)||""; const c=e&&e.code;
    if(c==="not_granted"||c==="sampling_disabled"||c==="not_declared"||c==="capability_disabled"){ if(note) note.textContent=t("coach_off"); }
    else if(c==="rate_limited"){ if(note) note.textContent=t("ai_busy"); }
    else if(c!=="cancelled"){ if(note) note.textContent=t("coach_err"); }
    if(c==="refused") reply="";
  }
  busy=false; statusEl=null;
  const idx=h.length; const msg={role:"assistant",content:reply||t("coach_noreply")};
  if(changes.length){ msg.changes=changes; undo[idx]=before; }
  h.push(msg); while(h.length>40) h.shift();
  A().save();
  if(changes.length){ A().render(); A().toast(t("coach_applied",{n:changes.length}),6000); }
  else { const box=$(".coach"); if(box) box.outerHTML=render(); }
  scrollLog();
}
document.addEventListener("click",ev=>{
  const b=ev.target.closest("button"); if(!b) return; const d=b.dataset;
  if(d.coachsend!=null){ send(($("#coachIn")||{}).value); }
  else if(d.coachq){ send(d.coachq); }
  else if(d.coachstop!=null){ if(ctl) ctl.abort(); }
  else if(d.coachclear!=null){ if(busy) return; A().S.coach=[]; for(const k in undo) delete undo[k]; A().save(); const box=$(".coach"); if(box) box.outerHTML=render(); }
  else if(d.coachundo!=null){ const i=+d.coachundo; if(!undo[i]||busy) return; restore(undo[i]); delete undo[i]; const m=hist()[i]; if(m) m.undone=true; A().save(); A().render(); A().toast(t("coach_undone")); }
});
document.addEventListener("keydown",ev=>{ if(ev.target&&ev.target.id==="coachIn"&&ev.key==="Enter"&&!ev.shiftKey){ ev.preventDefault(); send(ev.target.value); } });
PI.coach={render,afterRender:()=>{scrollLog(); getSample().then(s=>{const n=$("#coachNote"); if(!s&&n) n.textContent=t("coach_off");});}};
})();
