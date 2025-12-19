import { useState, useCallback, useEffect } from 'react';
import { LayoutProvider } from './contexts/LayoutContext';
import { EmployeeProvider } from './contexts/EmployeeContext';
import { ConversationProvider, useConversations } from './contexts/ConversationContext';
import { AppShell } from './components/layout/AppShell';
import { ChatInput, MessageList } from './components/chat';
import { PIINotification } from './components/shared';
import { EmployeeDetail, EmployeeEdit } from './components/employees';
import { ImportWizard } from './components/import';
import { TestDataImporter } from './components/dev/TestDataImporter';
import { OnboardingProvider, OnboardingFlow, useOnboarding } from './components/onboarding';
import { useEmployees } from './contexts/EmployeeContext';
import { useNetwork } from './hooks';

function ChatArea() {
  // Get conversation state from context
  const {
    messages,
    isLoading,
    sendMessage,
    retryMessage,
    startNewConversation,
    piiNotification,
    clearPiiNotification,
  } = useConversations();

  // Get selected employee from context (for prioritizing in context builder)
  const { selectedEmployeeId } = useEmployees();

  // Get network state for offline mode
  const { isOnline, isApiReachable } = useNetwork();
  const isOffline = !isOnline || !isApiReachable;

  // Keyboard shortcut: Cmd+N to start a new conversation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        startNewConversation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startNewConversation]);

  const handleSubmit = useCallback(
    async (content: string) => {
      // Pass selected employee ID to prioritize in context builder
      await sendMessage(content, selectedEmployeeId);
    },
    [sendMessage, selectedEmployeeId]
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      handleSubmit(prompt);
    },
    [handleSubmit]
  );

  // Copy message to clipboard (for failed message recovery)
  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch((err) => {
      console.error('[ChatArea] Failed to copy to clipboard:', err);
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* PII redaction notification */}
      <PIINotification
        summary={piiNotification}
        onDismiss={clearPiiNotification}
      />
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onPromptClick={handlePromptClick}
        onRetry={retryMessage}
        onCopyMessage={handleCopyMessage}
      />
      <ChatInput
        onSubmit={handleSubmit}
        disabled={isLoading}
        isOffline={isOffline}
      />
    </div>
  );
}

function EmployeeEditModal() {
  const {
    selectedEmployee,
    isEditModalOpen,
    closeEditModal,
    updateEmployeeInList,
  } = useEmployees();

  if (!selectedEmployee) return null;

  return (
    <EmployeeEdit
      employee={selectedEmployee}
      isOpen={isEditModalOpen}
      onClose={closeEditModal}
      onSave={updateEmployeeInList}
    />
  );
}

function ImportWizardModal() {
  const { isImportWizardOpen, closeImportWizard, refreshEmployees } = useEmployees();

  return (
    <ImportWizard
      isOpen={isImportWizardOpen}
      onClose={closeImportWizard}
      onComplete={refreshEmployees}
    />
  );
}

// Developer modal for test data import (Cmd+Shift+T)
function TestDataModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refreshEmployees } = useEmployees();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          onClose();
          refreshEmployees();
        }}
      />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <button
          onClick={() => {
            onClose();
            refreshEmployees();
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <TestDataImporter />
      </div>
    </div>
  );
}

// Inner component that conditionally renders onboarding or main app
function AppContent() {
  const { isLoading, isCompleted } = useOnboarding();
  const [isTestDataModalOpen, setIsTestDataModalOpen] = useState(false);

  // Keyboard shortcut: Cmd+Shift+T to open test data importer (only after onboarding)
  useEffect(() => {
    if (!isCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 't') {
        e.preventDefault();
        setIsTestDataModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompleted]);

  // Show loading state while checking onboarding status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-stone-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (!isCompleted) {
    return <OnboardingFlow />;
  }

  // Main app after onboarding is complete
  return (
    <LayoutProvider>
      <ConversationProvider>
        <EmployeeProvider>
          <AppShell contextPanel={<EmployeeDetail />}>
            <ChatArea />
          </AppShell>
          <EmployeeEditModal />
          <ImportWizardModal />
          <TestDataModal
            isOpen={isTestDataModalOpen}
            onClose={() => setIsTestDataModalOpen(false)}
          />
        </EmployeeProvider>
      </ConversationProvider>
    </LayoutProvider>
  );
}

function App() {
  return (
    <OnboardingProvider>
      <AppContent />
    </OnboardingProvider>
  );
}

export default App;
