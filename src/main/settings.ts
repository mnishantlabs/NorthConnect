import fs from "node:fs";
import path from "node:path";

export interface Settings {
  theme: "dark" | "light";
  accent: string;
  concurrency: number;
  retry_delay: number;
  proxy: string;
  api_timeout: number;
  auto_validate: boolean;
  auto_save: boolean;
  delay: number;
  show_badges: boolean;
  show_ids: boolean;
  pinned_servers: string[];
  recent_voice: Array<Record<string, string>>;
  compact: boolean;
  [key: string]: any;
}

const DEFAULTS: Settings = {
  theme: "dark",
  accent: "blue",
  concurrency: 5,
  retry_delay: 3,
  proxy: "",
  api_timeout: 10,
  auto_validate: false,
  auto_save: true,
  delay: 0.5,
  show_badges: true,
  show_ids: true,
  pinned_servers: [],
  recent_voice: [],
  compact: false,
  bridge_enabled: true,
  bridge_host: "127.0.0.1",
  bridge_port: 47474,
  bridge_secret: "",
};

let repo: SettingsRepository | null = null;

export function initSettingsRepo(userDataDir: string): SettingsRepository {
  repo = new SettingsRepository(userDataDir);
  return repo;
}

function getRepo(): SettingsRepository {
  if (!repo) {
    throw new Error("SettingsRepository not initialized; call initSettingsRepo() first");
  }
  return repo;
}

/** Python-parity settings repository persisted at userData/config.json. */
export class SettingsRepository {
  data: Record<string, any>;
  private file: string;

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, "config.json");
    this.data = { ...DEFAULTS };
    this.load();
  }

  load(): void {
    try {
      const loaded = JSON.parse(fs.readFileSync(this.file, "utf-8"));
      if (loaded && typeof loaded === "object") {
        for (const key of Object.keys(DEFAULTS)) {
          if (key in loaded) this.data[key] = loaded[key];
        }
      }
    } catch {
      /* use defaults */
    }
  }

  save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf-8");
    } catch {
      /* ignore */
    }
  }

  get(key: string, fallback: any = undefined): any {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key: string, value: any): void {
    this.data[key] = value;
  }

  update(values: Record<string, any>): void {
    Object.assign(this.data, values);
  }
}

export async function getSettings(): Promise<Settings> {
  const r = getRepo();
  return { ...DEFAULTS, ...r.data } as Settings;
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const r = getRepo();
  Object.assign(r.data, settings);
  r.save();
  return getSettings();
}