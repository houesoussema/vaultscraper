
import { App, Modal, Notice, Plugin, requestUrl, Setting } from 'obsidian';
import { VaultScraperSettings, DEFAULT_SETTINGS, VaultScraperSettingTab } from './settings';

type ScrapeMode = 'recursive' | 'single';
type ServerStatus = 'ready' | 'inactive' | 'checking';

export default class VaultScraper extends Plugin {
    settings: VaultScraperSettings;
    statusBarItem: HTMLElement;
    serverStatus: ServerStatus = 'checking';
    pingInterval: number;

    async onload() {
        await this.loadSettings();

        this.statusBarItem = this.addStatusBarItem();
        this.updateStatusBar('checking');

        this.addRibbonIcon('spider', 'Start Quick Crawl', () => {
            if (!this.settings.startUrl) {
                new Notice('Please set a starting URL in the VaultScraper settings.');
                return;
            }
            this.runScraper([this.settings.startUrl], 'recursive');
        });

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

        this.pingInterval = window.setInterval(() => this.checkServerStatus(), 5000);
        this.checkServerStatus();
    }

    onunload() {
        if (this.pingInterval) {
            window.clearInterval(this.pingInterval);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async checkServerStatus() {
        try {
            const response = await requestUrl({
                url: 'http://localhost:3000/ping',
                method: 'GET',
            });
            if (response.status === 200 && response.json.status === 'ok') {
                this.updateStatusBar('ready');
            } else {
                this.updateStatusBar('inactive');
            }
        } catch (error) {
            this.updateStatusBar('inactive');
        }
    }

    private updateStatusBar(status: ServerStatus) {
        this.serverStatus = status;
        switch (status) {
            case 'ready':
                this.statusBarItem.setText('Scraper: Ready');
                this.statusBarItem.style.color = 'green';
                break;
            case 'inactive':
                this.statusBarItem.setText('Scraper: Inactive');
                this.statusBarItem.style.color = 'red';
                break;
            case 'checking':
                this.statusBarItem.setText('Scraper: Checking...');
                this.statusBarItem.style.color = 'orange';
                break;
        }
    }

    private async runScraper(urls: string[], mode: ScrapeMode) {
        if (this.serverStatus !== 'ready') {
            new Notice('Scraper server is not active. Please start the backend server to continue.', 10000);
            return;
        }
        new Notice('Sending scrape request to backend...');

        try {
            const response = await requestUrl({
                url: 'http://localhost:3000/scrape',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls,
                    mode,
                    storageStateJson: this.settings.storageStateJson,
                    maxPages: this.settings.maxPages,
                    targetFolder: this.settings.targetFolder,
                }),
            });

            const result = response.json;

            if (result.success && result.data) {
                new Notice(`Scrape successful! ${result.data.length} pages saved.`);
                for (const page of result.data) {
                    if (page.success) {
                        const existingFile = this.app.vault.getAbstractFileByPath(page.filePath);
                        if (existingFile) {
                            console.warn(`Skipping, file already exists: ${page.filePath}`);
                            continue;
                        }
                        await this.app.vault.create(page.filePath, page.finalContent);
                    }
                }
            } else {
                throw new Error(result.error || 'Unknown error from backend.');
            }

        } catch (error) {
            console.error('VaultScraper Error:', error);
            new Notice(`Scrape failed: ${error.message}. Is the backend server running?`, 10000);
        }
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
