import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';

export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Renders `ui` on every route of a memory router starting at `path`, with a location probe. */
export function renderWithRouter(ui: ReactNode, path = '/') {
  const element = (
    <>
      {ui}
      <LocationProbe />
    </>
  );
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/updates', element },
      { path: '/history', element },
      { path: '/search', element },
      { path: '*', element },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}
