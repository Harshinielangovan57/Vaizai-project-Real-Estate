
import { useGasEstimate } from '../../hooks/useGasEstimate';

/**
 * GasEstimateBox
 * Shown on the Review & Mint step.
 *
 * Props:
 *   price       – string   (ETH amount the user entered)
 *   listingType – 'fixed' | 'auction'
 */
export default function GasEstimateBox({ price, listingType }) {
  const { estimate, loading } = useGasEstimate({
    price,
    listingType,
    enabled: true,
  });

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mt-0.5 shrink-0 text-amber-400"
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="flex-1 text-sm">
        <p className="font-medium text-amber-300">Estimated Gas Fee</p>
        {loading ? (
          <p className="mt-0.5 text-neutral-500 animate-pulse">Fetching gas price…</p>
        ) : estimate ? (
          <p className="mt-0.5 text-neutral-400">
            ~<span className="font-semibold text-white">{estimate.eth} ETH</span>
            {estimate.usd && (
              <span className="ml-1.5 text-neutral-500">({estimate.usd} USD)</span>
            )}
            {' '}— covers IPFS upload, NFT mint &amp;{' '}
            {listingType === 'auction' ? 'auction creation' : 'marketplace listing'}
          </p>
        ) : (
          <p className="mt-0.5 text-neutral-500">
            Could not estimate — connect MetaMask to see gas cost
          </p>
        )}
      </div>
    </div>
  );
}