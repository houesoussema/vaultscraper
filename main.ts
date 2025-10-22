
import { App, Modal, Notice, Plugin, Setting } from 'obsidian';
import { VaultScraperSettings, DEFAULT_SETTINGS, VaultScraperSettingTab } from './settings';

// Note: In a real Obsidian plugin, you cannot directly use 'puppeteer' or 'turndown'.
// This code is an architectural blueprint assuming an environment where it's possible.
// These dependencies must be managed in an external Node.js process.
declare const puppeteer: any;
declare const TurndownService: any;

type ScrapeMode = 'recursive' | 'single';

export default class VaultScraper extends Plugin {
	settings: VaultScraperSettings;
    visitedUrls: Set<string> = new Set();
    turndownService: any;

	async onload() {
		await this.loadSettings();
        this.initializeTurndownService();

		const ribbonIconEl = this.addRibbonIcon('spider', 'Start Quick Crawl', () => {
            if (!this.settings.startUrl) {
                new Notice('Please set a starting URL in the VaultScraper settings.');
                return;
            }
			this.runScraper([this.settings.startUrl], 'recursive');
		});
		ribbonIconEl.addClass('vault-scraper-ribbon-class');

		this.addCommand({
			id: 'start-interactive-scrape',
			name: 'Start Interactive Scrape...',
			callback: () => {
				new ScrapeModal(this.app, (urls, mode) => {
                    if (urls.length > 0) {
                        this.runScraper(urls, mode);
                    } else {
                        new Notice('No URLs provided.');
                    }
                }).open();
			}
		});

		this.addSettingTab(new VaultScraperSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

    private initializeTurndownService() {
        if (typeof TurndownService === 'undefined') {
            console.warn('VaultScraper: Turndown library not found. Markdown conversion will be basic.');
            return;
        }

        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });

        // Custom rule to preserve absolute image URLs
        this.turndownService.addRule('images', {
            filter: 'img',
            replacement: (content: string, node: any) => {
                const alt = node.getAttribute('alt') || '';
                let src = node.getAttribute('src') || '';
                // Ensure src is absolute
                if (src && !src.startsWith('http')) {
                    // This is a simplified approach. A robust solution would use the page's base URL.
                    // For now, we assume absolute URLs are provided by the source.
                    try {
                        const pageUrl = new URL(node.baseURI);
                        src = new URL(src, pageUrl).href;
                    } catch(e) { /* ignore invalid URLs */ }
                }
                return src ? `![${alt}](${src})` : '';
            }
        });

        // Custom rule to clean links
        this.turndownService.addRule('links', {
            filter: 'a',
            replacement: (content: string, node: any) => {
                let href = node.getAttribute('href') || '';
                if (!href) {
                    return content;
                }
                // Convert to absolute and remove hash for clean internal linking
                 try {
                    const pageUrl = new URL(node.baseURI);
                    let absoluteUrl = new URL(href, pageUrl);
                    absoluteUrl.hash = ''; // Remove fragment identifier
                    href = absoluteUrl.href;
                } catch(e) { /* ignore invalid URLs */ }

                return `[${content}](${href})`;
            }
        });
    }

    private sanitizeFileName(name: string): string {
        // Replace invalid characters, collapse whitespace, and trim length
        const sanitized = name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
        return sanitized.substring(0, 100) || 'Untitled';
    }

    private htmlToMarkdown(html: string): string {
        if (this.turndownService) {
            return this.turndownService.turndown(html);
        }
        return "--- Markdown Conversion Failed ---\n\n" + html;
    }

    private async runScraper(urls: string[], mode: ScrapeMode) {
        if (typeof puppeteer === 'undefined') {
            new Notice('Architectural Alert: Puppeteer not found. This plugin requires an external Node.js script to run. See README for setup.', 15000);
            console.error("VaultScraper: 'puppeteer' is not defined. Cannot run in Obsidian's sandbox.");
            return;
        }

        new Notice('Starting scrape... See developer console for progress.');
        this.visitedUrls.clear();

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
            // AUTHENTICATION: Load storage state if provided
            if (this.settings.storageStateJson.trim()) {
                try {
                    const storageState = JSON.parse(this.settings.storageStateJson);
                    if (storageState.cookies) await page.setCookie(...storageState.cookies);
                    if (storageState.origins) {
                        for (const origin of storageState.origins) {
                            if (origin.localStorage) {
                                await page.evaluateOnNewDocument((entries: { name: string; value: string }[]) => {
                                    entries.forEach(entry => localStorage.setItem(entry.name, entry.value));
                                }, origin.localStorage);
                            }
                        }
                    }
                } catch (e) {
                    throw new Error('Failed to parse Storage State JSON.');
                }
            }

            // CRAWL LOGIC
            const startUrl = new URL(urls[0]);
            const domain = startUrl.hostname;

            if (mode === 'recursive') {
                 await this.crawlPageRecursive(startUrl.href, page, domain, 0);
            } else {
                for (const url of urls) {
                    if (this.visitedUrls.has(url)) continue;
                    await this.scrapeAndSavePage(url, page);
                }
            }

            new Notice('Scrape completed successfully!');
        } catch (error) {
            console.error('VaultScraper Error:', error);
            new Notice(`Scrape failed: ${error.message}`, 10000);
        } finally {
            await browser.close();
        }
    }

    private async scrapeAndSavePage(url: string, page: any): Promise<void> {
        console.log(`Scraping: ${url}`);
        this.visitedUrls.add(url);

        await page.goto(url, { waitUntil: 'networkidle2' });

        const pageTitle = (await page.title()).trim();
        const contentHtml = await page.evaluate(() => {
            const contentNode = document.querySelector('article, main') || document.body;
            const cleanNode = contentNode.cloneNode(true) as HTMLElement;
            cleanNode.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
            return cleanNode.innerHTML;
        });

        const markdownContent = this.htmlToMarkdown(contentHtml);
        const sanitizedTitle = this.sanitizeFileName(pageTitle);
        const filePath = `${this.settings.targetFolder}/${sanitizedTitle}.md`;

        const today = new Date().toISOString().split('T')[0];
        const frontMatter = `---
title: "${pageTitle.replace(/"/g, '\\"')}"
aliases: ["${pageTitle.replace(/"/g, '\\"')}""]
source: "${url}"
created: "${today}"
tags:
  - clippings
---
`;
        const finalContent = frontMatter + "\n" + markdownContent;

        // Check for existing file to avoid duplicates
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
            console.warn(`Skipping, file already exists: ${filePath}`);
            return;
        }
        await this.app.vault.create(filePath, finalContent);
    }

    private async crawlPageRecursive(url: string, page: any, domain: string, pagesCrawled: number): Promise<number> {
        if (pagesCrawled >= this.settings.maxPages || this.visitedUrls.has(url)) {
            return pagesCrawled;
        }
        try {
            const currentUrl = new URL(url);
            if (currentUrl.hostname !== domain) return pagesCrawled;
        } catch(e) {
            return pagesCrawled; // Invalid URL
        }

        pagesCrawled++;
        await this.scrapeAndSavePage(url, page);

        const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a')).map(a => a.href)
        );

        for (const link of links) {
            if (pagesCrawled >= this.settings.maxPages) break;
            pagesCrawled = await this.crawlPageRecursive(link, page, domain, pagesCrawled);
        }

        return pagesCrawled;
    }
}

class ScrapeModal extends Modal {
    urls: string = '';
    mode: ScrapeMode = 'recursive';
    onSubmit: (urls: string[], mode: ScrapeMode) => void;

    constructor(app: App, onSubmit: (urls: string[], mode: ScrapeMode) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h1", { text: "Start Interactive Scrape" });

        new Setting(contentEl)
            .setName("URLs to Scrape")
            .setDesc("Enter one URL per line.")
            .addTextArea((text) => {
                text.inputEl.style.minHeight = "100px";
                text.onChange((value) => {
                    this.urls = value;
                });
            });

        new Setting(contentEl)
            .setName("Scrape Mode")
            .setDesc("Choose how to handle the provided URLs.")
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('recursive', 'Full Website (Recursive Crawl)')
                    .addOption('single', 'Single Page(s) Only')
                    .onChange((value: ScrapeMode) => {
                        this.mode = value;
                    });
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText("Start Scraping")
                    .setCta()
                    .onClick(() => {
                        this.close();
                        const urlList = this.urls.split('\n').map(u => u.trim()).filter(Boolean);
                        this.onSubmit(urlList, this.mode);
                    })
            );
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}
