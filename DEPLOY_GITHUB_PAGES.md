# Deploying to GitHub Pages

1. **Set your repository name**
   - If your repo is not at the root (e.g. `https://github.com/yourname/datazapp`), edit `next.config.js` and uncomment/set `basePath` and `assetPrefix` to `'/datazapp'`.

2. **Build and export static site**
   ```sh
   npm run build
   npm run export
   ```
   This creates a static site in the `out` directory.

3. **Deploy to GitHub Pages**
   ```sh
   npm run deploy
   ```
   This will push the `out` directory to the `gh-pages` branch using the `gh-pages` package.

4. **Set GitHub Pages source**
   - In your repo settings, set GitHub Pages source to the `gh-pages` branch.

5. **Access your site**
   - Your site will be available at `https://<username>.github.io/<repo>/`.

---

## Notes
- For custom domains or advanced routing, see the Next.js and GitHub Pages docs.
- If you change your repo name, update `basePath` and `assetPrefix` in `next.config.js` accordingly.
