import Navbar from './Navbar';

export default function PageShell({ children, className = '' }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white transition-colors duration-300">
      <Navbar />
      <main className={`pt-16 ${className}`}>{children}</main>
    </div>
  );
}