# Admin Pass
YR20RZ67FKy88HQVF6yW3

# Deploy command
eas build:configure --platform android

eas build --platform android --profile production
eas build --platform android --profile preview
eas build --platform ios --profile preview

or

npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview


# Firebase Google Auth 👋

- No need in Google Cloud Console

- WebClient ID: 841856303776-n0qnohvvtecnmgj9a8dk2q0s16k820ol.apps.googleusercontent.com is from Firebase Console (Google Sign-in Method)

- SHA-1: D8:48:0E:63:2A:FA:61:30:E3:B9:0A:12:BD:DF:1F:CD:A1:40:12:2E is mapped in Firebase Console (app with package name com.pscycho.play)

and insert SHA-1 into Firebase

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


 Web has no equivalent
UI/behavior gaps (smaller):

Clash scoreboard position — Mobile shows scoreboard in admin section in writing phase; web shows it above admin buttons
Force Show Comments — Mobile admin button shows confirmation when not enough comments; web button just stays disabled
Game header — Mobile shows a round/target badge in the header during active play; web header doesn't show current round context
Intentionally different (platform-specific, fine as-is):

Haptic feedback → not applicable on web
ActivityIndicator → using text "Loading…" in buttons is fine
Props drilling → hooks approach is correct for web
Which of these do you want to implement?

_____

App connect pass 10buboukrnetQ!!1