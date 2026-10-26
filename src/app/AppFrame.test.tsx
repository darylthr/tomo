import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUpdates } from '../features/updates/updatesStore';
import { AppFrame } from './AppFrame';

it('checks for new chapters once per app open, however often the frame mounts', () => {
  const check = vi.fn(async () => {});
  useUpdates.setState({ check });
  const first = render(<MemoryRouter><AppFrame /></MemoryRouter>);
  first.unmount();
  render(<MemoryRouter><AppFrame /></MemoryRouter>);
  expect(check).toHaveBeenCalledTimes(1);
});
