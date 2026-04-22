const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { isVendor } = require('../middleware/auth');

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

// Apply vendor middleware to all routes
router.use(isVendor);

// Vendor Main Page
router.get('/', (req, res) => {
  res.render('vendor/main', { title: 'Vendor Dashboard' });
});

// Your Items / View Products
router.get('/items', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE vendor_id = ?').all(req.session.user.id);
  res.render('vendor/view-product', { title: 'Your Items', products });
});

// Add New Item Page
router.get('/add-item', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE vendor_id = ?').all(req.session.user.id);
  res.render('vendor/add-item', { title: 'Add New Item', products });
});

// Add New Item POST
router.post('/add-item', upload.single('image'), (req, res) => {
  const { name, price } = req.body;
  const vendor_id = req.session.user.id;

  if (!name || !price) {
    req.session.error = 'Product name and price are required.';
    return res.redirect('/vendor/add-item');
  }

  const image = req.file ? req.file.filename : 'default.png';

  db.prepare('INSERT INTO products (vendor_id, name, price, image) VALUES (?, ?, ?, ?)').run(vendor_id, name, parseFloat(price), image);

  req.session.success = 'Product added successfully!';
  return res.redirect('/vendor/add-item');
});

// Delete Item
router.post('/delete-item/:id', (req, res) => {
  const { id } = req.params;
  const vendor_id = req.session.user.id;

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND vendor_id = ?').get(id, vendor_id);
  if (product && product.image && product.image !== 'default.png') {
    const imagePath = path.join(uploadsDir, product.image);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }

  db.prepare('DELETE FROM products WHERE id = ? AND vendor_id = ?').run(id, vendor_id);
  req.session.success = 'Product deleted successfully!';
  return res.redirect('/vendor/add-item');
});

// Update Item Page
router.get('/update-item/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND vendor_id = ?').get(req.params.id, req.session.user.id);
  if (!product) {
    req.session.error = 'Product not found.';
    return res.redirect('/vendor/add-item');
  }
  res.render('vendor/update-item', { title: 'Update Product', product });
});

// Update Item POST
router.post('/update-item/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;
  const vendor_id = req.session.user.id;

  if (!name || !price) {
    req.session.error = 'Product name and price are required.';
    return res.redirect(`/vendor/update-item/${id}`);
  }

  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND vendor_id = ?').get(id, vendor_id);
  if (!existing) {
    req.session.error = 'Product not found.';
    return res.redirect('/vendor/add-item');
  }

  let image = existing.image;
  if (req.file) {
    if (existing.image && existing.image !== 'default.png') {
      const oldPath = path.join(uploadsDir, existing.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image = req.file.filename;
  }

  db.prepare('UPDATE products SET name = ?, price = ?, image = ? WHERE id = ? AND vendor_id = ?').run(name, parseFloat(price), image, id, vendor_id);

  req.session.success = 'Product updated successfully!';
  return res.redirect('/vendor/add-item');
});

// Product Status (orders containing this vendor's products)
router.get('/product-status', (req, res) => {
  const vendor_id = req.session.user.id;
  const orders = db.prepare(`
    SELECT DISTINCT o.id, o.name, o.email, o.address, o.status, o.created_at
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE p.vendor_id = ?
    ORDER BY o.created_at DESC
  `).all(vendor_id);

  res.render('vendor/product-status', { title: 'Product Status', orders });
});

// Update Order Status Page
router.get('/update-order/:id', (req, res) => {
  const order = db.prepare(`
    SELECT DISTINCT o.*
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.id = ? AND p.vendor_id = ?
  `).get(req.params.id, req.session.user.id);

  if (!order) {
    req.session.error = 'Order not found.';
    return res.redirect('/vendor/product-status');
  }
  res.render('vendor/update-order', { title: 'Update Order Status', order });
});

// Update Order Status POST
router.post('/update-order/:id', (req, res) => {
  const { status } = req.body;
  if (!status) {
    req.session.error = 'Please select a status.';
    return res.redirect(`/vendor/update-order/${req.params.id}`);
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  req.session.success = 'Order status updated successfully!';
  return res.redirect('/vendor/product-status');
});

// Request Items (user requests)
router.get('/request-items', (req, res) => {
  const vendor_id = req.session.user.id;
  const requests = db.prepare(`
    SELECT ur.*, u.name as user_name
    FROM user_requests ur
    JOIN users u ON ur.user_id = u.id
    WHERE ur.vendor_id = ?
    ORDER BY ur.created_at DESC
  `).all(vendor_id);

  res.render('vendor/request-item', { title: 'Request Items', requests });
});

// Transactions
router.get('/transactions', (req, res) => {
  const vendor_id = req.session.user.id;
  const transactions = db.prepare(`
    SELECT o.*, oi.quantity, oi.price as item_price, p.name as product_name, u.name as user_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    JOIN users u ON o.user_id = u.id
    WHERE p.vendor_id = ?
    ORDER BY o.created_at DESC
  `).all(vendor_id);

  res.render('vendor/transactions', { title: 'Transactions', transactions });
});

module.exports = router;
