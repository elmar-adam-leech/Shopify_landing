import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layout, ShoppingBag, Users, Clock, Megaphone, Gift } from "lucide-react";
import type { Block } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  blocks: Omit<Block, "id">[];
}

const templates: Template[] = [
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Perfect for announcing new products with hero section, features, and call-to-action",
    category: "E-commerce",
    icon: ShoppingBag,
    blocks: [
      {
        type: "hero-banner",
        config: {
          title: "Introducing Our Latest Innovation",
          subtitle: "Discover the product that will change everything",
          buttonText: "Shop Now",
          buttonUrl: "#",
          overlayOpacity: 60,
          textAlign: "center",
        },
        order: 0,
      },
      {
        type: "text-block",
        config: {
          content: "Experience the future of quality and design. Our latest product combines cutting-edge technology with timeless craftsmanship.",
          textAlign: "center",
          fontSize: "large",
        },
        order: 1,
      },
      {
        type: "product-grid",
        config: {
          columns: 3,
          showPrice: true,
          showTitle: true,
          showAddToCart: true,
        },
        order: 2,
      },
      {
        type: "button-block",
        config: {
          text: "View All Products",
          url: "#",
          variant: "primary",
          size: "large",
          alignment: "center",
          trackConversion: true,
        },
        order: 3,
      },
    ],
  },
  {
    id: "sale-promo",
    name: "Sale & Promotion",
    description: "Drive urgency with bold headlines, countdown vibes, and strong CTAs",
    category: "Marketing",
    icon: Gift,
    blocks: [
      {
        type: "hero-banner",
        config: {
          title: "FLASH SALE - Up to 50% Off",
          subtitle: "Limited time only. Don't miss out on these incredible deals!",
          buttonText: "Shop the Sale",
          buttonUrl: "#",
          overlayOpacity: 70,
          textAlign: "center",
        },
        order: 0,
      },
      {
        type: "text-block",
        config: {
          content: "Our biggest sale of the season is here. Shop now and save on your favorite products before they're gone!",
          textAlign: "center",
          fontSize: "medium",
        },
        order: 1,
      },
      {
        type: "product-grid",
        config: {
          columns: 4,
          showPrice: true,
          showTitle: true,
          showAddToCart: true,
        },
        order: 2,
      },
      {
        type: "button-block",
        config: {
          text: "Shop All Deals",
          url: "#",
          variant: "primary",
          size: "large",
          alignment: "center",
          trackConversion: true,
        },
        order: 3,
      },
    ],
  },
  {
    id: "lead-capture",
    name: "Lead Capture",
    description: "Collect emails and leads with compelling offer and form",
    category: "Lead Gen",
    icon: Users,
    blocks: [
      {
        type: "hero-banner",
        config: {
          title: "Get 20% Off Your First Order",
          subtitle: "Sign up for our newsletter and receive exclusive discounts",
          buttonText: "",
          buttonUrl: "",
          overlayOpacity: 50,
          textAlign: "center",
        },
        order: 0,
      },
      {
        type: "form-block",
        config: {
          title: "Join Our Community",
          fields: [
            { id: uuidv4(), label: "Full Name", type: "text", required: true },
            { id: uuidv4(), label: "Email Address", type: "email", required: true },
            { id: uuidv4(), label: "Phone Number", type: "phone", required: false },
          ],
          submitText: "Get My 20% Off",
          successMessage: "Check your inbox for your discount code!",
          fireConversionEvent: true,
        },
        order: 1,
      },
      {
        type: "text-block",
        config: {
          content: "By signing up, you agree to receive marketing emails. You can unsubscribe at any time.",
          textAlign: "center",
          fontSize: "small",
        },
        order: 2,
      },
    ],
  },
  {
    id: "coming-soon",
    name: "Coming Soon",
    description: "Build anticipation for upcoming products or launches",
    category: "Launch",
    icon: Clock,
    blocks: [
      {
        type: "hero-banner",
        config: {
          title: "Something Big is Coming",
          subtitle: "Be the first to know when we launch",
          buttonText: "",
          buttonUrl: "",
          overlayOpacity: 60,
          textAlign: "center",
        },
        order: 0,
      },
      {
        type: "text-block",
        config: {
          content: "We're working on something special. Sign up to get exclusive early access and be among the first to experience it.",
          textAlign: "center",
          fontSize: "large",
        },
        order: 1,
      },
      {
        type: "form-block",
        config: {
          title: "Get Early Access",
          fields: [
            { id: uuidv4(), label: "Email Address", type: "email", required: true },
          ],
          submitText: "Notify Me",
          successMessage: "You're on the list! We'll notify you when we launch.",
          fireConversionEvent: true,
        },
        order: 2,
      },
    ],
  },
  {
    id: "brand-story",
    name: "Brand Story",
    description: "Tell your brand's story with images, text, and compelling narrative",
    category: "Branding",
    icon: Megaphone,
    blocks: [
      {
        type: "hero-banner",
        config: {
          title: "Our Story",
          subtitle: "Crafted with passion, delivered with purpose",
          buttonText: "Learn More",
          buttonUrl: "#",
          overlayOpacity: 50,
          textAlign: "center",
        },
        order: 0,
      },
      {
        type: "text-block",
        config: {
          content: "We started with a simple idea: create products that make a difference. Today, we continue that mission with the same passion and dedication that inspired us from day one.",
          textAlign: "center",
          fontSize: "large",
        },
        order: 1,
      },
      {
        type: "image-block",
        config: {
          src: "",
          alt: "Our team",
          width: "large",
          alignment: "center",
        },
        order: 2,
      },
      {
        type: "text-block",
        config: {
          content: "Every product we create is a reflection of our commitment to quality, sustainability, and customer satisfaction.",
          textAlign: "center",
          fontSize: "medium",
        },
        order: 3,
      },
      {
        type: "button-block",
        config: {
          text: "Shop Our Collection",
          url: "#",
          variant: "primary",
          size: "medium",
          alignment: "center",
        },
        order: 4,
      },
    ],
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch with an empty page",
    category: "Basic",
    icon: Layout,
    blocks: [],
  },
];

interface TemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (blocks: Block[]) => void;
}

export function TemplateLibrary({ open, onClose, onSelectTemplate }: TemplateLibraryProps) {
  const handleSelect = (template: Template) => {
    const blocksWithIds = template.blocks.map((block) => ({
      ...block,
      id: uuidv4(),
    }));
    onSelectTemplate(blocksWithIds as Block[]);
    onClose();
  };

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="template-library-dialog">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built template or create from scratch
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {categories.map((category) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {templates
                  .filter((t) => t.category === category)
                  .map((template) => {
                    const Icon = template.icon;
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover-elevate active-elevate-2 transition-all"
                        onClick={() => handleSelect(template)}
                        data-testid={`template-${template.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-sm mb-1">{template.name}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                              <Badge variant="secondary" className="mt-2">
                                {template.blocks.length} blocks
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
