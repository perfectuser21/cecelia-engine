import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SKILL_PATH = 'skills/exploratory';

describe('Exploratory Skill', () => {
  describe('SKILL.md', () => {
    it('文件存在', () => {
      const skillMdPath = path.join(SKILL_PATH, 'SKILL.md');
      expect(fs.existsSync(skillMdPath)).toBe(true);
    });

    it('包含必要字段', () => {
      const skillMdPath = path.join(SKILL_PATH, 'SKILL.md');
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      
      expect(content).toContain('name: exploratory');
      expect(content).toContain('version:');
      expect(content).toContain('description:');
    });
  });

  describe('Scripts', () => {
    const scripts = [
      'init-worktree.sh',
      'validate-impl.sh',
      'generate-prd-dod.sh',
      'cleanup-worktree.sh'
    ];

    scripts.forEach(script => {
      it(`${script} 文件存在`, () => {
        const scriptPath = path.join(SKILL_PATH, 'scripts', script);
        expect(fs.existsSync(scriptPath)).toBe(true);
      });

      it(`${script} 可执行`, () => {
        const scriptPath = path.join(SKILL_PATH, 'scripts', script);
        const stats = fs.statSync(scriptPath);
        // Check if file has execute permission (user execute bit)
        expect(stats.mode & fs.constants.S_IXUSR).not.toBe(0);
      });
    });
  });

  describe('Templates', () => {
    const templates = [
      'prd.template.md',
      'dod.template.md'
    ];

    templates.forEach(template => {
      it(`${template} 文件存在`, () => {
        const templatePath = path.join(SKILL_PATH, 'templates', template);
        expect(fs.existsSync(templatePath)).toBe(true);
      });

      it(`${template} 包含占位符`, () => {
        const templatePath = path.join(SKILL_PATH, 'templates', template);
        const content = fs.readFileSync(templatePath, 'utf-8');
        
        // Check for template placeholders
        expect(content).toMatch(/\{\{[A-Z_]+\}\}/);
      });
    });
  });

  describe('Steps', () => {
    const steps = [
      '01-init.md',
      '02-explore.md',
      '03-validate.md',
      '04-document.md'
    ];

    steps.forEach(step => {
      it(`${step} 文件存在`, () => {
        const stepPath = path.join(SKILL_PATH, 'steps', step);
        expect(fs.existsSync(stepPath)).toBe(true);
      });

      it(`${step} 包含步骤标题`, () => {
        const stepPath = path.join(SKILL_PATH, 'steps', step);
        const content = fs.readFileSync(stepPath, 'utf-8');
        
        // Check for step title (# Step N: ...)
        expect(content).toMatch(/^# Step \d+:/m);
      });
    });
  });

  describe('Registry', () => {
    it('skills-registry.json 包含 exploratory 注册', () => {
      const registryPath = 'skills-registry.json';
      const content = fs.readFileSync(registryPath, 'utf-8');
      const registry = JSON.parse(content);
      
      expect(registry.skills).toHaveProperty('exploratory');
      expect(registry.skills.exploratory.name).toBe('Exploratory');
      expect(registry.skills.exploratory.type).toBe('engine');
      expect(registry.skills.exploratory.path).toBe('skills/exploratory');
      expect(registry.skills.exploratory.entry).toBe('SKILL.md');
      expect(registry.skills.exploratory.enabled).toBe(true);
    });
  });
});
