import { useDraggable } from "@dnd-kit/core";
import { 
  Layout, 
  Grid3X3, 
  Package,
  Type, 
  Image, 
  MousePointer, 
  FileText, 
  Phone, 
  MessageCircle,
  GripVertical 
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BlockType } from "@shared/schema";

interface BlockLibraryItem {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "content" | "products" | "conversion" | "tracking";
}

const blockLibrary: BlockLibraryItem[] = [
  {
    type: "hero-banner",
    label: "Hero Banner",
    description: "Large banner with image and text overlay",
    icon: <Layout className="h-5 w-5" />,
    category: "content",
  },
  {
    type: "text-block",
    label: "Text Block",
    description: "Rich text content section",
    icon: <Type className="h-5 w-5" />,
    category: "content",
  },
  {
    type: "image-block",
    label: "Image Block",
    description: "Single image with optional caption",
    icon: <Image className="h-5 w-5" />,
    category: "content",
  },
  {
    type: "button-block",
    label: "Button",
    description: "Call-to-action button",
    icon: <MousePointer className="h-5 w-5" />,
    category: "content",
  },
  {
    type: "product-grid",
    label: "Product Grid",
    description: "Display products from your store",
    icon: <Grid3X3 className="h-5 w-5" />,
    category: "products",
  },
  {
    type: "product-block",
    label: "Product Block",
    description: "Display a single product with all details",
    icon: <Package className="h-5 w-5" />,
    category: "products",
  },
  {
    type: "form-block",
    label: "Lead Form",
    description: "Capture leads with custom forms",
    icon: <FileText className="h-5 w-5" />,
    category: "conversion",
  },
  {
    type: "phone-block",
    label: "Phone Number",
    description: "Trackable click-to-call button",
    icon: <Phone className="h-5 w-5" />,
    category: "conversion",
  },
  {
    type: "chat-block",
    label: "Chat Widget",
    description: "Shopify Inbox integration",
    icon: <MessageCircle className="h-5 w-5" />,
    category: "tracking",
  },
];

const categories = [
  { id: "content", label: "Content Blocks" },
  { id: "products", label: "Product Blocks" },
  { id: "conversion", label: "Conversion Blocks" },
  { id: "tracking", label: "Tracking & Chat" },
] as const;

interface DraggableBlockProps {
  block: BlockLibraryItem;
}

function DraggableBlock({ block }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${block.type}`,
    data: {
      type: block.type,
      isLibraryItem: true,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-4 cursor-grab active:cursor-grabbing hover-elevate active-elevate-2 transition-all ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
      data-testid={`block-library-${block.type}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <div className="p-2 rounded-md bg-accent/50">
            {block.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{block.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {block.description}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function BlockLibrary() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Components</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Drag blocks to the canvas
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {categories.map((category) => {
            const categoryBlocks = blockLibrary.filter(
              (b) => b.category === category.id
            );
            if (categoryBlocks.length === 0) return null;

            return (
              <div key={category.id}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {category.label}
                </h3>
                <div className="space-y-2">
                  {categoryBlocks.map((block) => (
                    <DraggableBlock key={block.type} block={block} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
