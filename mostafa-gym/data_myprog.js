/* Mostafa Gym — preset: the person's current gym program (Power Gym · Ibn Khaldun, from 2026/11/10, 60 days),
   transcribed from the program sheet. Same shape the file importer produces. */
window.PI = window.PI || {};
PI.presetProg = {
  title: "Power Gym · Ibn Khaldun",
  src: "Power Gym program (2026/11/10)",
  start: "2026-11-10", lengthDays: 60,
  warm: {ar:"إحماء قبل التمرين: ضغط 3×15 مع عقلة. يوم الرجل: عجلة 5 دقائق. يوم الظهر: عقلة 4×12/10/10.", en:"Warm-up: push-ups 3×15 with chin-ups. Leg day: bike 5 min. Back day: chin-ups 4×12/10/10."},
  days: [
    {title:{ar:"صدر + ترايسبس",en:"Chest + Triceps"}, cardio:0, ex:[
      {id:"Leverage_Chest_Press", name:"ضغط صدر جالس على الجهاز", sets:4, reps:"15/12/10/8"},
      {id:"Incline_Dumbbell_Press", name:"ضغط دمبل مائل مع لف (تويست)", sets:4, reps:"15/12/10/8", close:1},
      {id:"Leverage_Incline_Chest_Press", name:"ضغط صدر مائل — جهاز بناتا", sets:4, reps:"10/10/10/8"},
      {id:"Butterfly", name:"بيك دك فلاي (4أ)", sets:4, reps:"15/12/10/8", tech:"super", note:{ar:"سوبر ست مع جهاز الديبس جالس",en:"Superset with the seated dip machine"}},
      {id:"Dip_Machine", name:"جهاز الديبس جالس (4ب)", sets:4, reps:"15/12/10/8", tech:"super", note:{ar:"سوبر ست مع البيك دك",en:"Superset with the pec deck"}},
      {id:"Leverage_Decline_Chest_Press", name:"ضغط صدر سفلي (ديكلاين) على الجهاز", sets:4, reps:"15/12/10/8"},
      {id:"Seated_Triceps_Press", name:"تراي خلف الرأس بالدمبل جالس", sets:4, reps:"12/10/8"},
      {id:"Lying_Dumbbell_Tricep_Extension", name:"تراي نايم بالدمبل (سكال كراشر)", sets:4, reps:"12/10/10/9"},
      {id:"Triceps_Pushdown_-_Rope_Attachment", name:"تراي كابل بالحبل", sets:4, reps:"15/12/10", tech:"drop", note:{ar:"آخر ست دروب ست",en:"Drop set on the last set"}},
      {id:"Cable_Rope_Overhead_Triceps_Extension", name:"تراي خلف الرأس بالكابل — بار قبضة معكوسة", sets:4, reps:"15/12/10/8", close:1}
    ]},
    {title:{ar:"ظهر + بايسبس",en:"Back + Biceps"}, cardio:0, ex:[
      {id:"Chin-Up", name:"عقلة (إحماء الظهر)", sets:4, reps:"12/10/10"},
      {id:"Leverage_Iso_Row", name:"سحب أرضي على جهاز الأوزان الحرة", sets:4, reps:"15/12/10/8"},
      {id:"Leverage_High_Row", name:"سحب أمامي — جهاز هامر سترينث", sets:4, reps:"12/10/10/8", close:1},
      {id:"T-Bar_Row_with_Handle", name:"تي بار رو (سحب T)", sets:3, reps:"12/10/8"},
      {id:"Seated_Cable_Rows", name:"سحب أرضي بالكابل", sets:4, reps:"12/10/10/8"},
      {id:"Hyperextensions_Back_Extensions", name:"تمديد الظهر على بنش 45° (هايبر)", sets:4, reps:"15/12/10/8"},
      {id:"Machine_Preacher_Curls", name:"بايسبس على جهاز الواعظ بالبار W", sets:4, reps:"12/10/10/8"},
      {id:"Preacher_Curl", name:"بايسبس على بنش الواعظ بالبار", sets:4, reps:"15/12/10/8"},
      {id:"Barbell_Curl", name:"بايسبس بالبار وقوف", sets:4, reps:"12/10/8", tech:"drop", note:{ar:"دروب ست",en:"Drop set"}},
      {id:"Hammer_Curls", name:"هامر كيرل بالدمبل", sets:4, reps:"15/12/10/8"}
    ]},
    {title:{ar:"أكتاف",en:"Shoulders"}, cardio:0, ex:[
      {id:"Cable_Seated_Lateral_Raise", name:"رفرفة جانبي على جهاز الأوزان الحرة", sets:4, reps:"15/12/10/10", close:1},
      {id:"Seated_Side_Lateral_Raise", name:"رفرفة جانبي على الجهاز جالس", sets:4, reps:"15/12/10/8", close:1},
      {id:"Side_Lateral_Raise", name:"رفرفة جانبي على الجهاز وقوف", sets:4, reps:"12/10/10/8", close:1},
      {id:"Machine_Shoulder_Military_Press", name:"ضغط أكتاف جالس على الجهاز", sets:4, reps:"12/10/10/8"},
      {id:"Cable_Rear_Delt_Fly", name:"رفرفة خلفي بالكابل", sets:3, reps:"12/10/8", tech:"drop", note:{ar:"دروب ست",en:"Drop set"}},
      {id:"Front_Cable_Raise", name:"رفرفة أمامي على الجهاز (أمامي + خلفي)", sets:4, reps:"15/12/10/8", close:1},
      {id:"Dumbbell_Shrug", name:"شراج بالدمبل (ترابيس)", sets:4, reps:"15/12/10/8"}
    ]},
    {title:{ar:"أرجل",en:"Legs"}, cardio:5, ex:[
      {id:"Hack_Squat", name:"هاك سكوات على الجهاز", sets:4, reps:"15/12/10/10"},
      {id:"Leg_Press", name:"دفع أرجل (ليج برس 45°)", sets:4, reps:"15/12/10/10"},
      {id:"Leg_Extensions", name:"رفرفة أمامي (ليج إكستنشن)", sets:4, reps:"15/12/10/10"},
      {id:"Seated_Leg_Curl", name:"رفرفة خلفي جالس (ليج كيرل)", sets:4, reps:"15/12/10/10"},
      {id:"Glute_Kickback_Machine", name:"ركلة خلفي للأرداف على الجهاز", sets:4, reps:"15/12/10/10"},
      {id:"Lying_Leg_Curls", name:"رفرفة خلفي نايم", sets:4, reps:"15/12/10/10"},
      {id:"Seated_Calf_Raise", name:"سمانة جالس", sets:4, reps:"15/12/10/10"}
    ]}
  ],
  extras: [
    {title:{ar:"تمارين البطن",en:"Abs"}, when:{ar:"في آخر 2–3 أيام من الأسبوع",en:"At the end of 2–3 training days a week"}, ex:[
      {id:"Barbell_Side_Bend", name:"لف الجذع + ميل جانبي بالعصا", sets:4, reps:"25", tech:"super", close:1},
      {id:"Cable_Reverse_Crunch", name:"رفع رجلين نايم + كرانش عكسي", sets:4, reps:"20", tech:"super", close:1},
      {id:"Crunches", name:"في-أب (V-Up)", sets:5, reps:"15", close:1},
      {id:null, name:"الحبال القتالية (باتل روب)", muscle:"cardio", sets:1, reps:"5 min"},
      {id:"Knee_Hip_Raise_On_Parallel_Bars", name:"جهاز آب كوستر", sets:4, reps:"20", close:1},
      {id:"Ab_Crunch_Machine", name:"كرانش على جهاز البطن جالس", sets:4, reps:"25"},
      {id:"Plank", name:"بلانك", sets:3, reps:"60 sec"},
      {id:"Russian_Twist", name:"جهاز لف الجذع (روتاري)", sets:3, reps:"15", close:1}
    ]}
  ],
  tips: []
};
