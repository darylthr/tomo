import type { RouteObject } from 'react-router-dom';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { InsightsPage } from '../features/insights/InsightsPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { SearchPage } from '../features/search/SearchPage';
import { SourcePage } from '../features/search/SourcePage';
import { AppearanceSettings } from '../features/settings/AppearanceSettings';
import { LibrarySettings } from '../features/settings/LibrarySettings';
import { ReaderSettings } from '../features/settings/ReaderSettings';
import { ServerSettings } from '../features/settings/ServerSettings';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TitlePage } from '../features/title/TitlePage';
import { UpdatesPage } from '../features/updates/UpdatesPage';
import { AppFrame } from './AppFrame';

export const routes: RouteObject[] = [
  {
    element: <AppFrame />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'updates', element: <UpdatesPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'search/source/:sourceId', element: <SourcePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/server', element: <ServerSettings /> },
      { path: 'settings/library', element: <LibrarySettings /> },
      { path: 'settings/reader', element: <ReaderSettings /> },
      { path: 'settings/appearance', element: <AppearanceSettings /> },
      { path: 'settings/categories', element: <CategoriesPage /> },
      { path: 'title/:id', element: <TitlePage /> },
      { path: '*', element: <LibraryPage /> },
    ],
  },
  // The reader takes the whole screen, outside the app frame.
  { path: 'read/:chapterId', element: <ReaderPage /> },
];
