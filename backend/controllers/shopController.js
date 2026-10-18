import ShopOrder from '../models/ShopOrder.js';
import Payment from '../models/Payment.js';
import shopProducts from '../data/shopProducts.js';

const createOrderNumber = () => `PE-${Date.now().toString().slice(-7)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const getShopProducts = (req, res) => {
  res.status(200).json({ success: true, data: { products: shopProducts } });
};

export const getShopOrders = async (req, res, next) => {
  try {
    const orders = await ShopOrder.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    next(error);
  }
};

export const createShopOrder = async (req, res, next) => {
  try {
    const { productSku, customerName, phone, vehicleNumber, deliveryAddress } = req.body;
    const paymentMethod = String(req.body.paymentMethod || 'CASH').toUpperCase();
    const requestedItems = Array.isArray(req.body.items) && req.body.items.length
      ? req.body.items
      : productSku ? [{ productSku, quantity: 1 }] : [];
    if (!requestedItems.length || requestedItems.length > 50) {
      return res.status(400).json({ success: false, message: 'Add between 1 and 50 products to the order.' });
    }

    const orderItems = [];
    for (const requestedItem of requestedItems) {
      const sku = String(requestedItem?.productSku || '').trim();
      const quantity = Number(requestedItem?.quantity ?? 1);
      const product = shopProducts.find((item) => item.sku === sku);
      if (!product) {
        return res.status(400).json({ success: false, message: 'Choose valid shop items.' });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return res.status(400).json({ success: false, message: 'Each product quantity must be between 1 and 99.' });
      }
      orderItems.push({
        productSku: product.sku,
        productName: product.name,
        unitPrice: product.price,
        quantity,
      });
    }

    const orderTotal = orderItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
    const name = String(customerName || '').trim();
    const phoneNumber = String(phone || '').trim();
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const registration = String(vehicleNumber || '').trim().toUpperCase();
    const address = String(deliveryAddress || '').trim();

    if (!['CASH', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Choose online payment or pay in person.' });
    }
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Enter a valid recipient name.' });
    }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({ success: false, message: 'Enter a valid phone number.' });
    }
    if (!/^[A-Z0-9 -]{4,20}$/.test(registration)) {
      return res.status(400).json({ success: false, message: 'Enter a valid vehicle registration number.' });
    }
    if (address.length < 8 || address.length > 300) {
      return res.status(400).json({ success: false, message: 'Enter a complete delivery address.' });
    }

    const order = await ShopOrder.create({
      orderNumber: createOrderNumber(),
      userId: req.user._id,
      productSku: orderItems[0].productSku,
      productName: orderItems.length === 1 ? orderItems[0].productName : `${orderItems.length} products`,
      items: orderItems,
      amount: orderTotal,
      customerName: name,
      phone: phoneNumber,
      vehicleNumber: registration,
      deliveryAddress: address,
      paymentMethod,
      paymentStatus: 'PENDING',
      status: paymentMethod === 'ONLINE' ? 'PAYMENT_PENDING' : 'PLACED',
    });

    const payment = await Payment.create({
      shopOrderId: order._id,
      userId: req.user._id,
      amount: order.amount,
      paymentMethod,
      paymentStatus: 'PENDING',
    });

    res.status(201).json({
      success: true,
      message: paymentMethod === 'ONLINE' ? 'Continue to online payment.' : 'Order request placed. Pay in person on delivery.',
      data: { order, payment },
    });
  } catch (error) {
    next(error);
  }
};