// Authentication middleware

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.error = 'Please login to continue.';
  return res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.session.error = 'Access denied. Admin privileges required.';
  return res.redirect('/login');
}

function isUser(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'user') {
    return next();
  }
  req.session.error = 'Access denied. User login required.';
  return res.redirect('/login');
}

function isVendor(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'vendor') {
    return next();
  }
  req.session.error = 'Access denied. Vendor login required.';
  return res.redirect('/login');
}

function isAdminOrUser(req, res, next) {
  if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'user')) {
    return next();
  }
  req.session.error = 'Access denied.';
  return res.redirect('/login');
}

module.exports = { isAuthenticated, isAdmin, isUser, isVendor, isAdminOrUser };
