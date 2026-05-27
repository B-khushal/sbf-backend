const test = require('node:test');
const assert = require('node:assert/strict');

const Order = require('../models/Order');
const { ExternalApiError } = require('../modules/externalOrders/errors');
const {
  listExternalOrders,
  getExternalOrderById,
  updateExternalOrderStatus,
} = require('../modules/externalOrders/service');
const {
  validateStatusUpdateBody,
} = require('../modules/externalOrders/validation');

const originalFind = Order.find;
const originalCountDocuments = Order.countDocuments;
const originalFindById = Order.findById;

const restoreOrderModel = () => {
  Order.find = originalFind;
  Order.countDocuments = originalCountDocuments;
  Order.findById = originalFindById;
};

const createOrderDocument = (overrides = {}) => {
  const document = {
    _id: 'order-1',
    orderNumber: '240401001',
    status: 'order_placed',
    shippingDetails: {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      address: '1 Flower Street',
      city: 'Chennai',
      state: 'TN',
      zipCode: '600001',
      deliveryDate: new Date('2026-04-18T10:00:00.000Z'),
      timeSlot: '10:00-12:00',
    },
    items: [
      {
        product: {
          _id: 'product-1',
          title: 'Rose Bouquet',
          price: 1200,
          images: ['https://example.com/rose.jpg'],
        },
        title: 'Rose Bouquet',
        image: 'https://example.com/rose.jpg',
        images: ['https://example.com/rose.jpg'],
        quantity: 1,
        price: 1200,
        finalPrice: 1200,
      },
    ],
    paymentDetails: {
      method: 'razorpay',
    },
    totalAmount: 1200,
    currency: 'INR',
    currencyRate: 1,
    originalCurrency: 'INR',
    createdAt: new Date('2026-04-18T08:00:00.000Z'),
    updatedAt: new Date('2026-04-18T08:00:00.000Z'),
    user: {
      _id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-1234',
    },
    populate: async () => document,
    save: async () => document,
    ...overrides,
  };

  return document;
};

test.beforeEach(() => {
  restoreOrderModel();
});

test.after(() => {
  restoreOrderModel();
});

test('listExternalOrders applies pagination, filters, search, and sort', async () => {
  const captured = {};

  Order.countDocuments = async (query) => {
    captured.countQuery = query;
    return 3;
  };

  Order.find = (query) => {
    captured.findQuery = query;

    return {
      sort(sortClause) {
        captured.sortClause = sortClause;
        return this;
      },
      skip(skipValue) {
        captured.skipValue = skipValue;
        return this;
      },
      limit(limitValue) {
        captured.limitValue = limitValue;
        return this;
      },
      exec: async () => [createOrderDocument()],
    };
  };

  const result = await listExternalOrders({
    page: 2,
    limit: 10,
    status: 'PENDING',
    search: 'Jane',
    date: '2026-04-18',
    sortBy: 'total_amount',
    sortOrder: 'asc',
  });

  assert.deepStrictEqual(captured.findQuery.status, { $in: ['order_placed'] });
  assert.ok(Array.isArray(captured.findQuery.$or));
  assert.equal(captured.limitValue, 10);
  assert.equal(captured.skipValue, 10);
  assert.deepStrictEqual(captured.sortClause, { totalAmount: 1 });
  assert.equal(result.meta.page, 2);
  assert.equal(result.meta.limit, 10);
  assert.equal(result.meta.total, 3);
  assert.equal(result.meta.totalPages, 1);
  assert.equal(result.data[0].status, 'PENDING');
  assert.equal(result.data[0].customer.fullName, 'Jane Doe');
});

test('getExternalOrderById returns order details and 404 when missing', async () => {
  Order.findById = () => ({
    populate() {
      return this;
    },
    exec: async () => createOrderDocument(),
  });

  const order = await getExternalOrderById('order-1');

  assert.equal(order.status, 'PENDING');
  assert.equal(order.items[0].product.title, 'Rose Bouquet');
  assert.equal(order.customer.phone, '555-1234');

  Order.findById = () => ({
    populate() {
      return this;
    },
    exec: async () => null,
  });

  await assert.rejects(
    () => getExternalOrderById('missing-id'),
    (error) => error instanceof ExternalApiError && error.statusCode === 404 && error.code === 'ORDER_NOT_FOUND'
  );
});

test('updateExternalOrderStatus accepts a valid transition', async () => {
  const document = createOrderDocument({ status: 'order_placed' });

  Order.findById = () => ({
    populate() {
      return this;
    },
    exec: async () => document,
  });

  const result = await updateExternalOrderStatus('order-1', 'PROCESSING');

  assert.equal(document.status, 'received');
  assert.equal(result.changed, true);
  assert.equal(result.previousStatus, 'PENDING');
  assert.equal(result.nextStatus, 'PROCESSING');
  assert.equal(result.order.status, 'PROCESSING');
});

test('updateExternalOrderStatus rejects invalid transitions with 409', async () => {
  const document = createOrderDocument({ status: 'delivered' });

  Order.findById = () => ({
    populate() {
      return this;
    },
    exec: async () => document,
  });

  await assert.rejects(
    () => updateExternalOrderStatus('order-1', 'PROCESSING'),
    (error) => error instanceof ExternalApiError && error.statusCode === 409 && error.code === 'INVALID_STATUS_TRANSITION'
  );
});

test('validateStatusUpdateBody returns a validation error for invalid status', async () => {
  const req = {
    body: {
      status: 'bad-value',
    },
  };

  let capturedError = null;

  await new Promise((resolve) => {
    validateStatusUpdateBody(req, {}, (error) => {
      capturedError = error;
      resolve();
    });
  });

  assert.ok(capturedError instanceof ExternalApiError);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.code, 'VALIDATION_ERROR');
  assert.ok(capturedError.details.status);
});

test('validateStatusUpdateBody accepts legacy status aliases', async () => {
  const req = {
    body: {
      status: 'out_for_delivery',
    },
  };

  let capturedError = null;

  await new Promise((resolve) => {
    validateStatusUpdateBody(req, {}, (error) => {
      capturedError = error;
      resolve();
    });
  });

  assert.equal(capturedError, undefined);
  assert.equal(req.externalOrderStatus, 'SHIPPED');
});