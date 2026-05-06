const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/verifyTokens');
const controller = require('./walletController');

router.use(verifyToken);
router.get('/token-plans', controller.plans);
router.get('/token-plans/:planId', controller.planDetail);
router.get('/wallet', controller.wallet);
router.get('/wallet/transactions', controller.transactions);
router.get('/wallet/purchases', controller.purchases);
router.post('/token-purchases/demo', controller.demoPurchase);
router.post('/token-purchases/checkout', controller.checkoutPurchase);

module.exports = router;
