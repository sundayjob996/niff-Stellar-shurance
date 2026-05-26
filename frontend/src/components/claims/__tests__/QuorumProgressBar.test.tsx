/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuorumProgressBar } from '../QuorumProgressBar';

describe('QuorumProgressBar', () => {
  it('renders approve and reject segments', () => {
    render(<QuorumProgressBar approvePct={40} rejectPct={20} quorumThresholdPct={50} />);
    expect(screen.getByTestId('approve-segment')).toHaveStyle({ width: '40%' });
    expect(screen.getByTestId('reject-segment')).toHaveStyle({ width: '20%' });
  });

  it('renders quorum threshold marker', () => {
    render(<QuorumProgressBar approvePct={40} rejectPct={20} quorumThresholdPct={50} />);
    expect(screen.getByTestId('quorum-marker')).toHaveStyle({ left: '50%' });
  });

  it('shows "Quorum met" when totalPct >= quorumThresholdPct', () => {
    render(<QuorumProgressBar approvePct={45} rejectPct={30} quorumThresholdPct={50} />);
    expect(screen.getByText(/quorum met/i)).toBeInTheDocument();
  });

  it('shows quorum threshold label when quorum not met', () => {
    render(<QuorumProgressBar approvePct={20} rejectPct={15} quorumThresholdPct={50} />);
    expect(screen.getByText(/quorum: 50%/i)).toBeInTheDocument();
    expect(screen.queryByText(/quorum met/i)).not.toBeInTheDocument();
  });

  it('displays percentage labels for approve and reject', () => {
    render(<QuorumProgressBar approvePct={35} rejectPct={35} quorumThresholdPct={50} />);
    expect(screen.getByText(/approve 35%/i)).toBeInTheDocument();
    expect(screen.getByText(/reject 35%/i)).toBeInTheDocument();
  });

  it('has accessible progressbar role with aria attributes', () => {
    render(<QuorumProgressBar approvePct={40} rejectPct={20} quorumThresholdPct={50} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});
