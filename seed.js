require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function seed() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await pool.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 4.0,
    ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0
  `).catch(() => {}); // ignore if columns already exist

 // Clear child tables first (foreign key order matters)
await pool.query('DELETE FROM reviews');
await pool.query('DELETE FROM order_items');
await pool.query('DELETE FROM orders');
await pool.query('DELETE FROM products');

// Reset auto-increment counters
await pool.query('ALTER TABLE reviews AUTO_INCREMENT = 1');
await pool.query('ALTER TABLE order_items AUTO_INCREMENT = 1');
await pool.query('ALTER TABLE orders AUTO_INCREMENT = 1');
await pool.query('ALTER TABLE products AUTO_INCREMENT = 1');

  const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));

  const values = products.map(p => [p.name, p.category, p.description, p.price, p.stock, p.image, p.rating, p.review_count]);
await pool.query(
  'INSERT INTO products (name, category, description, price, stock, image, rating, review_count) VALUES ?',
  [values]
);

  console.log(`Inserted ${products.length} products.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
