const express = require('express');
const router = express.Router();
const db = require('../database');

const isUser = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'user') return next();
  res.redirect('/login');
};

router.use(isUser);

// Helper: get cart count for sidebar badge
function getCartCount(userId) {
  return db.prepare('SELECT COUNT(*) as count FROM cart WHERE user_id = ?').get(userId).count;
}

// Dashboard
router.get('/', (req, res) => {
  const userId = req.session.user.id;
  const cartCount = getCartCount(userId);
  const recentOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
  const orderStats = {
    total: db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get(userId).c,
    pending: db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'Received'").get(userId).c,
    shipped: db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'Ready for Shipping'").get(userId).c,
    delivered: db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'Out For Delivery'").get(userId).c,
  };
  res.render('user/portal', { activePage: 'dashboard', cartCount, recentOrders, orderStats });
});

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
  const cartCount = getCartCount(req.session.user.id);
  res.render('user/vendors', { vendors, categories, selectedCategory: cat, activePage: 'vendors', cartCount });
});

router.get('/vendors/:id/products', (req, res) => {
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.redirect('/user/vendors');
  const products = db.prepare('SELECT * FROM products WHERE vendor_id = ?').all(req.params.id);
  const cartCount = getCartCount(req.session.user.id);
  res.render('user/products', { vendor, products, activePage: 'vendors', cartCount });
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
  const cartCount = cartItems.length;
  res.render('user/cart', { cartItems, grandTotal, activePage: 'cart', cartCount });
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
  const cartCount = cartItems.length;
  res.render('user/checkout', { cartItems, totalAmount, activePage: 'cart', cartCount });
});

router.post('/checkout', (req, res) => {
  const userId = req.session.user.id;
  const { name, number, email, payment_method, address, city, state, pincode, country } = req.body;

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
  const itemCount = cartItems.length;

  // Store order details in session for the payment page
  req.session.pendingOrder = {
    userId, totalAmount, itemCount,
    name, number, email, payment_method,
    address, city, state, pincode, country: country || 'India',
    cartItems
  };

  res.render('user/payment', {
    totalAmount, payment_method, name, itemCount,
    activePage: 'cart', cartCount: itemCount
  });
});

// --- PAYMENT CONFIRM (called from payment page) ---
router.post('/payment/confirm', (req, res) => {
  const pending = req.session.pendingOrder;
  if (!pending) {
    req.session.error = 'No pending order found.';
    return res.redirect('/user/cart');
  }

  const { userId, totalAmount, name, number, email, payment_method, address, city, state, pincode } = pending;

  const orderResult = db.prepare(`
    INSERT INTO orders (user_id, total_amount, name, number, email, payment_method, address, city, state, pincode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, totalAmount, name, number, email, payment_method, address, city, state, pincode);

  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
  pending.cartItems.forEach(item => {
    insertItem.run(orderId, item.product_id, item.quantity, item.price);
  });

  // Clear cart
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(userId);
  delete req.session.pendingOrder;

  res.render('user/success', {
    totalAmount, orderId,
    orderDetails: { name, number, email, payment_method, address, city, state, pincode },
    activePage: 'cart', cartCount: 0
  });
});

// --- GUEST LIST ---
router.get('/guest-list', (req, res) => {
  const guests = db.prepare('SELECT * FROM guest_list WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  const cartCount = getCartCount(req.session.user.id);
  res.render('user/guest-list', { guests, activePage: 'guest-list', cartCount });
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
  const userId = req.session.user.id;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'Received').length,
    shipped: orders.filter(o => o.status === 'Ready for Shipping').length,
    delivered: orders.filter(o => o.status === 'Out For Delivery').length,
    cancelled: orders.filter(o => o.status === 'Cancelled').length,
  };
  const cartCount = getCartCount(userId);
  res.render('user/order-status', { orders, stats, activePage: 'order-status', cartCount });
});

// --- REQUEST ITEM ---
router.post('/request-item', (req, res) => {
  const { vendor_id, product_name, request_details } = req.body;
  db.prepare('INSERT INTO user_requests (user_id, vendor_id, product_name, request_details) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, vendor_id, product_name, request_details || null);
  req.session.success = 'Item request sent to vendor';
  res.redirect('/user/vendors/' + vendor_id + '/products');
});

// --- REQUEST ITEMS LIST (user's own requests) ---
router.get('/request-items', (req, res) => {
  const userId = req.session.user.id;
  const requests = db.prepare(`
    SELECT ur.*, v.name as vendor_name FROM user_requests ur
    JOIN vendors v ON ur.vendor_id = v.id
    WHERE ur.user_id = ? ORDER BY ur.created_at DESC
  `).all(userId);
  const cartCount = getCartCount(userId);
  res.render('user/request-items', { requests, activePage: 'request-items', cartCount });
});

// --- PRODUCT STATUS (items ordered and their delivery status) ---
router.get('/product-status', (req, res) => {
  const userId = req.session.user.id;
  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.image, o.status, o.created_at as order_date,
           v.name as vendor_name
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    JOIN vendors v ON p.vendor_id = v.id
    WHERE o.user_id = ? ORDER BY o.created_at DESC
  `).all(userId);
  const cartCount = getCartCount(userId);
  res.render('user/product-status', { items, activePage: 'product-status', cartCount });
});

module.exports = router;
