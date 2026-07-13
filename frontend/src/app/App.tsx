import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { AppShell } from '../components/common/AppShell';
import { ChatPanel } from '../components/chat/ChatPanel';
import { Dashboard } from '../components/dashboard/Dashboard';
import { LibraryPage } from '../components/library/LibraryPage';
import { apiService, UnauthenticatedApiError } from '../services/api';
import { ConnectionState, DocumentRecord } from '../types';
import { useAuth } from '../auth/AuthProvider';
import { consumeIntendedDestination, setRouteTab, tabFromHash, type AppTab } from '../auth/access';
import '../styles/index.css';

export const App: React.FC = () => {
  const { signOut } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<AppTab>(() => consumeIntendedDestination() ?? tabFromHash() ?? 'dashboard');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chatDraft, setChatDraft] = useState('');

  const clearPrivateState = useCallback(() => {
    setDocuments([]);
    setChatDraft('');
  }, []);

  useEffect(() => apiService.onUnauthenticated(clearPrivateState), [clearPrivateState]);

  useEffect(() => {
    const syncTabWithHash = () => {
      const routedTab = tabFromHash();
      if (routedTab) setActiveTab(routedTab);
    };

    window.addEventListener('hashchange', syncTabWithHash);
    return () => window.removeEventListener('hashchange', syncTabWithHash);
  }, []);

  const navigate = useCallback((tab: AppTab) => {
    setRouteTab(tab);
    setActiveTab(tab);
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await apiService.getDocuments();
      if (response.data) setDocuments(response.data);
    } catch (error) {
      if (error instanceof UnauthenticatedApiError) {
        clearPrivateState();
        await signOut();
      }
    }
  }, [clearPrivateState, signOut]);

  const checkConnection = useCallback(async () => {
    setConnectionState('checking');
    const healthResponse = await apiService.getHealth();

    if (healthResponse.data?.status === 'ok') {
      setConnectionState('connected');
      setErrorMessage('');
      void fetchDocuments();
      return;
    }

    setConnectionState('error');
    setErrorMessage(healthResponse.error || 'Không thể kết nối đến StudyRAG.');
  }, [fetchDocuments]);

  useEffect(() => {
    void checkConnection();
    const interval = window.setInterval(() => void checkConnection(), 30000);
    return () => window.clearInterval(interval);
  }, [checkConnection]);

  const openChatWithDraft = (question: string) => {
    setChatDraft(question);
    navigate('chat');
  };

  return (
    <AppShell activeTab={activeTab} onNavigate={navigate} onSignedOut={clearPrivateState}>
      {activeTab === 'dashboard' && (
        <Dashboard
          connectionState={connectionState}
          errorMessage={errorMessage}
          documents={documents}
          onRetry={checkConnection}
          onOpenLibrary={() => navigate('library')}
          onOpenChat={openChatWithDraft}
        />
      )}

      {activeTab === 'library' && (
        <LibraryPage documents={documents} onDocumentsChanged={fetchDocuments} />
      )}

      {activeTab === 'chat' && (
        <ChatPanel
          documents={documents}
          draft={chatDraft}
          onOpenLibrary={() => navigate('library')}
        />
      )}

      {activeTab === 'settings' && (
        <section className="profile-placeholder" aria-labelledby="profile-title">
          <Settings size={24} aria-hidden="true" />
          <h1 id="profile-title">Hồ sơ</h1>
          <p>Quản lý tài khoản của bạn từ menu ở góc trên bên phải.</p>
        </section>
      )}
    </AppShell>
  );
};
