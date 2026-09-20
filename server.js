const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { pool, initDb } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

// ---------- AUTH ROUTES ----------
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const hashed = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashed]
    );
    req.session.userId = result.insertId;
    res.json({ message: 'Registered', userId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.userId = user.id;
    res.json({ message: 'Logged in', name: user.name });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [req.session.userId]);
  res.json({ loggedIn: true, user: rows[0] });
});

// ---------- PRODUCT ROUTES ----------
app.get('/api/products', async (req, res) => {
  const { category, search, sort } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  let params = [];
  if (category && category !== 'All') { query += ' AND category = ?'; params.push(category); }
  if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (sort === 'price_asc') query += ' ORDER BY price ASC';
  else if (sort === 'price_desc') query += ' ORDER BY price DESC';
  else if (sort === 'rating') query += ' ORDER BY rating DESC';
  const [products] = await pool.query(query, params);
  res.json(products);
});

app.get('/api/categories', async (req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT category FROM products');
  res.json(rows.map(r => r.category));
});

app.get('/api/products/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

// ---------- CART ROUTES ----------
app.post('/api/cart/add', requireLogin, (req, res) => {
  const { productId, quantity } = req.body;
  if (!req.session.cart) req.session.cart = [];
  const existing = req.session.cart.find(item => item.productId === productId);
  if (existing) existing.quantity += quantity;
  else req.session.cart.push({ productId, quantity });
  res.json({ cart: req.session.cart });
});

app.get('/api/cart', requireLogin, async (req, res) => {
  const cart = req.session.cart || [];
  const detailed = [];
  for (const item of cart) {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [item.productId]);
    if (rows[0]) detailed.push({ ...rows[0], quantity: item.quantity });
  }
  res.json(detailed);
});

app.post('/api/cart/update', requireLogin, (req, res) => {
  const { productId, quantity } = req.body;
  const item = (req.session.cart || []).find(i => i.productId === productId);
  if (item) item.quantity = Math.max(1, quantity);
  res.json({ cart: req.session.cart });
});

app.post('/api/cart/remove', requireLogin, (req, res) => {
  const { productId } = req.body;
  req.session.cart = (req.session.cart || []).filter(item => item.productId !== productId);
  res.json({ cart: req.session.cart });
});

// ---------- ADDRESS ROUTES ----------
app.get('/api/address', requireLogin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM addresses WHERE user_id = ?', [req.session.userId]);
  res.json(rows[0] || null);
});

app.post('/api/address', requireLogin, async (req, res) => {
  const { fullName, address, city, pincode, phone } = req.body;
  await pool.query(`
    INSERT INTO addresses (user_id, full_name, address, city, pincode, phone)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE full_name=?, address=?, city=?, pincode=?, phone=?
  `, [req.session.userId, fullName, address, city, pincode, phone, fullName, address, city, pincode, phone]);
  res.json({ message: 'Address saved' });
});

// ---------- ORDER PROCESSING ----------
app.post('/api/checkout', requireLogin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const { paymentMethod } = req.body;

    let total = 0;
    const items = [];
    for (const item of cart) {
      const [rows] = await conn.query('SELECT * FROM products WHERE id = ?', [item.productId]);
      const product = rows[0];
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Not enough stock for ${product.name}` });
      }
      total += product.price * item.quantity;
      items.push({ productId: item.productId, quantity: item.quantity, price: product.price });
    }

    await conn.beginTransaction();
    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total, status, payment_method) VALUES (?, ?, ?, ?)',
      [req.session.userId, total, 'Processing', paymentMethod || 'COD']
    );
    const orderId = orderResult.insertId;

    for (const i of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, i.productId, i.quantity, i.price]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [i.quantity, i.productId]);
    }

    await conn.commit();
    req.session.cart = [];
    res.json({ message: 'Order placed', orderId, total });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    conn.release();
  }
});

app.get('/api/orders', requireLogin, async (req, res) => {
  const [orders] = await pool.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.userId]
  );

  for (const order of orders) {
    const [items] = await pool.query(`
      SELECT oi.quantity, oi.price, p.name, p.image
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [order.id]);
    order.items = items;
  }

  res.json(orders);
});

// ---------- REVIEW ROUTES ----------
app.get('/api/reviews/:productId', async (req, res) => {
  const [reviews] = await pool.query(
    'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
    [req.params.productId]
  );
  res.json(reviews);
});

app.post('/api/reviews', requireLogin, async (req, res) => {
  const { productId, rating, comment } = req.body;
  const [userRows] = await pool.query('SELECT name FROM users WHERE id = ?', [req.session.userId]);
  await pool.query(
    'INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [productId, req.session.userId, userRows[0].name, rating, comment]
  );
  res.json({ message: 'Review added' });
});

const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post('/api/create-razorpay-order', requireLogin, async (req, res) => {
  const cart = req.session.cart || [];
  let total = 0;
  for (const item of cart) {
    const [rows] = await pool.query('SELECT price FROM products WHERE id = ?', [item.productId]);
    total += rows[0].price * item.quantity;
  }
  const order = await razorpay.orders.create({
    amount: Math.round(total * 100), // paise
    currency: 'INR',
    receipt: 'order_' + Date.now()
  });
  res.json({ orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID });
});

app.get('/api/wishlist', requireLogin, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.* FROM wishlist w JOIN products p ON w.product_id = p.id
    WHERE w.user_id = ?
  `, [req.session.userId]);
  res.json(rows);
});

app.post('/api/wishlist/toggle', requireLogin, async (req, res) => {
  const { productId } = req.body;
  const [existing] = await pool.query(
    'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?',
    [req.session.userId, productId]
  );
  if (existing.length > 0) {
    await pool.query('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.session.userId, productId]);
    res.json({ wishlisted: false });
  } else {
    await pool.query('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)', [req.session.userId, productId]);
    res.json({ wishlisted: true });
  }
});

app.get('/api/cart/count', (req, res) => {
  const cart = req.session.cart || [];
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  res.json({ count });
});

// ---------- START SERVER ----------
initDb()
  .then(() => {
    app.listen(3000, () => console.log('Server running on http://localhost:3000'));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
  });