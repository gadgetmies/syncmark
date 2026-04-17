# Releasing SyncMark Extensions

This document outlines the steps to prepare and release the SyncMark extension for both Chrome and Safari.

## 1. Chrome Web Store

### Preparation
1.  **Manifest**: Verify `extension/chrome/manifest.json` has the correct version number.
2.  **Zip**: Create a ZIP archive of the **contents** of the `extension/chrome` directory (not the directory itself).

### Submission
1.  Go to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole/).
2.  Click **"Add new item"**.
3.  Upload the ZIP file.
4.  Fill in the store listing details (Description, Screenshots, Category).
5.  Submit for review.

---

## 2. Safari App Store (Desktop)

### Preparation
1.  **Xcode**: Open the project in Xcode.
2.  **Manifest**: Verify `extension/safari/manifest.json` has the correct version number.
3.  **Build**:
    *   Select the **SyncMark** target.
    *   Set the build destination to **Any Mac (Apple Silicon, Intel)**.
    *   Go to **Product > Archive**.

### Submission
1.  Once the archive is complete, the **Organizer** window will open.
2.  Click **"Distribute App"**.
3.  Select **"App Store Connect"** and follow the prompts to upload.

---

## 3. iOS Native App (App Store)

### Preparation
1.  **Build**: Run `npm run build`.
2.  **Sync**: Run `npx cap sync ios`.
3.  **Xcode**: Open the `ios/App` project in Xcode: `npx cap open ios`.
4.  **Icons**: Set your app icons in `App/App/Assets.xcassets`.

### Submission
1.  Select **Any iOS Device (arm64)** as the target.
2.  Go to **Product > Archive**.
3.  In the Organizer, click **"Distribute App"** and upload to App Store Connect.

---

## 4. Versioning Strategy
*   Always increment the `version` field in both `manifest.json` files before a new release.
*   Use [Semantic Versioning](https://semver.org/) (e.g., `1.0.1`, `1.1.0`).

## 5. Testing Before Release
*   **Chrome**: Load the unpacked extension in Chrome (`chrome://extensions/`) and test all features (Add, Sync, Import, Search).
*   **Safari**: Run the extension from Xcode and test all features in Safari.
*   **Data Integrity**: Ensure the local file sync works correctly and no data is lost during updates.
