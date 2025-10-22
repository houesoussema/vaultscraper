
# VaultScraper Obsidian Plugin

**Version: 2.2.0**

An enhanced, powerful Obsidian plugin for performing advanced web scraping. It uses a backend server with a headless browser to handle JavaScript-rendered sites, manage authenticated sessions, and save clean, high-quality Markdown notes directly in your vault.

This new version introduces a status bar indicator for a more user-friendly experience.

---

> **<font color="yellow">⚠️ EXTERNAL NODE.JS SERVER REQUIRED</font>**
>
> This plugin requires a separate, standalone Node.js application to run the scraping logic. The Obsidian plugin provides the user interface, and the backend server handles the scraping.

---

## ✨ Features

- **Server Status Indicator**: A status bar item in Obsidian shows whether the backend server is running ("Ready") or not ("Inactive").
- **Interactive Scrape Command**: The primary way to use the plugin is via the "Start Interactive Scrape..." command, which opens a modal to input URLs and select a scrape mode on the fly.
- **Intelligent Image Handling**: Images (`<img>` tags) are preserved in your notes using their original absolute URLs.
- **Clean Internal Links**: Links between scraped pages are automatically cleaned and converted to absolute URLs.
- **Flexible Scrape Modes**:
    - **Full Website (Recursive)**: Crawl the entire site starting from the first URL.
    - **Single Page(s) Only**: Scrape only the specific URLs provided.
- **Authenticated Sessions**: Scrapes content behind logins by injecting a Puppeteer storage state (cookies & localStorage).
- **Smart Content Extraction**: Isolates content from `<article>` or `<main>` tags.
- **Robust HTML-to-Markdown**: Uses a customized Turndown service for high-quality Markdown conversion.
- **Detailed Front Matter**: Each note includes YAML metadata: title, aliases, source URL, created date, and tags.

## Installation

### Backend Server

1.  Navigate to the `scraper-backend` directory.
2.  Run `npm install` to install the dependencies.
3.  Run `npm run build` to compile the TypeScript code.
4.  Run `npm start` to start the server.

### Obsidian Plugin (via BRAT)

1.  **Install BRAT** from the community plugins list.
2.  Run the command **BRAT: Add a beta plugin for testing**.
3.  Paste the GitHub repository URL for this plugin.
4.  Enable "VaultScraper" in your community plugin settings.

## How to Use

1.  **Start the backend server.**
2.  **Check the status bar in Obsidian.** It should say "Scraper: Ready" in green. If it says "Scraper: Inactive" in red, the backend server is not running.
3.  **Primary Method: Interactive Scrape**
    - Open the Command Palette (`Ctrl/Cmd + P`).
    - Run the command **"Start Interactive Scrape..."**.
    - In the modal window:
        - Paste one or more URLs into the text area (one URL per line).
        - Select your desired "Scrape Mode".
        - Click "Start Scraping".
4.  **Quick Action: Ribbon Icon**
    - The spider icon in the left ribbon will start a **full recursive crawl** using the "Starting URL for Quick Crawl" saved in the plugin's settings.

## Development (Local Build)

### Backend

1.  `cd scraper-backend`
2.  `npm install`
3.  `npm run dev`

### Plugin

1.  `npm install`
2.  `npm run dev`
3.  Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/vault-scraper/` directory.
4.  Reload Obsidian and enable the plugin.

## Configuration

Access settings via "Settings" -> "Community Plugins" -> "VaultScraper".

- **Starting URL for Quick Crawl**: The URL used by the Ribbon Icon quick action.
- **Target Folder**: The vault folder where new notes will be saved.
- **Max Pages to Scrape**: The limit for a recursive crawl.
- **Puppeteer Storage State (JSON)**: Paste your session's cookies and localStorage JSON here to scrape sites that require a login.

## License

This project is licensed under the **MIT License**.
