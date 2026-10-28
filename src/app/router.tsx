import type { RouteObject } from 'react-router-dom';
import { LibraryPage } from '../features/library/LibraryPage';
import { AppFrame } from './AppFrame';

/** Pages other than the shelf load when first opened, so the first paint parses less script. */
const page = (load: () => Promise<Record<string, unknown>>, name: string) => async () => ({
  Component: (await load())[name] as React.ComponentType,
});

/** Pages worth fetching once the shelf is up, so a first tap doesn't wait on the network. */
export function prefetchPages() {
  void import('../features/title/TitlePage');
  void import('../features/reader/ReaderPage');
  void import('../features/updates/UpdatesPage');
  void import('../features/history/HistoryPage');
  void import('../features/search/SearchPage');
  void import('../features/settings/SettingsPage');
}

export const routes: RouteObject[] = [
  {
    element: <AppFrame />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'updates', lazy: page(() => import('../features/updates/UpdatesPage'), 'UpdatesPage') },
      { path: 'history', lazy: page(() => import('../features/history/HistoryPage'), 'HistoryPage') },
      { path: 'insights', lazy: page(() => import('../features/insights/InsightsPage'), 'InsightsPage') },
      { path: 'search', lazy: page(() => import('../features/search/SearchPage'), 'SearchPage') },
      { path: 'search/source/:sourceId', lazy: page(() => import('../features/search/SourcePage'), 'SourcePage') },
      { path: 'search/files', lazy: page(() => import('../features/novels/FilesPage'), 'FilesPage') },
      { path: 'settings', lazy: page(() => import('../features/settings/SettingsPage'), 'SettingsPage') },
      { path: 'settings/server', lazy: page(() => import('../features/settings/ServerSettings'), 'ServerSettings') },
      { path: 'settings/library', lazy: page(() => import('../features/settings/LibrarySettings'), 'LibrarySettings') },
      { path: 'settings/reader', lazy: page(() => import('../features/settings/ReaderSettings'), 'ReaderSettings') },
      { path: 'settings/appearance', lazy: page(() => import('../features/settings/AppearanceSettings'), 'AppearanceSettings') },
      { path: 'settings/categories', lazy: page(() => import('../features/categories/CategoriesPage'), 'CategoriesPage') },
      { path: 'settings/restore', lazy: page(() => import('../features/backup/RestorePage'), 'RestorePage') },
      { path: 'title/:id', lazy: page(() => import('../features/title/TitlePage'), 'TitlePage') },
      { path: '*', element: <LibraryPage /> },
    ],
  },
  // The reader takes the whole screen, outside the app frame.
  { path: 'read/:chapterId', lazy: page(() => import('../features/reader/ReaderPage'), 'ReaderPage') },
  { path: 'novel/:id', lazy: page(() => import('../features/novels/NovelReaderPage'), 'NovelReaderPage') },
];
