import { useEffect, useState } from "react";
import { getUrlParam } from "@/lib/preview/pixels";
import type { Block } from "@shared/schema";

export function FormBlockPreview({ 
  block, 
  config, 
  onSubmit 
}: { 
  block: Block; 
  config: Record<string, any>; 
  onSubmit: (formData: Record<string, string>) => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const isMultiStep = config.isMultiStep || false;
  const steps = config.steps || [];
  const showProgressBar = config.showProgressBar !== false;
  const showStepNumbers = config.showStepNumbers !== false;

  useEffect(() => {
    const hiddenFields = (config.fields || []).filter((f: any) => f.type === "hidden");
    const autoCapturedData: Record<string, string> = {};
    
    hiddenFields.forEach((field: any) => {
      const paramName = field.autoCapture === "custom" ? field.customParam : field.autoCapture;
      if (paramName) {
        const value = getUrlParam(paramName);
        if (value) {
          autoCapturedData[field.id] = value;
        }
      }
    });
    
    if (Object.keys(autoCapturedData).length > 0) {
      setFormData(prev => ({ ...prev, ...autoCapturedData }));
    }
  }, [config.fields]);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section
        key={block.id}
        className="py-8 px-6"
        data-testid={`preview-block-${block.id}`}
      >
        <div className="max-w-md mx-auto text-center">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <p className="text-green-800 dark:text-green-200 font-medium">
              {config.successMessage || "Thank you for your submission!"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const renderNameField = (field: any) => {
    const format = field.nameFormat || "full";
    
    if (format === "full") {
      return (
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder={field.placeholder || "Full Name"}
          value={formData[field.id] || ""}
          onChange={(e) => handleFieldChange(field.id, e.target.value)}
          required={field.required}
          data-testid={`form-field-${field.id}`}
        />
      );
    }
    
    if (format === "first_last") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="First Name"
            value={formData[`${field.id}_first`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_first`, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}-first`}
          />
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="Last Name"
            value={formData[`${field.id}_last`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_last`, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}-last`}
          />
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="First"
          value={formData[`${field.id}_first`] || ""}
          onChange={(e) => handleFieldChange(`${field.id}_first`, e.target.value)}
          required={field.required}
          data-testid={`form-field-${field.id}-first`}
        />
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="Middle"
          value={formData[`${field.id}_middle`] || ""}
          onChange={(e) => handleFieldChange(`${field.id}_middle`, e.target.value)}
          data-testid={`form-field-${field.id}-middle`}
        />
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-lg bg-background"
          placeholder="Last"
          value={formData[`${field.id}_last`] || ""}
          onChange={(e) => handleFieldChange(`${field.id}_last`, e.target.value)}
          required={field.required}
          data-testid={`form-field-${field.id}-last`}
        />
      </div>
    );
  };

  const renderAddressField = (field: any) => {
    const components = field.addressComponents || { street: true, city: true, state: true, zip: true };
    
    return (
      <div className="space-y-2">
        {components.street && (
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder={field.placeholder || "Street Address"}
            value={formData[`${field.id}_street`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_street`, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}-street`}
          />
        )}
        {components.street2 && (
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder="Apt, Suite, etc. (optional)"
            value={formData[`${field.id}_street2`] || ""}
            onChange={(e) => handleFieldChange(`${field.id}_street2`, e.target.value)}
            data-testid={`form-field-${field.id}-street2`}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          {components.city && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="City"
              value={formData[`${field.id}_city`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_city`, e.target.value)}
              required={field.required}
              data-testid={`form-field-${field.id}-city`}
            />
          )}
          {components.state && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="State"
              value={formData[`${field.id}_state`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_state`, e.target.value)}
              required={field.required}
              data-testid={`form-field-${field.id}-state`}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {components.zip && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="ZIP Code"
              value={formData[`${field.id}_zip`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_zip`, e.target.value)}
              required={field.required}
              data-testid={`form-field-${field.id}-zip`}
            />
          )}
          {components.country && (
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg bg-background"
              placeholder="Country"
              value={formData[`${field.id}_country`] || ""}
              onChange={(e) => handleFieldChange(`${field.id}_country`, e.target.value)}
              data-testid={`form-field-${field.id}-country`}
            />
          )}
        </div>
      </div>
    );
  };

  const renderField = (field: any) => {
    const value = formData[field.id] || "";
    
    switch (field.type) {
      case "hidden":
        return null;
      case "name":
        return renderNameField(field);
      case "address":
        return renderAddressField(field);
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border"
              checked={value === "true"}
              onChange={(e) => handleFieldChange(field.id, e.target.checked ? "true" : "false")}
              required={field.required}
              data-testid={`form-field-${field.id}`}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "textarea":
        return (
          <textarea
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            rows={4}
            data-testid={`form-field-${field.id}`}
          />
        );
      case "select":
        return (
          <select
            className="w-full px-3 py-2 border rounded-lg bg-background"
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}`}
          >
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {(field.options || []).map((option: string, index: number) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type={field.type}
            className="w-full px-3 py-2 border rounded-lg bg-background"
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            data-testid={`form-field-${field.id}`}
          />
        );
    }
  };

  const allFields = config.fields || [];
  const validFieldIds = new Set(allFields.map((f: any) => f.id));
  
  if (isMultiStep && steps.length > 0) {
    const currentStepData = steps[currentStep];
    const stepFieldIds = (currentStepData?.fieldIds || []).filter((id: string) => validFieldIds.has(id));
    const stepFields = stepFieldIds
      .map((id: string) => allFields.find((f: any) => f.id === id))
      .filter(Boolean);
    const visibleStepFields = stepFields.filter((f: any) => f.type !== "hidden");
    
    const progressPercentage = ((currentStep + 1) / steps.length) * 100;
    const isLastStep = currentStep === steps.length - 1;
    const isFirstStep = currentStep === 0;
    
    return (
      <section
        key={block.id}
        className="py-8 px-6"
        data-testid={`preview-block-${block.id}`}
      >
        <div className="max-w-md mx-auto">
          {config.title && (
            <h2 className="text-2xl font-bold mb-4 text-center">{config.title}</h2>
          )}
          
          {showProgressBar && (
            <div className="mb-4 bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((step: any, index: number) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    index <= currentStep 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {showStepNumbers ? index + 1 : (index < currentStep ? "✓" : "")}
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
          
          {currentStepData && (
            <div className="mb-4 text-center">
              <h4 className="font-medium">{currentStepData.title}</h4>
              {currentStepData.description && (
                <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
              )}
            </div>
          )}
          
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (isLastStep) {
              onSubmit(formData);
              setSubmitted(true);
            } else {
              setCurrentStep(prev => prev + 1);
            }
          }}>
            {visibleStepFields.length > 0 ? (
              visibleStepFields.map((field: any) => (
                <div key={field.id}>
                  {field.type !== "checkbox" && (
                    <label className="block text-sm font-medium mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  )}
                  {renderField(field)}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No fields assigned to this step
              </p>
            )}
            
            <div className="flex items-center justify-between gap-2 pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                disabled={isFirstStep}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  isFirstStep 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-muted"
                }`}
                data-testid="form-prev-button"
              >
                {config.prevButtonText || "Previous"}
              </button>
              
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
                data-testid={isLastStep ? "form-submit-button" : "form-next-button"}
              >
                {isLastStep ? (config.submitText || "Submit") : (config.nextButtonText || "Next")}
              </button>
            </div>
          </form>
        </div>
      </section>
    );
  }

  const visibleFields = allFields.filter((f: any) => f.type !== "hidden");

  return (
    <section
      key={block.id}
      className="py-8 px-6"
      data-testid={`preview-block-${block.id}`}
    >
      <div className="max-w-md mx-auto">
        {config.title && (
          <h2 className="text-2xl font-bold mb-6 text-center">{config.title}</h2>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {visibleFields.map((field: any) => (
            <div key={field.id}>
              {field.type !== "checkbox" && (
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}
              {renderField(field)}
            </div>
          ))}
          <button
            type="submit"
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
            data-testid="form-submit-button"
          >
            {config.submitText || "Submit"}
          </button>
        </form>
      </div>
    </section>
  );
}
