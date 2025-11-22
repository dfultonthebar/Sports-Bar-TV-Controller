import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const BASE_URL = 'http://localhost:3001';

interface ContrastIssue {
  element: string;
  text: string;
  color: string;
  backgroundColor: string;
  contrastRatio: number;
  wcagLevel: string;
  severity: 'critical' | 'warning' | 'info';
}

async function analyzeContrast() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[CONTRAST] Navigating to System Admin Hub...');
    await page.goto(`${BASE_URL}/system-admin`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('[CONTRAST] Analyzing contrast ratios...');

    const contrastIssues: ContrastIssue[] = await page.evaluate(() => {
      const issues: any[] = [];

      // Helper function to parse RGB
      const parseRgb = (rgbString: string) => {
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return null;
        return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
      };

      // Helper function to get luminance
      const getLuminance = (r: number, g: number, b: number): number => {
        const [rs, gs, bs] = [r, g, b].map(val => {
          val = val / 255;
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      // Helper function to get contrast ratio
      const getContrastRatio = (rgb1: string, rgb2: string): number => {
        const color1 = parseRgb(rgb1);
        const color2 = parseRgb(rgb2);
        if (!color1 || !color2) return 0;

        const l1 = getLuminance(color1.r, color1.g, color1.b);
        const l2 = getLuminance(color2.r, color2.g, color2.b);

        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);

        return (lighter + 0.05) / (darker + 0.05);
      };

      // Scan all elements with text content
      const allElements = document.querySelectorAll('*');
      const processedElements = new Set<Element>();

      allElements.forEach((element) => {
        if (processedElements.has(element)) return;

        // Get direct text content
        let text = '';
        if (element.childNodes.length > 0) {
          for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              text += (node as Text).textContent?.trim() || '';
            }
          }
        }

        text = text.trim();
        if (!text || text.length < 2) return;

        const style = window.getComputedStyle(element);
        const color = style.color;
        const backgroundColor = style.backgroundColor;
        const fontSize = style.fontSize;
        const fontWeight = style.fontWeight;

        if (!color || !backgroundColor) return;

        const contrastRatio = getContrastRatio(color, backgroundColor);

        // Flag issues with contrast < 4.5 (AA standard)
        if (contrastRatio < 4.5) {
          const isBold = parseInt(fontWeight) >= 700;
          const isLarge = parseInt(fontSize) >= 18;
          const threshold = isLarge ? 3 : 4.5;

          if (contrastRatio < threshold) {
            issues.push({
              element: `${element.tagName}.${element.className}`.substring(0, 100),
              text: text.substring(0, 80),
              color: color,
              backgroundColor: backgroundColor,
              contrastRatio: parseFloat(contrastRatio.toFixed(2)),
              wcagLevel: contrastRatio >= 7 ? 'AAA' : contrastRatio >= 4.5 ? 'AA' : contrastRatio >= 3 ? 'Large Text' : 'Fail',
              severity: contrastRatio < 3 ? 'critical' : contrastRatio < 4.5 ? 'warning' : 'info'
            });
          }
        }

        processedElements.add(element);
      });

      return issues;
    });

    console.log('\n[CONTRAST] ANALYSIS RESULTS:');
    console.log('='.repeat(80));

    const criticalIssues = contrastIssues.filter(i => i.severity === 'critical');
    const warningIssues = contrastIssues.filter(i => i.severity === 'warning');
    const infoIssues = contrastIssues.filter(i => i.severity === 'info');

    console.log(`\nCRITICAL ISSUES (Contrast < 3:1): ${criticalIssues.length}`);
    criticalIssues.slice(0, 10).forEach((issue, idx) => {
      console.log(`\n  ${idx + 1}. ${issue.element}`);
      console.log(`     Text: "${issue.text}"`);
      console.log(`     Contrast Ratio: ${issue.contrastRatio}:1 (${issue.wcagLevel})`);
      console.log(`     Foreground: ${issue.color}`);
      console.log(`     Background: ${issue.backgroundColor}`);
    });

    console.log(`\n\nWARNING ISSUES (Contrast 3:1 - 4.5:1): ${warningIssues.length}`);
    warningIssues.slice(0, 10).forEach((issue, idx) => {
      console.log(`\n  ${idx + 1}. ${issue.element}`);
      console.log(`     Text: "${issue.text}"`);
      console.log(`     Contrast Ratio: ${issue.contrastRatio}:1 (${issue.wcagLevel})`);
      console.log(`     Foreground: ${issue.color}`);
      console.log(`     Background: ${issue.backgroundColor}`);
    });

    // Save detailed report
    const reportPath = path.join(SCREENSHOT_DIR, 'contrast-analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      url: `${BASE_URL}/system-admin`,
      summary: {
        totalIssues: contrastIssues.length,
        critical: criticalIssues.length,
        warnings: warningIssues.length,
        info: infoIssues.length
      },
      issues: contrastIssues.sort((a, b) => a.contrastRatio - b.contrastRatio)
    }, null, 2));

    console.log(`\n\nDetailed report saved to: ${reportPath}`);
    console.log(`\nTotal contrast issues found: ${contrastIssues.length}`);

  } catch (error: any) {
    console.error('[CONTRAST] Error during analysis:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

analyzeContrast().catch(console.error);
