
# VaultScraper Obsidian Plugin

**Version: 2.0.0**

An enhanced, powerful Obsidian plugin blueprint for performing advanced web scraping. It uses headless browser automation to handle JavaScript-rendered sites, manage authenticated sessions, and save clean, high-quality Markdown notes directly in your vault.

This new version introduces an interactive workflow and superior content conversion for images and internal links.

---

> **<font color="yellow">⚠️ ARCHITECTURAL BLUEPRINT: EXTERNAL NODE.JS REQUIRED</font>**
>
> This plugin **cannot run Puppeteer directly inside Obsidian**. Obsidian's environment is sandboxed and does not have the Node.js runtime needed to launch a headless browser.
>
> This project serves as a **complete architectural blueprint** for a companion tool. To use it, you must:
> 1.  Run the core scraping logic (from `main.ts`) in a **separate, standalone Node.js application**.
> 2.  Use this Obsidian plugin as the **User Interface (UI)** to trigger and configure the external script.

---

## ✨ New in Version 2.0

- **Interactive Scrape Command**: The primary way to use the plugin is via the "Start Interactive Scrape..." command, which opens a modal to input URLs and select a scrape mode on the fly.
- **Intelligent Image Handling**: Images (`<img>` tags) are preserved in your notes using their original absolute URLs. No more broken image links.
- **Clean Internal Links**: Links between scraped pages are automatically cleaned:
    - Fragment identifiers (`#some-heading`) are removed to prevent broken links within Obsidian.
    - All links are converted to absolute URLs for reliability.
- **Flexible Scrape Modes**: For any set of URLs, choose to:
    - **Full Website (Recursive)**: Crawl the entire site starting from the first URL.
    - **Single Page(s) Only**: Scrape only the specific URLs provided.

## Core Features

- **Recursive Crawling**: Starts at a URL and follows all same-domain links.
- **Authenticated Sessions**: Scrapes content behind logins by injecting a Puppeteer storage state (cookies & localStorage).
- **Smart Content Extraction**: Isolates content from `<article>` or `<main>` tags, stripping boilerplate for clean notes.
- **Robust HTML-to-Markdown**: Uses a customized Turndown service for high-quality Markdown conversion.
- **Detailed Front Matter**: Each note includes YAML metadata: title, aliases, source URL, created date, and tags.

## Installation (via BRAT)

1.  **Install BRAT** from the community plugins list.
2.  Run the command **BRAT: Add a beta plugin for testing**.
3.  Paste the GitHub repository URL for this plugin.
4.  Enable "VaultScraper" in your community plugin settings.

## How to Use

1.  **Primary Method: Interactive Scrape**
    - Open the Command Palette (`Ctrl/Cmd + P`).
    - Run the command **"Start Interactive Scrape..."**.
    - In the modal window:
        - Paste one or more URLs into the text area (one URL per line).
        - Select your desired "Scrape Mode".
        - Click "Start Scraping".
2.  **Quick Action: Ribbon Icon**
    - The spider icon in the left ribbon will start a **full recursive crawl** using the "Starting URL for Quick Crawl" saved in the plugin's settings.

## Development (Local Build)

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run dev` to start the development server (watches for changes).
4.  Run `npm run build` for a production build.
5.  Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/vault-scraper/` directory.
6.  Reload Obsidian and enable the plugin.

## Configuration

Access settings via "Settings" -> "Community Plugins" -> "VaultScraper".

- **Starting URL for Quick Crawl**: The URL used by the Ribbon Icon quick action.
- **Target Folder**: The vault folder where new notes will be saved.
- **Max Pages to Scrape**: The limit for a recursive crawl.
- **Puppeteer Storage State (JSON)**: Paste your session's cookies and localStorage JSON here to scrape sites that require a login.

## License

This project is licensed under the **MIT License**.
