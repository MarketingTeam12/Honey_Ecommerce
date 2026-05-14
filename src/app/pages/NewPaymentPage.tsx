import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertCircle,
  Building,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Lock,
  Shield,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useCart } from '@/app/context/CartContext';
import { useAuth } from '@/app/context/AuthContext';
import { useCurrency } from '@/app/context/CurrencyContext';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

const LOCAL_BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID';
const RAZORPAY_CHECKOUT_SCRIPT_ID = 'razorpay-checkout-script';
const RAZORPAY_CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_ORDER_API = `https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/payment/razorpay/create-order`;

const buildPublicFunctionHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
});

type RazorpayFailurePayload = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (
    event: 'payment.failed',
    handler: (response: RazorpayFailurePayload) => void,
  ) => void;
};

type RazorpayCheckoutConstructor = new (options: Record<string, any>) => RazorpayCheckoutInstance;

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

type PaymentCreateOrderResponse = {
  success?: boolean;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  razorpayOrder?: RazorpayOrderResponse | null;
  paymentUrl?: string | null;
  zohoHostedpageId?: string | null;
  gateway?: string;
  message?: string;
};

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

const isRazorpayCheckoutConstructor = (value: unknown): value is RazorpayCheckoutConstructor =>
  typeof value === 'function' &&
  typeof (value as { prototype?: { open?: unknown } }).prototype?.open === 'function';

const hasCheckoutMethods = (value: unknown): value is RazorpayCheckoutInstance =>
  !!value &&
  typeof (value as { open?: unknown }).open === 'function' &&
  typeof (value as { on?: unknown }).on === 'function';

const loadRazorpayCheckout = async (): Promise<RazorpayCheckoutConstructor | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (isRazorpayCheckoutConstructor(window.Razorpay)) {
    return window.Razorpay;
  }

  const existingScript = document.getElementById(RAZORPAY_CHECKOUT_SCRIPT_ID) as HTMLScriptElement | null;

  if (!existingScript) {
    const script = document.createElement('script');
    script.id = RAZORPAY_CHECKOUT_SCRIPT_ID;
    script.src = RAZORPAY_CHECKOUT_SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout script.'));
    });
  } else if (!isRazorpayCheckoutConstructor(window.Razorpay)) {
    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout script.')), { once: true });
    });
  }

  return isRazorpayCheckoutConstructor(window.Razorpay) ? window.Razorpay : null;
};

const buildRazorpayFailureMessage = (failureResponse: RazorpayFailurePayload) => {
  const failure = failureResponse.error;

  if (!failure) {
    return 'Payment was declined by Razorpay. Please try again.';
  }

  if (failure.reason === 'payment_risk_check_failed') {
    if (RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
      return 'Razorpay test mode blocked this card during risk checks. Use an official Razorpay test card, complete the mock success flow, or try another supported test method.';
    }

    return 'The payment was blocked during the bank or gateway risk check. Please retry with another card or contact the issuing bank.';
  }

  const parts = [
    failure.description,
    failure.reason ? `Reason: ${failure.reason}` : '',
    failure.code ? `Code: ${failure.code}` : '',
    failure.step ? `Step: ${failure.step}` : '',
  ].filter(Boolean);

  return parts.join(' | ') || 'Payment was declined by Razorpay. Please try again.';
};

const parseApiError = async (response: Response) => {
  const responseText = await response.text();

  try {
    const data = responseText ? JSON.parse(responseText) : null;

    const genericErrors = new Set([
      'Failed to create Razorpay order.',
      'Failed to create payment order',
    ]);

    const detailedMessage =
      data?.details?.error?.description ||
      data?.details?.message ||
      data?.details?.error ||
      data?.details?.raw ||
      (typeof data?.details === 'string' ? data.details : '');

    if (genericErrors.has(data?.error) && detailedMessage) {
      return detailedMessage;
    }

    return (
      data?.error ||
      data?.message ||
      detailedMessage ||
      `Request failed with status ${response.status}`
    );
  } catch {
    return responseText || `Request failed with status ${response.status}`;
  }
};

export function NewPaymentPage() {
  const {
    getCartTotal,
    clearCart,
    cart,
    appliedCoupon,
    getDiscountAmount,
  } = useCart();
  const { user, accessToken } = useAuth();
  const { currency, convertPrice } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [paymentStep, setPaymentStep] = useState<'ready' | 'creating' | 'saving' | 'opening'>('ready');
  const [invoicePath, setInvoicePath] = useState<string | null>(null);
  const autoPayTriggeredRef = useRef(false);

  const subtotal = getCartTotal();
  const discount = getDiscountAmount();
  const tax = (subtotal - discount) * 0.18;
  const tipAmount = parseFloat(localStorage.getItem('orderTip') || '0');
  const total = subtotal - discount + tax + tipAmount;
  const currencyCode = currency?.code || 'INR';

  useEffect(() => {
    void loadRazorpayCheckout();
  }, []);

  const createRazorpayOrder = async (
    amount: number,
    orderNumber: string,
  ): Promise<RazorpayOrderResponse> => {
    const requestBody = {
      amount,
      currency: currencyCode,
      orderNumber,
      receipt: orderNumber,
    };

    const response = await fetch(RAZORPAY_ORDER_API, {
      method: 'POST',
      headers: buildPublicFunctionHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      return response.json();
    }

    if (response.status === 404) {
      throw new Error(
        'The live payment backend does not have the Razorpay order API yet. Deploy the latest Supabase function code, then try again.',
      );
    }

    const responseError = await parseApiError(response);
    const isLocalDevelopment =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isLocalDevelopment) {
      console.warn('Remote Razorpay order creation failed, trying local backend fallback:', responseError);

      const localResponse = await fetch(`${LOCAL_BACKEND_BASE}/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(amount.toFixed(2)),
        }),
      });

      if (localResponse.ok) {
        return localResponse.json();
      }

      const localError = await parseApiError(localResponse);
      throw new Error(localError || 'Failed to create Razorpay order.');
    }

    throw new Error(responseError || 'Failed to create Razorpay order.');
  };

  const handlePayment = async () => {
    if (!user) {
      setError('Please login to continue with payment');
      return;
    }

    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === 'YOUR_RAZORPAY_KEY_ID') {
      setError('Set VITE_RAZORPAY_KEY_ID to open the Razorpay checkout.');
      return;
    }

    const RazorpayCheckout = await loadRazorpayCheckout();
    if (!RazorpayCheckout) {
      setError('Razorpay checkout is not available right now. Please refresh and try again.');
      return;
    }

    setProcessing(true);
    setError('');
    setPaymentStep('creating');

    try {
      const shippingAddress = localStorage.getItem('shipping_address');
      const parsedShippingAddress = shippingAddress ? JSON.parse(shippingAddress) : null;
      const rawShippingDetails = localStorage.getItem('shippingDetails');
      const parsedShippingDetails = rawShippingDetails ? JSON.parse(rawShippingDetails) : {};
      const orderNotes = localStorage.getItem('orderNotes') || '';
      const orderTip = localStorage.getItem('orderTip') || '0';
      const shippingMethod = (localStorage.getItem('shippingMethod') || 'email') as 'email' | 'physical';

      const deliveryEmail = (parsedShippingDetails?.email || '').trim();
      const deliveryAddressText = (parsedShippingDetails?.address || '').trim();
      const finalDeliveryEmail = shippingMethod === 'email' ? (deliveryEmail || user.email || '') : '';
      const finalShippingAddress = shippingMethod === 'physical'
        ? (deliveryAddressText ? { address1: deliveryAddressText } : parsedShippingAddress)
        : parsedShippingAddress;
      const shippingDetails = {
        email: shippingMethod === 'email' ? finalDeliveryEmail : undefined,
        address: shippingMethod === 'physical' ? (deliveryAddressText || undefined) : undefined,
      };

      const orderId = `ORD-${Date.now()}`;
      const orderNumber = `HT${Date.now().toString().slice(-8)}`;
      const trackingNumber = `TRK${Date.now().toString().slice(-10)}`;

      const itemsWithFiles = await Promise.all(
        cart.map(async (item) => {
          const filesData: any[] = [];
          const documents = item.uploadedDocuments || (item.uploadedDocument ? [item.uploadedDocument] : []);

          if (documents.length > 0) {
            try {
              for (const doc of documents) {
                if (doc instanceof File || doc instanceof Blob) {
                  const reader = new FileReader();
                  const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(doc);
                  });
                  const base64 = await base64Promise;
                  filesData.push({
                    name: doc.name,
                    type: doc.type,
                    size: doc.size,
                    data: base64,
                  });
                } else if (typeof doc === 'object' && 'name' in doc) {
                  filesData.push(doc);
                }
              }
            } catch (fileError) {
              console.error('Failed to process files:', fileError);
            }
          }

          return {
            id: item.id,
            name: item.name,
            basePrice: item.basePrice || item.price,
            totalPrice: item.totalPrice || item.price,
            pageCount: item.pageCount || item.quantity || 1,
            sourceLanguage: item.sourceLanguage,
            targetLanguage: item.targetLanguage,
            certificateType: item.certificateType,
            documentType: item.certificateType,
            category: item.category,
            uploadedFile: filesData[0] || null,
            uploadedFiles: filesData.length > 0 ? filesData : undefined,
          };
        }),
      );

      const order = {
        id: orderId,
        order_number: orderNumber,
        tracking_number: trackingNumber,
        user_id: user.id,
        customer_email: user.email,
        customer_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
        items: itemsWithFiles,
        total_amount: total.toFixed(2),
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        tax: tax.toFixed(2),
        currency: currencyCode,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'razorpay',
        payment_gateway: 'razorpay',
        shipping_address: finalShippingAddress,
        shipping_details: shippingDetails,
        shipping_carrier: 'BlueDart',
        estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: orderNotes,
        tip: parseFloat(orderTip),
        shipping_method: shippingMethod,
      };

      try {
        const existingOrders = localStorage.getItem('user_orders');
        const orders = existingOrders ? JSON.parse(existingOrders) : [];
        orders.push(order);
        localStorage.setItem('user_orders', JSON.stringify(orders));

        const existingAdminOrders = localStorage.getItem('honey_translation_orders');
        const adminOrders = existingAdminOrders ? JSON.parse(existingAdminOrders) : [];
        adminOrders.push(order);
        localStorage.setItem('honey_translation_orders', JSON.stringify(adminOrders));
      } catch (storageError) {
        console.error('Failed to save order locally:', storageError);
      }

      try {
        const notification = {
          id: `notif-${Date.now()}`,
          type: 'new_order',
          title: 'New Order Received',
          message: `Order ${orderNumber} from ${order.customer_name || order.customer_email}`,
          orderId: order.id,
          orderNumber,
          amount: order.total_amount,
          currency: order.currency,
          read: false,
          created_at: new Date().toISOString(),
        };

        const existingNotifications = localStorage.getItem('admin_notifications');
        const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
        notifications.unshift(notification);
        localStorage.setItem('admin_notifications', JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent('newOrderNotification', { detail: notification }));
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }

      setPaymentStep('saving');

      let paymentCreateResponse: PaymentCreateOrderResponse | null = null;

      try {
        const backendResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/payment/create-order`, {
          method: 'POST',
          headers: buildPublicFunctionHeaders(),
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            userName: user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
            orderId,
            orderNumber,
            trackingNumber,
            amount: total,
            currency: currencyCode,
            paymentMethod: 'razorpay',
            items: itemsWithFiles,
            subtotal,
            discount,
            tax,
            shippingAddress: finalShippingAddress,
            shippingDetails,
            notes: orderNotes,
            tip: parseFloat(orderTip),
            shippingMethod,
          }),
        });

        if (backendResponse.ok) {
          paymentCreateResponse = await backendResponse.json();
        } else {
          const backendError = await parseApiError(backendResponse);
          console.error('Backend save failed:', backendError);
        }
      } catch (backendError) {
        console.error('Backend save failed:', backendError);
      }

      setPaymentStep('opening');

      let razorpayOrder = paymentCreateResponse?.razorpayOrder || null;

      if (!razorpayOrder && paymentCreateResponse) {
        throw new Error(
          'The live payment backend is still on the older version and did not return a Razorpay order. Deploy the latest Supabase function code, then try again.',
        );
      }

      if (!razorpayOrder) {
        razorpayOrder = await createRazorpayOrder(Number(total.toFixed(2)), orderNumber);
      }

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || currencyCode,
        name: 'Honey Translation Services',
        description: `Order ${orderNumber}`,
        order_id: razorpayOrder.id,
        prefill: {
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
          email: user.email || '',
        },
        notes: {
          orderId,
          orderNumber,
          trackingNumber,
        },
        handler: async (razorpayResponse: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          console.log('Handler Running');
          console.log(razorpayResponse);

          try {
            const verifyResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a67f0635/payment/verify`, {
              method: 'POST',
              headers: buildPublicFunctionHeaders(),
              body: JSON.stringify({
                orderId,
                paymentId: razorpayResponse.razorpay_payment_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
                customer: {
                  name: user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
                  email: user.email || '',
                  phone: parsedShippingAddress?.phone || user.user_metadata?.phone || '',
                  sourceLanguage: cart[0]?.sourceLanguage || '',
                  targetLanguage: cart[0]?.targetLanguage || '',
                  amount: total,
                  items: cart.map(item => ({
                    description: item.name,
                    quantity: item.uploadedDocuments?.length || 1,
                    pages: item.pageCount,
                    rate: item.basePrice,
                    amount: item.totalPrice,
                    sourceLanguage: item.sourceLanguage,
                    targetLanguage: item.targetLanguage,
                    documentType: item.documentType,
                    certificateType: item.certificateType,
                    files: item.uploadedDocuments?.map(document => document.name) || [],
                  })),
                },
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok) {
              console.log('Payment Verified Successfully');
              if (verifyData.invoicePath) {
                setInvoicePath(verifyData.invoicePath);
                localStorage.setItem(`invoicePath_${orderId}`, verifyData.invoicePath);
              }
            } else {
              console.error('Payment verification failed:', verifyData);
            }
          } catch (verifyError) {
            console.error('Payment verification request failed:', verifyError);
          }

          clearCart();
          setProcessing(false);
          navigate(
            `/order-success?orderId=${orderId}&orderNumber=${orderNumber}&trackingNumber=${trackingNumber}&gateway=razorpay&payment_id=${razorpayResponse.razorpay_payment_id || ''}`,
          );
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setPaymentStep('ready');
          },
        },
        theme: {
          color: '#3399cc',
        },
      };

      const razorpay = new RazorpayCheckout(options);

      if (!hasCheckoutMethods(razorpay)) {
        throw new Error('Razorpay checkout loaded without the expected checkout methods. Please verify the checkout script configuration.');
      }

      razorpay.on('payment.failed', (failureResponse) => {
        console.error('Razorpay payment failed:', failureResponse);
        setError(buildRazorpayFailureMessage(failureResponse));
        setProcessing(false);
        setPaymentStep('ready');
      });

      razorpay.open();
    } catch (paymentError) {
      let message =
        paymentError instanceof Error ? paymentError.message : 'Payment failed. Please try again.';

      if (
        paymentError instanceof TypeError &&
        paymentError.message.toLowerCase().includes('fetch')
      ) {
        message =
          'Unable to reach the payment server right now. Please try again in a moment.';
      }

      setError(message);
      setProcessing(false);
      setPaymentStep('ready');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoPay = params.get('autopay') === '1';

    if (!shouldAutoPay || autoPayTriggeredRef.current || !user || processing || cart.length === 0) {
      return;
    }

    autoPayTriggeredRef.current = true;
    void handlePayment();
  }, [location.search, user, processing, cart.length]);

  return (
    <div className="min-h-screen bg-white">
      {!user && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Authentication Required</p>
                  <p className="text-sm text-red-700">You must be logged in to place an order. Guest checkout is not available.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="px-4 py-2 bg-white text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-600">Address</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-600">Review Order</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                3
              </div>
              <span className="font-medium text-blue-600">Payment</span>
            </div>
          </div>

          <h1 className="text-3xl text-center">Secure Payment via Razorpay</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-6 h-6 text-green-600" />
                <div>
                  <h2 className="text-xl font-semibold">Razorpay - Secure Checkout</h2>
                  <p className="text-sm text-gray-600">All transactions are processed securely via Razorpay</p>
                </div>
              </div>

              <div className="mb-6 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Razorpay</h3>
                    <p className="text-white/80 text-sm">Fast, secure payment processing</p>
                  </div>
                </div>
                <p className="text-white/90 text-sm leading-relaxed">
                  Click the pay button below to open the Razorpay checkout widget and pay using your preferred method
                  including Credit/Debit Cards, UPI, Net Banking, and Digital Wallets.
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported Payment Methods</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors">
                    <CreditCard className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Credit/Debit Card</p>
                    <p className="text-xs text-gray-500 mt-1">Visa, MC, Amex, RuPay</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors">
                    <Smartphone className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">UPI</p>
                    <p className="text-xs text-gray-500 mt-1">GPay, PhonePe, Paytm</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors">
                    <Building className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Net Banking</p>
                    <p className="text-xs text-gray-500 mt-1">All Major Banks</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 transition-colors">
                    <Wallet className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Digital Wallets</p>
                    <p className="text-xs text-gray-500 mt-1">Paytm, Amazon Pay</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h4 className="font-semibold text-blue-900 mb-3">How it works:</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                    <p className="text-sm text-blue-800">Click "Pay with Razorpay" below to proceed</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                    <p className="text-sm text-blue-800">The Razorpay widget opens on top of this page</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                    <p className="text-sm text-blue-800">Choose your preferred payment method and complete the payment</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-blue-800">After payment, you'll be redirected back with order confirmation</p>
                  </div>
                </div>
              </div>

              {processing && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                  <h4 className="font-semibold text-yellow-900 mb-3">Processing your payment...</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        paymentStep === 'creating' ? 'bg-yellow-500 animate-pulse' :
                        paymentStep === 'saving' || paymentStep === 'opening' ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {(paymentStep === 'saving' || paymentStep === 'opening') && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Creating your order...</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        paymentStep === 'saving' ? 'bg-yellow-500 animate-pulse' :
                        paymentStep === 'opening' ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {paymentStep === 'opening' && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Saving order to server...</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        paymentStep === 'opening' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'
                      }`} />
                      <span className="text-sm text-gray-700">Opening Razorpay Checkout...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-6">Payment Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span className="font-medium">{convertPrice(subtotal)}</span>
                </div>
                {appliedCoupon && discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span className="font-medium">- {convertPrice(discount)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Tip</span>
                    <span className="font-medium">+ {convertPrice(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700">
                  <span>Tax (GST 18%)</span>
                  <span className="font-medium">{convertPrice(tax)}</span>
                </div>
                <div className="h-px bg-gray-300" />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Amount to Pay</span>
                  <span className="font-bold text-blue-600 text-2xl">{convertPrice(total)}</span>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Payment Gateway</p>
                <div className="p-4 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-semibold text-center shadow-lg flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" />
                  Razorpay
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={processing || !user}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-lg mb-4"
              >
                {processing ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {paymentStep === 'creating' ? 'Creating Order...' :
                     paymentStep === 'saving' ? 'Saving to Server...' :
                     paymentStep === 'opening' ? 'Opening Razorpay...' :
                     'Processing...'}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5" />
                    Pay {convertPrice(total)} with Razorpay
                  </div>
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-500 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-3 pt-6 border-t border-gray-300">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  256-bit SSL Encryption
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  PCI DSS Level 1 Compliant
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  100% Secure Transactions
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Powered by Razorpay
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewPaymentPage;
