import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Eye } from "lucide-react";
import type { Block, BlockType } from "@shared/schema";

import { HeroSettings } from "./settings/HeroSettings";
import { ProductGridSettings } from "./settings/ProductGridSettings";
import { TextBlockSettings } from "./settings/TextBlockSettings";
import { ImageBlockSettings } from "./settings/ImageBlockSettings";
import { ButtonBlockSettings } from "./settings/ButtonBlockSettings";
import { FormBlockSettings } from "./settings/FormBlockSettings";
import { PhoneBlockSettings } from "./settings/PhoneBlockSettings";
import { ChatBlockSettings } from "./settings/ChatBlockSettings";
import { ProductBlockSettings } from "./settings/ProductBlockSettings";
import { ContainerSettings } from "./settings/ContainerSettings";
import { ABTestingPanel } from "./settings/ABTestingPanel";
import { VisibilityPanel } from "./settings/VisibilityPanel";

interface BlockSettingsProps {
  block: Block | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (config: Record<string, any>) => void;
  onUpdateBlock?: (block: Block) => void;
  storeId?: string;
  userId?: string;
}

function getSettingsComponent(
  type: BlockType, 
  config: Record<string, any>, 
  onUpdate: (config: Record<string, any>) => void,
  storeId?: string,
  userId?: string
) {
  switch (type) {
    case "hero-banner":
      return <HeroSettings config={config} onUpdate={onUpdate} />;
    case "product-grid":
      return <ProductGridSettings config={config} onUpdate={onUpdate} />;
    case "product-block":
      return <ProductBlockSettings config={config} onUpdate={onUpdate} storeId={storeId} userId={userId} />;
    case "text-block":
      return <TextBlockSettings config={config} onUpdate={onUpdate} />;
    case "image-block":
      return <ImageBlockSettings config={config} onUpdate={onUpdate} />;
    case "button-block":
      return <ButtonBlockSettings config={config} onUpdate={onUpdate} />;
    case "form-block":
      return <FormBlockSettings config={config} onUpdate={onUpdate} />;
    case "phone-block":
      return <PhoneBlockSettings config={config} onUpdate={onUpdate} />;
    case "chat-block":
      return <ChatBlockSettings config={config} onUpdate={onUpdate} />;
    case "container":
      return <ContainerSettings config={config} onUpdate={onUpdate} />;
    case "section":
      return <ContainerSettings config={config} onUpdate={onUpdate} isSection />;
    default:
      return <div>No settings available</div>;
  }
}

export function BlockSettings({ block, open, onClose, onUpdate, onUpdateBlock, storeId, userId }: BlockSettingsProps) {
  const [activeTab, setActiveTab] = useState("settings");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  
  if (!block) return null;

  const editingVariant = editingVariantId 
    ? block.variants?.find(v => v.id === editingVariantId)
    : null;
  const editingConfig = editingVariant ? editingVariant.config : block.config;
  const editingLabel = editingVariant ? editingVariant.name : "Original";

  const handleConfigUpdate = (newConfig: Record<string, any>) => {
    if (editingVariantId && onUpdateBlock && block.variants) {
      onUpdateBlock({
        ...block,
        variants: block.variants.map(v => 
          v.id === editingVariantId ? { ...v, config: newConfig } : v
        ),
      });
    } else {
      onUpdate(newConfig);
    }
  };

  const handleEditVariant = (variantId: string | null) => {
    setEditingVariantId(variantId);
    setActiveTab("settings");
  };

  const handleClose = () => {
    setEditingVariantId(null);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full max-w-[400px] p-4 sm:p-6" data-testid="block-settings-panel">
        <SheetHeader>
          <SheetTitle className="capitalize">
            {block.type.replace("-", " ")} Settings
          </SheetTitle>
        </SheetHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid mb-4 grid-cols-3">
            <TabsTrigger value="settings" data-testid="tab-block-settings">
              Settings
            </TabsTrigger>
            <TabsTrigger value="visibility" data-testid="tab-block-visibility">
              <Eye className="h-4 w-4 mr-1" />
              Visibility
            </TabsTrigger>
            <TabsTrigger value="ab-test" data-testid="tab-block-ab-test">
              <FlaskConical className="h-4 w-4 mr-1" />
              A/B Test
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[calc(100vh-180px)] pr-4 overflow-hidden">
            <TabsContent value="settings" className="mt-0">
              {editingVariantId && (
                <Card className="p-3 mb-4 bg-primary/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{editingLabel}</Badge>
                      <span className="text-sm">Editing variant settings</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingVariantId(null)}
                      data-testid="button-back-to-original"
                    >
                      Back to Original
                    </Button>
                  </div>
                </Card>
              )}
              {getSettingsComponent(block.type, editingConfig, handleConfigUpdate, storeId, userId)}
            </TabsContent>
            <TabsContent value="visibility" className="mt-0">
              <VisibilityPanel block={block} onUpdateBlock={onUpdateBlock} />
            </TabsContent>
            <TabsContent value="ab-test" className="mt-0">
              <ABTestingPanel 
                block={block} 
                onUpdateBlock={onUpdateBlock}
                onEditVariant={handleEditVariant}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
