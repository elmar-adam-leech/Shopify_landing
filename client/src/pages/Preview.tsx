import { useEffect, useCallback, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { captureUTMParams } from "@/lib/utm";
import { firePixelEvent, fireCustomEvents, generatePixelInitCode, preloadProviders, type PixelEventName } from "@/lib/pixels";
import { getOrAssignBlockVariant, getVariantAssignment, setVariantAssignment, selectVariant, evaluateBlockVisibility } from "@/lib/preview/ab-testing";
import { trackEvent } from "@/lib/preview/analytics";
import { renderBlock } from "@/components/preview/BlockRenderer";
import { FormBlockPreview } from "@/components/preview/FormBlockPreview";
import type { Page, Block, AbTest, AbTestVariant } from "@shared/schema";

export default function Preview() {
  const [, params] = useRoute("/preview/:id");
  const [, setLocation] = useLocation();
  const pageId = params?.id;
  const pageViewTracked = useRef(false);
  const [abTestInfo, setAbTestInfo] = useState<{
    test: AbTest;
    variant: AbTestVariant;
  } | null>(null);

  useEffect(() => {
    captureUTMParams();
  }, []);

  const { data: abTestData, isLoading: isLoadingAbTest } = useQuery<{
    test: AbTest;
    variants: AbTestVariant[];
  } | null>({
    queryKey: ["/api/ab-tests/for-page", pageId],
    enabled: !!pageId,
    queryFn: async () => {
      const response = await fetch(`/api/ab-tests/for-page/${pageId}`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  useEffect(() => {
    if (abTestData && abTestData.variants.length > 0) {
      const { test, variants } = abTestData;
      
      let assignedVariantId = getVariantAssignment(test.id);
      let assignedVariant: AbTestVariant | undefined;
      
      if (assignedVariantId) {
        assignedVariant = variants.find(v => v.id === assignedVariantId);
      }
      
      if (!assignedVariant) {
        assignedVariant = selectVariant(variants);
        setVariantAssignment(test.id, assignedVariant.id);
      }
      
      setAbTestInfo({ test, variant: assignedVariant });
      
      if (assignedVariant.pageId !== pageId) {
        setLocation(`/preview/${assignedVariant.pageId}`);
      }
    }
  }, [abTestData, pageId, setLocation]);

  const { data: page, isLoading, error } = useQuery<Page & { storeInfo?: { shopifyDomain: string } }>({
    queryKey: ["/api/public/pages", pageId],
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch(`/api/public/pages/${pageId}`);
      if (!response.ok) throw new Error("Failed to load page");
      return response.json();
    },
  });

  useEffect(() => {
    if (page?.pixelSettings) {
      preloadProviders(page.pixelSettings);
    }
  }, [page?.pixelSettings]);

  useEffect(() => {
    pageViewTracked.current = false;
  }, [pageId]);

  useEffect(() => {
    const abTestResolved = !abTestData || (abTestInfo !== null);
    
    if (page && pageId && !pageViewTracked.current && abTestResolved) {
      const isCorrectPage = !abTestInfo || abTestInfo.variant.pageId === pageId;
      
      if (isCorrectPage) {
        pageViewTracked.current = true;
        trackEvent(
          pageId, 
          "page_view", 
          undefined, 
          undefined,
          abTestInfo?.test?.id,
          abTestInfo?.variant?.id
        );
      }
    }
  }, [page, pageId, abTestInfo, abTestData]);

  const handleButtonClick = useCallback((blockId: string, config: any) => {
    if (pageId) {
      trackEvent(
        pageId, 
        "button_click", 
        blockId, 
        { buttonText: config.text, url: config.url },
        abTestInfo?.test?.id,
        abTestInfo?.variant?.id
      );
      
      if (config.trackConversion && page?.pixelSettings) {
        const eventName = (config.conversionEvent || "AddToCart") as PixelEventName;
        firePixelEvent(eventName, {
          content_name: config.text,
          content_category: "Button Click",
          value: config.conversionValue || 0,
          currency: "USD",
        }, page.pixelSettings);
      }

      if (config.customEventIds?.length && page?.pixelSettings) {
        fireCustomEvents(config.customEventIds, page.pixelSettings, {
          content_name: config.text,
          content_category: "Button Click",
        });
      }
    }
  }, [pageId, abTestInfo, page?.pixelSettings]);

  const handlePhoneClick = useCallback((blockId: string, config: any) => {
    if (pageId) {
      trackEvent(
        pageId, 
        "phone_click", 
        blockId, 
        { phoneNumber: config.phoneNumber },
        abTestInfo?.test?.id,
        abTestInfo?.variant?.id
      );
    }
  }, [pageId, abTestInfo]);

  const handleFormSubmit = useCallback(async (blockId: string, config: any, formData: Record<string, string>) => {
    if (pageId) {
      trackEvent(
        pageId, 
        "form_submission", 
        blockId, 
        { formTitle: config.title, ...formData },
        abTestInfo?.test?.id,
        abTestInfo?.variant?.id
      );
      
      if (config.fireConversionEvent !== false && page?.pixelSettings) {
        const eventName = (config.conversionEvent || "Lead") as PixelEventName;
        firePixelEvent(eventName, {
          content_name: config.title || "Form Submission",
          content_category: "Form",
          value: config.conversionValue || 0,
          currency: "USD",
        }, page.pixelSettings);
      }

      if (config.customEventIds?.length && page?.pixelSettings) {
        fireCustomEvents(config.customEventIds, page.pixelSettings, {
          content_name: config.title || "Form Submission",
          content_category: "Form",
        });
      }
      
      try {
        const utmParams = JSON.parse(localStorage.getItem("utm_params") || "{}");
        await fetch(`/api/pages/${pageId}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockId,
            data: formData,
            utmParams,
            referrer: document.referrer || null,
            landingPage: window.location.href,
          }),
        });
      } catch (error) {
        console.error("Failed to submit form:", error);
      }
    }
  }, [pageId, abTestInfo, page?.pixelSettings]);

  useEffect(() => {
    if (page) {
      const existingMeta = document.querySelector('meta[name="robots"]');
      if (existingMeta) {
        existingMeta.remove();
      }
      
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = page.allowIndexing ? 'index, follow' : 'noindex, nofollow';
      document.head.appendChild(meta);
      
      document.title = page.title;
      
      return () => {
        meta.remove();
      };
    }
  }, [page]);

  if (isLoading || isLoadingAbTest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const sortedBlocks = [...(page.blocks || [])].sort((a, b) => a.order - b.order);
  const pixelScripts = generatePixelInitCode(page.pixelSettings);

  const renderBlockWithTracking = (block: Block) => {
    if (block.type === "form-block") {
      const { config } = getOrAssignBlockVariant(block);
      return (
        <FormBlockPreview
          key={block.id}
          block={block}
          config={config}
          onSubmit={(formData) => handleFormSubmit(block.id, config, formData)}
        />
      );
    }
    
    const rendered = renderBlock(block, page.storeInfo, pageId);
    
    if (block.type === "button-block" && rendered) {
      return (
        <div key={block.id} onClick={() => handleButtonClick(block.id, block.config)}>
          {rendered}
        </div>
      );
    }
    
    if (block.type === "phone-block" && rendered) {
      return (
        <div key={block.id} onClick={() => handlePhoneClick(block.id, block.config)}>
          {rendered}
        </div>
      );
    }
    
    return rendered;
  };

  const visibleBlocks = sortedBlocks.filter((block) => evaluateBlockVisibility(block));

  return (
    <div className="min-h-screen bg-white text-gray-900" data-testid="preview-page">
      {pixelScripts && (
        <script dangerouslySetInnerHTML={{ __html: pixelScripts }} />
      )}
      {visibleBlocks.map((block) => renderBlockWithTracking(block))}
      {visibleBlocks.length === 0 && (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">This page has no content yet.</p>
        </div>
      )}
    </div>
  );
}
