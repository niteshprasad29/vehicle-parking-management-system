import crypto from 'node:crypto';
import Razorpay from 'razorpay';

export const isRazorpayConfigured = () => Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID || '';

export const createRazorpayOrder = async ({ amount, receipt, notes }) => {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  return razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: receipt.slice(0, 40),
    notes,
  });
};

export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!/^[a-f\d]{64}$/i.test(signature || '')) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const provided = Buffer.from(signature, 'hex');

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
};