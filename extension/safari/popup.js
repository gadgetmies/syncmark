document.getElementById('addBtn').addEventListener('click', async () => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const tagsInput = document.getElementById('tagsInput');
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    // Request metadata from content script
    browser.tabs.sendMessage(tab.id, { type: 'GET_PAGE_METADATA' }, (metadata) => {
      const bookmarkData = metadata || { title: tab.title, url: tab.url };
      bookmarkData.tags = tags;
      
      // Send message to the background script
      browser.runtime.sendMessage({
        type: 'ADD_BOOKMARK',
        bookmark: bookmarkData
      }, (response) => {
        if (browser.runtime.lastError) {
          console.error(browser.runtime.lastError);
          alert('Could not connect to SyncMark. Please reload the extension.');
          return;
        }

        if (response && response.success) {
          // Visual feedback for success
          const btn = document.getElementById('addBtn');
          const originalText = btn.innerText;
          btn.innerText = response.queued ? '\u2713 Queued for Sync' : '\u2713 Added Locally';
          btn.style.background = '#10b981';
          
          // Update sync button visibility if queued
          if (response.queued) {
            checkPending();
          }

          // Save tags for suggestions
          saveTags(tags);

          setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = '#2563eb';
            tagsInput.value = '';
          }, 2000);
        } else {
          alert(response?.error || 'Failed to add bookmark');
        }
      });
    });

  } catch (err) {
    console.error('Error in popup:', err);
    alert('Could not connect to SyncMark.');
  }
});

async function saveTags(newTags) {
  const result = await browser.storage.local.get('usedTags');
  const usedTags = new Set(result.usedTags || []);
  newTags.forEach(tag => usedTags.add(tag));
  await browser.storage.local.set({ usedTags: Array.from(usedTags) });
  updateTagSuggestions();
}

async function updateTagSuggestions() {
  const result = await browser.storage.local.get('usedTags');
  const usedTags = result.usedTags || [];
  const datalist = document.getElementById('tagSuggestions');
  datalist.innerHTML = usedTags.map(tag => `<option value="${tag}">`).join('');
}

async function checkPending() {
  const result = await browser.storage.local.get('pendingBookmarks');
  const pending = result.pendingBookmarks || [];
  const manageBtn = document.getElementById('manageBtn');
  if (pending.length > 0) {
    manageBtn.innerText = `Manage & Sync ${pending.length} Bookmarks`;
    manageBtn.style.background = '#10b981'; // Green to indicate sync
  } else {
    manageBtn.innerText = 'Manage Bookmarks';
    manageBtn.style.background = '#64748b'; // Default gray
  }
}

document.getElementById('manageBtn').addEventListener('click', async () => {
  const allTabs = await browser.tabs.query({});
  const managerTab = allTabs.find(t => 
    t.url?.includes('manager.html') || 
    t.title?.includes('SyncMark') ||
    t.url?.includes('run.app')
  );

  if (managerTab) {
    browser.tabs.update(managerTab.id, { active: true });
    browser.windows.update(managerTab.windowId, { focused: true });
  } else {
    browser.tabs.create({ url: 'manager.html' });
  }
});

checkPending();
updateTagSuggestions();
