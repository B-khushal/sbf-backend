const prisma = require('../config/prisma');

async function seedCakes() {
  console.log('🎂 Starting Spring Blossoms Florist Cakes & Combos database seeding...');

  // 1. Activate & configure Cakes Parent Category
  const cakesParent = await prisma.category.upsert({
    where: { id: '6a61de1b59b09c0ea42c416c' },
    update: {
      name: 'Cakes',
      slug: 'cakes',
      description: 'Artisan handcrafted cakes baked fresh for birthdays, anniversaries, and all celebrations.',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
      banner: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=1600',
      categoryUrl: '/cakes',
      parentId: null,
      displayOrder: 2,
      isActive: true,
      isFeatured: true,
      metaTitle: 'Premium Cakes Online | Spring Blossoms Florist',
      metaDescription: 'Order freshly crafted cakes online from Spring Blossoms Florist. Choose from chocolate truffle, red velvet, black forest, fruit cakes and premium cake & flower combos with same-day delivery in Hyderabad.'
    },
    create: {
      id: '6a61de1b59b09c0ea42c416c',
      name: 'Cakes',
      slug: 'cakes',
      description: 'Artisan handcrafted cakes baked fresh for birthdays, anniversaries, and all celebrations.',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
      banner: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=1600',
      categoryUrl: '/cakes',
      parentId: null,
      displayOrder: 2,
      isActive: true,
      isFeatured: true,
      metaTitle: 'Premium Cakes Online | Spring Blossoms Florist',
      metaDescription: 'Order freshly crafted cakes online from Spring Blossoms Florist. Choose from chocolate truffle, red velvet, black forest, fruit cakes and premium cake & flower combos with same-day delivery in Hyderabad.'
    }
  });
  console.log('✅ Cakes Category configured:', cakesParent.id);

  // 2. Subcategories under Cakes
  const subcategoriesData = [
    {
      id: '6a2bbcb355f64c050177d7d6',
      name: 'Birthday Cakes',
      slug: 'birthday-cakes',
      description: 'Handcrafted celebration cakes for unforgettable birthdays.',
      image: 'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&q=80&w=800',
      displayOrder: 1
    },
    {
      id: 'subcat_chocolate_cakes',
      name: 'Chocolate Cakes',
      slug: 'chocolate-cakes',
      description: 'Rich Belgian truffle, dark chocolate ganache, and decadent cocoa creations.',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
      displayOrder: 2
    },
    {
      id: 'subcat_red_velvet_cakes',
      name: 'Red Velvet Cakes',
      slug: 'red-velvet-cakes',
      description: 'Classic crimson sponge layered with smooth cream cheese frosting.',
      image: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=800',
      displayOrder: 3
    },
    {
      id: 'subcat_black_forest_cakes',
      name: 'Black Forest Cakes',
      slug: 'black-forest-cakes',
      description: 'Cocoa sponge with Bavarian cream, tart cherries, and dark chocolate flakes.',
      image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=800',
      displayOrder: 4
    },
    {
      id: 'subcat_fruit_cakes',
      name: 'Fruit Cakes',
      slug: 'fruit-cakes',
      description: 'Light, tropical pineapple and strawberry compote cakes with fresh Chantilly cream.',
      image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=800',
      displayOrder: 5
    },
    {
      id: 'subcat_celebration_cakes',
      name: 'Celebration Cakes',
      slug: 'celebration-cakes',
      description: 'Opulent multi-tiered and designer celebration centerpieces.',
      image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=800',
      displayOrder: 6
    },
    {
      id: 'subcat_cake_combos',
      name: 'Cake & Flower Combos',
      slug: 'cake-flower-combos',
      description: 'Curated complete celebration packages pairing freshly baked cakes with luxury flowers and gifts.',
      image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=800',
      displayOrder: 7
    }
  ];

  for (const sub of subcategoriesData) {
    await prisma.category.upsert({
      where: { id: sub.id },
      update: {
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        image: sub.image,
        parentId: cakesParent.id,
        displayOrder: sub.displayOrder,
        isActive: true,
        isFeatured: true
      },
      create: {
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        image: sub.image,
        parentId: cakesParent.id,
        displayOrder: sub.displayOrder,
        isActive: true,
        isFeatured: true
      }
    });
  }
  console.log('✅ Cakes Subcategories configured');



  // 4. Products Data (7 Artisan Cakes + 4 Combos)
  const productsToSeed = [
    {
      id: '6a61e4e5aa2f6fde7128574f', // Update existing product
      name: 'Belgian Chocolate Truffle Cake',
      slug: 'belgian-chocolate-truffle-cake',
      shortDescription: 'Silky 55% cocoa Belgian dark chocolate ganache layered with moist cocoa sponge.',
      description: 'An exquisite masterpiece of European patisserie. Layers of ultra-moist dark chocolate sponge delicately layered with velvety 55% cocoa dark chocolate truffle ganache, finished with artisan chocolate curls and edible gold leaf shimmer. Freshly baked in our Hyderabad patisserie for birthdays, anniversaries, and special moments.',
      price: 649,
      comparePrice: 799,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_chocolate_cakes', '6a2bbcb355f64c050177d7d6'],
      rating: 4.9,
      reviewCount: 48,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=900',
        'https://res.cloudinary.com/djtrhfqan/image/upload/v1791459340/sbf-products/image-1791459333099-712392421.jpg'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 649, comparePrice: 799, stock: 50 },
        { name: '1 KG', size: '1 Kg', price: 999, comparePrice: 1299, stock: 40 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1449, comparePrice: 1799, stock: 25 },
        { name: '2 KG', size: '2 Kg', price: 1899, comparePrice: 2399, stock: 20 }
      ],
      cakeAttributes: {
        flavor: 'Chocolate',
        shape: 'round',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'birthday',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Belgian Dark Chocolate (55% Cocoa), Dutch Processed Cocoa, Farm Butter, Heavy Cream, Vanilla Pod',
        storageInstructions: 'Keep refrigerated between 2°C–5°C. For maximum silkiness, rest at room temperature for 15 minutes before serving.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'chocolate-cakes',
        categories: ['cakes', 'chocolate-cakes', 'birthday-cakes'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Premium Quality', 'Same-Day Delivery', 'Eggless Available', 'Bestseller']
      }
    },
    {
      id: 'cake_prod_black_forest',
      name: 'Classic Black Forest Cake',
      slug: 'classic-black-forest-cake',
      shortDescription: 'Airy cocoa sponge with Bavarian whipped cream, spiced tart cherries, and dark chocolate shavings.',
      description: 'The iconic European classic perfected by SBF patissiers. Layers of airy chocolate sponge soaked with cherry essence, enveloped in light-as-air whipped dairy cream, layered with tart spiced cherries, and crowned with shaved Swiss chocolate and glossy maraschino cherries.',
      price: 599,
      comparePrice: 749,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_black_forest_cakes', '6a2bbcb355f64c050177d7d6'],
      rating: 4.8,
      reviewCount: 36,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 599, comparePrice: 749, stock: 50 },
        { name: '1 KG', size: '1 Kg', price: 899, comparePrice: 1099, stock: 35 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1299, comparePrice: 1599, stock: 20 },
        { name: '2 KG', size: '2 Kg', price: 1699, comparePrice: 2099, stock: 15 }
      ],
      cakeAttributes: {
        flavor: 'Black Forest',
        shape: 'round',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'anniversary',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Dark Cocoa, Fresh Whipped Cream, Sweet & Tart Red Cherries, Dark Chocolate Flakes, Vanilla',
        storageInstructions: 'Refrigerate immediately at 2°C–5°C. Consume within 48 hours for best flavor and freshness.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'black-forest-cakes',
        categories: ['cakes', 'black-forest-cakes', 'birthday-cakes'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Same-Day Delivery', 'Eggless Available', 'Bestseller']
      }
    },
    {
      id: 'cake_prod_red_velvet',
      name: 'Royal Red Velvet Cream Cheese Cake',
      slug: 'royal-red-velvet-cream-cheese-cake',
      shortDescription: 'Signature crimson sponge with smooth Philadelphia cream cheese frosting and velvety cake crumble.',
      description: 'A regal dessert crowned with elegance. Velvety, soft-crumb crimson sponge accented with hints of buttermilk and mild cocoa, generously frosted with silky Philadelphia-style cream cheese frosting and dusted with delicate red velvet sponge crumble.',
      price: 699,
      comparePrice: 849,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_red_velvet_cakes', '6a2bbcb255f64c050177d7b0'],
      rating: 4.9,
      reviewCount: 52,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 699, comparePrice: 849, stock: 45 },
        { name: '1 KG', size: '1 Kg', price: 1099, comparePrice: 1399, stock: 35 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1599, comparePrice: 1999, stock: 20 },
        { name: '2 KG', size: '2 Kg', price: 2099, comparePrice: 2599, stock: 15 }
      ],
      cakeAttributes: {
        flavor: 'Red Velvet',
        shape: 'round',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'anniversary',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Philadelphia Cream Cheese, Pure Vanilla, Buttermilk, Cocoa, Red Velvet Crumble',
        storageInstructions: 'Keep chilled in airtight container between 2°C–5°C. Best enjoyed within 48 hours.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'red-velvet-cakes',
        categories: ['cakes', 'red-velvet-cakes', 'anniversary'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Premium Quality', 'Eggless Available', 'Bestseller']
      }
    },
    {
      id: 'cake_prod_pineapple',
      name: 'Fresh Tropical Pineapple Cake',
      slug: 'fresh-tropical-pineapple-cake',
      shortDescription: 'Fluffy golden sponge layered with house-made caramelized pineapple chunks and sweet whipped cream.',
      description: 'Refreshing, tropical, and wonderfully light. Fluffy golden vanilla sponge layered with house-made caramelized pineapple chunks and sweet whipped cream, garnished with fresh pineapple wedges and maraschino cherries.',
      price: 549,
      comparePrice: 699,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_fruit_cakes', '6a2bbcb355f64c050177d7d6'],
      rating: 4.7,
      reviewCount: 29,
      isFeatured: false,
      isBestseller: false,
      isNewArrival: true,
      images: [
        'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 549, comparePrice: 699, stock: 50 },
        { name: '1 KG', size: '1 Kg', price: 849, comparePrice: 999, stock: 40 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1199, comparePrice: 1499, stock: 25 },
        { name: '2 KG', size: '2 Kg', price: 1549, comparePrice: 1899, stock: 15 }
      ],
      cakeAttributes: {
        flavor: 'Pineapple',
        shape: 'round',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'birthday',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Juicy Tropical Pineapples, Whipped Fresh Cream, Golden Vanilla Sponge, Maraschino Cherries',
        storageInstructions: 'Store refrigerated at 2°C–5°C. Best enjoyed on the day of delivery.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'fruit-cakes',
        categories: ['cakes', 'fruit-cakes', 'birthday-cakes'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Same-Day Delivery', 'Eggless Available', 'NEW']
      }
    },
    {
      id: 'cake_prod_butterscotch',
      name: 'Crunchy Caramel Butterscotch Cake',
      slug: 'crunchy-caramel-butterscotch-cake',
      shortDescription: 'Golden sponge layered with butterscotch cream and handmade cashew-caramel praline nougat.',
      description: 'Delightful caramelized sweetness in every bite. Tender golden sponge layered with butterscotch cream and crunchy handmade cashew-caramel praline nougat, finished with a luscious butterscotch caramel glaze.',
      price: 599,
      comparePrice: 749,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_celebration_cakes', '6a2bbcb355f64c050177d7d6'],
      rating: 4.8,
      reviewCount: 31,
      isFeatured: false,
      isBestseller: false,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 599, comparePrice: 749, stock: 45 },
        { name: '1 KG', size: '1 Kg', price: 899, comparePrice: 1099, stock: 35 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1299, comparePrice: 1599, stock: 20 },
        { name: '2 KG', size: '2 Kg', price: 1699, comparePrice: 2099, stock: 15 }
      ],
      cakeAttributes: {
        flavor: 'Butterscotch',
        shape: 'round',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'birthday',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Brown Sugar Caramel, Roasted Cashew Praline, Whipped Dairy Cream, Vanilla Sponge',
        storageInstructions: 'Refrigerate at 2°C–5°C. Consume within 48 hours for optimal crunchiness of praline.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'celebration-cakes',
        categories: ['cakes', 'celebration-cakes', 'birthday-cakes'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Same-Day Delivery', 'Eggless Available']
      }
    },
    {
      id: 'cake_prod_strawberry',
      name: 'Fresh Strawberry Chantilly Cream Cake',
      slug: 'fresh-strawberry-chantilly-cream-cake',
      shortDescription: 'Delicate sponge with real strawberry compote and cloud-like Madagascar vanilla Chantilly cream.',
      description: 'A delightful celebration cake infused with natural berry warmth. Hand-picked ripe strawberries reduced into an artisan compote, paired with cloud-like Chantilly cream and fluffy vanilla sponge.',
      price: 649,
      comparePrice: 799,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_fruit_cakes', '6a2bbcb255f64c050177d7b0'],
      rating: 4.9,
      reviewCount: 27,
      isFeatured: true,
      isBestseller: false,
      isNewArrival: true,
      images: [
        'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 649, comparePrice: 799, stock: 40 },
        { name: '1 KG', size: '1 Kg', price: 999, comparePrice: 1249, stock: 30 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1449, comparePrice: 1749, stock: 20 },
        { name: '2 KG', size: '2 Kg', price: 1899, comparePrice: 2299, stock: 15 }
      ],
      cakeAttributes: {
        flavor: 'Strawberry',
        shape: 'round',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'anniversary',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Farm Strawberries, Madagascar Vanilla Chantilly, Whipped Cream, Light Butter Sponge',
        storageInstructions: 'Keep chilled at 2°C–5°C. Best enjoyed within 48 hours.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'fruit-cakes',
        categories: ['cakes', 'fruit-cakes', 'anniversary'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Same-Day Delivery', 'Eggless Available', 'NEW']
      }
    },
    {
      id: 'cake_prod_opera',
      name: 'Opulent French Opera Celebration Cake',
      slug: 'opulent-french-opera-celebration-cake',
      shortDescription: 'Grand French opera layers of almond sponge, espresso syrup, dark chocolate ganache and coffee buttercream.',
      description: 'Sophistication redefined for grand occasions. Almond Joconde sponge steeped in rich espresso syrup, layered with smooth French coffee buttercream and 70% dark chocolate ganache, finished with a glistening dark chocolate mirror glaze.',
      price: 799,
      comparePrice: 999,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_celebration_cakes', '6a2bbcb355f64c050177d7d6'],
      rating: 5.0,
      reviewCount: 18,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: true,
      images: [
        'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG', size: '0.5 Kg', price: 799, comparePrice: 999, stock: 35 },
        { name: '1 KG', size: '1 Kg', price: 1299, comparePrice: 1599, stock: 25 },
        { name: '1.5 KG', size: '1.5 Kg', price: 1799, comparePrice: 2199, stock: 15 },
        { name: '2 KG', size: '2 Kg', price: 2299, comparePrice: 2799, stock: 10 }
      ],
      cakeAttributes: {
        flavor: 'Opera',
        shape: 'square',
        weight: '0.5 Kg',
        eggless: false,
        egglessAvailable: false,
        prepTime: 'same-day',
        occasion: 'anniversary',
        serves: '4–6 People (½ KG) / 8–12 People (1 KG)',
        ingredients: 'Almond Joconde Sponge, 70% Dark Belgian Chocolate, Roasted Espresso Syrup, French Buttercream',
        storageInstructions: 'Refrigerate at 2°C–5°C. Allow to stand at room temperature for 10 minutes before serving.',
        availableSizes: ['0.5 Kg', '1 Kg', '1.5 Kg', '2 Kg']
      },
      details: {
        category: 'cakes',
        subcategory: 'celebration-cakes',
        categories: ['cakes', 'celebration-cakes', 'birthday-cakes'],
        sameDay: true,
        badges: ['Freshly Prepared', 'Premium Quality', 'Bestseller', 'NEW']
      }
    },
    // --- 4 MAJOR CAKE + FLOWER / GIFT COMBOS ---
    {
      id: 'combo_cake_roses_12',
      name: 'Belgian Truffle Cake & 12 Red Roses Combo',
      slug: 'belgian-truffle-cake-and-12-red-roses-combo',
      shortDescription: '1/2 KG Belgian Chocolate Truffle Cake paired with a hand-tied bouquet of 12 Dutch Red Roses.',
      description: 'The ultimate signature celebration bundle. Half kilogram of freshly baked Belgian Chocolate Truffle Cake accompanied by 12 freshly harvested, long-stem Dutch Red Roses wrapped in luxury matte paper with satin ribbon. Perfect for birthdays, anniversaries, and romantic expressions.',
      price: 1499,
      comparePrice: 1899,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_cake_combos', '6a2bbcb255f64c050177d7b4', '6a2bbcb255f64c050177d7b0'],
      rating: 4.9,
      reviewCount: 64,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG Cake + 12 Roses', size: '0.5 Kg', price: 1499, comparePrice: 1899, stock: 40 },
        { name: '1 KG Cake + 12 Roses', size: '1 Kg', price: 1849, comparePrice: 2299, stock: 30 },
        { name: '½ KG Cake + 24 Roses', size: '0.5 Kg + 24 Roses', price: 1999, comparePrice: 2499, stock: 25 },
        { name: '1 KG Cake + 24 Roses', size: '1 Kg + 24 Roses', price: 2349, comparePrice: 2899, stock: 20 }
      ],
      cakeAttributes: {
        flavor: 'Chocolate',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'anniversary',
        serves: '4–6 People for Cake + Floral Arrangement',
        ingredients: 'Belgian Truffle Cake + 12 Farm Fresh Red Roses with Gypsy fillers',
        availableSizes: ['½ KG Cake + 12 Roses', '1 KG Cake + 12 Roses', '½ KG Cake + 24 Roses', '1 KG Cake + 24 Roses']
      },
      comboAttributes: {
        comboProducts: [
          { name: 'Belgian Chocolate Truffle Cake', type: 'cake', price: 649, quantity: 1, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600' },
          { name: '12 Dutch Red Roses Luxury Bouquet', type: 'bouquet', price: 850, quantity: 1, image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=600' }
        ],
        stockPolicy: 'partial'
      },
      details: {
        category: 'combos',
        subcategory: 'cake-flower-combos',
        categories: ['cakes', 'combos', 'cake-flower-combos', 'anniversary'],
        sameDay: true,
        tagline: 'Perfect for Birthdays & Anniversaries',
        badges: ['Celebration Favorite', 'Same-Day Delivery', 'Eggless Available', 'Bestseller']
      }
    },
    {
      id: 'combo_red_velvet_lilies',
      name: 'Royal Red Velvet Cake & Pink Lilies & Roses Combo',
      slug: 'royal-red-velvet-pink-lilies-roses-combo',
      shortDescription: '1/2 KG Royal Red Velvet Cake with a breathtaking bouquet of Asiatic Pink Lilies and Soft Pink Roses.',
      description: 'An enchanting duo that embodies pure sophistication. Features our velvety, cream-cheese frosted Royal Red Velvet Cake paired with a fragrant hand-tied bouquet of fresh Asiatic Pink Lilies and premium blush Roses.',
      price: 1799,
      comparePrice: 2299,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_cake_combos', '6a2bbcb255f64c050177d7b4'],
      rating: 5.0,
      reviewCount: 42,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG Cake + Bouquet', size: '0.5 Kg', price: 1799, comparePrice: 2299, stock: 35 },
        { name: '1 KG Cake + Bouquet', size: '1 Kg', price: 2199, comparePrice: 2799, stock: 25 }
      ],
      cakeAttributes: {
        flavor: 'Red Velvet',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'anniversary',
        serves: '4–6 People',
        availableSizes: ['½ KG Cake + Bouquet', '1 KG Cake + Bouquet']
      },
      comboAttributes: {
        comboProducts: [
          { name: 'Royal Red Velvet Cake', type: 'cake', price: 699, quantity: 1, image: 'https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?auto=format&fit=crop&q=80&w=600' },
          { name: 'Pink Asiatic Lilies & Roses Bouquet', type: 'bouquet', price: 1100, quantity: 1, image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80&w=600' }
        ]
      },
      details: {
        category: 'combos',
        subcategory: 'cake-flower-combos',
        categories: ['cakes', 'combos', 'cake-flower-combos'],
        sameDay: true,
        tagline: 'Curated for Special Celebrations',
        badges: ['Curated Luxury', 'Same-Day Delivery', 'Eggless Available', 'Bestseller']
      }
    },
    {
      id: 'combo_black_forest_ferrero_roses',
      name: 'Black Forest Cake & Ferrero Rocher & 10 Red Roses Luxury Trio',
      slug: 'black-forest-cake-ferrero-red-roses-trio-combo',
      shortDescription: '1/2 KG Black Forest Cake, Box of 16 Ferrero Rocher Chocolates, and 10 Red Roses bouquet.',
      description: 'The complete celebration indulgence. A luscious half-kilogram Black Forest Cake layered with Bavarian cream and cherries, accompanied by an authentic 16-piece box of Ferrero Rocher truffles and 10 fresh Red Roses wrapped in designer packaging.',
      price: 1999,
      comparePrice: 2499,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_cake_combos', '6a2bbcb255f64c050177d7b4', '6a2bbcb255f64c050177d7ac'],
      rating: 4.9,
      reviewCount: 38,
      isFeatured: true,
      isBestseller: true,
      isNewArrival: false,
      images: [
        'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=900',
        'https://res.cloudinary.com/djtrhfqan/image/upload/v1781004106/sbf-products/image-1781004104765-338208246.jpg',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG Cake + Ferrero 16 + 10 Roses', size: '0.5 Kg', price: 1999, comparePrice: 2499, stock: 30 },
        { name: '1 KG Cake + Ferrero 16 + 10 Roses', size: '1 Kg', price: 2299, comparePrice: 2899, stock: 20 }
      ],
      cakeAttributes: {
        flavor: 'Black Forest',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'birthday',
        serves: '4–6 People'
      },
      comboAttributes: {
        comboProducts: [
          { name: 'Classic Black Forest Cake', type: 'cake', price: 599, quantity: 1, image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&q=80&w=600' },
          { name: 'Ferrero Rocher (16 Pcs)', type: 'chocolate', price: 900, quantity: 1, image: 'https://res.cloudinary.com/djtrhfqan/image/upload/v1781004106/sbf-products/image-1781004104765-338208246.jpg' },
          { name: '10 Red Roses Hand Bouquet', type: 'bouquet', price: 500, quantity: 1, image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=600' }
        ]
      },
      details: {
        category: 'combos',
        subcategory: 'cake-flower-combos',
        categories: ['cakes', 'combos', 'chocolate', 'birthday'],
        sameDay: true,
        tagline: 'Grand Celebration Hamper',
        badges: ['Mega Celebration', 'Same-Day Delivery', 'Eggless Available', 'Bestseller']
      }
    },
    {
      id: 'combo_pineapple_teddy_carnations',
      name: 'Tropical Pineapple Cake & Teddy & Sunny Carnations Combo',
      slug: 'tropical-pineapple-cake-teddy-sunny-carnations-combo',
      shortDescription: '1/2 KG Pineapple Cake paired with a plush 6-inch Teddy Bear and vibrant mixed Carnations bouquet.',
      description: 'A cheerful celebration set designed to bring smiles. Includes our light Tropical Pineapple Cake with fresh fruit compote, an adorable plush Teddy Bear, and a hand-tied bouquet of fresh colorful carnations.',
      price: 1299,
      comparePrice: 1699,
      categoryIds: ['6a61de1b59b09c0ea42c416c', 'subcat_cake_combos', '6a2bbcb255f64c050177d7b4'],
      rating: 4.8,
      reviewCount: 29,
      isFeatured: false,
      isBestseller: false,
      isNewArrival: true,
      images: [
        'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=900',
        'https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&q=80&w=900'
      ],
      variants: [
        { name: '½ KG Cake + Teddy + Carnations', size: '0.5 Kg', price: 1299, comparePrice: 1699, stock: 35 },
        { name: '1 KG Cake + Teddy + Carnations', size: '1 Kg', price: 1599, comparePrice: 1999, stock: 25 }
      ],
      cakeAttributes: {
        flavor: 'Pineapple',
        weight: '0.5 Kg',
        eggless: true,
        egglessAvailable: true,
        prepTime: 'same-day',
        occasion: 'birthday',
        serves: '4–6 People'
      },
      comboAttributes: {
        comboProducts: [
          { name: 'Fresh Tropical Pineapple Cake', type: 'cake', price: 549, quantity: 1, image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=600' },
          { name: 'Plush Cuddle Teddy Bear', type: 'gift', price: 349, quantity: 1, image: 'https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&q=80&w=600' },
          { name: 'Mixed Carnations Bouquet', type: 'bouquet', price: 401, quantity: 1, image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=600' }
        ]
      },
      details: {
        category: 'combos',
        subcategory: 'cake-flower-combos',
        categories: ['cakes', 'combos', 'birthday'],
        sameDay: true,
        tagline: 'Sweet Birthday Surprise',
        badges: ['Freshly Prepared', 'Same-Day Delivery', 'Eggless Available', 'NEW']
      }
    }
  ];

  for (const prod of productsToSeed) {
    console.log(`🍰 Seeding product: ${prod.name}`);

    // Upsert Product record
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        shortDescription: prod.shortDescription,
        price: prod.price,
        comparePrice: prod.comparePrice,
        stock: 50,
        isAvailable: true,
        isVisible: true,
        isFeatured: prod.isFeatured,
        isBestseller: prod.isBestseller,
        isNewArrival: prod.isNewArrival,
        rating: prod.rating,
        reviewCount: prod.reviewCount,
        cakeAttributes: prod.cakeAttributes || null,
        comboAttributes: prod.comboAttributes || null,
        details: prod.details,
        approvalStatus: 'approved'
      },
      create: {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        shortDescription: prod.shortDescription,
        price: prod.price,
        comparePrice: prod.comparePrice,
        stock: 50,
        isAvailable: true,
        isVisible: true,
        isFeatured: prod.isFeatured,
        isBestseller: prod.isBestseller,
        isNewArrival: prod.isNewArrival,
        rating: prod.rating,
        reviewCount: prod.reviewCount,
        cakeAttributes: prod.cakeAttributes || null,
        comboAttributes: prod.comboAttributes || null,
        details: prod.details,
        approvalStatus: 'approved'
      }
    });

    // Sync Product Images
    await prisma.productImage.deleteMany({ where: { productId: prod.id } });
    if (prod.images && prod.images.length > 0) {
      await prisma.productImage.createMany({
        data: prod.images.map((url, idx) => ({
          id: `img_${prod.id}_${idx}`,
          productId: prod.id,
          url,
          displayOrder: idx,
          isPrimary: idx === 0
        }))
      });
    }

    // Sync Product Variants
    await prisma.productVariant.deleteMany({ where: { productId: prod.id } });
    if (prod.variants && prod.variants.length > 0) {
      await prisma.productVariant.createMany({
        data: prod.variants.map((v, idx) => ({
          id: `var_${prod.id}_${idx}`,
          productId: prod.id,
          name: v.name,
          size: v.size || v.name,
          price: v.price,
          comparePrice: v.comparePrice || null,
          stock: v.stock || 50,
          isDefault: idx === 0
        }))
      });
    }

    // Sync Categories
    await prisma.productCategory.deleteMany({ where: { productId: prod.id } });
    if (prod.categoryIds && prod.categoryIds.length > 0) {
      await prisma.productCategory.createMany({
        data: prod.categoryIds.map(categoryId => ({
          productId: prod.id,
          categoryId
        })),
        skipDuplicates: true
      });
    }
  }

  console.log('🎉 Successfully seeded Cakes & Combos catalog into PostgreSQL database!');
  process.exit(0);
}

seedCakes().catch(err => {
  console.error('❌ Error seeding cakes:', err);
  process.exit(1);
});
