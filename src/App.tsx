import { useState, useCallback, useEffect } from 'react';
import { LayoutProvider } from './contexts/LayoutContext';
import { EmployeeProvider } from './contexts/EmployeeContext';
import { ConversationProvider, useConversations } from './contexts/ConversationContext';
import { AppShell } from './components/layout/AppShell';
import { ChatInput, MessageList } from './components/chat';
import { ApiKeyInput } from './components/settings';
import { CompanySetup } from './components/company';
import { EmployeeDetail, EmployeeEdit } from './components/employees';
import { ImportWizard } from './components/import';
import { TestDataImporter } from './components/dev/TestDataImporter';
import { useEmployees } from './contexts/EmployeeContext';
import { Company } from './lib/types';
import { hasApiKey, hasCompany } from './lib/tauri-commands';

function ChatArea() {
  // Get conversation state from context
  const { messages, isLoading, sendMessage, startNewConversation } = useConversations();

  // Get selected employee from context (for prioritizing in context builder)
  const { selectedEmployeeId } = useEmployees();

  // Gating state (API key and company profile checks)
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [hasCompanyProfile, setHasCompanyProfile] = useState<boolean | null>(null);

  // Check for API key and company profile on mount
  useEffect(() => {
    hasApiKey()
      .then(setHasKey)
      .catch(() => setHasKey(false));
  }, []);

  // Check company profile after API key is confirmed
  useEffect(() => {
    if (hasKey === true) {
      hasCompany()
        .then(setHasCompanyProfile)
        .catch(() => setHasCompanyProfile(false));
    }
  }, [hasKey]);

  const handleApiKeySaved = useCallback(() => {
    setHasKey(true);
  }, []);

  const handleCompanySaved = useCallback((_company: Company) => {
    setHasCompanyProfile(true);
  }, []);

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

  // Show nothing while checking for API key
  if (hasKey === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    );
  }

  // Show API key setup if not configured
  if (!hasKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="font-display text-2xl text-stone-800 mb-2 text-center">
            Welcome to HR Command Center
          </h2>
          <p className="text-stone-600 text-center mb-6">
            Enter your Anthropic API key to get started.
          </p>
          <ApiKeyInput onSave={handleApiKeySaved} />
        </div>
      </div>
    );
  }

  // Show loading while checking company profile
  if (hasCompanyProfile === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-stone-400 text-sm">Checking company profile...</div>
      </div>
    );
  }

  // Show company setup if not configured
  if (!hasCompanyProfile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-stone-800 mb-2">
              Set Up Your Company
            </h2>
            <p className="text-stone-600">
              This helps Claude provide context-aware HR guidance.
            </p>
          </div>
          <CompanySetup onSave={handleCompanySaved} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onPromptClick={handlePromptClick}
      />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
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

function App() {
  const [isTestDataModalOpen, setIsTestDataModalOpen] = useState(false);

  // Keyboard shortcut: Cmd+Shift+T to open test data importer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === 't') {
        e.preventDefault();
        setIsTestDataModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

export default App;
