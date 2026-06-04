import { Link, useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-[400px] w-[600px] rounded-full bg-indigo-600/6 blur-[120px]" />
      </div>

      <div className="relative">
        <p
          className="select-none text-[10rem] font-black leading-none text-white/5"
          style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
        >
          404
        </p>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Page not found</h1>
          <p className="mt-2 text-sm text-neutral-500">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl border border-white/8 px-5 py-2.5 text-sm font-medium text-neutral-400 transition hover:bg-white/5"
        >
          ← Go back
        </button>
        <Link
          to="/"
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Home
        </Link>
        <Link
          to="/marketplace"
          className="rounded-xl border border-white/8 px-5 py-2.5 text-sm font-medium text-neutral-400 transition hover:bg-white/5"
        >
          Marketplace
        </Link>
      </div>
    </div>
  );
}