import { escapeHtml } from "./html-utils";

export function sanitizePixelId(id: string): string {
  return escapeHtml(id.replace(/[^a-zA-Z0-9\-_/]/g, ""));
}

export function generateMetaInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${safeId}');
fbq('track', 'PageView');`;
}

export function generateMetaInitScript(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `
<!-- Meta Pixel Code -->
<script>
${generateMetaInitCode(pixelId)}
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${safeId}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
}

export function generateGoogleAdsInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  const tagId = safeId.split("/")[0];
  return `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${tagId}');`;
}

export function generateGoogleAdsInitScript(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  const tagId = safeId.split("/")[0];
  return `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>
<script>
${generateGoogleAdsInitCode(pixelId)}
</script>
<!-- End Google tag -->`;
}

export function generateTiktokInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${safeId}');
ttq.page();
}(window, document, 'ttq');`;
}

export function generateTiktokInitScript(pixelId: string): string {
  return `
<!-- TikTok Pixel Code -->
<script>
${generateTiktokInitCode(pixelId)}
</script>
<!-- End TikTok Pixel Code -->`;
}

export function generatePinterestInitCode(pixelId: string): string {
  const safeId = sanitizePixelId(pixelId);
  return `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");
t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];
r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${safeId}');
pintrk('page');`;
}

export function generatePinterestInitScript(pixelId: string): string {
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
