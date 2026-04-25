const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// Landing Page
router.get('/', (req, res) => {
  // Fetch featured products and categories for landing page
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const featuredProducts = db.prepare(`
    SELECT p.*, s.name AS seller_name, c.name AS category_name
    FROM products p
    JOIN sellers s ON p.seller_id = s.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_featured = 1
    ORDER BY p.created_at DESC LIMIT 8
  `).all();
  const topProducts = db.prepare(`
    SELECT p.*, s.name AS seller_name, c.name AS category_name
    FROM products p
    JOIN sellers s ON p.seller_id = s.id
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.rating DESC, p.reviews_count DESC LIMIT 8
  `).all();
  res.render('index', { title: 'NexCart — Shop the Future', categories, featuredProducts, topProducts });
});

// Login Pages
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login — NexCart', loginRole: 'user' });
});
router.get('/login/admin', (req, res) => {
  res.render('login', { title: 'Admin Login — NexCart', loginRole: 'admin' });
});
router.get('/login/user', (req, res) => {
  res.render('login', { title: 'Login — NexCart', loginRole: 'user' });
});
router.get('/login/seller', (req, res) => {
  res.render('login', { title: 'Seller Login — NexCart', loginRole: 'seller' });
});
router.get('/login/vendor', (req, res) => {
  res.redirect('/login/seller');
});

// Login POST
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    req.session.error = 'All fields are required.';
    return res.redirect('/login');
  }

  try {
    let user;
    if (role === 'admin' || role === 'user') {
      user = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, role);
    } else if (role === 'seller') {
      user = db.prepare('SELECT * FROM sellers WHERE email = ?').get(email);
      if (user) user.role = 'seller';
    }

    if (!user) {
      req.session.error = 'Invalid email or account not found.';
      return res.redirect(`/login/${role}`);
    }

    const match = bcrypt.compareSync(password, user.password);
    if (!match) {
      req.session.error = 'Invalid password.';
      return res.redirect(`/login/${role}`);
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || role,
      category: user.category || null
    };

    if (role === 'admin') return res.redirect('/admin');
    if (role === 'seller') return res.redirect('/seller');
    return res.redirect('/user');
  } catch (err) {
    console.error(err);
    req.session.error = 'Login failed. Please try again.';
    return res.redirect('/login');
  }
});

// Admin Signup
router.get('/signup/admin', (req, res) => {
  res.render('signup-admin', { title: 'Admin Signup — NexCart' });
});

router.post('/signup/admin', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    req.session.error = 'All fields are required.';
    return res.redirect('/signup/admin');
  }
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      req.session.error = 'Email already registered.';
      return res.redirect('/signup/admin');
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, 'admin');
    req.session.success = 'Admin account created! Please login.';
    return res.redirect('/login/admin');
  } catch (err) {
    console.error(err);
    req.session.error = 'Signup failed. Please try again.';
    return res.redirect('/signup/admin');
  }
});

// User Signup
router.get('/signup/user', (req, res) => {
  res.render('signup-user', { title: 'Create Account — NexCart' });
});

router.post('/signup/user', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    req.session.error = 'All fields are required.';
    return res.redirect('/signup/user');
  }
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      req.session.error = 'Email already registered.';
      return res.redirect('/signup/user');
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, 'user');
    req.session.success = 'Account created! Please login to start shopping.';
    return res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.session.error = 'Signup failed. Please try again.';
    return res.redirect('/signup/user');
  }
});

// Seller Signup
router.get('/signup/seller', (req, res) => {
  res.render('signup-seller', { title: 'Become a Seller — NexCart' });
});
router.get('/signup/vendor', (req, res) => {
  res.redirect('/signup/seller');
});

router.post('/signup/seller', (req, res) => {
  const { name, email, password, category, phone, location } = req.body;
  if (!name || !email || !password || !category) {
    req.session.error = 'All fields are required.';
    return res.redirect('/signup/seller');
  }
  try {
    const existing = db.prepare('SELECT id FROM sellers WHERE email = ?').get(email);
    if (existing) {
      req.session.error = 'Email already registered.';
      return res.redirect('/signup/seller');
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO sellers (name, email, password, category, phone, location) VALUES (?, ?, ?, ?, ?, ?)').run(name, email, hashedPassword, category, phone || null, location || null);
    req.session.success = 'Seller account created! Please login.';
    return res.redirect('/login/seller');
  } catch (err) {
    console.error(err);
    req.session.error = 'Signup failed. Please try again.';
    return res.redirect('/signup/seller');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/');
  });
});

module.exports = router;
