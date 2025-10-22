
import { App, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import VaultScraper from './main';

export interface VaultScraperSettings {
  startUrl: string;
  targetFolder: string;
  maxPages: number;
  storageStateJson: string;
}

export const DEFAULT_SETTINGS: VaultScraperSettings = {
  startUrl: 'https://help.obsidian.md/Home',
  targetFolder: 'Scrapes/VaultScraper',
  maxPages: 50,
  storageStateJson: '',
};

export class VaultScraperSettingTab extends PluginSettingTab {
	plugin: VaultScraper;

	constructor(app: App, plugin: VaultScraper) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
        containerEl.createEl('h2', { text: 'VaultScraper Settings' });

		new Setting(containerEl)
			.setName('Starting URL for Quick Crawl')
			.setDesc('The URL for the quick-start Ribbon Icon action. The main workflow is the interactive command.')
			.addText(text => text
				.setPlaceholder('https://example.com')
				.setValue(this.plugin.settings.startUrl)
				.onChange(async (value) => {
					this.plugin.settings.startUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target Folder')
			.setDesc('The folder in your vault where scraped notes will be saved.')
			.addText(text => text
				.setPlaceholder('Scrapes/MySite')
				.setValue(this.plugin.settings.targetFolder)
				.onChange(async (value) => {
					this.plugin.settings.targetFolder = value;
					await this.plugin.saveSettings();
				}));

    new Setting(containerEl)
        .setName('Max Pages to Scrape')
        .setDesc('The maximum number of pages to process in a single recursive crawl.')
        .addSlider(slider => slider
            .setLimits(1, 200, 1)
            .setValue(this.plugin.settings.maxPages)
            .setDynamicTooltip()
            .onChange(async (value) => {
                this.plugin.settings.maxPages = value;
                await this.plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Puppeteer Storage State (JSON)')
        .setDesc('CRITICAL for private sites. Paste the JSON content of cookies and localStorage for authenticated scraping.')
        .addTextArea((text: TextAreaComponent) => {
            text
                .setPlaceholder('{\n  "cookies": [...],\n  "origins": [...]\n}')
                .setValue(this.plugin.settings.storageStateJson)
                .onChange(async (value) => {
                    this.plugin.settings.storageStateJson = value;
                    await this.plugin.saveSettings();
                });
            text.inputEl.rows = 8;
            text.inputEl.style.width = '100%';
            text.inputEl.style.fontFamily = 'monospace';
        });
	}
}
