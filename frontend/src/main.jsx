import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Banknote, CalendarCheck, CalendarClock, CalendarPlus, CarFront, CreditCard, LayoutDashboard, PackageCheck, QrCode, ShoppingBasket, Smartphone, Store } from 'lucide-react';
import QRCode from 'qrcode';
import './styles.css';
import './shop.css';
import './payments.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const demoCredentials = {
  email: 'user@parkease.com',
  password: 'User@123',
};
const vehicleOptions = [
  { value: 'BIKE', label: 'Motorcycle / Bike' },
  { value: 'CAR', label: 'Car' },
  { value: 'SUV', label: 'SUV' },
  { value: 'OTHER', label: 'Other vehicle' },
];
const vehicleModelOptions = {
  BIKE: ['Hero Splendor', 'Honda Activa', 'Honda Shine', 'Bajaj Pulsar', 'TVS Apache', 'Royal Enfield Classic 350', 'Yamaha R15', 'Other bike'],
  CAR: ['Maruti Suzuki Alto', 'Maruti Suzuki Swift', 'Maruti Suzuki Baleno', 'Maruti Suzuki Dzire', 'Hyundai Grand i10 Nios', 'Hyundai i20', 'Hyundai Verna', 'Honda City', 'Honda Amaze', 'Tata Tiago', 'Tata Tigor', 'Tata Altroz', 'Renault Kwid', 'Renault Triber', 'Toyota Glanza', 'Volkswagen Virtus', 'Skoda Slavia', 'Other car'],
  SUV: ['Tata Nexon', 'Tata Punch', 'Tata Harrier', 'Tata Safari', 'Hyundai Venue', 'Hyundai Creta', 'Hyundai Alcazar', 'Kia Sonet', 'Kia Seltos', 'Kia Carens', 'Mahindra Thar', 'Mahindra Scorpio-N', 'Mahindra XUV700', 'Maruti Suzuki Brezza', 'Toyota Urban Cruiser Hyryder', 'MG Hector', 'Jeep Compass', 'Other SUV'],
  OTHER: ['Commercial vehicle', 'Auto rickshaw', 'Electric vehicle', 'Van', 'Other model'],
};
async function request(path, options = {}) {
  const token = localStorage.getItem('parkease_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Request failed.');
  return payload;
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Could not load online checkout.'));
    document.body.appendChild(script);
  });
}

async function openRazorpayCheckout({ keyId, order, paymentId, user, description, paymentMethod = 'ONLINE', onVerify }) {
  const Razorpay = await loadRazorpayCheckout();

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'ParkEase',
      description: paymentMethod === 'CARD' ? `Card payment · ${description}` : description,
      order_id: order.id,
      prefill: { name: user.name, email: user.email, contact: user.phone },
      ...(paymentMethod === 'CARD' ? { method: 'card' } : {}),
      theme: { color: '#173a2e' },
      handler: async (response) => {
        try {
          resolve(await onVerify({ paymentId, ...response }));
        } catch (error) {
          reject(error);
        }
      },
      modal: { ondismiss: () => reject(new Error('Payment was cancelled.')) },
    });

    checkout.on('payment.failed', (response) => {
      reject(new Error(response.error?.description || 'Payment failed.'));
    });
    checkout.open();
  });
}

function toDateTimeLocalValue(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('overview');
  const [authMode, setAuthMode] = useState('login');
  const [locations, setLocations] = useState([]);
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [shopOrders, setShopOrders] = useState([]);
  const [cartItems, setCartItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('parkease_cart') || '[]');
    } catch {
      return [];
    }
  });
  const [paymentConfig, setPaymentConfig] = useState({ onlinePaymentsEnabled: false, keyId: '' });
  const [loginForm, setLoginForm] = useState(demoCredentials);
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: '', vehicleType: 'CAR', vehicleModel: '' });
  const [bookingForm, setBookingForm] = useState({ locationId: '', slotId: '', vehicleId: '', vehicleNumber: '', vehicleType: '', expectedEntryTime: '', expectedExitTime: '' });
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [bookingReceipt, setBookingReceipt] = useState(null);
  const [bookingPaymentOpen, setBookingPaymentOpen] = useState(false);
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState('UPI');
  const [bookingPaymentError, setBookingPaymentError] = useState('');
  const [bookingPaymentSaving, setBookingPaymentSaving] = useState(false);
  const [bookingQrPayment, setBookingQrPayment] = useState(null);
  const [rescheduleDraft, setRescheduleDraft] = useState(null);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [shopCheckoutProduct, setShopCheckoutProduct] = useState(null);
  const [shopCheckoutItems, setShopCheckoutItems] = useState([]);
  const [shopOrderForm, setShopOrderForm] = useState({ customerName: '', phone: '', vehicleNumber: '', deliveryAddress: '', paymentMethod: 'CASH' });
  const [shopOrderSaving, setShopOrderSaving] = useState(false);
  const [shopOrderError, setShopOrderError] = useState('');
  const [shopOrderReceipt, setShopOrderReceipt] = useState(null);
  const [shopPendingPayment, setShopPendingPayment] = useState(null);
  const [shopQrPayment, setShopQrPayment] = useState(null);
  const [loading, setLoading] = useState(false);

  const availableSlots = useMemo(
    () => slots.filter((slot) => slot.status === 'AVAILABLE'),
    [slots]
  );
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    localStorage.setItem('parkease_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    request('/parking-locations?limit=100').then((payload) => setLocations(payload.data.locations || [])).catch(() => {});
    loadAllSlots();
    request('/pricing').then((payload) => setPricing(payload.data.pricing || [])).catch(() => {});
    request('/shop/products').then((payload) => setShopProducts(payload.data.products || [])).catch(() => {});
    request('/payments/config').then((payload) => setPaymentConfig(payload.data)).catch(() => {});
    const savedUser = localStorage.getItem('parkease_user');
    if (savedUser && localStorage.getItem('parkease_token')) {
      setUser(JSON.parse(savedUser));
      refreshUserData();
    }
  }, []);

  async function loadAllSlots() {
    try {
      const firstPage = await request('/parking-slots?limit=100&page=1');
      const allSlots = [...(firstPage.data.slots || [])];
      const totalPages = firstPage.pagination?.totalPages || 1;

      for (let page = 2; page <= totalPages; page += 1) {
        const nextPage = await request(`/parking-slots?limit=100&page=${page}`);
        allSlots.push(...(nextPage.data.slots || []));
      }

      setSlots(allSlots);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function refreshUserData() {
    try {
      const [profile, userVehicles, userBookings, userShopOrders] = await Promise.all([
        request('/auth/me'),
        request('/vehicles'),
        request('/bookings?limit=50'),
        request('/shop/orders'),
      ]);
      setUser(profile.data.user);
      setVehicles(userVehicles.data.vehicles || []);
      setBookings(userBookings.data.bookings || []);
      setShopOrders(userShopOrders.data.orders || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function refreshShopOrders() {
    const payload = await request('/shop/orders');
    setShopOrders(payload.data.orders || []);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = await request('/auth/login', { method: 'POST', body: JSON.stringify(loginForm) });
      localStorage.setItem('parkease_token', payload.data.token);
      localStorage.setItem('parkease_user', JSON.stringify(payload.data.user));
      setUser(payload.data.user);
      await refreshUserData();
      setNotice({ type: 'success', text: `Welcome back, ${payload.data.user.name.split(' ')[0]}.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (registerForm.password.length < 8) {
      setNotice({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setNotice({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setLoading(true);
    try {
      const payload = await request('/auth/register', { method: 'POST', body: JSON.stringify(registerForm) });
      localStorage.setItem('parkease_token', payload.data.token);
      localStorage.setItem('parkease_user', JSON.stringify(payload.data.user));
      setUser(payload.data.user);
      await refreshUserData();
      setNotice({ type: 'success', text: 'Account created successfully. Welcome to ParkEase.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('parkease_token');
    localStorage.removeItem('parkease_user');
    setUser(null);
    setVehicles([]);
    setBookings([]);
  }

  async function addVehicle(event) {
    event.preventDefault();
    try {
      await request('/vehicles', { method: 'POST', body: JSON.stringify(vehicleForm) });
      setVehicleForm({ vehicleNumber: '', vehicleType: 'CAR', vehicleModel: '' });
      await refreshUserData();
      setNotice({ type: 'success', text: 'Vehicle added to your garage.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function createBooking(event) {
    event.preventDefault();
    try {
      const vehicleNumber = bookingForm.vehicleNumber.trim().toUpperCase();
      if (!/^[A-Z0-9 -]{4,20}$/.test(vehicleNumber)) {
        throw new Error('Enter a valid vehicle registration number, 4 to 20 characters.');
      }
      if (!bookingForm.locationId || !bookingForm.vehicleType || !bookingForm.slotId || !bookingForm.expectedEntryTime || !bookingForm.expectedExitTime) {
        throw new Error('Complete location, vehicle, slot, entry time, and exit time before confirming.');
      }
      if (new Date(bookingForm.expectedExitTime) <= new Date(bookingForm.expectedEntryTime)) {
        throw new Error('Exit time must be later than entry time.');
      }
      setBookingPaymentMethod('UPI');
      setBookingPaymentError('');
      setBookingPaymentOpen(true);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function startOnlinePayment(paymentId, description, paymentMethod = 'ONLINE') {
    const orderPayload = await request('/payments/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    });

    return openRazorpayCheckout({
      ...orderPayload.data,
      paymentId,
      user,
      description,
      paymentMethod,
      onVerify: (response) => request('/payments/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify(response),
      }),
    });
  }

  async function confirmBookingPayment() {
    setBookingPaymentSaving(true);
    setBookingPaymentError('');
    let savedBooking;
    try {
      const vehicleNumber = bookingForm.vehicleNumber.trim().toUpperCase();
      let vehicle = vehicles.find((item) => item.vehicleNumber === vehicleNumber && item.vehicleType === bookingForm.vehicleType);
      if (!vehicle) {
        const vehicleResponse = await request('/vehicles', {
          method: 'POST',
          body: JSON.stringify({ vehicleNumber, vehicleType: bookingForm.vehicleType }),
        });
        vehicle = vehicleResponse.data.vehicle;
      }
      const payload = await request('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          ...bookingForm,
          vehicleId: vehicle._id,
          vehicleNumber: undefined,
          paymentMethod: bookingPaymentMethod === 'CASH'
            ? 'CASH'
            : paymentConfig.onlinePaymentsEnabled ? 'ONLINE' : bookingPaymentMethod,
        }),
      });
      savedBooking = payload.data;
      await refreshUserData();
      setBookingForm({ locationId: '', slotId: '', vehicleId: '', vehicleNumber: '', vehicleType: '', expectedEntryTime: '', expectedExitTime: '' });
      setView('bookings');
      setBookingPaymentOpen(false);

      if (bookingPaymentMethod !== 'CASH') {
        if (paymentConfig.onlinePaymentsEnabled) {
          const verified = await startOnlinePayment(payload.data.payment._id, `Parking booking ${payload.data.booking.bookingId}`, bookingPaymentMethod);
          await refreshUserData();
          setBookingReceipt({ ...verified.data.booking, payment: verified.data.payment });
          setNotice({ type: 'success', text: 'Reservation confirmed and payment received.' });
        } else if (bookingPaymentMethod === 'UPI') {
          setBookingQrPayment({
            booking: payload.data.booking,
            payment: payload.data.payment,
            expiresAt: Date.now() + 90_000,
          });
        } else {
          throw new Error('Card payments require Razorpay to be configured. Choose UPI or pay in person.');
        }
      } else {
        setBookingReceipt({ ...payload.data.booking, payment: payload.data.payment });
        setNotice({ type: 'success', text: 'Reservation confirmed. Pay in person at the parking location.' });
      }
    } catch (error) {
      if (savedBooking) {
        setBookingReceipt({ ...savedBooking.booking, payment: savedBooking.payment });
        await refreshUserData();
        setNotice({ type: 'error', text: `Reservation saved. Online payment is still pending: ${error.message}` });
      } else {
        setBookingPaymentError(error.message);
      }
    } finally {
      setBookingPaymentSaving(false);
    }
  }

  async function fallbackBookingQrPayment() {
    if (!bookingQrPayment) return;
    try {
      const payload = await request(`/payments/${bookingQrPayment.payment._id}/fallback-to-cash`, { method: 'PATCH' });
      await refreshUserData();
      setBookingQrPayment(null);
      setBookingReceipt({ ...bookingQrPayment.booking, payment: payload.data.payment });
      setNotice({ type: 'success', text: 'Payment window expired. You can pay in person at the parking location.' });
    } catch (error) {
      setBookingPaymentError(error.message);
    }
  }

  function beginReschedule(booking) {
    setRescheduleError('');
    setRescheduleDraft({
      booking,
      expectedEntryTime: toDateTimeLocalValue(booking.expectedEntryTime),
      expectedExitTime: toDateTimeLocalValue(booking.expectedExitTime),
    });
  }

  async function saveReschedule(event) {
    event.preventDefault();
    setRescheduleError('');
    setRescheduleSaving(true);
    try {
      const { booking, expectedEntryTime, expectedExitTime } = rescheduleDraft;
      const payload = await request(`/bookings/${booking._id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedEntryTime, expectedExitTime }),
      });
      await refreshUserData();
      setRescheduleDraft(null);
      setNotice({ type: 'success', text: payload.message || 'Booking rescheduled successfully.' });
    } catch (error) {
      setRescheduleError(error.message);
    } finally {
      setRescheduleSaving(false);
    }
  }

  async function retryBookingPayment(booking, method = 'ONLINE') {
    try {
      if (method === 'UPI' && !paymentConfig.onlinePaymentsEnabled) {
        const payload = await request(`/payments/${booking.payment._id}/start-upi`, { method: 'PATCH' });
        await refreshUserData();
        setBookingQrPayment({
          booking,
          payment: payload.data.payment,
          expiresAt: Date.now() + 90_000,
        });
        return;
      }
      const verified = await startOnlinePayment(booking.payment._id, `Parking booking ${booking.bookingId}`);
      await refreshUserData();
      setBookingReceipt({ ...verified.data.booking, payment: verified.data.payment });
      setNotice({ type: 'success', text: 'Payment received for your reservation.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  function beginShopCheckout(product) {
    setShopOrderForm({
      customerName: user.name || '',
      phone: user.phone || '',
      vehicleNumber: vehicles[0]?.vehicleNumber || '',
      deliveryAddress: '',
      paymentMethod: 'CASH',
    });
    setShopOrderError('');
    setShopOrderReceipt(null);
    setShopPendingPayment(null);
    setShopCheckoutProduct(product);
    setShopCheckoutItems([{ productSku: product.sku, quantity: 1 }]);
  }

  function beginCartCheckout() {
    const items = cartItems.filter((item) => shopProducts.some((product) => product.sku === item.sku));
    if (!items.length) return;
    beginShopCheckout(shopProducts.find((product) => product.sku === items[0].sku));
    setShopCheckoutItems(items.map((item) => ({ productSku: item.sku, quantity: item.quantity })));
  }

  function addToCart(product) {
    setCartItems((items) => {
      const existingItem = items.find((item) => item.sku === product.sku);
      return existingItem
        ? items.map((item) => item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { sku: product.sku, quantity: 1 }];
    });
    setNotice({ type: 'success', text: `${product.name} added to your cart.` });
  }

  function updateCartQuantity(sku, quantity) {
    setCartItems((items) => quantity > 0
      ? items.map((item) => item.sku === sku ? { ...item, quantity } : item)
      : items.filter((item) => item.sku !== sku));
  }

  function removeFromCart(sku) {
    setCartItems((items) => items.filter((item) => item.sku !== sku));
  }

  async function submitShopOrder(event) {
    event.preventDefault();
    setShopOrderError('');
    setShopOrderSaving(true);
    let pendingPayment = shopPendingPayment;
    try {
      if (!pendingPayment) {
        const payload = await request('/shop/orders', {
          method: 'POST',
          body: JSON.stringify({
            ...shopOrderForm,
            paymentMethod: shopOrderForm.paymentMethod === 'CASH' ? 'CASH' : 'ONLINE',
            productSku: shopCheckoutProduct.sku,
            items: shopCheckoutItems,
          }),
        });
        setShopOrders((orders) => [payload.data.order, ...orders.filter((order) => order._id !== payload.data.order._id)]);
        if (shopOrderForm.paymentMethod === 'CASH') {
          setCartItems([]);
          setShopCheckoutProduct(null);
          setShopCheckoutItems([]);
          setShopOrderReceipt(payload.data.order);
          return;
        }
        pendingPayment = { order: payload.data.order, payment: payload.data.payment };
        setShopPendingPayment(pendingPayment);
      }

      if (!paymentConfig.onlinePaymentsEnabled) {
        setCartItems([]);
        setShopCheckoutProduct(null);
        setShopCheckoutItems([]);
        setShopPendingPayment(null);
        setShopQrPayment({
          order: pendingPayment.order,
          payment: pendingPayment.payment,
          expiresAt: Date.now() + 90_000,
        });
        return;
      }

      const verified = await startOnlinePayment(
        pendingPayment.payment._id,
        pendingPayment.order.productName,
        shopOrderForm.paymentMethod
      );
      setShopOrders((orders) => orders.map((order) => order._id === verified.data.shopOrder._id ? verified.data.shopOrder : order));
      setCartItems([]);
      setShopCheckoutProduct(null);
      setShopCheckoutItems([]);
      setShopPendingPayment(null);
      setShopOrderReceipt(verified.data.shopOrder);
    } catch (error) {
      setShopOrderError(pendingPayment
        ? `Order saved. Payment is still pending: ${error.message}`
        : error.message);
    } finally {
      setShopOrderSaving(false);
    }
  }

  async function fallbackShopQrPayment() {
    if (!shopQrPayment) return;
    try {
      await request(`/payments/${shopQrPayment.payment._id}/fallback-to-cash`, { method: 'PATCH' });
      await refreshShopOrders();
      setShopQrPayment(null);
      setShopOrderReceipt({ ...shopQrPayment.order, paymentMethod: 'CASH', status: 'PLACED' });
    } catch (error) {
      setShopOrderError(error.message);
    }
  }

  if (!user) return <LoginScreen mode={authMode} setMode={setAuthMode} form={loginForm} setForm={setLoginForm} registerForm={registerForm} setRegisterForm={setRegisterForm} onSubmit={authMode === 'login' ? handleLogin : handleRegister} loading={loading} notice={notice} />;

  const activeBookings = bookings.filter((booking) => ['CONFIRMED', 'ACTIVE'].includes(booking.status));
  const locationForBooking = locations.find((location) => location._id === bookingForm.locationId);
  const locationSlots = availableSlots.filter((slot) => !bookingForm.locationId || slot.locationId === bookingForm.locationId || slot.locationId?._id === bookingForm.locationId);
  const shopCheckoutProducts = shopCheckoutItems
    .map((item) => ({ ...item, product: shopProducts.find((product) => product.sku === item.productSku) }))
    .filter((item) => item.product);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">P</span><span>ParkEase</span></div>
        <p className="eyebrow">PARKING OPERATIONS</p>
        <nav>
          <NavButton active={view === 'overview'} onClick={() => setView('overview')} label="Overview" icon={<LayoutDashboard size={18} strokeWidth={2} />} />
          <NavButton active={view === 'book'} onClick={() => setView('book')} label="Book a slot" icon={<CalendarPlus size={18} strokeWidth={2} />} />
          <NavButton active={view === 'bookings'} onClick={() => setView('bookings')} label="My bookings" icon={<CalendarCheck size={18} strokeWidth={2} />} />
          <NavButton active={view === 'garage'} onClick={() => setView('garage')} label="My garage" icon={<CarFront size={18} strokeWidth={2} />} />
          <NavButton active={view === 'shop'} onClick={() => setView('shop')} label="Vehicle shop" icon={<Store size={18} strokeWidth={2} />} />
          <NavButton active={view === 'my-orders'} onClick={() => setView('my-orders')} label="My orders" icon={<PackageCheck size={18} strokeWidth={2} />} />
          <NavButton active={view === 'cart'} onClick={() => setView('cart')} label={`Cart${cartCount ? ` (${cartCount})` : ''}`} icon={<ShoppingBasket size={19} strokeWidth={2} />} className="cart-nav-button" />
        </nav>
        <div className="sidebar-foot"><span className="status-dot" /> Live system<br /><small>MongoDB connected</small></div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">CUSTOMER CONSOLE</p><h1>{view === 'overview' ? 'Good to see you.' : view === 'book' ? 'Find your next space.' : view === 'bookings' ? 'Your parking history.' : view === 'shop' ? 'Vehicle essentials.' : view === 'my-orders' ? 'My orders.' : view === 'cart' ? 'Your cart.' : 'Your vehicles.'}</h1></div>
          <div className="account"><button className={`cart-header-button ${view === 'cart' ? 'active' : ''} ${cartCount ? 'has-items' : ''}`} type="button" onClick={() => setView('cart')} aria-label={`Open cart with ${cartCount} items`}><span aria-hidden="true"><ShoppingBasket size={19} strokeWidth={2} /></span> Cart <b>{cartCount}</b></button><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.role}</small></div><button className="icon-button" onClick={logout} title="Sign out">↗</button></div>
        </header>
        {notice.text && <div className={`notice ${notice.type}`}>{notice.text}<button onClick={() => setNotice({ type: '', text: '' })}>×</button></div>}
        {bookingReceipt && <BookingConfirmation booking={bookingReceipt} onClose={() => setBookingReceipt(null)} onViewBookings={() => { setBookingReceipt(null); setView('bookings'); }} />}
        {bookingPaymentOpen && <BookingPaymentDialog method={bookingPaymentMethod} config={paymentConfig} error={bookingPaymentError} saving={bookingPaymentSaving} onChange={setBookingPaymentMethod} onSubmit={confirmBookingPayment} onClose={() => setBookingPaymentOpen(false)} />}
        {bookingQrPayment && <UpiQrPaymentDialog referenceLabel="Booking" referenceId={bookingQrPayment.booking.bookingId} payment={bookingQrPayment.payment} expiresAt={bookingQrPayment.expiresAt} error={bookingPaymentError} onExpire={fallbackBookingQrPayment} />}
        {rescheduleDraft && <RescheduleDialog draft={rescheduleDraft} error={rescheduleError} onChange={(field, value) => setRescheduleDraft({ ...rescheduleDraft, [field]: value })} onSubmit={saveReschedule} onClose={() => setRescheduleDraft(null)} saving={rescheduleSaving} />}
        {shopCheckoutProduct && <ShopCheckoutDialog items={shopCheckoutProducts} form={shopOrderForm} error={shopOrderError} vehicles={vehicles} paymentConfig={paymentConfig} pendingPayment={shopPendingPayment} onChange={(field, value) => setShopOrderForm({ ...shopOrderForm, [field]: value })} onSubmit={submitShopOrder} onClose={() => setShopCheckoutProduct(null)} saving={shopOrderSaving} />}
        {shopQrPayment && <UpiQrPaymentDialog referenceLabel="Order" referenceId={shopQrPayment.order.orderNumber} payment={shopQrPayment.payment} expiresAt={shopQrPayment.expiresAt} error={shopOrderError} fallbackLabel="Switch to cash on delivery" onExpire={fallbackShopQrPayment} />}
        {shopOrderReceipt && <ShopOrderConfirmation order={shopOrderReceipt} onClose={() => setShopOrderReceipt(null)} />}
        {view === 'overview' && <Overview user={user} bookings={bookings} activeBookings={activeBookings} locations={locations} pricing={pricing} setView={setView} onReschedule={beginReschedule} />}
        {view === 'book' && <BookingForm form={bookingForm} setForm={setBookingForm} locations={locations} slots={locationSlots} vehicles={vehicles} pricing={pricing} onSubmit={createBooking} />}
        {view === 'bookings' && <Bookings bookings={bookings} onReschedule={beginReschedule} onPay={retryBookingPayment} onlinePaymentsEnabled={paymentConfig.onlinePaymentsEnabled} />}
        {view === 'garage' && <Garage vehicles={vehicles} form={vehicleForm} setForm={setVehicleForm} onSubmit={addVehicle} />}
        {view === 'shop' && <Shop products={shopProducts} onBuyNow={beginShopCheckout} onAddToCart={addToCart} />}
        {view === 'my-orders' && <ShopOrders orders={shopOrders} onShop={() => setView('shop')} />}
        {view === 'cart' && <Cart products={shopProducts} items={cartItems} onQuantityChange={updateCartQuantity} onRemove={removeFromCart} onShop={() => setView('shop')} onCheckout={beginCartCheckout} />}
      </main>
    </div>
  );
}

function LoginScreen({ mode, setMode, form, setForm, registerForm, setRegisterForm, onSubmit, loading, notice }) {
  const isRegistering = mode === 'register';
  return <div className="login-page"><div className="login-visual"><div className="visual-copy"><span className="brand-mark">P</span><p className="eyebrow">PARKING, MADE SIMPLE</p><h1>A calmer way to arrive.</h1><p>Reserve a trusted parking spot before the city gets busy. ParkEase keeps every visit visible, from entry to exit.</p><div className="mini-route"><span>01</span><div><strong>Choose a location</strong><small>See live availability near you</small></div></div><div className="mini-route"><span>02</span><div><strong>Reserve your space</strong><small>Pay only for the time you use</small></div></div></div></div><form className="login-card" onSubmit={onSubmit}><div className="brand dark"><span className="brand-mark">P</span><span>ParkEase</span></div><p className="eyebrow">{isRegistering ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</p><h2>{isRegistering ? 'Start parking smarter.' : 'Park with intention.'}</h2><p className="muted">{isRegistering ? 'Use a valid email and an 8-character password.' : 'Use your ParkEase account to manage every journey.'}</p>{notice.text && <div className={`notice ${notice.type || 'error'}`}>{notice.text}</div>}{isRegistering && <><label>Full name<input type="text" value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} required minLength="2" /></label><label>Phone number<input type="tel" value={registerForm.phone} onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })} placeholder="+91 9876543212" required /></label></>}<label>Email address<input type="email" value={isRegistering ? registerForm.email : form.email} onChange={(event) => isRegistering ? setRegisterForm({ ...registerForm, email: event.target.value }) : setForm({ ...form, email: event.target.value })} placeholder="you@example.com" required /></label><label>Password<input type="password" value={isRegistering ? registerForm.password : form.password} onChange={(event) => isRegistering ? setRegisterForm({ ...registerForm, password: event.target.value }) : setForm({ ...form, password: event.target.value })} minLength="8" required />{isRegistering && <small className="field-hint">Minimum 8 characters, including a number</small>}</label>{isRegistering && <label>Confirm password<input type="password" value={registerForm.confirmPassword} onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })} minLength="8" required /></label>}<button className="primary-button" disabled={loading}>{loading ? 'Please wait...' : isRegistering ? 'Create account' : 'Enter dashboard'} <span>→</span></button>{!isRegistering && <button type="button" className="demo-button" onClick={() => setForm(demoCredentials)}>Fill demo account <small>user@parkease.com</small></button>}<button type="button" className="switch-auth" onClick={() => { setMode(isRegistering ? 'login' : 'register'); }}>{isRegistering ? 'Already have an account? Sign in' : 'New to ParkEase? Create an account'}</button></form></div>;
}

function BookingConfirmation({ booking, onClose, onViewBookings }) {
  const start = new Date(booking.expectedEntryTime);
  const end = new Date(booking.expectedExitTime);
  const hours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
  const rate = hours ? Math.round(booking.estimatedAmount / hours) : booking.estimatedAmount;
  const paymentStatus = booking.payment?.paymentStatus || 'PENDING';
  const paymentMethod = formatPaymentMethod(booking.payment?.paymentMethod);

  return (
    <div className="confirmation-overlay">
      <section className="confirmation-card">
        <button className="confirmation-close" onClick={onClose} aria-label="Close confirmation">×</button>
        <div className="confirmation-icon">✓</div>
        <p className="eyebrow">RESERVATION CONFIRMED</p>
        <h2>Your space is held.</h2>
        <p className="muted">Keep this bill for your arrival at the parking gate.</p>
        <div className="bill-header"><span>BOOKING ID</span><strong>{booking.bookingId}</strong><span>STATUS</span><b>{booking.status}</b></div>
        <div className="booking-payment-receipt">
          <span>PAYMENT STATUS</span>
          <strong className={paymentStatus === 'PAID' ? 'is-paid' : 'is-pending'}>{paymentStatus}</strong>
          <small>{paymentMethod}{booking.payment?.transactionReference ? ` · ${booking.payment.transactionReference}` : ''}</small>
        </div>
        <div className="bill-details">
          <div><span>Customer name</span><strong>{booking.customerName || booking.userId?.name || 'Account holder'}</strong><small>Booking contact</small></div>
          <div><span>Phone number</span><strong>{booking.customerPhone || booking.userId?.phone || 'Not available'}</strong><small>Contact for this reservation</small></div>
          <div><span>Location</span><strong>{booking.locationId?.name || 'Parking location'}</strong><small>{booking.locationId?.city || ''}{booking.locationId?.state ? `, ${booking.locationId.state}` : ''}</small></div>
          <div><span>Vehicle</span><strong>{booking.vehicleId?.vehicleNumber || 'Registered vehicle'}</strong><small>{vehicleOptions.find((option) => option.value === booking.vehicleId?.vehicleType)?.label || booking.vehicleId?.vehicleType || ''}</small></div>
          <div><span>Parking slot</span><strong>{booking.slotId?.slotNumber || 'Assigned slot'}</strong><small>Reserved space</small></div>
          <div><span>Arrival</span><strong>{start.toLocaleString()}</strong><small>Until {end.toLocaleString()}</small></div>
        </div>
        <div className="bill-total"><span>{hours} hour{hours === 1 ? '' : 's'} × ₹{rate} / hour</span><strong>₹{booking.estimatedAmount}</strong><small>Estimated amount. Final amount is calculated at exit.</small></div>
        <div className="confirmation-actions"><button className="secondary-button" onClick={onClose}>Book another slot</button><button className="primary-button" onClick={onViewBookings}>View my bookings <span>→</span></button></div>
      </section>
    </div>
  );
}

function formatPaymentMethod(method) {
  return ({ ONLINE: 'Online', UPI: 'UPI', CARD: 'Card', CASH: 'Pay in person' })[method] || 'Pay in person';
}

function BookingPaymentDialog({ method, config, error, saving, onChange, onSubmit, onClose }) {
  return (
    <div className="confirmation-overlay">
      <section className="confirmation-card payment-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-payment-title">
        <button className="confirmation-close" type="button" onClick={onClose} aria-label="Close payment options">×</button>
        <p className="eyebrow">RESERVATION PAYMENT</p>
        <h2 id="booking-payment-title">How would you like to pay?</h2>
        {error && <div className="notice error" role="alert">{error}</div>}
        <PaymentMethodChoices method={method} config={config} onChange={onChange} name="booking-payment-method" allowUpiFallback bookingChoices />
        <div className="confirmation-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Back to booking</button>
          <button className="primary-button" type="button" onClick={onSubmit} disabled={saving || (method === 'CARD' && !config.onlinePaymentsEnabled)}>{saving ? 'Processing...' : method === 'CASH' ? 'Confirm and pay in person' : method === 'CARD' ? 'Enter card details' : config.onlinePaymentsEnabled ? 'Continue to UPI payment' : 'Show UPI QR'}</button>
        </div>
      </section>
    </div>
  );
}

function PaymentMethodChoices({ method, config, onChange, name, disabled = false, allowUpiFallback = false, bookingChoices = false, shopChoices = false }) {
  if (bookingChoices) {
    return (
      <fieldset className="payment-method-options booking-payment-choices">
        <legend>Payment method</legend>
        <label className="payment-method-choice">
          <input type="radio" name={name} value="UPI" checked={method === 'UPI'} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
          <span className="payment-choice-icon" aria-hidden="true"><Smartphone size={18} strokeWidth={2} /></span>
          <span><strong>UPI / GPay / PhonePe</strong><small>{config.onlinePaymentsEnabled ? 'Continue securely with Razorpay.' : 'Scan the UPI QR to pay within 1:30.'}</small></span>
        </label>
        <label className={`payment-method-choice ${!config.onlinePaymentsEnabled ? 'unavailable' : ''}`}>
          <input type="radio" name={name} value="CARD" checked={method === 'CARD'} disabled={disabled || !config.onlinePaymentsEnabled} onChange={(event) => onChange(event.target.value)} />
          <span className="payment-choice-icon card" aria-hidden="true"><CreditCard size={18} strokeWidth={2} /></span>
          <span><strong>Credit / Debit Card</strong><small>{config.onlinePaymentsEnabled ? 'Enter card details securely in Razorpay.' : 'Available when Razorpay is configured.'}</small></span>
        </label>
        <label className="payment-method-choice">
          <input type="radio" name={name} value="CASH" checked={method === 'CASH'} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
          <span className="payment-choice-icon cash" aria-hidden="true"><Banknote size={18} strokeWidth={2} /></span>
          <span><strong>Pay With Cash</strong><small>Pay at the parking location.</small></span>
        </label>
      </fieldset>
    );
  }

  if (shopChoices) {
    return (
      <fieldset className="payment-method-options booking-payment-choices shop-payment-choices">
        <legend>Payment method</legend>
        <label className="payment-method-choice">
          <input type="radio" name={name} value="UPI" checked={method === 'UPI'} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
          <span className="payment-choice-icon" aria-hidden="true"><Smartphone size={18} strokeWidth={2} /></span>
          <span><strong>UPI / GPay / PhonePe</strong><small>{config.onlinePaymentsEnabled ? 'Pay securely with Razorpay.' : 'Scan the UPI QR to pay within 1:30.'}</small></span>
        </label>
        <label className={`payment-method-choice ${!config.onlinePaymentsEnabled ? 'unavailable' : ''}`}>
          <input type="radio" name={name} value="CARD" checked={method === 'CARD'} disabled={disabled || !config.onlinePaymentsEnabled} onChange={(event) => onChange(event.target.value)} />
          <span className="payment-choice-icon card" aria-hidden="true"><CreditCard size={18} strokeWidth={2} /></span>
          <span><strong>Credit / Debit Card</strong><small>{config.onlinePaymentsEnabled ? 'Enter card details securely with Razorpay.' : 'Requires Razorpay keys to accept card payments.'}</small></span>
        </label>
        <label className="payment-method-choice">
          <input type="radio" name={name} value="CASH" checked={method === 'CASH'} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
          <span className="payment-choice-icon cash" aria-hidden="true"><Banknote size={18} strokeWidth={2} /></span>
          <span><strong>Pay With Cash</strong><small>Pay on delivery.</small></span>
        </label>
      </fieldset>
    );
  }

  return (
    <>
      <fieldset className="payment-method-options">
        <legend>Payment method</legend>
        <label className="payment-method-choice">
          <input type="radio" name={name} value="CASH" checked={method === 'CASH'} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
          <span><strong>Pay in person</strong><small>Payment remains pending until collected.</small></span>
        </label>
        <label className={`payment-method-choice ${!config.onlinePaymentsEnabled && !allowUpiFallback ? 'unavailable' : ''}`}>
          <input type="radio" name={name} value="ONLINE" checked={method === 'ONLINE'} disabled={disabled || (!config.onlinePaymentsEnabled && !allowUpiFallback)} onChange={(event) => onChange(event.target.value)} />
          <span><strong>Online payment</strong><small>{config.onlinePaymentsEnabled ? 'Pay securely with Razorpay.' : allowUpiFallback ? 'Scan the UPI QR to pay within 1:30.' : 'Unavailable until Razorpay keys are configured.'}</small></span>
        </label>
      </fieldset>
      {!config.onlinePaymentsEnabled && !allowUpiFallback && <p className="payment-config-note">Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env to enable online payments.</p>}
    </>
  );
}

function UpiQrPaymentDialog({ referenceLabel, referenceId, payment, expiresAt, error, fallbackLabel = 'Switch to pay in person', onExpire }) {
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(90);
  const expired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const upiData = new URLSearchParams({
      pa: 'munniprasad2008@okaxis',
      pn: 'Nitesh Prasad',
      am: Number(payment.amount).toFixed(2),
      cu: 'INR',
      tn: `ParkEase ${referenceLabel.toLowerCase()} ${referenceId}`,
    });
    QRCode.toDataURL(`upi://pay?${upiData.toString()}`, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((image) => { if (!cancelled) setQrImage(image); })
      .catch(() => { if (!cancelled) setQrError('Could not create the payment QR. Switch to pay in person and try again.'); });
    return () => { cancelled = true; };
  }, [payment.amount, referenceId, referenceLabel]);

  useEffect(() => {
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (!remaining && !expired.current) {
        expired.current = true;
        onExpire();
      }
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <div className="confirmation-overlay">
      <section className="confirmation-card payment-dialog qr-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="upi-qr-title">
        <p className="eyebrow">UPI PAYMENT</p>
        <h2 id="upi-qr-title">Scan to pay ₹{payment.amount}.</h2>
        <p className="qr-payment-reference">{referenceLabel} {referenceId} · {secondsLeft > 0 ? `QR expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Payment window expired'}</p>
        <div className="qr-code-frame">
          {qrImage ? <img src={qrImage} alt={`UPI payment QR for this ${referenceLabel.toLowerCase()}`} /> : <span>{qrError ? 'QR unavailable' : 'Preparing QR…'}</span>}
        </div>
        <p className="qr-payment-note">Scan with any UPI app. Payment stays pending until it is verified.</p>
        {(error || qrError) && <div className="notice error" role="alert">{error || qrError}</div>}
        <div className="confirmation-actions">
          <button className="primary-button" type="button" onClick={onExpire}>{fallbackLabel}</button>
        </div>
      </section>
    </div>
  );
}

function RescheduleDialog({ draft, error, onChange, onSubmit, onClose, saving }) {
  const minimumTime = toDateTimeLocalValue(new Date());
  const locationName = draft.booking.locationId?.name || 'Parking location';

  return (
    <div className="confirmation-overlay">
      <section className="confirmation-card" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
        <button className="confirmation-close" type="button" onClick={onClose} aria-label="Close reschedule dialog">×</button>
        <p className="eyebrow">RESCHEDULE BOOKING</p>
        <h2 id="reschedule-title">Choose a new time.</h2>
        <p className="muted">{locationName} · Slot {draft.booking.slotId?.slotNumber || '—'}</p>
        <form className="booking-form" onSubmit={onSubmit}>
          {error && <div className="notice error" role="alert">{error}</div>}
          <label>New entry time<input type="datetime-local" min={minimumTime} value={draft.expectedEntryTime} onChange={(event) => onChange('expectedEntryTime', event.target.value)} required /></label>
          <label>New exit time<input type="datetime-local" min={draft.expectedEntryTime || minimumTime} value={draft.expectedExitTime} onChange={(event) => onChange('expectedExitTime', event.target.value)} required /></label>
          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Keep current time</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save new time'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Shop({ products, onBuyNow, onAddToCart }) {
  return (
    <section className="content-stack shop-view">
      <div className="section-intro">
        <p className="eyebrow">PARK EASE MARKET</p>
        <h2>Useful gear for the road ahead.</h2>
        <p>Everyday essentials for safer, easier drives.</p>
      </div>
      <div className="shop-products" aria-label="Vehicle accessories">
        {products.map((product) => (
          <article className="shop-product" key={product.sku}>
            <div className="shop-product-image"><img src={product.image} alt={product.imageAlt} loading="lazy" /></div>
            <div className="shop-product-content">
              <div className="shop-product-meta"><span className="shop-category">{product.category}</span><strong>₹{product.price.toLocaleString('en-IN')}</strong></div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <ProductPhotoCredit product={product} />
              <div className="shop-product-actions">
                <button className="primary-button shop-buy-button" type="button" onClick={() => onBuyNow(product)}>Buy now <span>→</span></button>
                <button className="secondary-button shop-add-button" type="button" onClick={() => onAddToCart(product)}><span aria-hidden="true">＋</span> Add to cart</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Cart({ products, items, onQuantityChange, onRemove, onShop, onCheckout }) {
  const cartLines = items
    .map((item) => ({ ...item, product: products.find((product) => product.sku === item.sku) }))
    .filter((item) => item.product);
  const subtotal = cartLines.reduce((total, item) => total + item.product.price * item.quantity, 0);

  return (
    <section className="content-stack shop-cart-view">
      <div className="section-intro"><p className="eyebrow">VEHICLE SHOP</p><h2>Your cart.</h2><p>{cartLines.length ? `${cartLines.length} product${cartLines.length === 1 ? '' : 's'} selected.` : 'Your saved shop items will appear here.'}</p></div>
      <div className="section-panel cart-panel">
        {cartLines.length ? <>
          <div className="cart-lines">
            {cartLines.map(({ sku, quantity, product }) => (
              <article className="cart-line" key={sku}>
                <img src={product.image} alt={product.imageAlt} />
                <div className="cart-line-details">
                  <span>{product.category}</span>
                  <strong>{product.name}</strong>
                  <small>₹{product.price.toLocaleString('en-IN')} each</small>
                </div>
                <div className="cart-line-controls">
                  <div className="cart-quantity-control" aria-label={`Quantity for ${product.name}`}>
                    <button type="button" onClick={() => onQuantityChange(sku, quantity - 1)} aria-label={`Decrease ${product.name} quantity`}>−</button>
                    <output>{quantity}</output>
                    <button type="button" onClick={() => onQuantityChange(sku, quantity + 1)} aria-label={`Increase ${product.name} quantity`}>＋</button>
                  </div>
                  <strong>₹{(product.price * quantity).toLocaleString('en-IN')}</strong>
                  <button type="button" className="text-button cart-remove-button" onClick={() => onRemove(sku)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-summary"><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN')}</strong></div>
          <div className="cart-actions"><button className="secondary-button" type="button" onClick={onShop}>Continue shopping</button><button className="primary-button" type="button" onClick={onCheckout}>Proceed to checkout <span>→</span></button></div>
        </> : <div className="empty-state"><span className="empty-icon cart-empty-icon"><ShoppingBasket size={34} strokeWidth={1.8} /></span><strong>Your cart is empty</strong><p>Add products from the vehicle shop to see them here.</p><button className="primary-button" type="button" onClick={onShop}>Browse vehicle shop <span>→</span></button></div>}
      </div>
    </section>
  );
}

function ProductPhotoCredit({ product }) {
  return <small className="shop-image-credit">Photo: {product.imageTitle} by <a href={product.imageSource} target="_blank" rel="noreferrer">{product.imageCredit}</a> · <a href={product.licenseUrl} target="_blank" rel="noreferrer">{product.imageLicense}</a></small>;
}

function ShopCheckoutDialog({ items, form, error, vehicles, paymentConfig, pendingPayment, onChange, onSubmit, onClose, saving }) {
  const orderTotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);

  return (
    <div className="confirmation-overlay">
      <section className="confirmation-card shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-checkout-title">
        <button className="confirmation-close" type="button" onClick={onClose} aria-label="Close checkout">×</button>
        <p className="eyebrow">DELIVERY DETAILS</p>
        <h2 id="shop-checkout-title">Where should it go?</h2>
        <div className="shop-checkout-layout">
          <div className="shop-order-product shop-checkout-items">
            {items.map(({ product, quantity }) => (
              <div className="shop-checkout-item" key={product.sku}>
                <img src={product.image} alt={product.imageAlt} />
                <div><span>{product.category}</span><strong>{product.name}</strong><small>Qty {quantity} × ₹{product.price.toLocaleString('en-IN')}</small></div>
                <b>₹{(product.price * quantity).toLocaleString('en-IN')}</b>
              </div>
            ))}
            <div className="shop-checkout-total"><span>Order total</span><strong>₹{orderTotal.toLocaleString('en-IN')}</strong></div>
          </div>
          <form className="shop-checkout-form" onSubmit={onSubmit}>
            {error && <div className="notice error" role="alert">{error}</div>}
            <label>Recipient name<input value={form.customerName} onChange={(event) => onChange('customerName', event.target.value)} minLength="2" maxLength="100" autoComplete="name" required /></label>
            <label>Phone number<input type="tel" value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="+91 98765 43210" autoComplete="tel" required /></label>
            <label>Vehicle registration<input list="shop-vehicle-list" value={form.vehicleNumber} onChange={(event) => onChange('vehicleNumber', event.target.value.toUpperCase())} placeholder="PB 10 AB 1234" pattern={"[A-Za-z0-9 \\x2d]{4,20}"} minLength="4" maxLength="20" required /></label>
            <datalist id="shop-vehicle-list">{vehicles.map((vehicle) => <option value={vehicle.vehicleNumber} key={vehicle._id} />)}</datalist>
            <label>Delivery location<textarea value={form.deliveryAddress} onChange={(event) => onChange('deliveryAddress', event.target.value)} placeholder="House or flat, street, landmark, city, state and PIN code" minLength="8" maxLength="300" autoComplete="street-address" required /></label>
            <PaymentMethodChoices method={form.paymentMethod} config={paymentConfig} onChange={(value) => onChange('paymentMethod', value)} name="shop-payment-method" disabled={Boolean(pendingPayment)} allowUpiFallback shopChoices />
            <div className="shop-checkout-actions">
              <button className="secondary-button" type="button" onClick={onClose}>Back to shop</button>
              <button className="primary-button" type="submit" disabled={saving || (form.paymentMethod === 'CARD' && !paymentConfig.onlinePaymentsEnabled)}>{saving ? 'Processing...' : pendingPayment ? 'Retry online payment' : form.paymentMethod === 'CASH' ? 'Place order' : form.paymentMethod === 'CARD' ? 'Enter card details' : paymentConfig.onlinePaymentsEnabled ? 'Pay with UPI' : 'Show UPI QR'}</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function ShopOrderConfirmation({ order, onClose }) {
  return (
    <div className="confirmation-overlay">
      <section className="confirmation-card shop-receipt" role="dialog" aria-modal="true" aria-labelledby="shop-receipt-title">
        <button className="confirmation-close" type="button" onClick={onClose} aria-label="Close order confirmation">×</button>
        <div className="confirmation-icon">✓</div>
        <p className="eyebrow">ORDER REQUEST RECEIVED</p>
        <h2 id="shop-receipt-title">{order.paymentStatus === 'PAID' ? 'Payment received. Order confirmed.' : 'Order placed. Pay in person on delivery.'}</h2>
        <div className="bill-header"><span>ORDER NUMBER</span><strong>{order.orderNumber}</strong><span>STATUS</span><b>{order.status}</b></div>
        <div className="shop-payment-result"><span>PAYMENT</span><strong className={order.paymentStatus === 'PAID' ? 'is-paid' : 'is-pending'}>{order.paymentStatus || 'PENDING'}</strong><small>{order.paymentMethod === 'ONLINE' ? 'Online' : 'Pay in person'}</small></div>
        <div className="bill-details shop-receipt-details">
          <div><span>Items</span><strong>{order.items?.length ? order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ') : order.productName}</strong><small>₹{order.amount.toLocaleString('en-IN')}</small></div>
          <div><span>Recipient</span><strong>{order.customerName}</strong><small>{order.phone}</small></div>
          <div><span>Vehicle</span><strong>{order.vehicleNumber}</strong><small>Delivery reference</small></div>
          <div><span>Deliver to</span><strong>{order.deliveryAddress}</strong><small>{order.status === 'PLACED' ? 'Order request received' : 'Payment is still pending'}</small></div>
        </div>
        <div className="confirmation-actions"><button className="primary-button" type="button" onClick={onClose}>Continue shopping</button></div>
      </section>
    </div>
  );
}

function ShopOrders({ orders, onShop }) {
  return (
    <section className="content-stack shop-orders-view">
      <div className="section-intro"><p className="eyebrow">VEHICLE SHOP</p><h2>My orders.</h2><p>Products you’ve ordered, with delivery and payment status.</p></div>
      {orders.length ? <div className="shop-order-list">
        {orders.map((order) => {
          const items = order.items?.length
            ? order.items
            : [{ productName: order.productName, quantity: 1, unitPrice: order.amount }];
          return (
            <article className="shop-order-card" key={order._id}>
              <header className="shop-order-header">
                <div><span>ORDER {order.orderNumber}</span><small>{new Date(order.createdAt).toLocaleString()}</small></div>
                <span className={`shop-order-status ${order.status.toLowerCase().replaceAll('_', '-')}`}>{order.status.replaceAll('_', ' ')}</span>
              </header>
              <div className="shop-order-items">
                {items.map((item, index) => (
                  <div className="shop-order-item" key={`${item.productSku || item.productName}-${index}`}>
                    <strong>{item.productName}</strong>
                    <span>Qty {item.quantity}</span>
                    <b>₹{((item.unitPrice ?? order.amount) * item.quantity).toLocaleString('en-IN')}</b>
                  </div>
                ))}
              </div>
              <footer className="shop-order-footer">
                <div><span>PAYMENT</span><strong className={order.paymentStatus === 'PAID' ? 'is-paid' : 'is-pending'}>{order.paymentStatus} · {formatPaymentMethod(order.paymentMethod)}</strong></div>
                <strong className="shop-order-total">₹{order.amount.toLocaleString('en-IN')}</strong>
              </footer>
              <div className="shop-order-delivery"><span>DELIVER TO</span><strong>{order.customerName} · {order.vehicleNumber}</strong><small>{order.deliveryAddress}</small></div>
            </article>
          );
        })}
      </div> : <div className="section-panel empty-state shop-orders-empty"><span className="empty-icon">▤</span><strong>No shop orders yet</strong><p>Your vehicle shop purchases will appear here.</p><button className="primary-button" type="button" onClick={onShop}>Browse vehicle shop <span>→</span></button></div>}
    </section>
  );
}

function NavButton({ active, onClick, label, icon, className = '' }) { return <button className={`nav-button ${active ? 'active' : ''} ${className}`} onClick={onClick}><span>{icon}</span>{label}</button>; }

function Overview({ user, bookings, activeBookings, locations, pricing, setView }) {
  const nextBooking = activeBookings[0];
  return <section className="content-stack"><div className="hero-panel"><div><p className="eyebrow light">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2>Ready when you are,<br /><em>{user.name?.split(' ')[0]}.</em></h2><p>Your parking dashboard is clear and up to date.</p><button className="light-button" onClick={() => setView('book')}>Find a parking spot <span>→</span></button></div><div className="hero-signal"><span>AVAILABLE NOW</span><strong>{locations.length ? locations.reduce((total, location) => total + (location.totalSlots || 0), 0) : '—'}</strong><small>spaces across {locations.length || 'your'} locations</small></div></div><div className="metric-grid"><Metric label="Active bookings" value={activeBookings.length} accent="mint" /><Metric label="Total visits" value={bookings.length} accent="yellow" /><Metric label="Locations" value={locations.length} accent="coral" /><Metric label="Starting at" value={pricing.length ? `₹${Math.min(...pricing.map((rule) => rule.pricePerHour))}` : '₹—'} accent="blue" /></div><div className="split-grid"><div className="section-panel"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h3>Your next arrival</h3></div><button className="text-button" onClick={() => setView('bookings')}>View all →</button></div>{nextBooking ? <BookingRow booking={nextBooking} featured /> : <div className="empty-state"><span className="empty-icon">⌖</span><strong>No upcoming visits</strong><p>Reserve a space when you know your next destination.</p><button className="secondary-button" onClick={() => setView('book')}>Book a slot</button></div>}</div><div className="section-panel dark-panel"><p className="eyebrow light">PARK SMART</p><h3>Leave room for what matters.</h3><p>Bookings can be changed before check-in. Your final fee is calculated from your actual parking time.</p><button className="light-text-button" onClick={() => setView('book')}>Explore spaces <span>→</span></button></div></div></section>;
}

function Metric({ label, value, accent }) { return <div className={`metric-card ${accent}`}><span>{label}</span><strong>{value}</strong><small>updated just now</small></div>; }

function LegacyBookingForm({ form, setForm, locations, slots, vehicles, pricing, onSubmit }) {
  const enteredVehicleNumber = form.vehicleNumber.trim().toUpperCase();
  const selectedVehicle = vehicles.find((vehicle) => vehicle.vehicleNumber === enteredVehicleNumber && vehicle.vehicleType === form.vehicleType);
  const compatibleSlots = selectedVehicle && form.locationId
    ? slots.filter((slot) => slot.vehicleType === selectedVehicle.vehicleType || selectedVehicle.vehicleType === 'OTHER')
    : [];
  const selectedPricing = pricing.find((rule) => rule.vehicleType === selectedVehicle?.vehicleType);
  const entry = new Date(form.expectedEntryTime);
  const exit = new Date(form.expectedExitTime);
  const durationHours = entry.getTime() && exit.getTime() && exit > entry ? Math.ceil((exit - entry) / (1000 * 60 * 60)) : 0;
  const estimatedTotal = selectedPricing && durationHours ? selectedPricing.pricePerHour * durationHours : 0;
  const allBookingDataFilled = Boolean(form.locationId && selectedVehicle && form.slotId && durationHours);
  const slotSelectionReady = Boolean(form.locationId && selectedVehicle);
  const vehicleFormatValid = /^[A-Z0-9 -]{4,20}$/.test(enteredVehicleNumber);
  const vehicleMessage = enteredVehicleNumber && !vehicleFormatValid
    ? 'Use 4 to 20 letters, numbers, spaces, or hyphens.'
    : enteredVehicleNumber && form.vehicleType && !selectedVehicle
      ? 'This number and vehicle type are not registered in My Garage.'
      : 'Enter a vehicle already added in My Garage.';

  const priceMessage = allBookingDataFilled ? `${durationHours} hour${durationHours === 1 ? '' : 's'} × ₹${selectedPricing.pricePerHour}` : 'Price appears after all booking fields are completed';
  return <section className="content-stack narrow"><div className="section-intro"><p className="eyebrow">RESERVE A SPACE</p><h2>Make arrival the easy part.</h2><p>Choose from parking locations across every Indian state and union territory.</p></div><form className="section-panel booking-form" onSubmit={onSubmit}><label>State and city parking location<select value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value, slotId: '' })} required><option value="">Select a city and state</option>{locations.map((location) => <option value={location._id} key={location._id}>{location.city}, {location.state}</option>)}</select></label><div className="form-row"><label>Vehicle registration number<input value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value.toUpperCase(), vehicleId: '', slotId: '' })} placeholder="PB 10 AB 1234" pattern="[A-Za-z0-9 -]{4,20}" minLength="4" maxLength="20" required /><small className="field-hint">Enter a registered number. Example: PB 10 AB 1234</small></label><label>Vehicle type<select value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value, vehicleId: '', slotId: '' })} required><option value="">Choose type</option>{vehicleOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div><label>Available slot<select value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })} required><option value="">{compatibleSlots.length ? 'Select an available slot' : form.locationId && selectedVehicle ? 'No available slots for this type' : 'Select location, vehicle number and type first'}</option>{compatibleSlots.map((slot) => <option value={slot._id} key={slot._id}>{slot.slotNumber} · {vehicleOptions.find((option) => option.value === slot.vehicleType)?.label || slot.vehicleType}</option>)}</select><small className="field-hint">Select a location, valid vehicle number, and matching type to see compatible slots.</small></label><div className="form-row"><label>Entry time<input type="datetime-local" value={form.expectedEntryTime} onChange={(event) => setForm({ ...form, expectedEntryTime: event.target.value })} required /></label><label>Exit time<input type="datetime-local" value={form.expectedExitTime} onChange={(event) => setForm({ ...form, expectedExitTime: event.target.value })} required /></label></div><div className="price-summary"><span>Vehicle rate</span><strong>{allBookingDataFilled ? `₹${selectedPricing.pricePerHour} / hour` : 'Complete booking details first'}</strong><small>{priceMessage}</small><b>{allBookingDataFilled ? `Estimated total: ₹${estimatedTotal}` : 'Estimated total: —'}</b></div><div className="form-summary"><span>Reservation summary</span><strong>{locations.find((location) => location._id === form.locationId)?.city || 'Choose a location'}<small>{form.locationId ? locations.find((location) => location._id === form.locationId)?.state : 'No state selected'} · {form.slotId ? `Slot ${compatibleSlots.find((slot) => slot._id === form.slotId)?.slotNumber || ''}` : 'No slot selected'}</small></strong></div><button className="primary-button" type="submit">Confirm reservation <span>→</span></button></form></section>;
}

function BookingForm({ form, setForm, locations, slots, vehicles, pricing, onSubmit }) {
  const enteredVehicleNumber = form.vehicleNumber.trim().toUpperCase();
  const vehicleFormatValid = /^[A-Z0-9 -]{4,20}$/.test(enteredVehicleNumber);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.vehicleNumber === enteredVehicleNumber && vehicle.vehicleType === form.vehicleType);
  const vehicleNumberReady = vehicleFormatValid && Boolean(form.vehicleType);
  const slotSelectionReady = Boolean(form.locationId && vehicleNumberReady);
  const compatibleSlots = form.locationId
    ? vehicleNumberReady
      ? slots.filter((slot) => slot.vehicleType === form.vehicleType || form.vehicleType === 'OTHER')
      : []
    : [];
  const selectedSlot = compatibleSlots.find((slot) => slot._id === form.slotId);
  const selectedPricing = pricing.find((rule) => rule.vehicleType === form.vehicleType);
  const entry = new Date(form.expectedEntryTime);
  const exit = new Date(form.expectedExitTime);
  const durationHours = entry.getTime() && exit.getTime() && exit > entry ? Math.ceil((exit - entry) / (1000 * 60 * 60)) : 0;
  const allBookingDataFilled = Boolean(form.locationId && vehicleNumberReady && selectedSlot && durationHours && selectedPricing);
  const estimatedTotal = allBookingDataFilled ? selectedPricing.pricePerHour * durationHours : 0;
  const vehicleMessage = enteredVehicleNumber && !vehicleFormatValid
    ? 'Use 4 to 20 letters, numbers, spaces, or hyphens.'
    : enteredVehicleNumber && form.vehicleType && !selectedVehicle
      ? 'Valid number format, but select the matching vehicle type.'
      : vehicleNumberReady
        ? 'Valid vehicle details. It will be added to your garage if needed.'
        : 'Enter a valid number and choose the vehicle type.';

  return (
    <section className="content-stack narrow">
      <div className="section-intro"><p className="eyebrow">RESERVE A SPACE</p><h2>Make arrival the easy part.</h2><p>Choose a location, vehicle, slot, and time.</p></div>
      <form className="section-panel booking-form" onSubmit={onSubmit}>
        <label>State and city parking location<select value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value, slotId: '' })} required><option value="">Select a city and state</option>{locations.map((location) => <option value={location._id} key={location._id}>{location.city}, {location.state}</option>)}</select></label>
        <div className="form-row">
          <label>Vehicle registration number<input value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value.toUpperCase(), vehicleId: '', slotId: '' })} placeholder="PB 10 AB 1234" pattern="[A-Za-z0-9 -]{4,20}" minLength="4" maxLength="20" required /><small className="field-hint">{vehicleMessage}</small></label>
          <label>Vehicle type<select value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value, vehicleId: '', slotId: '' })} required><option value="">Choose type</option>{vehicleOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        </div>
        <label>Available slot<select value={form.slotId} onChange={(event) => setForm({ ...form, slotId: event.target.value })} disabled={!slotSelectionReady || compatibleSlots.length === 0} required><option value="">{!slotSelectionReady ? 'Select a location first' : compatibleSlots.length ? 'Select an available slot' : 'No available slots for this type'}</option>{compatibleSlots.map((slot) => <option value={slot._id} key={slot._id}>{slot.slotNumber} · {vehicleOptions.find((option) => option.value === slot.vehicleType)?.label || slot.vehicleType}</option>)}</select><small className="field-hint">Choose a location to view available slots. Vehicle type will filter them when matched.</small></label>
        <div className="form-row"><label>Entry time<input type="datetime-local" value={form.expectedEntryTime} onChange={(event) => setForm({ ...form, expectedEntryTime: event.target.value })} required /></label><label>Exit time<input type="datetime-local" value={form.expectedExitTime} onChange={(event) => setForm({ ...form, expectedExitTime: event.target.value })} required /></label></div>
        <div className="price-summary"><span>Vehicle rate</span><strong>{allBookingDataFilled ? `₹${selectedPricing.pricePerHour} / hour` : 'Complete booking details first'}</strong><small>{allBookingDataFilled ? `${durationHours} hour${durationHours === 1 ? '' : 's'} × ₹${selectedPricing.pricePerHour}` : 'Price appears after location, vehicle, slot, entry, and exit are selected'}</small><b>{allBookingDataFilled ? `Estimated total: ₹${estimatedTotal}` : 'Estimated total: —'}</b></div>
        <div className="form-summary"><span>Reservation summary</span><strong>{locations.find((location) => location._id === form.locationId)?.city || 'Choose a location'}<small>{form.locationId ? locations.find((location) => location._id === form.locationId)?.state : 'No state selected'} · {form.slotId ? `Slot ${compatibleSlots.find((slot) => slot._id === form.slotId)?.slotNumber || ''}` : 'No slot selected'}</small></strong></div>
        <button className="primary-button" type="button" onClick={onSubmit}>Confirm reservation <span>→</span></button>
      </form>
    </section>
  );
}

function Bookings({ bookings, onReschedule, onPay, onlinePaymentsEnabled }) { return <section className="content-stack"><div className="section-intro"><p className="eyebrow">BOOKING LEDGER</p><h2>Your parking history.</h2><p>Every reservation, check-in, and payment in one place.</p></div><div className="section-panel booking-list">{bookings.length ? bookings.map((booking) => <BookingRow booking={booking} onReschedule={onReschedule} onPay={onPay} onlinePaymentsEnabled={onlinePaymentsEnabled} key={booking._id} />) : <div className="empty-state"><span className="empty-icon">▣</span><strong>No bookings yet</strong><p>Your confirmed reservations will appear here.</p></div>}</div></section>; }

function BookingRow({ booking, featured, onReschedule, onPay, onlinePaymentsEnabled }) {
  const canReschedule = ['PENDING', 'CONFIRMED'].includes(booking.status);
  const paymentPendingCash = booking.payment?.paymentMethod === 'CASH' && booking.payment?.paymentStatus === 'PENDING';
  const paymentPendingOnline = booking.payment?.paymentMethod === 'ONLINE' && booking.payment?.paymentStatus === 'PENDING';
  const timeOptions = { hour: 'numeric', minute: '2-digit' };

  return <div className={`booking-row ${featured ? 'featured' : ''}`}>
    <div className="booking-date"><strong>{new Date(booking.expectedEntryTime).toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>{new Date(booking.expectedEntryTime).toLocaleDateString(undefined, { month: 'short' })}</span></div>
    <div className="booking-info"><strong>{booking.locationId?.name || 'Parking location'}</strong><span>{booking.vehicleId?.vehicleNumber || 'Vehicle'} · Slot {booking.slotId?.slotNumber || '—'}</span><span>{new Date(booking.expectedEntryTime).toLocaleTimeString(undefined, timeOptions)} – {new Date(booking.expectedExitTime).toLocaleTimeString(undefined, timeOptions)}</span><small className={`booking-payment-status ${booking.payment?.paymentStatus === 'PAID' ? 'is-paid' : 'is-pending'}`}>Payment {booking.payment?.paymentStatus || 'PENDING'} · {formatPaymentMethod(booking.payment?.paymentMethod)}</small><div className="booking-actions">{onReschedule && canReschedule && <button type="button" className="booking-action-button" onClick={() => onReschedule(booking)}><CalendarClock size={14} aria-hidden="true" />Reschedule time</button>}{onPay && paymentPendingCash && <div className="booking-payment-actions"><button type="button" className="booking-action-button pay-upi-button" onClick={() => onPay(booking, 'UPI')}><QrCode size={14} aria-hidden="true" />Pay by UPI</button><button type="button" className="booking-action-button pay-card-button" onClick={() => onPay(booking, 'CARD')} disabled={!onlinePaymentsEnabled} title={!onlinePaymentsEnabled ? 'Card payments require Razorpay configuration.' : 'Pay by card'}><CreditCard size={14} aria-hidden="true" />Pay by card</button></div>}{onPay && paymentPendingOnline && onlinePaymentsEnabled && <button type="button" className="booking-action-button" onClick={() => onPay(booking, 'CARD')}><CreditCard size={14} aria-hidden="true" />Pay online</button>}</div></div>
    <div className={`pill ${booking.status.toLowerCase()}`}>{booking.status}</div>
    <div className="booking-price">₹{booking.finalAmount || booking.estimatedAmount || 0}<small>estimated</small></div>
  </div>;
}

function Garage({ vehicles, form, setForm, onSubmit }) { const modelOptions = vehicleModelOptions[form.vehicleType] || vehicleModelOptions.OTHER; return <section className="content-stack"><div className="section-intro"><p className="eyebrow">YOUR GARAGE</p><h2>Vehicles that move with you.</h2><p>Keep your vehicle details ready for faster reservations.</p></div><div className="garage-grid"><div className="section-panel"><div className="section-heading"><div><p className="eyebrow">REGISTERED VEHICLES</p><h3>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}</h3></div></div>{vehicles.length ? vehicles.map((vehicle) => <div className="vehicle-row" key={vehicle._id}><span className="vehicle-icon">{vehicle.vehicleType === 'BIKE' ? '◉' : '▰'}</span><div><strong>{vehicle.vehicleNumber}</strong><span>{vehicle.vehicleModel || 'Personal vehicle'} · {vehicleOptions.find((option) => option.value === vehicle.vehicleType)?.label || vehicle.vehicleType}</span></div><span className="vehicle-check">✓</span></div>) : <div className="empty-state"><strong>Your garage is empty</strong><p>Add a vehicle to start booking.</p></div>}</div><form className="section-panel add-form" onSubmit={onSubmit}><p className="eyebrow">ADD VEHICLE</p><h3>New vehicle</h3><label>Registration number<input value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value.toUpperCase() })} placeholder="PB 10 AB 1234" required /></label><label>Vehicle type<select value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value, vehicleModel: '' })}>{vehicleOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label>Car / vehicle model<select value={form.vehicleModel} onChange={(event) => setForm({ ...form, vehicleModel: event.target.value })}><option value="">Select model (optional)</option>{modelOptions.map((model) => <option value={model} key={model}>{model}</option>)}</select></label><button className="primary-button" type="submit">Add to garage <span>→</span></button></form></div></section>; }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
