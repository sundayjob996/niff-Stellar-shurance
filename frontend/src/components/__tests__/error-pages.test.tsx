/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotFoundPage, ForbiddenPage, ErrorPage } from '../error-pages';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

describe('NotFoundPage', () => {
  it('renders title and Go Home link', () => {
    render(<NotFoundPage />);
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});

describe('ForbiddenPage', () => {
  it('renders title and Go Home link', () => {
    render(<ForbiddenPage />);
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});

describe('ErrorPage', () => {
  it('renders title and Go Home link', () => {
    render(<ErrorPage />);
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });
});
