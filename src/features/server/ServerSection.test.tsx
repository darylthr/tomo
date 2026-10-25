import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '../../shared/settings/store';
import aboutFixture from './__fixtures__/about.json';
import { ServerSection } from './ServerSection';

beforeEach(() => useSettings.getState().reset());
afterEach(() => vi.unstubAllGlobals());

it('saves the server address when the field loses focus', async () => {
  render(<ServerSection />);
  const field = screen.getByRole('textbox', { name: 'Server address' });
  await userEvent.type(field, 'https://tomo.home');
  await userEvent.tab();
  expect(useSettings.getState().settings.server).toMatchObject({ url: 'https://tomo.home', configured: true });
});

it('says which Suwayomi it reached', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(aboutFixture))));
  render(<ServerSection />);
  await userEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  expect(await screen.findByText('Connected to Suwayomi v2.1.0')).toBeInTheDocument();
});

it('explains a failed connection', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
  render(<ServerSection />);
  await userEvent.click(screen.getByRole('button', { name: 'Test connection' }));
  expect(await screen.findByText("Can't reach your server")).toBeInTheDocument();
});

it('chooses the login mode', async () => {
  render(<ServerSection />);
  await userEvent.click(screen.getByRole('radio', { name: 'Basic' }));
  expect(useSettings.getState().settings.server.authMode).toBe('basic_auth');
});
