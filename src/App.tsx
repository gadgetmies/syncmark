import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Plus, 
  Search, 
  FileJson, 
  FolderPlus, 
  Download, 
  Settings, 
  Github, 
  Chrome, 
  Compass,
  Info,
  AlertCircle,
  CheckCircle2,
  Save,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, BookmarkFile } from './types';
import { 
  getFileHandle, 
  createNewFile, 
  readFile, 
  writeFile, 
  isFileSystemApiSupported,
  uploadFileFallback,
  downloadFileFallback
} from './lib/fileSystem';
import { BookmarkCard } from './components/BookmarkCard';
import './App.css';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export default function App() {
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [data, setData] = useState<BookmarkFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ title: '', url: '', category: 'General', tags: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'extension'>('bookmarks');

  const isSupported = isFileSystemApiSupported();
  const isNative = Capacitor.isNativePlatform();

  // Load from native file or cache on mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (isNative) {
        const nativeContent = await readFile('native-bookmarks' as any);
        if (nativeContent) {
          setData(nativeContent);
          setFileHandle('native-bookmarks' as any);
          showStatus('success', 'Native bookmarks synced');
          return;
        }
      }

      const cachedData = localStorage.getItem('syncmark_cache');
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setData(parsed);
          showStatus('info', 'Loaded from local cache');
        } catch (err) {
          console.error('Failed to parse cache', err);
        }
      }
    };

    loadInitialData();

    // Listen for app focus/resume to refresh data if needed
    if (isNative) {
      const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          loadInitialData();
        }
      });
      return () => {
        listener.then(l => l.remove());
      };
    }
  }, [isNative]);

  // Save to local storage whenever data changes
  useEffect(() => {
    if (data) {
      localStorage.setItem('syncmark_cache', JSON.stringify(data));
    }
  }, [data]);

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ADD_BOOKMARK') {
        const { title, url } = event.data.bookmark;
        if (data) {
          const bookmark: Bookmark = {
            id: crypto.randomUUID(),
            title: title || new URL(url).hostname,
            url: url,
            category: 'General',
            tags: ['from-extension'],
            createdAt: Date.now()
          };
          setData({
            ...data,
            bookmarks: [bookmark, ...data.bookmarks]
          });
          showStatus('success', 'Bookmark added from extension');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [data]);

  // Auto-save effect
  useEffect(() => {
    if (fileHandle && data && isSupported) {
      const timer = setTimeout(() => {
        handleSave();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const handleOpenFile = async () => {
    if (isNative) {
      // On native, we "Import" by using the browser picker and then saving to native storage
      const content = await uploadFileFallback();
      if (content) {
        setData(content);
        const handle = 'native-bookmarks' as any;
        setFileHandle(handle);
        await writeFile(handle, content);
        showStatus('success', 'File imported to native storage');
      }
      return;
    }

    if (isSupported) {
      const handle = await getFileHandle();
      if (handle) {
        const content = await readFile(handle);
        if (content) {
          setFileHandle(handle);
          setData(content);
          showStatus('success', 'File loaded successfully');
        } else {
          showStatus('error', 'Failed to read file or invalid format');
        }
      }
    } else {
      const content = await uploadFileFallback();
      if (content) {
        setData(content);
        showStatus('success', 'File uploaded successfully');
      }
    }
  };

  const handleCreateFile = async () => {
    const initialData: BookmarkFile = {
      version: '1.0.0',
      bookmarks: [],
      categories: ['General', 'Work', 'Personal', 'Reading List']
    };

    if (isSupported) {
      const handle = await createNewFile();
      if (handle) {
        const success = await writeFile(handle, initialData);
        if (success) {
          setFileHandle(handle);
          setData(initialData);
          showStatus('success', 'New bookmark file created');
        }
      }
    } else {
      setData(initialData);
      downloadFileFallback(initialData, 'bookmarks.json');
      showStatus('success', 'New bookmark file downloaded');
    }
  };

  const handleSave = async () => {
    if (data) {
      if (fileHandle && isSupported) {
        const success = await writeFile(fileHandle, data);
        if (success) {
          console.log('Auto-saved');
        }
      } else if (!isSupported) {
        downloadFileFallback(data, 'bookmarks.json');
        showStatus('success', 'Bookmarks downloaded');
      }
    }
  };

  const showStatus = (type: 'success' | 'error' | 'info', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const addBookmark = (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      title: newBookmark.title || new URL(newBookmark.url).hostname,
      url: newBookmark.url,
      category: newBookmark.category,
      tags: newBookmark.tags.split(',').map(t => t.trim()).filter(t => t),
      createdAt: Date.now()
    };

    setData({
      ...data,
      bookmarks: [bookmark, ...data.bookmarks]
    });
    setIsAdding(false);
    setNewBookmark({ title: '', url: '', category: 'General', tags: '' });
    showStatus('success', 'Bookmark added');
  };

  const deleteBookmark = (id: string) => {
    if (!data) return;
    setData({
      ...data,
      bookmarks: data.bookmarks.filter(b => b.id !== id)
    });
    showStatus('info', 'Bookmark removed');
  };

  const filteredBookmarks = useMemo(() => {
    if (!data) return [];
    return data.bookmarks.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            b.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || b.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [data, searchQuery, selectedCategory]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo-section">
            <div className="logo-box">
              <FileJson size={24} />
            </div>
            <div className="logo-text">
              <h1>SyncMark</h1>
              <p>Local-First Sync</p>
            </div>
          </div>

          <nav className="nav-tabs">
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`nav-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
            >
              Bookmarks
            </button>
            <button
              onClick={() => setActiveTab('extension')}
              className={`nav-tab ${activeTab === 'extension' ? 'active' : ''}`}
            >
              Extension Guide
            </button>
          </nav>

          <div className="header-actions">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showStatus('success', 'Dashboard URL copied to clipboard');
              }}
              className="btn-copy-url"
              title="Copy Dashboard URL for Extension"
            >
              <Download size={14} />
              Copy App URL
            </button>
            {fileHandle ? (
              <div className="file-status">
                <div className="status-dot" />
                {fileHandle.name}
              </div>
            ) : (
              <div className="footer-text" style={{ fontStyle: 'italic' }}>No file connected</div>
            )}
            <button className="action-btn">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'bookmarks' ? (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {!data ? (
                <div className="empty-state">
                  <div className="empty-icon-box">
                    <RefreshCw size={40} className="animate-spin-slow" />
                  </div>
                  <h2>Connect your Bookmarks File</h2>
                  <p>
                    {isSupported 
                      ? "SyncMark stores everything in a local JSON file. Place this file in your iCloud, Dropbox, or Google Drive folder to sync across devices."
                      : "Your browser doesn't support direct file sync. You can upload your bookmarks.json file to edit it, and download it to save changes."}
                  </p>
                  <div className="btn-group">
                    <button
                      onClick={handleOpenFile}
                      className="btn-main btn-primary"
                    >
                      <FileJson size={20} />
                      {isSupported ? "Open Existing File" : "Upload Bookmarks File"}
                    </button>
                    <button
                      onClick={handleCreateFile}
                      className="btn-main btn-outline"
                    >
                      <FolderPlus size={20} />
                      {isSupported ? "Create New File" : "Download New Template"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bookmarks-list-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Toolbar */}
                  <div className="toolbar">
                    <div className="search-box">
                      <Search className="search-icon" size={18} />
                      <input
                        type="text"
                        placeholder="Search bookmarks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <div className="filter-bar">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`filter-btn ${selectedCategory === null ? 'active' : ''}`}
                      >
                        All
                      </button>
                      {data.categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                        >
                          {cat}
                        </button>
                      ))}
                      <button
                        onClick={() => setIsAdding(true)}
                        className="btn-add-new"
                      >
                        <Plus size={18} />
                        Add New
                      </button>
                      {!isSupported && (
                        <button
                          onClick={handleSave}
                          className="btn-main btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        >
                          <Save size={18} />
                          Save & Download
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="grid-container">
                    <AnimatePresence>
                      {filteredBookmarks.map(bookmark => (
                        <BookmarkCard
                          key={bookmark.id}
                          bookmark={bookmark}
                          onDelete={deleteBookmark}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {filteredBookmarks.length === 0 && (
                    <div className="empty-state">
                      <div className="empty-icon-box">
                        <Search size={32} />
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>No bookmarks found</h3>
                      <p>Try adjusting your search or category filter.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="extension"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="guide-container"
            >
              <div className="guide-card">
                <h2 className="guide-title">
                  <Chrome size={24} style={{ color: 'var(--primary)' }} />
                  Browser Extension Guide
                </h2>
                
                <div className="guide-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <section className="guide-section">
                    <h3>
                      <Info size={20} style={{ color: 'var(--info)' }} />
                      The "Bridge" Concept
                    </h3>
                    <p className="guide-text">
                      Browsers prevent extensions from writing directly to your files for security. 
                      This dashboard acts as a <strong>secure bridge</strong>:
                    </p>
                    <ul className="bridge-steps">
                      <li className="bridge-step">
                        <div className="step-number">1</div>
                        <span>You grant this dashboard permission to access your <code>bookmarks.json</code> file.</span>
                      </li>
                      <li className="bridge-step">
                        <div className="step-number">2</div>
                        <span>The extension detects this open tab and sends new bookmarks to it.</span>
                      </li>
                      <li className="bridge-step">
                        <div className="step-number">3</div>
                        <span>This dashboard then writes the data into your local file instantly.</span>
                      </li>
                    </ul>
                  </section>

                  <div className="browser-grid">
                    <div className="browser-card">
                      <div className="browser-icon">
                        <Chrome size={24} />
                      </div>
                      <h4>Chrome / Edge</h4>
                      <p>Support for Manifest V3 and background service workers.</p>
                      <button className="btn-download">
                        Download Manifest
                      </button>
                    </div>
                    
                    <div className="browser-card">
                      <div className="browser-icon" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                        <Compass size={24} />
                      </div>
                      <h4>Safari</h4>
                      <p>Native support via Web Extensions API in macOS Monterey+.</p>
                      <button className="btn-download">
                        View Safari Setup
                      </button>
                    </div>
                  </div>

                  <section className="alert-box">
                    <h4 className="alert-title">
                      <AlertCircle size={18} />
                      Installation Steps
                    </h4>
                    <ol className="alert-list">
                      <li>Download the extension source code from the project tree.</li>
                      <li><strong>For Chrome / Edge:</strong>
                        <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
                          <li>Open <code>chrome://extensions</code>.</li>
                          <li>Enable "Developer mode".</li>
                          <li>Click "Load unpacked" and select <code>extension/chrome</code>.</li>
                        </ul>
                      </li>
                      <li><strong>For Safari:</strong>
                        <ul style={{ marginTop: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1.5rem' }}>
                          <li>Go to <strong>Safari &gt; Settings &gt; Advanced</strong> and check "Show Develop menu".</li>
                          <li>Go to <strong>Develop &gt; Allow Unsigned Extensions</strong>.</li>
                          <li>Safari Web Extensions are usually packaged via Xcode, but you can test by converting the folder: <code>xcrun safari-web-extension-converter extension/safari</code>.</li>
                        </ul>
                      </li>
                    </ol>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="modal-overlay"
              style={{ position: 'absolute', backgroundColor: 'transparent' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modal-content"
            >
              <div className="modal-header">
                <h2>Add New Bookmark</h2>
              </div>
              <form onSubmit={addBookmark} className="modal-body">
                <div className="form-group">
                  <label className="form-label">URL</label>
                  <input
                    required
                    type="url"
                    placeholder="https://example.com"
                    value={newBookmark.url}
                    onChange={e => setNewBookmark({ ...newBookmark, url: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="My Favorite Site"
                    value={newBookmark.title}
                    onChange={e => setNewBookmark({ ...newBookmark, title: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      value={newBookmark.category}
                      onChange={e => setNewBookmark({ ...newBookmark, category: e.target.value })}
                      className="form-input"
                    >
                      {data?.categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tags (Comma separated)</label>
                    <input
                      type="text"
                      placeholder="dev, design, tools"
                      value={newBookmark.tags}
                      onChange={e => setNewBookmark({ ...newBookmark, tags: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-save"
                  >
                    Save Bookmark
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Toast */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="toast-container"
          >
            <div className={`toast toast-${status.type}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} className="toast-icon" /> : 
               status.type === 'error' ? <AlertCircle size={18} className="toast-icon" /> : 
               <Info size={18} className="toast-icon" />}
              <span className="toast-text">{status.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-links">
            <a href="#" className="footer-link">
              <Github size={20} />
            </a>
            <a href="#" className="footer-link">
              <Chrome size={20} />
            </a>
          </div>
          <p className="footer-text">
            &copy; 2026 SyncMark. Local-first, privacy-focused bookmarking.
          </p>
        </div>
      </footer>
    </div>
  );
}
