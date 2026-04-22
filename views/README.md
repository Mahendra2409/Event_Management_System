# Views Directory

This directory contains the EJS (Embedded JavaScript) templates responsible for rendering the frontend user interface of the Event Management System.

## Structure

*   **`index.ejs`**: The main landing page of the application.
*   **`login.ejs`**: The multi-role login interface.
*   **`signup-*.ejs`**: Specific signup forms for Admins, Users, and Vendors.
*   **`error.ejs` & `404.ejs`**: Error handling and "Not Found" templates.

### Subdirectories

*   **`admin/`**: Templates for the admin role (Dashboard, User/Vendor maintenance, Membership management forms).
*   **`user/`**: Templates for the user role (Portal, Browsing vendors/products, Cart, Checkout, Order status, Guest list).
*   **`vendor/`**: Templates for the vendor role (Dashboard, Product management, Transactions, Order status updates).
*   **`partials/`**: Reusable UI components injected into multiple pages.
    *   `header.ejs` / `footer.ejs`: Standard HTML boilerplate, `<head>` configuration, and closing tags.
    *   `topbar.ejs` / `sidebar-*.ejs`: Navigation components (if applicable).

## Maintainability Notes

*   All views inherit base styling from `/public/css/style.css`.
*   Most files follow a standard structure: includes the `header` partial, renders a `nav` bar, displays session-based alert messages, main content within a `.main-container`, and finally includes the `footer` partial.
*   Forms utilize a standard `data-validate` attribute to trigger client-side validation defined in `/public/js/main.js`.
