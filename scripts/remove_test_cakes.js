const prisma = require('../config/prisma');

async function removeTestCakesAndCombos() {
  console.log('🧹 Removing test cakes and combos from database...');

  const testProductIds = [
    'cake_prod_black_forest',
    'cake_prod_red_velvet',
    'cake_prod_pineapple',
    'cake_prod_butterscotch',
    'cake_prod_strawberry',
    'cake_prod_opera',
    'combo_cake_roses_12',
    'combo_red_velvet_lilies',
    'combo_black_forest_ferrero_roses',
    'combo_pineapple_teddy_carnations',
    '6a61e4e5aa2f6fde7128574f', // Belgian Chocolate Truffle Cake test seed
  ];

  try {
    // 1. Delete dependent associations explicitly
    console.log('Deleting associated images, variants, and categories...');
    await prisma.productImage.deleteMany({
      where: { productId: { in: testProductIds } }
    });

    await prisma.productVariant.deleteMany({
      where: { productId: { in: testProductIds } }
    });

    await prisma.productCategory.deleteMany({
      where: { productId: { in: testProductIds } }
    });

    if (prisma.cartItem) {
      await prisma.cartItem.deleteMany({
        where: { productId: { in: testProductIds } }
      });
    }

    if (prisma.wishlistItem) {
      await prisma.wishlistItem.deleteMany({
        where: { productId: { in: testProductIds } }
      });
    }

    if (prisma.review) {
      await prisma.review.deleteMany({
        where: { productId: { in: testProductIds } }
      });
    }

    // 2. Delete the test products
    const deleted = await prisma.product.deleteMany({
      where: { id: { in: testProductIds } }
    });

    console.log(`✅ Successfully deleted ${deleted.count} test products of cakes and combos.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error removing test products:', err);
    process.exit(1);
  }
}

removeTestCakesAndCombos();
