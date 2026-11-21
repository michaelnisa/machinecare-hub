# MachineCare Hub - Field Mobile App

A specialized multi-persona React Native mobile application for commercial fleet drivers, workshop mechanics, logistics dispatchers, and GPS telematics field technicians. Designed with offline-first architecture for remote African highway corridors and heavy industrial workshop yards.

---

## 📱 4 Field Personas in 1 App

The app features a top navigation badge that lets personnel switch between 4 dedicated roles:

### 1. 🚛 Commercial Fleet Driver (`DRIVER`)
- **1-Tap QR Truck Coupling**: Camera barcode scanner or manual plate entry to couple driver to truck & linked trailer.
- **60-Second Walkaround Inspection**: Pre-start checklist (Tyres, Oil & Coolant, Air Brakes, Lights, Kingpin Trailer Lock) with offline queueing.
- **Road Receipt Snapper (Safari Float)**: Snap receipts for weighbridges, road tolls, parking, and transit fuel with instant TZS currency logging.
- **Emergency SOS Beacon**: 1-tap roadside breakdown alarm sending GPS coordinates and fault severity to dispatch and workshop teams.

### 2. 🔧 Garage & Workshop Mechanic (`GARAGE`)
- **Digital Job Cards**: Live work order dashboard filtered by `Open`, `In Progress`, `Waiting Parts`, and `Completed`.
- **Repair Steps & Parts Requisition**: Check-off repair steps, log replacement spare parts used, and update vehicle return readiness.
- **Vehicle QR Lookup**: Scan windshield QR code to view complete service history, past defects, current odometer, and live battery voltage.
- **Defect Intake**: Rapid breakdown intake with severity classification and mechanical symptom notes.

### 3. 📦 Fleet & Logistics Dispatcher (`DISPATCH`)
- **Live Fleet Tracking**: Real-time vehicle list with status badges (`Moving`, `Idle / Yard`, `Stopped`) and telemetry speed / odometer.
- **Active Highway Trips**: Monitor origin-to-destination corridors (e.g. Dar es Salaam ➔ Kigali, Mombasa ➔ Kampala), cargo descriptions, and complete trips with 1 tap.
- **Quick Fuel Log**: Direct diesel logging (Litres, Total TZS, Station brand, Odometer) with offline sync.

### 4. 🛰️ GPS & Telematics Field Technician (`GPS TECH`)
- **Tracker IMEI Pairing**: Scan GPS tracker IMEI barcode and bind to vehicle plate in seconds. Supports Teltonika, Concox, Jimi, Coban, and Suntech hardware protocols.
- **Live Telemetry Diagnostics**: Real-time verification of:
  - 🛰️ Satellite Navigation Fix (3D Fix, HDOP, Satellites count, Latitude/Longitude)
  - 🔑 ACC / Ignition Wire Splice Test (Live ON/OFF indicator as ignition key is turned)
  - ⚡ Main 24V Vehicle Battery & Alternator charging
  - 📶 Cellular GSM signal strength (dBm / CSQ)
  - 🛡️ Remote Relay immobilizer fuel-cut safety test

---

## ⚡ Offline-First Architecture

In remote corridors without 4G/GSM connectivity, the app saves road receipts and pre-trip inspections locally in `@react-native-async-storage/async-storage`.

- A floating **Offline Sync Banner** appears at the top whenever items are queued.
- When an internet connection is re-established, the background **Sync Engine** automatically uploads receipts to `trip_expenses` and inspection defects to `fault_reports`.

---

## 🚀 Running the App Locally

### Prerequisites
- Node.js (v18+)
- Expo CLI (`npm install -g expo-cli` or `npx expo`)
- **Expo Go** app installed on an Android or iOS device (available on Google Play Store / Apple App Store).

### Quick Start
```bash
# Navigate to the mobile project folder
cd mobile

# Install dependencies (if not already installed)
npm install

# Start the Expo development server
npm start
```

Scan the displayed QR code with your phone camera (iOS) or the Expo Go app (Android) to launch the app instantly.

---

## 🛠️ Building Standalone Android APK

To generate an installable Android APK for field testing:

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build APK
eas build -p android --profile preview
```

---

## 📂 Project Structure

```
mobile/
├── App.tsx                     # Root application entry point
├── app.json                    # Expo configuration & app permissions
├── package.json                # React Native & Expo dependencies
├── tsconfig.json               # TypeScript path alias configuration
├── src/
│   ├── components/             # Reusable UI widgets
│   │   ├── Card.tsx            # Styled dark surface card
│   │   ├── Header.tsx          # Brand header with persona switcher
│   │   ├── OfflineBanner.tsx   # Top sync banner with queued counter
│   │   └── StatusBadge.tsx     # Color-coded operational badges
│   ├── config/
│   │   └── supabase.ts         # Supabase client with AsyncStorage
│   ├── context/
│   │   ├── AuthContext.tsx     # Multi-persona & driver vehicle binding state
│   │   └── OfflineSyncContext.tsx # Offline queue & auto-sync engine
│   ├── navigation/
│   │   └── RootNavigator.tsx   # Dynamic router responding to active role
│   ├── screens/
│   │   ├── common/             # RoleSelectScreen
│   │   ├── driver/             # 4 driver screens + dashboard
│   │   ├── garage/             # 4 workshop & job card screens
│   │   ├── fleet/              # 3 dispatcher & fuel screens
│   │   └── telematics/         # 2 GPS pairing & diagnostic screens
│   ├── services/
│   │   ├── storageService.ts   # Local async storage helpers
│   │   └── syncEngine.ts       # Auto-upload background sync engine
│   └── theme/
│       └── index.ts            # MachineCare dark theme design tokens
```
