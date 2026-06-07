import { useState}           from 'react';
import { loadStripe }                    from '@stripe/stripe-js';
import { Elements, PaymentElement,
         useStripe, useElements }        from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/* ─── Inner form ─────────────────────────────────────────────────────── */
function CheckoutForm({ priceUsd, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message);
      onError?.(error.message);
    } else {
      onSuccess?.();
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {message && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white
                   hover:bg-indigo-500 disabled:opacity-40 transition"
      >
        {loading ? 'Processing…' : `Pay $${priceUsd?.toLocaleString()}`}
      </button>
    </form>
  );
}

/* ─── Wrapper with Elements provider ────────────────────────────────── */
export default function StripePaymentForm({ clientSecret, priceUsd, onSuccess, onError }) {
  if (!clientSecret) return null;

  const options = {
    clientSecret,
    appearance: {
      theme:     'night',
      variables: {
        colorPrimary:    '#6366f1',
        colorBackground: '#171717',
        colorText:       '#ffffff',
        borderRadius:    '12px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm
        priceUsd={priceUsd}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}