const express = require('express');
const router = express.Router();
const db = require('../database');

const isUser = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'user') return next();
  res.redirect('/login');
};

router.use(isUser);

// Dashboard
router.get('/', (req, res) => res.render('user/portal'));

// --- VENDORS ---
router.get('/vendors', (req, res) => {
  const categories = ['Catering', 'Florist', 'Decoration', 'Lighting'];
  const cat = req.query.category || 'all';
  let vendors;
  if (cat === 'all') {
    vendors = db.prepare('SELECT * FROM vendors').all();
  } else {
    vendors = db.prepare('SELECT * FROM vendors WHERE category = ?').all(cat);
  }
  res.render('user/vendors', { vendors, categories, selectedCategory: cat });
});

router.get('/vendors/:id/products', (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.redirect('/user/vendors');
  const products = db.prepare('SELECT * FROM products WHERE vendor_id = ?').all(req.params.id);
  res.render('user/products', { vendor, products });
});

// --- CART ---
router.get('/cart', (req, res) => {
  const cartItems = db.prepare(`
    SELECT c.id, c.quantity, p.name, p.price, p.image, v.name AS vendor_name,
           (c.quantity * p.price) AS total_price
    FROM cart c
    JOIN products p ON c.product_id = p.id
    JOIN vendors v ON p.vendor_id = v.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  const grandTotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);
  res.render('user/cart', { cartItems, grandTotal });
});

router.post('/cart/add', (req, res) => {
  const { product_id, quantity } = req.body;
  const userId = req.session.user.id;
  const qty = parseInt(quantity) || 1;

  // Check if already in cart
  const existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?').get(userId, product_id);
  if (existing) {
    db.prepare('UPDATE cart SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
  } else {
    db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, product_id, qty);
  }
  req.session.success = 'Item added to cart';
  res.redirect('/user/cart');
});

router.post('/cart/update/:id', (req, res) => {
  const qty = parseInt(req.body.quantity) || 1;
  db.prepare('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?').run(qty, req.params.id, req.session.user.id);
  res.redirect('/user/cart');
});

router.post('/cart/remove/:id', (req, res) => {
  db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);
  req.session.success = 'Item removed from cart';
  res.redirect('/user/cart');
});

router.post('/cart/clear', (req, res) => {
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.session.user.id);
  req.session.success = 'Cart cleared';
  res.redirect('/user/cart');
});

// --- CHECKOUT ---
router.get('/checkout', (req, res) => {
  const cartItems = db.prepare(`
    SELECT c.id, c.quantity, p.name, p.price, p.image
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  if (cartItems.length === 0) return res.redirect('/user/cart');
  const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('user/checkout', { cartItems, totalAmount });
});

router.post('/checkout', (req, res) => {
  const userId = req.session.user.id;
  const { name, number, email, payment_method, address, city, state, pincode } = req.body;

  const cartItems = db.prepare(`
    SELECT c.quantity, p.id AS product_id, p.price
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(userId);

  if (cartItems.length === 0) {
    req.session.error = 'Cart is empty';
    return res.redirect('/user/cart');
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const orderResult = db.prepare(`
    INSERT INTO orders (user_id, total_amount, name, number, email, payment_method, address, city, state, pincode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, totalAmount, name, number, email, payment_method, address, city, state, pincode);

  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
  cartItems.forEach(item => {
    insertItem.run(orderId, item.product_id, item.quantity, item.price);
  });

  // Clear cart
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(userId);

  res.render('user/success', {
    totalAmount,
    orderDetails: { name, number, email, payment_method, address, city, state, pincode }
  });
});

// --- GUEST LIST ---
router.get('/guest-list', (req, res) => {
  const guests = db.prepare('SELECT * FROM guest_list WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  res.render('user/guest-list', { guests });
});

router.post('/guest-list/add', (req, res) => {
  const { guest_name, guest_email, guest_phone, event_info } = req.body;
  db.prepare('INSERT INTO guest_list (user_id, guest_name, guest_email, guest_phone, event_info) VALUES (?, ?, ?, ?, ?)')
    .run(req.session.user.id, guest_name, guest_email, guest_phone || null, event_info || null);
  req.session.success = 'Guest added successfully';
  res.redirect('/user/guest-list');
});

router.post('/guest-list/update/:id', (req, res) => {
  const { guest_name, guest_email, guest_phone, event_info } = req.body;
  db.prepare('UPDATE guest_list SET guest_name = ?, guest_email = ?, guest_phone = ?, event_info = ? WHERE id = ? AND user_id = ?')
    .run(guest_name, guest_email, guest_phone || null, event_info || null, req.params.id, req.session.user.id);
  req.session.success = 'Guest updated';
  res.redirect('/user/guest-list');
});

router.post('/guest-list/delete/:id', (req, res) => {
  db.prepare('DELETE FROM guest_list WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);
  req.session.success = 'Guest removed';
  res.redirect('/user/guest-list');
});

// --- ORDER STATUS ---
router.get('/order-status', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  res.render('user/order-status', { orders });
});

// --- REQUEST ITEM ---
router.post('/request-item', (req, res) => {
  const { vendor_id, product_name, request_details } = req.body;
  db.prepare('INSERT INTO user_requests (user_id, vendor_id, product_name, request_details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, vendor_id, product_name, request_details || null);
  req.session.success = 'Item request sent to vendor';
  res.redirect('/user/vendors/' + vendor_id + '/products');
});

module.exports = router;
