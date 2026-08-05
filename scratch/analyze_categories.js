const fs = require('fs');
const path = require('path');

const backupDir = 'D:\\SBF\\mongodb_backup\\test';
const products = JSON.parse(fs.readFileSync(path.join(backupDir, 'products.json'), 'utf8'));

const cats = new Set();
products.forEach(p => {
  if (p.category) cats.add(p.category);
  if (Array.isArray(p.categories)) p.categories.forEach(c => cats.add(c));
});

console.log('UNIQUE CATEGORIES IN BACKUP:', [...cats]);
console.log('\nSAMPLE PRODUCTS WITH CATEGORIES (first 8):');
products.slice(0, 8).forEach(p => {
  const id = (p._id && p._id.$oid) ? p._id.$oid : p._id;
  console.log('  ID:', id);
  console.log('    title:', p.title);
  console.log('    category:', p.category);
  console.log('    categories:', JSON.stringify(p.categories));
  console.log('    isFeatured:', p.isFeatured, '| isNewArrival:', p.isNewArrival, '| isBestseller:', p.isBestseller);
  console.log('');
});

// Check categories collection
const categoriesPath = path.join(backupDir, 'categories.json');
if (fs.existsSync(categoriesPath)) {
  const categoriesBackup = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  console.log('\nCATEGORIES COLLECTION FROM BACKUP:', categoriesBackup.length, 'entries');
  categoriesBackup.forEach(c => {
    const cid = (c._id && c._id.$oid) ? c._id.$oid : c._id;
    console.log('  Category ID:', cid, '| name:', c.name, '| slug:', c.slug, '| parent:', c.parent);
  });
}
