# Mental Health Tracker PWA

A lightweight, offline-capable Progressive Web App for logging daily mental health experiences and computing 14-day clinical assessment reports for:
- **ASRS v1.1 Part A** (Adult ADHD Screener)
- **DASS-21** (Depression, Anxiety, and Stress Scale)

## Features
- Runs 100% offline via localStorage and Service Worker.
- Standard ASRS v1.1 clinical significance scoring (threshold check).
- DASS-21 severity band classifications (Normal, Mild, Moderate, Severe, Extremely Severe).
- Export and import JSON backups.
- Print-friendly PDF format.

## Deployment
Upload these files (`index.html`, `manifest.json`, `sw.js`, `icon.svg`) to any static web host:
- GitHub Pages
- Netlify / Vercel
- Cloudflare Pages
- Any local or private HTTP/HTTPS web server

## Testing & CI

Automated tests run on every pull request and push to `main` via GitHub Actions.

```bash
# Install dependencies
npm install

# Run unit & clinical logic tests (Node.js test runner)
npm test

# Run Playwright end-to-end browser smoke tests
npm run test:e2e
```

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
