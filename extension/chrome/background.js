// Background script for Chrome Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('SyncMark installed');
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ADD_BOOKMARK') {
    handleAddBookmark(message.bookmark, sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleAddBookmark(bookmark, sendResponse) {
  try {
    // 1. Try to find an open manager tab
    const allTabs = await chrome.tabs.query({});
    const managerTab = allTabs.find(t => 
      t.url?.includes('manager.html') || 
      t.title?.includes('SyncMark') ||
      t.url?.includes('run.app')
    );

    if (managerTab) {
      // Forward to manager tab with a specific type to avoid double handling
      chrome.tabs.sendMessage(managerTab.id, {
        type: 'MANAGER_ADD_BOOKMARK',
        bookmark
      }, (response) => {
        if (chrome.runtime.lastError) {
          queueBookmark(bookmark, sendResponse);
        } else {
          sendResponse(response || { success: true });
        }
      });
    } else {
      // No manager open, queue it
      queueBookmark(bookmark, sendResponse);
    }
  } catch (err) {
    console.error('Error in background:', err);
    queueBookmark(bookmark, sendResponse);
  }
}

async function queueBookmark(bookmark, sendResponse) {
  try {
    const result = await chrome.storage.local.get('pendingBookmarks');
    const pending = result.pendingBookmarks || [];
    pending.push({
      ...bookmark,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    });
    await chrome.storage.local.set({ pendingBookmarks: pending });
    console.log('Bookmark queued for sync');
    sendResponse({ success: true, queued: true });
  } catch (err) {
    console.error('Failed to queue bookmark:', err);
    sendResponse({ success: false, error: 'Failed to queue bookmark' });
  }
}
