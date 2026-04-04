# Deployment

## EAS (Expo Application Services)

All builds use EAS. The configuration lives in `eas.json`.

### Prerequisites

```bash
npm install -g eas-cli     # EAS CLI >= 16.13.4
eas login                  # Authenticate with your Expo account
```

### Build Profiles

| Profile | Use case | Output | Distribution | Channel |
|---|---|---|---|---|
| `development` | Local development with dev client | APK | Internal | development |
| `preview` | QA / stakeholder testing | APK | Internal | preview |
| `production` | App store release | APK (auto-version) | Store | production |

---

## Building

### Android APK — Preview

For sharing with testers via direct APK install:

```bash
eas build --platform android --profile preview
```

### Android APK — Production

```bash
eas build --platform android --profile production
```

Production builds auto-increment the version code (`autoIncrement: true`).

### iOS

iOS builds require an Apple Developer account. Not yet configured for distribution.

```bash
eas build --platform ios --profile production
```

---

## Credentials

```bash
eas credentials          # View and manage signing credentials
```

Android signing credentials (keystore) are managed by EAS. They are stored in the EAS cloud and injected at build time — you do not need a local keystore file.

---

## Over-the-Air Updates

The app uses Expo Updates for OTA delivery on the `production` channel:

```
Updates URL: https://u.expo.dev/8f2c577b-6d07-41f7-b21a-b1badf4fa19a
```

OTA updates are checked on app launch. JavaScript and asset changes can be shipped without a store release. Native code changes require a full rebuild.

---

## Configuring a New Build

```bash
eas build:configure --platform android
```

This generates or updates `eas.json` and registers the project with EAS if needed.

---

## App Identifiers

| Field | Value |
|---|---|
| iOS Bundle ID | `com.psycho.play` |
| Android Package | `com.psycho.play` |
| EAS Project ID | `8f2c577b-6d07-41f7-b21a-b1badf4fa19a` |
| App slug | `guessme` |

---

## Environment Channels

Expo Updates channels map to build profiles:

| Channel | Build profile | Purpose |
|---|---|---|
| `development` | development | Dev client builds |
| `preview` | preview | Internal test builds |
| `production` | production | Production releases |

To push an OTA update to the preview channel:

```bash
eas update --channel preview --message "Fix guessing phase bug"
```

---

## Submitting to Stores

The `submit.production` profile is configured in `eas.json` for future store submission. When ready:

```bash
eas submit --platform android --profile production
```

iOS submission requires configuring the `ios` submit profile with Apple credentials.

---

## Firebase: SHA-1 for Android

When setting up a new Android build or signing config, add the SHA-1 fingerprint to Firebase:

1. Run `eas credentials` → Android → Keystore → view SHA-1.
2. Go to Firebase Console → Project Settings → Android app → Add fingerprint.
3. Download the updated `google-services.json` and replace the one in the project root.
