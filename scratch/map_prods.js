const prisma = require('../config/prisma');

async function mapProducts() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, price: true }
  });
  const map = {};
  products.forEach(p => { map[p.id] = { name: p.name, price: p.price }; });
  console.log('Product mapping count:', Object.keys(map).length);
  const sampleIds = ['6a353bd8121d1f89ed38385c', '6a246a043fec0886faafeb85', '6a25951cb306f1addb3006d2', '6a259058b306f1addb2ff556'];
  sampleIds.forEach(id => console.log(id, '->', map[id]));
  await prisma.$disconnect();
}
mapProducts();
