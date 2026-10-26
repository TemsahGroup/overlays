<div dir="rtl">

# دليل الربط مع TikFinity

هذا المجلد هو **المكان الوحيد** في المشروع الذي يعرف أي شيء عن TikFinity. وباقي المشروع (المؤثرات ولوحة التحكم) لا يتعامل إلا مع `OverlayEvent`.

## الوضع الحالي باختصار

| الجزء | الحالة |
|---|---|
| **Gift Overlay Builder**: صفحة OBS ‏`#/overlay/<id>` | ✅ تتصل فعلًا بـ TikFinity Event API عبر `eventApi/TikFinityEventApiAdapter.ts` |
| لوحة **LIVE Overlay Effects** الأصلية (`?overlay=1`) | ⛔ بلا اتصال حي عمدًا، لتبقى منفصلة عن الـ Builder. أما `createTikFinityAdapter()` في `index.ts` فما زال قالبًا فارغًا |
| أحداث mock وأحداث رابط `trigger=` | تبقى أحداث **TEST** دائمًا (`source: 'mock'` أو `'url'`) |
| التحقق على بيانات TikFinity حقيقية | ⚠️ **لم يتم بعد.** انظر قسم "ما تم التحقق منه فعلًا" |

## ✅ ما يقوله التوثيق الرسمي (تمت قراءته في 26 أكتوبر 2026)

صفحة [Event API](https://tikfinity.zerody.one/tiktok/dapi) (محتواها يُعرض بـ JavaScript، والنسخة الثابتة من الصفحة لا تحتويه):
- العنوان: `ws://localhost:21213/`. ويستخدم المشروع افتراضيًا `ws://127.0.0.1:21213/`، وهو نفس الخدمة المحلية.
- يجب أن يعمل **TikFinity Desktop App على نفس الكمبيوتر**.
- شكل كل رسالة: `{ "event": "<name>", "data": { … } }`.
- أسماء الأحداث: `chat, gift, share, follow, like, roomUser, subscribe`.
- محتوى `data` يتبع توثيق **TikTok-Live-Connector**.

توثيق TikTok-Live-Connector يصف **شكلين** لحدث الهدية، ولا تذكر صفحة TikFinity أيهما يُرسَل:

</div>

| الحقل | v1 (README v1.x، مسطّح) | v2 (ttlc docs، متداخل) |
|---|---|---|
| gift id | `data.giftId` | `data.giftId` |
| gift name | `data.giftName` | `data.gift.name` |
| gift type | `data.giftType` | `data.gift.type` |
| repeat count | `data.repeatCount` | `data.repeatCount` |
| streak end | `data.repeatEnd` (boolean) | `data.repeatEnd` (`1`) |
| user | `data.uniqueId` | `data.user.uniqueId` / `data.user.displayId` |
| nickname | `data.nickname` | — |
| message id | `data.msgId` | — |

<div dir="rtl">

لذلك يقبل `eventApi/parse.ts` **هذه المسارات فقط**، ويتحقق من نوع كل حقل وقت التشغيل. أي هدية بلا اسم ولا معرّف تُسجَّل في التشخيص كـ `unrecognized` ولا تُشغَّل. ولا يوجد أي استنتاج أو حقول مخترعة.

**قاعدة السلسلة (Streak):** هدايا `giftType 1` (مثل Rose) تُرسل عدة مرات بعدد متصاعد أثناء السلسلة، والرسالة الأخيرة فقط تحمل `repeatEnd`. يشغّل الـ Overlay المؤثر **مرة واحدة عند نهاية السلسلة** بالعدد النهائي. لذا قد يتأخر ظهور المؤثر ثوانٍ قليلة بعد آخر نقرة، وهذا مقصود لتجنّب التكرار.

**منع التكرار:** حسب `msgId` إن وُجد. وإن غاب، فحسب هوية رسالة نهاية السلسلة (المستخدم + الهدية + العدد) لمدة 5 دقائق. يُضاف إلى ذلك منع التكرار العام في `dispatchGift()`. وأحداث TikFinity الحية **لا تُنقل بين التبويبات** (`events/relay.ts`)، لأن لكل Overlay اتصاله الخاص.

## 🔌 كيف يعمل الاتصال

</div>

```
TikFinity Desktop ──ws://127.0.0.1:21213/──▶ TikFinityEventApiAdapter (صفحة OBS فقط)
   parseMessage → extractGift → (streak/dup filter) → NormalizedGiftEvent{provider:'tikfinity', isTest:false}
   → dispatchGift() → eventBus → BuilderOverlayPage → matchMapping (giftId ثم الاسم) → المؤثر
```

<div dir="rtl">

- يبدأ الاتصال **فقط** في `#/overlay/<id>` لإعداد محمَّل ومفعَّل. لا يتصل الـ Builder ولا الصفحات الأصلية أبدًا.
- **الحالات:** `disconnected` · `connecting` · `connected` · `error`. "Connected" تعني أن TikFinity Desktop ردّ فقط. أما **LIVE GIFTS VERIFIED** فلا تظهر إلا بعد استقبال هدية حقيقية فعلًا.
- **إعادة الاتصال تلقائيًا:** 1، 2، 5، 10، ثم 15 ثانية. ولا يُفتح أكثر من اتصال واحد، وتُفصل المستمعات عند الإغلاق.
- **لا يوجد بديل وهمي:** إذا فشل الاتصال لا تُولَّد أي أحداث.
- لا توجد أي بيانات دخول. تغيير العنوان ممكن فقط إلى عنوان محلي (loopback) عبر `?tf=ws://localhost:21213/`.

### معاملات رابط الـ Overlay

| المعامل | المعنى |
|---|---|
| `setup=1` | لوحة حالة الاتصال مع تعليمات تشغيل TikFinity، **للإعداد فقط**، فاحذفه قبل البث |
| `diag=1` | (مع `setup=1`، وفي `npm run dev` فقط) تشخيص لآخر 50 رسالة: اسم الحدث، والشكل المكتشف، والحقول الناقصة، وبنية الـ payload **بدون قيم**، وأسماء المستخدمين مخفية جزئيًا |
| `live=0` | تعطيل الاتصال الحي |
| `tf=ws://…` | عنوان Event API آخر (loopback فقط) |

أضِفها بعد `&` في الرابط المحمول (`…?c=…&setup=1`)، أو بعد `?` في رابط التخزين.

## 🔬 ما تم التحقق منه فعلًا

| الاختبار | النتيجة |
|---|---|
| 41 اختبار وحدة (`npm test`) | ✅ JSON تالف، وأحداث غير معروفة، ومطابقة الهدية (المعرّف ثم الاسم)، وفصل أحداث TEST، والتكرار، والسلاسل، والتنظيف، وإعادة الاتصال |
| متصفح Chromium من `http://localhost:5173` إلى `ws://127.0.0.1:21213/` | ✅ الاتصال يعمل (مقابل **خادم محاكاة محلي** يرسل رسائل بالشكل الموثّق v1) |
| بلا TikFinity (المنفذ مغلق) | ✅ حالة Error مع تعليمات، وإعادة محاولة، وبلا أي أحداث وهمية |
| إيقاف الخادم ثم إعادة تشغيله | ✅ إعادة اتصال تلقائية خلال نحو 5 ثوانٍ، وباتصال واحد فقط |
| الـ Builder ولوحة المؤثرات الأصلية | ✅ لم يفتحا أي اتصال (بحسب سجل الخادم) |
| **بيانات TikFinity Desktop حقيقية** | ❌ **لم تُختبر.** TikFinity Desktop تطبيق Windows، وبيئة التطوير هنا macOS |
| **متصفح OBS (CEF)** | ❌ **لم يُختبر** |
| **OBS 32.2.2 (macOS)** من `http://localhost:5173` ← `ws://127.0.0.1:21213` | ✅ اتصل (سجل الخادم + `lsof`: عملية `OBS Helper` باتصال ESTABLISHED) |
| **OBS 32.2.2 (macOS)** من الموقع المستضاف `https://live-overlay-effects.vercel.app` ← `ws://127.0.0.1:21213` | ✅ اتصل، واستقبل 9 رسائل، وشغّل هديتين (مقابل خادم المحاكاة) |
| Chromium المدمج في بيئة التطوير من نفس صفحة HTTPS | ❌ مُنع قبل الوصول للخادم، غالبًا بسبب حماية المتصفح للشبكة المحلية (Local/Private Network Access). **متصفحات Chrome العادية قد تتصرف بنفس الطريقة، لذا الصفحة الحية مخصصة لـ OBS** |
| OBS على **Windows** و **TikTok LIVE Studio** | ❌ لم يُختبرا بعد |

### لوحات الترتيب (likes و diamondCount)

| الاختبار | النتيجة |
|---|---|
| `like` (v1: `likeCount`، `uniqueId`، `nickname`، `msgId`) و `diamondCount` في الهدايا | ✅ اختبارات وحدة، ومقابل خادم المحاكاة |
| 4 اتصالات في نفس الوقت (لوحتين + Overlay هدايا + OBS) مع خادم المحاكاة | ✅ كلها اشتغلت مع بعض |
| **هل TikFinity الحقيقي يقبل أكثر من اتصال؟** | ❌ **لم يُختبر** |
| **معنى `diamondCount`:** قيمة هدية واحدة أم الإجمالي؟ | ❌ **غير موثّق.** المشروع يفترض أنه لهدية واحدة، والتأكيد يحتاج بيانات حقيقية |

## ✋ الاختبار اليدوي المطلوب على جهاز البث (Windows)

1. شغّل TikFinity Desktop واربطه بالبث.
2. شغّل المشروع بـ `npm run dev`.
3. في OBS أضف Browser Source مؤقتًا بالرابط المحمول مع `&setup=1&diag=1`.
4. تأكد أن الحالة **Connected**.
5. أرسل Rose حقيقية (أو اطلب من مشاهد)، وراقب قسم التشخيص:
   - هل الحدث `gift` بالشكل `v1-flat` أم `v2-nested`؟
   - هل توجد `giftName` و `giftId` و `repeatEnd` و `msgId`؟
   - هل تظهر **LIVE GIFTS VERIFIED**؟
   - هل شُغّل المؤثر **مرة واحدة** وبلا وسم TEST؟
6. جرّب سلسلة (عدة Roses متتالية) وهدية أخرى غير مطابقة.
7. أغلق TikFinity ثم افتحه، وتأكد من عودة الاتصال تلقائيًا.
8. إذا ظهر `unrecognized` أو حقول ناقصة، فانسخ بنية الـ payload من التشخيص (بلا قيم)، وعدّل المسارات في `eventApi/parse.ts` وفي الاختبارات.
9. احذف `&setup=1&diag=1` من رابط OBS قبل البث.

**لوحات الترتيب:**
- أضف لوحة Top Gifters ولوحة Top Likers كمصدرين في OBS **بجانب** Overlay الهدايا، كل واحد فيهم `&setup=1&diag=1`.
- تأكد أن الثلاثة **Connected** في نفس الوقت. لو واحد فيهم بس اتصل، يبقى TikFinity بيقبل اتصال واحد، ومحتاجين نعدّل التصميم.
- ابعت **Rose واحدة**: في التشخيص المفروض `diamondCount=1`، واللوحة تزيد **1 🪙**.
- اعمل **سلسلة من 5 Roses**: المفروض تزيد **5 🪙** مرة واحدة في آخر السلسلة، **مش 25**. لو زادت 25 يبقى `diamondCount` هو الإجمالي، ولازم نعدّل `addGift` في `src/leaderboard/store.ts`.
- اعمل لايكات من حساب تاني، واتأكد إن `like` بيظهر في التشخيص وإن اللوحة بتزيد.

إذا منع متصفح OBS الاتصال المباشر، فالحل التالي جسر محلي صغير خلف نفس واجهة `GiftEventAdapter`. لم يُنفَّذ لأنه لا يوجد دليل حتى الآن على الحاجة إليه.

## ما الموجود في `index.ts`

| الدالة | الوظيفة |
|---|---|
| `BridgeEventInput` | صيغة إدخال بسيطة **خاصة بهذا المشروع**، وليست صيغة TikFinity |
| `toOverlayEvent(input, source)` | تتحقق من صحة الإدخال وتحوّله إلى `OverlayEvent` |
| `dispatchExternalEvent(input, source)` | ترسل الحدث إلى الـ Overlay |
| `readUrlTrigger()` | تقرأ حدثًا واحدًا من رابط الصفحة (`?trigger=...`) |
| `createTikFinityAdapter()` | قالب فارغ يُستكمل بعد قراءة التوثيق الرسمي |

### صيغة `BridgeEventInput`

</div>

```ts
{ type: 'gift',   username: 'sara', giftName: 'Rose', repeatCount: 3 }
{ type: 'follow', username: 'sara' }
{ type: 'like',   username: 'sara', likeCount: 25 }
{ type: 'custom', username: 'sara', name: 'share' }
```

<div dir="rtl">

## طرق الربط الممكنة

نظام **Actions & Events** في TikFinity يربط **حدثًا** من البث (هدية، متابعة، إعجابات، مشاركة...) بـ **إجراء** (Action)، ونافذة **My Actions** تعرض نتيجة هذه الإجراءات كمصدر متصفح في OBS.

قبل أن تبني أي شيء، **افتح TikFinity بنفسك** وراجع توثيقه الرسمي، وتأكد مما يدعمه إصدارك فعلًا. ما يلي خيارات مرتبة من الأبسط إلى الأعقد، وكل منها يتطلب التحقق من التوثيق:

### الخيار 1: استخدام TikFinity كمحرّك ووسائطه كمخرَج (بلا برمجة)
إذا كانت الإجراءات في إصدارك تقبل عرض فيديو أو صورة، يمكنك تسجيل المؤثر من وضع المعاينة (مثلًا بتسجيل OBS بخلفية شفافة أو خضراء)، ثم إرفاق الملف بالإجراء داخل TikFinity، وربطه بالحدث المطلوب (Rose أو Follow أو Likes). هكذا يبقى الربط بالكامل داخل TikFinity، ويُعرض عبر رابط My Actions الخاص به.

### الخيار 2: رابط الحدث الواحد (URL Trigger)
كل صفحة Overlay تقبل حدثًا واحدًا في الرابط ويُشغَّل فور التحميل:

</div>

```
http://localhost:5173/?overlay=1&effect=gift&trigger=gift&t.user=sara&t.gift=Rose&t.repeat=3
http://localhost:5173/?overlay=1&effect=follow&trigger=follow&t.user=sara
http://localhost:5173/?overlay=1&effect=like&trigger=like&t.user=sara&t.likes=25
http://localhost:5173/?overlay=1&effect=custom&trigger=custom&t.user=sara&t.name=share
```

<div dir="rtl">

إذا وفّر إصدارك من TikFinity (أو أداة أخرى مثل OBS) إجراءً يفتح رابطًا أو يُظهر مصدر متصفح أو يعيد تحميله عند حدث معين، فيمكن توجيهه إلى هذه الروابط. تحقّق من توفر ذلك في التوثيق قبل الاعتماد عليه.
هذه الأحداث تُوسَم `source: 'url'`، أي أنها اختبار وليست حدث TikTok مؤكدًا. ويمكن إخفاء وسم TEST بإضافة `badge=0`.

### الخيار 3: Adapter حقيقي (للمطورين)
> ✅ تم تنفيذه لـ **Gift Overlay Builder** (انظر "كيف يعمل الاتصال" أعلاه). الخطوات التالية تخص لوحة LIVE Overlay Effects الأصلية فقط، إذا قررت لاحقًا ربطها أيضًا:

1. اقرأ التوثيق الرسمي وحدّد شكل البيانات وطريقة الاتصال.
2. نفّذ `connect()` و `disconnect()` داخل `createTikFinityAdapter()`.
3. حوّل كل حدث وارد إلى `BridgeEventInput`، ثم استدعِ:

</div>

```ts
dispatchExternalEvent(input, 'tikfinity');
```

<div dir="rtl">

4. شغّل الـ Adapter في `App.tsx` بجانب `createMockAdapter()`.

لن تحتاج إلى تعديل أي مؤثر أو مكوّن. وإذا تطلّب المصدر خادمًا وسيطًا (مثل Webhook يحتاج HTTP)، فسيكون ذلك مشروعًا منفصلًا، لأن هذا المشروع يعمل في المتصفح فقط وبلا Backend.

## اختبار مسار الربط الآن

من Console المتصفح (الحدث سيُوسَم MOCK):

</div>

```js
TikOverlay.dispatch({ type: 'gift', username: 'sara', giftName: 'Rose', repeatCount: 2 })
TikOverlay.dispatch({ type: 'custom', username: 'sara', name: 'share' })
```
