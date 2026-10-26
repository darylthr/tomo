import type { RouteObject } from 'react-router-dom';
import { HistoryPage } from '../features/history/HistoryPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { SearchPage } from '../features/search/SearchPage';
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
      { path: 'search', element: <SearchPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'title/:id', element: <TitlePage /> },
      { path: '*', element: <LibraryPage /> },
    ],
  },
  // The reader takes the whole screen, outside the app frame.
  { path: 'read/:chapterId', element: <ReaderPage /> },
];
