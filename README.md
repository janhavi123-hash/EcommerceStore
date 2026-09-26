# My Store — Full Stack E-Commerce Web App

My Store is a full-stack e-commerce application built as a Simple E-commerce Store project — supporting product browsing, cart management, order processing, and real payment integration. Built from scratch using Node.js, Express, and MySQL.

---
## Demo Video
📹 [Watch the demo video](https://drive.google.com/file/d/1pMrVBAenVlpWpbYDoRkOkGJ_Fg8bIATv/view?usp=drivesdk)

---

## Features

- **Authentication** — Registration and login with email format validation and password strength rules (min 8 characters, uppercase, lowercase, number, special character). Passwords hashed with bcrypt; sessions managed via express-session.
- **Product catalog** — 20 products across three categories (Electronics, Makeup, Essentials), each with images, price, stock, and rating.
- **Search, sort & filter** — Live search by product name/description, sort by price or rating, filter by category tabs.
- **Product details** — Full product page with description, stock availability, quantity selector, and add-to-cart/buy-now actions.
- **Reviews** — Interactive star-rating picker and written reviews per product, tied to the logged-in user.
- **Wishlist** — Save products for later; dedicated wishlist page.
- **Shopping cart** — Session-based cart with live quantity adjustment, item removal, and running total.
- **Checkout** — Saved delivery address auto-fills at checkout; supports Cash on Delivery, UPI, and Card payment methods.
- **Real payment gateway** — Razorpay integration (test mode) for Card/UPI payments, with server-side order creation and client-side checkout popup.
- **Order processing** — Stock is deducted transactionally on order placement; insufficient stock is rejected before checkout completes.
- **Order history** — Past orders shown with a time-based status stepper (Processing → Shipped → Delivered).
- **Recently viewed** — Tracks the last 5 products viewed per browser session (localStorage).

---

## Tech Stack

**Frontend:** HTML, CSS, vanilla JavaScript
**Backend:** Node.js, Express.js
**Database:** MySQL (via `mysql2`, promise-based pool)
**Auth:** express-session, bcryptjs
**Payments:** Razorpay (test mode)

---

## Project Structure

```
E-commerce/
├── server.js          # Express server & all API routes
├── db.js              # MySQL connection pool & table schema
├── seed.js            # Seeds the database with 20 sample products
├── products.json      # Product seed data
├── package.json
├── .env                # Environment variables (not committed)
└── public/
    ├── index.html      # Home page — product grid, search, filters
    ├── product.html    # Product detail page — reviews, wishlist, cart
    ├── cart.html        # Shopping cart
    ├── checkout.html    # Checkout — address & payment
    ├── orders.html       # Order history with status tracking
    ├── wishlist.html      # Saved products
    ├── profile.html        # Saved delivery address
    ├── login.html            # Login page
    ├── register.html          # Registration page
    ├── app.js                  # Shared frontend logic (nav, auth, toast)
    └── style.css                # All styling

```
---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Registered accounts (hashed passwords) |
| `products` | Catalog — name, category, price, stock, rating, image |
| `orders` | Order records — total, status, payment method |
| `order_items` | Line items belonging to each order |
| `reviews` | Star ratings and comments per product |
| `addresses` | One saved delivery address per user |
| `wishlist` | Saved products per user |

---

## Security Notes

- Passwords hashed with bcrypt, never stored in plain text.
- Session cookies used to identify authenticated users; cart/wishlist/order/review routes require an active session.
