import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Eye } from "lucide-react";
import type { Block, VisibilityCondition, VisibilityRules } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

const FIELD_OPTIONS = [
  { value: "utm_source", label: "UTM Source" },
  { value: "utm_medium", label: "UTM Medium" },
  { value: "utm_campaign", label: "UTM Campaign" },
  { value: "utm_term", label: "UTM Term" },
  { value: "utm_content", label: "UTM Content" },
  { value: "gclid", label: "Google Click ID" },
  { value: "fbclid", label: "Facebook Click ID" },
  { value: "ttclid", label: "TikTok Click ID" },
  { value: "referrer", label: "Referrer URL" },
  { value: "custom", label: "Custom Parameter" },
];

const OPERATOR_OPTIONS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "exists", label: "exists (any value)" },
  { value: "not_exists", label: "does not exist" },
];

const LOGIC_OPTIONS = [
  { value: "show_if_any", label: "Show if ANY condition matches" },
  { value: "show_if_all", label: "Show if ALL conditions match" },
  { value: "hide_if_any", label: "Hide if ANY condition matches" },
  { value: "hide_if_all", label: "Hide if ALL conditions match" },
];

export function VisibilityPanel({
  block,
  onUpdateBlock,
}: {
  block: Block;
  onUpdateBlock?: (block: Block) => void;
}) {
  const rules: VisibilityRules = block.visibilityRules || {
    enabled: false,
    logic: "show_if_any",
    conditions: [],
  };

  const handleToggleEnabled = (enabled: boolean) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: { ...rules, enabled },
    });
  };

  const handleLogicChange = (logic: string) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: { ...rules, logic: logic as VisibilityRules["logic"] },
    });
  };

  const handleAddCondition = () => {
    if (!onUpdateBlock) return;
    const newCondition: VisibilityCondition = {
      id: uuidv4(),
      field: "utm_source",
      operator: "equals",
      value: "",
    };
    onUpdateBlock({
      ...block,
      visibilityRules: {
        ...rules,
        conditions: [...rules.conditions, newCondition],
      },
    });
  };

  const handleRemoveCondition = (conditionId: string) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: {
        ...rules,
        conditions: rules.conditions.filter((c) => c.id !== conditionId),
      },
    });
  };

  const handleUpdateCondition = (conditionId: string, updates: Partial<VisibilityCondition>) => {
    if (!onUpdateBlock) return;
    onUpdateBlock({
      ...block,
      visibilityRules: {
        ...rules,
        conditions: rules.conditions.map((c) =>
          c.id === conditionId ? { ...c, ...updates } : c
        ),
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Conditional Visibility</h3>
              <p className="text-sm text-muted-foreground">
                Show or hide based on URL parameters
              </p>
            </div>
          </div>
          <Switch
            checked={rules.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={!onUpdateBlock}
            data-testid="switch-visibility-enabled"
          />
        </div>
      </Card>

      {rules.enabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Display Logic</Label>
            <Select value={rules.logic} onValueChange={handleLogicChange}>
              <SelectTrigger data-testid="select-visibility-logic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGIC_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Conditions</Label>
            {rules.conditions.map((condition) => (
              <Card key={condition.id} className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      handleUpdateCondition(condition.id, { field: value as VisibilityCondition["field"] })
                    }
                  >
                    <SelectTrigger className="flex-1" data-testid={`select-field-${condition.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCondition(condition.id)}
                    data-testid={`button-remove-condition-${condition.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {condition.field === "custom" && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Parameter name (e.g., offer)"
                      value={condition.customField || ""}
                      onChange={(e) =>
                        handleUpdateCondition(condition.id, { customField: e.target.value })
                      }
                      className={!condition.customField?.trim() ? "border-destructive" : ""}
                      data-testid={`input-custom-field-${condition.id}`}
                    />
                    {!condition.customField?.trim() && (
                      <p className="text-xs text-destructive">Parameter name is required</p>
                    )}
                  </div>
                )}

                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    handleUpdateCondition(condition.id, { operator: value as VisibilityCondition["operator"] })
                  }
                >
                  <SelectTrigger data-testid={`select-operator-${condition.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {condition.operator !== "exists" && condition.operator !== "not_exists" && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Value to match (e.g., facebook, meta)"
                      value={condition.value}
                      onChange={(e) =>
                        handleUpdateCondition(condition.id, { value: e.target.value })
                      }
                      className={!condition.value.trim() ? "border-destructive" : ""}
                      data-testid={`input-value-${condition.id}`}
                    />
                    {!condition.value.trim() && (
                      <p className="text-xs text-destructive">Value is required</p>
                    )}
                  </div>
                )}
              </Card>
            ))}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleAddCondition}
              data-testid="button-add-condition"
            >
              <Plus className="h-4 w-4" />
              Add Condition
            </Button>
          </div>

          {rules.conditions.length > 0 && (
            <>
              {(() => {
                const invalidCount = rules.conditions.filter((c) => {
                  const requiresValue = !["exists", "not_exists"].includes(c.operator);
                  if (requiresValue && (!c.value || c.value.trim() === "")) return true;
                  if (c.field === "custom" && (!c.customField || c.customField.trim() === "")) return true;
                  return false;
                }).length;
                
                if (invalidCount > 0) {
                  return (
                    <Card className="p-3 bg-destructive/10 border-destructive">
                      <p className="text-sm text-destructive">
                        <strong>Warning:</strong> {invalidCount} condition{invalidCount > 1 ? 's' : ''} {invalidCount > 1 ? 'are' : 'is'} incomplete and will be ignored.
                        Fill in all required values for visibility rules to work.
                      </p>
                    </Card>
                  );
                }
                return null;
              })()}
              <Card className="p-3 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Preview tip:</strong> Add query params to preview URL to test visibility
                  (e.g., ?utm_source=facebook)
                </p>
              </Card>
            </>
          )}
        </div>
      )}

      {!onUpdateBlock && (
        <p className="text-sm text-muted-foreground text-center">
          Visibility controls require saving the page first
        </p>
      )}
    </div>
  );
}
