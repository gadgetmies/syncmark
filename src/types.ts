export interface Bookmark {
  id: string;
  title: string;
  url: string;
  category: string;
  tags: string[];
  createdAt: number;
  icon?: string;
}

export interface BookmarkFile {
  version: string;
  bookmarks: Bookmark[];
  categories: string[];
}
