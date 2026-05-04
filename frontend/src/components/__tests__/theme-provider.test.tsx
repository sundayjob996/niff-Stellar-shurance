/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import { ThemeProvider, useTheme } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'

const STORAGE_KEY = 'niffyinsur-theme'

function TestConsumer() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light
      </button>
      <button onClick={() => setTheme('system')} data-testid="set-system">
        Set System
      </button>
    </div>
  )
}

function renderWithProvider(ui: React.ReactElement, initialTheme?: string) {
  if (initialTheme !== undefined) {
    localStorage.setItem(STORAGE_KEY, initialTheme)
  }
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  describe('system preference detection', () => {
    it('defaults to light when no preference is stored and system is light', () => {
      jest.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))

      renderWithProvider(<TestConsumer />)

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    })

    it('detects dark when system preference is dark and no preference is stored', () => {
      jest.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))

      renderWithProvider(<TestConsumer />)

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })
  })

  describe('persistence', () => {
    it('reads stored theme from localStorage on mount', () => {
      localStorage.setItem(STORAGE_KEY, 'dark')

      renderWithProvider(<TestConsumer />)

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })

    it('persists theme change to localStorage', () => {
      renderWithProvider(<TestConsumer />)

      fireEvent.click(screen.getByTestId('set-dark'))

      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })

    it('applies correct class to document element when theme changes', () => {
      renderWithProvider(<TestConsumer />)

      fireEvent.click(screen.getByTestId('set-dark'))

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('applies light class when light theme is set', () => {
      renderWithProvider(<TestConsumer />)

      fireEvent.click(screen.getByTestId('set-light'))

      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('resolves system theme to actual value when system is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'system')
      jest.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))

      renderWithProvider(<TestConsumer />)

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })
  })
})

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  it('renders the toggle button', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('cycles from light to dark on click', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
        <TestConsumer />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }))

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
  })

  it('cycles from dark to system on click', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
        <TestConsumer />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /switch to system theme/i }))

    expect(screen.getByTestId('current-theme')).toHaveTextContent('system')
  })

  it('cycles from system back to light on click', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
        <TestConsumer />
      </ThemeProvider>
    )

    // dark → system
    fireEvent.click(screen.getByRole('button', { name: /switch to system theme/i }))
    expect(screen.getByTestId('current-theme')).toHaveTextContent('system')

    // system → light
    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }))
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
  })

  it('updates aria-label based on current theme', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark theme')
  })
})
