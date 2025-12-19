// HR Command Center - API Key Step (Step 2)
// Wraps existing ApiKeyInput component for onboarding flow

import { useEffect, useState } from 'react';
import { ApiKeyInput } from '../../settings/ApiKeyInput';
import { hasApiKey } from '../../../lib/tauri-commands';

interface ApiKeyStepProps {
  onComplete: () => void;
  onValidChange: (valid: boolean) => void;
}

export function ApiKeyStep({ onComplete, onValidChange }: ApiKeyStepProps) {
  const [hasKey, setHasKey] = useState(false);

  // Check if key already exists on mount
  useEffect(() => {
    hasApiKey().then((exists) => {
      setHasKey(exists);
      onValidChange(exists);
    }).catch(() => {
      // Ignore
    });
  }, [onValidChange]);

  const handleSave = () => {
    setHasKey(true);
    onValidChange(true);
    // Auto-advance to next step
    onComplete();
  };

  return (
    <div className="w-full">
      {/* Help text */}
      <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
        <p className="text-sm text-primary-800">
          You'll need an API key from Anthropic to use Claude. Get one at{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline hover:text-primary-600"
          >
            console.anthropic.com
          </a>
        </p>
      </div>

      {/* API Key Input */}
      <ApiKeyInput
        onSave={handleSave}
        compact={false}
      />

      {/* Already configured message */}
      {hasKey && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onComplete}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-all duration-200"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

export default ApiKeyStep;
