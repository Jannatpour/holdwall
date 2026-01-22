/**
 * CAPTCHA Solver
 * 
 * Automated CAPTCHA solving for critical sources.
 * Supports multiple CAPTCHA solving services with fallback.
 */

export interface CaptchaSolverOptions {
  image?: string; // Base64 encoded image
  siteKey?: string; // reCAPTCHA site key
  pageUrl?: string; // URL where CAPTCHA appears
  provider?: "2captcha" | "anticaptcha" | "deathbycaptcha";
}

export interface CaptchaSolution {
  text?: string; // For image CAPTCHAs
  token?: string; // For reCAPTCHA
  provider: string;
  cost?: number;
  solveTime?: number;
}

export class CaptchaSolver {
  private apiKeys: Map<string, string> = new Map();

  constructor() {
    // Load API keys from environment
    if (process.env.CAPTCHA_2CAPTCHA_API_KEY) {
      this.apiKeys.set("2captcha", process.env.CAPTCHA_2CAPTCHA_API_KEY);
    }
    if (process.env.CAPTCHA_ANTICAPTCHA_API_KEY) {
      this.apiKeys.set("anticaptcha", process.env.CAPTCHA_ANTICAPTCHA_API_KEY);
    }
    if (process.env.CAPTCHA_DEATHBYCAPTCHA_API_KEY) {
      this.apiKeys.set("deathbycaptcha", process.env.CAPTCHA_DEATHBYCAPTCHA_API_KEY);
    }
  }

  /**
   * Solve image CAPTCHA using 2Captcha
   */
  private async solveWith2Captcha(
    imageBase64: string
  ): Promise<CaptchaSolution> {
    const apiKey = this.apiKeys.get("2captcha");
    if (!apiKey) {
      throw new Error("2Captcha API key not configured");
    }

    const startTime = Date.now();

    // Submit CAPTCHA
    const submitResponse = await fetch("http://2captcha.com/in.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: apiKey,
        method: "base64",
        body: imageBase64,
        json: "1",
      }),
    });

    const submitData = await submitResponse.json();
    
    if (submitData.status !== 1) {
      throw new Error(`2Captcha submission failed: ${submitData.request}`);
    }

    const captchaId = submitData.request;

    // Poll for solution (max 2 minutes)
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const resultResponse = await fetch(
        `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`
      );

      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        const solveTime = Date.now() - startTime;
        return {
          text: resultData.request,
          provider: "2captcha",
          solveTime,
        };
      }

      if (resultData.request === "CAPCHA_NOT_READY") {
        continue; // Keep polling
      }

      throw new Error(`2Captcha solve failed: ${resultData.request}`);
    }

    throw new Error("2Captcha timeout");
  }

  /**
   * Solve reCAPTCHA using 2Captcha
   */
  private async solveRecaptchaWith2Captcha(
    siteKey: string,
    pageUrl: string
  ): Promise<CaptchaSolution> {
    const apiKey = this.apiKeys.get("2captcha");
    if (!apiKey) {
      throw new Error("2Captcha API key not configured");
    }

    const startTime = Date.now();

    // Submit reCAPTCHA
    const submitResponse = await fetch("http://2captcha.com/in.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: apiKey,
        method: "userrecaptcha",
        googlekey: siteKey,
        pageurl: pageUrl,
        json: "1",
      }),
    });

    const submitData = await submitResponse.json();
    
    if (submitData.status !== 1) {
      throw new Error(`2Captcha reCAPTCHA submission failed: ${submitData.request}`);
    }

    const captchaId = submitData.request;

    // Poll for solution (max 2 minutes)
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const resultResponse = await fetch(
        `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`
      );

      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        const solveTime = Date.now() - startTime;
        return {
          token: resultData.request,
          provider: "2captcha",
          solveTime,
        };
      }

      if (resultData.request === "CAPCHA_NOT_READY") {
        continue; // Keep polling
      }

      throw new Error(`2Captcha reCAPTCHA solve failed: ${resultData.request}`);
    }

    throw new Error("2Captcha reCAPTCHA timeout");
  }

  /**
   * Solve image CAPTCHA using AntiCaptcha
   */
  private async solveWithAntiCaptcha(
    imageBase64: string
  ): Promise<CaptchaSolution> {
    const apiKey = this.apiKeys.get("anticaptcha");
    if (!apiKey) {
      throw new Error("AntiCaptcha API key not configured");
    }

    const startTime = Date.now();

    // Submit CAPTCHA
    const submitResponse = await fetch("https://api.anti-captcha.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: "ImageToTextTask",
          body: imageBase64,
        },
      }),
    });

    const submitData = await submitResponse.json();
    
    if (submitData.errorId !== 0) {
      throw new Error(`AntiCaptcha submission failed: ${submitData.errorDescription}`);
    }

    const taskId = submitData.taskId;

    // Poll for solution (max 2 minutes)
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const resultResponse = await fetch("https://api.anti-captcha.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId,
        }),
      });

      const resultData = await resultResponse.json();

      if (resultData.status === "ready") {
        const solveTime = Date.now() - startTime;
        return {
          text: resultData.solution.text,
          provider: "anticaptcha",
          solveTime,
        };
      }

      if (resultData.errorId !== 0) {
        throw new Error(`AntiCaptcha solve failed: ${resultData.errorDescription}`);
      }
    }

    throw new Error("AntiCaptcha timeout");
  }

  /**
   * Solve reCAPTCHA using AntiCaptcha
   */
  private async solveRecaptchaWithAntiCaptcha(
    siteKey: string,
    pageUrl: string
  ): Promise<CaptchaSolution> {
    const apiKey = this.apiKeys.get("anticaptcha");
    if (!apiKey) {
      throw new Error("AntiCaptcha API key not configured");
    }

    const startTime = Date.now();

    // Submit reCAPTCHA
    const submitResponse = await fetch("https://api.anti-captcha.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: "RecaptchaV2TaskProxyless",
          websiteURL: pageUrl,
          websiteKey: siteKey,
        },
      }),
    });

    const submitData = await submitResponse.json();
    
    if (submitData.errorId !== 0) {
      throw new Error(`AntiCaptcha reCAPTCHA submission failed: ${submitData.errorDescription}`);
    }

    const taskId = submitData.taskId;

    // Poll for solution (max 2 minutes)
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const resultResponse = await fetch("https://api.anti-captcha.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId,
        }),
      });

      const resultData = await resultResponse.json();

      if (resultData.status === "ready") {
        const solveTime = Date.now() - startTime;
        return {
          token: resultData.solution.gRecaptchaResponse,
          provider: "anticaptcha",
          solveTime,
        };
      }

      if (resultData.errorId !== 0) {
        throw new Error(`AntiCaptcha reCAPTCHA solve failed: ${resultData.errorDescription}`);
      }
    }

    throw new Error("AntiCaptcha reCAPTCHA timeout");
  }

  /**
   * Solve image CAPTCHA using DeathByCaptcha
   */
  private async solveWithDeathByCaptcha(
    imageBase64: string
  ): Promise<CaptchaSolution> {
    const apiKey = this.apiKeys.get("deathbycaptcha");
    if (!apiKey) {
      throw new Error("DeathByCaptcha API key not configured");
    }

    const [username, password] = apiKey.split(":");

    const startTime = Date.now();

    // Submit CAPTCHA
    const submitResponse = await fetch("https://api.dbcapi.me/api/captcha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        username,
        password,
        type: 2, // Image CAPTCHA
        captchafile: imageBase64,
      }),
    });

    const submitData = await submitResponse.json();
    
    if (submitData.status !== 0) {
      throw new Error(`DeathByCaptcha submission failed: ${submitData.error || "Unknown error"}`);
    }

    const captchaId = submitData.captcha;

    // Poll for solution (max 2 minutes)
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const resultResponse = await fetch(`https://api.dbcapi.me/api/captcha/${captchaId}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
      });

      const resultData = await resultResponse.json();

      if (resultData.text) {
        const solveTime = Date.now() - startTime;
        return {
          text: resultData.text,
          provider: "deathbycaptcha",
          solveTime,
        };
      }

      if (resultData.status === 0 && !resultData.text) {
        continue; // Keep polling
      }

      throw new Error(`DeathByCaptcha solve failed: ${resultData.error || "Unknown error"}`);
    }

    throw new Error("DeathByCaptcha timeout");
  }

  /**
   * Solve reCAPTCHA using DeathByCaptcha
   */
  private async solveRecaptchaWithDeathByCaptcha(
    siteKey: string,
    pageUrl: string
  ): Promise<CaptchaSolution> {
    const apiKey = this.apiKeys.get("deathbycaptcha");
    if (!apiKey) {
      throw new Error("DeathByCaptcha API key not configured");
    }

    const [username, password] = apiKey.split(":");

    const startTime = Date.now();

    // Submit reCAPTCHA
    const submitResponse = await fetch("https://api.dbcapi.me/api/captcha", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        username,
        password,
        type: 4, // reCAPTCHA v2
        googlekey: siteKey,
        pageurl: pageUrl,
      }),
    });

    const submitData = await submitResponse.json();
    
    if (submitData.status !== 0) {
      throw new Error(`DeathByCaptcha reCAPTCHA submission failed: ${submitData.error || "Unknown error"}`);
    }

    const captchaId = submitData.captcha;

    // Poll for solution (max 2 minutes)
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const resultResponse = await fetch(`https://api.dbcapi.me/api/captcha/${captchaId}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
      });

      const resultData = await resultResponse.json();

      if (resultData.text) {
        const solveTime = Date.now() - startTime;
        return {
          token: resultData.text,
          provider: "deathbycaptcha",
          solveTime,
        };
      }

      if (resultData.status === 0 && !resultData.text) {
        continue; // Keep polling
      }

      throw new Error(`DeathByCaptcha reCAPTCHA solve failed: ${resultData.error || "Unknown error"}`);
    }

    throw new Error("DeathByCaptcha reCAPTCHA timeout");
  }

  /**
   * Solve CAPTCHA with automatic provider selection
   */
  async solve(options: CaptchaSolverOptions): Promise<CaptchaSolution> {
    const { image, siteKey, pageUrl, provider } = options;

    // Determine provider
    let selectedProvider = provider;
    if (!selectedProvider) {
      // Auto-select based on available API keys
      if (this.apiKeys.has("2captcha")) {
        selectedProvider = "2captcha";
      } else if (this.apiKeys.has("anticaptcha")) {
        selectedProvider = "anticaptcha";
      } else if (this.apiKeys.has("deathbycaptcha")) {
        selectedProvider = "deathbycaptcha";
      } else {
        throw new Error("No CAPTCHA solver API keys configured");
      }
    }

    // Solve based on type
    if (siteKey && pageUrl) {
      // reCAPTCHA
      if (selectedProvider === "2captcha") {
        return await this.solveRecaptchaWith2Captcha(siteKey, pageUrl);
      } else if (selectedProvider === "anticaptcha") {
        return await this.solveRecaptchaWithAntiCaptcha(siteKey, pageUrl);
      } else if (selectedProvider === "deathbycaptcha") {
        return await this.solveRecaptchaWithDeathByCaptcha(siteKey, pageUrl);
      }
      throw new Error(`reCAPTCHA solving not implemented for ${selectedProvider}`);
    } else if (image) {
      // Image CAPTCHA
      if (selectedProvider === "2captcha") {
        return await this.solveWith2Captcha(image);
      } else if (selectedProvider === "anticaptcha") {
        return await this.solveWithAntiCaptcha(image);
      } else if (selectedProvider === "deathbycaptcha") {
        return await this.solveWithDeathByCaptcha(image);
      }
      throw new Error(`Image CAPTCHA solving not implemented for ${selectedProvider}`);
    } else {
      throw new Error("Either image or siteKey+pageUrl must be provided");
    }
  }

  /**
   * Check if CAPTCHA solving is available
   */
  isAvailable(): boolean {
    return this.apiKeys.size > 0;
  }
}
