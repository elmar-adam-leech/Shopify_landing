export function sanitizePixelId(id: string): string {
  return id.replace(/[^a-zA-Z0-9\-_/]/g, "");
}

export function generatePixelScripts(settings: any): string {
  const scripts: string[] = [];

  if (settings?.metaPixelEnabled && settings?.metaPixelId) {
    const pixelId = sanitizePixelId(settings.metaPixelId);
    scripts.push(`
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `);
  }

  if (settings?.googleAdsEnabled && settings?.googleAdsId) {
    const adsId = sanitizePixelId(settings.googleAdsId);
    scripts.push(`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${adsId}');
    `);
  }

  if (settings?.tiktokPixelEnabled && settings?.tiktokPixelId) {
    const pixelId = sanitizePixelId(settings.tiktokPixelId);
    scripts.push(`
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
        ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
        for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
        ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
        var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
        var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${pixelId}');
        ttq.page();
      }(window, document, 'ttq');
    `);
  }

  if (settings?.pinterestTagEnabled && settings?.pinterestTagId) {
    const tagId = sanitizePixelId(settings.pinterestTagId);
    scripts.push(`
      !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
      var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");
      t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}
      ("https://s.pinimg.com/ct/core.js");
      pintrk('load', '${tagId}');
      pintrk('page');
    `);
  }

  return scripts.join("\n");
}

export function getUrlParam(paramName: string): string {
  if (typeof window === "undefined") return "";
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName) || "";
}
