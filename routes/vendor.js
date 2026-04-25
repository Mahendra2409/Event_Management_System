const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { isSeller } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Apply seller middleware
router.use(isSeller);

// Seller Dashboard
router.get('/', (req, res) => {
  const sellerId = req.session.user.id;
  const products = db.prepare('SELECT * FROM products WHERE seller_id = ? ORDER BY id DESC LIMIT 5').all(sellerId);
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE seller_id = ?').get(sellerId).c;

  const orderStats = db.prepare(`
    SELECT COUNT(DISTINCT o.id) as totalOrders, COALESCE(SUM(oi.quantity * oi.price),0) as totalEarnings
    FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id
    WHERE p.seller_id = ?
  `).get(sellerId);

  const completedOrders = db.prepare(`
    SELECT COUNT(DISTINCT o.id) as c FROM orders o JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id WHERE p.seller_id = ? AND o.status = 'Delivered'
  `).get(sellerId).c;

  const recentTransactions = db.prepare(`
    SELECT o.*, oi.quantity, oi.price as item_price, p.name as product_name, u.name as user_name
    FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id
    JOIN users u ON o.user_id = u.id WHERE p.seller_id = ? ORDER BY o.created_at DESC LIMIT 5
  `).all(sellerId);

  res.render('vendor/main', {
    title: 'Seller Dashboard', activePage: 'dashboard',
    productCount, products,
    totalOrders: orderStats.totalOrders || 0,
    totalEarnings: orderStats.totalEarnings || 0,
    completedOrders, recentTransactions
  });
});

// Your Products
router.get('/items', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.seller_id = ?
  `).all(req.session.user.id);
  res.render('vendor/view-product', { title: 'Your Products', products, activePage: 'items' });
});

// Add New Product Page
router.get('/add-item', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE seller_id = ?').all(req.session.user.id);
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('vendor/add-item', { title: 'Add Product', products, categories, activePage: 'add-item' });
});

// Add Product POST
router.post('/add-item', upload.single('image'), (req, res) => {
  const { name, price, description, category_id, stock, discount_price } = req.body;
  const seller_id = req.session.user.id;
  if (!name || !price) {
    req.session.error = 'Product name and price are required.';
    return res.redirect('/seller/add-item');
  }
  const image = req.file ? req.file.filename : 'default.png';
  db.prepare(`INSERT INTO products (seller_id, name, price, description, category_id, stock, discount_price, image)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    seller_id, name, parseFloat(price), description || null,
    category_id ? parseInt(category_id) : null,
    stock ? parseInt(stock) : 100,
    discount_price ? parseFloat(discount_price) : null,
    image
  );
  req.session.success = 'Product added successfully!';
  return res.redirect('/seller/add-item');
});

// Delete Product
router.post('/delete-item/:id', (req, res) => {
  const { id } = req.params;
  const seller_id = req.session.user.id;
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(id, seller_id);
  if (product && product.image && product.image !== 'default.png') {
    const imagePath = path.join(uploadsDir, product.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
  db.prepare('DELETE FROM products WHERE id = ? AND seller_id = ?').run(id, seller_id);
  req.session.success = 'Product deleted!';
  return res.redirect('/seller/add-item');
});

// Update Product Page
router.get('/update-item/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(req.params.id, req.session.user.id);
  if (!product) { req.session.error = 'Product not found.'; return res.redirect('/seller/add-item'); }
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('vendor/update-item', { title: 'Update Product', product, categories, activePage: 'add-item' });
});

// Update Product POST
router.post('/update-item/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, price, description, category_id, stock, discount_price } = req.body;
  const seller_id = req.session.user.id;
  if (!name || !price) { req.session.error = 'Product name and price are required.'; return res.redirect(`/seller/update-item/${id}`); }
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(id, seller_id);
  if (!existing) { req.session.error = 'Product not found.'; return res.redirect('/seller/add-item'); }
  let image = existing.image;
  if (req.file) {
    if (existing.image && existing.image !== 'default.png') {
      const oldPath = path.join(uploadsDir, existing.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image = req.file.filename;
  }
  db.prepare(`UPDATE products SET name = ?, price = ?, description = ?, category_id = ?, stock = ?, discount_price = ?, image = ?
              WHERE id = ? AND seller_id = ?`).run(
    name, parseFloat(price), description || null,
    category_id ? parseInt(category_id) : null,
    stock ? parseInt(stock) : 100,
    discount_price ? parseFloat(discount_price) : null,
    image, id, seller_id
  );
  req.session.success = 'Product updated!';
  return res.redirect('/seller/add-item');
});

// Order Management
router.get('/product-status', (req, res) => {
  const seller_id = req.session.user.id;
  const orders = db.prepare(`
    SELECT DISTINCT o.id, o.name, o.email, o.address, o.status, o.created_at
    FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id
    WHERE p.seller_id = ? ORDER BY o.created_at DESC
  `).all(seller_id);
  const products = db.prepare('SELECT * FROM products WHERE seller_id = ?').all(seller_id);
  res.render('vendor/product-status', { title: 'Orders', orders, products, activePage: 'product-status' });
});

// Update Order Status Page
router.get('/update-order/:id', (req, res) => {
  const order = db.prepare(`
    SELECT DISTINCT o.* FROM orders o JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id WHERE o.id = ? AND p.seller_id = ?
  `).get(req.params.id, req.session.user.id);
  if (!order) { req.session.error = 'Order not found.'; return res.redirect('/seller/product-status'); }
  res.render('vendor/update-order', { title: 'Update Order', order, activePage: 'product-status' });
});

// Update Order Status POST
router.post('/update-order/:id', (req, res) => {
  const { status } = req.body;
  if (!status) { req.session.error = 'Please select a status.'; return res.redirect(`/seller/update-order/${req.params.id}`); }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  req.session.success = 'Order status updated!';
  return res.redirect('/seller/product-status');
});

// Inquiries (replaces request-items)
router.get('/inquiries', (req, res) => {
  const seller_id = req.session.user.id;
  const inquiries = db.prepare(`
    SELECT i.*, u.name as user_name FROM inquiries i JOIN users u ON i.user_id = u.id
    WHERE i.seller_id = ? ORDER BY i.created_at DESC
  `).all(seller_id);
  res.render('vendor/inquiries', { title: 'Inquiries', inquiries, activePage: 'inquiries' });
});
// Backward compat
router.get('/request-items', (req, res) => res.redirect('/seller/inquiries'));

// Transactions
router.get('/transactions', (req, res) => {
  const seller_id = req.session.user.id;
  const transactions = db.prepare(`
    SELECT o.*, oi.quantity, oi.price as item_price, p.name as product_name, u.name as user_name
    FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id
    JOIN users u ON o.user_id = u.id WHERE p.seller_id = ? ORDER BY o.created_at DESC
  `).all(seller_id);
  res.render('vendor/transactions', { title: 'Transactions', transactions, activePage: 'transactions' });
});

module.exports = router;
