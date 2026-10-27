const prisma = require('../config/prisma');

async function updateCategorySeo() {
  const updates = [
    {
      slug: 'bouquets',
      metaTitle: 'Flower Bouquets in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Explore fresh flower bouquets in Hyderabad for birthdays, anniversaries and special occasions. Browse available styles and order your favorite bouquet online.',
      categoryUrl: '/bouquets'
    },
    {
      slug: 'roses',
      metaTitle: 'Rose Bouquets in Hyderabad | Red, Pink, Yellow & White Roses',
      metaDescription: 'Discover rose bouquets in Hyderabad, including red, pink, yellow and white roses. Explore available arrangements for romantic gifts and special occasions.',
      categoryUrl: '/roses'
    },
    {
      slug: 'cakes',
      metaTitle: 'Cakes in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Explore available cakes in Hyderabad for birthdays, anniversaries and special celebrations. Discover cake options and gift combinations at Spring Blossoms Florist.',
      categoryUrl: '/cakes'
    },
    {
      slug: 'combos',
      metaTitle: 'Flower and Cake Combos in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Make celebrations memorable with flower and cake combos from Spring Blossoms Florist. Explore available gift combinations for birthdays, anniversaries and special moments.',
      categoryUrl: '/combos'
    },
    {
      slug: 'cake-flower-combos',
      metaTitle: 'Flower and Cake Combos in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Make celebrations memorable with flower and cake combos from Spring Blossoms Florist. Explore available gift combinations for birthdays, anniversaries and special moments.',
      categoryUrl: '/cake-flower-combos'
    },
    {
      slug: 'sunflowers',
      metaTitle: 'Sunflower Bouquets in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Explore available sunflower bouquets for birthdays, thoughtful gifts and cheerful celebrations. Browse sunflower arrangements at Spring Blossoms Florist.',
      categoryUrl: '/sunflowers'
    },
    {
      slug: 'lilies',
      metaTitle: 'Lily Flowers and Bouquets in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Discover available lily flowers and bouquets for thoughtful gifts and special occasions. Explore lily arrangements at Spring Blossoms Florist.',
      categoryUrl: '/lilies'
    },
    {
      slug: 'flower-baskets',
      metaTitle: 'Flower Baskets in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Explore available flower baskets for birthdays, celebrations and thoughtful gifting. Find floral arrangements suited to your occasion.',
      categoryUrl: '/flower-baskets'
    },
    {
      slug: 'hydrangea',
      metaTitle: 'Hydrangea Flower Bouquets in Hyderabad | Spring Blossoms Florist',
      metaDescription: 'Explore exquisite hydrangea flower bouquets and luxury arrangements in Hyderabad. Handcrafted by master florists at Spring Blossoms Florist.',
      categoryUrl: '/hydrangea'
    }
  ];

  console.log('--- UPDATING CATEGORY SEO METADATA IN DATABASE ---');

  for (const item of updates) {
    const existing = await prisma.category.findFirst({
      where: { slug: item.slug }
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          metaTitle: item.metaTitle,
          metaDescription: item.metaDescription,
          categoryUrl: item.categoryUrl,
          isActive: true
        }
      });
      console.log(`✓ Updated [${item.slug}]: Title = "${item.metaTitle}"`);
    } else {
      console.log(`⚠️ Category with slug "${item.slug}" not found.`);
    }
  }

  // Also ensure /baskets redirects to /flower-baskets or resolves cleanly
  const basketsCat = await prisma.category.findFirst({ where: { slug: 'baskets' } });
  if (basketsCat) {
    await prisma.category.update({
      where: { id: basketsCat.id },
      data: {
        metaTitle: 'Flower Baskets in Hyderabad | Spring Blossoms Florist',
        metaDescription: 'Explore available flower baskets for birthdays, celebrations and thoughtful gifting. Find floral arrangements suited to your occasion.',
        categoryUrl: '/baskets',
        isActive: true
      }
    });
    console.log('✓ Updated [baskets]');
  }

  await prisma.$disconnect();
}

updateCategorySeo();
