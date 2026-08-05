const Product = require('../models/Product');

async function test() {
  const all = await Product.find({ hidden: false });
  console.log('Product.find({ hidden: false }) count:', all.length);

  const valFilter = await Product.find({
    hidden: false,
    isValentineProduct: { $ne: true },
    productType: { $ne: 'valentine' }
  });
  console.log('Product.find with valentine $ne filter count:', valFilter.length);
}

test().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
