import { useState }          from 'react';
import { useCryptoPurchase } from '@/hooks/useCryptoPurchase';
import { useFiatPurchase }   from '@/hooks/useFiatPurchase';
import StripePaymentForm     from '@/components/payment/StripePaymentForm';
import { useSelector }       from 'react-redux';
import toast                 from 'react-hot-toast';

export default function BuyModal({ listing, onClose, onSuccess }) {
  const [tab, setTab] = useState('crypto');   // 'crypto' | 'fiat'
//   const { user }      = useSelector((s) => s.auth);
  const walletAddress = useSelector((s) => s.wallet?.address);

  const { buyWithCrypto, loading: cryptoLoading }  = useCryptoPurchase();
  const {
    initiateFiatPurchase,
    clientSecret,
    priceUsd,
    loading: fiatLoading,
  } = useFiatPurchase();

  const handleCryptoBuy = async () => {
    const result = await buyWithCrypto(listing._id);
    if (result.success) {
      onSuccess?.(result.txHash);
      onClose();
    }
  };

  const handleFiatInit = async () => {
    if (!walletAddress) {
      toast.error('Connect your MetaMask wallet first — needed to receive the NFT');
      return;
    }
    await initiateFiatPurchase(listing._id, walletAddress);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Purchase Property</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">✕</button>
        </div>

        {/* Property info */}
        <div className="mb-5 rounded-xl bg-white/5 p-4">
          <p className="font-semibold text-white">{listing.propertyId?.title}</p>
          <p className="text-sm text-neutral-400">
            {listing.propertyId?.city}, {listing.propertyId?.state}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xl font-bold text-indigo-400">
              {listing.priceEth} ETH
            </span>
            {listing.priceUsd && (
              <span className="text-sm text-neutral-500">
                ≈ ${listing.priceUsd?.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex rounded-xl bg-white/5 p-1">
          {['crypto', 'fiat'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t === 'crypto' ? '⟠ Pay with ETH' : '💳 Pay with Card'}
            </button>
          ))}
        </div>

        {/* Crypto tab */}
        {tab === 'crypto' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/5 p-4 text-sm text-neutral-400 space-y-2">
              <p>• MetaMask will open to confirm the transaction</p>
              <p>• You will pay <strong className="text-white">{listing.priceEth} ETH</strong></p>
              <p>• NFT transfers to your wallet instantly on confirmation</p>
            </div>
            <button
              onClick={handleCryptoBuy}
              disabled={cryptoLoading}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white
                         hover:bg-indigo-500 disabled:opacity-40 transition"
            >
              {cryptoLoading ? 'Confirming…' : `Buy for ${listing.priceEth} ETH`}
            </button>
          </div>
        )}

        {/* Fiat tab */}
        {tab === 'fiat' && (
          <div className="space-y-4">
            {!clientSecret ? (
              <>
                <div className="rounded-xl bg-white/5 p-4 text-sm text-neutral-400 space-y-2">
                  <p>• Pay with any credit or debit card</p>
                  <p>• NFT is transferred to your connected wallet after payment</p>
                  <p>• Requires MetaMask wallet to be connected</p>
                </div>
                <button
                  onClick={handleFiatInit}
                  disabled={fiatLoading}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white
                             hover:bg-indigo-500 disabled:opacity-40 transition"
                >
                  {fiatLoading
                    ? 'Preparing…'
                    : `Continue — $${listing.priceUsd?.toLocaleString()}`}
                </button>
              </>
            ) : (
              <StripePaymentForm
                clientSecret={clientSecret}
                priceUsd={priceUsd}
                onSuccess={() => { toast.success('Payment complete! 🎉'); onClose(); onSuccess?.(); }}
                onError={(msg) => toast.error(msg)}
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}