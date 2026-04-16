# FireStick Scout

FireStick Scout is a lightweight Android/Fire OS app that runs on Fire TV
devices and reports their status to the Sports Bar TV Controller server.
It enables the AI Game Plan to know which streaming apps are installed,
logged in, and what content is currently playing.

> **No binary APKs in this directory.** Pre-built APKs are not committed to
> git (as of April 2026). Rebuild locally with:
>
>     bash scripts/install-android-build-env.sh  # one-time SDK + JDK setup
>     cd firestick-scout
>     echo "scoutServerUrl=http://<YOUR_SERVER_IP>:3001/api/firestick-scout" >> local.properties
>     ./gradlew assembleDebug
>     adb install -r app/build/outputs/apk/debug/app-debug.apk
>
> See `docs/NEW_LOCATION_SETUP.md` section "Fire TV Setup" for the full flow.

See `FIRESTICK_SCOUT_APK_SPEC.md` for the full app specification.
