# iOS Native App Setup Guide (Capacitor)

This guide explains how to build and run SyncMark as a native iOS application. Using a native app instead of a PWA allows for better system integration, including a deep-integrated **Share Extension**.

## 1. Prerequisites
- A Mac with **Xcode** installed.
- **Node.js** and **npm** (already used for this project).

## 2. Build the Web Project
First, build the React project so Capacitor has the latest files to wrap:
```bash
npm run build
```

## 3. Initialize and Open iOS Project
Run the following commands in your terminal:
```bash
# Add the iOS platform
npx cap add ios

# Sync your web code to the iOS project
npx cap sync

# Open the project in Xcode
npx cap open ios
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
