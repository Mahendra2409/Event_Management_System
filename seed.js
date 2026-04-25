/**
 * NexCart — Database Seeder
 * Run: node seed.js
 * Creates a fresh database with sample categories, sellers, products, and demo accounts.
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'ecommerce.db');

// Remove old database if exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑  Removed old database');
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📦 Creating database schema...');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    phone TEXT,
    location TEXT,
    description TEXT,
    logo TEXT,
    rating REAL DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    image TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    category_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    discount_price REAL,
    image TEXT DEFAULT 'default.png',
    stock INTEGER DEFAULT 100,
    rating REAL DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    name TEXT,
    number TEXT,
    email TEXT,
    payment_method TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT DEFAULT 'India',
    status TEXT DEFAULT 'Processing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    product_name TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_type TEXT NOT NULL,
    member_id INTEGER DEFAULT 0,
    member_name TEXT NOT NULL,
    member_email TEXT,
    member_phone TEXT,
    plan TEXT DEFAULT 'basic',
    duration TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ Schema created');

// Seed categories
console.log('🏷  Seeding categories...');
const insertCategory = db.prepare('INSERT INTO categories (name, icon, description, sort_order) VALUES (?, ?, ?, ?)');
const categories = [
  ['Electronics', '💻', 'Gadgets, phones, laptops and more', 1],
  ['Fashion', '👗', 'Clothing, shoes, accessories', 2],
  ['Home & Kitchen', '🏠', 'Furniture, appliances, decor', 3],
  ['Beauty', '💄', 'Skincare, makeup, personal care', 4],
  ['Sports', '⚽', 'Fitness equipment, sportswear', 5],
  ['Books', '📚', 'Fiction, non-fiction, academic', 6],
];
categories.forEach(c => insertCategory.run(...c));

// Seed admin
console.log('👤 Seeding admin account...');
const adminPass = bcrypt.hashSync('admin123', 10);
db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin', 'admin@nexcart.com', adminPass, 'admin');

// Seed demo user
console.log('👤 Seeding user account...');
const userPass = bcrypt.hashSync('user123', 10);
db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('John Doe', 'user@nexcart.com', userPass, 'user');

// Seed sellers
console.log('🏪 Seeding sellers...');
const sellerPass = bcrypt.hashSync('seller123', 10);
const insertSeller = db.prepare('INSERT INTO sellers (name, email, password, category, phone, location, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
const sellers = [
  ['TechWorld', 'tech@nexcart.com', sellerPass, 'Electronics', '9876543001', 'Bengaluru, KA', 'Premium electronics and gadgets'],
  ['FashionHub', 'fashion@nexcart.com', sellerPass, 'Fashion', '9876543002', 'Mumbai, MH', 'Trendy clothing and accessories'],
  ['HomeNest', 'home@nexcart.com', sellerPass, 'Home & Kitchen', '9876543003', 'Delhi', 'Quality home and kitchen essentials'],
  ['GlowUp', 'beauty@nexcart.com', sellerPass, 'Beauty', '9876543004', 'Hyderabad, TS', 'Premium beauty and skincare products'],
  ['SportZone', 'sports@nexcart.com', sellerPass, 'Sports', '9876543005', 'Pune, MH', 'Fitness gear and sportswear'],
  ['BookBarn', 'books@nexcart.com', sellerPass, 'Books', '9876543006', 'Chennai, TN', 'Books for every reader'],
];
sellers.forEach(s => insertSeller.run(...s));

// Seed products
console.log('📦 Seeding products...');
const insertProduct = db.prepare('INSERT INTO products (seller_id, category_id, name, description, price, discount_price, stock, rating, reviews_count, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

const products = [
  // Electronics (seller_id: 1, category_id: 1)
  [1,1,'Wireless Bluetooth Earbuds','Premium sound quality with active noise cancellation and 24hr battery life',2999,1999,150,4.5,128,1],
  [1,1,'Smart Watch Pro','Health tracking, GPS, AMOLED display with 7-day battery life',5999,4499,80,4.3,85,1],
  [1,1,'USB-C Power Bank 20000mAh','Fast charging portable battery with dual USB output',1499,1199,200,4.6,210,0],
  [1,1,'Mechanical Gaming Keyboard','RGB backlit, Cherry MX switches, aluminum body',3499,2799,60,4.7,65,1],
  [1,1,'4K Action Camera','Waterproof, 4K@60fps, EIS stabilization',8999,6999,40,4.4,42,0],

  // Fashion (seller_id: 2, category_id: 2)
  [2,2,'Premium Cotton T-Shirt','100% organic cotton, breathable fabric, slim fit',799,599,300,4.2,180,1],
  [2,2,'Denim Jacket Classic','Rugged denim with modern fit, multiple pockets',2499,1999,100,4.5,72,1],
  [2,2,'Running Sneakers Ultra','Lightweight mesh upper, cushioned sole, arch support',3999,2999,120,4.6,156,0],
  [2,2,'Aviator Sunglasses','UV400 protection, polarized lenses, metal frame',1299,899,200,4.3,98,1],
  [2,2,'Leather Belt Premium','Genuine leather, reversible buckle design',699,499,250,4.1,64,0],

  // Home & Kitchen (seller_id: 3, category_id: 3)
  [3,3,'Air Fryer 5.5L','Digital touch panel, rapid air technology, non-stick basket',4999,3499,75,4.7,230,1],
  [3,3,'Memory Foam Pillow Set','Ergonomic design, hypoallergenic, bamboo cover (Set of 2)',1799,1299,150,4.4,118,0],
  [3,3,'LED Desk Lamp','Touch dimming, 5 color modes, USB charging port',999,749,180,4.5,89,1],
  [3,3,'Stainless Steel Water Bottle','Vacuum insulated, 1L, keeps drinks cold 24hrs',599,449,300,4.6,312,0],

  // Beauty (seller_id: 4, category_id: 4)
  [4,4,'Vitamin C Serum 30ml','Brightening formula with hyaluronic acid and niacinamide',899,699,200,4.8,340,1],
  [4,4,'Moisturizing Face Cream','Deep hydration, SPF 30, anti-aging formula',1299,999,150,4.5,185,1],
  [4,4,'Hair Serum Repair','Keratin enriched, frizz control, heat protection',649,499,180,4.3,125,0],

  // Sports (seller_id: 5, category_id: 5)
  [5,5,'Yoga Mat Premium','Non-slip, 6mm thick, eco-friendly TPE material',1499,999,200,4.6,175,1],
  [5,5,'Resistance Bands Set','5 levels, natural latex, carry bag included',799,599,250,4.4,210,0],
  [5,5,'Adjustable Dumbbells 20kg','Cast iron, rubber grip, quick-lock mechanism',3999,2999,60,4.7,88,1],

  // Books (seller_id: 6, category_id: 6)
  [6,6,'The Art of Programming','Master algorithms and data structures — Comprehensive guide',699,499,300,4.8,420,1],
  [6,6,'Mindset: The New Psychology','Carol Dweck — Discover the power of growth mindset',399,299,400,4.7,580,0],
  [6,6,'Digital Marketing Handbook','Complete guide to SEO, social media, and content marketing',549,399,200,4.5,165,1],
];
products.forEach(p => insertProduct.run(...p));

// Seed sample reviews
console.log('⭐ Seeding reviews...');
const insertReview = db.prepare('INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)');
const sampleReviews = [
  [2,1,5,'Amazing sound quality! Best earbuds at this price range. Highly recommended.'],
  [2,2,4,'Great smartwatch. Battery lasts about 5 days with heavy use. Love the display.'],
  [2,6,5,'Perfect fit and super comfortable. Will buy more colors!'],
  [2,11,5,'The air fryer changed my cooking game. Everything comes out perfectly crispy.'],
  [2,15,5,'Noticeable difference in skin brightness within 2 weeks. Love this serum!'],
  [2,18,4,'Excellent mat for yoga and exercise. Good grip even when sweaty.'],
  [2,21,5,'One of the best programming books I have read. Clear explanations with examples.'],
];
sampleReviews.forEach(r => insertReview.run(...r));

// Seed sample orders
console.log('📋 Seeding sample orders...');
const order1 = db.prepare(`INSERT INTO orders (user_id, total_amount, name, number, email, payment_method, address, city, state, pincode, country, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(2, 4498, 'John Doe', '9876543210', 'user@nexcart.com', 'UPI', '123 MG Road', 'Bengaluru', 'Karnataka', '560001', 'India', 'Delivered');
db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(order1.lastInsertRowid, 1, 1, 1999);
db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(order1.lastInsertRowid, 6, 2, 599);

const order2 = db.prepare(`INSERT INTO orders (user_id, total_amount, name, number, email, payment_method, address, city, state, pincode, country, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(2, 3499, 'John Doe', '9876543210', 'user@nexcart.com', 'Credit / Debit Card', '123 MG Road', 'Bengaluru', 'Karnataka', '560001', 'India', 'Shipped');
db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(order2.lastInsertRowid, 11, 1, 3499);

const order3 = db.prepare(`INSERT INTO orders (user_id, total_amount, name, number, email, payment_method, address, city, state, pincode, country, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(2, 1498, 'John Doe', '9876543210', 'user@nexcart.com', 'Net Banking', '123 MG Road', 'Bengaluru', 'Karnataka', '560001', 'India', 'Processing');
db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(order3.lastInsertRowid, 15, 1, 699);
db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(order3.lastInsertRowid, 18, 1, 999);

// Seed wishlist
console.log('❤️  Seeding wishlist...');
db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(2, 4);
db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(2, 9);
db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(2, 16);
db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(2, 21);

db.close();

console.log('\n✅ Database seeded successfully!\n');
console.log('📊 Summary:');
console.log('   Categories: 6');
console.log('   Sellers: 6');
console.log('   Products: 23');
console.log('   Demo Orders: 3');
console.log('   Reviews: 7');
console.log('\n🔐 Demo Accounts:');
console.log('   Admin:  admin@nexcart.com / admin123');
console.log('   User:   user@nexcart.com  / user123');
console.log('   Seller: tech@nexcart.com  / seller123');
console.log('          (all sellers use password: seller123)\n');
console.log('🚀 Run: npm start');
