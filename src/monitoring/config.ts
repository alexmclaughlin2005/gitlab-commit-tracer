/**
 * Monitor Configuration Loader
 *
 * Loads and validates monitoring configuration from projects.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { MonitorConfig, ProjectConfig, GlobalConfig } from './types';

export class MonitorConfigLoader {
  private configPath: string;
  private config: MonitorConfig | null = null;

  constructor(configPath?: string) {
    this.configPath =
      configPath || path.join(process.cwd(), 'config', 'projects.json');
  }

  /**
   * Load configuration from file
   */
  public load(): MonitorConfig {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(
        `Configuration file not found: ${this.configPath}\n` +
          `Please create it by copying config/projects.example.json`
      );
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);

      this.config = this.validate(parsed);
      return this.config;
    } catch (error: any) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Validate configuration structure
   */
  private validate(config: any): MonitorConfig {
    // Validate top-level structure
    if (!config.projects || !Array.isArray(config.projects)) {
      throw new Error('Configuration must have a "projects" array');
    }

    if (!config.global || typeof config.global !== 'object') {
      throw new Error('Configuration must have a "global" object');
    }

    // Validate each project
    const projects: ProjectConfig[] = config.projects.map(
      (project: any, index: number) => {
        return this.validateProject(project, index);
      }
    );

    // Validate global config
    const global: GlobalConfig = this.validateGlobal(config.global);

    return { projects, global };
  }

  /**
   * Validate a single project configuration
   */
  private validateProject(project: any, index: number): ProjectConfig {
    const prefix = `Project #${index + 1}`;

    if (!project.id) {
      throw new Error(`${prefix}: Missing required field "id"`);
    }

    if (typeof project.id !== 'string' && typeof project.id !== 'number') {
      throw new Error(`${prefix}: Field "id" must be a string or number`);
    }

    if (!project.name || typeof project.name !== 'string') {
      throw new Error(`${prefix}: Missing or invalid required field "name"`);
    }

    if (!project.branches || !Array.isArray(project.branches)) {
      throw new Error(`${prefix}: Field "branches" must be an array`);
    }

    if (project.branches.length === 0) {
      throw new Error(`${prefix}: Must specify at least one branch`);
    }

    if (typeof project.enabled !== 'boolean') {
      throw new Error(`${prefix}: Field "enabled" must be a boolean`);
    }

    // Optional fields with defaults
    const validated: ProjectConfig = {
      id: project.id,
      name: project.name,
      description: project.description,
      branches: project.branches,
      enabled: project.enabled,
      autoGenerateUpdates: project.autoGenerateUpdates || false,
      filters: {
        includeAuthors: project.filters?.includeAuthors || [],
        excludeAuthors: project.filters?.excludeAuthors || [],
        includeLabels: project.filters?.includeLabels || [],
        excludeLabels: project.filters?.excludeLabels || [],
      },
    };

    return validated;
  }

  /**
   * Validate global configuration
   */
  private validateGlobal(global: any): GlobalConfig {
    if (
      !global.pollIntervalSeconds ||
      typeof global.pollIntervalSeconds !== 'number'
    ) {
      throw new Error('Global config: "pollIntervalSeconds" must be a number');
    }

    if (global.pollIntervalSeconds < 60) {
      throw new Error(
        'Global config: "pollIntervalSeconds" must be at least 60 seconds'
      );
    }

    if (
      !global.maxCommitsPerPoll ||
      typeof global.maxCommitsPerPoll !== 'number'
    ) {
      throw new Error('Global config: "maxCommitsPerPoll" must be a number');
    }

    if (global.maxCommitsPerPoll < 1 || global.maxCommitsPerPoll > 100) {
      throw new Error(
        'Global config: "maxCommitsPerPoll" must be between 1 and 100'
      );
    }

    const validated: GlobalConfig = {
      pollIntervalSeconds: global.pollIntervalSeconds,
      maxCommitsPerPoll: global.maxCommitsPerPoll,
      enableNotifications: global.enableNotifications || false,
      storageLocation: global.storageLocation || './data/monitor',
    };

    return validated;
  }

  /**
   * Reload configuration from file
   */
  public reload(): MonitorConfig {
    this.config = null;
    return this.load();
  }

  /**
   * Get currently loaded configuration
   */
  public getConfig(): MonitorConfig {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  /**
   * Get enabled projects only
   */
  public getEnabledProjects(): ProjectConfig[] {
    const config = this.getConfig();
    return config.projects.filter((p) => p.enabled);
  }

  /**
   * Get a specific project by ID
   */
  public getProject(id: string | number): ProjectConfig | undefined {
    const config = this.getConfig();
    return config.projects.find((p) => p.id === id || String(p.id) === String(id));
  }

  /**
   * Check if a project is enabled
   */
  public isProjectEnabled(id: string | number): boolean {
    const project = this.getProject(id);
    return project?.enabled || false;
  }

  /**
   * Save configuration to file
   */
  public save(config: MonitorConfig): void {
    try {
      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, content, 'utf-8');
      this.config = config;
    } catch (error: any) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Update a single project configuration
   */
  public updateProject(id: string | number, updates: Partial<ProjectConfig>): void {
    const config = this.getConfig();
    const index = config.projects.findIndex(
      (p) => p.id === id || String(p.id) === String(id)
    );

    if (index === -1) {
      throw new Error(`Project not found: ${id}`);
    }

    config.projects[index] = {
      ...config.projects[index],
      ...updates,
    };

    this.save(config);
  }

  /**
   * Add a new project
   */
  public addProject(project: ProjectConfig): void {
    const config = this.getConfig();

    // Check for duplicate ID
    if (config.projects.some((p) => p.id === project.id)) {
      throw new Error(`Project with ID ${project.id} already exists`);
    }

    config.projects.push(project);
    this.save(config);
  }

  /**
   * Remove a project
   */
  public removeProject(id: string | number): void {
    const config = this.getConfig();
    const index = config.projects.findIndex(
      (p) => p.id === id || String(p.id) === String(id)
    );

    if (index === -1) {
      throw new Error(`Project not found: ${id}`);
    }

    config.projects.splice(index, 1);
    this.save(config);
  }
}

/**
 * Default configuration loader instance
 */
export const monitorConfig = new MonitorConfigLoader();
