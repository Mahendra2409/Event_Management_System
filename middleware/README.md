# Middleware Directory

This directory contains custom Express middleware functions used to intercept and process incoming HTTP requests before they reach the main route handlers.

## Structure

*   **`auth.js`**: Contains role-based access control (RBAC) middleware functions.

### Exported Functions

*   `isAuthenticated`: Ensures a user is logged in (session exists).
*   `isAdmin`: Restricts access to users with the `admin` role.
*   `isUser`: Restricts access to users with the `user` role.
*   `isVendor`: Restricts access to users with the `vendor` role.
*   `isAdminOrUser`: Allows access if the user is either an admin or a standard user.

## Maintainability Notes

*   These middleware functions rely on `express-session`. They check the `req.session.user` object to verify identity and role.
*   If an unauthorized access attempt occurs, the middleware sets an error message (`req.session.error`) and redirects the user back to the `/login` page.
*   When adding new protected routes, ensure the appropriate middleware from this folder is imported and applied to the router (e.g., `router.use(isAdmin)` in `admin.js`).
