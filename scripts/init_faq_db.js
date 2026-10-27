const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Initializing FAQ database tables safely ---');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FaqCategory" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "description" TEXT,
        "icon" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FaqCategory_pkey" PRIMARY KEY ("id")
    );
  `);
  console.log('✓ FaqCategory table verified/created');

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "FaqCategory_slug_key" ON "FaqCategory"("slug");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FaqCategory_slug_idx" ON "FaqCategory"("slug");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FaqCategory_displayOrder_idx" ON "FaqCategory"("displayOrder");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FaqCategory_isActive_idx" ON "FaqCategory"("isActive");
  `);
  console.log('✓ FaqCategory indexes verified/created');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Faq" (
        "id" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "answer" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "isPublished" BOOLEAN NOT NULL DEFAULT true,
        "isFeatured" BOOLEAN NOT NULL DEFAULT false,
        "displayLocations" TEXT[] DEFAULT ARRAY['faq_page']::TEXT[],
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "seoTitle" TEXT,
        "seoDescription" TEXT,
        "helpfulCount" INTEGER NOT NULL DEFAULT 0,
        "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Faq_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Faq_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FaqCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  console.log('✓ Faq table verified/created');

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Faq_slug_key" ON "Faq"("slug");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Faq_categoryId_idx" ON "Faq"("categoryId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Faq_isPublished_idx" ON "Faq"("isPublished");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Faq_isFeatured_idx" ON "Faq"("isFeatured");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Faq_displayOrder_idx" ON "Faq"("displayOrder");
  `);
  console.log('✓ Faq indexes verified/created');

  console.log('Database tables and indexes are ready!');
}

main()
  .catch((err) => {
    console.error('Error creating tables:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
