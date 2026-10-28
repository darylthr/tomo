import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../server/api';
import { ServerError } from '../server/client';
import { useLibrary } from '../library/libraryStore';
import { RestorePage } from './RestorePage';

vi.mock('../server/api', () => ({
  validateBackup: vi.fn(),
  restoreBackup: vi.fn(),
  getRestoreStatus: vi.fn(),
}));

const file = new File(['x'.repeat(2048)], 'mihon_2026-10-27.tachibk');

function open() {
  render(
    <MemoryRouter>
      <RestorePage />
    </MemoryRouter>,
  );
}
const choose = async () => {
  fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } });
  await act(async () => {});
};

beforeEach(() => {
  vi.mocked(api.validateBackup).mockReset().mockResolvedValue([]);
  vi.mocked(api.restoreBackup).mockReset();
  vi.mocked(api.getRestoreStatus).mockReset();
  useLibrary.setState({ refresh: vi.fn(async () => {}) });
});
afterEach(() => vi.useRealTimers());

it('checks a chosen backup and offers to restore it', async () => {
  open();
  await choose();
  expect(api.validateBackup).toHaveBeenCalledWith(file);
  expect(screen.getByText('mihon_2026-10-27.tachibk')).toBeInTheDocument();
  expect(screen.getByText('2 KB')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
});

it('lists the sources the server lacks and restores anyway on request', async () => {
  vi.mocked(api.validateBackup).mockResolvedValue([
    { id: '1', name: 'MangaDex' },
    { id: '2', name: 'Asura Scans' },
  ]);
  open();
  await choose();
  expect(screen.getByText('2 sources aren’t installed on your server')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Missing sources' })).toHaveTextContent('MangaDexAsura Scans');
  expect(screen.getByRole('button', { name: 'Restore anyway' })).toBeInTheDocument();
});

it('can still restore on a server that cannot check a backup first', async () => {
  vi.mocked(api.validateBackup).mockRejectedValue(new ServerError('version'));
  open();
  await choose();
  expect(screen.getByText(/couldn't check this backup first/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
});

it('shows why a backup could not be read', async () => {
  vi.mocked(api.validateBackup).mockRejectedValue(new ServerError('unreachable'));
  open();
  await choose();
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't read that backup. Can't reach your server.");
});

it('follows the restore until the server is done, then reloads the library', async () => {
  vi.useFakeTimers();
  vi.mocked(api.restoreBackup).mockResolvedValue({ id: 'r1', status: { state: 'restoring', done: 0, total: 40 } });
  vi.mocked(api.getRestoreStatus)
    .mockResolvedValueOnce({ state: 'restoring', done: 12, total: 40 })
    .mockResolvedValueOnce({ state: 'success', done: 40, total: 40 });
  open();
  await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
  await act(async () => {});
  expect(screen.getByText('0 of 40 titles')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText('12 of 40 titles')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText('Backup restored')).toBeInTheDocument();
  expect(api.getRestoreStatus).toHaveBeenCalledWith('r1');
  expect(useLibrary.getState().refresh).toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Open your library' })).toBeInTheDocument();
});

it('says so when the server fails the restore', async () => {
  vi.mocked(api.restoreBackup).mockResolvedValue({ id: 'r1', status: { state: 'failure', done: 3, total: 40 } });
  open();
  await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
  await act(async () => {});
  expect(screen.getByRole('alert')).toHaveTextContent('The server could not restore that backup.');
});
