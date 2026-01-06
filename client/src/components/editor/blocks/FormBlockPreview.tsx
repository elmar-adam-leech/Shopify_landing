import { memo } from "react";
import type { FormBlockConfig } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EyeOff } from "lucide-react";

interface FormBlockPreviewProps {
  config: Record<string, any>;
}

interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  autoCapture?: string;
  customParam?: string;
  addressComponents?: {
    street?: boolean;
    street2?: boolean;
    city?: boolean;
    state?: boolean;
    zip?: boolean;
    country?: boolean;
  };
  nameFormat?: "full" | "first_last" | "first_middle_last";
}

function AddressFieldPreview({ field }: { field: FormField }) {
  const components = field.addressComponents || {
    street: true,
    city: true,
    state: true,
    zip: true,
  };

  return (
    <div className="space-y-3">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="space-y-2">
        {components.street && (
          <Input placeholder={field.placeholder || "Street Address"} disabled />
        )}
        {components.street2 && (
          <Input placeholder="Apt, Suite, etc. (optional)" disabled />
        )}
        <div className="grid grid-cols-2 gap-2">
          {components.city && (
            <Input placeholder="City" disabled />
          )}
          {components.state && (
            <Input placeholder="State" disabled />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {components.zip && (
            <Input placeholder="ZIP Code" disabled />
          )}
          {components.country && (
            <Input placeholder="Country" disabled />
          )}
        </div>
      </div>
    </div>
  );
}

function NameFieldPreview({ field }: { field: FormField }) {
  const format = field.nameFormat || "full";

  if (format === "full") {
    return (
      <div className="space-y-2">
        <Label htmlFor={field.id}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={field.id}
          placeholder={field.placeholder || "Full Name"}
          disabled
        />
      </div>
    );
  }

  if (format === "first_last") {
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="First Name" disabled />
          <Input placeholder="Last Name" disabled />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="grid grid-cols-3 gap-2">
        <Input placeholder="First" disabled />
        <Input placeholder="Middle" disabled />
        <Input placeholder="Last" disabled />
      </div>
    </div>
  );
}

function HiddenFieldIndicator({ field }: { field: FormField }) {
  const paramName = field.autoCapture === "custom" 
    ? field.customParam || "custom_param"
    : field.autoCapture || "custom";

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm text-muted-foreground">
      <EyeOff className="w-4 h-4" />
      <span>Hidden: {field.label}</span>
      <span className="text-xs bg-background px-1.5 py-0.5 rounded">
        Auto-captures: {paramName}
      </span>
    </div>
  );
}

export const FormBlockPreview = memo(function FormBlockPreview({ config }: FormBlockPreviewProps) {
  const settings = config as FormBlockConfig;
  const title = settings.title || "Contact Us";
  const fields = settings.fields || [
    { id: "name", label: "Name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
  ];
  const submitText = settings.submitText || "Submit";

  const visibleFields = fields.filter((f: FormField) => f.type !== "hidden");
  const hiddenFields = fields.filter((f: FormField) => f.type === "hidden");

  return (
    <div className="p-6 bg-background" data-testid="form-block-preview">
      <Card className="max-w-md mx-auto p-6">
        <h3 className="text-xl font-semibold mb-6 text-center">{title}</h3>
        
        {hiddenFields.length > 0 && (
          <div className="mb-4 space-y-1">
            {hiddenFields.map((field: FormField) => (
              <HiddenFieldIndicator key={field.id} field={field} />
            ))}
          </div>
        )}

        <div className="space-y-4">
          {visibleFields.map((field: FormField) => {
            if (field.type === "address") {
              return <AddressFieldPreview key={field.id} field={field} />;
            }

            if (field.type === "name") {
              return <NameFieldPreview key={field.id} field={field} />;
            }

            if (field.type === "checkbox") {
              return (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox id={field.id} disabled />
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                </div>
              );
            }

            if (field.type === "select") {
              return (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map((opt: string, idx: number) => (
                        <SelectItem key={idx} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (field.type === "textarea") {
              return (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Textarea
                    id={field.id}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    disabled
                  />
                </div>
              );
            }

            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={field.id}
                  type={field.type}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                  disabled
                />
              </div>
            );
          })}
          <Button className="w-full mt-4" data-testid="button-form-submit">{submitText}</Button>
        </div>
      </Card>
    </div>
  );
});
