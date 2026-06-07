import { useState }    from 'react';
import { loadStripe }  from '@stripe/stripe-js';
import axios           from 'axios';
import toast           from 'react-hot-toast';

const API           = import.meta.env.VITE_API_URL;
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export function useFiatPurchase() {
  const [loading,       setLoading]       = useState(false);
  const [clientSecret,  setClientSecret]  = useState(null);
  const [priceUsd,      setPriceUsd]      = useState(null);
  const [error,         setError]         = useState(null);

  // Step 1 — create PaymentIntent on backend
  const initiateFiatPurchase = async (listingDbId, buyerWalletAddress) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        `${API}/api/marketplace/${listingDbId}/buy/fiat`,
        { buyerWalletAddress },
        {
          headers:         { Authorization: `Bearer ${localStorage.getItem('token')}` },
          withCredentials: true,
        }
      );
      setClientSecret(data.clientSecret);
      setPriceUsd(data.amount);
      return { success: true, clientSecret: data.clientSecret, amount: data.amount };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(msg);
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — confirm card payment via Stripe Elements
  const confirmFiatPayment = async (elements, returnUrl) => {
    setLoading(true);
    try {
      const stripe = await stripePromise;
      if (!stripe || !elements) throw new Error('Stripe not initialised');

      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl || `${window.location.origin}/dashboard`,
        },
      });

      if (stripeError) {
        setError(stripeError.message);
        toast.error(stripeError.message);
        return { success: false, error: stripeError.message };
      }

      // Stripe redirects on success — code below only runs on failure
      return { success: true };
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    initiateFiatPurchase,
    confirmFiatPayment,
    clientSecret,
    priceUsd,
    loading,
    error,
  };
}