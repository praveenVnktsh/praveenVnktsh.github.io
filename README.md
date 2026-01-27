# Praveen Venkatesh - Personal Website

Personal website showcasing my work as a Perception Engineer, Researcher, and Founder.

**Live at:** [praveenvnktsh.com](https://praveenvnktsh.com)

> Note: [praveenvnktsh.github.io](https://praveenvnktsh.github.io) redirects to the main domain.

## Tech Stack

- **Framework:** [Astro](https://astro.build/) - Static-first, zero JS by default
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- **Hosting:** [Vercel](https://vercel.com/) (main site) + GitHub Pages (redirect)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Vercel (Main Site)
1. Connect this repo to Vercel
2. Set domain to `praveenvnktsh.com`
3. Vercel auto-deploys on push to `gh-pages`

### GitHub Pages (Redirect)
- Automatically deploys `gh-pages-redirect/` folder
- Redirects all traffic to `praveenvnktsh.com`

## Project Structure

```
/
├── src/
│   ├── components/     # Astro components
│   ├── layouts/        # Page layouts
│   ├── pages/          # Page routes
│   └── styles/         # Global CSS
├── public/images/      # Static images
├── gh-pages-redirect/  # GitHub Pages redirect
├── _archive/           # Old Jekyll site
└── dist/               # Build output
```

## Features

- Responsive design with mobile-first approach
- Dark/light mode toggle
- Scroll-reveal animations
- SEO optimized with Open Graph tags
- Performance optimized

## Sections

1. Hero - Introduction with dynamic roles
2. About - Bio and key stats
3. Experience - Work history with timeline
4. Ventures - Entrepreneurial projects
5. Publications - Research papers and patents
6. Projects - Technical projects showcase
7. Awards - Honors and recognition
8. Media - Press coverage
9. Writing - Blog articles with view counts
10. Contact - Get in touch

## License

MIT License
