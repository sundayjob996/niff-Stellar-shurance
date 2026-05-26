import type { Meta, StoryObj } from '@storybook/react';
import { QuorumProgressBar } from './QuorumProgressBar';

const meta: Meta<typeof QuorumProgressBar> = {
  title: 'Claims/QuorumProgressBar',
  component: QuorumProgressBar,
  tags: ['autodocs'],
  argTypes: {
    approvePct: { control: { type: 'range', min: 0, max: 100 } },
    rejectPct: { control: { type: 'range', min: 0, max: 100 } },
    quorumThresholdPct: { control: { type: 'range', min: 0, max: 100 } },
  },
};
export default meta;
type Story = StoryObj<typeof QuorumProgressBar>;

export const QuorumMet: Story = {
  args: { approvePct: 45, rejectPct: 30, quorumThresholdPct: 50 },
};

export const QuorumNotMet: Story = {
  args: { approvePct: 20, rejectPct: 15, quorumThresholdPct: 50 },
};

export const Tied: Story = {
  args: { approvePct: 35, rejectPct: 35, quorumThresholdPct: 50 },
};
