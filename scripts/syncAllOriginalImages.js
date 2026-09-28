require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../config/cloudinary');
const axios = require('axios');
const prisma = new PrismaClient();

function getPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  if (match) return match[1];
  const authMatch = url.match(/\/authenticated\/(?:s--[A-Za-z0-9_-]+--\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  if (authMatch) return authMatch[1];
  return null;
}

async function syncAll() {
  const products = await prisma.product.findMany({
    include: { images: true }
  });

  console.log(`Checking ${products.length} products...`);
  let updatedCount = 0;
  let alreadyHasCount = 0;
  let failedCount = 0;

  for (const p of products) {
    const existingOrig = p.details && Array.isArray(p.details.originalImages) && p.details.originalImages.length > 0
      ? p.details.originalImages
      : null;

    if (existingOrig && existingOrig[0] && existingOrig[0].includes('_original')) {
      alreadyHasCount++;
      continue;
    }

    const firstImg = (p.images && p.images[0] && p.images[0].url) || (p.details && p.details.images && p.details.images[0]);
    if (!firstImg) {
      console.log(`⚠️ Product ${p.id} has no image`);
      failedCount++;
      continue;
    }

    const pubId = getPublicIdFromUrl(firstImg);
    if (!pubId) {
      console.log(`⚠️ Product ${p.id} couldn't extract publicId from ${firstImg}`);
      failedCount++;
      continue;
    }

    // Try candidates: pubId, then pubId_original
    const candidates = [pubId, `${pubId}_original`];
    let resolvedOrigUrl = null;

    for (const cand of candidates) {
      const signedUrl = cloudinary.url(cand, {
        type: 'authenticated',
        sign_url: true,
        secure: true
      });
      try {
        const res = await axios.head(signedUrl);
        if (res.status === 200) {
          resolvedOrigUrl = signedUrl;
          break;
        }
      } catch (e) {
        // try next candidate
      }
    }

    if (resolvedOrigUrl) {
      const currentDetails = (p.details && typeof p.details === 'object' && !Array.isArray(p.details))
        ? { ...p.details }
        : {};

      currentDetails.originalImages = [resolvedOrigUrl];

      await prisma.product.update({
        where: { id: p.id },
        data: { details: currentDetails }
      });

      updatedCount++;
      console.log(`✅ [${updatedCount}] Updated product "${p.title || p.name}" with unwatermarked original URL`);
    } else {
      console.log(`❌ Could not resolve authenticated unwatermarked image for "${p.title || p.name}" (${pubId})`);
      failedCount++;
    }
  }

  console.log(`\n🎉 Sync Finished!`);
  console.log(`Already had unwatermarked original: ${alreadyHasCount}`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Failed / Missing: ${failedCount}`);

  await prisma.$disconnect();
}

syncAll().catch(console.error);
