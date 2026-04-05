# Admin Pass
YR20RZ67FKy88HQVF6yW3

# Deploy command
eas build:configure --platform android

eas build --platform android --profile production
eas build --platform android --profile preview

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

Готово
Жіночий рід

Звуки на мобілі

Анімація

Звуки шо показують шо адмін може тиснути кніпку

Publish to Google Play

# Testing Documentation

## Overview
This project uses Jest and React Native Testing Library for comprehensive testing of components and functionality.

## Test Structure

### Test Files Location
- `__tests__/` - Main test directory for component tests
- `components/**/__tests__/` - Component-specific tests (removed in favor of centralized tests)

### Current Test Suite

#### AuthScreen Tests (`__tests__/AuthScreen.test.tsx`)
**Purpose**: Tests the authentication screen component functionality.

**Test Cases**:
1. **renders without crashing** - Verifies the AuthScreen component can be imported and rendered without throwing errors
2. **renders sign-in content** - Tests that the component renders properly with all required providers (SafeAreaProvider, LanguageProvider, AuthProvider)
3. **handles sign-in function call** - Ensures the signIn function from AuthContext is properly available and callable

**Mocked Dependencies**:
- `@/components/themed-text` - Mocked as React Native Text component
- `@/components/themed-view` - Mocked as React Native View component  
- `@/components/LanguageSelector` - Mocked as simple View component
- `@/components/ui/icon-symbol` - Mocked as Text component
- `@/contexts/AuthContext` - Mocked with default auth state and mock functions
- `@/contexts/LanguageContext` - Mocked with default language state
- `@/i18n` - Mocked to return translation keys

#### LanguageSelector Tests (`__tests__/LanguageSelector.test.tsx`)
**Purpose**: Tests the language selection component functionality.

#### SimpleComponent Tests (`__tests__/SimpleComponent.test.tsx`)
**Purpose**: Basic component rendering tests for validation.

## Running Tests

### Command
```bash
npm test
```

### Specific Test File
```bash
npm test -- __tests__/AuthScreen.test.tsx
```

### Test Configuration
- **Jest Config**: `jest.config.js`
- **Setup Files**: 
  - `jest.pre-setup.js` - Pre-initialization
  - `jest.setup.js` - Global mocks and setup

## Mocked Dependencies

### Firebase Services
- Firebase Auth, Firestore, and Storage are fully mocked
- Google Sign-In functionality is mocked
- AsyncStorage is mocked for local storage

### Expo Services
- Expo Haptics are mocked
- Expo Image is mocked
- React Native Safe Area Context is properly configured

### UI Components
- Custom themed components are mocked to their React Native equivalents
- Icon components are mocked as Text components
- Platform-specific components are handled appropriately

## Testing Best Practices Used

1. **Isolation**: Each test is independent and doesn't rely on state from other tests
2. **Mocking**: External dependencies are properly mocked to ensure consistent test results
3. **Provider Wrapping**: Components are tested with their required context providers
4. **Error Handling**: Tests verify components don't throw errors during rendering
5. **Functionality Testing**: Core functions (like signIn) are verified to be available

## Future Test Additions

Consider adding tests for:
- GameScreen component functionality
- GameContext state management
- Integration tests for user flows
- Error boundary testing
- Accessibility testing

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
