import { describe, it, expect } from 'vitest';
import pkg from '../package.json';
import fs from 'fs';
import path from 'path';

describe('Project Metadata', () => {
  it('should have the correct product name', () => {
    expect(pkg.build.productName).toBe('Quilamp');
  });

  it('should have the correct appId', () => {
    expect(pkg.build.appId).toBe('com.chrisconnolly.quilamp');
  });

  it('should have a name that matches the branding', () => {
    expect(pkg.name).toBe('quilamp');
  });
});

describe('File Structure', () => {
  it('should have the main entry point', () => {
    const mainPath = path.resolve(__dirname, '../main.js');
    expect(fs.existsSync(mainPath)).toBe(true);
  });

  it('should have a preload script', () => {
    const preloadPath = path.resolve(__dirname, '../preload.js');
    expect(fs.existsSync(preloadPath)).toBe(true);
  });

  it('should have the main index.html', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});
