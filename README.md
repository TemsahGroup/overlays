<div dir="rtl">

# ✨ LIVE Overlay Effects — مؤثرات بث TikTok LIVE

مشروع محلي لبناء مؤثرات **Overlay شفافة** لبث TikTok LIVE، مستوحى من فكرة أداتَي Gifts و My Actions في TikFinity. الكود مكتوب من الصفر، ولا يستخدم أي كود أو ملفات من TikFinity.

| المؤثر | متى يعمل | الشكل |
|---|---|---|
| 🌹 **Gift Alert** | هدية Rose | ورود تُقذف من الأسفل وبتلات تتساقط، مع بطاقة "sent Rose ×3" |
| 💖 **Follow Alert** | متابعة جديدة | قلوب تطفو للأعلى، ولمعات، ورسالة ترحيب بقلب نابض |
| 👍 **Like Alert** | إعجابات | دفعة جزيئات قابلة للتخصيص (يكبر حجمها مع عدد الإعجابات) |
| ✨ **Custom Effect** | أي حدث آخر بالاسم (share, subscribe…) | الشكل والحركة والألوان والنص كلها قابلة للتخصيص |

- الخلفية **شفافة فعلًا** (`background: transparent`) دون خلفية وهمية.
- لا يحتاج تسجيل دخول ولا API ولا Backend.
- React + TypeScript + Vite. الجزيئات تُرسم على **Canvas 2D** في حلقة `requestAnimationFrame` واحدة، والبطاقات تتحرك بـ **CSS**.

> **تنبيه مهم:** كل الأحداث في هذا المشروع **محاكاة محلية**. تظهر في السجل بوسم **MOCK**، وعلى البطاقات بوسم **TEST**. لا يوجد أي اتصال حقيقي بـ TikTok أو TikFinity.

---

## 🚀 التشغيل

المتطلبات: Node.js بالإصدار 18 أو أحدث.

</div>

```bash
cd /Users/tg/overlays
```

```bash
npm install
```

```bash
npm run dev
```

<div dir="rtl">

ثم افتح **http://localhost:5173/**

لتشغيل الاختبارات:

</div>

```bash
npm test
```

<div dir="rtl">

لبناء نسخة الإنتاج وتجربتها (على المنفذ 4173):

</div>

```bash
npm run build
```

```bash
npm run preview
```

<div dir="rtl">

---

## 🎛️ لوحة المعاينة (Dashboard)

الصفحة الرئيسية `http://localhost:5173/`:

- **يسار:** لوحة التحكم.
- **يمين:** إطار معاينة منقّط الحدود وداخله شفاف، بمقاس 1920×1080 أو 1080×1920.

### اختبار كل مؤثر
1. اكتب اسم مشاهد في **Viewer username**.
2. اضغط:
   - **🌹 Rose gift**: الخانة × هي عدد تكرار الهدية (combo)، وكلما زاد زادت الورود.
   - **💖 Follow**: رسالة ترحيب مع قلوب.
   - **👍 Likes**: الخانة n هي عدد الإعجابات.
   - **✨ Custom**: اكتب اسم الحدث (مثل `share`).
3. **Auto demo** يرسل أحداثًا عشوائية كل ثانيتين ونصف تقريبًا.
4. **Ambient snow layer** يضيف طبقة ثلج خلفية (من المشروع السابق).

### الإعدادات (لكل مؤثر تبويب)
| الإعداد | المعنى |
|---|---|
| Duration | مدة المؤثر والبطاقة بالثواني |
| Particle count | عدد الجزيئات |
| Particle size | حجم الجزيء بالبكسل |
| Colors | حتى 8 ألوان (اللون الأول هو لون البطاقة) |
| Shape | `rose` `petal` `heart` `circle` `star` `sparkle` `confetti` |
| Motion | `fountain` قذف من الأسفل · `float` طفو · `rain` تساقط · `burst` انفجار من المنتصف · `point` رشّة من نقطة · `cannons` مدفعان من الزاويتين |
| Icon / Message | أيقونة البطاقة ونصها. المتغيرات: `{user} {gift} {count} {likes} {name}`. اترك النص فارغًا لإخفاء البطاقة |
| Trigger filter | Gift: اسم الهدية (`Rose`) أو `*` لأي هدية · Custom: اسم الحدث أو `*` |

الإعدادات تُحفظ تلقائيًا في المتصفح. أما قسم **Overlay URLs** فيعطيك رابطًا جاهزًا يتضمن إعداداتك الحالية.

> **نصيحة:** افتح رابط الـ Overlay في تبويب آخر من نفس المتصفح، ثم اضغط الأزرار في لوحة التحكم، وسيعمل المؤثر في التبويبين معًا (عبر BroadcastChannel). هذا لا يعمل مع OBS لأنه متصفح منفصل.

---

## 🔗 الروابط ومعاملات URL

| الرابط | النتيجة |
|---|---|
| `/?overlay=1` | كل المؤثرات، شفاف، بلا عناصر تحكم |
| `/?overlay=1&effect=gift` | Gift Alert فقط |
| `/?overlay=1&effect=follow,like` | أكثر من مؤثر في مصدر واحد |
| `/?overlay=1&effect=like&count=90&colors=ffd166,25f4ee&size=30` | إعدادات مخصصة |
| `/?overlay=1&effect=all&gift.count=40&follow.duration=6000` | إعدادات بادئة لكل مؤثر |
| `/?overlay=1&demo=1` | أحداث تجريبية عشوائية (لضبط المكان في OBS) |
| `/?overlay=1&badge=0` | إخفاء وسم TEST |
| `/?overlay=1&snow=1&density=300` | طبقة ثلج |
| `/?overlay=1&trigger=follow&t.user=sara` | تشغيل حدث واحد عند التحميل |

**معاملات المؤثر:** `duration` (ms) · `count` · `size` · `colors` (hex مفصولة بفواصل، بلا #) · `shape` · `emitter` · `message` · `icon` · `filter`.
مع مؤثر واحد تُكتب مباشرة (`count=50`)، ومع عدة مؤثرات تُكتب ببادئة (`like.count=50`).

---

## 📺 الإضافة إلى OBS

1. شغّل `npm run dev` واتركه يعمل.
2. **Sources ← + ← Browser**.
3. **URL**: انسخه من قسم Overlay URLs، مثل `http://localhost:5173/?overlay=1&effect=gift`.
4. **Width/Height**: ‏1920×1080، أو 1080×1920 للبث الرأسي.
5. احذف أي `background-color` من خانة **Custom CSS**.
6. ضع المصدر فوق مصدر الكاميرا.
7. للتأكد من المكان، أضف مؤقتًا `&demo=1` إلى الرابط، ثم احذفه.

يمكنك إضافة كل مؤثر كمصدر منفصل، مثل أدوات TikFinity، وتحريكه وتحجيمه بحرية.

**TikTok LIVE Studio:** ‏Add Source ← Link (أو Web/Browser حسب الإصدار)، ثم الصق نفس الرابط.

> ملاحظة: الأحداث هنا تُرسَل من لوحة المعاينة في متصفحك، ولا تصل إلى OBS لأنه متصفح منفصل. داخل OBS استخدم `demo=1` أو رابط `trigger=` للاختبار، أو اربط مصدرًا حقيقيًا (القسم التالي).

---

## 🎁 Gift Overlay Builder (أداة بناء Overlay للهدايا)

أداة منفصلة بجانب لوحة المؤثرات الأصلية، ولا تغيّر أي شيء فيها. المذيع يختار هدية ثم مؤثرًا، ويعدّل الشكل، ثم يحفظ ويحصل على رابط OBS، دون أي كود.

| الرابط | الصفحة |
|---|---|
| `http://localhost:5173/#/builder` | إعداد جديد |
| `http://localhost:5173/#/builder/<id>` | تعديل إعداد محفوظ (لمالكه فقط) |
| `http://localhost:5173/#/overlay/<id>?c=…` | **رابط OBS المحمول**: شفاف وبلا عناصر تحكم |
| `http://localhost:5173/#/overlay/<id>` | رابط التخزين (في نفس المتصفح فقط) |
| أضف `&demo=1` (أو `?demo=1`) | هدية TEST كل 6 ثوانٍ لضبط المكان |

يمكنك أيضًا فتحها من رابط **🎁 Gift Overlay Builder** في لوحة المؤثرات.

### خطوات الاستخدام
1. **Overlay:** اسم الإعداد والمقاس (16:9 أو 9:16).
2. **Gift:** ابحث واختر هدية، أو اكتب أي اسم هدية. معرّف الهدية (Gift ID) اختياري في قسم Advanced.
3. **Effect:** ‏Rose Rain، أو Fireworks، أو Hearts، أو Gift Explosion، أو أحد مؤثرات المشروع الأصلية (LIVE: …).
4. **Customize:** عدد الجزيئات، والمدة، والحجم، والشدة (Low/Medium/High)، والألوان، ونص التنبيه وأيقونته.
5. **▶ Preview** يشغّل المؤثر في المعاينة فقط. أما **🧪 Send test gift** فيمرّ بنفس مسار مطابقة الهدايا الحقيقية، ويصل أيضًا إلى روابط الـ Overlay المفتوحة في نفس المتصفح. والاثنان يحملان وسم **TEST**.
6. **Save** ثم **Copy overlay URL**، والصقه في OBS كـ Browser Source بالمقاس المناسب.

يمكن إنشاء إعدادات متعددة لهدايا ومؤثرات مختلفة، ولكل منها معرّف ورابط مستقل، ولا يكتب أي إعداد فوق آخر. ويمكن **تعطيل** أي إعداد أو حذفه.

### ما يعمل محليًا وما يحتاج استضافة أو ربطًا

| الميزة | الآن |
|---|---|
| البناء والمعاينة وأحداث TEST | ✅ |
| الحفظ وإعادة الفتح | ✅ في هذا المتصفح (`localStorage`) |
| رابط OBS المحمول | ✅ على أي جهاز يفتح التطبيق، لكنه **لا يُلغى عن بُعد** ولا يتحدّث تلقائيًا (انسخه من جديد بعد كل حفظ) |
| رابط عام دائم وقابل للإلغاء لأي مذيع | ❌ يحتاج Backend وقاعدة بيانات وتسجيل دخول. التفاصيل في [src/builder/BACKEND.md](src/builder/BACKEND.md) |
| تشغيل المؤثر عند وصول هدية TikTok حقيقية | 🟡 مُنفَّذ: صفحة OBS تتصل بـ TikFinity Event API (`ws://127.0.0.1:21213/`) عندما يعمل **TikFinity Desktop على نفس الجهاز**. لكنه **لم يُختبر بعد على بيانات TikFinity حقيقية**؛ الخطوات في [src/integrations/tikfinity/README.md](src/integrations/tikfinity/README.md) |

> ما دام التطبيق يعمل على `localhost`، فالروابط تعمل على جهازك فقط. لا تشاركها كروابط عامة.

### الاتصال الحي بـ TikFinity
- يبدأ تلقائيًا في صفحة OBS (`#/overlay/<id>`) فقط، ولا يتصل الـ Builder أبدًا.
- أضف `&setup=1` إلى رابط الـ Overlay لرؤية حالة الاتصال (Disconnected أو Connecting أو Connected أو Error) مع التعليمات. وفي `npm run dev` أضف أيضًا `&diag=1` لرؤية بنية الرسائل الواردة.
- "Connected" لا تعني أن الربط حيّ. يظهر **LIVE GIFTS VERIFIED** فقط بعد وصول هدية حقيقية.
- الهدايا الحقيقية تظهر **بلا** وسم TEST، والاختبارية **دائمًا** بوسم TEST.
- لتعطيل الاتصال الحي أضف `&live=0`.

---

## 🔌 الربط مع TikFinity لاحقًا

راجع **[src/integrations/tikfinity/README.md](src/integrations/tikfinity/README.md)**. يشرح الدليل:
- ما الذي لم يُنفَّذ عمدًا، ولماذا.
- ثلاثة مسارات للربط: وسائط داخل Actions، أو رابط Trigger، أو Adapter حقيقي، وكل مسار يحتاج التحقق من التوثيق الرسمي.
- صيغة `BridgeEventInput` والدالة `dispatchExternalEvent()`.

من Console المتصفح:

</div>

```js
TikOverlay.mock.gift('sara', 'Rose', 3)
TikOverlay.mock.follow('sara')
TikOverlay.mock.like('sara', 40)
TikOverlay.mock.custom('sara', 'share')
TikOverlay.dispatch({ type: 'like', username: 'sara', likeCount: 99 })
```

<div dir="rtl">

---

## 🧱 بنية المشروع

</div>

```
src/
├── App.tsx                         # اختيار الوضع: Dashboard أو Overlay
├── main.tsx                        # نقطة البداية + window.TikOverlay
├── styles.css                      # تصميم البطاقات وأنيميشن CSS + لوحة التحكم
├── config/
│   ├── route.ts                    # قراءة كل معاملات الرابط
│   └── settings.ts                 # إعدادات الثلج
├── events/
│   ├── types.ts                    # OverlayEvent: الواجهة الموحدة للأحداث
│   ├── eventBus.ts                 # emitOverlayEvent / onOverlayEvent
│   ├── relay.ts                    # مزامنة التبويبات (BroadcastChannel)
│   └── adapters/
│       ├── types.ts                # EventAdapter
│       └── mockAdapter.ts          # أحداث محاكاة (source: 'mock')
├── integrations/tikfinity/
│   ├── eventApi/                   # الاتصال الحي بـ TikFinity Event API (للـ Builder)
│   │   ├── parse.ts                # قراءة الرسائل والحقول الموثقة فقط
│   │   ├── TikFinityEventApiAdapter.ts  # WebSocket + الحالة + إعادة الاتصال + التشخيص
│   │   └── statusChannel.ts        # مشاركة الحالة مع الـ Builder (قراءة فقط)
│   ├── index.ts                    # BridgeEventInput, dispatchExternalEvent, URL trigger
│   └── README.md                   # دليل الربط
├── engine/
│   ├── OverlayEngine.ts            # Canvas واحد + rAF + تغيير الحجم + DPR
│   └── types.ts                    # OverlayEffect
├── effects/
│   ├── types.ts                    # EffectSettings, BurstConfig, الأشكال والحركات
│   ├── settings.ts                 # القيم الافتراضية + تحويلها من وإلى URL
│   ├── registry.ts                 # حدث ← مؤثر ← دفعات جزيئات + نص البطاقة
│   ├── scheduler.ts                # طابور حتى لا تتراكب البطاقات
│   ├── particles/
│   │   ├── ParticleSystem.ts       # فيزياء الجزيئات والرسم
│   │   └── sprites.ts              # رسم الأشكال مسبقًا (قلب، وردة، نجمة…)
│   └── snow/                       # مؤثر الثلج
├── builder/                        # Gift Overlay Builder (ميزة منفصلة)
│   ├── types.ts                    # OverlayConfig / GiftMapping (schemaVersion 1)
│   ├── validate.ts                 # التحقق والقيم الآمنة + الحقول العامة فقط
│   ├── gifts.ts                    # قائمة الهدايا (أسماء + emoji)
│   ├── effects.ts                  # Rose Rain, Fireworks, Hearts, Gift Explosion + المؤثرات الأصلية
│   ├── giftEvents.ts               # GiftEventAdapter, NormalizedGiftEvent, منع التكرار
│   ├── play.ts                     # إعداد + حدث ← تشغيل على OverlayStage
│   ├── route.ts                    # مسارات #/builder و #/overlay
│   ├── BACKEND.md                  # متطلبات الروابط العامة الدائمة
│   ├── repository/                 # ConfigRepository + تخزين محلي + الرابط المحمول
│   └── components/                 # BuilderPage, BuilderOverlayPage, EffectThumb, SetupGuide
└── components/
    ├── OverlayStage.tsx            # Canvas + طبقة البطاقات (المكوّن القابل لإعادة الاستخدام)
    ├── AlertLayer.tsx              # بطاقات التنبيه
    ├── Dashboard.tsx               # لوحة المعاينة
    ├── SettingsEditor.tsx          # محرر الإعدادات
    └── EventLog.tsx                # سجل الأحداث
```

<div dir="rtl">

### مسار الحدث

</div>

```
mock / URL / (TikFinity لاحقًا) ─▶ eventBus ─▶ OverlayStage
                                              ├─ registry: أي مؤثر؟ وبأي إعدادات؟
                                              ├─ scheduler: الآن أم في الطابور؟
                                              ├─ ParticleSystem.play(bursts)   ← Canvas
                                              └─ AlertLayer (بطاقة)            ← CSS
```

<div dir="rtl">

### إضافة مؤثر جديد (مثل Share)
أسرع طريقة لا تحتاج أي كود: استخدم **Custom Effect** واجعل `filter=share`.

لمؤثر مستقل بنوع خاص به:
1. أضف المعرّف إلى `EffectId` و `EFFECT_IDS` في `effects/types.ts`.
2. أضف قيمه الافتراضية في `DEFAULT_SETTINGS` و `EFFECT_LABELS` في `effects/settings.ts`.
3. أضف شرط الحدث في `effectForEvent()` وسلوكه في `buildPlay()` داخل `effects/registry.ts`.
4. (اختياري) أضف تموضع البطاقة `.alert--<id>` في `styles.css`.

### ملاحظات الأداء
- كل شكل يُرسم مرة واحدة في Sprite ثم يُنسخ بـ `drawImage`.
- الحد الأقصى 2500 جزيء في الوقت نفسه، ودقة الرسم محدودة بـ `devicePixelRatio ≤ 2`.
- عند إغلاق المكوّن يُلغى `requestAnimationFrame` و `ResizeObserver` والمؤقتات.
- تجنّبنا ميزات CSS الحديثة جدًا داخل الـ Overlay، مثل container units وخاصية `translate`، لأن بعض إصدارات متصفح OBS لا تدعمها.

</div>
