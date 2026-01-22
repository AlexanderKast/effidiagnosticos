import { useCallback, useEffect, useRef } from 'react';
import { TrackingPixel, PixelTrigger, PixelPlatform } from '@/lib/types';

// Extend window for pixel SDKs
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    gtag?: (...args: any[]) => void;
    ttq?: { track: (...args: any[]) => void; page: () => void };
    lintrk?: (...args: any[]) => void;
    twq?: (...args: any[]) => void;
  }
}

interface UseTrackingPixelsProps {
  pixels: TrackingPixel[];
  bookingId: string;
}

export function useTrackingPixels({ pixels, bookingId }: UseTrackingPixelsProps) {
  const initializedPixels = useRef<Set<string>>(new Set());

  // Initialize pixel scripts
  useEffect(() => {
    if (!pixels || pixels.length === 0) return;

    pixels.forEach((pixel) => {
      if (!pixel.enabled || !pixel.pixelId || initializedPixels.current.has(pixel.id)) return;

      initializePixel(pixel);
      initializedPixels.current.add(pixel.id);
    });
  }, [pixels]);

  // Initialize a single pixel
  const initializePixel = useCallback((pixel: TrackingPixel) => {
    const { platform, pixelId } = pixel;

    switch (platform) {
      case 'facebook':
        initFacebookPixel(pixelId);
        break;
      case 'google_analytics':
        initGoogleAnalytics(pixelId);
        break;
      case 'google_ads':
        initGoogleAds(pixelId);
        break;
      case 'tiktok':
        initTikTokPixel(pixelId);
        break;
      case 'linkedin':
        initLinkedInInsight(pixelId);
        break;
      case 'twitter':
        initTwitterPixel(pixelId);
        break;
      default:
        console.log(`Unknown pixel platform: ${platform}`);
    }
  }, []);

  // Track an event
  const trackEvent = useCallback((trigger: PixelTrigger, additionalData?: Record<string, any>) => {
    if (!pixels || pixels.length === 0) return;

    pixels.forEach((pixel) => {
      if (!pixel.enabled || !pixel.pixelId) return;

      pixel.events.forEach((event) => {
        if (event.triggerOn !== trigger) return;

        const eventName = event.customParameters?.customEventName || event.eventName;
        const eventData = {
          booking_id: bookingId,
          trigger,
          ...additionalData,
          ...event.customParameters,
        };

        console.log(`[Tracking] ${pixel.platform}: ${eventName}`, eventData);
        fireEvent(pixel.platform, pixel.pixelId, eventName, eventData);
      });
    });
  }, [pixels, bookingId]);

  return { trackEvent };
}

// Pixel initialization functions
function initFacebookPixel(pixelId: string) {
  if (window.fbq) return;

  const script = document.createElement('script');
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
  `;
  document.head.appendChild(script);
}

function initGoogleAnalytics(measurementId: string) {
  if (window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  const configScript = document.createElement('script');
  configScript.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(configScript);
}

function initGoogleAds(conversionId: string) {
  if (window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
  document.head.appendChild(script);

  const configScript = document.createElement('script');
  configScript.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${conversionId}');
  `;
  document.head.appendChild(configScript);
}

function initTikTokPixel(pixelId: string) {
  if (window.ttq) return;

  const script = document.createElement('script');
  script.innerHTML = `
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      ttq.load('${pixelId}');
      ttq.page();
    }(window, document, 'ttq');
  `;
  document.head.appendChild(script);
}

function initLinkedInInsight(partnerId: string) {
  if (window.lintrk) return;

  const script = document.createElement('script');
  script.innerHTML = `
    _linkedin_partner_id = "${partnerId}";
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(_linkedin_partner_id);
  `;
  document.head.appendChild(script);

  const trackScript = document.createElement('script');
  trackScript.async = true;
  trackScript.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
  document.head.appendChild(trackScript);
}

function initTwitterPixel(pixelId: string) {
  if (window.twq) return;

  const script = document.createElement('script');
  script.innerHTML = `
    !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
    },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
    a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
    twq('config','${pixelId}');
  `;
  document.head.appendChild(script);
}

// Fire event to specific platform
function fireEvent(platform: PixelPlatform, pixelId: string, eventName: string, data: Record<string, any>) {
  try {
    switch (platform) {
      case 'facebook':
        if (window.fbq) {
          window.fbq('track', eventName, data);
        }
        break;

      case 'google_analytics':
        if (window.gtag) {
          window.gtag('event', eventName, data);
        }
        break;

      case 'google_ads':
        if (window.gtag) {
          // For Google Ads, the event name should be the conversion label
          window.gtag('event', 'conversion', {
            send_to: `${pixelId}/${eventName}`,
            ...data,
          });
        }
        break;

      case 'tiktok':
        if (window.ttq) {
          window.ttq.track(eventName, data);
        }
        break;

      case 'linkedin':
        if (window.lintrk) {
          window.lintrk('track', { conversion_id: eventName });
        }
        break;

      case 'twitter':
        if (window.twq) {
          window.twq('event', eventName, data);
        }
        break;

      default:
        console.log(`[Tracking] Custom event: ${eventName}`, data);
    }
  } catch (error) {
    console.error(`[Tracking] Error firing event for ${platform}:`, error);
  }
}
