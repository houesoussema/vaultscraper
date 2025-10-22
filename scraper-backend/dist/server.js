"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const puppeteer = __importStar(require("puppeteer"));
const turndown_1 = __importDefault(require("turndown"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = 3000;
app.post('/scrape', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { urls, mode, storageStateJson, maxPages, targetFolder } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Invalid URLs provided.' });
    }
    const scraper = new Scraper(storageStateJson, maxPages, targetFolder);
    try {
        const results = yield scraper.runScraper(urls, mode);
        res.json({ success: true, data: results });
    }
    catch (error) {
        console.error('Scraping Error:', error);
        if (error instanceof Error) {
            res.status(500).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'An unknown error occurred.' });
        }
    }
}));
app.listen(PORT, () => {
    console.log(`Scraper backend listening on http://localhost:${PORT}`);
});
class Scraper {
    constructor(storageStateJson, maxPages, targetFolder) {
        this.visitedUrls = new Set();
        this.storageStateJson = storageStateJson;
        this.maxPages = maxPages;
        this.targetFolder = targetFolder;
        this.initializeTurndownService();
    }
    initializeTurndownService() {
        this.turndownService = new turndown_1.default({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
        });
        this.turndownService.addRule('images', {
            filter: 'img',
            replacement: (content, node) => {
                const alt = node.getAttribute('alt') || '';
                let src = node.getAttribute('src') || '';
                if (src && !src.startsWith('http')) {
                    try {
                        const pageUrl = new URL(node.baseURI);
                        src = new URL(src, pageUrl).href;
                    }
                    catch (e) { }
                }
                return src ? `![${alt}](${src})` : '';
            }
        });
        this.turndownService.addRule('links', {
            filter: 'a',
            replacement: (content, node) => {
                let href = node.getAttribute('href') || '';
                if (!href)
                    return content;
                try {
                    const pageUrl = new URL(node.baseURI);
                    let absoluteUrl = new URL(href, pageUrl);
                    absoluteUrl.hash = '';
                    href = absoluteUrl.href;
                }
                catch (e) { }
                return `[${content}](${href})`;
            }
        });
    }
    sanitizeFileName(name) {
        const sanitized = name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
        return sanitized.substring(0, 100) || 'Untitled';
    }
    htmlToMarkdown(html) {
        return this.turndownService.turndown(html);
    }
    runScraper(urls, mode) {
        return __awaiter(this, void 0, void 0, function* () {
            this.visitedUrls.clear();
            const browser = yield puppeteer.launch({ headless: true });
            const page = yield browser.newPage();
            const results = [];
            try {
                if (this.storageStateJson.trim()) {
                    try {
                        const storageState = JSON.parse(this.storageStateJson);
                        if (storageState.cookies)
                            yield page.setCookie(...storageState.cookies);
                        if (storageState.origins) {
                            for (const origin of storageState.origins) {
                                if (origin.localStorage) {
                                    yield page.evaluateOnNewDocument((entries) => {
                                        entries.forEach(entry => localStorage.setItem(entry.name, entry.value));
                                    }, origin.localStorage);
                                }
                            }
                        }
                    }
                    catch (e) {
                        throw new Error('Failed to parse Storage State JSON.');
                    }
                }
                const startUrl = new URL(urls[0]);
                const domain = startUrl.hostname;
                if (mode === 'recursive') {
                    yield this.crawlPageRecursive(startUrl.href, page, domain, 0, results);
                }
                else {
                    for (const url of urls) {
                        if (this.visitedUrls.has(url))
                            continue;
                        const result = yield this.scrapeAndSavePage(url, page);
                        results.push(result);
                    }
                }
            }
            finally {
                yield browser.close();
            }
            return results;
        });
    }
    scrapeAndSavePage(url, page) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Scraping: ${url}`);
            this.visitedUrls.add(url);
            yield page.goto(url, { waitUntil: 'networkidle2' });
            const pageTitle = (yield page.title()).trim();
            const contentHtml = yield page.evaluate(() => {
                const contentNode = document.querySelector('article, main') || document.body;
                const cleanNode = contentNode.cloneNode(true);
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
        });
    }
    crawlPageRecursive(url, page, domain, pagesCrawled, results) {
        return __awaiter(this, void 0, void 0, function* () {
            if (pagesCrawled >= this.maxPages || this.visitedUrls.has(url)) {
                return pagesCrawled;
            }
            try {
                const currentUrl = new URL(url);
                if (currentUrl.hostname !== domain)
                    return pagesCrawled;
            }
            catch (e) {
                return pagesCrawled;
            }
            pagesCrawled++;
            const result = yield this.scrapeAndSavePage(url, page);
            results.push(result);
            const links = yield page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href));
            for (const link of links) {
                if (pagesCrawled >= this.maxPages)
                    break;
                pagesCrawled = yield this.crawlPageRecursive(link, page, domain, pagesCrawled, results);
            }
            return pagesCrawled;
        });
    }
}
