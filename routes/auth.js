const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// Index / Landing Page
router.get('/', (req, res) => {
  res.render('index', { title: 'Event Management System' });
});

// Login Page
router.get('/login', (req, res) => {
  res.render('login', { title: 'Login - Event Management System' });
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
    } else if (role === 'vendor') {
      user = db.prepare('SELECT * FROM vendors WHERE email = ?').get(email);
      if (user) user.role = 'vendor';
    }

    if (!user) {
      req.session.error = 'Invalid email or account not found.';
      return res.redirect('/login');
    }

    const match = bcrypt.compareSync(password, user.password);
    if (!match) {
      req.session.error = 'Invalid password.';
      return res.redirect('/login');
    }

    // Set session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || role,
      category: user.category || null
    };

    // Redirect based on role
    if (role === 'admin') return res.redirect('/admin');
    if (role === 'vendor') return res.redirect('/vendor');
    return res.redirect('/user');
  } catch (err) {
    console.error(err);
    req.session.error = 'Login failed. Please try again.';
    return res.redirect('/login');
  }
});

// Admin Signup Page
router.get('/signup/admin', (req, res) => {
  res.render('signup-admin', { title: 'Admin Signup - Event Management System' });
});

// Admin Signup POST
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

    req.session.success = 'Admin account created successfully! Please login.';
    return res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.session.error = 'Signup failed. Please try again.';
    return res.redirect('/signup/admin');
  }
});

// User Signup Page
router.get('/signup/user', (req, res) => {
  res.render('signup-user', { title: 'User Signup - Event Management System' });
});

// User Signup POST
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

    req.session.success = 'Account created successfully! Please login.';
    return res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.session.error = 'Signup failed. Please try again.';
    return res.redirect('/signup/user');
  }
});

// Vendor Signup Page
router.get('/signup/vendor', (req, res) => {
  res.render('signup-vendor', { title: 'Vendor Signup - Event Management System' });
});

// Vendor Signup POST
router.post('/signup/vendor', (req, res) => {
  const { name, email, password, category } = req.body;

  if (!name || !email || !password || !category) {
    req.session.error = 'All fields are required.';
    return res.redirect('/signup/vendor');
  }

  try {
    const existing = db.prepare('SELECT id FROM vendors WHERE email = ?').get(email);
    if (existing) {
      req.session.error = 'Email already registered.';
      return res.redirect('/signup/vendor');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO vendors (name, email, password, category) VALUES (?, ?, ?, ?)').run(name, email, hashedPassword, category);

    req.session.success = 'Vendor account created successfully! Please login.';
    return res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.session.error = 'Signup failed. Please try again.';
    return res.redirect('/signup/vendor');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/');
  });
});

module.exports = router;
