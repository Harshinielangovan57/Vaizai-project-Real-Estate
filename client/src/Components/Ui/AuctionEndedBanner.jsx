// src/components/ui/AuctionEndedBanner.jsx
import { useSelector } from 'react-redux';

/**
 * AuctionEndedBanner
 *
 * Props:
 *   auction – the current auction object from Redux / local state
 *
 * Shows a sticky banner at the top of PropertyDetailPage when the
 * auction has ended, indicating winner and final price.
 */
export default function AuctionEndedBanner({ auction }) {
  const { address } = useSelector((s) => s.wallet);

  if (!auction?.ended) return null;

  const isWinner = auction.winner &&
    address?.toLowerCase() === auction.winner.toLowerCase();

  return (
    <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-5 py-4 ${
      isWinner
        ? 'border-emerald-500/30 bg-emerald-500/10'
        : 'border-white/10 bg-white/5'
    }`}>
      <span className="text-2xl shrink-0">{isWinner ? '🏆' : '🏁'}</span>
      <div>
        <p className={`font-bold ${isWinner ? 'text-emerald-300' : 'text-white'}`}>
          {isWinner ? 'You won this auction!' : 'Auction Ended'}
        </p>
        <p className="text-sm text-neutral-400">
          Final price:{' '}
          <span className="font-semibold text-white">
            {auction.finalPrice || auction.highestBid} ETH
          </span>
          {auction.winner && (
            <span className="ml-2 font-mono text-xs text-neutral-500">
              Winner: {auction.winner.slice(0, 10)}…
            </span>
          )}
        </p>
      </div>
    </div>
  );
}