
export default function MintProgressIndicator({ steps, active }) {
  const currentIdx = steps.findIndex((s) => !s.done && !s.error);

  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => {
        const isCurrent = active && i === currentIdx;
        const isDone = step.done;
        const isError = step.error;
        const isPending = !isDone && !isError && !isCurrent;

        return (
          <div key={i} className="flex items-center gap-3">
            {/* Icon */}
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
              isError   ? 'border-red-500 bg-red-500/10 text-red-400' :
              isDone    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' :
              isCurrent ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' :
                          'border-white/10 bg-white/4 text-neutral-600'
            }`}>
              {isError ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              ) : isDone ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              ) : isCurrent ? (
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span className="text-neutral-700">{i + 1}</span>
              )}
            </div>

            {/* Label */}
            <span className={`text-sm ${
              isError   ? 'text-red-400' :
              isDone    ? 'text-neutral-400 line-through' :
              isCurrent ? 'font-medium text-white' :
                          'text-neutral-600'
            }`}>
              {step.label}
            </span>

            {/* Done checkmark glow */}
            {isDone && (
              <span className="ml-auto text-xs text-emerald-500">Done</span>
            )}
            {isCurrent && (
              <span className="ml-auto text-xs text-indigo-400 animate-pulse">In progress…</span>
            )}
          </div>
        );
      })}
    </div>
  );
}