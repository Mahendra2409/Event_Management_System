# Routes Directory

This directory contains the Express.js route handlers that define the backend API and navigation logic for the Event Management System (EMS).

## Structure

*   **`admin.js`**: Handles all routes under `/admin`, including the admin dashboard, maintaining users/vendors, and managing memberships (Add/Update/Delete). Protected by the `isAdmin` middleware.
*   **`auth.js`**: Handles the root `/` landing page, as well as authentication routes such as `/login`, `/signup/*`, and `/logout`.
*   **`user.js`**: Handles all routes under `/user`, serving the user portal. This includes browsing vendors/products, managing the shopping cart, checkout, guest list, and viewing order status. Protected by the `isUser` middleware.
*   **`vendor.js`**: Handles all routes under `/vendor`, serving the vendor dashboard. This includes adding/updating/deleting products, tracking product status from orders, viewing transactions, and handling item requests. Protected by the `isVendor` middleware.

## Maintainability Notes

*   All routes in `admin.js`, `user.js`, and `vendor.js` apply role-based authentication middleware defined in `../middleware/auth.js`.
*   Database interactions use synchronous methods via the `better-sqlite3` library (e.g., `db.prepare('...').get()`, `.all()`, or `.run()`).
*   Form endpoints typically validate inputs and redirect using session variables for success/error messages (`req.session.success` / `req.session.error`).
