# Implementation Plan - CalSnap AI (iOS React Native App)

**CalSnap AI** (Tagline: *"Snap your plate. Track in seconds — Zero-Friction AI Nutrition"*) is a next-generation iOS nutrition and calorie tracking app built with React Native (Expo) designed to outperform Cal AI by eliminating logging friction, introducing intelligent Weekly Calorie Banking, providing transparent oil/portion sliders, and offering a fair $3.99/mo subscription model.

---

## ⚡ Core Philosophy: The Zero-Friction Architecture

Most nutrition apps fail because logging food feels like filling out a tax form. **CalSnap AI eliminates 90% of user effort** through 7 friction-killing principles:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   7 ULTRA-LOW FRICTION PRINCIPLES                        │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. Snap & Walk Away    │ Camera closes in 0.1s. AI parses in background. │
│ 2. Lock Screen Widget  │ 1-tap from iOS Lock Screen / Action Button.    │
│ 3. Voice + Photo Fusion│ Hold mic while snapping ("Half plate, extra oil").│
│ 4. Gesture Sliders     │ Zero typing. 1 swipe to adjust portions & oils.  │
│ 5. Auto Time-of-Day    │ Breakfast/Lunch/Dinner pre-selected by time.     │
│ 6. 1-Tap Quick Fill    │ "Usual Black Coffee" suggestion card on home.     │
│ 7. Frictionless Start  │ Instant camera access on 1st launch (No 15-min survey).│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Fortified Zero-Loophole Security Architecture

To guarantee **100% protection of your Gemini API key and server infrastructure**, CalSnap AI enforces a 5-layer enterprise security boundary:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          5-LAYER HARDENED SECURITY BOUNDARY                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: iOS App Attest / DeviceCheck │ Validates request originates from genuine app.  │
│ Layer 2: JWT Bearer Auth Verification │ Validates cryptographic user session token.    │
│ Layer 3: Per-User Rate Limiter        │ Blocks API abuse (e.g. max 50 snaps/day for Pro)│
│ Layer 4: Image Hash Deduplication     │ Prevents duplicate calls for identical photos.  │
│ Layer 5: GCloud Secret Manager        │ Key NEVER enters client app or network responses│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Loophole Defense Mechanisms:

#### 1. Zero Client Exposure (Key Isolation)
* The Gemini API Key is stored **exclusively** in Google Cloud Secret Manager (`projects/.../secrets/GEMINI_API_KEY`).
* The key is injected strictly at runtime into the Google Cloud Function (`process.env.GEMINI_API_KEY`).
* The client iOS app **never receives, sees, or handles** the raw key.

#### 2. Cryptographic JWT Auth Validation
* Every incoming HTTP request must carry a valid Bearer JWT: `Authorization: Bearer <token>`.
* Google Cloud Function verifies the cryptographic signature against your Auth Provider's public keys (`JWKS`) before doing any processing.
* Invalid, expired, or forged tokens receive an immediate `HTTP 401 Unauthorized` in < 10ms without calling Gemini.

#### 3. Per-User Quota & Rate Limiting (Wallet Shield)
* To prevent malicious users from scripting thousands of requests to drain your API billing budget:
  * **Free Users**: Hard-capped at 3 AI Snaps / day.
  * **Pro Subscribers**: Capped at 50 AI Snaps / day (max 1 snap per 10 seconds).
* Attempts to exceed quota return `HTTP 429 Too Many Requests` instantly.

#### 4. Apple App Attest / DeviceCheck Integration
* Protects against attackers capturing a valid user token and using Postman/Python scripts to call your server.
* iOS `DCAppAttestService` signs request headers natively on iPhone hardware, proving the request came from your legitimate App Store binary running on a real Apple device.

---

## 🔐 User Authentication & Account Architecture

CalSnap AI uses a **Frictionless Dual-Authentication Strategy** to guarantee instant usability while keeping user data safely synced:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION & LOGIN ARCHITECTURE                     │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. Anonymous Guest Mode    │ Instant tracking on 1st launch (Zero friction)│
│ 2. Sign in with Apple      │ 1-tap FaceID/TouchID native iOS sign-in       │
│ 3. Email / Magic Link      │ Optional alternative for non-Apple users      │
│ 4. Auto Account Merge      │ Converts Guest history to Permanent Account   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📜 History & Data Persistence Engine (Offline-First + Cloud Sync)

CalSnap AI includes a robust multi-layer history tracking system so users never lose a meal:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  HISTORY & STORAGE ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. High-Speed Local Cache  │ react-native-mmkv (Instant offline history) │
│ 2. Cloud Auto-Sync         │ Supabase / Firebase Postgres                │
│ 3. Calendar & Search       │ Tap any past date or search dish name       │
│ 4. 1-Tap Re-Log            │ Re-log frequent past meals in 1 tap          │
│ 5. Retention Slider        │ 30 Days ↔ 90 Days ↔ 1 Year ↔ Keep Forever    │
│ 6. Full Export Engine      │ Export complete history to PDF & CSV anytime │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Complete Tech Stack

| Layer | Technology / Library | Purpose |
| :--- | :--- | :--- |
| **Framework** | **React Native (Expo SDK 51/52)** | Cross-platform native performance, rapid iOS compilation, EAS builds. |
| **Language** | **TypeScript** | Strict typing for API contracts, nutrition models, and state management. |
| **Styling & UI** | **NativeWind v4 (Tailwind)** + **React Native Reanimated 3** | Fluid 60fps micro-animations, modern glassmorphism, responsive UI. |
| **Navigation** | **Expo Router v3 (File-based)** | Native stack navigation, tab routing, modal sheets, paywall overrides. |
| **Authentication** | **expo-apple-authentication** + **Supabase Auth** | 1-tap Sign in with Apple, Anonymous guest sessions, JWT token auth. |
| **State & Local Storage**| **Zustand** + **react-native-mmkv** | High-performance sync/async state persistence with synchronous disk access. |
| **Notifications** | **expo-notifications** | Local iOS push notifications, scheduled meal reminders, streak saver alerts. |
| **In-App Subscriptions**| **react-native-purchases** (RevenueCat) | iOS App Store subscription management, paywall entitlements, restore purchases. |
| **Backend & Security** | **Google Cloud Functions (GCF)** + **GCloud Secret Manager** | Secure Gemini API key proxy, auth token verification, quota management. |
| **AI Engine** | **Google Gemini 2.0 Flash API** | Multimodal zero-shot food identification, calorie estimation, JSON schema parsing. |
| **Build & CI/CD** | **EAS Build + EAS Update** (`expo-updates`) | Over-the-Air (OTA) updates, automated iOS TestFlight deployments. |

---

## 📦 Complete List of Required Native Libraries

### 1. Camera, Audio & Media
* `expo-camera` / `react-native-vision-camera`: High-speed camera capture with native haptic feedback.
* `expo-image-picker`: Gallery import for food photos.
* `expo-av` or `expo-speech-recognition`: Voice note recording (3-sec audio prompt alongside photo).
* `expo-image`: Hardware-accelerated image caching and blur-hash placeholders.

### 2. Notifications & Local Reminders
* `expo-notifications`: iOS native push notification permissions, scheduled meal reminder triggers, background badge handling.

### 3. Export & File System (PDF / CSV)
* `expo-print`: Converts structured HTML/CSS templates into pixel-perfect PDF report documents natively on iOS.
* `expo-sharing`: Invokes native iOS Share Sheet (`UIActivityViewController`) to export PDF/CSV files to Mail, Files, AirDrop, WhatsApp.
* `expo-file-system`: Native file writing, directory handling, and temporary storage management for report generation.
* `json2csv` (or custom lightweight serializer): Converts meal history and macro logs to standard `.csv` format.

### 4. In-App Purchases & Pricing
* `react-native-purchases`: Official RevenueCat SDK for iOS StoreKit 2 integration.
* `react-native-purchases-ui`: RevenueCat native paywall rendering (fallback/dynamic).

### 5. Over-The-Air (OTA) Updates & Auto Versioning
* `expo-updates`: Enables silent background OTA bug fixes and UI improvements without App Store resubmissions.
* `eas-build-on-success` hook + `app.config.js`: Automated iOS `buildNumber` increment script on every build.

### 6. UI Effects, Haptics & Icons
* `lucide-react-native`: Modern, minimalist vector iconography.
* `expo-haptics`: Tactile feedback on camera snap, slider adjustments, and goal completions.
* `react-native-reanimated` & `react-native-gesture-handler`: Fluid bottom sheet modals, visual sliders, spring physics.
* `react-native-svg`: Render custom macro ring charts and glucose impact curves.

---

## 🌐 Dynamic Remote Pricing (GitHub Hosted JSON)

Pricing will be controlled remotely via a raw GitHub JSON URL (`https://raw.githubusercontent.com/your-org/calsnap-config/main/pricing.json`), allowing instant price changes, promo banners, and experimentations without app updates.

---

## 📱 Screen Architecture & Navigation Design

The app features a **4-Tab Bottom Navigation Bar** with high-contrast active states, glassmorphism backdrop blur, and tactile feedback.

```
                              ┌────────────────────────┐
                              │    CalSnap AI App      │
                              └───────────┬────────────┘
                                          │
    ┌───────────────────┬─────────────────┴─────────────────┬───────────────────┐
    │                   │                                   │                   │
┌───▼──────────────┐ ┌──▼──────────────────────────────┐ ┌──▼──────────────┐ ┌───▼──────────────┐
│ 1. Today Tab     │ │ 2. Snap & Log (Center CTA)      │ │ 3. Insights Tab  │ │ 4. Settings Tab  │
├──────────────────┤ ├─────────────────────────────────┤ ├──────────────────┤ ├──────────────────┤
│ • Macro Rings    │ │ • Dual Mode: Snap + Voice Note  │ │ • Weekly Trends  │ │ • Account & Login│
│ • Calorie Bank   │ │ • Async "Snap & Walk Away" UX   │ │ • Glucose Score  │ │ • Notifications  │
│ • Meal Timeline  │ │ • Live Oil & Portion Sliders    │ │ • PDF/CSV Export │ │ • History Slider │
│ • Quick Water Log│ │ • Ingredient Adjustments        │ │ • Macro Breakdown│ │ • FAQ Accordion  │
└──────────────────┘ └─────────────────────────────────┘ └──────────────────┘ └──────────────────┘
```

### Detailed Tab Specifications:

#### Tab 1: 🏠 Today (Dashboard)
* **Header**: Daily Greeting, Current Streak Badge with 🔥 animation, Calorie Bank balance (*"1,450 kcal remaining today | +350 banked for Saturday"*).
* **Hero Visual**: Animated SVG Triple Ring (Calories, Protein, Carbs, Fat) with real-time remaining counters.
* **Glucose Energy Forecast Bar**: Color-coded pill showing post-meal energy stability (Green: Stable | Yellow: Spike Risk).
* **Meal Timeline Cards**: Chronological list of logged meals (Breakfast, Lunch, Snacks, Dinner) with food thumbnails, total macros, and quick edit buttons.

#### Tab 2: 📸 Snap & Log (Central Action Sheet Modal)
* **Floating Center Button**: Distinct elevated button on bottom tab bar.
* **Camera Viewport**: High-speed camera feed with plate alignment frame.
* **Voice Overlay**: Hold-to-Talk microphone button (*"I ate half of this curry and added 2 spoons of greek yogurt"*).
* **"Snap & Walk Away" Engine**: Upon capture, app triggers a haptic tick, closes camera instantly, and runs AI inference in background. User receives an immediate banner notification once processed.
* **Interactive Correction View**:
  * **Oil Slider**: `None (0g)` → `Normal (10g)` → `Heavy (25g)` (updates total calories live with Reanimated physics).
  * **Portion Slider**: `25%` → `100%` → `150%`.

#### Tab 3: 📊 Insights & Data Export
* **Calorie & Macro Charts**: Interactive bar charts for 7-day, 30-day, and 90-day progress.
* **Weekly Calorie Bank Breakdown**: Visual graph showing daily calorie surpluses/deficits.
* **Report Exporter (PDF/CSV)**:
  * **PDF Export**: Generates professional PDF report containing meal history, macro averages, and glucose scores formatted for doctors or fitness coaches using `expo-print`.
  * **CSV Export**: Raw data dump (`Date, Meal, Dish Name, Calories, Protein, Carbs, Fat, Oil_g`) via `expo-sharing`.

#### Tab 4: ⚙️ Settings & Account
* **👤 Account & Security Section**:
  * **Current User Badge**: Shows *"Guest Account (Unsaved)"* or *"Signed in as john@apple.com"*.
  * **🍏 Sign in with Apple Button**: 1-tap FaceID/TouchID sign-in button using `expo-apple-authentication`.
  * **Sign Out / Delete Account**: Secure account deletion complying with Apple App Store guidelines.
* **Profile & Targets**: BMR/TDEE Calculator, Weight Goal (Lose weight, Maintain, Muscle gain), Activity Level.
* **Dietary & Cultural Presets**: Adjust AI regional defaults (e.g. *Indian Homestyle*, *East Asian*, *Middle Eastern*, *Western / Restaurant*).
* **🔔 Notification & Reminder Controls**: Master Push Toggle, Breakfast/Lunch/Dinner Reminders, Streak Saver Alerts.
* **🗑️ History Retention & Storage Management**: History Retention Slider (30d ↔ Keep Forever), Clear Photo Cache, Delete History.
* **❓ Interactive FAQ Section (Accordion Layout)**:
  * ❓ How accurate is CalSnap AI?
  * ❓ What is Weekly Calorie Banking?
  * ❓ Does it work for regional or home-cooked dishes?
  * ❓ How is my privacy protected?
  * ❓ How do I export data for my doctor?
  * ❓ How do I manage my subscription?
* **Subscription Management**: Displays active status via RevenueCat, Manage/Cancel Subscription link, Restore Purchases button.
* **App Diagnostics**: Dynamic app version, EAS Build number, OTA Update channel info (`expo-updates`).

---

## 💎 World-Class Paywall Experience (Designed to Beat Cal AI)

### Design & Psychological Triggers:
1. **Header Hero**: High-definition micro-animation showing food photo turning into instant calorie breakdown.
2. **Competitor Comparison Table**:
   * **Cal AI**: ~$14.99/mo | No Calorie Banking | Blackbox Calorie Guessing | Strict Paywall.
   * **CalSnap AI**: **$3.99/mo** | Weekly Calorie Bank | Interactive Oil Sliders | 7-Day Free Trial.
3. **Risk-Free Trial Toggle**: Interactive switch: `7-Day Free Trial Enabled` (Default: ON).
4. **Dynamic Remote Pricing**: Fetched directly from `pricing.json` (reflecting local currency and dynamic discount badges).
5. **Sticky CTA Button**: *"Start My 7-Day Free Trial — $0.00 Today"*, with subtext *"Cancel anytime in Settings > Apple ID"*.

---

## 🔄 Automatic iOS Build Number Increment (EAS Setup)

To ensure smooth TestFlight & App Store submissions without build number collisions, we configure dynamic versioning in `app.config.js`:

```javascript
// app.config.js
module.exports = ({ config }) => {
  const buildNumber = process.env.EAS_BUILD_RUN_NUMBER || "1";
  return {
    ...config,
    name: "CalSnap AI",
    slug: "calsnap-ai",
    version: "1.0.0",
    ios: {
      bundleIdentifier: "com.calsnap.app",
      buildNumber: buildNumber, // Auto-increments on every EAS build
      supportsTablet: false,
      infoPlist: {
        NSCameraUsageDescription: "CalSnap AI needs camera access to identify food and calculate calories.",
        NSMicrophoneUsageDescription: "CalSnap AI needs microphone access to record quick voice notes about your meal."
      }
    },
    extra: {
      eas: {
        projectId: "your-eas-project-id"
      }
    }
  };
};
```

---

## 🚀 Step-by-Step Execution Workflow

```
Phase 1: Environment & Expo Project Initialization
  ├── Initialize Expo App with TypeScript & Router v3
  ├── Install Native Libraries (VisionCamera, RevenueCat, Expo-Print, Expo-Notifications, Expo-Apple-Authentication, MMKV, Zustand, NativeWind)
  └── Configure app.config.js & eas.json auto-incrementing build settings

Phase 2: Backend & Security Setup (Google Cloud Functions)
  ├── Store GEMINI_API_KEY in GCloud Secret Manager
  ├── Deploy Gen2 Node.js Google Cloud Function (analyzeMeal) with secret binding & Auth verification
  └── Upload pricing.json config to GitHub repository

Phase 3: Core App Navigation & Screen UI Build
  ├── Implement Glassmorphism 4-Tab Navigation Bar
  ├── Build Today Dashboard (Macro Rings, Calorie Bank, Meal Timeline)
  ├── Build Camera & Voice "Snap & Walk Away" Modal + Live Sliders
  ├── Build Insights Tab with PDF/CSV Export Engine
  └── Build Settings Screen with Account Login, Reminders, History Slider & Interactive FAQ Accordion

Phase 4: World-Class Paywall & RevenueCat Integration
  ├── Connect RevenueCat iOS SDK
  ├── Build high-converting Paywall UI powered by remote pricing.json
  └── Implement trial status checks & entitlement guards

Phase 5: Verification & EAS iOS Build
  ├── Run local unit & integration checks
  └── Trigger EAS iOS TestFlight Build
```

---

## 🧪 Verification Plan

### Automated Verification
* `npx tsc --noEmit`: Ensure zero TypeScript compilation errors across all screens and services.
* `npx expo lint`: Code syntax and React Native hook verification.

### Manual & Native Verification
1. **Sign in with Apple & Guest Mode**: Test guest session creation on 1st launch, and seamless 1-tap FaceID upgrade to Apple Sign-In.
2. **Google Cloud Function Auth & Rate Limiter**: Verify API requests send valid user token and enforce daily quota limits before invoking Gemini API.
3. **Camera & Voice Flow**: Verify image capture and 3-second audio prompt execution.
4. **PDF / CSV Export**: Generate PDF report and trigger iOS native share sheet to confirm file integrity.
5. **EAS Build Increment**: Execute `eas build --profile preview --platform ios --local` to verify dynamic `buildNumber` auto-increment.
