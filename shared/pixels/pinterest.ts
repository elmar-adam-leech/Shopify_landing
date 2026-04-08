import type { PixelSettings } from "../schema";
import type { SharedPixelProviderConfig } from "./types";
import { sanitizePixelId } from "./utils";

const pinterestEventMap: Record<string, string> = {
  PageView: "pagevisit",
  Lead: "lead",
  AddToCart: "addtocart",
  InitiateCheckout: "checkout",
  Purchase: "checkout",
  ViewContent: "pagevisit",
  CompleteRegistration: "signup",
  Contact: "lead",
  SubmitApplication: "lead",
};

function generatePinterestInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");
t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];
r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${safeId}');
pintrk('page');`;
}

function generatePinterestInitScript(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `
<!-- Pinterest Tag -->
<script>
${generatePinterestInitCode(pixelId)}
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt=""
  src="https://ct.pinterest.com/v3/?event=init&tid=${safeId}&noscript=1" />
</noscript>
<!-- End Pinterest Tag -->`;
}

export const pinterestProviderConfig: SharedPixelProviderConfig = {
  key: "pinterest",
  name: "Pinterest Tag",
  eventMap: pinterestEventMap,

  isEnabled(pixelSettings: PixelSettings): boolean {
    return !!pixelSettings.pinterestTagEnabled && !!pixelSettings.pinterestTagId;
  },

  getPixelId(pixelSettings: PixelSettings): string | undefined {
    return pixelSettings.pinterestTagId;
  },

  generateInitCode: generatePinterestInitCode,
  generateInitScript: generatePinterestInitScript,
};
