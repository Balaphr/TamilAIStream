# Tamil AI FM - Auto Deploy to Vercel

This guide explains how to automatically deploy your changes to Vercel whenever you make changes locally.

## 🚀 Two Ways to Auto-Deploy

### Option 1: GitHub Actions (Recommended - Push to GitHub = Auto Deploy)

When you push changes to GitHub, Vercel automatically deploys them. This is the most reliable method.

#### Setup Steps:

1. **Get your Vercel Token**
   - Go to https://vercel.com/account/tokens
   - Click "Create Token"
   - Name it: `tamil-ai-fm-auto-deploy`
   - Copy the token value

2. **Get your Vercel Org ID**
   - Go to https://vercel.com/account/settings
   - Copy the "ID" under your team/username

3. **Get your Vercel Project ID**
   - Go to https://vercel.com/dwmx-fcsz/tamil-ai-fm/settings
   - Scroll to "Project ID"
   - Copy the value

4. **Add Secrets to GitHub**
   - Go to https://github.com/Balaphr/Tamil-AI-FM/settings/secrets/actions
   - Click "New repository secret"
   - Add these 3 secrets:
     - `VERCEL_TOKEN` = your Vercel token
     - `VERCEL_ORG_ID` = your Vercel org ID
     - `VERCEL_PROJECT_ID` = your Vercel project ID

5. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add auto-deploy workflow"
   git push origin main
   ```

6. **Done!** Every time you push to GitHub, it will automatically deploy to Vercel.

---

### Option 2: Local Auto-Deploy Script (Watch Mode)

This watches your local files and deploys to Vercel whenever you save changes.

#### Usage:

```bash
# Start watching for changes and auto-deploy
npm run deploy:watch

# Deploy once
npm run deploy:once

# Manual deploy
npm run deploy
```

The script:
- Watches all files in the project
- Ignores `node_modules`, `.git`, `.vercel`, `dist`
- Waits 5 seconds after changes before deploying (debounce)
- Waits 30 seconds between deployments
- Shows deployment status in the terminal

---

## 📋 How It Works

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- **Triggers**: Push to `main` branch or Pull Request to `main`
- **Production Deploy**: When you push to `main`
- **Preview Deploy**: When you create a Pull Request
- **Steps**: Checkout → Setup Node → Install deps → Deploy to Vercel

### Local Auto-Deploy Script (`auto-deploy.js`)
- Watches for file changes using Node.js `fs.watch`
- Debounces changes (waits 5 seconds after last change)
- Runs `vercel --prod --yes` to deploy
- Prevents overlapping deployments

---

## 🔧 Commands

```bash
# Start local dev server
npm run dev

# Deploy to Vercel manually
npm run deploy

# Watch for changes and auto-deploy
npm run deploy:watch

# Deploy once and exit
npm run deploy:once
```

---

## 🎯 Quick Start

### If you want GitHub auto-deploy:
1. Add the 3 secrets to GitHub (see above)
2. Push your code to GitHub
3. Done - every push auto-deploys

### If you want local auto-deploy:
1. Run `npm run deploy:watch`
2. Make changes to your files
3. Wait 5 seconds - it auto-deploys
4. Check https://tamil-ai-fm.vercel.app

---

## 🆘 Troubleshooting

### GitHub Actions fails
- Check secrets are correctly set in GitHub
- Make sure `VERCEL_TOKEN` is valid
- Check Actions tab for error details

### Local auto-deploy fails
- Make sure you're logged in: `vercel login`
- Check you're in the right directory
- Run `npm run deploy` manually to see errors

### Changes not showing on Vercel
- Wait 1-2 minutes for deployment to complete
- Check Vercel dashboard: https://vercel.com/dwmx-fcsz/tamil-ai-fm
- Clear browser cache (Ctrl+Shift+R)