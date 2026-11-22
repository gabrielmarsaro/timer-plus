# Timer Plus — agent rules

## Always ship to every platform

Whenever you change the app, update **all** delivery surfaces in the same turn — do not leave Android or web behind.

1. **Code** — commit and push to `main` (or open/merge the feature PR).
2. **Web / iPhone** — `npm run build:docs`, redeploy the static site (ShipStatic or the current host), and put the live URL in `README.md`.
3. **Android APK** — bump `versionCode` + `versionName` in `android/app/build.gradle` (required so tablets accept the update), rebuild debug APK, copy to `releases/timer-plus-debug.apk`, update `public/baixar.html` version + `?v=` cache-bust, commit + push:
   - Link: `https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk`
4. **Smoke** — run `npm run smoke`, `node scripts/smoke-focus.mjs`, and `node scripts/smoke-stopwatch.mjs` when those areas changed.

### Android build (this environment)

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
npm run android:apk
cp -f android/app/build/outputs/apk/debug/app-debug.apk releases/timer-plus-debug.apk
```

If the SDK is missing, install cmdline-tools + `platforms;android-36` + `build-tools;36.0.0` before building. Do not claim “all platforms updated” unless the new APK is on `main` and the web URL serves the new build.

## Product notes

- iPhone = Safari / Add to Home Screen (no APK).
- Keep pause/reset/nav usable during Tabata/Rondas focus mode.
- Respect background music: hush ticks, keep start/end alerts when “Respeitar música” is on.
- Tabata music: prefer **YouTube public videos** via in-app embed / open-in-YouTube (curated links only). Offline fallback = procedural Web Audio beats. Never rip/download YouTube audio into the APK.
