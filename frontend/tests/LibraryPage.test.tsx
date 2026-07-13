import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryPage } from '../src/components/library/LibraryPage';
import { apiService } from '../src/services/api';

vi.mock('../src/services/api', () => ({
  apiService: {
    deleteDocument: vi.fn(),
    ingestDocument: vi.fn(),
  },
  UnauthenticatedApiError: class UnauthenticatedApiError extends Error {},
}));

const readyDocument = {
  id: 'document-1',
  filename: 'de-toan.pdf',
  title: 'Đề Toán',
  status: 'ready' as const,
  subject: 'Toán học',
  doc_type: 'exam' as const,
};

describe('LibraryPage', () => {
  it('shows a useful empty private library and opens a PDF picker', () => {
    render(<LibraryPage documents={[]} onDocumentsChanged={vi.fn()} />);

    expect(screen.getByText(/thư viện của bạn đang trống/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tải tài liệu lên/i })).toBeInTheDocument();
  });

  it('keeps delete confirmation focus contained and restores its opener after Escape', () => {
    render(<LibraryPage documents={[readyDocument]} onDocumentsChanged={vi.fn()} />);

    const opener = screen.getByRole('button', { name: /xóa đề toán/i });
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: /xóa tài liệu này/i });
    const cancelButton = screen.getByRole('button', { name: /giữ lại/i });
    const deleteButton = screen.getByRole('button', { name: /^xóa tài liệu$/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(/toàn bộ đoạn đã lập chỉ mục/i);
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(deleteButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /đóng xác nhận xóa/i })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(deleteButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('clears the file input after a successful upload so the same PDF can be selected again', async () => {
    vi.mocked(apiService.ingestDocument).mockResolvedValueOnce({
      data: { message: 'Đã tải lên' },
    } as never);
    const { container } = render(<LibraryPage documents={[]} onDocumentsChanged={vi.fn()} />);
    const pdfInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['pdf'], 'de-toan.pdf', { type: 'application/pdf' });

    fireEvent.change(pdfInput, { target: { files: [pdf] } });
    Object.defineProperty(pdfInput, 'value', {
      configurable: true,
      value: 'C:\\fakepath\\de-toan.pdf',
      writable: true,
    });
    fireEvent.click(screen.getByRole('button', { name: /lưu vào thư viện/i }));

    await waitFor(() => expect(apiService.ingestDocument).toHaveBeenCalledWith(pdf, 'de-toan', 'Toán học', 'exam'));
    await waitFor(() => expect(pdfInput).toHaveValue(''));
  });
});
