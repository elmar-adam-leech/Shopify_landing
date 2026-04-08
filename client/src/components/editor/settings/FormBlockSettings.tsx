import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableFormField({ field, index, onUpdate, onRemove }: { 
  field: any; 
  index: number; 
  onUpdate: (updates: Record<string, any>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`border rounded-lg bg-muted/50 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 p-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Label"
          className="flex-1"
          data-testid={`input-field-label-${index}`}
        />
        <Select
          value={field.type}
          onValueChange={(value) => onUpdate({ type: value })}
        >
          <SelectTrigger className="w-28" data-testid={`select-field-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="textarea">Message</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="address">Address</SelectItem>
            <SelectItem value="select">Dropdown</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-field-${index}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive"
          data-testid={`button-remove-field-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 pt-0 space-y-3 border-t mt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => onUpdate({ required: checked })}
                data-testid={`switch-field-required-${index}`}
              />
              <Label className="text-sm">Required</Label>
            </div>
          </div>

          {field.type !== "hidden" && field.type !== "checkbox" && (
            <div className="space-y-2">
              <Label className="text-sm">Placeholder</Label>
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                placeholder="Enter placeholder text..."
                data-testid={`input-field-placeholder-${index}`}
              />
            </div>
          )}

          {field.type === "hidden" && (
            <div className="space-y-3 p-3 bg-background rounded-md">
              <Label className="text-sm font-medium">Auto-Capture Parameter</Label>
              <Select
                value={field.autoCapture || "custom"}
                onValueChange={(value) => onUpdate({ autoCapture: value })}
              >
                <SelectTrigger data-testid={`select-autocapture-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utm_source">UTM Source</SelectItem>
                  <SelectItem value="utm_medium">UTM Medium</SelectItem>
                  <SelectItem value="utm_campaign">UTM Campaign</SelectItem>
                  <SelectItem value="utm_term">UTM Term</SelectItem>
                  <SelectItem value="utm_content">UTM Content</SelectItem>
                  <SelectItem value="gclid">Google Click ID (gclid)</SelectItem>
                  <SelectItem value="fbclid">Facebook Click ID (fbclid)</SelectItem>
                  <SelectItem value="ttclid">TikTok Click ID (ttclid)</SelectItem>
                  <SelectItem value="msclkid">Microsoft Click ID (msclkid)</SelectItem>
                  <SelectItem value="custom">Custom Parameter</SelectItem>
                </SelectContent>
              </Select>
              {field.autoCapture === "custom" && (
                <Input
                  value={field.customParam || ""}
                  onChange={(e) => onUpdate({ customParam: e.target.value })}
                  placeholder="e.g., ref, source, campaign_id"
                  data-testid={`input-custom-param-${index}`}
                />
              )}
            </div>
          )}

          {field.type === "name" && (
            <div className="space-y-2">
              <Label className="text-sm">Name Format</Label>
              <Select
                value={field.nameFormat || "full"}
                onValueChange={(value) => onUpdate({ nameFormat: value })}
              >
                <SelectTrigger data-testid={`select-name-format-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Name (single field)</SelectItem>
                  <SelectItem value="first_last">First + Last Name</SelectItem>
                  <SelectItem value="first_middle_last">First + Middle + Last</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === "address" && (
            <div className="space-y-2">
              <Label className="text-sm">Address Components</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "street", label: "Street" },
                  { key: "street2", label: "Street 2" },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                  { key: "zip", label: "ZIP" },
                  { key: "country", label: "Country" },
                ].map((comp) => (
                  <div key={comp.key} className="flex items-center gap-2">
                    <Switch
                      checked={field.addressComponents?.[comp.key] !== false}
                      onCheckedChange={(checked) => 
                        onUpdate({ 
                          addressComponents: { 
                            ...field.addressComponents, 
                            [comp.key]: checked 
                          } 
                        })
                      }
                      data-testid={`switch-address-${comp.key}-${index}`}
                    />
                    <Label className="text-sm">{comp.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {field.type === "select" && (
            <div className="space-y-2">
              <Label className="text-sm">Options (one per line)</Label>
              <Textarea
                value={(field.options || []).join("\n")}
                onChange={(e) => onUpdate({ options: e.target.value.split("\n").filter(Boolean) })}
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                rows={4}
                data-testid={`input-options-${index}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WebhookEditor({ webhooks, onUpdate }: { 
  webhooks: any[];
  onUpdate: (webhooks: any[]) => void;
}) {
  const addWebhook = () => {
    onUpdate([
      ...webhooks,
      {
        id: uuidv4(),
        url: "",
        enabled: true,
        name: `Webhook ${webhooks.length + 1}`,
        method: "POST",
      }
    ]);
  };

  const updateWebhook = (index: number, updates: Record<string, any>) => {
    const newWebhooks = [...webhooks];
    newWebhooks[index] = { ...newWebhooks[index], ...updates };
    onUpdate(newWebhooks);
  };

  const removeWebhook = (index: number) => {
    onUpdate(webhooks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Webhooks</Label>
          <p className="text-xs text-muted-foreground">Send form data to external services like Zapier</p>
        </div>
        <Button variant="ghost" size="sm" onClick={addWebhook} data-testid="button-add-webhook">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      
      {webhooks.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
          No webhooks configured. Add one to send form submissions to external services.
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((webhook, index) => (
            <div key={webhook.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={webhook.enabled}
                  onCheckedChange={(checked) => updateWebhook(index, { enabled: checked })}
                  data-testid={`switch-webhook-enabled-${index}`}
                />
                <Input
                  value={webhook.name || ""}
                  onChange={(e) => updateWebhook(index, { name: e.target.value })}
                  placeholder="Webhook name"
                  className="flex-1"
                  data-testid={`input-webhook-name-${index}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeWebhook(index)}
                  className="text-destructive"
                  data-testid={`button-remove-webhook-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                value={webhook.url || ""}
                onChange={(e) => updateWebhook(index, { url: e.target.value })}
                placeholder="https://hooks.zapier.com/..."
                data-testid={`input-webhook-url-${index}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SortableStep({ 
  step, 
  index, 
  fields,
  allSteps,
  onUpdate, 
  onRemove 
}: { 
  step: any; 
  index: number; 
  fields: any[];
  allSteps: any[];
  onUpdate: (updates: Record<string, any>) => void; 
  onRemove: () => void;
}) {
  const getFieldAssignedToOtherStep = (fieldId: string) => {
    for (const s of allSteps) {
      if (s.id !== step.id && (s.fieldIds || []).includes(fieldId)) {
        return s.title || 'another step';
      }
    }
    return null;
  };
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg bg-background"
    >
      <div className="flex items-center gap-2 p-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
        <Input
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Step Title"
          className="flex-1"
          data-testid={`input-step-title-${index}`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-step-${index}`}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive"
          data-testid={`button-remove-step-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 pt-0 space-y-3 border-t mt-2">
          <div className="space-y-2">
            <Label className="text-sm">Description (optional)</Label>
            <Input
              value={step.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Brief description for this step"
              data-testid={`input-step-description-${index}`}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Assign Fields to This Step</Label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {fields.map((field: any) => {
                const assignedTo = getFieldAssignedToOtherStep(field.id);
                const isAssignedElsewhere = assignedTo !== null;
                const isInThisStep = (step.fieldIds || []).includes(field.id);
                
                return (
                  <div key={field.id} className={`flex items-center gap-2 p-2 rounded-md ${isAssignedElsewhere ? 'bg-muted/50' : 'bg-muted'}`}>
                    <Switch
                      checked={isInThisStep}
                      disabled={isAssignedElsewhere}
                      onCheckedChange={(checked) => {
                        const currentIds = step.fieldIds || [];
                        const newIds = checked 
                          ? [...currentIds, field.id]
                          : currentIds.filter((id: string) => id !== field.id);
                        onUpdate({ fieldIds: newIds });
                      }}
                      data-testid={`switch-step-field-${field.id}-${index}`}
                    />
                    <span className={`text-sm ${isAssignedElsewhere ? 'text-muted-foreground' : ''}`}>{field.label}</span>
                    {field.type === "hidden" && (
                      <Badge variant="secondary" className="text-xs">Hidden</Badge>
                    )}
                    {isAssignedElsewhere && (
                      <span className="text-xs text-muted-foreground">(in {assignedTo})</span>
                    )}
                  </div>
                );
              })}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">No fields defined yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FormBlockSettings({ config, onUpdate }: { config: Record<string, any>; onUpdate: (config: Record<string, any>) => void }) {
  const fields = config.fields || [];
  const webhooks = config.webhooks || [];
  const steps = config.steps || [];
  const isMultiStep = config.isMultiStep || false;

  const normalizedOnce = useRef(false);
  useEffect(() => {
    if (!normalizedOnce.current && isMultiStep && steps.length > 0) {
      const validFieldIds = new Set(fields.map((f: any) => f.id));
      let hasOrphanedRefs = false;
      
      const cleanedSteps = steps.map((step: any) => {
        const cleanedIds = (step.fieldIds || []).filter((id: string) => validFieldIds.has(id));
        if (cleanedIds.length !== (step.fieldIds || []).length) {
          hasOrphanedRefs = true;
        }
        return { ...step, fieldIds: cleanedIds };
      });
      
      if (hasOrphanedRefs) {
        onUpdate({ ...config, steps: cleanedSteps });
      }
      normalizedOnce.current = true;
    }
  }, [isMultiStep, steps, fields, config, onUpdate]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = fields.findIndex((f: any) => f.id === active.id);
    const newIndex = fields.findIndex((f: any) => f.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(fields, oldIndex, newIndex);
      onUpdate({ ...config, fields: newFields });
    }
  };

  const addField = (type: string = "text") => {
    const newField: any = {
      id: uuidv4(),
      label: type === "hidden" ? "Hidden Field" : "New Field",
      type,
      required: false,
    };
    
    if (type === "hidden") {
      newField.autoCapture = "utm_source";
    }
    if (type === "address") {
      newField.addressComponents = { street: true, city: true, state: true, zip: true };
    }
    if (type === "name") {
      newField.nameFormat = "full";
    }
    
    onUpdate({ ...config, fields: [...fields, newField] });
  };

  const updateField = (index: number, updates: Record<string, any>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onUpdate({ ...config, fields: newFields });
  };

  const removeField = (index: number) => {
    const removedFieldId = fields[index]?.id;
    const newFields = fields.filter((_: any, i: number) => i !== index);
    
    const newSteps = steps.map((step: any) => ({
      ...step,
      fieldIds: (step.fieldIds || []).filter((id: string) => id !== removedFieldId)
    }));
    
    onUpdate({ ...config, fields: newFields, steps: newSteps });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Form Title</Label>
        <Input
          id="title"
          value={config.title || ""}
          onChange={(e) => onUpdate({ ...config, title: e.target.value })}
          placeholder="Contact Us"
          data-testid="input-form-title"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label>Form Fields</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-add-field">
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => addField("text")}>Text Field</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("email")}>Email</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("phone")}>Phone</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("name")}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("address")}>Address</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("textarea")}>Message / Comment</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("select")}>Dropdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addField("checkbox")}>Checkbox</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addField("hidden")}>
                <EyeOff className="h-4 w-4 mr-2" />
                Hidden Field (UTM/gclid)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleFieldDragEnd}
        >
          <SortableContext
            items={fields.map((f: any) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {fields.map((field: any, index: number) => (
                <SortableFormField
                  key={field.id}
                  field={field}
                  index={index}
                  onUpdate={(updates: Record<string, any>) => updateField(index, updates)}
                  onRemove={() => removeField(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <Label htmlFor="isMultiStep">Enable Multi-Step Form</Label>
            <p className="text-xs text-muted-foreground">Split form into multiple steps</p>
          </div>
          <Switch
            id="isMultiStep"
            checked={isMultiStep}
            onCheckedChange={(checked) => {
              const updates: Record<string, any> = { ...config, isMultiStep: checked };
              if (checked && steps.length === 0) {
                updates.steps = [
                  { id: uuidv4(), title: "Step 1", description: "", fieldIds: [] },
                  { id: uuidv4(), title: "Step 2", description: "", fieldIds: [] },
                ];
              }
              onUpdate(updates);
            }}
            data-testid="switch-multi-step"
          />
        </div>

        {isMultiStep && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Form Steps</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newStep = {
                    id: uuidv4(),
                    title: `Step ${steps.length + 1}`,
                    description: "",
                    fieldIds: [],
                  };
                  onUpdate({ ...config, steps: [...steps, newStep] });
                }}
                data-testid="button-add-step"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                
                const oldIndex = steps.findIndex((s: any) => s.id === active.id);
                const newIndex = steps.findIndex((s: any) => s.id === over.id);
                
                if (oldIndex !== -1 && newIndex !== -1) {
                  const newSteps = arrayMove(steps, oldIndex, newIndex);
                  onUpdate({ ...config, steps: newSteps });
                }
              }}
            >
              <SortableContext
                items={steps.map((s: any) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {steps.map((step: any, index: number) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      index={index}
                      fields={fields}
                      allSteps={steps}
                      onUpdate={(updates: Record<string, any>) => {
                        const newSteps = [...steps];
                        newSteps[index] = { ...newSteps[index], ...updates };
                        onUpdate({ ...config, steps: newSteps });
                      }}
                      onRemove={() => {
                        const newSteps = steps.filter((_: any, i: number) => i !== index);
                        onUpdate({ ...config, steps: newSteps });
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="showProgressBar">Show Progress Bar</Label>
                <Switch
                  id="showProgressBar"
                  checked={config.showProgressBar !== false}
                  onCheckedChange={(checked) => onUpdate({ ...config, showProgressBar: checked })}
                  data-testid="switch-progress-bar"
                />
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="showStepNumbers">Show Step Numbers</Label>
                <Switch
                  id="showStepNumbers"
                  checked={config.showStepNumbers !== false}
                  onCheckedChange={(checked) => onUpdate({ ...config, showStepNumbers: checked })}
                  data-testid="switch-step-numbers"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prevButtonText">Previous Button Text</Label>
                <Input
                  id="prevButtonText"
                  value={config.prevButtonText || "Previous"}
                  onChange={(e) => onUpdate({ ...config, prevButtonText: e.target.value })}
                  placeholder="Previous"
                  data-testid="input-prev-button"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextButtonText">Next Button Text</Label>
                <Input
                  id="nextButtonText"
                  value={config.nextButtonText || "Next"}
                  onChange={(e) => onUpdate({ ...config, nextButtonText: e.target.value })}
                  placeholder="Next"
                  data-testid="input-next-button"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="submitText">Submit Button Text</Label>
        <Input
          id="submitText"
          value={config.submitText || ""}
          onChange={(e) => onUpdate({ ...config, submitText: e.target.value })}
          placeholder="Submit"
          data-testid="input-form-submit"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="successMessage">Success Message</Label>
        <Input
          id="successMessage"
          value={config.successMessage || ""}
          onChange={(e) => onUpdate({ ...config, successMessage: e.target.value })}
          placeholder="Thank you!"
          data-testid="input-form-success"
        />
      </div>

      <div className="border-t pt-4">
        <WebhookEditor
          webhooks={webhooks}
          onUpdate={(newWebhooks) => onUpdate({ ...config, webhooks: newWebhooks })}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <Label htmlFor="fireConversionEvent">Fire Pixel Event on Submit</Label>
            <p className="text-xs text-muted-foreground">Track form submissions in ad platforms</p>
          </div>
          <Switch
            id="fireConversionEvent"
            checked={config.fireConversionEvent !== false}
            onCheckedChange={(checked) => onUpdate({ ...config, fireConversionEvent: checked })}
            data-testid="switch-form-conversion"
          />
        </div>
        {config.fireConversionEvent !== false && (
          <>
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={config.conversionEvent || "Lead"}
                onValueChange={(value) => onUpdate({ ...config, conversionEvent: value })}
              >
                <SelectTrigger data-testid="select-form-event">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="CompleteRegistration">Complete Registration</SelectItem>
                  <SelectItem value="SubmitApplication">Submit Application</SelectItem>
                  <SelectItem value="Contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversionValue">Lead Value (Optional)</Label>
              <Input
                id="conversionValue"
                type="number"
                value={config.conversionValue !== undefined ? config.conversionValue : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  onUpdate({ 
                    ...config, 
                    conversionValue: value === "" ? undefined : parseFloat(value) 
                  });
                }}
                placeholder="e.g., 50"
                data-testid="input-form-value"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
