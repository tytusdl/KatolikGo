// Shim for Expo SDK 54 + expo-router v6 on Windows.
//
// `node_modules/expo/AppEntry.js` still does `import App from '../../App'` and
// calls `registerRootComponent(App)`. The iOS prebuilt bundle follows that
// legacy path even when `package.json` main is `expo-router/entry`, so without a
// root App.* the iOS bundle 500s and Expo Go shows "no usable data found".
//
// Re-exporting expo-router's default export as the App keeps both legacy (iOS)
// and modern (`main: index.js`) entry paths pointing at the same root component.
import App from 'expo-router/entry';

export default App;