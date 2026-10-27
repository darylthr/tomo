import { renderHook } from '@testing-library/react';
import { useCrop } from './useCrop';

it('shows the page as it is when cropping is off', () => {
  const { result } = renderHook(() => useCrop('/p/1', false));
  expect(result.current).toBe('/p/1');
});

it('shows the page as it is where it cannot be measured', () => {
  // jsdom has no canvas: the page must still show, uncropped.
  const { result } = renderHook(() => useCrop('/p/2', true));
  expect(result.current).toBe('/p/2');
});
