'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' });

export default function Home() {
  const [products, setProducts] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(() => (typeof window === 'undefined' ? null : localStorage.getItem('fresher_token')));

  const total = useMemo(() => products.reduce((sum, p) => sum + (Number(qtyMap[p.id] || 0) * p.priceKes), 0), [products, qtyMap]);

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function loadCatalog() {
    const data = await request('/api/catalog');
    setProducts(data.products);
  }

  async function loadOrders() {
    if (!token) return setOrders([]);
    try {
      const data = await request('/api/orders/me');
      setOrders(data.orders);
    } catch {
      setOrders([]);
    }
  }

  useEffect(() => {
    loadCatalog().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem('fresher_token', token);
      loadOrders();
    }
  }, [token]);

  async function handleRegister(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const formData = new FormData(event.currentTarget);
    try {
      await request('/api/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData.entries())) });
      setMessage('Account created successfully. Please login.');
      event.currentTarget.reset();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const formData = new FormData(event.currentTarget);
    try {
      const data = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData.entries())) });
      setToken(data.token);
      setProfile(data.profile);
      setMessage(`Welcome back, ${data.profile.fullName}.`);
      await loadOrders();
    } catch (e) {
      setError(e.message);
    }
  }

  async function placeOrder() {
    setError('');
    setMessage('');
    if (!token) return setError('Login is required before checkout.');

    const items = products
      .map((p) => ({ productId: p.id, qty: Number(qtyMap[p.id] || 0) }))
      .filter((item) => item.qty > 0);

    try {
      const data = await request('/api/orders', { method: 'POST', body: JSON.stringify({ items }) });
      setMessage(`Order placed: ${data.order.id} (${kes.format(data.order.totalKes)}).`);
      setQtyMap({});
      await loadCatalog();
      await loadOrders();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>Fresher</h1>
        <p>Minimal, elegant grocery ordering for Kenya.</p>
        <small>Prices in KES. Purchases require account login.</small>
      </header>

      <section className="panel">
        <h2>Product Catalog</h2>
        <div className="catalog">
          {products.map((p) => (
            <article key={p.id} className="card">
              <h3>{p.name}</h3>
              <p>{p.category} · {p.unit}</p>
              <strong>{kes.format(p.priceKes)}</strong>
              <span>Stock: {p.stock}</span>
              <input
                type="number"
                min="0"
                value={qtyMap[p.id] || 0}
                onChange={(e) => setQtyMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
            </article>
          ))}
        </div>
        <div className="checkout">
          <p>Estimated Total: <strong>{kes.format(total)}</strong></p>
          <button onClick={placeOrder}>Place Order</button>
        </div>
      </section>

      <section className="grid2">
        <form className="panel" onSubmit={handleRegister}>
          <h2>Create account</h2>
          <input name="fullName" placeholder="Full name" required />
          <input name="email" type="email" placeholder="Email" required />
          <input name="phone" placeholder="Phone (0712345678)" required />
          <input name="password" type="password" placeholder="Password" minLength={6} required />
          <button type="submit">Register</button>
        </form>

        <form className="panel" onSubmit={handleLogin}>
          <h2>Sign in</h2>
          <input name="emailOrPhone" placeholder="Email or +2547..." required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Login</button>
          <p>{profile ? `Logged in as ${profile.fullName} (${profile.phone})` : 'Not logged in.'}</p>
        </form>
      </section>

      <section className="panel">
        <h2>My Orders</h2>
        <ul>
          {orders.length ? orders.map((o) => (
            <li key={o.id}>{o.id} — {kes.format(o.totalKes)} — {new Date(o.createdAt).toLocaleString()}</li>
          )) : <li>No orders yet.</li>}
        </ul>
      </section>

      {message && <p className="ok">{message}</p>}
      {error && <p className="err">{error}</p>}
    </main>
  );
}
