import { useState, useCallback, useEffect } from 'react';
import { upsertCompany, getCompany, hasCompany, getSetting, setSetting } from '../../lib/tauri-commands';
import type { Company, UpsertCompany } from '../../lib/types';

/** All 50 US state codes with names */
export const US_STATES: Array<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CompanySetupProps {
  /** Callback when company profile is successfully saved */
  onSave?: (company: Company) => void;
  /** Show compact version for settings panel */
  compact?: boolean;
  /** Pre-populate with existing data (edit mode) */
  existingCompany?: Company;
}

export function CompanySetup({
  onSave,
  compact = false,
  existingCompany,
}: CompanySetupProps) {
  const [name, setName] = useState(existingCompany?.name ?? '');
  const [state, setState] = useState(existingCompany?.state ?? '');
  const [industry, setIndustry] = useState(existingCompany?.industry ?? '');
  const [userName, setUserName] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasExisting, setHasExisting] = useState(!!existingCompany);

  // Load existing company and user_name on mount if not provided via props
  useEffect(() => {
    // Load user_name setting
    getSetting('user_name').then((name) => {
      if (name) setUserName(name);
    }).catch(() => {
      // Ignore
    });

    if (!existingCompany) {
      hasCompany().then(async (exists) => {
        setHasExisting(exists);
        if (exists) {
          try {
            const company = await getCompany();
            setName(company.name);
            setState(company.state);
            setIndustry(company.industry ?? '');
          } catch {
            // Ignore - just means no company exists yet
          }
        }
      }).catch(() => {
        // Ignore
      });
    }
  }, [existingCompany]);

  const isValid = name.trim().length > 0 && state.length === 2;

  const handleSave = useCallback(async () => {
    if (!isValid) return;

    setStatus('saving');
    setErrorMessage('');

    try {
      const input: UpsertCompany = {
        name: name.trim(),
        state: state.toUpperCase(),
        industry: industry.trim() || undefined,
      };

      const company = await upsertCompany(input);

      // Save user name to settings if provided
      if (userName.trim()) {
        await setSetting('user_name', userName.trim());
      }

      setStatus('saved');
      setHasExisting(true);
      onSave?.(company);

      // Reset status after brief display
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save company profile');
    }
  }, [name, state, industry, userName, isValid, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && status === 'idle') {
      handleSave();
    }
  };

  // Show configured state if company exists and user hasn't made changes
  const isUnchanged = hasExisting &&
    name === (existingCompany?.name ?? '') &&
    state === (existingCompany?.state ?? '') &&
    industry === (existingCompany?.industry ?? '');

  if (compact && hasExisting && status !== 'saved' && isUnchanged) {
    // Show compact "configured" view for settings panel
    return (
      <div className="flex items-center justify-between gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">
              {userName ? `${userName} @ ` : ''}{name}
            </p>
            <p className="text-xs text-green-600">
              {US_STATES.find(s => s.code === state)?.name ?? state}
              {industry ? ` - ${industry}` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHasExisting(false)}
          className="px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'max-w-lg'}>
      {/* Header */}
      {!compact && (
        <div className="mb-6">
          <h2 className="text-xl font-display font-semibold text-stone-800">Company Profile</h2>
          <p className="text-sm text-stone-500 mt-1">
            Tell us about your company so Claude can provide relevant context.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Your Name */}
        <div>
          <label htmlFor="user-name" className="block text-sm font-medium text-stone-700 mb-1.5">
            Your Name <span className="text-stone-500">(how Alex should address you)</span>
          </label>
          <input
            id="user-name"
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              setErrorMessage('');
              setStatus('idle');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Sarah"
            disabled={status === 'saving'}
            className={`
              w-full px-4 py-3
              bg-white border rounded-xl
              text-stone-700 placeholder:text-stone-400
              focus:outline-none focus:ring-2 focus:border-primary-300 focus:ring-primary-100
              transition-all duration-200
              ${status === 'saving' ? 'cursor-wait bg-stone-50' : ''}
              ${userName.trim() ? 'border-green-300' : 'border-stone-200'}
            `}
          />
        </div>

        {/* Company Name */}
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-stone-700 mb-1.5">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            id="company-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrorMessage('');
              setStatus('idle');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Acme Corp"
            disabled={status === 'saving'}
            className={`
              w-full px-4 py-3
              bg-white border rounded-xl
              text-stone-700 placeholder:text-stone-400
              focus:outline-none focus:ring-2 focus:border-primary-300 focus:ring-primary-100
              transition-all duration-200
              ${status === 'saving' ? 'cursor-wait bg-stone-50' : ''}
              ${name.trim() ? 'border-green-300' : 'border-stone-200'}
            `}
          />
        </div>

        {/* State (HQ / Incorporation) */}
        <div>
          <label htmlFor="company-state" className="block text-sm font-medium text-stone-700 mb-1.5">
            State of Incorporation <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-stone-500 mb-2">
            This is your company's legal headquarters, not where employees work.
          </p>
          <select
            id="company-state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setErrorMessage('');
              setStatus('idle');
            }}
            disabled={status === 'saving'}
            className={`
              w-full px-4 py-3
              bg-white border rounded-xl
              text-stone-700
              focus:outline-none focus:ring-2 focus:border-primary-300 focus:ring-primary-100
              transition-all duration-200
              ${status === 'saving' ? 'cursor-wait bg-stone-50' : ''}
              ${state ? 'border-green-300' : 'border-stone-200'}
            `}
          >
            <option value="">Select a state...</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Industry (Optional) */}
        <div>
          <label htmlFor="company-industry" className="block text-sm font-medium text-stone-700 mb-1.5">
            Industry <span className="text-stone-500">(optional)</span>
          </label>
          <input
            id="company-industry"
            type="text"
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              setErrorMessage('');
              setStatus('idle');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Technology, Healthcare, Finance..."
            disabled={status === 'saving'}
            className={`
              w-full px-4 py-3
              bg-white border border-stone-200 rounded-xl
              text-stone-700 placeholder:text-stone-400
              focus:outline-none focus:ring-2 focus:border-primary-300 focus:ring-primary-100
              transition-all duration-200
              ${status === 'saving' ? 'cursor-wait bg-stone-50' : ''}
            `}
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || status === 'saving'}
            className={`
              w-full px-6 py-3
              flex items-center justify-center gap-2
              rounded-xl
              text-base font-medium
              transition-all duration-200
              ${
                !isValid || status === 'saving'
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md hover:brightness-110 active:brightness-95'
              }
            `}
          >
            {status === 'saving' ? (
              <>
                <svg className="w-5 h-5 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : status === 'saved' ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : hasExisting ? (
              'Update Company Profile'
            ) : (
              'Save Company Profile'
            )}
          </button>
        </div>

        {/* Note about employee locations */}
        {!compact && (
          <p className="text-xs text-stone-500 text-center">
            Employee work locations are tracked separately on each employee record.
          </p>
        )}
      </div>
    </div>
  );
}

export default CompanySetup;
