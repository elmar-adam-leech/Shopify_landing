import { memo, useState } from "react";
import type { FormBlockConfig, FormStep } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { EyeOff, ChevronLeft, ChevronRight, Check } from "lucide-react";

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

function FieldRenderer({ field }: { field: FormField }) {
  if (field.type === "hidden") {
    return <HiddenFieldIndicator field={field} />;
  }

  if (field.type === "address") {
    return <AddressFieldPreview field={field} />;
  }

  if (field.type === "name") {
    return <NameFieldPreview field={field} />;
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center space-x-2">
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
      <div className="space-y-2">
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
      <div className="space-y-2">
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
    <div className="space-y-2">
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
}

function StepIndicators({ 
  steps, 
  currentStep, 
  showStepNumbers 
}: { 
  steps: FormStep[]; 
  currentStep: number; 
  showStepNumbers: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div 
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              index < currentStep 
                ? "bg-primary text-primary-foreground" 
                : index === currentStep 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {showStepNumbers ? index + 1 : (index <= currentStep ? <Check className="h-4 w-4" /> : "")}
          </div>
          {index < steps.length - 1 && (
            <div 
              className={`w-8 h-0.5 mx-1 ${
                index < currentStep ? "bg-primary" : "bg-muted"
              }`} 
            />
          )}
        </div>
      ))}
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
  const isMultiStep = settings.isMultiStep || false;
  const steps = settings.steps || [];
  const showProgressBar = settings.showProgressBar !== false;
  const showStepNumbers = settings.showStepNumbers !== false;
  const prevButtonText = settings.prevButtonText || "Previous";
  const nextButtonText = settings.nextButtonText || "Next";

  const [currentStep, setCurrentStep] = useState(0);

  // Get valid field IDs set for runtime validation
  const validFieldIds = new Set(fields.map((f: FormField) => f.id));

  if (isMultiStep && steps.length > 0) {
    const currentStepData = steps[currentStep];
    // Filter out any orphaned field references that no longer exist
    const validStepFieldIds = (currentStepData?.fieldIds || [])
      .filter((fieldId: string) => validFieldIds.has(fieldId));
    const stepFields = validStepFieldIds
      .map((fieldId: string) => fields.find((f: FormField) => f.id === fieldId))
      .filter(Boolean) as FormField[];
    
    const visibleFields = stepFields.filter((f) => f.type !== "hidden");
    const hiddenFields = stepFields.filter((f) => f.type === "hidden");

    const progressPercentage = ((currentStep + 1) / steps.length) * 100;
    const isLastStep = currentStep === steps.length - 1;
    const isFirstStep = currentStep === 0;

    return (
      <div className="p-6 bg-background" data-testid="form-block-preview">
        <Card className="max-w-md mx-auto p-6">
          <h3 className="text-xl font-semibold mb-4 text-center">{title}</h3>
          
          {showProgressBar && (
            <div className="mb-4">
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          <StepIndicators 
            steps={steps} 
            currentStep={currentStep} 
            showStepNumbers={showStepNumbers} 
          />

          {currentStepData && (
            <div className="mb-4 text-center">
              <h4 className="font-medium">{currentStepData.title}</h4>
              {currentStepData.description && (
                <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
              )}
            </div>
          )}

          {hiddenFields.length > 0 && (
            <div className="mb-4 space-y-1">
              {hiddenFields.map((field: FormField) => (
                <HiddenFieldIndicator key={field.id} field={field} />
              ))}
            </div>
          )}

          <div className="space-y-4">
            {visibleFields.length > 0 ? (
              visibleFields.map((field: FormField) => (
                <FieldRenderer key={field.id} field={field} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No fields assigned to this step
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={isFirstStep}
              data-testid="button-form-prev"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {prevButtonText}
            </Button>
            
            {isLastStep ? (
              <Button data-testid="button-form-submit">{submitText}</Button>
            ) : (
              <Button
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                data-testid="button-form-next"
              >
                {nextButtonText}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

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
          {visibleFields.map((field: FormField) => (
            <FieldRenderer key={field.id} field={field} />
          ))}
          <Button className="w-full mt-4" data-testid="button-form-submit">{submitText}</Button>
        </div>
      </Card>
    </div>
  );
});
