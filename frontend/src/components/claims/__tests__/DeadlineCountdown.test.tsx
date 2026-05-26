/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { DeadlineCountdown } from '../DeadlineCountdown';

describe('DeadlineCountdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows "Expired" when currentLedger >= deadlineLedger', () => {
    render(<DeadlineCountdown deadlineLedger={100} currentLedger={100} />);
    expect(screen.getByTestId('deadline-expired')).toHaveTextContent('Expired');
  });

  it('shows "Expired" when currentLedger > deadlineLedger', () => {
    render(<DeadlineCountdown deadlineLedger={100} currentLedger={200} />);
    expect(screen.getByTestId('deadline-expired')).toBeInTheDocument();
  });

  it('displays days, hours, minutes for a multi-day deadline', () => {
    // 100000 ledgers * 5s = 500000s ≈ 5.7 days
    render(<DeadlineCountdown deadlineLedger={100100} currentLedger={100} />);
    const el = screen.getByTestId('deadline-countdown');
    expect(el.textContent).toMatch(/\d+d/);
    expect(el.textContent).toMatch(/\d+h/);
    expect(el.textContent).toMatch(/\d+m/);
  });

  it('displays hours and minutes for a sub-day deadline', () => {
    // 720 ledgers * 5s = 3600s = 1h
    render(<DeadlineCountdown deadlineLedger={820} currentLedger={100} />);
    const el = screen.getByTestId('deadline-countdown');
    expect(el.textContent).toMatch(/1h/);
    expect(el.textContent).toMatch(/0m/);
  });

  it('displays only minutes for a sub-hour deadline', () => {
    // 60 ledgers * 5s = 300s = 5m
    render(<DeadlineCountdown deadlineLedger={160} currentLedger={100} />);
    const el = screen.getByTestId('deadline-countdown');
    expect(el.textContent).not.toMatch(/\d+h/);
    expect(el.textContent).toMatch(/5m/);
  });

  it('has a tooltip explaining ledger time estimation', () => {
    render(<DeadlineCountdown deadlineLedger={1000} currentLedger={100} />);
    const el = screen.getByTestId('deadline-countdown');
    expect(el).toHaveAttribute('title');
    expect(el.getAttribute('title')).toMatch(/ledger/i);
  });

  it('advances estimate after 60 seconds', () => {
    render(<DeadlineCountdown deadlineLedger={100000} currentLedger={100} />);
    const before = screen.getByTestId('deadline-countdown').textContent;
    act(() => { jest.advanceTimersByTime(60_000); });
    const after = screen.getByTestId('deadline-countdown').textContent;
    expect(after).not.toBe(before);
  });

  it('cleans up interval on unmount', () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = render(<DeadlineCountdown deadlineLedger={1000} currentLedger={100} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
