import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs } from '../Breadcrumbs';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('<Breadcrumbs />', () => {
  it('renders the nav landmark with an Arabic aria-label', () => {
    renderWithRouter(<Breadcrumbs items={[{ label: 'الإدارة' }]} />);
    expect(screen.getByLabelText('مسار التصفح')).toBeInTheDocument();
  });

  it('renders intermediate items with `to` as <a> links', () => {
    renderWithRouter(
      <Breadcrumbs
        items={[
          { label: 'الإدارة', to: '/admin' },
          { label: 'المستخدمون', to: '/admin/users' },
          { label: 'تفاصيل' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'الإدارة' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'المستخدمون' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
  });

  it('renders the LAST item as plain text even if `to` is provided', () => {
    renderWithRouter(
      <Breadcrumbs
        items={[
          { label: 'الإدارة', to: '/admin' },
          { label: 'المستخدمون', to: '/admin/users' },
        ]}
      />,
    );
    // Last item must not be a link.
    expect(screen.queryByRole('link', { name: 'المستخدمون' })).not.toBeInTheDocument();
    expect(screen.getByText('المستخدمون')).toBeInTheDocument();
  });

  it('renders chevron separators between items but not after the last one', () => {
    const { container } = renderWithRouter(
      <Breadcrumbs items={[{ label: 'الإدارة' }, { label: 'الأدوار' }, { label: 'تعديل' }]} />,
    );
    // 3 items → 2 chevrons (one after each non-last item).
    const chevrons = container.querySelectorAll('svg[aria-hidden]');
    expect(chevrons.length).toBe(2);
  });

  it('handles the single-item case (no chevron, no link)', () => {
    const { container } = renderWithRouter(<Breadcrumbs items={[{ label: 'الرئيسية' }]} />);
    expect(screen.getByText('الرئيسية')).toBeInTheDocument();
    expect(container.querySelectorAll('svg[aria-hidden]').length).toBe(0);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
