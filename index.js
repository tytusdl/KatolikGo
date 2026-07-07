// Workaround for Expo SDK 54 + expo-router v6 on Windows:
// The CLI's iOS prebuilt-bundle endpoint resolves entry through
// `node_modules/expo/AppEntry.js` (which still does `import App from '../../App'`),
// even when `package.json` main is `expo-router/entry`. Without a root App.* the
// iOS bundle 500s and Expo Go shows "no usable data found".
//
// Routing the main field through this shim makes both web (Expo-router/entry) and
// iOS (CLI's AppEntry.js fallback) resolve to the same expo-router entry, while
// preserving a stable hook point for future polyfills.
import 'expo-router/entry';