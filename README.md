# Event Management System (EMS)

A full-stack web application for managing events, vendors, and orders — built with **Node.js**, **Express**, **EJS**, and **SQLite**.

## Features

### Role-Based Access Control
- **Admin** — Dashboard, manage users & vendors, maintain memberships, add/update management records.
- **User** — Browse vendors & products, manage a shopping cart, checkout, track orders, and maintain a guest list.
- **Vendor** — Add/update product items, handle item requests, and view transaction history.

### Core Functionality
- Secure authentication (signup & login) with password hashing (bcrypt)
- Session-based authorization with role-specific middleware
- File uploads via Multer (e.g., product images)
- Membership management with admin-configurable plans
- Order placement & status tracking
- Guest list management for events

## Tech Stack

| Layer      | Technology          |
|------------|---------------------|
| Runtime    | Node.js             |
| Framework  | Express 4           |
| Templating | EJS                 |
| Database   | SQLite (better-sqlite3) |
| Auth       | bcrypt + express-session |
| Uploads    | Multer              |

## Project Structure

```
├── server.js            # Application entry point
├── database.js          # SQLite connection setup
├── package.json
│
├── middleware/
│   └── auth.js          # Authentication & role-check middleware
│
├── routes/
│   ├── auth.js          # Login, signup, logout
│   ├── admin.js         # Admin dashboard & maintenance
│   ├── user.js          # User portal, cart, checkout, orders
│   └── vendor.js        # Vendor item & transaction management
│
├── views/
│   ├── index.ejs        # Landing page
│   ├── login.ejs        # Login form
│   ├── signup-*.ejs     # Role-specific signup forms
│   ├── partials/        # Header & footer partials
│   ├── admin/           # Admin dashboard & maintenance views
│   ├── user/            # User portal, cart, checkout views
│   └── vendor/          # Vendor item management views
│
├── public/
│   ├── css/             # Stylesheets
│   ├── js/              # Client-side JavaScript
│   └── assets/          # Static assets (images, icons)
│
└── uploads/             # User-uploaded files (product images)
```

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Acxiom_Assesment

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at **http://localhost:3000**.

### Default Roles

Register a new account via the landing page and choose your role:
- `/signup-admin` — Admin signup
- `/signup-user` — User signup
- `/signup-vendor` — Vendor signup

## License

This project is part of an assessment and is not licensed for redistribution.
