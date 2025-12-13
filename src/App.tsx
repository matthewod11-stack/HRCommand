import { LayoutProvider } from './contexts/LayoutContext';
import { AppShell } from './components/layout/AppShell';

function ChatPlaceholder() {
  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 flex flex-col justify-center items-center text-center py-12">
        <div className="
          w-16 h-16 mb-6
          rounded-2xl
          bg-gradient-to-br from-primary-100 to-primary-50
          flex items-center justify-center
          shadow-sm
        ">
          <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>

        <h2 className="font-display text-xl font-semibold text-stone-800 mb-2">
          What can I help with?
        </h2>
        <p className="text-stone-500 max-w-sm mb-8">
          Ask me anything about your team—performance reviews, PTO policies, onboarding, or employee questions.
        </p>

        {/* Prompt suggestions */}
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {[
            'Who has an anniversary this month?',
            'Help with a performance review',
            'Draft a PTO policy update',
          ].map((prompt, i) => (
            <button
              key={i}
              className="
                px-4 py-2
                bg-white
                border border-stone-200/80
                rounded-full
                text-sm text-stone-600
                hover:border-primary-300 hover:text-primary-600
                hover:shadow-sm
                transition-all duration-200
              "
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="py-4">
        <div className="
          flex items-center gap-3
          px-4 py-3
          bg-white
          border border-stone-200
          rounded-xl
          shadow-sm
          focus-within:border-primary-300
          focus-within:ring-2 focus-within:ring-primary-100
          transition-all duration-200
        ">
          <input
            type="text"
            placeholder="Ask a question..."
            className="
              flex-1
              bg-transparent
              text-stone-700
              placeholder:text-stone-400
              focus:outline-none
            "
          />
          <button className="
            w-9 h-9
            flex items-center justify-center
            bg-primary-500 hover:bg-primary-600
            text-white
            rounded-lg
            transition-all duration-200
            hover:scale-105
            active:scale-95
          ">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <LayoutProvider>
      <AppShell>
        <ChatPlaceholder />
      </AppShell>
    </LayoutProvider>
  );
}

export default App;
