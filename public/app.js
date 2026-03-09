const api = {
  token: localStorage.getItem('fresher_token') || null,
  products: []
};

const messageEl = document.getElementById('message');
const catalogEl = document.getElementById('catalog');
const orderLinesEl = document.getElementById('order-lines');
const ordersListEl = document.getElementById('orders-list');
const sessionInfoEl = document.getElementById('session-info');

const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' });

function notify(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? '#a00000' : '#195f34';
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (api.token) headers.Authorization = `Bearer ${api.token}`;

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderCatalog(products) {
  catalogEl.innerHTML = '';
  orderLinesEl.innerHTML = '';

  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'product';
    card.innerHTML = `<strong>${p.name}</strong><br>${p.category}<br>${kes.format(p.priceKes)} / ${p.unit}<br>Stock: ${p.stock}`;
    catalogEl.appendChild(card);

    const line = document.createElement('div');
    line.className = 'order-line';
    line.innerHTML = `
      <label>${p.name} (${kes.format(p.priceKes)})
        <input type="hidden" value="${p.id}" name="productId">
      </label>
      <input type="number" min="0" step="1" value="0" name="qty-${p.id}" />
    `;
    orderLinesEl.appendChild(line);
  });
}

async function loadCatalog() {
  const data = await request('/api/catalog');
  api.products = data.products;
  renderCatalog(api.products);
}

function updateSessionInfo(profile) {
  if (profile) {
    sessionInfoEl.textContent = `Logged in as ${profile.fullName} (${profile.phone})`;
  } else {
    sessionInfoEl.textContent = 'You are not logged in.';
  }
}

document.getElementById('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    event.currentTarget.reset();
    notify('Registration successful. You can now log in.');
  } catch (error) {
    notify(error.message, true);
  }
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    api.token = data.token;
    localStorage.setItem('fresher_token', data.token);
    updateSessionInfo(data.profile);
    await loadMyOrders();
    notify('Login successful.');
  } catch (error) {
    notify(error.message, true);
  }
});

document.getElementById('order-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!api.token) {
    notify('Please login to place an order.', true);
    return;
  }

  const items = api.products
    .map((product) => {
      const qty = Number(document.querySelector(`input[name="qty-${product.id}"]`).value || 0);
      return { productId: product.id, qty };
    })
    .filter((item) => item.qty > 0);

  try {
    const data = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    notify(`Order placed! Total ${kes.format(data.order.totalKes)}.`);
    await loadCatalog();
    await loadMyOrders();
  } catch (error) {
    notify(error.message, true);
  }
});

async function loadMyOrders() {
  if (!api.token) {
    ordersListEl.innerHTML = '<li>Login to view your orders.</li>';
    return;
  }

  try {
    const data = await request('/api/orders/me');
    ordersListEl.innerHTML = data.orders.length
      ? data.orders
          .map((order) => `<li>${order.id} — ${kes.format(order.totalKes)} — ${new Date(order.createdAt).toLocaleString()}</li>`)
          .join('')
      : '<li>No orders yet.</li>';
  } catch {
    ordersListEl.innerHTML = '<li>Unable to load orders.</li>';
  }
}

(async function boot() {
  await loadCatalog();
  await loadMyOrders();
})();
