const express = require('express');
const router = express.Router();
const db = require('../database');

const isUser = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'user') return next();
  res.redirect('/login');
};

router.use(isUser);

// Helper: get cart count
function getCartCount(userId) {
  return db.prepare('SELECT COUNT(*) as count FROM cart WHERE user_id = ?').get(userId).count;
}

// Helper: get wishlist count
function getWishlistCount(userId) {
  return db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?').get(userId).count;
}

// Dashboard
router.get('/', (req, res) => {
  const userId = req.session.user.id;
  const cartCount = getCartCount(userId);
  const wishlistCount = getWishlistCount(userId);
  const recentOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
  const orderStats = {
    total: db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get(userId).c,
    processing: db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'Processing'").get(userId).c,
    shipped: db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'Shipped'").get(userId).c,
    delivered: db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND status = 'Delivered'").get(userId).c,
  };
  const totalSpent = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE user_id = ?').get(userId).total;
  const wishlistItems = db.prepare(`
    SELECT w.*, p.name, p.price, p.image, p.discount_price
    FROM wishlist w JOIN products p ON w.product_id = p.id
    WHERE w.user_id = ? ORDER BY w.created_at DESC LIMIT 4
  `).all(userId);
  res.render('user/portal', { activePage: 'dashboard', cartCount, wishlistCount, recentOrders, orderStats, totalSpent, wishlistItems });
});

// --- SHOPS (formerly vendors) ---
router.get('/shops', (req, res) => {
  const categories = ['Electronics', 'Fashion', 'Home & Kitchen', 'Beauty', 'Sports', 'Books'];
  const cat = req.query.category || 'all';
  let sellers;
  if (cat === 'all') {
    sellers = db.prepare('SELECT * FROM sellers').all();
  } else {
    sellers = db.prepare('SELECT * FROM sellers WHERE category = ?').all(cat);
  }
  // count products per seller
  sellers.forEach(s => {
    s.productCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE seller_id = ?').get(s.id).c;
  });
  const cartCount = getCartCount(req.session.user.id);
  const wishlistCount = getWishlistCount(req.session.user.id);
  res.render('user/shops', { sellers, categories, selectedCategory: cat, activePage: 'shops', cartCount, wishlistCount });
});

router.get('/shops/:id/products', (req, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(req.params.id);
  if (!seller) return res.redirect('/user/shops');
  const products = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.seller_id = ?
  `).all(req.params.id);
  const cartCount = getCartCount(req.session.user.id);
  const wishlistCount = getWishlistCount(req.session.user.id);
  // check wishlist status
  const wishlistIds = db.prepare('SELECT product_id FROM wishlist WHERE user_id = ?').all(req.session.user.id).map(w => w.product_id);
  res.render('user/products', { seller, products, activePage: 'shops', cartCount, wishlistCount, wishlistIds });
});

// --- PRODUCT DETAIL ---
router.get('/product/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, s.name AS seller_name, s.id AS seller_id, s.rating AS seller_rating, c.name AS category_name
    FROM products p
    JOIN sellers s ON p.seller_id = s.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!product) return res.redirect('/user/view-products');
  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ? ORDER BY r.created_at DESC
  `).all(req.params.id);
  const relatedProducts = db.prepare(`
    SELECT p.*, s.name AS seller_name FROM products p
    JOIN sellers s ON p.seller_id = s.id
    WHERE p.category_id = ? AND p.id != ? LIMIT 4
  `).all(product.category_id, product.id);
  const cartCount = getCartCount(req.session.user.id);
  const wishlistCount = getWishlistCount(req.session.user.id);
  const inWishlist = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.session.user.id, req.params.id);
  res.render('user/product-detail', { product, reviews, relatedProducts, activePage: 'shop', cartCount, wishlistCount, inWishlist: !!inWishlist });
});

// --- PRODUCT REVIEW ---
router.post('/product/:id/review', (req, res) => {
  const { rating, comment } = req.body;
  const productId = req.params.id;
  const userId = req.session.user.id;
  if (!rating) {
    req.session.error = 'Please provide a rating.';
    return res.redirect(`/user/product/${productId}`);
  }
  try {
    db.prepare('INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)').run(userId, productId, parseInt(rating), comment || null);
    // Update product rating
    const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id = ?').get(productId);
    db.prepare('UPDATE products SET rating = ?, reviews_count = ? WHERE id = ?').run(Math.round(stats.avg * 10) / 10, stats.cnt, productId);
    req.session.success = 'Review submitted!';
  } catch (err) {
    console.error(err);
    req.session.error = 'Failed to submit review.';
  }
  res.redirect(`/user/product/${productId}`);
});

// --- VIEW ALL PRODUCTS ---
router.get('/view-products', (req, res) => {
  const cat = req.query.category || 'all';
  const search = req.query.search || '';
  const sort = req.query.sort || 'newest';
  let query = `SELECT p.*, s.name AS seller_name, s.category AS seller_category, c.name AS category_name
               FROM products p JOIN sellers s ON p.seller_id = s.id LEFT JOIN categories c ON p.category_id = c.id`;
  const conditions = [];
  const params = [];

  if (cat !== 'all') {
    conditions.push('c.name = ?');
    params.push(cat);
  }
  if (search) {
    conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');

  if (sort === 'price-low') query += ' ORDER BY p.price ASC';
  else if (sort === 'price-high') query += ' ORDER BY p.price DESC';
  else if (sort === 'rating') query += ' ORDER BY p.rating DESC';
  else query += ' ORDER BY p.created_at DESC';

  const products = db.prepare(query).all(...params);
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const cartCount = getCartCount(req.session.user.id);
  const wishlistCount = getWishlistCount(req.session.user.id);
  const wishlistIds = db.prepare('SELECT product_id FROM wishlist WHERE user_id = ?').all(req.session.user.id).map(w => w.product_id);
  res.render('user/view-products', { products, categories, selectedCategory: cat, searchQuery: search, sortBy: sort, activePage: 'view-product', cartCount, wishlistCount, wishlistIds });
});

// --- CART ---
router.get('/cart', (req, res) => {
  const cartItems = db.prepare(`
    SELECT c.id, c.quantity, p.name, p.price, p.discount_price, p.image, p.stock, s.name AS seller_name,
           (c.quantity * COALESCE(p.discount_price, p.price)) AS total_price
    FROM cart c
    JOIN products p ON c.product_id = p.id
    JOIN sellers s ON p.seller_id = s.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  const grandTotal = cartItems.reduce((sum, item) => sum + item.total_price, 0);
  const savings = cartItems.reduce((sum, item) => {
    if (item.discount_price) return sum + ((item.price - item.discount_price) * item.quantity);
    return sum;
  }, 0);
  const cartCount = cartItems.length;
  const wishlistCount = getWishlistCount(req.session.user.id);
  res.render('user/cart', { cartItems, grandTotal, savings, activePage: 'cart', cartCount, wishlistCount });
});

router.post('/cart/add', (req, res) => {
  const { product_id, quantity } = req.body;
  const userId = req.session.user.id;
  const qty = parseInt(quantity) || 1;
  const existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?').get(userId, product_id);
  if (existing) {
    db.prepare('UPDATE cart SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
  } else {
    db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, product_id, qty);
  }
  req.session.success = 'Added to cart!';
  const referer = req.headers.referer || '/user/view-products';
  res.redirect(referer);
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
    SELECT c.id, c.quantity, p.name, p.price, p.discount_price, p.image
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.session.user.id);

  if (cartItems.length === 0) return res.redirect('/user/cart');
  const totalAmount = cartItems.reduce((sum, item) => sum + ((item.discount_price || item.price) * item.quantity), 0);
  const cartCount = cartItems.length;
  const wishlistCount = getWishlistCount(req.session.user.id);
  res.render('user/checkout', { cartItems, totalAmount, activePage: 'cart', cartCount, wishlistCount });
});

router.post('/checkout', (req, res) => {
  const userId = req.session.user.id;
  const { name, number, email, payment_method, address, city, state, pincode, country } = req.body;

  const cartItems = db.prepare(`
    SELECT c.quantity, p.id AS product_id, p.price, p.discount_price
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(userId);

  if (cartItems.length === 0) {
    req.session.error = 'Cart is empty';
    return res.redirect('/user/cart');
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + ((item.discount_price || item.price) * item.quantity), 0);
  const itemCount = cartItems.length;

  req.session.pendingOrder = {
    userId, totalAmount, itemCount,
    name, number, email, payment_method,
    address, city, state, pincode, country: country || 'India',
    cartItems
  };

  const wishlistCount = getWishlistCount(userId);
  res.render('user/payment', {
    totalAmount, payment_method, name, itemCount,
    activePage: 'cart', cartCount: itemCount, wishlistCount
  });
});

// --- PAYMENT CONFIRM ---
router.post('/payment/confirm', (req, res) => {
  const pending = req.session.pendingOrder;
  if (!pending) {
    req.session.error = 'No pending order found.';
    return res.redirect('/user/cart');
  }

  const { userId, totalAmount, name, number, email, payment_method, address, city, state, pincode, country } = pending;

  const orderResult = db.prepare(`
    INSERT INTO orders (user_id, total_amount, name, number, email, payment_method, address, city, state, pincode, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, totalAmount, name, number, email, payment_method, address, city, state, pincode, country || 'India');

  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
  pending.cartItems.forEach(item => {
    insertItem.run(orderId, item.product_id, item.quantity, item.discount_price || item.price);
    // Decrease stock
    db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(item.quantity, item.product_id);
  });

  db.prepare('DELETE FROM cart WHERE user_id = ?').run(userId);
  delete req.session.pendingOrder;

  res.render('user/success', {
    totalAmount, orderId,
    orderDetails: { name, number, email, payment_method, address, city, state, pincode, country },
    activePage: 'cart', cartCount: 0, wishlistCount: getWishlistCount(userId)
  });
});

// --- WISHLIST (replaces guest-list) ---
router.get('/wishlist', (req, res) => {
  const userId = req.session.user.id;
  const items = db.prepare(`
    SELECT w.id, w.created_at, p.id as product_id, p.name, p.price, p.discount_price, p.image, p.stock, p.rating,
           s.name as seller_name
    FROM wishlist w
    JOIN products p ON w.product_id = p.id
    JOIN sellers s ON p.seller_id = s.id
    WHERE w.user_id = ? ORDER BY w.created_at DESC
  `).all(userId);
  const cartCount = getCartCount(userId);
  const wishlistCount = items.length;
  res.render('user/wishlist', { items, activePage: 'wishlist', cartCount, wishlistCount });
});

router.post('/wishlist/toggle', (req, res) => {
  const { product_id } = req.body;
  const userId = req.session.user.id;
  const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(userId, product_id);
  if (existing) {
    db.prepare('DELETE FROM wishlist WHERE id = ?').run(existing.id);
    req.session.success = 'Removed from wishlist';
  } else {
    db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(userId, product_id);
    req.session.success = 'Added to wishlist!';
  }
  const referer = req.headers.referer || '/user/wishlist';
  res.redirect(referer);
});

router.post('/wishlist/remove/:id', (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);
  req.session.success = 'Removed from wishlist';
  res.redirect('/user/wishlist');
});

// --- ORDER STATUS ---
router.get('/order-status', (req, res) => {
  const userId = req.session.user.id;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const stats = {
    total: orders.length,
    processing: orders.filter(o => o.status === 'Processing').length,
    shipped: orders.filter(o => o.status === 'Shipped').length,
    delivered: orders.filter(o => o.status === 'Delivered').length,
    cancelled: orders.filter(o => o.status === 'Cancelled').length,
  };
  const cartCount = getCartCount(userId);
  const wishlistCount = getWishlistCount(userId);
  res.render('user/order-status', { orders, stats, activePage: 'order-status', cartCount, wishlistCount });
});

// --- PRODUCT INQUIRIES (replaces request-items) ---
router.post('/inquiry', (req, res) => {
  const { seller_id, product_name, message } = req.body;
  db.prepare('INSERT INTO inquiries (user_id, seller_id, product_name, message) VALUES (?, ?, ?, ?)')
    .run(req.session.user.id, seller_id, product_name, message || null);
  req.session.success = 'Inquiry sent to seller';
  res.redirect('/user/shops/' + seller_id + '/products');
});

router.get('/inquiries', (req, res) => {
  const userId = req.session.user.id;
  const inquiries = db.prepare(`
    SELECT i.*, s.name as seller_name FROM inquiries i
    JOIN sellers s ON i.seller_id = s.id
    WHERE i.user_id = ? ORDER BY i.created_at DESC
  `).all(userId);
  const cartCount = getCartCount(userId);
  const wishlistCount = getWishlistCount(userId);
  res.render('user/inquiries', { inquiries, activePage: 'inquiries', cartCount, wishlistCount });
});

// --- PRODUCT STATUS (delivery tracking) ---
router.get('/product-status', (req, res) => {
  const userId = req.session.user.id;
  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.image, o.status, o.created_at as order_date,
           s.name as seller_name
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    JOIN sellers s ON p.seller_id = s.id
    WHERE o.user_id = ? ORDER BY o.created_at DESC
  `).all(userId);
  const cartCount = getCartCount(userId);
  const wishlistCount = getWishlistCount(userId);
  res.render('user/product-status', { items, activePage: 'product-status', cartCount, wishlistCount });
});

// Backward compat redirects
router.get('/vendors', (req, res) => res.redirect('/user/shops' + (req.query.category ? '?category=' + req.query.category : '')));
router.get('/vendors/:id/products', (req, res) => res.redirect('/user/shops/' + req.params.id + '/products'));
router.get('/guest-list', (req, res) => res.redirect('/user/wishlist'));
router.get('/request-items', (req, res) => res.redirect('/user/inquiries'));

module.exports = router;
