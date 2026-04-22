const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcrypt');

// Admin-only middleware
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.session.error = 'Access denied. Admin privileges required.';
  res.redirect('/login');
};

router.use(isAdmin);

// =========== DASHBOARD ===========
router.get('/', (req, res) => res.render('admin/dashboard'));

// =========== MAINTAIN USER / VENDOR ===========
router.get('/maintain-user', (req, res) => res.render('admin/maintain-user'));
router.get('/maintain-vendor', (req, res) => res.render('admin/maintain-vendor'));

// =========== ADD MEMBERSHIP ===========
router.get('/membership/add/:type', (req, res) => {
  res.render('admin/add-membership', { type: req.params.type });
});

router.post('/membership/add/:type', (req, res) => {
  const type = req.params.type;
  const { member_name, member_email, member_phone, duration, start_date } = req.body;

  // Server-side validation — all fields mandatory
  if (!member_name || !member_email || !member_phone || !duration || !start_date) {
    req.session.error = 'All fields are required.';
    return res.redirect(`/admin/membership/add/${type}`);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member_email)) {
    req.session.error = 'Please enter a valid email address.';
    return res.redirect(`/admin/membership/add/${type}`);
  }

  // Validate phone format (digits only, 10+ chars)
  if (!/^\d{10,15}$/.test(member_phone)) {
    req.session.error = 'Please enter a valid phone number (10-15 digits).';
    return res.redirect(`/admin/membership/add/${type}`);
  }

  // Validate duration value
  const validDurations = ['6 months', '1 year', '2 years'];
  if (!validDurations.includes(duration)) {
    req.session.error = 'Invalid membership duration selected.';
    return res.redirect(`/admin/membership/add/${type}`);
  }

  // Calculate end_date based on duration
  const start = new Date(start_date);
  let end = new Date(start_date);
  if (duration === '6 months') {
    end.setMonth(end.getMonth() + 6);
  } else if (duration === '1 year') {
    end.setFullYear(end.getFullYear() + 1);
  } else if (duration === '2 years') {
    end.setFullYear(end.getFullYear() + 2);
  }

  const endDateStr = end.toISOString().split('T')[0];

  try {
    db.prepare(`
      INSERT INTO memberships (member_type, member_id, member_name, member_email, member_phone, duration, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(type, 0, member_name, member_email, member_phone, duration, start_date, endDateStr);

    req.session.success = `${type.charAt(0).toUpperCase() + type.slice(1)} membership added successfully!`;
    return res.redirect(`/admin/maintain-${type}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Failed to add membership. Please try again.';
    return res.redirect(`/admin/membership/add/${type}`);
  }
});

// =========== UPDATE MEMBERSHIP ===========
router.get('/membership/update/:type', (req, res) => {
  res.render('admin/update-membership', { type: req.params.type, membership: null });
});

// Lookup membership by ID
router.post('/membership/lookup/:type', (req, res) => {
  const type = req.params.type;
  const { membership_id } = req.body;

  if (!membership_id) {
    req.session.error = 'Membership Number is required.';
    return res.redirect(`/admin/membership/update/${type}`);
  }

  try {
    const membership = db.prepare(
      'SELECT * FROM memberships WHERE id = ? AND member_type = ?'
    ).get(membership_id, type);

    if (!membership) {
      req.session.error = `Membership #${membership_id} not found for ${type}.`;
      return res.redirect(`/admin/membership/update/${type}`);
    }

    res.render('admin/update-membership', { type, membership });
  } catch (err) {
    console.error(err);
    req.session.error = 'Lookup failed. Please try again.';
    return res.redirect(`/admin/membership/update/${type}`);
  }
});

// Extend or Cancel membership
router.post('/membership/update/:type', (req, res) => {
  const type = req.params.type;
  const { membership_id, action, extension_duration } = req.body;

  if (!membership_id) {
    req.session.error = 'Membership ID is required.';
    return res.redirect(`/admin/membership/update/${type}`);
  }

  try {
    const membership = db.prepare(
      'SELECT * FROM memberships WHERE id = ? AND member_type = ?'
    ).get(membership_id, type);

    if (!membership) {
      req.session.error = 'Membership not found.';
      return res.redirect(`/admin/membership/update/${type}`);
    }

    if (action === 'cancel') {
      db.prepare('UPDATE memberships SET status = ? WHERE id = ?').run('cancelled', membership_id);
      req.session.success = `Membership #${membership_id} has been cancelled.`;
    } else if (action === 'extend') {
      // Default to 6 months if no duration selected
      const dur = extension_duration || '6 months';
      let endDate = new Date(membership.end_date);

      if (dur === '6 months') {
        endDate.setMonth(endDate.getMonth() + 6);
      } else if (dur === '1 year') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else if (dur === '2 years') {
        endDate.setFullYear(endDate.getFullYear() + 2);
      }

      const newEndDate = endDate.toISOString().split('T')[0];

      // Also reactivate if cancelled
      db.prepare('UPDATE memberships SET end_date = ?, duration = ?, status = ? WHERE id = ?')
        .run(newEndDate, dur, 'active', membership_id);

      req.session.success = `Membership #${membership_id} extended by ${dur}. New end date: ${newEndDate}`;
    }

    return res.redirect(`/admin/membership/update/${type}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Update failed. Please try again.';
    return res.redirect(`/admin/membership/update/${type}`);
  }
});

// =========== ADD USER / VENDOR ===========
router.get('/manage/add/:type', (req, res) => {
  res.render('admin/add-manage', { type: req.params.type });
});

router.post('/manage/add/:type', (req, res) => {
  const type = req.params.type;
  const { name, email, password, category } = req.body;

  // Validation
  if (!name || !email || !password) {
    req.session.error = 'Name, Email, and Password are required.';
    return res.redirect(`/admin/manage/add/${type}`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.session.error = 'Please enter a valid email address.';
    return res.redirect(`/admin/manage/add/${type}`);
  }

  if (type === 'vendor' && !category) {
    req.session.error = 'Category is required for vendors.';
    return res.redirect(`/admin/manage/add/${type}`);
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    if (type === 'vendor') {
      const existing = db.prepare('SELECT id FROM vendors WHERE email = ?').get(email);
      if (existing) {
        req.session.error = 'A vendor with this email already exists.';
        return res.redirect(`/admin/manage/add/${type}`);
      }
      db.prepare('INSERT INTO vendors (name, email, password, category) VALUES (?, ?, ?, ?)')
        .run(name, email, hashedPassword, category);
    } else {
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        req.session.error = 'A user with this email already exists.';
        return res.redirect(`/admin/manage/add/${type}`);
      }
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
        .run(name, email, hashedPassword, 'user');
    }

    req.session.success = `${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`;
    return res.redirect(`/admin/maintain-${type}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Failed to add. Please try again.';
    return res.redirect(`/admin/manage/add/${type}`);
  }
});

// =========== UPDATE USER / VENDOR ===========
router.get('/manage/update/:type', (req, res) => {
  const table = req.params.type === 'vendor' ? 'vendors' : 'users';
  const roleCond = req.params.type === 'user' ? "WHERE role = 'user'" : "";
  const items = db.prepare(`SELECT * FROM ${table} ${roleCond}`).all();
  res.render('admin/update-manage', { type: req.params.type, items });
});

router.post('/manage/update/:type', (req, res) => {
  const type = req.params.type;
  const { id, name, email, category } = req.body;

  if (!id || !name || !email) {
    req.session.error = 'Name and Email are required.';
    return res.redirect(`/admin/manage/update/${type}`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.session.error = 'Please enter a valid email address.';
    return res.redirect(`/admin/manage/update/${type}`);
  }

  try {
    if (type === 'vendor') {
      db.prepare('UPDATE vendors SET name = ?, email = ?, category = ? WHERE id = ?')
        .run(name, email, category || 'Catering', id);
    } else {
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')
        .run(name, email, id);
    }

    req.session.success = `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully!`;
    return res.redirect(`/admin/manage/update/${type}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Update failed. Please try again.';
    return res.redirect(`/admin/manage/update/${type}`);
  }
});

// =========== DELETE USER / VENDOR ===========
router.post('/manage/delete/:type/:id', (req, res) => {
  const { type, id } = req.params;

  try {
    if (type === 'vendor') {
      db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(id, 'user');
    }

    req.session.success = `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`;
    return res.redirect(`/admin/manage/update/${type}`);
  } catch (err) {
    console.error(err);
    req.session.error = 'Delete failed. Please try again.';
    return res.redirect(`/admin/manage/update/${type}`);
  }
});

module.exports = router;
