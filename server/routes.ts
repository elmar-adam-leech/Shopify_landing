import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPageSchema, updatePageSchema, insertFormSubmissionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all pages
  app.get("/api/pages", async (_req, res) => {
    try {
      const pages = await storage.getAllPages();
      res.json(pages);
    } catch (error) {
      console.error("Error fetching pages:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  // Get single page
  app.get("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.json(page);
    } catch (error) {
      console.error("Error fetching page:", error);
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  // Create new page
  app.post("/api/pages", async (req, res) => {
    try {
      const validatedData = insertPageSchema.parse(req.body);
      
      // Check if slug already exists
      const existingPage = await storage.getPageBySlug(validatedData.slug);
      if (existingPage) {
        // Append timestamp to make slug unique
        validatedData.slug = `${validatedData.slug}-${Date.now()}`;
      }
      
      const page = await storage.createPage(validatedData as any);
      res.status(201).json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating page:", error);
      res.status(500).json({ error: "Failed to create page" });
    }
  });

  // Update page
  app.patch("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updatePageSchema.parse(req.body);
      
      // Check if page exists
      const existingPage = await storage.getPage(id);
      if (!existingPage) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      // If slug is being updated, check for conflicts
      if (validatedData.slug && validatedData.slug !== existingPage.slug) {
        const slugConflict = await storage.getPageBySlug(validatedData.slug);
        if (slugConflict && slugConflict.id !== id) {
          validatedData.slug = `${validatedData.slug}-${Date.now()}`;
        }
      }
      
      const page = await storage.updatePage(id, validatedData as any);
      res.json(page);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating page:", error);
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  // Delete page
  app.delete("/api/pages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePage(id);
      if (!deleted) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting page:", error);
      res.status(500).json({ error: "Failed to delete page" });
    }
  });

  // Submit form
  app.post("/api/pages/:pageId/submissions", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Check if page exists
      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      const validatedData = insertFormSubmissionSchema.parse({
        ...req.body,
        pageId,
      });
      
      const submission = await storage.createFormSubmission(validatedData as any);
      res.status(201).json(submission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating submission:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  // Get form submissions for a page
  app.get("/api/pages/:pageId/submissions", async (req, res) => {
    try {
      const { pageId } = req.params;
      const submissions = await storage.getFormSubmissions(pageId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Generate HTML for a page (for publishing)
  app.post("/api/pages/:id/generate", async (req, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getPage(id);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      // Generate HTML from page blocks
      const html = generatePageHtml(page);
      res.json({ html });
    } catch (error) {
      console.error("Error generating HTML:", error);
      res.status(500).json({ error: "Failed to generate HTML" });
    }
  });

  // Get version history for a page
  app.get("/api/pages/:pageId/versions", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Check if page exists
      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      const versions = await storage.getPageVersions(pageId);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching versions:", error);
      res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  // Create a new version (snapshot) of a page
  app.post("/api/pages/:pageId/versions", async (req, res) => {
    try {
      const { pageId } = req.params;
      
      // Get the current page data
      const page = await storage.getPage(pageId);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      // Get the next version number
      const latestVersionNumber = await storage.getLatestVersionNumber(pageId);
      
      // Create the version snapshot
      const version = await storage.createPageVersion({
        pageId,
        versionNumber: latestVersionNumber + 1,
        title: page.title,
        blocks: page.blocks,
        pixelSettings: page.pixelSettings,
      } as any);
      
      res.status(201).json(version);
    } catch (error) {
      console.error("Error creating version:", error);
      res.status(500).json({ error: "Failed to create version" });
    }
  });

  // Restore a page to a specific version
  app.post("/api/pages/:pageId/versions/:versionId/restore", async (req, res) => {
    try {
      const { pageId, versionId } = req.params;
      
      // Get the version to restore
      const version = await storage.getPageVersion(versionId);
      if (!version || version.pageId !== pageId) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      // Get current page to create a backup version first
      const currentPage = await storage.getPage(pageId);
      if (!currentPage) {
        return res.status(404).json({ error: "Page not found" });
      }
      
      // Create a backup of current state before restoring
      const latestVersionNumber = await storage.getLatestVersionNumber(pageId);
      await storage.createPageVersion({
        pageId,
        versionNumber: latestVersionNumber + 1,
        title: currentPage.title,
        blocks: currentPage.blocks,
        pixelSettings: currentPage.pixelSettings,
      } as any);
      
      // Restore the page to the selected version's state
      const updatedPage = await storage.updatePage(pageId, {
        title: version.title,
        blocks: version.blocks,
        pixelSettings: version.pixelSettings,
      } as any);
      
      res.json(updatedPage);
    } catch (error) {
      console.error("Error restoring version:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  });

  return httpServer;
}

// Helper function to generate HTML from page blocks
function generatePageHtml(page: any): string {
  const pixelScripts = generatePixelScripts(page.pixelSettings);
  const blocksHtml = (page.blocks || []).map((block: any) => generateBlockHtml(block)).join("\n");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
  ${pixelScripts.head}
</head>
<body>
  ${blocksHtml}
  ${pixelScripts.body}
</body>
</html>
  `.trim();
}

function generatePixelScripts(settings: any): { head: string; body: string } {
  const headScripts: string[] = [];
  const bodyScripts: string[] = [];

  if (settings?.metaPixelEnabled && settings?.metaPixelId) {
    headScripts.push(`
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${settings.metaPixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${settings.metaPixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`);
  }

  if (settings?.googleAdsEnabled && settings?.googleAdsId) {
    headScripts.push(`
<!-- Google Ads Tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${settings.googleAdsId}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${settings.googleAdsId}');
</script>
<!-- End Google Ads Tag -->`);
  }

  if (settings?.tiktokPixelEnabled && settings?.tiktokPixelId) {
    headScripts.push(`
<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${settings.tiktokPixelId}');
ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`);
  }

  if (settings?.pinterestTagEnabled && settings?.pinterestTagId) {
    headScripts.push(`
<!-- Pinterest Tag -->
<script>
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0,t.src=e;var
  r=document.getElementsByTagName("script")[0];
  r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${settings.pinterestTagId}');
pintrk('page');
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt=""
  src="https://ct.pinterest.com/v3/?event=init&tid=${settings.pinterestTagId}&noscript=1" />
</noscript>
<!-- End Pinterest Tag -->`);
  }

  return {
    head: headScripts.join("\n"),
    body: bodyScripts.join("\n"),
  };
}

function generateBlockHtml(block: any): string {
  switch (block.type) {
    case "hero-banner":
      return `
<section style="min-height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: ${block.config.textAlign || "center"}; padding: 2rem; background: linear-gradient(to bottom right, #1e293b, #0f172a); color: white; text-align: ${block.config.textAlign || "center"};">
  <h1 style="font-size: 3rem; font-weight: bold; margin-bottom: 1rem;">${block.config.title || "Your Headline"}</h1>
  <p style="font-size: 1.25rem; opacity: 0.8; margin-bottom: 2rem;">${block.config.subtitle || "Your subtitle"}</p>
  <a href="${block.config.buttonUrl || "#"}" style="display: inline-block; padding: 0.75rem 2rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">${block.config.buttonText || "Shop Now"}</a>
</section>`;
    
    case "text-block":
      return `
<section style="padding: 2rem; text-align: ${block.config.textAlign || "left"};">
  <p style="font-size: ${block.config.fontSize === "large" ? "1.25rem" : block.config.fontSize === "xlarge" ? "1.5rem" : "1rem"};">${block.config.content || ""}</p>
</section>`;
    
    case "button-block":
      return `
<section style="padding: 2rem; text-align: ${block.config.alignment || "center"};">
  <a href="${block.config.url || "#"}" style="display: inline-block; padding: ${block.config.size === "large" ? "1rem 3rem" : "0.75rem 2rem"}; background: ${block.config.variant === "secondary" ? "#6b7280" : block.config.variant === "outline" ? "transparent" : "#3b82f6"}; color: ${block.config.variant === "outline" ? "#3b82f6" : "white"}; border: ${block.config.variant === "outline" ? "2px solid #3b82f6" : "none"}; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">${block.config.text || "Click Here"}</a>
</section>`;

    case "phone-block":
      return `
<section style="padding: 2rem; text-align: center;">
  <a href="tel:${(block.config.phoneNumber || "").replace(/\D/g, "")}" style="display: inline-flex; align-items: center; gap: 0.75rem; padding: 1rem 2rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 500;">
    <span style="font-weight: 600;">${block.config.displayText || "Call Us"}</span>
    <span style="opacity: 0.8;">${block.config.phoneNumber || ""}</span>
  </a>
</section>`;

    default:
      return `<section style="padding: 2rem;"><p>Block type: ${block.type}</p></section>`;
  }
}
