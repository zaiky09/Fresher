const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const defaultCatalog = [
  { id: 'prd-1', name: 'Farm Fresh Spinach', category: 'Vegetables', unit: 'bunch', priceKes: 60, stock: 120 },
  { id: 'prd-2', name: 'Sweet Bananas', category: 'Fruits', unit: 'kg', priceKes: 140, stock: 80 },
  { id: 'prd-3', name: 'Organic Maize Flour', category: 'Cereals', unit: '2kg pack', priceKes: 240, stock: 200 },
  { id: 'prd-4', name: 'Premium Rice', category: 'Cereals', unit: '2kg pack', priceKes: 320, stock: 150 },
  { id: 'prd-5', name: 'Fresh Carrots', category: 'Vegetables', unit: 'kg', priceKes: 110, stock: 95 },
  { id: 'prd-6', name: 'Sukuma Wiki', category: 'Vegetables', unit: 'bunch', priceKes: 35, stock: 250 }
];

function ensureStore(filePath) {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(absolutePath)) {
    const seed = { users: [], products: defaultCatalog, orders: [] };
    fs.writeFileSync(absolutePath, JSON.stringify(seed, null, 2));
  }

  return absolutePath;
}

function readStore(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeStore(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createOrderId() {
  return `ord_${crypto.randomBytes(5).toString('hex')}`;
}

module.exports = {
  ensureStore,
  readStore,
  writeStore,
  createOrderId
};
