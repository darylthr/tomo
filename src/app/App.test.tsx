import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the Tomo brand', () => {
  render(<App />);
  expect(screen.getByRole('img', { name: 'Tomo' })).toBeInTheDocument();
});
