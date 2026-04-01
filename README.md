# Wedding Landing Page - Odelya & Omer

A beautiful, mobile-first wedding landing page with Hebrew RTL support, featuring elegant typography and a warm color palette.

## ✨ Features

- **Mobile-First Design**: Optimized for mobile devices with responsive layout
- **RTL Hebrew Support**: Full right-to-left support for Hebrew text
- **Elegant Typography**: Using Heebo (Hebrew) and Cormorant Garamond fonts
- **Responsive Images**: Swan logo and floral decorations
- **Clean Aesthetic**: Warm earth tones with sage green accents
- **Accessible**: Semantic HTML with proper ARIA support
- **GitHub Pages Ready**: Pre-configured for easy deployment

## 📁 File Structure

```
wedding-landing-page/
├── index.html              # Main HTML file
├── styles.css              # Stylesheet with responsive design
├── .nojekyll              # Tells GitHub Pages not to use Jekyll
├── README.md              # This file
└── images/
    ├── logo.png           # Swan logo
    ├── floral-border.png  # Decorative floral border
    └── couple.jpg         # (To be added) Couple illustration
```

## 🚀 GitHub Pages Deployment Instructions

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your account
2. Click the **"+"** icon in the top right corner and select **"New repository"**
3. Enter a repository name (e.g., `wedding-landing-page` or `odelya-omer`)
4. Choose **Public** (required for free GitHub Pages)
5. Do **NOT** initialize with README, .gitignore, or license (you already have files)
6. Click **"Create repository"**

### Step 2: Push Your Code to GitHub

Open Terminal/Command Prompt in your project folder and run:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit your files
git commit -m "Initial commit: Wedding landing page"

# Add your GitHub repository as remote (replace with your username and repo name)
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace** `YOUR-USERNAME` with your GitHub username and `YOUR-REPO-NAME` with your repository name.

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **"Settings"** (top menu)
3. Scroll down and click on **"Pages"** in the left sidebar
4. Under **"Source"**, select **"Deploy from a branch"**
5. Under **"Branch"**, select **"main"** and **"/ (root)"**
6. Click **"Save"**

### Step 4: Access Your Live Site

After a few minutes, your site will be live at:

```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

You'll see a success message at the top of the Pages settings with your live URL.

## 🖼️ Adding the Couple Illustration

The site currently shows a placeholder for the couple illustration. To add the actual image:

1. Add your couple image file to the `images/` folder (e.g., `couple.jpg` or `couple.png`)
2. Open [`index.html`](index.html:24-34)
3. Replace the placeholder `<div>` (lines 26-33) with:

```html
<img src="images/couple.jpg" alt="Odelya & Omer" class="hero-image">
```

4. Commit and push the changes:

```bash
git add images/couple.jpg index.html
git commit -m "Add couple illustration"
git push
```

The site will automatically update within a few minutes.

## 💻 Local Development

No build process required! Simply:

1. Open `index.html` in your web browser
2. Make edits to `index.html` or `styles.css`
3. Refresh the browser to see changes

## 🌐 Custom Domain (Optional)

To use a custom domain (e.g., `odelya-omer.com`):

1. Purchase a domain from a domain registrar (Namecheap, GoDaddy, etc.)
2. In your repository, go to **Settings → Pages**
3. Under **"Custom domain"**, enter your domain name
4. Click **"Save"**
5. In your domain registrar's DNS settings, add these records:

**For apex domain (odelya-omer.com):**
```
A Record → 185.199.108.153
A Record → 185.199.109.153
A Record → 185.199.110.153
A Record → 185.199.111.153
```

**For www subdomain:**
```
CNAME Record → YOUR-USERNAME.github.io
```

6. Wait for DNS propagation (can take up to 24 hours)
7. Enable **"Enforce HTTPS"** in GitHub Pages settings

## 🎨 Customization

### Colors
The color palette is defined in `styles.css`:
- Primary: `#6B7F5C` (sage green)
- Background: `#F5F1E8` (warm cream)
- Text: `#4A4A4A` (charcoal)

### Fonts
- **Hebrew**: Heebo (300, 400, 500 weights)
- **English**: Cormorant Garamond (300, 400 weights)

### Content
Edit the welcome message and info list in `index.html` (lines 39-52).

## 📱 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Responsive breakpoints at 768px and 1024px

## 🐛 Troubleshooting

**Images not loading on GitHub Pages?**
- Make sure `.nojekyll` file exists (already included)
- Check that image paths are relative (e.g., `images/logo.png` not `/images/logo.png`)

**Site not updating after push?**
- Wait 2-5 minutes for GitHub Pages to rebuild
- Check the "Actions" tab in your repository for build status
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)

**Hebrew text appearing left-to-right?**
- Ensure `<html lang="he" dir="rtl">` is present in `index.html`
- Check that your browser supports RTL

## 📄 License

Personal project - All rights reserved to Odelya & Omer.

---

**Created with ❤️ for Odelya & Omer's special day**
