/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useFeatureFlag } from '../use-feature-flag';

jest.mock('@/config/env', () => ({
  getConfig: () => ({ apiUrl: 'https://api.test' }),
}));

jest.mock('@/lib/api/fetch', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '@/lib/api/fetch';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useFeatureFlag', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns loading=true initially', () => {
    (apiFetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useFeatureFlag('my-flag'), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.enabled).toBe(false);
  });

  it('returns enabled=true when flag is enabled', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ key: 'my-flag', enabled: true });
    const { result } = renderHook(() => useFeatureFlag('my-flag'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(true);
  });

  it('returns enabled=false when flag is disabled', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ key: 'my-flag', enabled: false });
    const { result } = renderHook(() => useFeatureFlag('my-flag'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it('returns enabled=false on fetch error', async () => {
    (apiFetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useFeatureFlag('my-flag'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });
});
