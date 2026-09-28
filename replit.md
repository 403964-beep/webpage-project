# Running this project on Replit

This is an Express website. The **Start application** workflow runs `PORT=5000 npm start` and serves the site in the web preview. For a local run, install dependencies with `npm install` and run `PORT=5000 npm start`.

The admin dashboard at `/admin.html` needs an `ADMIN_PASSWORD` Replit Secret. Without it, the public site works but admin login and image editing are disabled. After signing in, the admin session also enables gallery and portrait editing. Do not use the old sample password from the imported project.

Contact messages and media overrides are saved as JSON files in `data/`; uploaded images are stored under `assets/images/uploads/`. The app serves only public HTML, CSS, JavaScript, and assets, not the `data/` directory.