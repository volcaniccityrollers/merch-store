const functions = require('@google-cloud/functions-framework');
const Stripe = require('stripe');
const { Storage } = require('@google-cloud/storage');

const BUCKET = 'vcr-merch-images';
const PRODUCTS_FILE = 'products.json';
const CONFIG_FILE = 'config.json';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ALLOWED_ORIGINS = [
  'https://shop.volcaniccityrollers.co.nz',
  'http://shop.volcaniccityrollers.co.nz',
  'https://volcaniccityrollers.github.io',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Passcode');
  res.set('Access-Control-Max-Age', '3600');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getStorage() {
  return new Storage();
}

async function readJSON(filename) {
  const storage = getStorage();
  const [content] = await storage.bucket(BUCKET).file(filename).download();
  return JSON.parse(content.toString());
}

async function writeJSON(filename, data) {
  const storage = getStorage();
  await storage.bucket(BUCKET).file(filename).save(
    JSON.stringify(data, null, 2),
    { contentType: 'application/json', metadata: { cacheControl: 'no-cache' } }
  );
}

function validateAdmin(req) {
  const passcode = req.headers['x-admin-passcode'];
  return passcode === process.env.ADMIN_PASSCODE;
}

async function handleCheckout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, currency } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const cur = (currency || 'NZD').toUpperCase();
  if (cur !== 'NZD' && cur !== 'AUD') {
    return res.status(400).json({ error: 'currency must be NZD or AUD' });
  }

  const priceField = cur === 'AUD' ? 'priceAUD' : 'priceNZD';

  let products;
  try {
    products = await readJSON(PRODUCTS_FILE);
  } catch (err) {
    console.error('Failed to fetch products:', err.message);
    return res.status(500).json({ error: 'Failed to validate products' });
  }

  const productMap = {};
  for (const p of products) {
    productMap[p.id] = p;
  }

  const lineItems = [];
  for (const item of items) {
    const product = productMap[item.id];
    if (!product) {
      return res.status(400).json({ error: `Unknown product: ${item.id}` });
    }
    if (!product.active) {
      return res.status(400).json({ error: `Product not available: ${item.id}` });
    }

    const qty = Math.floor(Number(item.quantity));
    if (!qty || qty < 1 || qty > 10) {
      return res.status(400).json({ error: `Invalid quantity for ${item.id}: must be 1-10` });
    }

    const price = product[priceField];
    if (price == null) {
      return res.status(400).json({ error: `No ${cur} price for: ${item.id}` });
    }

    lineItems.push({
      price_data: {
        currency: cur.toLowerCase(),
        product_data: {
          name: product.name,
        },
        unit_amount: Math.round(price * 100),
      },
      quantity: qty,
    });
  }

  // Derive success/cancel URLs from request origin
  const origin = req.headers.origin;
  const baseUrl = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  const successUrl = baseUrl + '/success.html';
  const cancelUrl = baseUrl + '/';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

async function handleVerify(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passcode } = req.body;
  if (passcode === process.env.ADMIN_PASSCODE) {
    return res.status(200).json({ valid: true });
  }
  return res.status(401).json({ valid: false });
}

async function handleGetConfig(req, res) {
  try {
    const config = await readJSON(CONFIG_FILE);
    return res.status(200).json(config);
  } catch (err) {
    return res.status(200).json({ currency: 'NZD' });
  }
}

async function handleSetConfig(req, res) {
  if (!validateAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currency } = req.body;
  if (currency !== 'NZD' && currency !== 'AUD') {
    return res.status(400).json({ error: 'currency must be NZD or AUD' });
  }

  try {
    await writeJSON(CONFIG_FILE, { currency });
  } catch (err) {
    console.error('Failed to update config:', err.message);
    return res.status(500).json({ error: 'Failed to update config' });
  }

  return res.status(200).json({ currency });
}

async function handleGetProducts(req, res) {
  try {
    const products = await readJSON(PRODUCTS_FILE);
    return res.status(200).json(products);
  } catch (err) {
    return res.status(200).json([]);
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function handleUploadImage(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!validateAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { filename, data, contentType } = req.body;
  if (!filename || !data) {
    return res.status(400).json({ error: 'filename and data are required' });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'Invalid image type. Allowed: JPEG, PNG, WebP, GIF' });
  }

  const storage = getStorage();
  const file = storage.bucket(BUCKET).file(`images/${filename}`);

  try {
    const buffer = Buffer.from(data, 'base64');
    await file.save(buffer, {
      contentType: contentType || 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });

    const url = `https://storage.googleapis.com/${BUCKET}/images/${filename}`;
    return res.status(200).json({ url });
  } catch (err) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
}

async function handleCreateProduct(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!validateAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, priceNZD, priceAUD, description, image } = req.body;
  if (!name || priceNZD == null || priceAUD == null) {
    return res.status(400).json({ error: 'name, priceNZD, and priceAUD are required' });
  }

  let id = slugify(name);

  let products;
  try {
    products = await readJSON(PRODUCTS_FILE);
  } catch (err) {
    console.error('Failed to read products:', err.message);
    return res.status(500).json({ error: 'Failed to read product catalog' });
  }

  // Avoid ID collision
  if (products.some((p) => p.id === id)) {
    id = id + '-' + Date.now().toString(36);
  }

  const newProduct = {
    id,
    name,
    priceNZD,
    priceAUD,
    description: description || '',
    image: image || '',
    active: true,
  };

  products.push(newProduct);

  try {
    await writeJSON(PRODUCTS_FILE, products);
  } catch (err) {
    console.error('Failed to save products:', err.message);
    return res.status(500).json({ error: 'Failed to save product' });
  }

  return res.status(201).json({ product: newProduct });
}

async function handleDeleteProduct(req, res, productId) {
  if (!validateAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let products;
  try {
    products = await readJSON(PRODUCTS_FILE);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch products' });
  }

  const index = products.findIndex((p) => p.id === productId);
  if (index === -1) {
    return res.status(404).json({ error: `Product not found: ${productId}` });
  }

  products.splice(index, 1);

  try {
    await writeJSON(PRODUCTS_FILE, products);
  } catch (err) {
    console.error('Failed to save products:', err.message);
    return res.status(500).json({ error: 'Failed to delete product' });
  }

  return res.status(200).json({ deleted: true });
}

async function handleUpdateProduct(req, res, productId) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!validateAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const updates = req.body;
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const ALLOWED_FIELDS = ['name', 'priceNZD', 'priceAUD', 'description', 'image', 'active'];
  for (const key of Object.keys(updates)) {
    if (!ALLOWED_FIELDS.includes(key)) {
      return res.status(400).json({ error: `Invalid field: ${key}` });
    }
  }

  let products;
  try {
    products = await readJSON(PRODUCTS_FILE);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch products' });
  }

  const product = products.find((p) => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: `Product not found: ${productId}` });
  }

  for (const key of ALLOWED_FIELDS) {
    if (updates[key] !== undefined) {
      product[key] = updates[key];
    }
  }

  try {
    await writeJSON(PRODUCTS_FILE, products);
  } catch (err) {
    console.error('Failed to save products:', err.message);
    return res.status(500).json({ error: 'Failed to save product' });
  }

  return res.status(200).json({ product });
}

functions.http('merch-checkout', async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const path = req.path || req.url;

  try {
    if (path === '/checkout') {
      return await handleCheckout(req, res);
    }

    if (path === '/verify') {
      return await handleVerify(req, res);
    }

    if (path === '/config') {
      if (req.method === 'GET') return await handleGetConfig(req, res);
      if (req.method === 'PUT') return await handleSetConfig(req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (path === '/upload') {
      return await handleUploadImage(req, res);
    }

    if (path === '/products') {
      if (req.method === 'GET') return await handleGetProducts(req, res);
      if (req.method === 'POST') return await handleCreateProduct(req, res);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const productMatch = path.match(/^\/products\/([^/]+)$/);
    if (productMatch) {
      if (req.method === 'DELETE') return await handleDeleteProduct(req, res, productMatch[1]);
      return await handleUpdateProduct(req, res, productMatch[1]);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
