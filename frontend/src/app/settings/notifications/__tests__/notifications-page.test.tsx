/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import NotificationsPage from '../page'
import {
  getNotificationPreferences,
  patchNotificationPreferences,
} from '@/lib/api/notifications'

jest.mock('@/lib/api/notifications', () => ({
  getNotificationPreferences: jest.fn(),
  patchNotificationPreferences: jest.fn(),
}))

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ jwt: 'mock-jwt-token' }),
}))

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({ address: 'GABC123' }),
}))

const mockGet = getNotificationPreferences as jest.MockedFunction<typeof getNotificationPreferences>
const mockPatch = patchNotificationPreferences as jest.MockedFunction<typeof patchNotificationPreferences>

const defaultPrefs = {
  renewalRemindersEnabled: true,
  claimUpdatesEnabled: true,
  voteRemindersEnabled: false,
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockResolvedValue(defaultPrefs)
    mockPatch.mockResolvedValue(undefined)
  })

  it('fetches and shows current preferences on load', async () => {
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /policy renewal reminders/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('switch', { name: /policy renewal reminders/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /claim status updates/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /vote reminders/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('renders all three notification toggles', async () => {
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /policy renewal reminders/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('switch', { name: /claim status updates/i })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /vote reminders/i })).toBeInTheDocument()
  })

  it('toggles a preference when clicking the switch', async () => {
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /vote reminders/i })).toBeInTheDocument()
    })

    const toggle = screen.getByRole('switch', { name: /vote reminders/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('saves updated preferences and shows success confirmation', async () => {
    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /vote reminders/i })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('switch', { name: /vote reminders/i }))
    await userEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByText(/preferences saved/i)).toBeInTheDocument()
    })

    expect(mockPatch).toHaveBeenCalledWith(
      'GABC123',
      { ...defaultPrefs, voteRemindersEnabled: true },
      'mock-jwt-token',
    )
  })

  it('shows inline error without resetting unsaved changes on API failure', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Network error'))

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /vote reminders/i })).toBeInTheDocument()
    })

    // Toggle vote reminders on
    await userEvent.click(screen.getByRole('switch', { name: /vote reminders/i }))
    expect(screen.getByRole('switch', { name: /vote reminders/i })).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })

    // Toggle state is preserved (unsaved changes not lost)
    expect(screen.getByRole('switch', { name: /vote reminders/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows loading state while fetching', () => {
    mockGet.mockImplementation(() => new Promise(() => {}))

    render(<NotificationsPage />)
    expect(screen.getByText(/loading preferences/i)).toBeInTheDocument()
  })

  it('shows fetch error when loading fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'))

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch')
    })
  })
})
