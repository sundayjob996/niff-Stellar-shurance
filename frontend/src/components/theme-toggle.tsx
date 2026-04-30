'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { type Theme, useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';

const THEMES: Theme[] = ['light', 'dark', 'system'];

function getNextTheme(current: Theme): Theme {
  const idx = THEMES.indexOf(current);
  return THEMES[(idx + 1) % THEMES.length];
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const iconMap = {
    light: <Sun className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />,
    dark: <Moon className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />,
    system: <Laptop className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />,
  };

  const labelMap = {
    light: 'Switch to dark theme',
    dark: 'Switch to system theme',
    system: 'Switch to light theme',
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(getNextTheme(theme))}
      aria-label={labelMap[theme]}
      title={`Current theme: ${theme}. Click to change.`}
    >
      {iconMap[theme]}
    </Button>
  );
}
