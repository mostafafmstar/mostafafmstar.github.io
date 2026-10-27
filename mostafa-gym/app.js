/* Plate & Iron — app logic */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const F=Object.fromEntries(PI.foods.map(f=>[f.id,f]));
const EXIDS=Object.keys(PI.ex);
const KEY="plateiron.v1";
const MEALKEYS={2:["lunch","dinner"],3:["breakfast","lunch","dinner"],4:["breakfast","lunch","pre","post"],5:["breakfast","snack","lunch","pre","post"],6:["breakfast","snack","lunch","pre","post","dinner"]};
const MEALTIME={breakfast:"09:00",snack:"11:30",lunch:"14:00",pre:"18:00",post:"22:30",dinner:"20:30"};
const WD_PATTERN={1:[1],2:[1,4],3:[1,3,5],4:[1,2,4,5],5:[0,1,2,4,5],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
PI.cookOil={sa:14.5,eg:95};

/* ---------------- state ---------------- */
function exampleMeals(){return [
  {k:"breakfast",t:"09:00",items:[{f:"egg",g:150,m:"boil"},{f:"egg_white",g:66,m:"pan"},{f:"ww_bread",g:70,m:"raw"},{f:"cucumber",g:100,m:"raw"},{f:"tomato",g:100,m:"raw"},{f:"olive_oil",g:10,m:"raw"}]},
  {k:"lunch",t:"14:00",items:[{f:"beef_lean",g:180,m:"grill"},{f:"basmati",g:200,m:"boil"},{f:"broccoli",g:150,m:"steam"},{f:"salad",g:100,m:"raw"}]},
  {k:"pre",t:"18:00",items:[{f:"hamour",g:150,m:"oven"},{f:"basmati",g:220,m:"boil"},{f:"banana",g:118,m:"raw"}]},
  {k:"post",t:"22:30",items:[{f:"beef_lean",g:180,m:"grill"},{f:"basmati",g:200,m:"boil"},{f:"salad",g:150,m:"raw"}]}
];}
function defaults(){return {
  lang:"ar",theme:"",country:"sa",tab:"profile",example:true,
  p:{sex:"m",age:37,w:86,h:185,act:3,link:true,goal:"recomp",mode:"auto",kcal:2300,fs:"normal",tri:2,bf:true},
  meals:exampleMeals(), week:null, day:0, prices:{}, tr:{},
  gym:{mode:"general",wd:[1,2,4,5],level:"int",eq:"gym",sty:"mix",gg:"hypertrophy",muscles:["quads","glutes","hamstrings","abs"],load:3}
};}
let S=defaults();
try{const raw=localStorage.getItem(KEY); if(raw){const o=JSON.parse(raw); S=Object.assign(defaults(),o); S.p=Object.assign(defaults().p,o.p||{}); S.gym=Object.assign(defaults().gym,o.gym||{});}}catch(e){}
if(location.hash){const h=location.hash.slice(1); if(["profile","body","food","gym","export"].includes(h)) S.tab=h;}
let saveT=null;
function save(){if(typeof syncWeek==="function") syncWeek(); clearTimeout(saveT); saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}},250);}

/* ---------------- helpers ---------------- */
function t(k,vars){const e=PI.T[k]; let s=e?(e[S.lang]??e.en):k; if(vars) for(const v in vars) s=s.split("{"+v+"}").join(vars[v]); return s;}
const nm=o=>o?(o.n?(o.n[S.lang]||o.n.en):(o[S.lang]||o.en)):"";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r0=n=>Math.round(n), r1=n=>Math.round(n*10)/10;
const fmt=n=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(n));
const money=(n,c)=>{c=c||S.country; const v=n>=100?Math.round(n):Math.round(n*10)/10; return new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(v)+" "+t("cur_"+c);};
const fimg=id=>"img/food/"+id+".webp";
const FLAG={sa:'<svg class="flag" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#006C35"/><rect x="7" y="6.5" width="16" height="2.2" rx="1.1" fill="#fff"/><rect x="8" y="11.5" width="14" height="1.6" rx=".8" fill="#fff"/></svg>',
  eg:'<svg class="flag" viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#111"/><rect width="30" height="13.3" fill="#fff"/><rect width="30" height="6.7" rx="2" fill="#CE1126"/><rect y="4" width="30" height="2.7" fill="#CE1126"/><circle cx="15" cy="10" r="2.2" fill="#C09300"/></svg>'};
const femState=()=>S.p.sex==="f"?(S.p.fs||"normal"):"normal";
const isPreg=()=>femState()==="preg", isPost=()=>femState()==="post";
const use=n=>(window.claude&&window.claude.use)?window.claude.use(n).catch(()=>null):Promise.resolve(null);
function toast(msg,ms){const el=$("#toast"); el.textContent=msg; el.hidden=false; clearTimeout(el._t); el._t=setTimeout(()=>el.hidden=true,ms||4200);}

/* ---------------- nutrition engine ---------------- */
function priceOf(f,c){c=c||S.country; const o=S.prices[f.id]; return (o&&o[c]!=null&&o[c]!=="")?+o[c]:f[c];}
function methodsFor(f){
  if(f.id==="oats") return ["boil","raw"];
  if(f.grp==="eggs") return ["boil","pan","airfry","fry"];
  if(f.st==="ready"||f.st==="dry") return ["raw"];
  return PI.catMethods[f.cat];
}
function defMethod(f){const m=PI.defaultMethod[f.id]||PI.defaultMethod[f.cat]; const ok=methodsFor(f); return ok.includes(m)?m:ok[0];}
function calcItem(it,c){
  const f=F[it.f]; const z={k:0,p:0,c:0,f:0,cost:0,add:0}; if(!f) return z;
  const g=Math.max(0,+it.g||0); const m=PI.methods[it.m]||PI.methods.raw;
  const add=(f.st==="cooked"||f.st==="raw")?m.fat*g/100:0;
  return {k:f.k*g/100+add*9,p:f.p*g/100,c:f.c*g/100,f:f.f*g/100+add,add,
    cost:g*priceOf(f,c)/1000/f.y+add*PI.cookOil[c||S.country]/1000};
}
function sumItems(items,c){return items.reduce((a,it)=>{const x=calcItem(it,c); a.k+=x.k;a.p+=x.p;a.c+=x.c;a.f+=x.f;a.cost+=x.cost; return a;},{k:0,p:0,c:0,f:0,cost:0});}
function dayTotals(c){return sumItems(S.meals.flatMap(m=>m.items),c);}
function gymDays(){return S.gym.wd.length;}
function actFromDays(d){return [1.2,1.3,1.375,1.46,1.55,1.64,1.725,1.8][Math.min(d,7)];}
function targets(){
  const p=S.p; const useR=!!(p.useR&&+p.bmrR>800);
  const bmr=useR?+p.bmrR:10*p.w+6.25*p.h-5*p.age+(p.sex==="m"?5:-161);
  const af=p.link?actFromDays(gymDays()):[1.2,1.375,1.55,1.725,1.9][(+p.act||3)-1];
  const tdee=bmr*af; const G=PI.goals[p.goal]||PI.goals.recomp;
  let kf=G.kf,pk=G.pk,fp=G.fp,add=0,min=1000; const fs=femState();
  if(fs==="preg"){kf=1; add=[0,340,452][(+p.tri||1)-1]; pk=(+p.tri>1)?1.2:1.1; fp=.30; min=1800;}
  else if(fs==="post"){ if(p.bf){kf=Math.max(kf,.9); add=330; pk=Math.max(pk,1.3); min=1800;} else {kf=Math.max(kf,.85); min=1500;} }
  const kcal=(p.mode==="manual"&&fs!=="preg")?Math.max(min,+p.kcal||2000):Math.max(min,Math.round((tdee*kf+add)/10)*10);
  const P=(useR&&+p.ffm>20&&fs==="normal")?Math.round(Math.max(pk*p.w*.85,(pk+.3)*p.ffm)):Math.round(pk*p.w);
  const Fg=Math.max(Math.round(.7*p.w),Math.round(kcal*fp/9));
  const C=Math.max(50,Math.round((kcal-4*P-9*Fg)/4));
  return {bmr,tdee,af,kcal,P,C,F:Fg,add,fs,useR};
}

/* automatic day plan — price tiers, budget and per-food alternatives */
const TIERS={
  eco:{p:["chicken_thigh","tilapia","chicken_breast","lentils","tuna","chicken_thigh","tilapia"],
       c:["egy_rice","potato","pasta","bulgur","sweet_potato","egy_rice","basmati"],
       v:["cucumber","zucchini","carrot","eggplant","tomato","green_beans","lettuce"],
       fr:["banana","orange","dates","watermelon","mango","banana","orange"],
       bk:[[["egg",150,"boil"],["foul",150,"raw"],["pita",90,"raw"],["tomato",100,"raw"]],
           [["oats",0,"boil"],["milk",240,"raw"],["banana",118,"raw"],["egg",100,"boil"]],
           [["egg",100,"pan"],["cottage",0,"raw"],["ww_bread",0,"raw"],["cucumber",100,"raw"]],
           [["foul",200,"raw"],["egg",100,"boil"],["pita",0,"raw"],["tomato",100,"raw"],["tahini",15,"raw"]],
           [["egg",150,"pan"],["potato",0,"oven"],["tomato",100,"raw"],["cucumber",100,"raw"]],
           [["oats",0,"boil"],["milk",240,"raw"],["dates",24,"raw"],["peanut_butter",16,"raw"]],
           [["egg",100,"boil"],["lentils",200,"boil"],["pita",0,"raw"],["onion",50,"raw"]]],
       snack:[[["milk",240,"raw"],["banana",0,"raw"]],[["cottage",0,"raw"],["orange",0,"raw"]],[["milk",240,"raw"],["dates",0,"raw"]],[["egg",100,"boil"],["banana",0,"raw"]]],
       fat:[["tahini","peanut_butter"],["peanut_butter","tahini"],["olive_oil","tahini"]]},
  std:{p:["chicken_breast","beef_lean","hamour","tilapia","chicken_thigh","salmon","tuna"],
       c:["basmati","sweet_potato","pasta","brown_rice","potato","bulgur","basmati"],
       v:["broccoli","salad","green_beans","zucchini","spinach","carrot","pepper"],
       fr:["banana","apple","strawberry","orange","mango","banana","grapes"],
       bk:[[["egg",100,"boil"],["oats",0,"boil"],["egg_white",0,"pan"],["strawberry",100,"raw"]],
           [["greek_yogurt",170,"raw"],["oats",0,"boil"],["banana",118,"raw"],["egg",100,"boil"]],
           [["egg",100,"pan"],["egg_white",0,"pan"],["ww_bread",0,"raw"],["tomato",100,"raw"],["cucumber",100,"raw"]],
           [["cottage",0,"raw"],["ww_bread",0,"raw"],["apple",180,"raw"],["egg",50,"boil"]],
           [["egg",100,"boil"],["foul",150,"raw"],["ww_bread",0,"raw"],["tomato",100,"raw"]],
           [["oats",0,"boil"],["whey",30,"raw"],["banana",118,"raw"]],
           [["egg",100,"pan"],["egg_white",0,"pan"],["sweet_potato",0,"oven"],["pepper",80,"raw"]]],
       snack:[[["greek_yogurt",0,"raw"],["banana",0,"raw"]],[["cottage",0,"raw"],["apple",0,"raw"]],[["milk",240,"raw"],["dates",0,"raw"]],[["whey",30,"raw"],["banana",0,"raw"]]],
       fat:[["olive_oil","almonds"],["almonds","peanut_butter"],["avocado","olive_oil"]]},
  prem:{p:["salmon","beef_lean","shrimp","hamour","chicken_breast","lamb","salmon"],
       c:["quinoa","sweet_potato","brown_rice","basmati","quinoa","potato","brown_rice"],
       v:["broccoli","spinach","pepper","mushroom","salad","green_beans","zucchini"],
       fr:["blueberries","kiwi","strawberry","mango","grapes","kiwi","blueberries"],
       bk:[[["egg",100,"boil"],["oats",0,"boil"],["greek_yogurt",170,"raw"],["blueberries",100,"raw"]],
           [["egg",100,"pan"],["egg_white",0,"pan"],["ww_bread",0,"raw"],["avocado",70,"raw"],["spinach",60,"raw"]],
           [["greek_yogurt",170,"raw"],["whey",30,"raw"],["oats",0,"boil"],["strawberry",100,"raw"]],
           [["salmon",80,"oven"],["egg",100,"boil"],["ww_bread",0,"raw"],["cucumber",100,"raw"]],
           [["oats",0,"boil"],["whey",30,"raw"],["kiwi",100,"raw"],["almonds",20,"raw"]],
           [["egg",150,"pan"],["sweet_potato",0,"oven"],["mushroom",80,"pan"],["pepper",80,"raw"]],
           [["greek_yogurt",170,"raw"],["oats",0,"boil"],["mango",120,"raw"],["blueberries",60,"raw"]]],
       snack:[[["whey",30,"raw"],["kiwi",0,"raw"],["almonds",20,"raw"]],[["greek_yogurt",0,"raw"],["blueberries",0,"raw"]],[["cottage",0,"raw"],["strawberry",0,"raw"]],[["whey",30,"raw"],["mango",0,"raw"]]],
       fat:[["avocado","almonds"],["olive_oil","almonds"],["almonds","avocado"]]}
};
/* «نظام الطيبات» (Dr. Diaa El-Awady) as reported: no white chicken, eggs, legumes, leafy greens, cucumber,
   liquid milk, flour/wheat; ghee allowed; fewer meals; fruit not straight after a meal. Only the food rules are applied. */
const TAYB_BAN=new Set(["chicken_breast","chicken_thigh","egg","egg_white","lentils","chickpeas","foul","spinach","lettuce","salad","cucumber","milk","whey","ww_bread","pita","pasta","bulgur","peanut_butter"]);
const isTayb=()=>S.p.style==="tayyibat";
const banned=id=>isTayb()&&TAYB_BAN.has(id);
const TIERS_T={
  eco:{p:["tilapia","beef_lean","tuna","tilapia","beef_lean","tuna","hamour"],
       c:["egy_rice","potato","sweet_potato","egy_rice","corn","potato","basmati"],
       v:["zucchini","carrot","eggplant","tomato","green_beans","onion","pepper"],
       fr:["banana","orange","dates","watermelon","mango","grapes","banana"],
       bk:[[["cottage",0,"raw"],["potato",0,"oven"],["tomato",100,"raw"]],[["greek_yogurt",170,"raw"],["dates",24,"raw"],["banana",118,"raw"]],[["tuna",0,"raw"],["potato",0,"oven"],["tomato",100,"raw"],["pepper",60,"raw"]],[["cottage",0,"raw"],["sweet_potato",0,"oven"],["dates",24,"raw"]]],
       snack:[[["greek_yogurt",0,"raw"],["dates",0,"raw"]],[["cottage",0,"raw"],["banana",0,"raw"]],[["greek_yogurt",0,"raw"],["mango",0,"raw"]]],
       fat:[["butter","tahini"],["tahini","butter"],["olives","butter"]]},
  std:{p:["beef_lean","hamour","salmon","tilapia","lamb","tuna","shrimp"],
       c:["basmati","sweet_potato","potato","brown_rice","basmati","corn","quinoa"],
       v:["broccoli","zucchini","green_beans","carrot","pepper","mushroom","eggplant"],
       fr:["banana","apple","strawberry","orange","mango","grapes","kiwi"],
       bk:[[["greek_yogurt",170,"raw"],["oats",0,"boil"],["honey",14,"raw"],["strawberry",100,"raw"]],[["cottage",0,"raw"],["sweet_potato",0,"oven"],["tomato",100,"raw"]],[["tuna",0,"raw"],["potato",0,"oven"],["pepper",80,"raw"]],[["greek_yogurt",170,"raw"],["dates",24,"raw"],["banana",118,"raw"],["almonds",20,"raw"]]],
       snack:[[["greek_yogurt",0,"raw"],["banana",0,"raw"]],[["cottage",0,"raw"],["apple",0,"raw"]],[["greek_yogurt",0,"raw"],["dates",0,"raw"]]],
       fat:[["butter","almonds"],["almonds","avocado"],["avocado","butter"]]},
  prem:{p:["salmon","lamb","shrimp","hamour","beef_lean","salmon","lamb"],
       c:["quinoa","sweet_potato","brown_rice","basmati","potato","quinoa","sweet_potato"],
       v:["broccoli","mushroom","pepper","zucchini","green_beans","carrot","eggplant"],
       fr:["blueberries","kiwi","strawberry","mango","grapes","kiwi","blueberries"],
       bk:[[["greek_yogurt",170,"raw"],["oats",0,"boil"],["blueberries",100,"raw"],["honey",14,"raw"]],[["salmon",0,"oven"],["sweet_potato",0,"oven"],["avocado",70,"raw"]],[["cottage",0,"raw"],["potato",0,"oven"],["mushroom",80,"pan"]],[["greek_yogurt",170,"raw"],["mango",120,"raw"],["almonds",20,"raw"]]],
       snack:[[["greek_yogurt",0,"raw"],["blueberries",0,"raw"]],[["cottage",0,"raw"],["kiwi",0,"raw"]],[["greek_yogurt",0,"raw"],["strawberry",0,"raw"]]],
       fat:[["avocado","almonds"],["butter","avocado"],["almonds","butter"]]}
};
const tierPools=tk=>(isTayb()?TIERS_T:TIERS)[tk]||(isTayb()?TIERS_T:TIERS).std;
const planN=()=>isTayb()?(S.meals.length||2):Math.max(4,S.meals.length);
const TIER_ORDER=["prem","std","eco"];
/* cost per unit of what the food is for */
function costBasis(f){return f.cat==="protein"?"p":(f.cat==="carb"||f.cat==="fat")?"k":"g";}
function unitCost(f,c){const per100=priceOf(f,c||S.country)/10/f.y; const b=costBasis(f); if(b==="p") return f.p>0?per100/f.p*10:per100; if(b==="k") return f.k>0?per100/f.k*100:per100; return per100;}
const tierCache={};
function priceTier(f){
  const c=S.country; const key=c+JSON.stringify(S.prices[f.id]||{});
  const peers=PI.foods.filter(x=>x.cat===f.cat).map(x=>unitCost(x,c)).sort((a,b)=>a-b);
  const v=unitCost(f,c); const i=peers.findIndex(x=>x>=v); const q=i/Math.max(1,peers.length-1);
  return q<.34?1:q<.67?2:3;
}
const rnd10=g=>Math.max(0,Math.round(g/10)*10);
function solveGrams(food,need,key,min,max){const per=food[key]/100; if(per<=0) return min; return Math.min(max,Math.max(min,rnd10(need/per)));}
function sortByCost(ids,c){return ids.slice().sort((a,b)=>unitCost(F[a],c)-unitCost(F[b],c));}
/* healthy methods to rotate through the week (no frying) */
const ROT={protein:["grill","oven","airfry","grill","steam","oven","pan"],carb:["boil","oven","boil","steam","oven","boil","airfry"],veg:["steam","raw","grill","oven","steam","raw","stir"]};
function rotMethod(f,i){const ok=methodsFor(f); const pref=PI.defaultMethod[f.id]; if(pref&&(f.st==="ready"||f.st==="dry"||["egg","egg_white","lentils","chickpeas","oats","ww_bread","pita","salad","cucumber","tomato","lettuce"].includes(f.id))) return ok.includes(pref)?pref:ok[0];
  const r=ROT[f.cat]; if(!r) return defMethod(f); for(let k=0;k<r.length;k++){const m=r[(i+k)%r.length]; if(ok.includes(m)) return m;} return defMethod(f);}
const fruitG=f=>f.u?(f.u<20?f.u*3:f.u):150;
function makePlan(n,tier,day,shift){
  n=n||4; day=(+day||0)%7; shift=+shift||0; const keys=MEALKEYS[n]||MEALKEYS[4]; const T=targets(); const TP=tierPools(tier);
  const pPool=TP.p;
  const share={breakfast:{p:1,c:.9},snack:{p:.55,c:.6},lunch:{p:1.2,c:1},pre:{p:1,c:1.3},post:{p:1.2,c:1.25},dinner:{p:1,c:.7}};
  const sp=keys.reduce((a,k)=>a+share[k].p,0), sc=keys.reduce((a,k)=>a+share[k].c,0);
  const mainsN=keys.filter(k=>k!=="breakfast"&&k!=="snack").length||1;
  const ix={p:day*mainsN+shift, c:day*mainsN+2+shift*2, v:day*mainsN+4+shift*3}; let fi=day+shift; const bi=day+shift*3; const used=new Set();
  // next food from a rotating pool, skipping anything already served today
  const pick=(pool,key)=>{for(let k=0;k<pool.length;k++){const id=pool[(ix[key]+k)%pool.length]; if(!used.has(id)){ix[key]+=k+1; used.add(id); return F[id];}} return F[pool[ix[key]++%pool.length]];};
  const meals=keys.map(k=>{
    const Pt=T.P*share[k].p/sp, Ct=T.C*share[k].c/sc; const items=[];
    if(k==="breakfast"||k==="snack"){
      const tpl=k==="breakfast"?TP.bk[bi%TP.bk.length]:TP.snack[(day+shift)%TP.snack.length];
      tpl.forEach(([id,g,m])=>{items.push({f:id,g,m}); used.add(id);});
      // proteins first (fill the protein left), then carbs (fill carbs left), then fruit
      items.filter(it=>!it.g&&F[it.f].cat==="protein").forEach(it=>{const f=F[it.f]; const pL=Pt-sumItems(items.filter(x=>x!==it&&x.g)).p;
        if(it.f==="egg_white"){it.g=pL>4?Math.min(300,Math.round(pL/10.9*100/33)*33):0; return;}
        it.g=f.u&&f.u>=100?Math.max(f.u,Math.min(f.u*2,Math.round(Math.max(pL,8)/(f.p/100)/f.u)*f.u)):solveGrams(f,Math.max(pL,8),"p",k==="snack"?150:100,k==="snack"?340:250);});
      items.filter(it=>!it.g&&F[it.f].cat==="carb").forEach(it=>{const f=F[it.f]; const other=sumItems(items.filter(x=>x!==it&&x.g)); let g=solveGrams(f,Ct-other.c,"c",f.u||30,it.f==="oats"?140:(f.st==="ready"?180:300));
        if(f.u) g=Math.max(f.u,Math.round(g/f.u)*f.u); it.g=g;});
      items.filter(it=>!it.g&&F[it.f].cat==="fruit").forEach(it=>{const f=F[it.f]; const c0=sumItems(items.filter(x=>x!==it&&x.g)).c; let g=solveGrams(f,Math.max(Ct-c0,10),"c",f.u&&f.u<20?f.u*2:80,f.u&&f.u<20?f.u*5:250); if(f.u&&f.u<20) g=Math.round(g/f.u)*f.u; it.g=g;});
      for(let i=items.length-1;i>=0;i--) if(!items[i].g) items.splice(i,1);
    } else {
      const pf=pick(pPool,"p"), cf=pick(TP.c,"c"), vf=pick(TP.v,"v");
      const vg=150; const cg=solveGrams(cf,Ct-vf.c*vg/100-(pf.cat==="protein"&&pf.c>5?pf.c*1.5:0),"c",60,450);
      const pg=solveGrams(pf,Pt-cf.p*cg/100-vf.p*vg/100,"p",80,pf.p<12?330:320);
      const mi=day+ix.p;
      items.push({f:pf.id,g:pg,m:rotMethod(pf,mi)},{f:cf.id,g:cg,m:rotMethod(cf,mi+1)},{f:vf.id,g:vg,m:rotMethod(vf,mi+2)});
      if(k==="pre"&&!isTayb()){const fr=F[TP.fr[fi++%TP.fr.length]]; items.push({f:fr.id,g:fruitG(fr),m:"raw"});}
    }
    return {k,t:MEALTIME[k],items};
  });
  // protein top-up if short (economy plans lean on eggs/legumes)
  let tot=sumItems(meals.flatMap(m=>m.items)); let pGap=T.P-tot.p;
  if(pGap>12){ const mains=meals.flatMap(m=>m.items).filter(it=>F[it.f].cat==="protein"&&F[it.f].p>=18); mains.forEach(it=>{ it.g=Math.min(360,rnd10(it.g+pGap/mains.length/(F[it.f].p/100))); }); }
  // fat top-up
  tot=sumItems(meals.flatMap(m=>m.items)); let fGap=T.F-tot.f;
  const main=meals.filter(m=>!["breakfast","snack"].includes(m.k));
  const fp=TP.fat[(day+shift)%TP.fat.length]; const f1=F[fp[0]], f2=F[fp[1]];
  const cap=f=>f.id==="avocado"?100:f.id==="olive_oil"?15:f.id==="olives"?60:20;
  if(fGap>6&&main.length){const tgt=main[day%main.length]; const g=Math.min(cap(f1),rnd10Small(fGap*.6/(f1.f/100))); tgt.items.push({f:f1.id,g,m:"raw"}); fGap-=g*f1.f/100;}
  if(fGap>6){const tgt=meals.find(m=>m.k==="snack")||meals[0]; tgt.items.push({f:f2.id,g:Math.min(f2.id==="avocado"?100:40,rnd10Small(fGap/(f2.f/100))),m:"raw"});}
  fitCalories(meals,T);
  return meals;
}
function makeWeek(n,tier){return [0,1,2,3,4,5,6].map(d=>makePlan(n,tier,d));}
const weekAvgCost=(w,c)=>w.reduce((a,ms)=>a+sumItems(ms.flatMap(m=>m.items),c).cost,0)/w.length;
function fitCalories(meals,T){
  T=T||targets(); const all=()=>meals.flatMap(m=>m.items); let tot=sumItems(all()); let diff=T.kcal-tot.k;
  const carbItems=all().filter(it=>F[it.f].cat==="carb"&&it.f!=="oats"&&!F[it.f].u);
  const cmax=meals.length<=2?700:500;
  for(let pass=0;pass<5&&Math.abs(diff)>40&&carbItems.length;pass++){
    const each=diff/carbItems.length;
    carbItems.forEach(it=>{const kpg=F[it.f].k/100; it.g=Math.min(cmax,Math.max(40,rnd10(it.g+each/kpg)));});
    tot=sumItems(all()); diff=T.kcal-tot.k;
  }
  // still over (legume-heavy budget days): trim legumes, then added fats
  if(diff<-60){ const leg=all().filter(it=>F[it.f].grp==="legume"); if(leg.length){ const each=diff/leg.length; leg.forEach(it=>{it.g=Math.max(120,rnd10(it.g+each/(F[it.f].k/100)));}); tot=sumItems(all()); diff=T.kcal-tot.k; } }
  if(diff<-60){ const fats=all().filter(it=>F[it.f].cat==="fat"); if(fats.length){ const each=diff/fats.length; fats.forEach(it=>{it.g=Math.max(5,rnd10Small(it.g+each/(F[it.f].k/100)));}); } }
}
function rnd10Small(g){return Math.max(5,Math.round(g/5)*5);}
const planCost=meals=>sumItems(meals.flatMap(m=>m.items)).cost;
/* swap equivalence: same protein for proteins, same carbs for carbs, same kcal for fats/fruit/extras, same grams for veg */
function eqBasis(f){return f.cat==="protein"?"p":f.cat==="carb"?"c":f.cat==="veg"?"g":"k";}
function eqGrams(from,g,to){
  const b=eqBasis(from); let ng=g;
  if(b==="p"&&to.p>0) ng=g*from.p/to.p; else if(b==="c"&&to.c>0) ng=g*from.c/to.c; else if(b==="k"&&to.k>0) ng=g*from.k/to.k;
  ng=Math.min(700,Math.max(to.u?to.u:10,ng)); if(to.u) return Math.max(to.u,Math.round(ng/to.u*2)/2*to.u); return ng<60?Math.round(ng/5)*5:rnd10(ng);
}
function foodAlts(it){
  const f=F[it.f]; const peers=PI.foods.filter(x=>x.cat===f.cat&&x.id!==f.id&&!banned(x.id));
  const rows=peers.map(x=>{const g=eqGrams(f,it.g,x); const nit={f:x.id,g,m:defMethod(x)}; return {x,g,c:calcItem(nit)};});
  rows.sort((a,b)=>a.c.cost-b.c.cost);
  return rows;
}
function optimizeForBudget(meals,limit){
  // greedy: each step takes the biggest saving, but an item may only become a food not already served that day — keeps the day varied
  let swaps=0;
  for(let guard=0;guard<40&&planCost(meals)>limit;guard++){
    const inDay=new Set(meals.flatMap(m=>m.items.map(it=>it.f))); let best=null;
    meals.forEach(m=>m.items.forEach((it,ii)=>{ const cur=calcItem(it); const alt=foodAlts(it).find(a=>!inDay.has(a.x.id)&&a.x.cat===F[it.f].cat);
      if(alt&&alt.c.cost<cur.cost-0.01){ const save=cur.cost-alt.c.cost; if(!best||save>best.save) best={m,ii,alt,save}; } }));
    if(!best) break;
    best.m.items[best.ii]={f:best.alt.x.id,g:best.alt.g,m:defMethod(best.alt.x)}; swaps++;
  }
  return swaps;
}
let lastBudgetMsg="";
const getBudget=()=>+((S.p.budgets||{})[S.country])||0;
const setBudget=v=>{S.p.budgets=Object.assign({},S.p.budgets,{[S.country]:v});};
function setWeek(w,tk){S.week=w; S.day=Math.min(6,Math.max(0,S.day|0)); S.meals=w[S.day]; S.p.tierUsed=tk; S.example=false;}
function buildPlan(n){
  n=n||S.meals.length||4; const tier=S.p.tier||"std"; lastBudgetMsg="";
  if(tier==="budget"&&getBudget()>0){
    const lim=getBudget()/30;
    for(const tk of TIER_ORDER){ const w=makeWeek(n,tk); if(weekAvgCost(w)<=lim){ setWeek(w,tk); lastBudgetMsg=t("budget_chosen",{tier:t("tier_"+tk)}); return; } }
    const w=makeWeek(n,"eco"); let sw=0; w.forEach(ms=>{sw+=optimizeForBudget(ms,lim); fitCalories(ms); sw+=optimizeForBudget(ms,lim); fitCalories(ms);}); setWeek(w,"eco");
    lastBudgetMsg=t("budget_optimized",{n:sw}); return;
  }
  setWeek(makeWeek(n,tier==="budget"?"std":tier),tier==="budget"?"std":tier);
}
function weekOk(){return Array.isArray(S.week)&&S.week.length===7&&S.week.every(Array.isArray);}
function syncWeek(){ if(weekOk()){ S.day=Math.min(6,Math.max(0,S.day|0)); S.week[S.day]=S.meals; } }
function ensureWeek(){
  if(weekOk()){ syncWeek(); return; }
  const n=S.meals.length||4; const tk=(S.p.tierUsed&&TIERS[S.p.tierUsed])?S.p.tierUsed:"std";
  S.week=makeWeek(n,tk); S.day=0; S.week[0]=S.meals;
}
/* micronutrients */
function microOf(it){const v=PI.micro[it.f]; if(!v) return null; const g=+it.g||0; return v.map(x=>x*g/100);}
function microDay(){const tot=PI.nutKeys.map(()=>0); S.meals.forEach(m=>m.items.forEach(it=>{const v=microOf(it); if(v) v.forEach((x,i)=>tot[i]+=x);})); return tot;}
function rdaSet(){return S.p.sex==="f"?(isPreg()?PI.rda.preg:(isPost()&&S.p.bf)?PI.rda.bf:PI.rda.f):PI.rda.m;}
function whoKey(){return S.p.sex==="f"?(isPreg()?"who_preg":(isPost()&&S.p.bf)?"who_bf":"who_f"):"who_m";}
function richIn(id,g){const v=PI.micro[id]; if(!v) return []; const R=rdaSet(); return PI.nutKeys.map((k,i)=>[k,v[i]*(g||100)/100/R[k]]).filter(([k,p])=>k!=="na"&&p>=.1).sort((a,b)=>b[1]-a[1]).slice(0,3);}
const fmtN=(v,k)=>{const u=PI.nutUnit[k]; return (v>=100?Math.round(v):v>=10?Math.round(v*10)/10:Math.round(v*100)/100)+" "+u;};
function mealTips(meal){
  const tips=[]; const seen=new Set(); const fs=meal.items.map(it=>F[it.f]).filter(Boolean);
  const order=["poultry","meat","fish","shrimp","eggs","legume","dairy","supp","rice","pasta","potato","oats","bread"];
  order.forEach(g=>{if(tips.length<2&&fs.some(f=>f.grp===g)&&!seen.has(g)){seen.add(g); tips.push({x:PI.prep[g]});}});
  if(fs.some(f=>f.cat==="veg")&&tips.length<3) tips.push({x:PI.prep.veg});
  const ms=meal.items.map(it=>it.m);
  for(const m of ["fry","stir","pan","airfry","grill","oven"]) if(ms.includes(m)){tips.push({x:PI.methodTip[m],warn:m==="fry"}); break;}
  const out=tips.slice(0,3).map(o=>({warn:o.warn,s:o.x[S.lang]||o.x.en}));
  const st=femState(); const ids=meal.items.map(it=>it.f);
  if(st==="preg"||(st==="post"&&S.p.bf)){
    const w=[];
    if(st==="preg"&&meal.items.some(it=>{const f=F[it.f]; return f&&["poultry","meat","fish","shrimp","eggs"].includes(f.grp);})) w.push(t("w_cook"));
    if(ids.includes("hamour")) w.push(t("w_hamour"));
    if(ids.includes("tuna")) w.push(t("w_tuna"));
    if(ids.includes("whey")) w.push(t("w_whey"));
    return w.map(x=>({warn:true,s:x})).concat(out);
  }
  return out;
}

/* ---------------- gym engine ---------------- */
const SCHEME={
  hypertrophy:{c:[4,"8–12",90],i:[3,"10–15",60],rpe:8},
  strength:{c:[5,"4–6",180],i:[3,"8–10",90],rpe:8.5},
  fatburn:{c:[3,"12–15",60],i:[3,"15–20",45],rpe:7.5,cardio:25},
  endurance:{c:[3,"15–20",45],i:[2,"20–25",30],rpe:7,cardio:20},
  tone:{c:[3,"10–15",60],i:[3,"12–15",45],rpe:8,cardio:15}
};
const TEMPL={
  fa:[["quads","c"],["chest","c"],["back","c"],["upperback","c"],["glutes","c"],["shoulders","i"],["abs","i"]],
  fb:[["hamstrings","c",1],["back","c",1],["chest","c",1],["quads","c",1],["adductors","i"],["triceps","i"],["biceps","i"]],
  fc:[["glutes","c",1],["chest","c",2],["upperback","c",1],["quads","c",2],["abductors","i"],["lowerback","i"],["calves","i"]],
  ua:[["chest","c"],["back","c"],["shoulders","c"],["upperback","c"],["biceps","i"],["triceps","i"]],
  la:[["quads","c"],["hamstrings","c"],["glutes","c"],["adductors","i"],["calves","i"],["abs","i"]],
  ub:[["shoulders","c",1],["chest","c",1],["back","c",1],["upperback","i"],["triceps","i",1],["biceps","i",1]],
  lb:[["hamstrings","c",1],["glutes","c",1],["quads","c",1],["abductors","i"],["lowerback","i"],["abs","i",1]],
  push:[["chest","c"],["shoulders","c"],["chest","c",1],["shoulders","i"],["triceps","i"],["triceps","i",1]],
  pull:[["back","c"],["upperback","c"],["back","c",1],["upperback","i"],["biceps","i"],["lowerback","i"]],
  legs:[["quads","c"],["hamstrings","c"],["glutes","c"],["adductors","i"],["abductors","i"],["calves","i"]]
};
const CLASSIC={1:["fa"],2:["ua","la"],3:["push","pull","legs"],4:["chest_tri","back_bi","sh_abs","legs2"],5:["chest","back","shoulders","legs2","arms"],6:["chest","back","shoulders","legs2","arms","glutes_core"],7:["chest","back","shoulders","legs2","arms","glutes_core","fc"]};
Object.assign(TEMPL,{
  chest:[["chest","c"],["chest","c",1],["chest","c",2],["chest","i"],["chest","i",1],["chest","c",3]],
  back:[["back","c"],["upperback","c"],["back","c",1],["upperback","c",1],["lowerback","i"],["upperback","i"]],
  shoulders:[["shoulders","c"],["shoulders","i"],["shoulders","c",1],["upperback","i",1],["shoulders","i",1],["traps","i"]],
  legs2:[["quads","c"],["quads","i"],["quads","c",1],["hamstrings","i"],["hamstrings","c"],["adductors","i"],["abductors","i"],["calves","i"]],
  arms:[["biceps","i"],["triceps","c"],["biceps","i",1],["triceps","i"],["biceps","i",2],["triceps","i",1],["biceps","i",3],["triceps","i",2]],
  chest_tri:[["chest","c"],["chest","c",1],["chest","i"],["chest","c",2],["triceps","c"],["triceps","i"]],
  back_bi:[["back","c"],["upperback","c"],["back","c",1],["lowerback","i"],["biceps","i"],["biceps","i",1]],
  sh_abs:[["shoulders","c"],["shoulders","i"],["shoulders","c",1],["upperback","i"],["traps","i"],["shoulders","i",1]],
  glutes_core:[["glutes","c"],["hamstrings","c"],["glutes","c",1],["glutes","i"],["abductors","i"],["lowerback","i"]]
});
const TNAME={chest:"dn_chest",back:"dn_back",shoulders:"dn_shoulders",legs2:"dn_legs2",arms:"dn_arms",chest_tri:"dn_chest_tri",back_bi:"dn_back_bi",sh_abs:"dn_sh_abs",glutes_core:"dn_glutes_core",fa:"dn_full_a",fb:"dn_full_b",fc:"dn_full_c",ua:"dn_upper",la:"dn_lower",ub:"dn_upper",lb:"dn_lower",push:"dn_push",pull:"dn_pull",legs:"dn_legs"};
const SPLIT={1:["fa"],2:["fa","fb"],3:["fa","fb","fc"],4:["ua","la","ub","lb"],5:["push","pull","legs","ua","lb"],6:["push","pull","legs","push","pull","legs"],7:["push","pull","legs","push","pull","legs","fc"]};
const BIG=["quads","back","upperback","chest","hamstrings","glutes","shoulders","lowerback","adductors","abductors","triceps","biceps","traps","calves","abs"];
const PREG_OUT=new Set(["Barbell_Bench_Press_-_Medium_Grip","Dumbbell_Bench_Press","Dumbbell_Flyes","EZ-Bar_Skullcrusher","Crunches","Dead_Bug","Hanging_Leg_Raise","Ab_Roller","Russian_Twist","Cable_Crunch","Ab_Crunch_Machine","Cable_Reverse_Crunch","Plank","Lying_Leg_Curls","Hyperextensions_Back_Extensions","Barbell_Deadlift","Romanian_Deadlift","Barbell_Squat","Barbell_Hip_Thrust","Butt_Lift_Bridge","Glute_Ham_Raise","Rope_Jumping","Jogging_Treadmill","Standing_Military_Press","Bent_Over_Barbell_Row","Leg_Press","Narrow_Stance_Leg_Press","Calf_Press_On_The_Leg_Press_Machine","Pullups","Dips_-_Chest_Version","Hack_Squat","Smith_Machine_Stiff-Legged_Deadlift","Stiff-Legged_Dumbbell_Deadlift","Rowing_Stationary","Rack_Pulls","Stiff_Leg_Barbell_Good_Morning","Sumo_Deadlift","Superman","Weighted_Ball_Hyperextension","Reverse_Hyperextension","Barbell_Glute_Bridge","Single_Leg_Glute_Bridge","Lying_T-Bar_Row","Dumbbell_Incline_Row","T-Bar_Row_with_Handle","Bent_Over_Two-Dumbbell_Row","Smith_Machine_Bent_Over_Row","Hip_Thrust_Machine","Frog_Pump","One-Arm_Kettlebell_Swings","Barbell_Walking_Lunge","Hip_Abduction_Hips_Off","Decline_Barbell_Bench_Press","Decline_Smith_Press","Decline_Dumbbell_Bench_Press","Leverage_Decline_Chest_Press","Close-Grip_Barbell_Bench_Press","Lying_Dumbbell_Tricep_Extension","Decline_Crunch","Oblique_Crunches_-_On_The_Floor","Knee_Hip_Raise_On_Parallel_Bars","Side_Bridge"]);
const POST_OUT=new Set(["Crunches","Hanging_Leg_Raise","Ab_Roller","Russian_Twist","Cable_Crunch","Ab_Crunch_Machine","Cable_Reverse_Crunch","Plank","Rope_Jumping","Jogging_Treadmill","Barbell_Deadlift","Glute_Ham_Raise","Rack_Pulls","Sumo_Deadlift","Decline_Crunch","Oblique_Crunches_-_On_The_Floor","Knee_Hip_Raise_On_Parallel_Bars"]);
const isMiss=id=>(S.gym.miss||[]).includes(id);
function finalId(id,dayUsed){let cur=id; for(let i=0;i<4;i++){const s=(S.gym.swap||{})[cur]; if(s&&PI.ex[s]&&!isMiss(s)&&!unsafe(s)&&!dayUsed.has(s)) cur=s; else break;} return cur;}
function alts(id){
  const e=PI.ex[id]; const pool=EXIDS.filter(x=>x!==id&&PI.ex[x].g===e.g&&!isMiss(x)&&!unsafe(x));
  const same=pool.filter(x=>PI.ex[x].r===e.r), other=pool.filter(x=>PI.ex[x].r!==e.r);
  const ordered=same.concat(other); const out=[];
  const cat=x=>PI.ex[x].at==="bw"?"bw":PI.ex[x].sty;
  ["m","f","bw"].forEach(c=>{const f=ordered.find(x=>cat(x)===c&&!out.includes(x)); if(f) out.push(f);});
  for(const x of ordered){if(out.length>=3) break; if(!out.includes(x)) out.push(x);}
  return out.slice(0,3);
}
function unsafe(id){return isPreg()?PREG_OUT.has(id):isPost()?POST_OUT.has(id):false;}
function avail(id,eq){const a=PI.ex[id].at; return eq==="gym"?true:eq==="db"?(a==="db"||a==="bw"):a==="bw";}
const PREF={
  chest:["Barbell_Incline_Bench_Press_-_Medium_Grip","Barbell_Bench_Press_-_Medium_Grip","Leverage_Decline_Chest_Press","Incline_Dumbbell_Press","Leverage_Chest_Press","Smith_Machine_Incline_Bench_Press","Decline_Barbell_Bench_Press","Machine_Bench_Press","Leverage_Incline_Chest_Press","Dumbbell_Bench_Press","Hammer_Grip_Incline_DB_Bench_Press","Decline_Dumbbell_Bench_Press","Decline_Smith_Press","Cable_Chest_Press","Butterfly","Cable_Crossover","Incline_Dumbbell_Flyes","Dumbbell_Flyes","Low_Cable_Crossover","Incline_Cable_Flye"],
  back:["Wide-Grip_Lat_Pulldown","Leverage_Iso_Row","Close-Grip_Front_Lat_Pulldown","Pullups","One-Arm_Dumbbell_Row","V-Bar_Pulldown","Chin-Up","Underhand_Cable_Pulldowns","Straight-Arm_Pulldown"],
  upperback:["Seated_Cable_Rows","Lying_T-Bar_Row","Bent_Over_Barbell_Row","Leverage_High_Row","T-Bar_Row_with_Handle","Seated_One-arm_Cable_Pulley_Rows","Dumbbell_Incline_Row","Reverse_Machine_Flyes","Face_Pull","Cable_Rear_Delt_Fly","Reverse_Flyes"],
  shoulders:["Dumbbell_Shoulder_Press","Smith_Machine_Overhead_Shoulder_Press","Leverage_Shoulder_Press","Seated_Barbell_Military_Press","Arnold_Dumbbell_Press","Machine_Shoulder_Military_Press","Side_Lateral_Raise","Front_Dumbbell_Raise","Cable_Seated_Lateral_Raise","Front_Cable_Raise","Seated_Side_Lateral_Raise"],
  biceps:["Barbell_Curl","Seated_Dumbbell_Curl","Machine_Preacher_Curls","Standing_Biceps_Cable_Curl","Hammer_Curls","EZ-Bar_Curl","Concentration_Curls","Incline_Dumbbell_Curl","One_Arm_Dumbbell_Preacher_Curl","Preacher_Curl","High_Cable_Curls"],
  triceps:["Close-Grip_Barbell_Bench_Press","Dip_Machine","Triceps_Pushdown_-_Rope_Attachment","Lying_Dumbbell_Tricep_Extension","Cable_Rope_Overhead_Triceps_Extension","EZ-Bar_Skullcrusher","Triceps_Pushdown","Tricep_Dumbbell_Kickback","Triceps_Pushdown_-_V-Bar_Attachment","Machine_Triceps_Extension"],
  quads:["Barbell_Squat","Hack_Squat","Leg_Press","Leg_Extensions","Smith_Machine_Squat","Split_Squat_with_Dumbbells","Goblet_Squat"],
  glutes:["Barbell_Hip_Thrust","Hip_Thrust_Machine","Hip_Abduction_Lean_Forward","Glute_Kickback_Machine","One-Legged_Cable_Kickback","Hip_Abduction_Hips_Off","Pull_Through","Dumbbell_Rear_Lunge","Barbell_Glute_Bridge","Hip_Abduction_Upright","Cable_Hip_Abduction_Standing","Kettlebell_One-Legged_Deadlift","Dumbbell_Step_Ups","Frog_Pump","Fire_Hydrant"],
  abs:["Cable_Crunch","Knee_Hip_Raise_On_Parallel_Bars","Dumbbell_Side_Bend","Hanging_Leg_Raise","Ab_Crunch_Machine","Russian_Twist","Plank","Side_Bridge"]
};
function pickEx(g,r,k,eq,used){
  const rank=id=>{const a=PI.ex[id].at; return eq==="gym"?(a==="gym"?0:a==="db"?1:2):eq==="db"?(a==="db"?0:1):0;};
  const pr=PREF[g]||[]; const pi=id=>{const x=pr.indexOf(id); return x<0?90:x;};
  let list=EXIDS.filter(id=>PI.ex[id].g===g&&avail(id,eq)&&!unsafe(id)&&!isMiss(id)).map((id,i)=>[id,rank(id)*10000+pi(id)*100+i]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
  if(!list.length) return null;
  if(eq==="gym"&&S.gym.sty&&S.gym.sty!=="mix"&&g!=="cardio"){const st=list.filter(id=>PI.ex[id].sty===S.gym.sty); if(st.length) list=st;}
  let pref=list.filter(id=>PI.ex[id].r===r); if(!pref.length) pref=list;
  const rest=list.filter(id=>!pref.includes(id)); const ordered=pref.concat(rest);
  let i=k%ordered.length; for(let n=0;n<ordered.length;n++){const id=ordered[(i+n)%ordered.length]; if(!used.has(id)) return id;}
  return ordered[i];
}
function dose(id,gg,level,load){
  const sc=SCHEME[gg]||SCHEME.hypertrophy; const role=PI.ex[id].r==="c"?"c":"i";
  let [sets,reps,rest]=sc[role]; let rpe=sc.rpe;
  if(level==="beg"){sets=Math.max(2,sets-1); rpe-=.5;} if(level==="adv"&&role==="c") sets+=1;
  load=load||3;
  if(isPreg()){load=Math.min(load,2); sets=Math.min(sets,3); if(role==="c") reps="10–15"; rest=Math.max(rest,75);} else if(isPost()) load=Math.min(load,3);
  if(load===1){sets=Math.max(2,sets-1); rpe-=1.5; rest=Math.round(rest*1.2);}
  if(load===2){rpe-=.75;}
  if(load===4){if(role==="c") sets+=1; rpe+=.5;}
  if(load===5){sets+=1; rpe+=1;}
  if(PI.ex[id].g==="abs"&&id==="Plank") reps="30–60 "+t("sec");
  const cap=isPreg()?6.5:isPost()?7.5:9.5;
  return {sets,reps,rest,rpe:Math.min(cap,Math.max(5,r1(rpe)))};
}
function cardioFor(eq){return (isPreg()||isPost())?(eq==="gym"?"Bicycling_Stationary":"Walking_Treadmill"):eq==="gym"?"Walking_Treadmill":"Rope_Jumping";}
const classicOn=()=>S.gym.split==="classic";
function pyramid(d,id){
  if(!classicOn()||isPreg()||!["hypertrophy","strength"].includes(S.gym.gg)) return d;
  const c=PI.ex[id].r==="c"; const beg=S.gym.level==="beg";
  return Object.assign({},d,{sets:beg?3:4,reps:c?(beg?"12·10·8":"12·10·8·6"):(beg?"15·12·10":"15·12·10·8"),rest:c?90:60});
}
function addFocus(ex,dayUsed,used,key,rep){
  const focus=S.gym.focus||[]; if(!focus.length) return;
  const slots=TEMPL[key]||[]; const has=m=>slots.some(s=>s[0]===m);
  const lowerDay=slots.some(s=>["quads","hamstrings","glutes"].includes(s[0])), upperDay=slots.some(s=>["chest","back","shoulders","biceps","triceps"].includes(s[0]));
  let added=0;
  focus.forEach(m=>{
    if(added>=3) return;
    const leg=["quads","hamstrings","glutes","adductors","abductors","calves"].includes(m);
    if(!(has(m)||(leg&&lowerDay&&!upperDay)||(!leg&&upperDay&&!lowerDay)||key[0]==="f")) return;
    const id0=pickEx(m,"i",rep+2,S.gym.eq,new Set([...dayUsed])); if(!id0) return; const id=finalId(id0,dayUsed); if(dayUsed.has(id)) return;
    dayUsed.add(id); used.add(id); added++; ex.push(Object.assign({id,focus:1},pyramid(dose(id,S.gym.gg,S.gym.level,3),id)));
  });
}
function buildGeneral(){
  const g=S.gym; const days=g.wd.slice().sort((a,b)=>a-b); const n=days.length; if(!n) return [];
  const classic=classicOn(); const split=(classic?CLASSIC:SPLIT)[n]; const used=new Set(); const seenT={}; const sc=SCHEME[g.gg]||SCHEME.hypertrophy;
  return days.map((wd,i)=>{
    const key=split[i]; const rep=seenT[key]=(seenT[key]||0)+1; let slots=TEMPL[key].slice();
    if(g.level==="beg") slots=slots.slice(0,classic?5:5);
    if(g.level==="adv"&&slots.length<7&&!classic) slots.push(["abs","i",2]);
    const ex=[]; const dayUsed=new Set();
    slots.forEach(([mg,r,k])=>{let id=pickEx(mg,r,(k||0)+(rep-1),g.eq,new Set([...dayUsed,...(rep>1?used:[])])); if(!id) return; id=finalId(id,dayUsed); if(!dayUsed.has(id)){dayUsed.add(id); used.add(id); ex.push(Object.assign({id},pyramid(dose(id,g.gg,g.level,3),id)));}});
    addFocus(ex,dayUsed,used,key,rep);
    if(classic&&!isPreg()&&!isPost()){
      if(key!=="arms"&&ex.length>2&&["hypertrophy","strength"].includes(g.gg)){const main=slots[0][0]; let li=-1; ex.forEach((e,j)=>{if(PI.ex[e.id].g===main&&!e.focus) li=j;}); if(li>=0) ex[li].tech="drop";}
      if(key==="arms") ex.forEach((e,j)=>{if(j%2===0&&j+1<ex.length) e.tech="super";});
      if(!["sh_abs"].includes(key)){let id=pickEx("abs","i",i+rep,g.eq,dayUsed); if(id){id=finalId(id,dayUsed); dayUsed.add(id); ex.push({id,sets:4,reps:"15–30",rest:45,rpe:8,tech:"core"});}}
    }
    const sfx=classic?(split.filter(x=>x===key).length>1?(rep===1?"A":"B"):""):({ua:"A",la:"A",ub:"B",lb:"B"}[key]||(split.filter(x=>x===key).length>1?(rep===1?"A":"B"):""));
    const cmin=Math.max(sc.cardio||0,+g.cardioMin||0);
    return {wd,title:t(TNAME[key])+(sfx?" · "+sfx:""),ex,cardio:cmin?{id:cardioFor(g.eq),min:cmin}:null};
  });
}
function buildCustom(){
  const g=S.gym; const days=g.wd.slice().sort((a,b)=>a-b); const D=days.length; if(!D) return [];
  const wantCardio=g.muscles.includes("cardio"); const M=BIG.filter(m=>g.muscles.includes(m));
  const freq=Math.min(D,M.length<=2&&D>=6?3:2);
  const buckets=Array.from({length:D},()=>[]);
  M.forEach((m,j)=>{for(let k=0;k<freq;k++){let d=(j+Math.round(k*D/freq))%D; let tries=0; while(buckets[d].includes(m)&&tries++<D) d=(d+1)%D; if(!buckets[d].includes(m)) buckets[d].push(m);}});
  const occ={}; const sc=SCHEME[g.gg]||SCHEME.hypertrophy;
  return days.map((wd,i)=>{
    const ms=buckets[i].sort((a,b)=>BIG.indexOf(a)-BIG.indexOf(b)); const ex=[]; const dayUsed=new Set();
    if(!ms.length){const id=pickEx("abs","i",i,g.eq,dayUsed); if(id){dayUsed.add(id); ex.push({id,...dose(id,g.gg,g.level,g.load)});}
      return {wd,title:t("light_day"),ex,cardio:{id:cardioFor(g.eq),min:sc.cardio||20}};}
    const per=Math.max(1,Math.min(3,Math.round(6/ms.length)));
    ms.forEach(m=>{for(let e=0;e<per;e++){const o=occ[m]=(occ[m]||0)+1; let id=pickEx(m,e===0?"c":"i",o-1,g.eq,dayUsed); if(id) id=finalId(id,dayUsed); if(id&&!dayUsed.has(id)){dayUsed.add(id); ex.push({id,...dose(id,g.gg,g.level,g.load)});}}});
    const title=ms.map(m=>nm(PI.muscles[m])).join(" · ");
    const cardio=(wantCardio||sc.cardio)?{id:cardioFor(g.eq),min:sc.cardio||15}:null;
    return {wd,title,ex,cardio};
  });
}
function program(){return S.gym.mode==="custom"?buildCustom():buildGeneral();}
const gymModeKey=()=>S.gym.mode==="custom"?"gym_custom":"gym_general";
function exMuscles(id){
  const e=PI.ex[id]; const prim=[e.g]; const sec=new Set();
  (e.x||EXSEC[id]||[]).forEach(m=>{const g=PI.dbMuscle[m]; if(g&&g!==e.g) sec.add(g);});
  return {prim,sec:[...sec]};
}
/* secondary muscles per exercise from the source database */
const EXSEC={"Barbell_Bench_Press_-_Medium_Grip":["shoulders","triceps"],"Incline_Dumbbell_Press":["shoulders","triceps"],"Pushups":["shoulders","triceps"],"Cable_Crossover":["shoulders"],"Dips_-_Chest_Version":["shoulders","triceps"],"Dumbbell_Bench_Press":["shoulders","triceps"],
 "Wide-Grip_Lat_Pulldown":["biceps","shoulders"],"Pullups":["biceps"],"Bent_Over_Barbell_Row":["biceps","shoulders","lats"],"One-Arm_Dumbbell_Row":["biceps","shoulders","lats"],"Seated_Cable_Rows":["biceps","shoulders","lats"],"Inverted_Row":["lats","biceps"],
 "Standing_Military_Press":["triceps"],"Dumbbell_Shoulder_Press":["triceps"],"Face_Pull":["middle back","traps"],"Seated_Dumbbell_Press":["triceps"],"Barbell_Curl":[],"Bench_Dips":["chest","shoulders"],
 "Russian_Twist":["lower back"],"Ab_Roller":["shoulders"],"Hyperextensions_Back_Extensions":["glutes","hamstrings"],"Barbell_Deadlift":["glutes","hamstrings","traps","quadriceps"],
 "Barbell_Hip_Thrust":["hamstrings"],"Glute_Kickback":["hamstrings"],"Dumbbell_Lunges":["glutes","hamstrings"],"Butt_Lift_Bridge":["hamstrings"],"Barbell_Squat":["glutes","hamstrings","lower back"],"Leg_Press":["glutes","hamstrings"],
 "Goblet_Squat":["glutes","hamstrings"],"Split_Squat_with_Dumbbells":["glutes","hamstrings"],"Bodyweight_Squat":["glutes","hamstrings"],"Romanian_Deadlift":["glutes","lower back"],"Stiff-Legged_Dumbbell_Deadlift":["glutes","lower back"],
 "Jogging_Treadmill":["quadriceps","calves"],"Bicycling_Stationary":["quadriceps"],"Rowing_Stationary":["lats","quadriceps"],"Elliptical_Trainer":["quadriceps","glutes"],"Rope_Jumping":["calves"],"Walking_Treadmill":["glutes","calves"]};
function ytUrl(id){return "https://www.youtube.com/results?search_query="+encodeURIComponent(PI.ex[id].n.en+" exercise proper form");}
function steps(id){
  const L=S.lang; if(L==="ar") return PI.ex[id].s;
  if(L==="en") return PI.exEn[id]||[];
  const tr=S.tr[L]&&S.tr[L][id]; return tr||PI.exEn[id]||[];
}

/* ---------------- muscle figures ---------------- */
const VIEW_OF={ub:"b",add:"f",abd:"b",4:"f",2:"f",1:"f",13:"f",6:"f",14:"f",10:"f",3:"f",12:"b",9:"b",5:"b",16:"b",8:"b",11:"b",7:"b",15:"b"};
function fig(view,primIds,secIds,crop,w){
  crop=crop||[22,28,178,369]; const [x0,y0,x1,y1]=crop; const s=w/(x1-x0); const h=Math.round((y1-y0)*s);
  const base=view==="f"?"front":"back";
  const L=[`<img src="img/mus/${base}.svg" alt="">`].concat(secIds.map(o=>`<img src="img/mus/sec-${o}.svg" alt="">`),primIds.map(o=>`<img src="img/mus/main-${o}.svg" alt="">`));
  return `<div class="mfig" style="width:${w}px;height:${h}px"><div class="in2" style="width:${(200*s).toFixed(1)}px;height:${(369*s).toFixed(1)}px;transform:translate(${(-x0*s).toFixed(1)}px,${(-y0*s).toFixed(1)}px)">${L.join("")}</div></div>`;
}
function groupOverlays(groups){return groups.flatMap(g=>PI.muscles[g]?PI.muscles[g].o:[]);}
function bodyMap(prim,sec,w){
  const po=groupOverlays(prim), so=groupOverlays(sec).filter(o=>!po.includes(o));
  const pf=po.filter(o=>VIEW_OF[o]==="f"), pb=po.filter(o=>VIEW_OF[o]==="b"), sf=so.filter(o=>VIEW_OF[o]==="f"), sb=so.filter(o=>VIEW_OF[o]==="b");
  return `<div class="minimap">${fig("f",pf,sf,null,w)}${fig("b",pb,sb,null,w)}</div>`;
}
function muscleThumb(g,w){const m=PI.muscles[g]; if(!m||!m.c) return `<img src="img/food/person_running.webp" alt="" style="width:${w*.8}px;height:${w*.8}px">`; return fig(m.v,m.o,[],m.c,w);}


/* ---------------- detailed goal: target weight, body zones, projection ---------------- */
const normAr=x=>String(x||"").toLowerCase().replace(/[ً-ْـ]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي");
function parseZones(text){
  const has=(sg,list)=>list.some(k=>sg.includes(normAr(k)));
  const segs=(" "+normAr(text)+" ").split(/[،,;:\n+\/]|\sو|\band\b|\s&\s|\.\s/).map(x=>x.trim()).filter(Boolean);
  const out=new Set(); let last=null;
  segs.forEach(sg=>{
    let dir=has(sg,PI.zoneVerbs.gain)?"gain":has(sg,PI.zoneVerbs.lose)?"lose":null;
    if(has(sg,PI.zones.abs_def.kw)){out.add("abs_def"); last=dir||last||"gain"; return;}
    const cand=Object.keys(PI.zones).filter(k=>k!=="abs_def"&&has(sg,PI.zones[k].kw));
    if(!dir) dir=last;
    if(!cand.length){ if(dir) last=dir; return; }
    if(!dir) dir=cand.every(k=>PI.zones[k].dir==="lose")?"lose":"gain";
    let pick=cand.filter(k=>PI.zones[k].dir===dir);
    if(!pick.length){ if(dir==="gain"&&cand.includes("belly")) pick=["abs_def"]; else pick=cand; }
    pick.forEach(k=>out.add(k)); last=dir;
  });
  return [...out];
}
const zonesOf=()=>(S.p.zones||[]).filter(z=>PI.zones[z]);
function zoneFocus(zs){const lists=zs.map(z=>PI.zones[z].m); const out=[]; for(let i=0;i<4;i++) lists.forEach(l=>{if(l[i]&&!out.includes(l[i])&&out.length<4) out.push(l[i]);}); return out;}
function deriveGoal(){
  const p=S.p, w=+p.w, tw=+p.tw, zs=zonesOf();
  const lose=zs.some(z=>PI.zones[z].dir==="lose"), gain=zs.some(z=>PI.zones[z].dir==="gain"&&z!=="abs_def"), abs=zs.includes("abs_def");
  const bmiNow=w/((p.h/100)**2);
  if(tw>0){ const d=tw-w;
    if(d<=-1.5) return (gain&&d>-6)?"recomp":"fat_loss";
    if(d>=1.5) return bmiNow<18.5?"weight_gain":(d>=8&&!lose?"bulk":"lean_gain");
    return (gain&&!lose&&!abs)?"lean_gain":"recomp";
  }
  if(abs&&!gain&&!lose) return "cut";
  if(lose&&gain) return "recomp"; if(lose||abs) return "fat_loss"; if(gain) return bmiNow>27?"recomp":"lean_gain";
  return p.goal;
}
function tAt(w){const o=S.p.w; S.p.w=w; const T=targets(); S.p.w=o; return T;}
/* week-by-week simulation under the current calorie target; weight changes feed back into BMR/TDEE */
function project(tw,maxW){
  const p=S.p; let w=+p.w; const dir=Math.sign(tw-w); const series=[w]; let capped=false, first=null;
  const lossCap=(isPost()&&p.bf)?0.5:Infinity;
  for(let k=0;k<(maxW||156);k++){
    const T=tAt(w); let dw=(T.kcal-T.tdee)*7/7700;
    if(dw<0){const cap=Math.min(w*.01,lossCap); if(-dw>cap){dw=-cap; capped=true;}}
    else {const cap=w*.005; if(dw>cap){dw=cap; capped=true;}}
    if(first===null) first=dw;
    if(dir===0||Math.sign(dw)!==dir||Math.abs(dw)<0.03) return {ok:false,first,series};
    w+=dw; if((dir<0&&w<=tw)||(dir>0&&w>=tw)){series.push(tw); return {ok:true,weeks:k+1,first,series,capped};}
    series.push(w);
  }
  return {ok:false,first,series,long:true};
}
const LOCALE={ar:"ar-EG",en:"en-GB",hi:"hi-IN",bn:"bn-BD"};
function fmtMonth(d){try{return new Intl.DateTimeFormat(LOCALE[S.lang]+"-u-ca-gregory-nu-latn",{month:"long",year:"numeric"}).format(d);}catch(e){return d.toISOString().slice(0,7);}}
const addWeeks=n=>new Date(Date.now()+n*7*864e5);
function bodyPbf(){const c=S.body&&S.body.cur; return c&&+c.pbf>0?+c.pbf:0;}
function zoneEtas(){
  const zs=zonesOf(); if(!zs.length) return [];
  const w=+S.p.w; const lv=S.gym.level||"int"; const [a,b]={beg:[6,10],int:[8,12],adv:[12,16]}[lv]||[8,12];
  const lines=[]; const loseZ=zs.filter(z=>PI.zones[z].dir==="lose"), gainZ=zs.filter(z=>PI.zones[z].dir==="gain"&&z!=="abs_def");
  if(loseZ.length){ const kg=r1(w*.04); const pr=project(w-kg); const names=loseZ.map(z=>nm(PI.zones[z])).join("، ");
    lines.push(pr.ok?t("zone_eta_lose",{z:names,kg,w:pr.weeks}):t("zone_eta_lose_nw",{z:names})); }
  if(gainZ.length) lines.push(t("zone_eta_gain",{z:gainZ.map(z=>nm(PI.zones[z])).join("، "),a,b}));
  if(zs.includes("abs_def")){ const goalP=S.p.sex==="f"?20:12; const pbf=bodyPbf(); const z=nm(PI.zones.abs_def);
    if(!pbf) lines.push(t("zone_eta_abs_nopbf",{z,p:goalP}));
    else if(pbf<=goalP+1) lines.push(t("zone_eta_abs_near",{z,c:r1(pbf)}));
    else { const kg=r1(w*(pbf-goalP)/100/.85); const pr=project(w-kg); lines.push(pr.ok?t("zone_eta_abs",{z,p:goalP,c:r1(pbf),kg,w:pr.weeks}):t("zone_eta_lose_nw",{z})); } }
  return lines;
}
function etaChart(series,tw){
  const W=600,H=150,P=34; const n=series.length-1; if(n<1) return "";
  const lo=Math.min(...series,tw)-1, hi=Math.max(...series,tw)+1;
  const X=i=>P+(W-2*P)*i/n, Y=v=>12+(H-40)*(hi-v)/(hi-lo);
  const pts=series.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const step=n>40?Math.round(n/26)*4.345:4.345; const ticks=[]; for(let x=step;x<n;x+=step) ticks.push(x);
  const down=series[n]<series[0];
  return `<div class="etachart" dir="ltr"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("eta_title"))}">
    ${ticks.map((x,i)=>`<line x1="${X(x)}" x2="${X(x)}" y1="10" y2="${H-26}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${X(x)}" y="${H-10}" text-anchor="middle" font-size="11" fill="var(--muted)">${Math.round(x/4.345)}</text>`).join("")}
    <line x1="${P}" x2="${W-P}" y1="${Y(tw)}" y2="${Y(tw)}" stroke="${down?"var(--leaf)":"var(--sea)"}" stroke-dasharray="6 5" opacity=".6"/>
    <polyline points="${pts}" fill="none" stroke="${down?"var(--leaf)":"var(--sea)"}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(0)}" cy="${Y(series[0])}" r="5" fill="var(--sun)"/><circle cx="${X(n)}" cy="${Y(series[n])}" r="5.5" fill="${down?"var(--leaf)":"var(--sea)"}"/>
    <text x="${X(0)}" y="${Y(series[0])+(down?-10:18)}" font-size="12" font-weight="700" fill="var(--ink)">${r1(series[0])}</text>
    <text x="${X(n)}" y="${Y(series[n])+(down?18:-10)}" text-anchor="end" font-size="12" font-weight="700" fill="var(--ink)">${r1(series[n])}</text>
  </svg><p class="cap" dir="${PI.langs[S.lang].dir}">${esc(t("chart_cap"))}</p></div>`;
}
function etaInfo(){
  const p=S.p, w=+p.w, tw=+p.tw;
  if(isPreg()) return {kind:"preg"};
  if(!(tw>0)) return {kind:"none"};
  if(Math.abs(tw-w)<0.5) return {kind:"reached"};
  const pr=project(tw); return Object.assign({kind:pr.ok?"ok":pr.long?"long":"unreach"},pr);
}
function etaCard(){
  const p=S.p, tw=+p.tw; const T=targets(); const E=etaInfo(); let body="";
  if(E.kind==="preg") body=`<p>${esc(t("preg_tw"))}</p>`;
  else if(E.kind==="none") body=`<p class="sub">${esc(t("eta_noweight"))}</p>`;
  else if(E.kind==="reached") body=`<p>${esc(t("eta_reached"))}</p>`;
  else if(E.kind!=="ok") body=`<div class="tipbox warn">${esc(E.kind==="long"?t("eta_long"):t("eta_unreach",{kcal:fmt(T.kcal),tw}))}</div>`;
  else { const wk=E.weeks; const ms=[]; for(let k=4;k<wk&&ms.length<6;k+=wk>30?8:4) ms.push(k);
    body=`<div class="kpis eta">
      <div class="kpi hl"><span>${esc(t("eta_time"))}</span><b class="num">${esc(t("eta_weeks",{w:wk}))}</b><i>${esc(t("eta_months",{m:r1(wk/4.345)}))}</i></div>
      <div class="kpi"><span>${esc(t("eta_arrive"))}</span><b>${esc(fmtMonth(addWeeks(wk)))}</b><i>${esc(t("eta_rate",{r:r1(Math.abs(E.first))}))}</i></div>
      <div class="kpi"><span>${esc(t("eta_now"))} → ${esc(t("eta_target"))}</span><b class="num">${p.w} → ${tw} ${esc(t("kg"))}</b><i class="num">${tw<p.w?"−":"+"}${r1(Math.abs(tw-p.w))} ${esc(t("kg"))}</i></div></div>
      ${etaChart(E.series,tw)}
      ${ms.length?`<div class="miles">${ms.map(k=>`<span><b class="num">${r1(E.series[k])} ${esc(t("kg"))}</b>${esc(t("eta_after",{w:k}))}</span>`).join("")}</div>`:""}
      ${E.capped?`<p class="sub" style="margin:8px 0 0">${esc(t("eta_cap_note"))}</p>`:""}`; }
  const zl=zoneEtas();
  return `<section class="card"><h3><img src="img/food/stopwatch.webp" alt="">${esc(t("eta_title"))}</h3>${body}
    ${zl.length?`<h4 style="margin-top:14px">${esc(t("eta_zones"))}</h4><ul class="zeta">${zl.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    ${E.kind!=="preg"?`<p class="note" style="margin-top:10px">${esc(t("eta_assume"))}</p>`:""}</section>`;
}
function goalDetailCard(){
  const p=S.p, zs=zonesOf(), preg=isPreg(); const w=+p.w, tw=+p.tw;
  const zb=k=>{const z=PI.zones[k]; return `<button class="zbtn ${z.dir}" data-zone="${k}" aria-pressed="${zs.includes(k)}">${muscleThumb(z.th,52)}<span>${esc(nm(z))}</span></button>`;};
  const L=Object.keys(PI.zones).filter(k=>PI.zones[k].dir==="lose"), G=Object.keys(PI.zones).filter(k=>PI.zones[k].dir==="gain");
  const bmiT=tw>0?tw/((p.h/100)**2):0;
  const sug=preg?null:deriveGoal(); const cur=p.goal; const curG=PI.goals[cur];
  const mism=!preg&&tw>0&&Math.abs(tw-w)>=1.5&&((tw<w&&curG.kf>=1)||(tw>w&&curG.kf<1));
  return `<section class="card" id="goalCard"><h3><img src="img/food/bullseye.webp" alt="">${esc(t("goal_detail"))}</h3>
    <div class="grid2">
      <label class="f" for="pTw">${esc(t("target_w"))}<span class="unitbox"><input class="in num" id="pTw" data-p="tw" type="number" inputmode="decimal" min="35" max="250" step="0.5" value="${tw>0?tw:""}" placeholder="${Math.round(w-(w>80?8:4))}" ${preg?"disabled":""}><i>${esc(t("kg"))}</i></span></label>
      <div class="twinfo">${tw>0?`<b class="num ${tw<w?"down":"up"}">${tw<w?"−":"+"}${r1(Math.abs(tw-w))} ${esc(t("kg"))}</b><span class="sub num">BMI ${r1(w/((p.h/100)**2))} → ${r1(bmiT)}</span>`:`<span class="sub">${esc(t("target_w_hint"))}</span>`}</div>
    </div>
    ${preg?`<div class="tipbox" style="margin-top:10px">${esc(t("preg_tw"))}</div>`:""}
    ${bmiT&&bmiT<18.5?`<div class="tipbox warn" style="margin-top:10px">${esc(t("bmi_low_warn",{b:r1(bmiT)}))}</div>`:""}
    <h4 style="margin-top:16px"><span class="zdot lose"></span>${esc(t("zones_lose"))}</h4><div class="zgrid">${L.map(zb).join("")}</div>
    <h4 style="margin-top:14px"><span class="zdot gain"></span>${esc(t("zones_gain"))}</h4><div class="zgrid">${G.map(zb).join("")}</div>
    <label class="f" for="zoneText" style="margin-top:14px">${esc(t("zones_text"))}
      <span class="row" style="gap:8px;flex-wrap:nowrap"><input class="in" id="zoneText" type="text" value="${esc(p.goalText||"")}" placeholder="${esc(t("zones_text_ph"))}" style="flex:1;min-width:0"><button class="btn" data-zparse>${esc(t("zones_parse"))}</button></span></label>
    <div class="tipbox" style="margin-top:12px">${esc(t("spot_note"))}</div>
    ${preg?"":`<div class="applyrow">
      <p>${esc(t("goal_suggest",{goal:nm(PI.goals[sug])}))}${zs.length?` · ${esc(t("p_focus"))}: ${esc(zoneFocus(zs).map(m=>nm(PI.muscles[m])).join("، "))}`:""}</p>
      ${mism?`<p class="warn">${esc(t("goal_mismatch",{goal:nm(curG)}))}</p>`:""}
      <button class="btn pri" data-goalapply><img src="img/food/sparkles.webp" alt="">${esc(t("goal_apply"))}</button></div>`}
  </section>`;
}
function applyGoal(){
  if(isPreg()){toast(t("preg_tw")); return;}
  const g=deriveGoal(); const G=PI.goals[g]; const zs=zonesOf(); const focus=zoneFocus(zs);
  S.p.goal=g; S.p.mode="auto"; S.p.link=true;
  S.gym.gg=(zs.some(z=>PI.zones[z].dir==="gain")&&g!=="fat_loss")?"hypertrophy":G.gym;
  S.gym.focus=focus;
  if(zs.some(z=>PI.zones[z].dir==="lose")||g==="fat_loss"||g==="cut") S.gym.cardioMin=Math.max(+S.gym.cardioMin||0,25);
  if(S.gym.wd.length<G.days) S.gym.wd=WD_PATTERN[G.days].slice();
  if(S.gym.mode==="library") S.gym.mode="general";
  if(S.gym.mode==="custom"&&focus.length) S.gym.muscles=[...new Set(S.gym.muscles.concat(focus))];
  buildPlan(planN()); render();
  const T=targets(); const E=etaInfo();
  toast(t("goal_applied",{goal:nm(G),kcal:fmt(T.kcal),days:S.gym.wd.length,focus:focus.length?focus.map(m=>nm(PI.muscles[m])).join("، "):"—"})+(E.kind==="ok"?" "+t("eta_weeks_short",{w:E.weeks}):""),8000);
}
function goalStrip(){
  const p=S.p, zs=zonesOf(), tw=+p.tw; if(!(tw>0)&&!zs.length) return "";
  const parts=[]; if(tw>0) parts.push(`${p.w} → ${tw} ${t("kg")}`);
  const L=zs.filter(z=>PI.zones[z].dir==="lose").map(z=>nm(PI.zones[z])), G=zs.filter(z=>PI.zones[z].dir==="gain").map(z=>nm(PI.zones[z]));
  if(L.length) parts.push(t("dir_lose")+": "+L.join("، ")); if(G.length) parts.push(t("dir_gain")+": "+G.join("، "));
  const E=etaInfo(); if(E.kind==="ok") parts.push(t("eta_weeks_short",{w:E.weeks}));
  return `<div class="banner goalstrip"><img src="img/food/bullseye.webp" alt=""><p><b>${esc(t("goal_line"))}</b> ${esc(parts.join(" · "))}</p><button class="btn sm" data-tab="profile">${esc(t("goal_edit"))}</button></div>`;
}
function focusCard(){
  const f=S.gym.focus||[]; if(!f.length) return ""; const zs=zonesOf(); const used=new Set();
  const rows=f.filter(m=>PI.muscles[m]).map(m=>{const ids=[]; for(let k=0;k<6&&ids.length<3;k++){const id=pickEx(m,"i",k,S.gym.eq,new Set([...used,...ids])); if(id&&!ids.includes(id)) ids.push(id);} ids.forEach(i=>used.add(i));
    return `<div class="frow"><div class="fm">${muscleThumb(m,46)}<b>${esc(nm(PI.muscles[m]))}</b></div><div class="fex">${ids.map(id=>`<span class="fx"><img class="f1" src="${exImg(id)}" alt="" loading="lazy"><span>${esc(nm(PI.ex[id]))}</span></span>`).join("")}</div></div>`;}).join("");
  return `<section class="card"><h3><img src="img/food/flexed_biceps.webp" alt="">${esc(zs.length?t("focus_from_goal"):t("p_focus"))}</h3>
    <p class="sub" style="margin-top:-4px">${esc(t("focus_from_goal_d"))}</p>${rows}</section>`;
}
function goalBlock(){
  const p=S.p, zs=zonesOf(), tw=+p.tw; if(!(tw>0)&&!zs.length) return "";
  const E=etaInfo(); const L=zs.filter(z=>PI.zones[z].dir==="lose").map(z=>nm(PI.zones[z])), G=zs.filter(z=>PI.zones[z].dir==="gain").map(z=>nm(PI.zones[z]));
  const rows=[];
  if(tw>0) rows.push([t("target_w"),`${p.w} → ${tw} ${t("kg")} (${tw<p.w?"−":"+"}${r1(Math.abs(tw-p.w))})`]);
  if(L.length) rows.push([t("zones_lose"),L.join("، ")]); if(G.length) rows.push([t("zones_gain"),G.join("، ")]);
  if((S.gym.focus||[]).length) rows.push([t("p_focus"),S.gym.focus.map(m=>nm(PI.muscles[m])).join("، ")]);
  if(E.kind==="ok") rows.push([t("eta_time"),`${t("eta_weeks",{w:E.weeks})} (${t("eta_months",{m:r1(E.weeks/4.345)})}) · ${fmtMonth(addWeeks(E.weeks))} · ${t("eta_rate",{r:r1(Math.abs(E.first))})}`]);
  else if(E.kind==="unreach"||E.kind==="long") rows.push([t("eta_time"),E.kind==="long"?t("eta_long"):t("eta_unreach",{kcal:fmt(targets().kcal),tw})]);
  const zl=zoneEtas();
  return `<div class="rb"><h3>${esc(t("goal_detail"))}</h3><table class="rt"><tbody>${rows.map(([a,b])=>`<tr><td style="width:130px;font-weight:700">${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
    ${zl.map(x=>`<div class="rtip">${esc(x)}</div>`).join("")}<div class="rtip" style="background:#FFF2C7">${esc(t("spot_note"))}</div></div>`;
}

/* ---------------- header / chrome ---------------- */
function applyChrome(){
  const L=PI.langs[S.lang]; document.documentElement.lang=S.lang; document.documentElement.dir=L.dir;
  if(S.theme) document.documentElement.setAttribute("data-theme",S.theme); else document.documentElement.removeAttribute("data-theme");
  $$("[data-t]").forEach(el=>el.textContent=t(el.dataset.t));
  $("#langSel").innerHTML=Object.entries(PI.langs).map(([k,v])=>`<option value="${k}" ${k===S.lang?"selected":""}>${v.name}</option>`).join("");
  const dark=S.theme?S.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
  $("#themeSeg").setAttribute("aria-label",t("theme"));
  $("#themeSeg").innerHTML=`<button data-theme-set="light" aria-pressed="${!dark}">☀ ${t("theme_light")}</button><button data-theme-set="dark" aria-pressed="${dark}">☾ ${t("theme_dark")}</button>`;
  $("#ctySeg").setAttribute("aria-label",t("country"));
  $("#ctySeg").innerHTML=["sa","eg"].map(c=>`<button data-cty="${c}" aria-pressed="${S.country===c}">${FLAG[c]} ${t("cur_"+c)}</button>`).join("");
  const tabs=[["profile","bullseye"],["body","balance_scale"],["food","green_salad"],["gym","person_lifting_weights"],["export","clipboard"]];
  $("#tabs").innerHTML=tabs.map(([k,i])=>`<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab===k}"><img src="img/food/${i}.webp" alt="">${t("tab_"+(k==="food"?"food":k))}</button>`).join("");
  $("#foot").innerHTML=`<p>${esc(t("credits"))}</p><p>${esc(t("saved_local"))}</p>`;
  
}
function renderHero(){
  const T=targets(); const D=dayTotals();
  $("#heroStats").innerHTML=[
    [fmt(T.kcal),t("daily_target")+" · "+t("kcal")],
    [fmt(T.P)+" "+t("g"),t("protein")],
    [gymDays(),t("train_days")],
    [money(D.cost),t("day_cost")]
  ].map(([b,s])=>`<div class="hstat"><b class="num">${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
}
function renderRail(){
  const T=targets(), D=dayTotals();
  const row=(lab,cur,tgt,col,unit)=>{const pct=Math.min(130,cur/tgt*100); const d=cur-tgt; const tol=Math.max(tgt*.05,unit===t("kcal")?60:5);
    const st=Math.abs(d)<=tol?t("on_target"):d>0?`${t("over")} ${fmt(d)} ${unit}`:`${t("under")} ${fmt(-d)} ${unit}`;
    return `<div class="pr"><div class="top"><b>${esc(lab)}</b><span class="num">${fmt(cur)} / ${fmt(tgt)} ${esc(unit)}</span></div><div class="bar"><div style="width:${Math.min(100,pct)}%;background:${col}"></div></div><div class="st ${d>tol?"warn":""}">${esc(st)}</div></div>`;};
  const sa=dayTotals("sa").cost, eg=dayTotals("eg").cost; const MC=(weekOk()?weekAvgCost(S.week):D.cost)*30;
  $("#rail").innerHTML=`
  <div class="card"><h3><img src="img/food/bullseye.webp" alt="">${esc(t("today"))} · ${esc(wdName(S.day))}</h3>
    <div class="prog">${row(t("calories"),D.k,T.kcal,"var(--sun)",t("kcal"))}${row(t("protein"),D.p,T.P,"var(--mP)",t("g"))}${row(t("carbs"),D.c,T.C,"var(--mC)",t("g"))}${row(t("fat"),D.f,T.F,"var(--mF)",t("g"))}</div></div>
  <div class="card"><h3><img src="img/food/money_bag.webp" alt="">${esc(t("day_cost"))} · ${esc(wdName(S.day))}</h3>
    <div class="cost"><b class="num">${esc(money(D.cost))}</b></div><div class="sub num">≈ ${esc(money(MC))} ${esc(t("month_cost"))} · ${esc(t("week_basis"))}</div>
    ${getBudget()>0?`<div class="pr" style="margin-top:8px"><div class="top"><b>${esc(t("budget_label"))}</b><span class="num">${Math.round(MC/getBudget()*100)}% ${esc(t("budget_rail"))}</span></div><div class="bar"><div style="width:${Math.min(100,MC/getBudget()*100)}%;background:${MC>getBudget()?"var(--tomato)":"var(--leaf)"}"></div></div><div class="st num">${esc(money(getBudget()))} ${esc(t("per_month"))}</div></div>`:""}
    <div class="costs2"><div class="${S.country==="sa"?"on":""}"><span>${FLAG.sa} ${esc(t("sa"))}</span><b class="num">${esc(money(sa,"sa"))}</b></div><div class="${S.country==="eg"?"on":""}"><span>${FLAG.eg} ${esc(t("eg"))}</span><b class="num">${esc(money(eg,"eg"))}</b></div></div></div>
  <div class="card"><h3><img src="img/food/calendar.webp" alt="">${esc(t("train_days"))}</h3>
    <div class="week mini">${(PI.T.wds[S.lang]||PI.T.wds.en).map((d,i)=>`<div class="wk ${S.gym.wd.includes(i)?"on":""}"><b>${esc(d)}</b></div>`).join("")}</div>
    <p class="sub" style="margin:8px 0 0">${esc(t(gymModeKey()))} · ${esc(t("gg_"+S.gym.gg))}</p></div>`;
}

/* ---------------- PROFILE ---------------- */
function renderProfile(){
  const p=S.p, T=targets(); const G=PI.goals[p.goal]; const preg=isPreg();
  const fnote=preg?t("preg_note",{add:T.add,p:T.P}):isPost()?(p.bf?t("post_bf_note"):t("post_note")):"";
  const tot=T.P*4+T.C*4+T.F*9;
  const gl=Object.entries(PI.goals).map(([k,g])=>`<button class="chip" data-goal="${k}" aria-pressed="${p.goal===k}"><img src="${fimg(g.img)}" alt=""><span>${esc(nm(g))}<small>${esc(g.d[S.lang]||g.d.en)}</small></span></button>`).join("");
  const acts=[1,2,3,4,5].map(i=>`<option value="${i}" ${+p.act===i?"selected":""}>${esc(t("act_"+i))}</option>`).join("");
  return `
  <section class="card"><h3><img src="img/food/flexed_biceps.webp" alt="">${esc(t("about_you"))}</h3>
    <div class="grid4">
      <label class="f">${esc(t("sex"))}<span class="radio" role="group"><button data-sex="m" aria-pressed="${p.sex==="m"}">${esc(t("male"))}</button><button data-sex="f" aria-pressed="${p.sex==="f"}">${esc(t("female"))}</button></span></label>
      <label class="f" for="pAge">${esc(t("age"))}<span class="unitbox"><input class="in num" id="pAge" data-p="age" type="number" inputmode="numeric" min="14" max="90" value="${p.age}"><i>${esc(t("years"))}</i></span></label>
      <label class="f" for="pW">${esc(t("weight"))}<span class="unitbox"><input class="in num" id="pW" data-p="w" type="number" inputmode="decimal" min="35" max="250" step="0.5" value="${p.w}"><i>${esc(t("kg"))}</i></span></label>
      <label class="f" for="pH">${esc(t("height"))}<span class="unitbox"><input class="in num" id="pH" data-p="h" type="number" inputmode="numeric" min="130" max="230" value="${p.h}"><i>${esc(t("cm"))}</i></span></label>
    </div>
    ${p.sex==="f"?`<div class="row" style="margin-top:12px;align-items:flex-end">
      <label class="f">${esc(t("fs_label"))}<span class="radio" role="group">${["normal","preg","post"].map(k=>`<button data-fs="${k}" aria-pressed="${(p.fs||"normal")===k}">${esc(t("fs_"+k))}</button>`).join("")}</span></label>
      ${p.fs==="preg"?`<label class="f" for="pTri">${esc(t("tri"))}<select class="in" id="pTri">${[1,2,3].map(i=>`<option value="${i}" ${+p.tri===i?"selected":""}>${esc(t("tri_"+i))}</option>`).join("")}</select></label>`:""}
      ${p.fs==="post"?`<label class="f">${esc(t("bf"))}<span class="radio" role="group"><button data-bf="1" aria-pressed="${!!p.bf}">${esc(t("yes"))}</button><button data-bf="0" aria-pressed="${!p.bf}">${esc(t("no"))}</button></span></label>`:""}
    </div>`:""}
    <div class="grid2" style="margin-top:12px">
      <label class="f" for="pAct">${esc(t("activity"))}<select class="in" id="pAct" data-p="act" ${p.link?"disabled":""}>${acts}</select></label>
      <label class="row" style="align-self:end;font-weight:600;font-size:.88rem;gap:8px"><input type="checkbox" id="pLink" ${p.link?"checked":""}> ${esc(t("act_link"))} <span class="sub num">(×${T.af.toFixed(2)})</span></label>
    </div>
    ${+p.bmrR>800?`<label class="row" style="margin-top:10px;font-weight:600;font-size:.88rem;gap:8px"><input type="checkbox" id="pUseR" ${p.useR?"checked":""}> ${esc(t("use_report"))} <span class="sub num">(BMR ${fmt(p.bmrR)} · FFM ${p.ffm||"–"})</span></label>`:""}
  </section>
  <section class="card"><h3><img src="img/food/bullseye.webp" alt="">${esc(t("your_goal"))}</h3>
    ${preg?`<div class="goalgrid"><button class="chip" aria-pressed="true" disabled><img src="${fimg("seedling")}" alt=""><span>${esc(t("goal_preg"))}<small>${esc(t("goal_locked"))}</small></span></button></div>`:`<div class="goalgrid">${gl}</div>`}
    <div class="row" style="margin-top:14px;align-items:flex-end" ${preg?"hidden":""}>
      <label class="f">${esc(t("calc_mode"))}<span class="radio" role="group"><button data-mode="auto" aria-pressed="${p.mode==="auto"}">${esc(t("mode_auto"))}</button><button data-mode="manual" aria-pressed="${p.mode==="manual"}">${esc(t("mode_manual"))}</button></span></label>
      ${p.mode==="manual"?`<label class="f" for="pKcal" style="width:180px">${esc(t("manual_kcal"))}<span class="unitbox"><input class="in num" id="pKcal" data-p="kcal" type="number" min="1000" max="6000" step="50" value="${p.kcal}"><i>${esc(t("kcal"))}</i></span></label>`:""}
    </div>
  </section>
  ${goalDetailCard()}
  ${etaCard()}
  <section class="card"><h3><img src="img/food/fire.webp" alt="">${esc(t("daily_target"))}</h3>
    <div class="kpis">
      <div class="kpi"><span>${esc(t("bmr"))}</span><b class="num">${fmt(T.bmr)}</b><i>${esc(t("bmr_note"))}</i></div>
      <div class="kpi"><span>${esc(t("tdee"))}</span><b class="num">${fmt(T.tdee)}</b><i>${esc(t("tdee_note"))}</i></div>
      <div class="kpi hl"><span>${esc(t("daily_target"))}</span><b class="num">${fmt(T.kcal)}</b><i>${esc(preg?t("goal_preg"):nm(G))}</i></div>
    </div>
    <h4 style="margin-top:16px">${esc(t("macros"))}</h4>
    <div class="macrobar" role="img" aria-label="${esc(t("macros"))}"><div style="width:${T.P*4/tot*100}%;background:var(--mP)"></div><div style="width:${T.C*4/tot*100}%;background:var(--mC)"></div><div style="width:${T.F*9/tot*100}%;background:var(--mF)"></div></div>
    <div class="mleg">
      <div style="border-color:var(--mP)"><b class="num">${T.P} ${esc(t("g"))}</b><span>${esc(t("protein"))} · ${r1(T.P/p.w)} ${esc(t("g"))} ${esc(t("per_kg"))}</span></div>
      <div style="border-color:var(--mC)"><b class="num">${T.C} ${esc(t("g"))}</b><span>${esc(t("carbs"))} · ${r0(T.C*4/tot*100)}%</span></div>
      <div style="border-color:var(--mF)"><b class="num">${T.F} ${esc(t("g"))}</b><span>${esc(t("fat"))} · ${r0(T.F*9/tot*100)}%</span></div>
    </div>
  </section>
  ${fnote?`<div class="banner care"><img src="${fimg(preg?"seedling":"glass_of_milk")}" alt=""><p>${esc(fnote)}</p></div>`:""}
  ${linkBanner("food")}`;
}
function linkBanner(from){
  const G=PI.goals[S.p.goal];
  const msg=t("link_note_goal",{goal:nm(G),days:G.days,gym:t("gg_"+G.gym)});
  return from==="food"
   ?`<div class="banner"><img src="img/food/person_lifting_weights.webp" alt=""><p><b>${esc(t("link_title"))}</b><br>${esc(msg)}</p><button class="btn pri" data-link="food2gym">${esc(t("link_food_to_gym"))}</button></div>`
   :`<div class="banner"><img src="img/food/green_salad.webp" alt=""><p><b>${esc(t("link_title"))}</b><br>${esc(t("gg_"+S.gym.gg))} · ${esc(t("days_n",{n:gymDays()}))}</p><button class="btn pri" data-link="gym2food">${esc(t("link_gym_to_food"))}</button></div>`;
}

/* ---------------- FOOD ---------------- */
function foodOptions(sel){
  return Object.entries(PI.cats).map(([c,ci])=>`<optgroup label="${esc(nm(ci))}">${PI.foods.filter(f=>f.cat===c&&(!banned(f.id)||f.id===sel)).map(f=>`<option value="${f.id}" ${f.id===sel?"selected":""}>${esc(nm(f))} · ${"$".repeat(priceTier(f))}</option>`).join("")}</optgroup>`).join("");
}
function itemRow(mi,ii,it){
  const f=F[it.f]; const x=calcItem(it);
  const ms=methodsFor(f).map(m=>`<option value="${m}" ${m===it.m?"selected":""}>${esc(nm(PI.methods[m]))}</option>`).join("");
  const unit=f.u?`<div class="hint num">${esc(t("units_hint",{n:r1(it.g/f.u),u:f.un[S.lang]||f.un.en}))}</div>`:`<div class="hint">${esc(t("st_"+f.st))}</div>`;
  return `<div class="it" data-mi="${mi}" data-ii="${ii}">
    <div class="fimg"><img src="${fimg(f.img)}" alt=""></div>
    <div class="c-food"><select class="in" data-k="f" aria-label="${esc(t("food"))}">${foodOptions(it.f)}</select>${banned(it.f)?`<span class="bantag">⛔ ${esc(t("tayb_banned"))}</span>`:""}</div>
    <div class="c-g"><input class="in num" data-k="g" type="number" min="0" max="2000" step="5" inputmode="numeric" value="${it.g}" aria-label="${esc(t("amount"))}">${unit}</div>
    <div class="c-m"><select class="in" data-k="m" aria-label="${esc(t("method"))}" ${ms.split("<option").length<3?"disabled":""}>${ms}</select></div>
    <div class="nums num" data-nums><b>${fmt(x.k)}</b> ${esc(t("kcal"))}<br><span style="color:var(--mP)">P ${r0(x.p)}</span> · <span>C ${r0(x.c)}</span> · <span style="color:var(--mF)">F ${r0(x.f)}</span><br><span class="sub">${esc(money(x.cost))}</span></div>
    <div class="c-act"><button class="mini" data-falt aria-expanded="${ui.alt===mi+"-"+ii}" title="${esc(t("alts_food"))}">⇄ ${esc(t("alts_food"))}</button><button class="mini" data-fnut aria-expanded="${ui.nut===mi+"-"+ii}" title="${esc(t("nut_btn"))}">ⓘ</button></div>
    <button class="del" data-del aria-label="${esc(t("remove"))}">×</button></div>
    ${ui.alt===mi+"-"+ii?altPanel(mi,ii,it):""}${ui.nut===mi+"-"+ii?nutPanel(it):""}`;
}
let ui={alt:null,nut:null};
function altPanel(mi,ii,it){
  const f=F[it.f]; const cur=calcItem(it); const all=foodAlts(it); const b=eqBasis(f);
  const rows=all.filter(r=>r.c.cost<=cur.cost).slice(0,4).concat(all.filter(r=>r.c.cost>cur.cost).slice(0,3));
  const tags=(id,g)=>richIn(id,g).map(([k])=>nm(PI.nutName[k])).join("، ");
  const row=(x,g,c,isCur)=>{const d=c.cost-cur.cost; return `<div class="falt ${isCur?"cur":""}"><img src="${fimg(x.img)}" alt=""><div class="fa-n"><b>${esc(nm(x))}</b><span class="num">${g} ${esc(t("g"))} · ${fmt(c.k)} ${esc(t("kcal"))} · P ${r0(c.p)} · C ${r0(c.c)} · F ${r0(c.f)}</span>${tags(x.id,g)?`<span class="rich">${esc(t("rich_in"))}: ${esc(tags(x.id,g))}</span>`:""}</div>
    <div class="fa-c num"><b>${esc(money(c.cost))}</b>${isCur?`<span>${esc(t("current"))}</span>`:`<span class="${d<0?"up":"down"}">${d<0?"−":"+"}${esc(money(Math.abs(d)))} ${esc(t(d<0?"cheaper":"pricier"))}</span>`}<i class="lvl">${"$".repeat(priceTier(x))}</i></div>
    ${isCur?"":`<button class="btn sm" data-fswap="${mi}|${ii}|${x.id}|${g}">${esc(t("use_this"))}</button>`}</div>`;};
  return `<div class="fpanel"><h5>${esc(t("alts_food_t",{food:nm(f),basis:t("basis_"+b)}))}</h5>${row(f,it.g,cur,true)}${rows.map(r=>row(r.x,r.g,r.c,false)).join("")}</div>`;
}
function nutPanel(it){
  const f=F[it.f]; const v=microOf(it); const x=calcItem(it); if(!v) return "";
  const R=rdaSet();
  return `<div class="fpanel"><h5>${esc(nm(f))} · <span class="num">${it.g} ${esc(t("g"))}</span></h5>
    <div class="nutgrid"><div><b class="num">${fmt(x.k)}</b><span>${esc(t("kcal"))}</span></div><div><b class="num">${r1(x.p)}</b><span>${esc(t("protein"))} (${esc(t("g"))})</span></div><div><b class="num">${r1(x.c)}</b><span>${esc(t("carbs"))} (${esc(t("g"))})</span></div><div><b class="num">${r1(x.f)}</b><span>${esc(t("fat"))} (${esc(t("g"))})</span></div>
    ${PI.nutKeys.map((k,i)=>`<div><b class="num" dir="ltr">${esc(fmtN(v[i],k))}</b><span>${esc(nm(PI.nutName[k]))} · <i class="num">${Math.round(v[i]/R[k]*100)}%</i></span></div>`).join("")}</div></div>`;
}
function mealCard(m,mi){
  const s=sumItems(m.items); const tips=m.items.length?mealTips(m):[];
  return `<section class="card meal" data-meal="${mi}">
    <div class="meal-h"><h3>${esc(t("meal_"+m.k))}</h3><input class="in time num" type="time" data-time value="${esc(m.t||"")}" aria-label="time">
      <div class="tot" data-tot>${totPills(s)}</div></div>
    <div class="items">${m.items.length?m.items.map((it,ii)=>itemRow(mi,ii,it)).join(""):`<div class="empty">${esc(t("empty_meal"))}</div>`}</div>
    <div class="meal-f">
      <div class="row"><button class="btn sm" data-add><span aria-hidden="true">＋</span>${esc(t("add_item"))}</button></div>
      ${tips.length?`<div class="tipbox"><h4><img src="img/food/sparkles.webp" alt="">${esc(t("smart_tip"))}</h4><ul>${tips.map(x=>`<li class="${x.warn?"warn":""}">${esc(x.s)}</li>`).join("")}</ul>
        <div class="row" style="margin-top:6px"><button class="btn sm sun" data-ai><img src="img/food/robot.webp" alt="">${esc(t("ai_tip"))}</button></div>
        <div class="aibox" data-aiout hidden></div></div>`:""}
    </div></section>`;
}
function totPills(s){return `<span class="pill k num">${fmt(s.k)} ${esc(t("kcal"))}</span><span class="pill p num">P ${r0(s.p)}</span><span class="pill c num">C ${r0(s.c)}</span><span class="pill f num">F ${r0(s.f)}</span><span class="pill cost num">${esc(money(s.cost))}</span>`;}
let tierMemo={};
function styleCard(){
  const cur=isTayb()?"tayyibat":"normal";
  const chip=(k,img)=>`<button class="chip tierc" data-style="${k}" aria-pressed="${cur===k}"><img src="${fimg(img)}" alt=""><span>${esc(t("style_"+k))}<small>${esc(t("style_"+k+"_d"))}</small></span></button>`;
  return `<section class="card"><h3><img src="img/food/fork_and_knife_with_plate.webp" alt="">${esc(t("style_title"))}</h3>
    <div class="stylegrid">${chip("normal","green_salad")}${chip("tayyibat","meat_on_bone")}</div>
    ${cur==="tayyibat"?`<div class="tipbox" style="margin-top:12px">${esc(t("tayb_note"))}</div><div class="tipbox warn" style="margin-top:8px">${esc(t("tayb_warn"))}</div>`:""}</section>`;
}
function tierCard(){
  const n=S.meals.length||4; const cur=S.p.tier||"std"; const T=targets();
  const key=JSON.stringify([S.country,n,T.kcal,T.P,T.C,T.F,S.prices,S.p.style||""]); if(tierMemo.key!==key){tierMemo={key,cost:{}}; ["eco","std","prem"].forEach(k=>tierMemo.cost[k]=weekAvgCost(makeWeek(n,k))*30);} const cost=tierMemo.cost;
  const chip=(k,img)=>`<button class="chip tierc" data-tier="${k}" aria-pressed="${cur===k}"><img src="${fimg(img)}" alt=""><span>${esc(t("tier_"+k))} <b class="num">${k==="budget"?(getBudget()?esc(money(getBudget()))+" "+esc(t("per_month")):""):"≈ "+esc(money(cost[k]))+" "+esc(t("per_month"))}</b><small>${esc(k==="budget"?t("budget_hint"):t("tier_"+k+"_d"+(isTayb()?"_t":"")))}</small></span></button>`;
  let status="";
  if(cur==="budget"&&getBudget()>0){ const mc=weekAvgCost(S.week)*30; const b=getBudget();
    status=mc<=b+0.5?`<p class="bstatus good">${esc(lastBudgetMsg?lastBudgetMsg+" ":"")}${esc(t("budget_ok",{cost:money(mc),b:money(b),left:money(b-mc)}))}</p>`:`<p class="bstatus warn">${esc(lastBudgetMsg?lastBudgetMsg+" ":"")}${esc(t("budget_over",{cost:money(mc),b:money(b)}))}</p>`; }
  return `<section class="card"><h3><img src="img/food/money_bag.webp" alt="">${esc(t("tier_title"))}</h3>
    <div class="tiergrid">${chip("eco","beans")}${chip("std","poultry_leg")}${chip("prem","sushi")}${chip("budget","money_bag")}</div>
    ${cur==="budget"?`<div class="row" style="margin-top:12px;align-items:flex-end"><label class="f" for="budgetIn">${esc(t("budget_label"))}<span class="unitbox"><input class="in num" id="budgetIn" type="number" min="0" step="50" inputmode="numeric" value="${getBudget()||""}" placeholder="${S.country==="sa"?"1500":"6000"}"><i>${esc(t("cur_"+S.country))}</i></span></label><button class="btn pri" data-budgetgo><img src="img/food/sparkles.webp" alt="">${esc(t("auto_plan"))}</button></div>`:""}
    ${status}</section>`;
}
const wdName=i=>(PI.T.wd[S.lang]||PI.T.wd.en)[i];
function dayHeadline(ms){const mains=ms.filter(m=>m.k!=="breakfast"&&m.k!=="snack").map(m=>m.items.find(it=>F[it.f]&&F[it.f].cat==="protein")).filter(Boolean).map(it=>nm(F[it.f]));
  return [...new Set(mains)].slice(0,3).join(" · ");}
function weekCard(){
  const T=targets(); const tots=S.week.map(ms=>sumItems(ms.flatMap(m=>m.items)));
  const wk=tots.reduce((a,x)=>a+x.cost,0); const distinct=new Set(S.week.flatMap(ms=>ms.flatMap(m=>m.items.map(it=>it.f)))).size;
  const days=S.week.map((ms,i)=>{const x=tots[i]; const gym=S.gym.wd.includes(i); const off=Math.abs(x.k-T.kcal)>Math.max(120,T.kcal*.06);
    return `<button class="dayc" data-day="${i}" aria-pressed="${i===S.day}"><span class="dn">${esc(wdName(i))}${gym?`<img src="img/food/person_lifting_weights.webp" alt="${esc(t("gym_day"))}" title="${esc(t("gym_day"))}">`:""}</span>
      <span class="dk num ${off?"warn":""}">${fmt(x.k)} ${esc(t("kcal"))}</span><span class="dc num">${esc(money(x.cost))}</span><small>${esc(dayHeadline(ms)||t("empty_day"))}</small></button>`;}).join("");
  return `<section class="card"><h3><img src="img/food/calendar.webp" alt="">${esc(t("week_title"))}</h3>
    <p class="sub" style="margin-top:-4px">${esc(t("week_note"))}</p>
    <div class="weekstrip">${days}</div>
    <div class="wksum"><div><span>${esc(t("week_total"))}</span><b class="num">${esc(money(wk))}</b></div><div><span>${esc(t("week_avg"))}</span><b class="num">${esc(money(wk/7))}</b></div><div><span>${esc(t("month_cost"))}</span><b class="num">≈ ${esc(money(wk/7*30))}</b></div><div><span>${esc(t("week_variety"))}</span><b class="num">${distinct}</b></div></div>
    <div class="row" style="margin-top:10px"><span class="dayttl">${esc(t("editing_day",{d:wdName(S.day)}))}</span><button class="btn sm ghost" data-redoday>${esc(t("redo_day"))}</button></div></section>`;
}
function shopList(){
  const agg={}; S.week.forEach(ms=>ms.forEach(m=>m.items.forEach(it=>{const f=F[it.f]; if(!f) return; const a=agg[f.id]||(agg[f.id]={f,g:0}); a.g+=+it.g||0; })));
  // purchase weight: cooked foods are bought raw/dry (grams / yield); cooking oil listed separately
  let oil=0; S.week.forEach(ms=>ms.forEach(m=>m.items.forEach(it=>{oil+=calcItem(it).add;})));
  const order=["protein","carb","veg","fruit","fat","extra"];
  const rows=Object.values(agg).sort((a,b)=>order.indexOf(a.f.cat)-order.indexOf(b.f.cat)||b.g*priceOf(b.f)/b.f.y-a.g*priceOf(a.f)/a.f.y).map(a=>{const f=a.f; const buy=a.g/f.y;
    const qty=f.u&&f.u>=30&&f.y===1?`${fmt(Math.ceil(buy/f.u))} ${esc(f.un[S.lang]||f.un.en)}`:buy>=1000?`${r1(buy/1000)} ${esc(t("kg"))}`:`${fmt(Math.ceil(buy/10)*10)} ${esc(t("g"))}`;
    const cost=buy*priceOf(f)/1000;
    return `<tr><td><img src="${fimg(f.img)}" alt="">${esc(nm(f))}</td><td class="num">${qty}</td><td class="num">${esc(money(cost))}</td></tr>`;});
  const total=weekAvgCost(S.week)*7;
  if(oil>0) rows.push(`<tr><td><img src="${fimg(F.olive_oil.img)}" alt="">${esc(t("cook_oil"))}</td><td class="num">${fmt(Math.ceil(oil/10)*10)} ${esc(t("g"))}</td><td class="num">${esc(money(oil*PI.cookOil[S.country]/1000))}</td></tr>`);
  return `<section class="card"><details class="prices shop"><summary><img src="img/food/canned_food.webp" alt="">${esc(t("shop_title"))} · <span class="num">${esc(money(total))}</span></summary>
    <p class="note">${esc(t("shop_note"))}</p>
    <div class="ptable"><table><thead><tr><th>${esc(t("food"))}</th><th>${esc(t("shop_qty"))}</th><th>${esc(t("meal_cost"))}</th></tr></thead><tbody>${rows.join("")}</tbody></table></div></details></section>`;
}
function microCard(){
  const tot=microDay(); const R=rdaSet(); const low=[];
  const bars=PI.nutKeys.map((k,i)=>{const pct=tot[i]/R[k]*100; const isNa=k==="na"; const bad=isNa?pct>100:pct<70; if(!isNa&&pct<70) low.push(k);
    return `<div class="mb"><div class="top"><span>${esc(nm(PI.nutName[k]))}</span><b class="num" dir="ltr">${esc(fmtN(tot[i],k))} · ${Math.round(pct)}%</b></div><div class="bar"><div style="width:${Math.min(100,pct)}%;background:${isNa?(bad?"var(--tomato)":"var(--sea)"):bad?"var(--sun)":"var(--leaf)"}"></div></div></div>`;}).join("");
  const sugg=k=>PI.foods.filter(f=>PI.micro[f.id]&&!banned(f.id)).map(f=>[f,PI.micro[f.id][PI.nutKeys.indexOf(k)]/R[k]]).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([f])=>nm(f)).join("، ");
  const naI=PI.nutKeys.indexOf("na");
  const notes=[]; if(low.length) notes.push(t("micro_low",{n:low.map(k=>nm(PI.nutName[k])).join("، "),foods:[...new Set(low.slice(0,3).map(sugg).join("، ").split("، "))].slice(0,6).join("، ")}));
  if(tot[naI]>R.na) notes.push(t("micro_na_high",{v:Math.round(tot[naI])})); if(!notes.length) notes.push(t("micro_all_ok"));
  return `<section class="card"><h3><img src="img/food/sparkles.webp" alt="">${esc(t("micro_title"))} · ${esc(wdName(S.day))}</h3><p class="sub" style="margin-top:-4px">${esc(t("micro_note",{who:t(whoKey())}))}</p>
    <div class="microgrid">${bars}</div>${notes.map(x=>`<div class="tipbox" style="margin-top:10px">${esc(x)}</div>`).join("")}</section>`;
}
function renderFood(){
  const n=S.meals.length;
  const prices=PI.foods.map(f=>{const o=S.prices[f.id]||{}; return `<tr><td><img src="${fimg(f.img)}" alt="">${esc(nm(f))}</td>
    <td><input class="in num" data-price="${f.id}" data-c="sa" type="number" step="0.1" min="0" value="${o.sa??f.sa}"> <span class="src ${f.ss?"s":"e"}">${esc(t(f.ss?"sourced":"estimated"))}</span></td>
    <td><input class="in num" data-price="${f.id}" data-c="eg" type="number" step="1" min="0" value="${o.eg??f.eg}"> <span class="src ${f.es?"s":"e"}">${esc(t(f.es?"sourced":"estimated"))}</span></td></tr>`;}).join("");
  return `
  ${S.example?`<div class="banner"><img src="img/food/clipboard.webp" alt=""><p>${esc(t("example_note"))}</p></div>`:""}
  ${goalStrip()}
  <section class="card"><div class="toolbar">
    <label class="f" for="mealsN">${esc(t("meals_count"))}<select class="in" id="mealsN" style="width:110px">${[2,3,4,5,6].map(k=>`<option ${k===n?"selected":""}>${k}</option>`).join("")}</select></label>
    <button class="btn pri" data-auto><img src="img/food/sparkles.webp" alt="">${esc(t("auto_plan"))}</button>
    <button class="btn ghost" data-clear>${esc(t("clear_all"))}</button>
    <span class="sub" style="margin-inline-start:auto">${esc(nm(PI.goals[S.p.goal]))} · ${esc(t("goal_kcal_line",{kcal:fmt(targets().kcal),p:targets().P}))}</span>
  </div></section>
  ${styleCard()}
  ${tierCard()}
  ${weekCard()}
  ${S.meals.map(mealCard).join("")}
  ${microCard()}
  ${shopList()}
  ${linkBanner("gym")}
  <section class="card"><details class="prices"><summary>${esc(t("my_prices"))} · ${esc(t("price_per_kg"))}</summary>
    <p class="note">${esc(t("price_note"))}</p>
    <div class="ptable"><table><thead><tr><th>${esc(t("food"))}</th><th>${FLAG.sa} ${esc(t("cur_sa"))}</th><th>${FLAG.eg} ${esc(t("cur_eg"))}</th></tr></thead><tbody>${prices}</tbody></table></div>
    <button class="btn sm" data-resetprices style="margin-top:10px">${esc(t("reset_prices"))}</button></details></section>`;
}
function refreshMealNums(mi){
  const m=S.meals[mi]; const card=$(`[data-meal="${mi}"]`); if(!card) return;
  m.items.forEach((it,ii)=>{const x=calcItem(it); const el=$(`.it[data-ii="${ii}"] [data-nums]`,card); if(el) el.innerHTML=`<b>${fmt(x.k)}</b> ${esc(t("kcal"))}<br><span style="color:var(--mP)">P ${r0(x.p)}</span> · <span>C ${r0(x.c)}</span> · <span style="color:var(--mF)">F ${r0(x.f)}</span><br><span class="sub">${esc(money(x.cost))}</span>`;
    const f=F[it.f]; const h=$(`.it[data-ii="${ii}"] .hint`,card); if(h&&f.u) h.textContent=t("units_hint",{n:r1(it.g/f.u),u:f.un[S.lang]||f.un.en});});
  $("[data-tot]",card).innerHTML=totPills(sumItems(m.items));
  renderRail(); renderHero();
}

/* ---------------- GYM ---------------- */
const exImg=(id)=>`img/x/${id}.${PI.ex[id]&&PI.ex[id].ill?"svg":"jpg"}`;
function altBlock(id,ctx){
  const al=alts(id); const miss=isMiss(id);
  const eqn=a=>PI.equip[PI.ex[a].eq]?nm(PI.equip[PI.ex[a].eq]):PI.ex[a].eq;
  return `<details class="alts"><summary>${esc(t("alts_title"))} (${al.length})</summary>
    <div class="altl">${al.map(a=>`<div class="alt"><img class="f2" src="${exImg(a)}" alt="" loading="lazy"><div><b>${esc(nm(PI.ex[a]))}</b><span>${esc(eqn(a))} · ${esc(t(PI.ex[a].at==="bw"?"lib_bw":PI.ex[a].sty==="m"?"sty_m":"sty_f"))}</span></div>${ctx==="prog"?`<button class="btn sm" data-swap="${id}|${a}">${esc(t("use_alt"))}</button>`:`<a class="yt sm" href="${ytUrl(a)}" target="_blank" rel="noopener">${esc(t("video"))}</a>`}</div>`).join("")}</div>
    <button class="btn sm ${miss?"pri":"ghost"}" data-miss="${id}">${esc(t(miss?"back_in_gym":"not_in_gym"))}</button></details>`;
}
function exCard(e,ctx){
  ctx=ctx||"prog";
  const x=PI.ex[e.id]; const mm=exMuscles(e.id); const st=steps(e.id);
  const needTr=(S.lang==="hi"||S.lang==="bn")&&!(S.tr[S.lang]&&S.tr[S.lang][e.id]);
  const eqn=PI.equip[x.eq]?nm(PI.equip[x.eq]):x.eq;
  return `<div class="exc">
    <div class="shot"><img class="f1" src="${exImg(e.id)}" alt="${esc(nm(x))}" loading="lazy"><img class="b f2" src="${exImg(e.id)}" alt="" loading="lazy"><span class="eqtag">${esc(t("the_equipment"))}: ${esc(eqn)}</span>${x.ill?`<span class="illtag">${esc(t("ill_tag"))}</span>`:""}</div>
    <div style="min-width:0"><h4>${esc(nm(x))} ${S.lang!=="en"?`<small>${esc(x.n.en)}</small>`:""}</h4>
      ${e.sets?`<div class="dose num"><span class="r">${e.sets} × ${esc(e.reps)}</span><span>${esc(t("rest"))} ${e.rest>=120?r1(e.rest/60)+" "+t("min"):e.rest+" "+t("sec")}</span><span>RPE ${e.rpe}</span>${e.tech?`<span class="tech">${esc(t("tech_"+e.tech))}</span>`:""}${e.focus?`<span class="tech">${esc(t("focus_extra"))}</span>`:""}</div>`:`<div class="dose"><span>${esc(t(x.sty==="m"?"sty_m":x.at==="bw"?"lib_bw":"sty_f"))}</span>${unsafe(e.id)?`<span class="r">${esc(t("lib_unsafe"))}</span>`:""}</div>`}
      <div class="mtags"><span class="p">${esc(t("primary_m"))}: ${mm.prim.map(g=>esc(nm(PI.muscles[g]))).join("، ")}</span>${mm.sec.length?`<span class="s">${esc(t("secondary_m"))}: ${mm.sec.map(g=>esc(nm(PI.muscles[g]))).join("، ")}</span>`:""}</div>
      <details><summary>${esc(t("technique"))}</summary><ol>${st.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>
        ${S.lang==="ar"&&x.m?`<div class="mist"><b>${esc(t("mistake"))}:</b> ${esc(x.m)}</div>`:""}
        ${needTr?`<button class="btn sm sun" data-tr="${e.id}"><img src="img/food/robot.webp" alt="">${esc(t("translate_ai"))}</button>`:""}</details>
      <div class="links"><a class="yt" href="${ytUrl(e.id)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>${esc(t("watch_youtube"))}</a></div>
      ${altBlock(e.id,ctx)}
    </div>
    ${bodyMap(mm.prim,mm.sec,52)}
  </div>`;
}
function dayCard(d,i){
  const wd=(PI.T.wd[S.lang]||PI.T.wd.en)[d.wd];
  const mins=Math.round(d.ex.reduce((a,e)=>a+e.sets*(0.9+e.rest/60),0)+8+(d.cardio?d.cardio.min:0));
  return `<section class="card dayc"><div class="dayc-h"><span class="dn num">${i+1}</span><div><h3>${esc(wd)} · ${esc(d.title)}</h3></div>
    <span class="meta">${esc(t("exercises_n",{n:d.ex.length}))} · ${esc(t("about_min",{n:mins}))}</span></div>
    <div class="cardio" style="background:var(--sun-soft)"><img src="img/food/fire.webp" alt=""><span>${esc(t(classicOn()?"classic_warm":"warmup"))}</span></div>
    <div class="exl">${d.ex.map(e=>exCard(e,"prog")).join("")}</div>
    ${d.cardio?`<div class="cardio"><img src="img/food/person_running.webp" alt=""><span><b>${esc(t("cardio_finish"))}:</b> ${esc(nm(PI.ex[d.cardio.id]))} · ${d.cardio.min} ${esc(t("min"))}</span><a class="yt" style="margin-inline-start:auto" href="${ytUrl(d.cardio.id)}" target="_blank" rel="noopener">${esc(t("video"))}</a></div>`:""}
  </section>`;
}
function renderLibrary(){
  const L=S.gym.lib||(S.gym.lib={m:"glutes",t:"all"});
  const mus=Object.keys(PI.muscles).map(k=>{const n=EXIDS.filter(id=>PI.ex[id].g===k).length; return `<button class="mbtn" data-libm="${k}" aria-pressed="${L.m===k}">${muscleThumb(k,84)}<span>${esc(nm(PI.muscles[k]))} <small class="num">(${n})</small></span></button>`;}).join("");
  const types=["all","m","f","bw"].map(k=>`<button data-libt="${k}" aria-pressed="${L.t===k}">${esc(t(k==="all"?"lib_all":k==="m"?"sty_m":k==="f"?"sty_f":"lib_bw"))}</button>`).join("");
  const list=EXIDS.filter(id=>{const e=PI.ex[id]; if(e.g!==L.m) return false;
    if(L.t==="m") return e.sty==="m"; if(L.t==="bw") return e.at==="bw"; if(L.t==="f") return e.sty==="f"&&e.at!=="bw"; return true;})
    .sort((a,b)=>({m:0,f:1}[PI.ex[a].sty]-{m:0,f:1}[PI.ex[b].sty])||(PI.ex[a].at==="bw")-(PI.ex[b].at==="bw"));
  return `<section class="card"><h3><img src="img/food/flexed_biceps.webp" alt="">${esc(t("pick_muscle_lib"))}</h3><div class="mgrid">${mus}</div>
    <label class="f" style="margin-top:14px">${esc(t("sty_label"))}<span class="radio" role="group">${types}</span></label></section>
  <section class="card dayc"><div class="dayc-h"><div><h3>${esc(nm(PI.muscles[L.m]))}</h3></div><span class="meta">${esc(t("exercises_n",{n:list.length}))}</span></div>
    <div class="exl">${list.length?list.map(id=>exCard({id},"lib")).join(""):`<div class="empty">${esc(t("lib_empty"))}</div>`}</div></section>`;
}
function renderGym(){
  const g=S.gym; const wdn=PI.T.wd[S.lang]||PI.T.wd.en;
  const dayBtns=wdn.map((d,i)=>`<button class="daybtn" data-wd="${i}" aria-pressed="${g.wd.includes(i)}">${esc(d)}</button>`).join("");
  const quick=[2,3,4,5,6].map(n=>`<button class="btn sm ${g.wd.length===n?"pri":""}" data-quick="${n}">${esc(t("days_n",{n}))}</button>`).join("");
  const eq=["gym","db","bw"].map(k=>`<button data-eq="${k}" aria-pressed="${g.eq===k}">${esc(t("eq_"+k))}</button>`).join("");
  const lv=["beg","int","adv"].map(k=>`<button data-lvl="${k}" aria-pressed="${g.level===k}">${esc(t("lvl_"+k))}</button>`).join("");
  const gg=[["hypertrophy","flexed_biceps"],["strength","person_lifting_weights"],["fatburn","fire"],["endurance","running_shoe"],["tone","sweat_droplets"]].map(([k,i])=>`<button class="chip" data-gg="${k}" aria-pressed="${g.gg===k}"><img src="img/food/${i}.webp" alt="">${esc(t("gg_"+k))}</button>`).join("");
  const mus=Object.keys(PI.muscles).map(k=>`<button class="mbtn" data-mus="${k}" aria-pressed="${g.muscles.includes(k)}">${muscleThumb(k,84)}<span>${esc(nm(PI.muscles[k]))}</span></button>`).join("");
  const prog=program();
  let warn="";
  if(!g.wd.length) warn=t("need_day"); else if(g.mode==="custom"&&!g.muscles.length) warn=t("need_muscle");
  const care=isPreg()?t("preg_gym"):isPost()?t("post_gym"):"";
  const modes=`<div class="radio" role="tablist" style="margin-bottom:14px"><button data-gmode="general" aria-pressed="${g.mode==="general"}">${esc(t("gym_general"))}</button><button data-gmode="custom" aria-pressed="${g.mode==="custom"}">${esc(t("gym_custom"))}</button><button data-gmode="library" aria-pressed="${g.mode==="library"}">${esc(t("gym_library"))}</button></div>`;
  if(g.mode==="library") return `${care?`<div class="banner care"><img src="${fimg(isPreg()?"seedling":"glass_of_milk")}" alt=""><p>${esc(care)}</p></div>`:""}<section class="card">${modes}<p class="sub" style="margin:0">${esc(t("lib_desc"))}</p></section>${renderLibrary()}`;
  return `
  ${care?`<div class="banner care"><img src="${fimg(isPreg()?"seedling":"glass_of_milk")}" alt=""><p>${esc(care)}</p></div>`:""}
  ${goalStrip()}
  <section class="card">${modes}
    <h3><img src="img/food/calendar.webp" alt="">${esc(t("pick_days"))}</h3>
    <div class="days">${dayBtns}</div><div class="row" style="margin-top:8px">${quick}</div>
    <div class="grid2" style="margin-top:14px">
      <label class="f">${esc(t("equipment"))}<span class="radio" role="group">${eq}</span></label>
      <label class="f">${esc(t("level"))}<span class="radio" role="group">${lv}</span></label>
    </div>
    ${g.mode==="general"?`<label class="f" style="margin-top:12px">${esc(t("split_label"))}<span class="radio" role="group">${["auto","classic"].map(k=>`<button data-split="${k}" aria-pressed="${(g.split||"auto")===k}">${esc(t("split_"+k))}</button>`).join("")}</span></label>`:""}
    ${(g.miss||[]).length?`<div class="missbox"><b>${esc(t("missing_n",{n:g.miss.length}))}</b> ${g.miss.map(id=>`<button class="chip sm" data-unmiss="${id}">${esc(nm(PI.ex[id]))} ✕</button>`).join("")} <button class="btn sm ghost" data-unmissall>${esc(t("restore_all"))}</button></div>`:""}
    ${g.eq==="gym"?`<label class="f" style="margin-top:12px">${esc(t("sty_label"))}<span class="radio" role="group">${["mix","m","f"].map(k=>`<button data-sty="${k}" aria-pressed="${(g.sty||"mix")===k}">${esc(t("sty_"+k))}</button>`).join("")}</span></label>`:""}
    <h3 style="margin-top:16px"><img src="img/food/bullseye.webp" alt="">${esc(t("gym_goal"))}</h3><div class="chips">${gg}</div>
    ${g.mode==="custom"?`
      <h3 style="margin-top:16px"><img src="img/food/flexed_biceps.webp" alt="">${esc(t("target_muscles"))}</h3><p class="sub" style="margin:-6px 0 8px">${esc(t("pick_muscles_hint"))}</p>
      <div class="mgrid">${mus}</div>
      <h3 style="margin-top:16px"><img src="img/food/fire.webp" alt="">${esc(t("load"))}</h3>
      <div class="load"><input type="range" id="loadR" min="1" max="5" step="1" value="${g.load}" aria-label="${esc(t("load"))}"><b>${esc(t("load_"+g.load))}</b></div>`:""}
  </section>
  ${focusCard()}
  ${warn?`<div class="banner"><p>${esc(warn)}</p></div>`:`
  <section class="card"><h3><img src="img/food/calendar.webp" alt="">${esc(t("your_week"))}</h3>
    <div class="week">${wdn.map((d,i)=>{const pd=prog.find(x=>x.wd===i); return `<div class="wk ${pd?"on":""}"><b>${esc(d)}</b><span>${esc(pd?pd.title:t("rest_day"))}</span></div>`;}).join("")}</div>
    <p class="note" style="margin:10px 0 0">${esc(t("progress_rule"))}</p></section>
  ${prog.map(dayCard).join("")}
  ${linkBanner("gym")}`}`;
}

/* ---------------- EXPORT ---------------- */
function renderExport(){
  return `<section class="card"><h3><img src="img/food/clipboard.webp" alt="">${esc(t("export_title"))}</h3><p class="sub">${esc(t("export_desc"))}</p>
    <div class="exp" style="margin-top:12px">
      <div class="card expc"><img src="img/food/green_salad.webp" alt=""><b>${esc(t("report_food"))}</b><span class="sub num">${esc(t("week_days7"))} · ${S.meals.length} ${esc(t("meals_word"))}</span><button class="btn pri" data-export="food">${esc(t("export_food"))}</button></div>
      <div class="card expc"><img src="img/food/person_lifting_weights.webp" alt=""><b>${esc(t("report_gym"))}</b><span class="sub">${esc(t("days_n",{n:gymDays()}))} · ${esc(t("gg_"+S.gym.gg))}</span><button class="btn pri" data-export="gym">${esc(t("export_gym"))}</button></div>
      <div class="card expc"><img src="img/food/trophy.webp" alt=""><b>${esc(t("export_all"))}</b><span class="sub">PDF · A4</span><button class="btn sun" data-export="all">${esc(t("export_all"))}</button></div>
    </div>
    <div class="prog-x" id="expBar" hidden style="margin-top:14px"><div></div></div><p class="sub" id="expMsg" role="status"></p></section>`;
}

/* ---------------- render ---------------- */
function render(){
  applyChrome(); renderHero(); renderRail();
  const P=$("#panel"); const tab=S.tab;
  P.innerHTML=tab==="profile"?renderProfile():tab==="body"?(PI.body?PI.body.render():""):tab==="food"?renderFood():tab==="gym"?renderGym():renderExport();
  save();
}
function setTab(k){S.tab=k; render(); try{history.replaceState(null,"","#"+k);}catch(e){} window.scrollTo({top:$(".tabs").offsetTop,behavior:"smooth"});}

/* ---------------- events ---------------- */
document.addEventListener("click",async ev=>{
  const b=ev.target.closest("button"); if(!b) return;
  const d=b.dataset;
  if(d.tab) return setTab(d.tab);
  if(d.themeSet){S.theme=d.themeSet; return render();}
  if(d.cty){S.country=d.cty; return render();}
  if(d.sex){S.p.sex=d.sex; return render();}
  if(d.fs){S.p.fs=d.fs; return render();}
  if(d.bf){S.p.bf=d.bf==="1"; return render();}
  if(d.sty){S.gym.sty=d.sty; return render();}
  if(d.goal){S.p.goal=d.goal; return render();}
  if(d.zone){const z=d.zone, a=S.p.zones||[]; S.p.zones=a.includes(z)?a.filter(x=>x!==z):a.concat(z); return render();}
  if(d.zparse!=null){const v=($("#zoneText")||{}).value||""; S.p.goalText=v; const z=parseZones(v); if(z.length){S.p.zones=z; render(); toast(t("zones_parsed",{z:z.map(k=>nm(PI.zones[k])).join("، ")}),6000);} else {render(); toast(t("zones_none"));} return;}
  if(d.goalapply!=null) return applyGoal();
  if(d.mode){S.p.mode=d.mode; return render();}
  if(d.link==="food2gym"){const G=PI.goals[S.p.goal]; S.gym.gg=G.gym; S.gym.wd=WD_PATTERN[G.days].slice(); S.gym.mode="general"; S.tab="gym"; render(); toast(t("linked_gym_done",{gym:t("gg_"+G.gym),days:G.days,goal:nm(G)})); return;}
  if(d.link==="gym2food"){const map={hypertrophy:"lean_gain",strength:"lean_gain",fatburn:"fat_loss",endurance:"endurance",tone:"cut"}; S.p.goal=map[S.gym.gg]||"recomp"; S.p.link=true; S.p.mode="auto";
    buildPlan(planN()); S.tab="food"; render(); toast(t("linked_food_done",{goal:nm(PI.goals[S.p.goal]),days:gymDays()})); return;}
  if(d.style){const v=d.style==="tayyibat"?"tayyibat":"normal"; if((S.p.style||"normal")===v) return; S.p.style=v; ui={alt:null,nut:null};
    const n=v==="tayyibat"?(S.meals.length>3?2:S.meals.length):Math.max(3,S.meals.length<3?4:S.meals.length);
    buildPlan(n); render(); toast(lastBudgetMsg||t(v==="tayyibat"?"style_set_tayb":"style_set_normal",{n}),7000); return;}
  if(d.day!=null){syncWeek(); S.day=+d.day; S.meals=S.week[S.day]; ui={alt:null,nut:null}; render(); const el=$(".weekstrip"); if(el) el.scrollIntoView({block:"nearest"}); return;}
  if(d.redoday!=null){const tk=S.p.tierUsed||"std"; const n=S.meals.length||4; S.redo=((S.redo||0)%5)+1; const ms=makePlan(n,tk,S.day,S.redo);
    if(S.p.tier==="budget"&&getBudget()>0){const lim=getBudget()/30; optimizeForBudget(ms,lim); fitCalories(ms); optimizeForBudget(ms,lim); fitCalories(ms);}
    S.meals=ms; S.week[S.day]=ms; S.example=false; ui={alt:null,nut:null}; render(); toast(t("day_redone",{d:wdName(S.day)})); return;}
  if(d.auto!=null){buildPlan(S.meals.length); render(); toast(lastBudgetMsg||t("week_built")); return;}
  if(d.tier){S.p.tier=d.tier; ui={alt:null,nut:null}; if(d.tier!=="budget"||getBudget()>0){buildPlan(S.meals.length); render(); toast(lastBudgetMsg||t("week_built"));} else render(); return;}
  if(d.budgetgo!=null){const v=+($("#budgetIn")||{}).value; if(v>0) setBudget(v); buildPlan(S.meals.length); render(); toast(lastBudgetMsg||t("week_built")); return;}
  if(d.falt!=null||d.fnut!=null){const row=b.closest(".it"); const key=row.dataset.mi+"-"+row.dataset.ii; if(d.falt!=null){ui.alt=ui.alt===key?null:key; ui.nut=null;} else {ui.nut=ui.nut===key?null:key; ui.alt=null;} return render();}
  if(d.fswap){const [mi,ii,id,g]=d.fswap.split("|"); S.meals[+mi].items[+ii]={f:id,g:+g,m:defMethod(F[id])}; ui.alt=null; S.example=false; render(); toast(t("swapped")); return;}
  if(d.clear!=null){S.meals=(MEALKEYS[S.meals.length]||MEALKEYS[4]).map(k=>({k,t:MEALTIME[k],items:[]})); S.week[S.day]=S.meals; S.example=false; return render();}
  const mealEl=b.closest("[data-meal]");
  if(d.add!=null&&mealEl){const mi=+mealEl.dataset.meal; const f=isTayb()?F.beef_lean:F.chicken_breast; S.meals[mi].items.push({f:f.id,g:150,m:defMethod(f)}); S.example=false; return render();}
  if(d.del!=null){ui={alt:null,nut:null};const row=b.closest(".it"); S.meals[+row.dataset.mi].items.splice(+row.dataset.ii,1); S.example=false; return render();}
  if(d.ai!=null&&mealEl) return aiTip(+mealEl.dataset.meal,mealEl);
  if(d.resetprices!=null){S.prices={}; return render();}
  if(d.gmode){S.gym.mode=d.gmode; return render();}
  if(d.split){S.gym.split=d.split; return render();}
  if(d.swap){const [a,b]=d.swap.split("|"); S.gym.swap=Object.assign({},S.gym.swap,{[a]:b}); render(); toast(t("swapped")); return;}
  if(d.miss){const id=d.miss; const m=S.gym.miss||[]; const was=m.includes(id); S.gym.miss=was?m.filter(x=>x!==id):m.concat(id); render(); if(!was) toast(t("marked_missing")); return;}
  if(d.unmiss){S.gym.miss=(S.gym.miss||[]).filter(x=>x!==d.unmiss); return render();}
  if(d.unmissall!=null){S.gym.miss=[]; S.gym.swap={}; return render();}
  if(d.libm){S.gym.lib=Object.assign({t:"all"},S.gym.lib,{m:d.libm}); return render();}
  if(d.libt){S.gym.lib=Object.assign({m:"glutes"},S.gym.lib,{t:d.libt}); return render();}
  if(d.wd){const i=+d.wd; const w=S.gym.wd; S.gym.wd=w.includes(i)?w.filter(x=>x!==i):w.concat(i).sort((a,b)=>a-b); return render();}
  if(d.quick){S.gym.wd=WD_PATTERN[+d.quick].slice(); return render();}
  if(d.eq){S.gym.eq=d.eq; return render();}
  if(d.lvl){S.gym.level=d.lvl; return render();}
  if(d.gg){S.gym.gg=d.gg; return render();}
  if(d.mus){const m=d.mus, a=S.gym.muscles; S.gym.muscles=a.includes(m)?a.filter(x=>x!==m):a.concat(m); return render();}
  if(d.tr) return translateSteps(d.tr,b);
  if(d.export) return exportPdf(d.export);
});
document.addEventListener("input",ev=>{
  const el=ev.target;
  if(el.id==="zoneText"){S.p.goalText=el.value; save(); return;}
  if(el.dataset.p){const k=el.dataset.p;
    // while typing: keep what the person typed, update numbers live only for a usable value, never re-render the field
    if(el.type==="number"){const raw=el.value.trim(); if(raw===""||isNaN(+raw)) return; const v=+raw, lo=+el.min||0, hi=+el.max||1e9; if(v<lo||v>hi) return; S.p[k]=v;}
    else S.p[k]=el.value;
    renderHero(); renderRail(); save(); return;}
  const row=el.closest&&el.closest(".it");
  if(row&&el.dataset.k==="g"){const mi=+row.dataset.mi, ii=+row.dataset.ii; S.meals[mi].items[ii].g=+el.value||0; S.example=false; refreshMealNums(mi); save(); return;}
  if(el.dataset.price){const id=el.dataset.price,c=el.dataset.c; S.prices[id]=Object.assign({},S.prices[id],{[c]:el.value===""?null:+el.value}); renderRail(); renderHero(); save(); return;}
  if(el.id==="loadR"){S.gym.load=+el.value; clearTimeout(el._t); el._t=setTimeout(render,250); return;}
});
document.addEventListener("change",ev=>{
  {const el=ev.target; if(el.dataset&&el.dataset.p&&el.type==="number"){const k=el.dataset.p; const raw=el.value.trim();
    if(k==="tw"&&raw===""){S.p.tw=0; return render();}
    if(raw===""||isNaN(+raw)){el.value=S.p[k]||""; return;}
    const lo=+el.min||0, hi=+el.max||1e9; const v=Math.min(hi,Math.max(lo,+raw)); S.p[k]=v; if(+raw!==v) toast(t("range_fixed",{v}));
    return render();}}
  const el=ev.target;
  if(el.id==="langSel"){S.lang=el.value; return render();}
  if(el.id==="pLink"){S.p.link=el.checked; return render();}
  if(el.id==="pUseR"){S.p.useR=el.checked; return render();}
  if(el.id==="pAct"){S.p.act=+el.value; return render();}
  if(el.id==="pTri"){S.p.tri=+el.value; return render();}
  if(el.id==="budgetIn"){setBudget(+el.value||null); save(); return;}
  if(el.id==="mealsN"){const n=+el.value; syncWeek(); buildPlan(n); render(); toast(lastBudgetMsg||t("week_built")); return;}
  if(el.dataset.time!=null){const mi=+el.closest("[data-meal]").dataset.meal; S.meals[mi].t=el.value; return save();}
  const row=el.closest&&el.closest(".it");
  if(row){const mi=+row.dataset.mi, ii=+row.dataset.ii; const it=S.meals[mi].items[ii];
    if(el.dataset.k==="f"){it.f=el.value; const f=F[it.f]; it.m=defMethod(f); if(f.u&&it.g<f.u) it.g=f.u; S.example=false; return render();}
    if(el.dataset.k==="m"){it.m=el.value; return render();}
    if(el.dataset.k==="g"){return render();}
  }
  if(el.dataset.price) return render();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(!S.theme) applyChrome();});

/* ---------------- smart (Claude) features ---------------- */
const LANGNAME={ar:"Arabic",en:"English",hi:"Hindi",bn:"Bengali"};
async function aiTip(mi,card){
  const out=$("[data-aiout]",card), btn=$("[data-ai]",card); out.hidden=false;
  const sample=await use("sample");
  if(!sample){out.textContent=t("ai_off"); return;}
  const m=S.meals[mi];
  const list=m.items.map(it=>{const f=F[it.f]; return `- ${f.n.en}: ${it.g} g (${f.st} weight), method: ${PI.methods[it.m].n.en}`;}).join("\n");
  const s=sumItems(m.items);
  const prompt=`You are a sports-nutrition chef. Write in ${LANGNAME[S.lang]} only.
Meal: ${t("meal_"+m.k)} for someone whose goal is "${PI.goals[S.p.goal].n.en}".
Ingredients (keep these foods and amounts):
${list}
Current totals: ${r0(s.k)} kcal, protein ${r0(s.p)} g, carbs ${r0(s.c)} g, fat ${r0(s.f)} g.
Give a healthy way to prepare this exact meal: 4–6 short numbered steps with seasonings, temperatures and times, then one line starting with "+" suggesting a smart swap or addition that improves it without adding more than 50 kcal. Plain text, no markdown headings, no bold, under 140 words.`;
  btn.disabled=true; out.textContent=t("ai_working");
  try{
    const r=await sample(prompt,{modelTier:"quick",onText:({text})=>{out.textContent=text;}});
    out.textContent=r.text;
  }catch(e){out.textContent=e&&e.code==="rate_limited"?t("ai_busy"):t("ai_off");}
  btn.disabled=false;
}
async function translateSteps(id,btn){
  const sample=await use("sample"); const L=S.lang;
  if(!sample){toast(t("ai_off")); return;}
  btn.disabled=true; const old=btn.innerHTML; btn.textContent=t("ai_working");
  try{
    const arr=await sample.json(`Translate these exercise technique steps into ${LANGNAME[L]}. Keep them short and clear for a gym user. Return only a JSON array of strings, same order.\n${JSON.stringify(PI.exEn[id])}`,{modelTier:"quick"});
    if(Array.isArray(arr)&&arr.length){S.tr[L]=S.tr[L]||{}; S.tr[L][id]=arr.map(String); render();}
  }catch(e){toast(e&&e.code==="rate_limited"?t("ai_busy"):t("ai_off")); btn.disabled=false; btn.innerHTML=old;}
}

/* ---------------- PDF export ---------------- */
let libsP=null;
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);});}
function loadLibs(){
  if(window.jspdf&&window.htmlToImage) return Promise.resolve();
  return libsP||(libsP=Promise.all([
    window.jspdf?0:loadScript(window.PI_LIB_JSPDF||"https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"),
    window.htmlToImage?0:loadScript(window.PI_LIB_H2I||"https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js")
  ]));
}
function pageShell(title,pn){
  const today=new Date().toISOString().slice(0,10);
  const el=document.createElement("div"); el.className="pg"; el.dir=PI.langs[S.lang].dir; el.lang=S.lang;
  el.innerHTML=`<div class="pg-h"><img src="img/logo.svg" alt=""><h1>${esc(t("brand"))} · ${esc(title)}</h1><span class="num">${esc(t("generated"))} ${today}</span></div><div class="pg-b"></div><div class="pg-f"><span>${esc(t("credits"))}</span><span class="num" data-pn></span></div>`;
  return el;
}
function flow(container,title,blocks){
  const pages=[]; let pg=pageShell(title); container.appendChild(pg); pages.push(pg); let body=$(".pg-b",pg);
  blocks.forEach(html=>{
    const tmp=document.createElement("div"); tmp.innerHTML=html; const node=tmp.firstElementChild; body.appendChild(node);
    if(body.scrollHeight>body.clientHeight+1&&body.children.length>1){body.removeChild(node); pg=pageShell(title); container.appendChild(pg); pages.push(pg); body=$(".pg-b",pg); body.appendChild(node);}
  });
  return pages;
}
function foodBlocks(){
  const T=targets(), D=dayTotals(), p=S.p; const G=PI.goals[p.goal];
  const b=[];
  b.push(`<div class="rb"><h2>${esc(t("about_you"))} · ${esc(nm(G))}</h2>
    <div class="rk"><div><span>${esc(t("weight"))}</span><b class="num">${p.w} ${esc(t("kg"))}</b></div><div><span>${esc(t("height"))}</span><b class="num">${p.h} ${esc(t("cm"))}</b></div><div><span>${esc(t("age"))}</span><b class="num">${p.age}</b></div><div><span>${esc(t("train_days"))}</span><b class="num">${gymDays()}</b></div></div>
    <div class="rk" style="margin-top:8px"><div><span>${esc(t("bmr"))}</span><b class="num">${fmt(T.bmr)}</b></div><div><span>${esc(t("tdee"))}</span><b class="num">${fmt(T.tdee)}</b></div><div style="background:#1F9D57;color:#fff"><span style="color:#E3F7EA">${esc(t("daily_target"))}</span><b class="num">${fmt(T.kcal)}</b></div><div><span>${esc(t("planned"))}</span><b class="num">${fmt(D.k)}</b></div></div>
    <table class="rt" style="margin-top:8px"><thead><tr><th></th><th>${esc(t("target"))}</th><th>${esc(t("planned"))}</th></tr></thead><tbody>
      <tr><td>${esc(t("protein"))}</td><td class="num">${T.P} ${esc(t("g"))}</td><td class="num">${r0(D.p)} ${esc(t("g"))}</td></tr>
      <tr><td>${esc(t("carbs"))}</td><td class="num">${T.C} ${esc(t("g"))}</td><td class="num">${r0(D.c)} ${esc(t("g"))}</td></tr>
      <tr><td>${esc(t("fat"))}</td><td class="num">${T.F} ${esc(t("g"))}</td><td class="num">${r0(D.f)} ${esc(t("g"))}</td></tr>
      <tr><td>${esc(t("day_cost"))}</td><td class="num">${FLAG.sa} ${esc(money(dayTotals("sa").cost,"sa"))}</td><td class="num">${FLAG.eg} ${esc(money(dayTotals("eg").cost,"eg"))}</td></tr></tbody></table></div>`);
  {const gb=goalBlock(); if(gb) b.push(gb);}
  syncWeek();
  {const tots=S.week.map(ms=>sumItems(ms.flatMap(m=>m.items))); const wk=tots.reduce((a,x)=>a+x.cost,0);
   if(isTayb()) b.push(`<div class="rb" style="background:#FFE1DB;border:0"><h3>${esc(t("style_tayyibat"))}</h3><p style="margin:0 0 4px">${esc(t("tayb_note"))}</p><p style="margin:0;font-weight:700">${esc(t("tayb_warn"))}</p></div>`);
   b.push(`<div class="rb"><h2>${esc(t("week_title"))} · ${esc(t(isTayb()?"style_tayyibat":"style_normal"))} · ${esc(t("tier_"+(S.p.tierUsed||S.p.tier||"std")))}</h2>
    <table class="rt"><thead><tr><th></th><th>${esc(t("kcal"))}</th><th>P / C / F</th><th>${esc(t("meal_cost"))}</th><th>${esc(t("week_main"))}</th></tr></thead><tbody>
    ${S.week.map((ms,i)=>`<tr><td style="font-weight:700">${esc(wdName(i))}${S.gym.wd.includes(i)?" 🏋":""}</td><td class="num">${fmt(tots[i].k)}</td><td class="num">${r0(tots[i].p)} / ${r0(tots[i].c)} / ${r0(tots[i].f)}</td><td class="num">${esc(money(tots[i].cost))}</td><td>${esc(dayHeadline(ms))}</td></tr>`).join("")}
    <tr style="font-weight:700"><td>${esc(t("week_total"))}</td><td></td><td></td><td class="num">${esc(money(wk))}</td><td class="num">≈ ${esc(money(wk/7*30))} ${esc(t("per_month"))}</td></tr></tbody></table></div>`);}
  S.week.forEach((ms,i)=>{
    const s=sumItems(ms.flatMap(m=>m.items));
    b.push(`<div class="rb"><h3>${esc(wdName(i))} <span class="num" style="font-weight:400;font-size:12px;color:#5A6D61">${fmt(s.k)} ${esc(t("kcal"))} · P ${r0(s.p)} · ${esc(money(s.cost))}</span></h3>
      <table class="rt"><thead><tr><th>${esc(t("meal"))}</th><th>${esc(t("food"))}</th><th>${esc(t("amount"))}</th><th>${esc(t("method"))}</th><th>${esc(t("kcal"))}</th><th>${esc(t("meal_cost"))}</th></tr></thead><tbody>
      ${ms.map(m=>m.items.map((it,ii)=>{const f=F[it.f],x=calcItem(it); return `<tr>${ii===0?`<td rowspan="${m.items.length}" style="font-weight:700;vertical-align:top">${esc(t("meal_"+m.k))}<br><span class="num" style="font-weight:400;color:#5A6D61">${esc(m.t||"")}</span></td>`:""}<td><img src="${fimg(f.img)}" alt="">${esc(nm(f))}</td><td class="num">${it.g}${f.u?` (≈${r1(it.g/f.u)} ${esc(f.un[S.lang]||f.un.en)})`:""}</td><td>${esc(nm(PI.methods[it.m]))}</td><td class="num">${fmt(x.k)}</td><td class="num">${esc(money(x.cost))}</td></tr>`;}).join("")).join("")}
      </tbody></table></div>`);
  });
  {const agg={}; let oil=0; S.week.forEach(ms=>ms.forEach(m=>m.items.forEach(it=>{const f=F[it.f]; if(!f) return; agg[f.id]=(agg[f.id]||0)+(+it.g||0); oil+=calcItem(it).add;})));
   const order=["protein","carb","veg","fruit","fat","extra"]; const ids=Object.keys(agg).sort((a,b)=>order.indexOf(F[a].cat)-order.indexOf(F[b].cat));
   const cell=id=>{const f=F[id], buy=agg[id]/f.y; const q=f.u&&f.u>=30&&f.y===1?`${fmt(Math.ceil(buy/f.u))} ${esc(f.un[S.lang]||f.un.en)}`:buy>=1000?`${r1(buy/1000)} ${esc(t("kg"))}`:`${fmt(Math.ceil(buy/10)*10)} ${esc(t("g"))}`; return `<td>${esc(nm(f))}</td><td class="num">${q}</td><td class="num">${esc(money(buy*priceOf(f)/1000))}</td>`;};
   const rows=[]; for(let i=0;i<ids.length;i+=2) rows.push(`<tr>${cell(ids[i])}${ids[i+1]?cell(ids[i+1]):"<td></td><td></td><td></td>"}</tr>`);
   if(oil>0) rows.push(`<tr><td>${esc(t("cook_oil"))}</td><td class="num">${fmt(Math.ceil(oil/10)*10)} ${esc(t("g"))}</td><td class="num">${esc(money(oil*PI.cookOil[S.country]/1000))}</td><td></td><td></td><td></td></tr>`);
   b.push(`<div class="rb"><h3>${esc(t("shop_title"))} · <span class="num">${esc(money(weekAvgCost(S.week)*7))}</span></h3><p style="margin:0 0 6px;font-size:10.5px">${esc(t("shop_note"))}</p><table class="rt"><tbody>${rows.join("")}</tbody></table></div>`);}
  {const tot=PI.nutKeys.map(()=>0); S.week.forEach(ms=>ms.forEach(m=>m.items.forEach(it=>{const v=microOf(it); if(v) v.forEach((x,i)=>tot[i]+=x/7);}))); const R=rdaSet(); b.push(`<div class="rb"><h3>${esc(t("micro_title"))} · ${esc(t("week_avg_day"))} · ${esc(t("tier_"+(S.p.tierUsed||S.p.tier||"std")))}${getBudget()?` · ${esc(t("budget_label"))}: ${esc(money(getBudget()))}`:""}</h3><table class="rt"><tbody>${[0,1,2,3].map(r=>`<tr>${PI.nutKeys.slice(r*3,r*3+3).map(k=>{const i=PI.nutKeys.indexOf(k); return `<td>${esc(nm(PI.nutName[k]))}</td><td class="num" dir="ltr">${esc(fmtN(tot[i],k))} (${Math.round(tot[i]/R[k]*100)}%)</td>`;}).join("")}</tr>`).join("")}</tbody></table></div>`);}
  if(PI.body&&PI.body.pdfBlock){const bb=PI.body.pdfBlock(); if(bb) b.splice(1,0,bb);}
  const fnote=isPreg()?t("preg_note",{add:T.add,p:T.P}):isPost()?(p.bf?t("post_bf_note"):t("post_note")):"";
  if(fnote) b.splice(1,0,`<div class="rb" style="background:#FFF2C7;border:0"><p style="margin:0">${esc(fnote)}</p></div>`);
  b.push(`<div class="rb"><p style="margin:0;font-size:10.5px">${esc(t("price_note"))}</p></div>`);
  return b;
}
function gymBlocks(solo){
  const prog=program(); const wdn=PI.T.wd[S.lang]||PI.T.wd.en; const b=[];
  b.push(`<div class="rb"><h2>${esc(t(gymModeKey()))} · ${esc(t("gg_"+S.gym.gg))}</h2>
    <div class="rk"><div><span>${esc(t("train_days"))}</span><b class="num">${gymDays()}</b></div><div><span>${esc(t("level"))}</span><b>${esc(t("lvl_"+S.gym.level))}</b></div><div><span>${esc(t("split_label"))}</span><b style="font-size:13px">${esc(t("split_"+(S.gym.split||"auto")))}</b></div><div><span>${esc(t("equipment"))}</span><b style="font-size:14px">${esc(t("eq_"+S.gym.eq))}${S.gym.eq==="gym"?" · "+esc(t("sty_"+(S.gym.sty||"mix"))):""}</b></div><div><span>${esc(t("load"))}</span><b style="font-size:14px">${esc(t("load_"+(S.gym.mode==="custom"?S.gym.load:3)))}</b></div></div>
    <table class="rt" style="margin-top:8px"><tbody>${wdn.map((d,i)=>{const pd=prog.find(x=>x.wd===i); return `<tr><td style="width:90px;font-weight:700">${esc(d)}</td><td>${esc(pd?pd.title:t("rest_day"))}</td></tr>`;}).join("")}</tbody></table>
    ${(isPreg()||isPost())?`<div class="rtip" style="background:#FFE1DB">${esc(t(isPreg()?"preg_gym":"post_gym"))}</div>`:""}
    <div class="rtip">${esc(t("progress_rule"))}</div><div class="rtip" style="background:#FFF2C7">${esc(t(classicOn()?"classic_warm":"warmup"))}</div></div>`);
  if(solo){const gb=goalBlock(); if(gb) b.push(gb);}
  prog.forEach((d,i)=>{
    const head=`<div class="rday"><b class="num">${i+1}</b><span style="font-weight:700;font-size:14px">${esc(wdn[d.wd])} · ${esc(d.title)}</span></div>`;
    d.ex.forEach((e,ei)=>{const x=PI.ex[e.id]; const mm=exMuscles(e.id); const st=steps(e.id);
      b.push(`<div class="rgrp" style="display:flex;flex-direction:column;gap:12px">${ei===0?head:""}<div class="rex"><div class="ph2"><img class="f1" src="${exImg(e.id)}" alt=""><img class="f2" src="${exImg(e.id)}" alt=""></div>
        <div><h3>${esc(nm(x))}${S.lang!=="en"?` <span style="font-weight:400;font-size:10px;color:#5A6D61">${esc(x.n.en)}</span>`:""}</h3>
        <div class="dose num"><span class="r">${e.sets} × ${esc(e.reps)}</span><span>${esc(t("rest"))} ${e.rest} ${esc(t("sec"))}</span><span>RPE ${e.rpe}</span>${e.tech?`<span class="r">${esc(t("tech_"+e.tech))}</span>`:""}<span>${esc(t("the_equipment"))}: ${esc(nm(PI.equip[x.eq]||{n:{en:x.eq}}))}</span></div>
        <ol>${st.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>${S.lang==="ar"&&x.m?`<div style="font-size:10px;background:#FFE1DB;border-radius:6px;padding:3px 6px"><b>${esc(t("mistake"))}:</b> ${esc(x.m)}</div>`:""}
        <div style="font-size:9.5px;color:#5A6D61">${esc(t("alts_title"))}: ${alts(e.id).map(a=>esc(nm(PI.ex[a]))).join(" · ")}</div>
        <div class="ylink" data-url="${esc(ytUrl(e.id))}">▶ ${esc(t("video"))}: ${esc(ytUrl(e.id))}</div></div>
        ${bodyMap(mm.prim,mm.sec,42)}</div></div>`);});
    if(!d.ex.length) b.push(head);
    if(d.cardio) b.push(`<div class="rb" style="background:#D6F1F1;border:0"><b>${esc(t("cardio_finish"))}:</b> ${esc(nm(PI.ex[d.cardio.id]))} · ${d.cardio.min} ${esc(t("min"))}</div>`);
  });
  return b;
}
async function exportPdf(kind){
  const msg=$("#expMsg"), bar=$("#expBar");
  const dl=await use("downloads");
  $$("[data-export]").forEach(b=>b.disabled=true); bar.hidden=false; $("div",bar).style.width="4%";
  const rep=$("#rep"); rep.innerHTML="";
  try{
    await loadLibs(); await document.fonts.ready;
    let pages=[];
    if(kind==="food"||kind==="all") pages=pages.concat(flow(rep,t("report_food"),foodBlocks()));
    if(kind==="gym"||kind==="all") pages=pages.concat(flow(rep,t("report_gym"),gymBlocks(kind==="gym")));
    pages.forEach((p,i)=>{$("[data-pn]",p).textContent=(i+1)+" / "+pages.length;});
    await Promise.all($$("img",rep).map(im=>im.complete?0:new Promise(r=>{im.onload=im.onerror=r;})));
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:"p",unit:"mm",format:"a4",compress:true});
    for(let i=0;i<pages.length;i++){
      msg.textContent=t("exporting",{i:i+1,n:pages.length}); $("div",bar).style.width=(5+90*(i/pages.length))+"%";
      const url=await window.htmlToImage.toJpeg(pages[i],{quality:.88,pixelRatio:1.8,backgroundColor:"#ffffff",cacheBust:false,style:{position:"static",left:"0"}});
      if(i) pdf.addPage(); pdf.addImage(url,"JPEG",0,0,210,297,undefined,"FAST");
      const pr=pages[i].getBoundingClientRect(), k=210/pr.width;
      $$("[data-url]",pages[i]).forEach(a=>{const r=a.getBoundingClientRect(); try{pdf.link((r.left-pr.left)*k,(r.top-pr.top)*k,r.width*k,r.height*k,{url:a.dataset.url});}catch(e){}});
    }
    const blob=pdf.output("blob"); $("div",bar).style.width="100%";
    const name=`mostafa-gym-${kind==="food"?"nutrition":kind==="gym"?"workout":"full"}-${new Date().toISOString().slice(0,10)}.pdf`;
    if(window.PI_TEST_SAVE){await window.PI_TEST_SAVE(name,blob); msg.textContent=t("export_done");}
    else if(!dl){ const u=URL.createObjectURL(blob), a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); msg.textContent=t("export_done"); }
    else{ try{await dl.save({filename:name,data:blob}); msg.textContent=t("export_done");}
      catch(e){msg.textContent=e&&e.code==="declined"?t("export_declined"):e&&e.code==="rate_limited"?t("ai_busy"):(e&&["unavailable","not_granted","capability_disabled","capability_removed","extension_not_enabled"].includes(e.code))?t("export_unavailable"):t("export_failed");}}
  }catch(e){console.error(e); msg.textContent=t("export_failed");}
  rep.innerHTML=""; $$("[data-export]").forEach(b=>b.disabled=false); setTimeout(()=>{bar.hidden=true;},1200);
}

PI.app={get S(){return S;},t,esc,fmt,nm,r1,render,targets,buildPlan,toast,use,fimg,WD_PATTERN,gymDays,MEALKEYS,save,setTab,bodyMap};
ensureWeek();
render();
})();
