import { useState, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Settings, Trash2, Copy, Lock, Unlock, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDroppable } from "@dnd-kit/core";
import type { Block, Section, BlockPosition } from "@shared/schema";
import { HeroBlockPreview } from "./blocks/HeroBlockPreview";
import { ProductGridPreview } from "./blocks/ProductGridPreview";
import { ProductBlockPreview } from "./blocks/ProductBlockPreview";
import { TextBlockPreview } from "./blocks/TextBlockPreview";
import { ImageBlockPreview } from "./blocks/ImageBlockPreview";
import { ButtonBlockPreview } from "./blocks/ButtonBlockPreview";
import { FormBlockPreview } from "./blocks/FormBlockPreview";
import { PhoneBlockPreview } from "./blocks/PhoneBlockPreview";
import { ChatBlockPreview } from "./blocks/ChatBlockPreview";

interface FreeformCanvasProps {
  blocks: Block[];
  sections: Section[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onOpenSettings: (id: string) => void;
  onUpdateBlockPosition: (blockId: string, position: Partial<BlockPosition>) => void;
  viewportSize: "desktop" | "tablet" | "mobile";
  showRulers: boolean;
  showSnapGuides: boolean;
}

function getBlockPreview(block: Block) {
  switch (block.type) {
    case "hero-banner":
      return <HeroBlockPreview config={block.config} />;
    case "product-grid":
      return <ProductGridPreview config={block.config} />;
    case "product-block":
      return <ProductBlockPreview config={block.config} />;
    case "text-block":
      return <TextBlockPreview config={block.config} />;
    case "image-block":
      return <ImageBlockPreview config={block.config} />;
    case "button-block":
      return <ButtonBlockPreview config={block.config} />;
    case "form-block":
      return <FormBlockPreview config={block.config} />;
    case "phone-block":
      return <PhoneBlockPreview config={block.config} />;
    case "chat-block":
      return <ChatBlockPreview config={block.config} />;
    default:
      return <div className="p-4 text-muted-foreground">Unknown block type</div>;
  }
}

function Ruler({ direction, length }: { direction: "horizontal" | "vertical"; length: number }) {
  const marks = [];
  const step = 50;
  
  for (let i = 0; i <= length; i += step) {
    marks.push(
      <div
        key={i}
        className="absolute text-[10px] text-muted-foreground"
        style={
          direction === "horizontal"
            ? { left: i, top: 0 }
            : { top: i, left: 0, transform: "rotate(-90deg)", transformOrigin: "left top" }
        }
      >
        <span className="absolute -translate-x-1/2">{i}</span>
        <div
          className={`absolute bg-border ${
            direction === "horizontal" ? "w-px h-2 top-3" : "h-px w-2 left-3"
          }`}
          style={direction === "horizontal" ? { left: 0 } : { top: 0 }}
        />
      </div>
    );
  }
  
  return (
    <div
      className={`absolute bg-muted/50 ${
        direction === "horizontal"
          ? "h-5 left-5 top-0 right-0"
          : "w-5 top-5 left-0 bottom-0"
      }`}
    >
      {marks}
    </div>
  );
}

interface PositionedBlockProps {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpenSettings: () => void;
  onUpdatePosition: (position: Partial<BlockPosition>) => void;
  viewportSize: "desktop" | "tablet" | "mobile";
  canvasWidth: number;
  showSnapGuides: boolean;
}

function PositionedBlock({
  block,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onOpenSettings,
  onUpdatePosition,
  viewportSize,
  canvasWidth,
  showSnapGuides,
}: PositionedBlockProps) {
  const position = block.position || { x: 0, y: 0, width: 200, height: 100, zIndex: 1, locked: false };
  
  const getResponsivePosition = () => {
    if (viewportSize === "tablet" && position.tablet) {
      return {
        x: position.tablet.x ?? position.x,
        y: position.tablet.y ?? position.y,
        width: position.tablet.width ?? position.width,
        height: position.tablet.height ?? position.height,
      };
    }
    if (viewportSize === "mobile" && position.mobile) {
      return {
        x: position.mobile.x ?? position.x,
        y: position.mobile.y ?? position.y,
        width: position.mobile.width ?? position.width,
        height: position.mobile.height ?? position.height,
      };
    }
    return { x: position.x, y: position.y, width: position.width, height: position.height };
  };
  
  const responsivePos = getResponsivePosition();
  
  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    if (position.locked) return;
    
    if (viewportSize === "desktop") {
      onUpdatePosition({ x: d.x, y: d.y });
    } else if (viewportSize === "tablet") {
      onUpdatePosition({ tablet: { ...position.tablet, x: d.x, y: d.y } });
    } else {
      onUpdatePosition({ mobile: { ...position.mobile, x: d.x, y: d.y } });
    }
  };
  
  const handleResizeStop = (_e: unknown, _direction: unknown, ref: HTMLElement, _delta: unknown, pos: { x: number; y: number }) => {
    if (position.locked) return;
    
    const newWidth = parseInt(ref.style.width);
    const newHeight = parseInt(ref.style.height);
    
    if (viewportSize === "desktop") {
      onUpdatePosition({ x: pos.x, y: pos.y, width: newWidth, height: newHeight });
    } else if (viewportSize === "tablet") {
      onUpdatePosition({ tablet: { ...position.tablet, x: pos.x, y: pos.y, width: newWidth, height: newHeight } });
    } else {
      onUpdatePosition({ mobile: { ...position.mobile, x: pos.x, y: pos.y, width: newWidth, height: newHeight } });
    }
  };
  
  const handleBringForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdatePosition({ zIndex: position.zIndex + 1 });
  };
  
  const handleSendBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdatePosition({ zIndex: Math.max(1, position.zIndex - 1) });
  };
  
  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdatePosition({ locked: !position.locked });
  };
  
  return (
    <Rnd
      size={{ width: responsivePos.width, height: responsivePos.height }}
      position={{ x: responsivePos.x, y: responsivePos.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      disableDragging={position.locked}
      enableResizing={!position.locked}
      bounds="parent"
      dragGrid={showSnapGuides ? [10, 10] : undefined}
      resizeGrid={showSnapGuides ? [10, 10] : undefined}
      style={{ zIndex: position.zIndex }}
      className={`group ${
        isSelected
          ? "ring-2 ring-primary ring-offset-2"
          : "hover:ring-1 hover:ring-border"
      } ${position.locked ? "cursor-not-allowed" : ""}`}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect();
      }}
      data-testid={`freeform-block-${block.id}`}
    >
      <div className="relative w-full h-full overflow-hidden rounded-md border bg-card">
        <div
          className={`absolute -top-10 left-0 right-0 flex items-center justify-between px-1 z-50 transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{ visibility: isSelected ? "visible" : "hidden" }}
        >
          <div className="flex items-center gap-1 bg-card border rounded-md px-2 py-1 shadow-sm">
            <Layers className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium capitalize">
              {block.type.replace("-", " ")}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">
              z:{position.zIndex}
            </span>
          </div>
          <div className="flex items-center gap-0.5 bg-card border rounded-md shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleBringForward}
              title="Bring forward"
              data-testid={`button-bring-forward-${block.id}`}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSendBack}
              title="Send back"
              data-testid={`button-send-back-${block.id}`}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleToggleLock}
              title={position.locked ? "Unlock" : "Lock"}
              data-testid={`button-lock-${block.id}`}
            >
              {position.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              data-testid={`button-settings-${block.id}`}
            >
              <Settings className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              data-testid={`button-duplicate-${block.id}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid={`button-delete-${block.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="w-full h-full overflow-hidden">
          {getBlockPreview(block)}
        </div>
        
        {isSelected && !position.locked && (
          <div className="absolute bottom-1 right-1 text-[10px] text-muted-foreground bg-card/80 px-1 rounded">
            {Math.round(responsivePos.width)} x {Math.round(responsivePos.height)}
          </div>
        )}
      </div>
    </Rnd>
  );
}

export function FreeformCanvas({
  blocks,
  sections,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onOpenSettings,
  onUpdateBlockPosition,
  viewportSize,
  showRulers,
  showSnapGuides,
}: FreeformCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "freeform-canvas",
  });
  
  const getCanvasWidth = () => {
    switch (viewportSize) {
      case "mobile":
        return 375;
      case "tablet":
        return 768;
      default:
        return 1024;
    }
  };
  
  const canvasWidth = getCanvasWidth();
  const canvasHeight = 800;
  
  const freeformBlocks = blocks.filter(b => b.position);
  const flowBlocks = blocks.filter(b => !b.position);
  
  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div
            ref={setNodeRef}
            className={`relative mx-auto transition-all rounded-lg ${
              freeformBlocks.length === 0 && flowBlocks.length === 0
                ? `border-2 border-dashed ${isOver ? "border-primary bg-primary/5" : "border-border"}`
                : "border border-border"
            }`}
            style={{
              width: canvasWidth + (showRulers ? 20 : 0),
              minHeight: canvasHeight + (showRulers ? 20 : 0),
            }}
            onClick={() => onSelectBlock(null)}
            data-testid="freeform-canvas"
          >
            {showRulers && (
              <>
                <Ruler direction="horizontal" length={canvasWidth} />
                <Ruler direction="vertical" length={canvasHeight} />
                <div className="absolute top-0 left-0 w-5 h-5 bg-muted/50" />
              </>
            )}
            
            <div
              className="relative bg-background"
              style={{
                marginLeft: showRulers ? 20 : 0,
                marginTop: showRulers ? 20 : 0,
                width: canvasWidth,
                minHeight: canvasHeight,
              }}
            >
              {showSnapGuides && (
                <>
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `
                      linear-gradient(to right, hsl(var(--border) / 0.15) 1px, transparent 1px),
                      linear-gradient(to bottom, hsl(var(--border) / 0.15) 1px, transparent 1px),
                      linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
                      linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: "10px 10px, 10px 10px, 50px 50px, 50px 50px",
                  }} />
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/30 pointer-events-none" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/30 pointer-events-none" />
                  <div className="absolute top-1/4 left-0 right-0 h-px bg-primary/10 pointer-events-none" />
                  <div className="absolute top-3/4 left-0 right-0 h-px bg-primary/10 pointer-events-none" />
                  <div className="absolute left-1/4 top-0 bottom-0 w-px bg-primary/10 pointer-events-none" />
                  <div className="absolute left-3/4 top-0 bottom-0 w-px bg-primary/10 pointer-events-none" />
                </>
              )}
              
              {freeformBlocks.length === 0 && flowBlocks.length === 0 ? (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Layers className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Freeform Canvas</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Drag components from the sidebar and position them anywhere.
                    Use z-index controls to layer elements.
                  </p>
                </div>
              ) : (
                <>
                  {freeformBlocks.map((block) => (
                    <PositionedBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => onSelectBlock(block.id)}
                      onDelete={() => onDeleteBlock(block.id)}
                      onDuplicate={() => onDuplicateBlock(block.id)}
                      onOpenSettings={() => onOpenSettings(block.id)}
                      onUpdatePosition={(pos) => onUpdateBlockPosition(block.id, pos)}
                      viewportSize={viewportSize}
                      canvasWidth={canvasWidth}
                      showSnapGuides={showSnapGuides}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export { getBlockPreview };
