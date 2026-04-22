const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcrypt');
// Minimal auth middleware
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
};

router.use(isAdmin);

router.get('/', (req, res) => res.render('admin/dashboard'));
router.get('/maintain-user', (req, res) => res.render('admin/maintain-user'));
router.get('/maintain-vendor', (req, res) => res.render('admin/maintain-vendor'));

router.get('/manage/add/:type', (req, res) => res.render('admin/add-manage', { type: req.params.type }));
router.get('/manage/update/:type', (req, res) => {
  const table = req.params.type === 'vendor' ? 'vendors' : 'users';
  const roleCond = req.params.type === 'user' ? "WHERE role = 'user'" : "";
  const items = db.prepare(`SELECT * FROM ${table} ${roleCond}`).all();
  res.render('admin/update-manage', { type: req.params.type, items });
});

router.get('/membership/add/:type', (req, res) => res.render('admin/add-membership', { type: req.params.type }));
router.get('/membership/update/:type', (req, res) => res.render('admin/update-membership', { type: req.params.type, membership: null }));

module.exports = router;
