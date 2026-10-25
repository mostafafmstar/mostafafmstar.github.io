/* Mostafa Gym — body zones for the detailed goal.
   dir: lose = slim / tone the area (whole-body fat loss + training the muscle underneath)
        gain = build / enlarge the area (muscle growth)
   m:   muscles the gym program prioritises for that zone (first = most important)
   kw:  words used to recognise the zone in free text (normalised Arabic + English) */
window.PI = window.PI || {};
PI.zones = {
  belly:    {dir:"lose", m:["abs","lowerback"], th:"abs",
    n:{ar:"البطن والكرش",en:"Belly",hi:"पेट",bn:"পেট"}, kw:["بطن","كرش","معده","خصر","belly","stomach","tummy","waist","gut"]},
  flanks:   {dir:"lose", m:["abs"], th:"abs",
    n:{ar:"الجوانب (الخواصر)",en:"Love handles",hi:"कमर के साइड",bn:"কোমরের পাশ"}, kw:["جوانب","جنب","خواصر","خاصره","love handle","flank","sides","muffin"]},
  hips:     {dir:"lose", m:["glutes","abductors","adductors","hamstrings"], th:"abductors",
    n:{ar:"الأرداف والفخذين",en:"Hips & thighs",hi:"कूल्हे और जांघें",bn:"নিতম্ব ও উরু"}, kw:["ارداف","فخذ","فخاد","افخاد","وراك","هانش","مؤخر","موخر","hip","thigh","saddlebag","butt"]},
  arms_fat: {dir:"lose", m:["triceps","biceps","shoulders"], th:"triceps",
    n:{ar:"ترهل الذراعين",en:"Arm flab",hi:"बाँहों की ढीली चर्बी",bn:"বাহুর মেদ"}, kw:["ذراع","دراع","زند","زنود","ايدين","arm","bingo"]},
  back_fat: {dir:"lose", m:["upperback","back"], th:"upperback",
    n:{ar:"دهون الظهر",en:"Back fat",hi:"पीठ की चर्बी",bn:"পিঠের চর্বি"}, kw:["ظهر","back"]},
  chest_fat:{dir:"lose", m:["chest","upperback"], th:"chest",
    n:{ar:"دهون الصدر",en:"Chest fat",hi:"सीने की चर्बी",bn:"বুকের চর্বি"}, kw:["صدر","ثدي","تثدي","chest","moobs","breast"]},

  chest:    {dir:"gain", m:["chest"], th:"chest",
    n:{ar:"الصدر",en:"Chest",hi:"छाती",bn:"বুক"}, kw:["صدر","chest","pec"]},
  arms:     {dir:"gain", m:["biceps","triceps"], th:"biceps",
    n:{ar:"الذراعين",en:"Arms",hi:"बाँहें",bn:"বাহু"}, kw:["ذراع","دراع","زند","زنود","باي","تراي","arm","bicep","tricep"]},
  shoulders:{dir:"gain", m:["shoulders","traps"], th:"shoulders",
    n:{ar:"الأكتاف",en:"Shoulders",hi:"कंधे",bn:"কাঁধ"}, kw:["كتف","اكتاف","ترابيس","shoulder","delt","trap"]},
  back_w:   {dir:"gain", m:["back","upperback"], th:"back",
    n:{ar:"عرض الظهر",en:"Back width",hi:"पीठ की चौड़ाई",bn:"পিঠের প্রশস্ততা"}, kw:["ظهر","مجنص","back","lat"]},
  glutes:   {dir:"gain", m:["glutes","abductors","hamstrings"], th:"glutes",
    n:{ar:"المؤخرة",en:"Glutes",hi:"ग्लूट्स",bn:"নিতম্ব"}, kw:["مؤخر","موخر","ارداف","glute","butt","booty","bum"]},
  legs:     {dir:"gain", m:["quads","hamstrings","adductors"], th:"quads",
    n:{ar:"الفخذين والرجلين",en:"Thighs & legs",hi:"जांघें और पैर",bn:"উরু ও পা"}, kw:["فخذ","فخاد","افخاد","رجل","ارجل","quad","leg","thigh"]},
  calves:   {dir:"gain", m:["calves"], th:"calves",
    n:{ar:"السمانة",en:"Calves",hi:"पिंडली",bn:"কাফ"}, kw:["سمانه","بطات","calf","calves"]},
  abs_def:  {dir:"gain", m:["abs"], th:"abs",
    n:{ar:"إبراز عضلات البطن (سيكس باك)",en:"Visible abs (six-pack)",hi:"दिखने वाले एब्स",bn:"দৃশ্যমান অ্যাবস"}, kw:["سيكس","six","تقسيم","ابراز","abs","pack"]}
};
/* words that set the direction of a phrase */
PI.zoneVerbs = {
  lose:["تخسيس","تنحيف","خساره","خسس","حرق","شد","ترهل","دهون","نزول","تقليل","تصغير","تنشيف","slim","lose","reduce","burn","fat","trim","shrink","tighten","tone"],
  gain:["تضخيم","تكبير","زياده","بناء","تقويه","تعريض","تعظيم","نفخ","تفخيم","build","grow","bigger","gain","bulk","enlarge","widen","increase","size"]
};
