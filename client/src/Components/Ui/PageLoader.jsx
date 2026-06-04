export default function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <svg
          className="animate-spin h-8 w-8 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm text-neutral-500">Loading…</span>
      </div>
    </div>
  );
}