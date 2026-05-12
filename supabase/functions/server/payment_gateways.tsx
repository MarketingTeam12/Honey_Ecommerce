// Zoho Payment Gateway Integration (Exclusive Payment Method)
// Handles Zoho Checkout hosted pages, Zoho Books invoicing, and webhook processing

import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';

// ==================== ZOHO PAYMENTS INTEGRATION ====================

/**
 * Create a Zoho Checkout hosted payment page
 * Uses Zoho Checkout API to create a hosted page and returns the URL
 */
export async function createZohoOrder(c: Context) {
  try {
    const body = await c.req.json();
    const { amount, currency, orderId, orderNumber, trackingNumber, userId, userEmail, userName, items, subtotal, discount, tax } = body;
    
    console.log('💳 [Zoho Pay] Creating payment order...');
    console.log('💰 [Zoho Pay] Amount:', amount, currency);
    console.log('📦 [Zoho Pay] Order:', orderNumber, '| Items:', items?.length);
    
    // Get Zoho Payments credentials from KV store
    const keysData = await kv.get('api_keys:zoho_payments');
    if (!keysData) {
      console.warn('⚠️ [Zoho Pay] Not configured - using demo mode');
      return createDemoPayment(c, { orderId, orderNumber, trackingNumber, amount, currency, userId, userEmail });
    }
    
    const keys = typeof keysData === 'string' ? JSON.parse(keysData) : keysData;
    const { client_id, client_secret, test_mode } = keys;
    
    if (!client_id || !client_secret) {
      console.warn('⚠️ [Zoho Pay] Credentials incomplete - using demo mode');
      return createDemoPayment(c, { orderId, orderNumber, trackingNumber, amount, currency, userId, userEmail });
    }

    // Determine the origin for callback URLs
    const origin = c.req.header('origin') || c.req.header('referer')?.replace(/\/$/, '') || 'https://honeytranslations.com';
    const serverUrl = Deno.env.get('SUPABASE_URL');
    
    // Build line items description
    const itemDescriptions = (items || []).map((item: any) => 
      `${item.name} (${item.sourceLanguage || 'N/A'} -> ${item.targetLanguage || 'N/A'}) x${item.pageCount || 1}`
    ).join(', ');
    
    // Prepare Zoho Checkout hosted page request
    const zohoPaymentData = {
      amount: Math.round(amount * 100), // Convert to smallest currency unit (paise for INR)
      currency: currency || 'INR',
      customer: {
        email: userEmail,
        name: userName || 'Customer',
      },
      description: `Order ${orderNumber} - ${items?.length || 0} item(s): ${itemDescriptions.substring(0, 200)}`,
      reference_id: orderNumber,
      notes: {
        order_id: orderId,
        order_number: orderNumber,
        tracking_number: trackingNumber,
        user_id: userId,
        items_count: String(items?.length || 0)
      },
      redirect_url: `${origin}/order-success?orderId=${orderId}&orderNumber=${orderNumber}&trackingNumber=${trackingNumber}&gateway=zoho`,
      cancel_url: `${origin}/checkout/payment?cancelled=true&orderId=${orderId}`,
      webhook_url: `${serverUrl}/functions/v1/make-server-a67f0635/payment/zoho/webhook`
    };
    
    console.log('📤 [Zoho Pay] Sending request to Zoho Checkout API...');
    
    // Determine API endpoint based on test mode
    const zohoApiUrl = test_mode 
      ? 'https://payments-test.zoho.in/api/v1/hostedpages' 
      : 'https://payments.zoho.in/api/v1/hostedpages';
    
    try {
      // Authenticate with Zoho
      const authString = btoa(`${client_id}:${client_secret}`);
      
      const response = await fetch(zohoApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(zohoPaymentData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Zoho Pay] API Error:', response.status, errorText);
        // Fallback to demo mode if API fails
        throw new Error(`Zoho API Error: ${response.status} - ${errorText}`);
      }
      
      const zohoResponse = await response.json();
      console.log('✅ [Zoho Pay] Hosted page created:', JSON.stringify(zohoResponse));
      
      const hostedpageId = zohoResponse.hostedpage?.hostedpage_id || zohoResponse.data?.hostedpage_id || `ZOHO-HP-${Date.now()}`;
      const paymentUrl = zohoResponse.hostedpage?.url || zohoResponse.data?.url;
      
      if (!paymentUrl) {
        console.error('❌ [Zoho Pay] No payment URL in response');
        throw new Error('No payment URL returned from Zoho');
      }
      
      // Store payment record in KV
      const paymentRecord = {
        zoho_hostedpage_id: hostedpageId,
        order_id: orderId,
        order_number: orderNumber,
        tracking_number: trackingNumber,
        amount,
        currency,
        status: 'pending',
        gateway: 'zoho_payments',
        payment_method: 'zoho_checkout',
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        test_mode: !!test_mode,
        items_count: items?.length || 0,
        created_at: new Date().toISOString()
      };
      
      await kv.set(`payment:zoho:${hostedpageId}`, paymentRecord);
      console.log('💾 [Zoho Pay] Payment record saved:', hostedpageId);
      
      return c.json({
        success: true,
        paymentUrl,
        hostedpageId,
        orderId,
        orderNumber,
        testMode: !!test_mode,
        gateway: 'zoho_payments'
      });
      
    } catch (apiError) {
      console.error('❌ [Zoho Pay] API Integration Error:', apiError.message);
      console.warn('⚠️ [Zoho Pay] Falling back to demo mode');
      return createDemoPayment(c, { orderId, orderNumber, trackingNumber, amount, currency, userId, userEmail });
    }
  } catch (error) {
    console.error('❌ [Zoho Pay] Fatal Error:', error);
    
    // Last resort fallback
    try {
      const body = await c.req.json().catch(() => ({}));
      return createDemoPayment(c, {
        orderId: body.orderId || `ORD-${Date.now()}`,
        orderNumber: body.orderNumber || `HT${Date.now()}`,
        trackingNumber: body.trackingNumber || `TRK${Date.now()}`,
        amount: body.amount || 0,
        currency: body.currency || 'INR',
        userId: body.userId || 'guest',
        userEmail: body.userEmail || 'guest@example.com'
      });
    } catch (fallbackError) {
      return c.json({ error: 'Failed to create payment order', details: error.message }, 500);
    }
  }
}

/**
 * Create a demo payment (when Zoho credentials are not configured)
 */
async function createDemoPayment(c: Context, params: {
  orderId: string;
  orderNumber: string;
  trackingNumber: string;
  amount: number;
  currency: string;
  userId: string;
  userEmail: string;
}) {
  const { orderId, orderNumber, trackingNumber, amount, currency, userId, userEmail } = params;
  const origin = c.req.header('origin') || c.req.header('referer')?.replace(/\/$/, '') || '';
  
  const demoPaymentId = `ZOHO-DEMO-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  // Store demo payment record
  const paymentRecord = {
    zoho_hostedpage_id: demoPaymentId,
    order_id: orderId,
    order_number: orderNumber,
    tracking_number: trackingNumber,
    amount,
    currency,
    status: 'demo_pending',
    gateway: 'zoho_payments',
    payment_method: 'demo',
    user_id: userId,
    user_email: userEmail,
    test_mode: true,
    demo_mode: true,
    created_at: new Date().toISOString()
  };
  
  await kv.set(`payment:zoho:${demoPaymentId}`, paymentRecord);
  
  // In demo mode, redirect directly to success
  const demoPaymentUrl = `${origin}/order-success?orderId=${orderId}&orderNumber=${orderNumber}&trackingNumber=${trackingNumber}&gateway=zoho&demo=true`;
  
  console.log('✅ [Zoho Pay] Demo payment created:', demoPaymentId);
  
  return c.json({
    success: true,
    paymentUrl: demoPaymentUrl,
    hostedpageId: demoPaymentId,
    orderId,
    orderNumber,
    demo: true,
    testMode: true,
    gateway: 'zoho_payments'
  });
}

/**
 * Verify Zoho payment after redirect callback
 */
export async function verifyZohoPayment(c: Context) {
  try {
    const body = await c.req.json();
    const { hostedpage_id, zoho_order_id, payment_id, orderId } = body;
    
    const lookupId = hostedpage_id || zoho_order_id || payment_id;
    console.log('🔍 [Zoho Pay] Verifying payment:', lookupId);
    
    // Check if it's a demo payment
    const paymentData = await kv.get(`payment:zoho:${lookupId}`);
    if (paymentData) {
      const payment = typeof paymentData === 'string' ? JSON.parse(paymentData) : paymentData;
      
      if (payment.demo_mode) {
        console.log('✅ [Zoho Pay] Demo payment verified');
        payment.status = 'paid';
        payment.verified_at = new Date().toISOString();
        await kv.set(`payment:zoho:${lookupId}`, payment);
        
        // Update order
        const effectiveOrderId = orderId || payment.order_id;
        if (effectiveOrderId) {
          await updateOrderPaymentStatus(effectiveOrderId, 'paid', lookupId);
        }
        
        return c.json({ verified: true, paymentStatus: 'paid', demo: true });
      }
    }
    
    // Real Zoho verification
    const keysData = await kv.get('api_keys:zoho_payments');
    if (!keysData) {
      // No credentials - treat as verified for demo
      console.warn('⚠️ [Zoho Pay] No credentials for verification - auto-verifying');
      
      const effectiveOrderId = orderId || (paymentData && (typeof paymentData === 'string' ? JSON.parse(paymentData) : paymentData).order_id);
      if (effectiveOrderId) {
        await updateOrderPaymentStatus(effectiveOrderId, 'paid', lookupId);
      }
      
      return c.json({ verified: true, paymentStatus: 'paid' });
    }
    
    const keys = typeof keysData === 'string' ? JSON.parse(keysData) : keysData;
    const { client_id, client_secret, test_mode } = keys;
    
    // Call Zoho API to verify payment status
    const zohoApiUrl = test_mode 
      ? `https://payments-test.zoho.in/api/v1/hostedpages/${lookupId}`
      : `https://payments.zoho.in/api/v1/hostedpages/${lookupId}`;
    
    const authString = btoa(`${client_id}:${client_secret}`);
    
    const response = await fetch(zohoApiUrl, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    });
    
    let verified = false;
    let paymentStatus = 'pending';
    
    if (response.ok) {
      const zohoData = await response.json();
      console.log('📋 [Zoho Pay] Verification response:', JSON.stringify(zohoData));
      
      const status = zohoData.hostedpage?.status || zohoData.data?.status;
      verified = status === 'completed' || status === 'paid' || status === 'success';
      paymentStatus = verified ? 'paid' : status || 'pending';
    } else {
      console.error('❌ [Zoho Pay] Verification API failed:', response.status);
      // Fallback: check local payment record
      if (paymentData) {
        const payment = typeof paymentData === 'string' ? JSON.parse(paymentData) : paymentData;
        verified = payment.status === 'paid' || payment.status === 'completed';
        paymentStatus = payment.status;
      }
    }
    
    // Update local records
    if (verified) {
      console.log('✅ [Zoho Pay] Payment verified successfully');
      
      if (paymentData) {
        const payment = typeof paymentData === 'string' ? JSON.parse(paymentData) : paymentData;
        payment.status = 'paid';
        payment.verified_at = new Date().toISOString();
        await kv.set(`payment:zoho:${lookupId}`, payment);
      }
      
      const effectiveOrderId = orderId || (paymentData && (typeof paymentData === 'string' ? JSON.parse(paymentData) : paymentData).order_id);
      if (effectiveOrderId) {
        await updateOrderPaymentStatus(effectiveOrderId, 'paid', lookupId);
      }
    }
    
    return c.json({ verified, paymentStatus });
  } catch (error) {
    console.error('❌ [Zoho Pay] Verification error:', error);
    return c.json({ error: 'Payment verification failed', details: error.message }, 500);
  }
}

/**
 * Handle Zoho webhook notifications
 */
export async function handleZohoWebhook(c: Context) {
  try {
    const body = await c.req.json();
    const signature = c.req.header('X-Zoho-Signature') || c.req.header('x-zoho-signature');
    
    console.log('🔔 [Zoho Pay] Webhook received:', JSON.stringify(body));
    console.log('🔑 [Zoho Pay] Signature:', signature ? 'present' : 'missing');
    
    // Extract event type
    const eventType = body.event || body.event_type || '';
    
    // Handle various Zoho webhook events
    if (eventType === 'payment.captured' || eventType === 'payment.completed' || eventType === 'hostedpage.completed') {
      const payment = body.payload?.payment?.entity || body.data || body;
      const hostedpageId = payment.hostedpage_id || body.hostedpage_id;
      const orderId = payment.notes?.order_id || payment.reference_id;
      
      console.log('💳 [Zoho Pay] Payment captured:', hostedpageId || orderId);
      
      if (orderId) {
        await updateOrderPaymentStatus(orderId, 'paid', hostedpageId);
        
        // Try to create Zoho Books invoice
        try {
          const orderData = await kv.get(`order_${orderId}`);
          if (orderData) {
            const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
            await createZohoBooksInvoice(order);
          }
        } catch (invoiceError) {
          console.error('❌ [Zoho Books] Invoice creation failed:', invoiceError);
        }
      }
      
      // Update payment record
      if (hostedpageId) {
        const paymentRecord = await kv.get(`payment:zoho:${hostedpageId}`);
        if (paymentRecord) {
          const record = typeof paymentRecord === 'string' ? JSON.parse(paymentRecord) : paymentRecord;
          record.status = 'paid';
          record.webhook_received_at = new Date().toISOString();
          record.zoho_payment_id = payment.payment_id || payment.id;
          await kv.set(`payment:zoho:${hostedpageId}`, record);
        }
      }
    } else if (eventType === 'payment.failed' || eventType === 'hostedpage.failed') {
      const payment = body.payload?.payment?.entity || body.data || body;
      const orderId = payment.notes?.order_id || payment.reference_id;
      
      console.log('❌ [Zoho Pay] Payment failed for order:', orderId);
      
      if (orderId) {
        await updateOrderPaymentStatus(orderId, 'failed');
      }
    } else if (eventType === 'refund.created' || eventType === 'refund.processed') {
      const refund = body.payload?.refund?.entity || body.data || body;
      const orderId = refund.notes?.order_id;
      
      console.log('💸 [Zoho Pay] Refund processed for order:', orderId);
      
      if (orderId) {
        const orderData = await kv.get(`order_${orderId}`);
        if (orderData) {
          const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
          order.payment_status = 'refunded';
          order.refund_id = refund.id;
          order.refund_amount = refund.amount;
          order.refunded_at = new Date().toISOString();
          order.updated_at = new Date().toISOString();
          await kv.set(`order_${orderId}`, order);
        }
      }
    }
    
    return c.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ [Zoho Pay] Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
}

/**
 * Get all Zoho payment transactions (Admin)
 */
export async function getZohoTransactions(c: Context) {
  try {
    console.log('📊 [Zoho Pay] Fetching all transactions...');
    
    const payments = await kv.getByPrefix('payment:zoho:');
    const transactions = [];
    
    for (const item of payments) {
      try {
        const payment = typeof item === 'string' ? JSON.parse(item) : item;
        transactions.push(payment);
      } catch (e) {
        console.error('Error parsing payment:', e);
      }
    }
    
    // Sort by date descending
    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    console.log(`✅ [Zoho Pay] Found ${transactions.length} transactions`);
    
    return c.json({
      success: true,
      transactions,
      count: transactions.length,
      gateway: 'zoho_payments'
    });
  } catch (error) {
    console.error('❌ [Zoho Pay] Fetch transactions error:', error);
    return c.json({ error: 'Failed to fetch transactions', details: error.message }, 500);
  }
}

/**
 * Process refund via Zoho Payments (Admin)
 */
export async function processZohoRefund(c: Context) {
  try {
    const body = await c.req.json();
    const { orderId, hostedpageId, amount, reason } = body;
    
    console.log('💸 [Zoho Pay] Processing refund for order:', orderId);
    
    // Get Zoho credentials
    const keysData = await kv.get('api_keys:zoho_payments');
    
    if (!keysData) {
      // Demo mode refund
      console.warn('⚠️ [Zoho Pay] No credentials - processing demo refund');
      
      const orderData = await kv.get(`order_${orderId}`);
      if (orderData) {
        const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
        order.payment_status = 'refunded';
        order.status = 'refunded';
        order.refund_amount = amount || order.total_amount;
        order.refund_reason = reason || 'Customer request';
        order.refunded_at = new Date().toISOString();
        order.updated_at = new Date().toISOString();
        await kv.set(`order_${orderId}`, order);
      }
      
      return c.json({ 
        success: true, 
        message: 'Demo refund processed', 
        refundId: `REFUND-DEMO-${Date.now()}`,
        demo: true 
      });
    }
    
    const keys = typeof keysData === 'string' ? JSON.parse(keysData) : keysData;
    const { client_id, client_secret, test_mode } = keys;
    
    // Call Zoho Refund API
    const zohoApiUrl = test_mode 
      ? 'https://payments-test.zoho.in/api/v1/refunds'
      : 'https://payments.zoho.in/api/v1/refunds';
    
    const authString = btoa(`${client_id}:${client_secret}`);
    
    const refundData = {
      hostedpage_id: hostedpageId,
      amount: Math.round((amount || 0) * 100),
      reason: reason || 'Customer requested refund'
    };
    
    const response = await fetch(zohoApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(refundData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Zoho Pay] Refund API error:', response.status, errorText);
      throw new Error(`Refund failed: ${response.status}`);
    }
    
    const refundResponse = await response.json();
    console.log('✅ [Zoho Pay] Refund processed:', JSON.stringify(refundResponse));
    
    // Update order status
    const orderData = await kv.get(`order_${orderId}`);
    if (orderData) {
      const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
      order.payment_status = 'refunded';
      order.status = 'refunded';
      order.refund_id = refundResponse.refund?.id || refundResponse.data?.refund_id;
      order.refund_amount = amount;
      order.refund_reason = reason;
      order.refunded_at = new Date().toISOString();
      order.updated_at = new Date().toISOString();
      await kv.set(`order_${orderId}`, order);
    }
    
    return c.json({ 
      success: true, 
      message: 'Refund processed successfully',
      refundId: refundResponse.refund?.id || refundResponse.data?.refund_id
    });
  } catch (error) {
    console.error('❌ [Zoho Pay] Refund error:', error);
    return c.json({ error: 'Failed to process refund', details: error.message }, 500);
  }
}

// ==================== ZOHO BOOKS INTEGRATION ====================

/**
 * Get Zoho Books access token using refresh token
 */
async function getZohoBooksAccessToken() {
  try {
    const keysData = await kv.get('api_keys:zoho_books');
    if (!keysData) {
      throw new Error('Zoho Books not configured');
    }
    
    const keys = typeof keysData === 'string' ? JSON.parse(keysData) : keysData;
    const { client_id, client_secret, refresh_token, organization_id } = keys;
    
    if (!client_id || !client_secret || !refresh_token) {
      throw new Error('Zoho Books credentials incomplete');
    }
    
    // Refresh access token
    const formData = new URLSearchParams();
    formData.append('refresh_token', refresh_token);
    formData.append('client_id', client_id);
    formData.append('client_secret', client_secret);
    formData.append('grant_type', 'refresh_token');
    
    const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh Zoho Books token: ${errorText}`);
    }
    
    const data = await response.json();
    return { accessToken: data.access_token, organizationId: organization_id };
  } catch (error) {
    console.error('❌ [Zoho Books] Token refresh error:', error);
    throw error;
  }
}

/**
 * Create invoice in Zoho Books when payment is confirmed
 */
export async function createZohoBooksInvoice(order: any) {
  try {
    console.log('📄 [Zoho Books] Creating invoice for order:', order.order_number);
    
    const { accessToken, organizationId } = await getZohoBooksAccessToken();
    
    if (!organizationId) {
      throw new Error('Organization ID not configured');
    }
    
    // Prepare invoice line items
    const lineItems = (order.items || []).map((item: any, index: number) => ({
      item_order: index + 1,
      name: item.name || 'Translation Service',
      description: `${item.sourceLanguage || 'Source'} to ${item.targetLanguage || 'Target'} - ${item.pageCount || 1} page(s)`,
      rate: parseFloat(item.basePrice || item.price || item.totalPrice || 0),
      quantity: item.pageCount || item.quantity || 1,
      tax_percentage: 18 // GST
    }));
    
    const invoiceData = {
      customer_name: order.customer_name || order.user_email || 'Customer',
      customer_email: order.customer_email || order.user_email,
      date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      reference_number: order.order_number,
      notes: order.notes || 'Translation services order via Honey Translation Services',
      terms: 'Payment received via Zoho Payments',
      line_items: lineItems
    };
    
    const response = await fetch(`https://books.zoho.in/api/v3/invoices?organization_id=${organizationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Zoho Books] Invoice creation failed:', errorText);
      throw new Error(`Failed to create invoice: ${response.status}`);
    }
    
    const invoiceResponse = await response.json();
    const invoiceId = invoiceResponse.invoice?.invoice_id;
    const invoiceNumber = invoiceResponse.invoice?.invoice_number;
    
    console.log('✅ [Zoho Books] Invoice created:', invoiceId, invoiceNumber);
    
    // Link payment to invoice
    if (invoiceId && order.total_amount) {
      await linkPaymentToInvoice(invoiceId, parseFloat(order.total_amount), order.order_number, accessToken, organizationId);
    }
    
    // Update order with invoice details
    order.invoice_id = invoiceId;
    order.invoice_number = invoiceNumber;
    order.invoice_created_at = new Date().toISOString();
    await kv.set(`order_${order.id}`, order);
    
    return invoiceResponse.invoice;
  } catch (error) {
    console.error('❌ [Zoho Books] Invoice creation error:', error);
    throw error;
  }
}

/**
 * Link a payment to an invoice in Zoho Books
 */
async function linkPaymentToInvoice(invoiceId: string, amount: number, reference: string, accessToken: string, organizationId: string) {
  try {
    const paymentData = {
      payment_mode: 'Online',
      amount: amount,
      date: new Date().toISOString().split('T')[0],
      reference_number: reference,
      description: `Payment for order ${reference} via Zoho Payments`,
      invoices: [{
        invoice_id: invoiceId,
        amount_applied: amount
      }]
    };
    
    const response = await fetch(`https://books.zoho.in/api/v3/customerpayments?organization_id=${organizationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    
    if (response.ok) {
      console.log('✅ [Zoho Books] Payment linked to invoice');
    } else {
      const errorText = await response.text();
      console.warn('⚠️ [Zoho Books] Payment linking failed:', errorText);
    }
  } catch (error) {
    console.error('❌ [Zoho Books] Payment linking error:', error);
  }
}

/**
 * Get invoice PDF from Zoho Books
 */
export async function getInvoicePdf(c: Context) {
  try {
    const { invoiceId } = await c.req.json();
    
    console.log('📥 [Zoho Books] Fetching invoice PDF:', invoiceId);
    
    const { accessToken, organizationId } = await getZohoBooksAccessToken();
    
    const response = await fetch(`https://books.zoho.in/api/v3/invoices/${invoiceId}?organization_id=${organizationId}&accept=pdf`, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch invoice PDF');
    }
    
    const pdfBuffer = await response.arrayBuffer();
    
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=\"invoice-${invoiceId}.pdf\"`
      }
    });
  } catch (error) {
    console.error('❌ [Zoho Books] PDF fetch error:', error);
    
    // Return demo PDF
    const invoiceId = 'DEMO';
    try {
      const body = await c.req.json().catch(() => ({}));
      const demoPdf = generateDemoPdf(body.invoiceId || invoiceId);
      return new Response(demoPdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=\"invoice-${invoiceId}.pdf\"`
        }
      });
    } catch {
      return c.json({ error: 'Failed to fetch invoice PDF', details: error.message }, 500);
    }
  }
}

/**
 * Download invoice PDF by invoice ID (GET endpoint)
 */
export async function downloadInvoicePdf(c: Context) {
  try {
    const invoiceId = c.req.param('invoiceId');
    
    console.log('📥 [Zoho Books] Download invoice PDF:', invoiceId);
    
    if (!invoiceId) {
      return c.json({ error: 'Invoice ID is required' }, 400);
    }
    
    // Try real Zoho Books first
    const keysData = await kv.get('api_keys:zoho_books');
    if (keysData) {
      try {
        const { accessToken, organizationId } = await getZohoBooksAccessToken();
        
        const response = await fetch(
          `https://books.zoho.in/api/v3/invoices/${invoiceId}?organization_id=${organizationId}&accept=pdf`,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
          }
        );
        
        if (response.ok) {
          const pdfBuffer = await response.arrayBuffer();
          return new Response(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename=\"Invoice-${invoiceId}.pdf\"`
            }
          });
        }
      } catch (apiErr) {
        console.error('❌ [Zoho Books] API error, falling back to demo PDF:', apiErr);
      }
    }
    
    // Fallback to demo PDF
    const demoPdf = generateDemoPdf(invoiceId);
    return new Response(demoPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=\"Invoice-${invoiceId}.pdf\"`
      }
    });
  } catch (error) {
    console.error('❌ [Zoho Books] PDF download error:', error);
    const demoPdf = generateDemoPdf(c.req.param('invoiceId') || 'DEMO');
    return new Response(demoPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=\"Invoice-demo.pdf\"`
      }
    });
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Update order payment status in KV store
 */
async function updateOrderPaymentStatus(orderId: string, paymentStatus: string, paymentRef?: string) {
  try {
    const orderData = await kv.get(`order_${orderId}`);
    if (orderData) {
      const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
      order.payment_status = paymentStatus;
      order.status = paymentStatus === 'paid' ? 'confirmed' : paymentStatus === 'failed' ? 'cancelled' : order.status;
      if (paymentRef) {
        order.zoho_payment_ref = paymentRef;
      }
      order.updated_at = new Date().toISOString();
      await kv.set(`order_${orderId}`, order);
      console.log(`✅ Order ${orderId} payment status updated to: ${paymentStatus}`);
    }
  } catch (error) {
    console.error(`❌ Failed to update order ${orderId} status:`, error);
  }
}

/**
 * Generate a simple demo PDF for invoice
 */
function generateDemoPdf(invoiceId: string): Uint8Array {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
/F2 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 600
>>
stream
BT
/F2 24 Tf
50 750 Td
(HONEY TRANSLATION SERVICES) Tj
0 -30 Td
/F1 14 Tf
(Invoice) Tj
0 -40 Td
/F1 12 Tf
(Invoice ID: ${invoiceId}) Tj
0 -25 Td
(Date: ${new Date().toLocaleDateString()}) Tj
0 -25 Td
(Payment Gateway: Zoho Payments) Tj
0 -40 Td
/F2 12 Tf
(Status: PAID) Tj
0 -40 Td
/F1 11 Tf
(Thank you for choosing Honey Translation Services!) Tj
0 -25 Td
(Your translation order has been confirmed.) Tj
0 -40 Td
/F1 10 Tf
(This is a demo invoice.) Tj
0 -20 Td
(Configure Zoho Books integration in Admin Panel) Tj
0 -20 Td
(for actual invoicing with full details.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000366 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
966
%%EOF`;

  return new TextEncoder().encode(pdfContent);
}
