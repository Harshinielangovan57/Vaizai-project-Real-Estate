import Navbar from './Navbar';

export default function PageShell({ children, className = '' }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Navbar />
      <main className={`pt-16 ${className}`}>{children}</main>
    </div>
  );
}