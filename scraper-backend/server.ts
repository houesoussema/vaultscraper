import express from 'express';
import * as puppeteer from 'puppeteer';
import TurndownService from 'turndown';

const app = express();
app.use(express.json());

const PORT = 3000;

app.get('/ping', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/scrape', async (req, res) => {
    const { urls, mode, storageStateJson, maxPages, targetFolder } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Invalid URLs provided.' });
    }

    const scraper = new Scraper(storageStateJson, maxPages, targetFolder);
    try {
        const results = await scraper.runScraper(urls, mode);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Scraping Error:', error);
        if (error instanceof Error) {
            res.status(500).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'An unknown error occurred.' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Scraper backend listening on http://localhost:${PORT}`);
});

class Scraper {
    private visitedUrls: Set<string> = new Set();
    private turndownService: any;
    private storageStateJson: string;
    private maxPages: number;
    private targetFolder: string;

    constructor(storageStateJson: string, maxPages: number, targetFolder: string) {
        this.storageStateJson = storageStateJson;
        this.maxPages = maxPages;
        this.targetFolder = targetFolder;
        this.initializeTurndownService();
    }

    private initializeTurndownService() {
        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });

        this.turndownService.addRule('images', {
            filter: 'img',
            replacement: (content: string, node: any) => {
                const alt = node.getAttribute('alt') || '';
                let src = node.getAttribute('src') || '';
                if (src && !src.startsWith('http')) {
                    try {
                        const pageUrl = new URL(node.baseURI);
                        src = new URL(src, pageUrl).href;
                    } catch(e) {}
                }
                return src ? `![${alt}](${src})` : '';
            }
        });

        this.turndownService.addRule('links', {
            filter: 'a',
            replacement: (content: string, node: any) => {
                let href = node.getAttribute('href') || '';
                if (!href) return content;
                try {
                    const pageUrl = new URL(node.baseURI);
                    let absoluteUrl = new URL(href, pageUrl);
                    absoluteUrl.hash = '';
                    href = absoluteUrl.href;
                } catch(e) {}
                return `[${content}](${href})`;
            }
        });
    }

    private sanitizeFileName(name: string): string {
        const sanitized = name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
        return sanitized.substring(0, 100) || 'Untitled';
    }

    private htmlToMarkdown(html: string): string {
        return this.turndownService.turndown(html);
    }

    public async runScraper(urls: string[], mode: 'recursive' | 'single'): Promise<any[]> {
        this.visitedUrls.clear();
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        const results: any[] = [];

        try {
            if (this.storageStateJson.trim()) {
                try {
                    const storageState = JSON.parse(this.storageStateJson);
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
            const startUrl = new URL(urls[0]);
            const domain = startUrl.hostname;

            if (mode === 'recursive') {
                await this.crawlPageRecursive(startUrl.href, page, domain, 0, results);
            } else {
                for (const url of urls) {
                    if (this.visitedUrls.has(url)) continue;
                    const result = await this.scrapeAndSavePage(url, page);
                    results.push(result);
                }
            }
        } finally {
            await browser.close();
        }
        return results;
    }

    private async scrapeAndSavePage(url: string, page: any): Promise<any> {
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
        const filePath = `${this.targetFolder}/${sanitizedTitle}.md`;

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

        return { filePath, finalContent, success: true };
    }

    private async crawlPageRecursive(url: string, page: any, domain: string, pagesCrawled: number, results: any[]): Promise<number> {
        if (pagesCrawled >= this.maxPages || this.visitedUrls.has(url)) {
            return pagesCrawled;
        }
        try {
            const currentUrl = new URL(url);
            if (currentUrl.hostname !== domain) return pagesCrawled;
        } catch(e) {
            return pagesCrawled;
        }

        pagesCrawled++;
        const result = await this.scrapeAndSavePage(url, page);
        results.push(result);

        const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a')).map(a => a.href)
        );

        for (const link of links) {
            if (pagesCrawled >= this.maxPages) break;
            pagesCrawled = await this.crawlPageRecursive(link, page, domain, pagesCrawled, results);
        }
        return pagesCrawled;
    }
}
