// middleware/roleGaurd.js
// blocks routes based on user role
// always use AFTER verifyToken — requires req.user to be set
//
// usage:
//   router.post('/gigs', verifyToken, roleGuard('client'), createGig);
//   router.post('/apply', verifyToken, roleGuard('student'), applyToGig);
//   router.get('/admin', verifyToken, roleGuard('admin'), adminPanel);

const roleGuard = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'not authenticated.' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: `access denied. this action requires role: ${allowedRoles.join(' or ')}.`,
    });
  }
  next();
};

module.exports = { roleGuard };
