import type { FormBlockConfig } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FormBlockPreviewProps {
  config: Record<string, any>;
}

export function FormBlockPreview({ config }: FormBlockPreviewProps) {
  const settings = config as FormBlockConfig;
  const title = settings.title || "Contact Us";
  const fields = settings.fields || [
    { id: "name", label: "Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
  ];
  const submitText = settings.submitText || "Submit";

  return (
    <div className="p-6 bg-background" data-testid="form-block-preview">
      <Card className="max-w-md mx-auto p-6">
        <h3 className="text-xl font-semibold mb-6 text-center">{title}</h3>
        <div className="space-y-4">
          {fields.map((field: any) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.id}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  disabled
                />
              ) : (
                <Input
                  id={field.id}
                  type={field.type}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  disabled
                />
              )}
            </div>
          ))}
          <Button className="w-full mt-4">{submitText}</Button>
        </div>
      </Card>
    </div>
  );
}
