const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcrypt');

// Admin-only middleware
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.session.error = 'Access denied. Admin privileges required.';
  res.redirect('/login/admin');
};

router.use(isAdmin);

// =========== DASHBOARD ===========
router.get('/', (req, res) => {
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'user'").get().c;
  const sellerCount = db.prepare('SELECT COUNT(*) as c FROM sellers').get().c;
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders').get().total;
  const recentOrders = db.prepare(`
    SELECT o.*, u.name as customer_name FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC LIMIT 5
  `).all();
  const topSellers = db.prepare(`
    SELECT s.*, COUNT(DISTINCT p.id) as product_count,
           COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
    FROM sellers s
    LEFT JOIN products p ON s.id = p.seller_id
    LEFT JOIN order_items oi ON p.id = oi.product_id
    GROUP BY s.id ORDER BY revenue DESC LIMIT 5
  `).all();
  res.render('admin/dashboard', {
    activePage: 'dashboard', userCount, sellerCount, orderCount, productCount,
    totalRevenue, recentOrders, topSellers
  });
});

// =========== MANAGE USERS ===========
router.get('/maintain-user', (req, res) => res.render('admin/maintain-user', { activePage: 'maintain-user' }));

// =========== MANAGE SELLERS ===========
router.get('/maintain-seller', (req, res) => res.render('admin/maintain-seller', { activePage: 'maintain-seller' }));
router.get('/maintain-vendor', (req, res) => res.redirect('/admin/maintain-seller'));

// =========== MANAGE CATEGORIES ===========
router.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.render('admin/categories', { activePage: 'categories', categories });
});

router.post('/categories/add', (req, res) => {
  const { name, icon, description } = req.body;
  if (!name) {
    req.session.error = 'Category name is required.';
    return res.redirect('/admin/categories');
  }
  try {
    db.prepare('INSERT INTO categories (name, icon, description) VALUES (?, ?, ?)').run(name, icon || null, description || null);
    req.session.success = 'Category added!';
  } catch (err) {
    req.session.error = 'Category already exists.';
  }
  res.redirect('/admin/categories');
});

router.post('/categories/delete/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  req.session.success = 'Category deleted.';
  res.redirect('/admin/categories');
});

// =========== ALL ORDERS ===========
router.get('/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.name as customer_name FROM orders o
    JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all();
  res.render('admin/orders', { activePage: 'orders', orders });
});

// =========== SUBSCRIPTIONS (replaces memberships) ===========
router.get('/subscription/add/:type', (req, res) => {
  res.render('admin/add-subscription', { type: req.params.type });
});

router.post('/subscription/add/:type', (req, res) => {
  const type = req.params.type;
  const { member_name, member_email, member_phone, duration, start_date } = req.body;

  if (!member_name || !member_email || !member_phone || !duration || !start_date) {
    req.session.error = 'All fields are required.';
    return res.redirect(`/admin/subscription/add/${type}`);
  }

  const validDurations = ['6 months', '1 year', '2 years'];
  if (!validDurations.includes(duration)) {
    req.session.error = 'Invalid subscription duration.';
    return res.redirect(`/admin/subscription/add/${type}`);
  }

  const start = new Date(start_date);
  let end = new Date(start_date);
  if (duration === '6 months') end.setMonth(end.getMonth() + 6);
  else if (duration === '1 year') end.setFullYear(end.getFullYear() + 1);
  else if (duration === '2 years') end.setFullYear(end.getFullYear() + 2);
  const endDateStr = end.toISOString().split('T')[0];

  try {
    db.prepare(`INSERT INTO subscriptions (member_type, member_id, member_name, member_email, member_phone, duration, start_date, end_date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`).run(type, 0, member_name, member_email, member_phone, duration, start_date, endDateStr);
    req.session.success = `${type} subscription added!`;
    return res.redirect(`/admin/maintain-${type === 'user' ? 'user' : 'seller'}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Failed to add subscription.';
    return res.redirect(`/admin/subscription/add/${type}`);
  }
});

// =========== UPDATE SUBSCRIPTION ===========
router.get('/subscription/update/:type', (req, res) => {
  res.render('admin/update-subscription', { type: req.params.type, subscription: null });
});

router.post('/subscription/lookup/:type', (req, res) => {
  const type = req.params.type;
  const { subscription_id } = req.body;
  if (!subscription_id) {
    req.session.error = 'Subscription ID is required.';
    return res.redirect(`/admin/subscription/update/${type}`);
  }
  try {
    const subscription = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND member_type = ?').get(subscription_id, type);
    if (!subscription) {
      req.session.error = `Subscription #${subscription_id} not found.`;
      return res.redirect(`/admin/subscription/update/${type}`);
    }
    res.render('admin/update-subscription', { type, subscription });
  } catch (err) {
    req.session.error = 'Lookup failed.';
    return res.redirect(`/admin/subscription/update/${type}`);
  }
});

router.post('/subscription/update/:type', (req, res) => {
  const type = req.params.type;
  const { subscription_id, action, extension_duration } = req.body;
  if (!subscription_id) {
    req.session.error = 'Subscription ID required.';
    return res.redirect(`/admin/subscription/update/${type}`);
  }
  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND member_type = ?').get(subscription_id, type);
    if (!sub) {
      req.session.error = 'Subscription not found.';
      return res.redirect(`/admin/subscription/update/${type}`);
    }
    if (action === 'cancel') {
      db.prepare('UPDATE subscriptions SET status = ? WHERE id = ?').run('cancelled', subscription_id);
      req.session.success = `Subscription #${subscription_id} cancelled.`;
    } else if (action === 'extend') {
      const dur = extension_duration || '6 months';
      let endDate = new Date(sub.end_date);
      if (dur === '6 months') endDate.setMonth(endDate.getMonth() + 6);
      else if (dur === '1 year') endDate.setFullYear(endDate.getFullYear() + 1);
      else if (dur === '2 years') endDate.setFullYear(endDate.getFullYear() + 2);
      const newEndDate = endDate.toISOString().split('T')[0];
      db.prepare('UPDATE subscriptions SET end_date = ?, duration = ?, status = ? WHERE id = ?').run(newEndDate, dur, 'active', subscription_id);
      req.session.success = `Subscription extended to ${newEndDate}`;
    }
    return res.redirect(`/admin/subscription/update/${type}`);
  } catch (err) {
    req.session.error = 'Update failed.';
    return res.redirect(`/admin/subscription/update/${type}`);
  }
});

// =========== ADD USER / SELLER ===========
router.get('/manage/add/:type', (req, res) => {
  const categories = req.params.type === 'seller' ? db.prepare('SELECT DISTINCT category FROM sellers').all().map(r => r.category) : [];
  res.render('admin/add-manage', { type: req.params.type, categories });
});

router.post('/manage/add/:type', (req, res) => {
  const type = req.params.type;
  const { name, email, password, category } = req.body;
  if (!name || !email || !password) {
    req.session.error = 'Name, Email, and Password are required.';
    return res.redirect(`/admin/manage/add/${type}`);
  }
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    if (type === 'seller') {
      const existing = db.prepare('SELECT id FROM sellers WHERE email = ?').get(email);
      if (existing) { req.session.error = 'Email already exists.'; return res.redirect(`/admin/manage/add/${type}`); }
      db.prepare('INSERT INTO sellers (name, email, password, category) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, category || 'General');
    } else {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) { req.session.error = 'Email already exists.'; return res.redirect(`/admin/manage/add/${type}`); }
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, 'user');
    }
    req.session.success = `${type} added successfully!`;
    return res.redirect(`/admin/maintain-${type}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Failed to add.';
    return res.redirect(`/admin/manage/add/${type}`);
  }
});

// =========== UPDATE USER / SELLER ===========
router.get('/manage/update/:type', (req, res) => {
  const type = req.params.type;
  let items;
  if (type === 'seller') {
    items = db.prepare('SELECT * FROM sellers').all();
  } else {
    items = db.prepare("SELECT * FROM users WHERE role = 'user'").all();
  }
  res.render('admin/update-manage', { type, items });
});

router.post('/manage/update/:type', (req, res) => {
  const type = req.params.type;
  const { id, name, email, category } = req.body;
  if (!id || !name || !email) {
    req.session.error = 'Name and Email required.';
    return res.redirect(`/admin/manage/update/${type}`);
  }
  try {
    if (type === 'seller') {
      db.prepare('UPDATE sellers SET name = ?, email = ?, category = ? WHERE id = ?').run(name, email, category || 'General', id);
    } else {
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, id);
    }
    req.session.success = `${type} updated!`;
    return res.redirect(`/admin/manage/update/${type}`);
  } catch (err) {
    req.session.error = 'Update failed.';
    return res.redirect(`/admin/manage/update/${type}`);
  }
});

// =========== DELETE USER / SELLER ===========
router.post('/manage/delete/:type/:id', (req, res) => {
  const { type, id } = req.params;
  try {
    if (type === 'seller') {
      db.prepare('DELETE FROM sellers WHERE id = ?').run(id);
    } else {
      db.prepare("DELETE FROM users WHERE id = ? AND role = 'user'").run(id);
    }
    req.session.success = `${type} deleted!`;
    return res.redirect(`/admin/manage/update/${type}`);
  } catch (err) {
    req.session.error = 'Delete failed.';
    return res.redirect(`/admin/manage/update/${type}`);
  }
});

module.exports = router;
