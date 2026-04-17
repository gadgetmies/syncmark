import { Bookmark } from '../types';
import { ExternalLink, Trash2, Tag, Calendar, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BookmarkCardProps {
  key?: string;
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

export function BookmarkCard({ bookmark, onDelete }: BookmarkCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bookmark-card"
    >
      <div className="card-main">
        <div className="card-info">
          <div className="card-title-row">
            <div className="card-icon">
              <Globe size={18} />
            </div>
            <h3 className="card-title">
              {bookmark.title}
            </h3>
          </div>
          <p className="card-url">
            {bookmark.url}
          </p>
          
          <div className="card-tags">
            <span className="tag-category">
              <Tag size={10} />
              {bookmark.category}
            </span>
            {bookmark.tags.map(tag => (
              <span key={tag} className="tag-item">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="card-actions">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn"
            title="Open Link"
          >
            <ExternalLink size={18} />
          </a>
          <button
            onClick={() => onDelete(bookmark.id)}
            className="action-btn action-btn-delete"
            title="Delete Bookmark"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <div className="card-footer">
        <div className="footer-date">
          <Calendar size={10} />
          {new Date(bookmark.createdAt).toLocaleDateString()}
        </div>
      </div>
    </motion.div>
  );
}
