# iOS Native App Setup Guide (Capacitor)

This guide explains how to build and run SyncMark as a native iOS application. Using a native app instead of a PWA allows for better system integration, including a deep-integrated **Share Extension**.

## 1. Prerequisites
- A Mac with **Xcode** installed.
- **Node.js** and **npm** (already used for this project).

## 2. Build the Web Project
**CRITICAL:** Capacitor works by "wrapping" your built web assets. You MUST generate the `dist` folder before syncing. In your terminal, run:
```bash
npm run build
```
This creates the `dist` directory containing your `index.html` and compiled assets.

## 3. Initialize and Open iOS Project
Ensure the `dist` folder exists, then run:
```bash
# Add the iOS platform (only needs to be done once)
npx @capacitor/cli add ios

# Sync your web code to the iOS project
# Run this EVERY time you make changes to your React code
npx @capacitor/cli sync

# Open the project in Xcode
npx @capacitor/cli open ios
```

## 4. Implementing the Share Extension (The "Share Menu" feature)
To enable bookmarking from other apps on iOS, you need to add a **Share Extension** target in Xcode:

1.  In Xcode, go to **File > New > Target...**
2.  Select **Share Extension**.
3.  Name it `SyncMarkShare`.
4.  In the `SyncMarkShare` folder, you will find `ShareViewController.swift`. Update it to pass the shared URL to the main app.

### Shared Data Logic
The Share Extension should save the shared URL to **App Groups** (shared storage between the extension and the main app) or use a custom URL scheme to open the main app with parameters:
`syncmark://add?url=https://example.com&title=Example`

## 5. Main App URL Handling
In your main app (`App.tsx`), you can use the `@capacitor/app` plugin to listen for incoming URLs:
```typescript
import { App } from '@capacitor/app';

App.addListener('appUrlOpen', data => {
  // Handle shared URL here
  console.log('App opened with URL:', data.url);
});
```

## Why Native?
- **Real Filesystem Access**: Native apps can prompt for a persistent folder/file, avoiding the "download" fallback used in browsers.
- **System-Wide Share Sheet**: A native Share Extension is the only way to get a fully branded, highly interactive bookmarking experience in the iOS share sheet.
- **Improved Performance**: Native rendering of the web layer is more optimized than standard Safari tabs.
