# Admin Pass
YR20RZ67FKy88HQVF6yW3

# Deploy command
eas build:configure --platform android

eas build --platform android --profile production
eas build --platform android --profile preview

or

npx eas build --platform android --profile preview


# Scheme change
eas build:configure --platform android

eas build --platform android --profile production
eas build --platform android --profile preview

eas credentials

and insert SHA-1 into Firebase

# Firebase Google Auth 👋

- No need in Google Cloud Console

- WebClient ID: 841856303776-n0qnohvvtecnmgj9a8dk2q0s16k820ol.apps.googleusercontent.com is from Firebase Console (Google Sign-in Method)

- SHA-1: D8:48:0E:63:2A:FA:61:30:E3:B9:0A:12:BD:DF:1F:CD:A1:40:12:2E is mapped in Firebase Console (app with package name com.pscycho.play)

- google-services.json is from Firebase Console (app with package name com.pscycho.play)

# Inviroments

1. Node v22

# TODO

Publish to Google Play


Critical (Production Risk)
Security
1. Hardcoded Firestore password doc ID — GameContext.tsx has 'YR20RZ67FKy88HQVF6yW' as a literal in source. Should move to an environment variable.
2. Firebase config in source control — config/firebase.js exposes all keys including appId and webClientId. Should use app.config.js + expo-constants pulling from .env (.env in .gitignore).


Bugs / Correctness
#	File	Issue	Fix
1.1	GameContext.tsx:384	Password doc ID hardcoded; breaks silently if it changes	Extract to a const ADMIN_PASSWORD_DOC_ID in a config file




#	File	Issue	Fix


2.4	GameContext.tsx	refreshGame() called after every guess despite onSnapshot already updating state — redundant server round-trip	Remove refreshGame() calls; rely on onSnapshot
UX / Game Flow
#	File	Issue	Fix
3.1	GameScreen.tsx	Players are stuck silently when adminLeft: true — no notification	Detect flag in GameScreen, show FancyAlert "Game ended: admin left"
3.2	GuessingPhase.tsx	No clear "waiting" message after submitting guesses — players don't know what to do	Add "Your guesses are in! Waiting for admin to finalize." banner
3.3	ActivePhase.tsx	No confirmation shown after successfully giving points to target	Show FaceMessage "You gave X pts to [name]!"
3.4	GuessingPhase.tsx	In per-round guessing mode, no indication of which target's comments are being guessed	Update subtitle: "Guessing comments about: [Target Name]"
3.5	GameScreen.tsx:104	Copy ID button gives no visual feedback after copy — users re-click	Disable for 1s, swap icon to checkmark briefly
Performance / Architecture
#	File	Issue	Fix
4.1	GameScreen.tsx:90–98	Participant sort + joinIndexById recomputed every render	Wrap both in useMemo keyed to currentGame?.participants
4.2	GameContext.tsx:1755	Splitting context into GameState + GameActions would stop action functions from recreating on every game update	Low-urgency; only worth doing if performance issues appear
Test Coverage Gaps
#	What's missing
5.1	Concurrent comment submissions — no test
5.2	Admin leaving mid-game — no test for adminLeft UI behavior
5.3	generateGameId retry logic when duplicate ID found
5.4	targetSelectionMode: 'chronological' — no tests for this path
5.5	Per-round vs final guessing mode — two separate code paths, only one covered
5.6	enterGame with correct password doc structure
5.7	givePointsToTarget writes targetPointsByPlayer to Firestore
i18n Gaps
#	File	Issue
6.1	ActivePhase.tsx:340	"Завантаження..." hardcoded — should use t('common.loading')
6.2	Both locales	No pluralization — "1 point" / "2 points" both show the same string
6.3	results.tsx:39	Emoji + text hardcoded, not in locale files
6.4	uk.json	Verify all game.ui.postGuessing.* keys are present — may be missing some
Accessibility
#	File	Issue
7.1	ActivePhase.tsx:520	Points-selection buttons have no accessibilityLabel
7.2	GuessingPhase.tsx:351	Correct/incorrect shown by color only — screen readers won't know
7.3	GuessingPhase.tsx:516	Guess result modal has no accessible close action
7.4	Leaderboard.tsx	Rendered as plain View, not a list — add accessibilityRole="list"
Code Quality
#	File	Issue
8.1	GameScreen.tsx, results.tsx	Participant sorting duplicated in both places — extract getSortedParticipants() util
8.2	Multiple	givePoints / awardPoints / targetPoints naming inconsistent across files
8.3	GameContext.tsx	round.startedAt and award.awardedAt read without ?.toDate?.() ?? new Date() guards

______

# Rules
Психологічна гра (комунікативний тренінг)
З чим працюємо:
з анонімними висловлюваннями учасників щодо один одного.
Що тестуємо та розвиваємо:
вміння «прочитати» другу людину, відчути її образ;
гнучкість реагування на те, як сприймають тебе інші та вміння, за необхідності, корегувати таке бачення;
здатність оцінити влучне спостереження іншого щодо тебе.
Очікуваний ефект:
Прискорене проходження комунікативної «дистанції» та вихід на більш продуктивний рівень психологічної взаємодії.
Різновиди гри:
А («телескоп») - всі про одного;
Б («кошик») - знайди висловлювання, котре стосується саме тебе;
В («обмін кошиками») – кожна з двох команд спільно вирішує кого стосуются висловлювання від іншої команди.
Основні кроки та їх можлива технічна реалізація:
Психологічне налаштування та ознайомлення з правилами – модератор усно або\та інформація на екрані 
(зокрема, висловлювання можуть бути довільними або згідно певної теми, можливі слова-підказки).
Нумерація учасників (на час гри № буде на столі біля учасника). Оптималька кількість 6 -12.
Вхід у гру (дозвіл надає ведучий). Учасник бачить пронумеровані папки, кількість активованих папок = кількості учасників.
Вхід у власну ігрову папку (згідно номера). За кожним письмовим висловлюванням, яке буде надіслано з даної папки, буде приховано № учасника (А) та + номер адресата (Б і В)
Поле1: вікно запису висловлювання; вікно № адресата (щодо кого вислів); кнопка зберегти-надіслати. 
Гра А № адресата  один для всіх на раунд; змінюється автоматично кожного раунду за порядком зростання чисел. 
Гра Б № адресата на раунд для кожного інший (генерує компютер), але кожен буде в ролі адресата протягом гри.
Гра В № ад-та  на раунд  для кожного учасника однієї команди -  з числа чл команди-суперника. (і, одночасно,-навпаки). (для №рів 1-5 комп генерує з №рів 6-10. І, одночас, для №6-10 - з №1-5). протягом гри кожен буде в ролі адресата.
Поле 2, на яке учасник автоматично входить після надсилання вислову; його компоненти: 
вікно перегляду висловів; (перемішані, можна гортати, приховано № автора (А), або + прихов № адресата (Б і В);
цифрова клавіатура;  кількість активних цифр на клавіатурі=кількості учасників; автоматично блокуються певні №; 
гра А – одна клавіатура + 2 кнопки додаткових балів: від адресата (за вдалий вислів), від учасників (за цікаве реагування адресата).
гра Б і В - дві цифрові клавіатури; кнопки додаткових балів та вподобайок відсутні. Якщо вгадано адресат на клавіатурі 1 (підсвічується), вгадуємо автора на клавіатурі 2.
кнопка збереження (після обрання №,  коли вислів навпроти клавіатури)
кнопка надсилання (після опрацювання всіх висловів); виправити вибір вже неможливо.
Таблиця результатів гри по учасниках (командах) – бали по кожному раунду та кінцевий результат. 
Дії учасника на пристрої:
1.Отримує доступ до гри (вікна входу)
2.Самостійно входить на своє поле, згідно номера, який присвоєно попередньо.
3.Створює вислів щодо адресата, № якого - у вікні поля 1 та надсилає для загального перегляду (поле 2)
4.А: адресат коментує (усно) висловлювання щодо себе, дає, за бажанням, бал автору за влучний вислів і може отриматии бал за вдале реагування від учасників:    вгадує авторів висловів.
Б і В: учасник приймає участь у спільному обговоренні, вибираючи вислів, котрий стосується саме його; вгадавши (висвітлиться), переходить до вгадування автора (лише даного висловлювання).
5. Переходить до таблиці результатів, яка фіксує та сумує набрані бали.
Дії ведучого на пристрої:
1.Надає доступ до гри
2.Забезпечує, щоб активована кількість папок для входу, активних кнопок на клавіатурі вибору та кількість рядків у таблиці результатів відповідала кількості учасників (це має відбутися одночасно-паралельно)
3. Заохочує коментування та спільний пошук, активує перехід до наступних раундів 
Базове в технічному плані:
-Вислови, до яких «прив»язані» 1 (гра А) або 2 (Б і В) номери
-Клавіатура, на якій «законтачуємо» №ри (вибраний нами та прихований), при вгадуванні № підсвічується
