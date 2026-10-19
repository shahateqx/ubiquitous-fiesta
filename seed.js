'use strict';
require('dotenv').config();

/**
 * seed.js — Populates the database with sample posts and images,
 * runs DB migrations, then triggers batch image processing.
 *
 * Run: node seed.js
 */

const { pool, query } = require('./src/data/db');
const { embedPost } = require('./src/services/embeddingService');
const { addBatchImageJobs } = require('./src/jobs/imageQueue');

// ── Sample blog posts ─────────────────────────────────────────────────────────
const posts = [
  {
    title: 'The Behavior of Red Foxes',
    content: 'Red foxes are known for their adaptability. Vulpes vulpes inhabits forests and urban areas alike. They are omnivores with a varied diet ranging from small mammals to fruits. Foxes are primarily solitary animals and mark their territory with scent glands. Their distinctive red fur and bushy tail make them iconic wildlife.',
  },
  {
    title: 'Gray Wolves in the Wild',
    content: 'Wolf packs hunt cooperatively across vast territories. The gray wolf, Canis lupus, is the largest wild member of the dog family. Wolves communicate through howling, body language, and scent marking. Pack hierarchy is essential to wolf social structure with an alpha pair leading the group. Wolves were once widespread across North America and Europe.',
  },
  {
    title: 'Domestic Dogs and Human Bonding',
    content: 'Dogs have been bred as companions for thousands of years. The domestication of dogs from wolves began over 15,000 years ago. Today there are hundreds of breeds each adapted to specific roles. Dogs are known for their loyalty, intelligence, and emotional sensitivity. The human-dog bond involves oxytocin release in both species.',
  },
  {
    title: 'Brown Bears of Yellowstone',
    content: 'Bears forage extensively before winter hibernation. The grizzly bear found in Yellowstone National Park is a subspecies of brown bear. They consume up to 20,000 calories a day in fall to prepare for denning. Bears are important ecosystem engineers who disperse seeds and nutrients. Their diet includes berries, fish, roots, and small mammals.',
  },
  {
    title: 'White-Tailed Deer Migration',
    content: 'Deer populations shift seasonally across North America. White-tailed deer are among the most widely distributed large mammals. Bucks grow and shed antlers annually with size indicating age and health. During rut season males compete vigorously for mating rights. Deer are a keystone herbivore species affecting forest understory composition.',
  },
  {
    title: 'Autumn Forest Landscapes',
    content: 'Deciduous forests transform dramatically each fall with brilliant colors. The changing of leaves from green to orange, red, and yellow is caused by chlorophyll breakdown. Temperate forests in North America and Europe display the most spectacular foliage. The phenomenon attracts millions of visitors to regions like New England each year.',
  },
  {
    title: 'Mountain Lake Reflections',
    content: 'Alpine lakes mirror surrounding peaks with crystalline clarity. High-altitude lakes are formed by glacial action and fed by snowmelt. The cold clear water supports unique biodiversity adapted to low nutrient conditions. Mountain lakes such as Lake Louise in Canada are iconic destinations for photographers and hikers.',
  },
  {
    title: 'Urban Street Photography',
    content: 'City scenes capture everyday moments of human life in motion. Street photography documents the human condition in public spaces without staged settings. Great street photographers like Henri Cartier-Bresson and Vivian Maier captured decisive moments. Urban environments provide endless variety in light, architecture, and human interaction.',
  },
  {
    title: 'Tropical Bird Species',
    content: 'Parrots and toucans display remarkable color adaptations in tropical rainforests. Tropical birds have evolved vibrant plumage for mate selection and camouflage simultaneously. The Amazon basin harbors over 1,300 bird species making it the most biodiverse region on Earth. Many tropical species face extinction due to deforestation and the pet trade.',
  },
  {
    title: 'Desert Cactus Ecosystems',
    content: 'Saguaro cacti provide habitat for many desert species in the Sonoran Desert. The saguaro can live over 150 years and grow to 40 feet tall. Their hollowed trunks serve as nesting sites for owls, woodpeckers, and other birds. Cacti store water in their thick stems enabling survival in extreme drought conditions.',
  },
];

// ── Sample images from Unsplash ───────────────────────────────────────────────
const images = [
  { filename: 'red-fox-1.jpg',      url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800' },
  { filename: 'red-fox-2.jpg',      url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=800' },
  { filename: 'gray-wolf-1.jpg',    url: 'https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=800' },
  { filename: 'gray-wolf-2.jpg',    url: 'https://images.unsplash.com/photo-1551887373-6edba6dacbb1?w=800' },
  { filename: 'dog-1.jpg',          url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800' },
  { filename: 'dog-2.jpg',          url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800' },
  { filename: 'brown-bear-1.jpg',   url: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800' },
  { filename: 'deer-1.jpg',         url: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?w=800' },
  { filename: 'forest-autumn-1.jpg',url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800' },
  { filename: 'mountain-lake-1.jpg',url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800' },
  { filename: 'street-city-1.jpg',  url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800' },
  { filename: 'parrot-1.jpg',       url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800' },
  { filename: 'cactus-1.jpg',       url: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=800' },
  { filename: 'fox-forest-1.jpg',   url: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800' },
  { filename: 'wolf-pack-1.jpg',    url: 'https://images.unsplash.com/photo-1615457890014-f6099c7c3963?w=800' },
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runMigrations() {
  console.log('[seed] Running migrations...');
  const fs = require('fs');
  const path = require('path');
  const migrationsDir = path.join(__dirname, 'src', 'data', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        run_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const { rows } = await client.query('SELECT id FROM _migrations WHERE filename = $1', [file]);
      if (rows.length > 0) {
        console.log(`[seed] Migration already run: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`[seed] Applied migration: ${file}`);
    }
  } finally {
    client.release();
  }
}

async function seedPosts() {
  console.log('[seed] Seeding posts...');
  const seeded = [];
  for (const p of posts) {
    // Check if already exists
    const { rows: existing } = await query('SELECT id FROM posts WHERE title = $1', [p.title]);
    if (existing.length > 0) {
      console.log(`[seed] Post already exists: "${p.title}" (id=${existing[0].id})`);
      seeded.push(existing[0].id);
      continue;
    }

    const { rows } = await query(
      'INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING id',
      [p.title, p.content]
    );
    const postId = rows[0].id;
    seeded.push(postId);
    console.log(`[seed] Created post id=${postId}: "${p.title}"`);

    // Embed the post
    try {
      await embedPost(postId, p.title, p.content);
      console.log(`[seed] Embedded post ${postId}`);
    } catch (err) {
      console.warn(`[seed] Failed to embed post ${postId}: ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await sleep(500);
  }
  return seeded;
}

async function seedImages() {
  console.log('[seed] Seeding images...');
  const seeded = [];
  for (const img of images) {
    const { rows: existing } = await query('SELECT id FROM images WHERE filename = $1', [img.filename]);
    if (existing.length > 0) {
      console.log(`[seed] Image already exists: ${img.filename} (id=${existing[0].id})`);
      seeded.push({ id: existing[0].id, url: img.url });
      continue;
    }

    const { rows } = await query(
      "INSERT INTO images (filename, url, status) VALUES ($1, $2, 'pending') RETURNING id",
      [img.filename, img.url]
    );
    const imageId = rows[0].id;
    seeded.push({ id: imageId, url: img.url });
    console.log(`[seed] Registered image id=${imageId}: ${img.filename}`);
  }
  return seeded;
}

async function main() {
  try {
    // 1. Run migrations
    await runMigrations();

    // 2. Seed posts (with embeddings)
    await seedPosts();

    // 3. Seed images
    const imageRecords = await seedImages();

    // 4. Trigger batch processing job for all pending images
    const pending = imageRecords.filter(() => true); // trigger for all registered
    if (pending.length > 0) {
      const jobsData = pending.map(img => ({ imageId: img.id, imageUrl: img.url }));
      const jobs = await addBatchImageJobs(jobsData);
      console.log(`[seed] Queued ${jobs.length} image(s) for vision processing + embedding.`);
      console.log('[seed] Start the worker to process them: node worker.js');
    }

    console.log('[seed] ✅ Seed complete!');
  } catch (err) {
    console.error('[seed] ❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
