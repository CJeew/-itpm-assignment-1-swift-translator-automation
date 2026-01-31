const { test, expect } = require("@playwright/test");
const testCases = require("./test-data.json");

const URL = "https://www.swifttranslator.com/";

function normalize(text) {
  return (text || "").replace(/\u200B/g, "").replace(/\s+/g, " ").trim();
}

test.describe("Swift Translator Automation Tests", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
  });

  for (const tc of testCases) {
    test(tc.id, async ({ page }) => {
      console.log(`\n=== ${tc.id} ===`);
      console.log(`Type: ${tc.type.toUpperCase()} | Expected: ${tc.expectedStatus}`);
      console.log(`Input: "${tc.input.substring(0, 50)}${tc.input.length > 50 ? '...' : ''}"`);
      console.log(`Input length: ${tc.input.length} characters`);

      const input = page.getByPlaceholder("Input Your Singlish Text Here.");
      await expect(input).toBeVisible({ timeout: 10000 });
      
      await input.clear();
      await input.fill(tc.input);
      
      let waitTime;
      if (tc.input.length > 500) {
        waitTime = 30000;
      } else if (tc.input.length > 200) {
        waitTime = 20000;
      } else {
        waitTime = 8000;
      }
      
      console.log(`Waiting ${waitTime}ms for translation...`);
      await page.waitForTimeout(waitTime);

      const actual = await page.evaluate(() => {
        const sinhalaRegex = /[අ-ෆ]/;
        
        const isDiacriticsOnly = (text) => {
          const diacriticsRegex = /^[\u0DCA-\u0DDF\s්‍්්‍රාැෑිීුූෘෙේෛොෝෟංඃ]+$/;
          return diacriticsRegex.test(text);
        };
        
        const allText = document.body.innerText;
        const parts = allText.split('Sinhala');
        
        if (parts.length >= 2) {
          const afterSinhala = parts[parts.length - 1];
          const lines = afterSinhala.split('\n');
          
          for (const line of lines) {
            const trimmed = line.trim();
            
            if (isDiacriticsOnly(trimmed)) {
              continue;
            }
            
            if (trimmed.length > 3 && trimmed.length < 1000 && sinhalaRegex.test(trimmed)) {
              if (trimmed.includes('View Suggestions') || 
                  trimmed.includes('Uses AI') || 
                  trimmed.includes('grammar') ||
                  trimmed.includes('piliwela')) {
                continue;
              }
              
              const words = trimmed.split(/\s+/);
              const singleChars = words.filter(w => w.length === 1).length;
              if (singleChars < 15) {
                return trimmed;
              }
            }
          }
        }
        
        const textareas = document.querySelectorAll('textarea');
        for (const textarea of textareas) {
          const text = (textarea.value || textarea.textContent || '').trim();
          
          if (isDiacriticsOnly(text)) {
            continue;
          }
          
          if (sinhalaRegex.test(text) && text.length > 3 && text.length < 1000) {
            if (text.includes('View Suggestions') || text.includes('Uses AI')) {
              continue;
            }
            return text;
          }
        }
        
        return "";
      });

      const actualNorm = normalize(actual);
      const expectedNorm = normalize(tc.expected);

      console.log(`Expected: "${expectedNorm.substring(0, 60)}${expectedNorm.length > 60 ? '...' : ''}"`);
      console.log(`Actual:   "${actualNorm.substring(0, 60)}${actualNorm.length > 60 ? '...' : ''}"`);

      // Determine actual result
      let actualResult = "Fail";
      
      if (!actualNorm || !/[අ-ෆ]/.test(actualNorm)) {
        // No Sinhala translation found
        actualResult = "Fail";
        console.log(`No Sinhala translation found`);
      } else if (tc.keywords && tc.keywords.length > 0) {
        // Check keyword matching
        const matchedKeywords = tc.keywords.filter(keyword => 
          actualNorm.includes(normalize(keyword))
        );
        const matchCount = matchedKeywords.length;
        const threshold = Math.max(2, Math.floor(tc.keywords.length * 0.6));
        
        console.log(`Keywords: ${JSON.stringify(tc.keywords)}`);
        console.log(`Matched: ${matchCount}/${tc.keywords.length} keywords (need ${threshold})`);
        
        if (matchCount >= threshold) {
          actualResult = "Pass";
        } else {
          actualResult = "Fail";
        }
      } else {
        // No keywords - use direct comparison
        if (actualNorm.includes(expectedNorm) || expectedNorm.includes(actualNorm)) {
          actualResult = "Pass";
        } else {
          actualResult = "Fail";
        }
      }

      console.log(`Actual Result: ${actualResult}`);
      console.log(`Expected Status from Excel: ${tc.expectedStatus}`);
      
      // Compare with expected status from Excel
      if (actualResult === tc.expectedStatus) {
        console.log(`✅ TEST PASSED - Result matches expected status`);
        expect(actualResult).toBe(tc.expectedStatus);
      } else {
        console.log(`❌ TEST FAILED - Expected ${tc.expectedStatus} but got ${actualResult}`);
        await page.screenshot({ 
          path: `test-results/${tc.id}-mismatch.png`, 
          fullPage: true 
        });
        expect(actualResult).toBe(tc.expectedStatus);
      }
    });
  }
});