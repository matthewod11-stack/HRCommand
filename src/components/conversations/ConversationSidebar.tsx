// HR Command Center - Conversation Sidebar Component
// Main sidebar showing conversation list with search and new conversation button

import { useState, useCallback } from 'react';
import { useConversations } from '../../contexts/ConversationContext';
import { useEmployees } from '../../contexts/EmployeeContext';
import { ConversationCard } from './ConversationCard';
import { ConversationSearch } from './ConversationSearch';

export function ConversationSidebar() {
  const {
    conversations,
    conversationId,
    isLoadingList,
    listError,
    searchQuery,
    isSearching,
    setSearchQuery,
    loadConversation,
    startNewConversation,
    deleteConversation,
  } = useConversations();

  const { selectEmployee } = useEmployees();

  // Confirmation modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNewConversation = useCallback(() => {
    selectEmployee(null); // Clear employee selection for fresh start
    startNewConversation();
  }, [selectEmployee, startNewConversation]);

  const handleSelectConversation = useCallback((id: string) => {
    loadConversation(id);
  }, [loadConversation]);

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteConfirmId && !isDeleting) {
      setIsDeleting(true);
      try {
        await deleteConversation(deleteConfirmId);
        console.log('[Sidebar] Delete successful:', deleteConfirmId);
      } catch (err) {
        console.error('[Sidebar] Delete failed:', err);
        // Could add user notification here
      } finally {
        setDeleteConfirmId(null);
        setIsDeleting(false);
      }
    }
  }, [deleteConfirmId, deleteConversation, isDeleting]);

  const handleCancelDelete = useCallback(() => {
    if (!isDeleting) {
      setDeleteConfirmId(null);
    }
  }, [isDeleting]);

  // Loading state
  if (isLoadingList) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-stone-200/60 rounded-lg" />
          <div className="h-10 bg-stone-200/60 rounded-lg" />
          <div className="space-y-2 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-stone-200/40 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (listError) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <svg
            className="w-12 h-12 text-stone-300 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-stone-500 text-sm">{listError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* New Conversation Button */}
      <button
        onClick={handleNewConversation}
        className="
          w-full py-2.5 px-4
          bg-primary-500 hover:bg-primary-600
          text-white text-sm font-medium
          rounded-lg
          transition-all duration-200
          hover:shadow-md hover:scale-[1.02]
          active:scale-[0.98]
          flex items-center justify-center gap-2
        "
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New Conversation
      </button>

      {/* Search */}
      <div className="mt-4">
        <ConversationSearch
          value={searchQuery}
          onChange={setSearchQuery}
          isSearching={isSearching}
        />
      </div>

      {/* Conversation count */}
      <div className="mt-4 mb-2">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">
          {searchQuery
            ? `${conversations.length} ${conversations.length === 1 ? 'result' : 'results'}`
            : `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`
          }
        </p>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-12 h-12 text-stone-300 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            <p className="text-stone-500 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-stone-400 text-xs mt-1">
              {searchQuery ? 'Try a different search' : 'Start a new conversation to begin'}
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              isSelected={conversationId === conversation.id}
              onClick={() => handleSelectConversation(conversation.id)}
              onDelete={() => handleDeleteClick(conversation.id)}
            />
          ))
        )}
      </div>

      {/* Keyboard shortcut hint */}
      <div className="mt-3 pt-3 border-t border-stone-200/60">
        <p className="text-xs text-stone-400 text-center">
          <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-stone-500 font-mono">
            Cmd+N
          </kbd>
          {' '}for new conversation
        </p>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelDelete}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-stone-800 mb-2">
              Delete Conversation?
            </h3>
            <p className="text-stone-600 text-sm mb-6">
              This conversation and its messages will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationSidebar;
