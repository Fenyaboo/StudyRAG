import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../src/components/chat/ChatPanel';

describe('ChatPanel', () => {
  it('sends callers to library when no ready private document exists', () => {
    const onOpenLibrary = vi.fn();
    render(
      <ChatPanel
        documents={[{ id: 'processing-document', filename: 'de-toan.pdf', status: 'processing' }]}
        onOpenLibrary={onOpenLibrary}
      />
    );

    expect(screen.getByText(/Bạn cần một tài liệu sẵn sàng/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Câu hỏi cho StudyRAG/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Tải tài liệu/i }));
    expect(onOpenLibrary).toHaveBeenCalledOnce();
  });

  it('renders formatted welcome text instead of raw markdown tokens', () => {
    render(
      <ChatPanel
        documents={[{ id: 'ready-document', filename: 'de-toan.pdf', status: 'ready' }]}
        onOpenLibrary={vi.fn()}
      />
    );

    expect(screen.getByText('Chào bạn, mình là StudyRAG.')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*Chào bạn/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Câu hỏi cho StudyRAG/i })).toBeEnabled();
  });
});
