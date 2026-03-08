const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { verifyToken } = require('../utils/jwt');

/**
 * Guard static product frontends behind login + active subscription.
 * If user is not authenticated, redirect to Login page for that product.
 * If user is authenticated but no active subscription, redirect to pricing.
 */
const requireProductSubscription = (productSlug) => {
  return async (req, res, next) => {
    try {
      let token = null;

      if (req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
      } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      }

      if (!token) {
        return res.redirect(`/Frontend/comp/Login.html?product=${encodeURIComponent(productSlug)}`);
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('_id isActive');
      if (!user || !user.isActive) {
        return res.redirect(`/Frontend/comp/Login.html?product=${encodeURIComponent(productSlug)}`);
      }

      const now = new Date();
      const subscription = await Subscription.findOne({
        userId: user._id,
        productSlug,
        status: 'active',
        endDate: { $gt: now },
      });

      if (!subscription) {
        return res.redirect(`/Frontend/comp/product-pricing.html?product=${encodeURIComponent(productSlug)}`);
      }

      req.user = { userId: user._id };
      req.subscription = subscription;
      next();
    } catch (error) {
      return res.redirect(`/Frontend/comp/Login.html?product=${encodeURIComponent(productSlug)}`);
    }
  };
};

module.exports = {
  requireProductSubscription,
};
