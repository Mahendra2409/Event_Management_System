# Public Directory

This directory serves the static assets for the Event Management System. Everything in this folder is publicly accessible to the client's browser.

## Structure

*   **`css/`**: Contains the stylesheets for the application.
    *   `style.css`: The primary design system providing CSS variables (tokens), standard components (buttons, cards, forms, tables), utility classes, and responsive layout rules.
    *   `landing.css`: (If applicable) Specific styles focused on the hero/landing page design.
*   **`js/`**: Contains client-side JavaScript.
    *   `main.js`: Handles global client-side interactivity, specifically automated form validation using the `data-validate` attribute, auto-dismissing alert messages, and minor UI state toggles.
*   **`assets/`**: Contains static image assets, icons, or logos used in the application design.

## Maintainability Notes

*   **Design Tokens**: CSS heavily utilizes custom properties (e.g., `--primary`, `--text-secondary`, `--bg-surface`) defined at the `:root` level in `style.css`. When updating the theme, modify these tokens rather than hunting for specific hex codes.
*   **Client Validation**: Before submitting forms, `main.js` checks fields with the `required` attribute inside forms marked with `data-validate`. This reduces unnecessary server requests.
