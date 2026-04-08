import type { Block, VisibilityCondition, AbTestVariant } from "@shared/schema";

export function getOrCreateVisitorId(): string {
  const key = "pb_visitor_id";
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
}

export function getSessionId(): string {
  const key = "pb_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function getVariantAssignment(testId: string): string | null {
  const key = `pb_ab_variant_${testId}`;
  return localStorage.getItem(key);
}

export function setVariantAssignment(testId: string, variantId: string): void {
  const key = `pb_ab_variant_${testId}`;
  localStorage.setItem(key, variantId);
}

export function getOrAssignBlockVariant(block: Block): { config: Record<string, any>; variantId: string | null; variantName: string } {
  if (!block.abTestEnabled || !block.variants || block.variants.length === 0) {
    return { config: block.config, variantId: null, variantName: "Original" };
  }

  const existingAssignment = getVariantAssignment(`block_${block.id}`);
  
  const allVariants = [
    { id: "original", name: "Original", config: block.config, trafficPercentage: 0 },
    ...block.variants,
  ];
  
  const variantSum = block.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  allVariants[0].trafficPercentage = Math.max(0, 100 - variantSum);
  
  if (existingAssignment) {
    const assigned = allVariants.find(v => v.id === existingAssignment);
    if (assigned) {
      return { config: assigned.config, variantId: assigned.id, variantName: assigned.name };
    }
  }
  
  const totalPercentage = allVariants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  const random = Math.random() * totalPercentage;
  
  let cumulative = 0;
  for (const variant of allVariants) {
    cumulative += variant.trafficPercentage;
    if (random <= cumulative) {
      setVariantAssignment(`block_${block.id}`, variant.id);
      return { config: variant.config, variantId: variant.id, variantName: variant.name };
    }
  }
  
  return { config: block.config, variantId: "original", variantName: "Original" };
}

export function evaluateBlockVisibility(block: Block): boolean {
  const rules = block.visibilityRules;
  
  if (!rules || !rules.enabled || rules.conditions.length === 0) {
    return true;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";

  const evaluateCondition = (condition: VisibilityCondition): boolean => {
    const requiresValue = !["exists", "not_exists"].includes(condition.operator);
    if (requiresValue && (!condition.value || condition.value.trim() === "")) {
      return false;
    }

    if (condition.field === "custom" && (!condition.customField || condition.customField.trim() === "")) {
      return false;
    }

    let fieldValue: string | null = null;

    switch (condition.field) {
      case "utm_source":
      case "utm_medium":
      case "utm_campaign":
      case "utm_term":
      case "utm_content":
        fieldValue = urlParams.get(condition.field);
        break;
      case "gclid":
      case "fbclid":
      case "ttclid":
        fieldValue = urlParams.get(condition.field);
        break;
      case "referrer":
        fieldValue = referrer;
        break;
      case "custom":
        fieldValue = condition.customField ? urlParams.get(condition.customField) : null;
        break;
    }

    const targetValue = (condition.value ?? "").toLowerCase();
    const actualValue = (fieldValue || "").toLowerCase();

    switch (condition.operator) {
      case "equals":
        return actualValue === targetValue;
      case "not_equals":
        return actualValue !== targetValue;
      case "contains":
        return actualValue.includes(targetValue);
      case "not_contains":
        return !actualValue.includes(targetValue);
      case "starts_with":
        return actualValue.startsWith(targetValue);
      case "exists":
        return fieldValue !== null && fieldValue !== "";
      case "not_exists":
        return fieldValue === null || fieldValue === "";
      default:
        return false;
    }
  };

  const isConditionValid = (condition: VisibilityCondition): boolean => {
    const requiresValue = !["exists", "not_exists"].includes(condition.operator);
    if (requiresValue && (!condition.value || condition.value.trim() === "")) {
      return false;
    }
    if (condition.field === "custom" && (!condition.customField || condition.customField.trim() === "")) {
      return false;
    }
    return true;
  };

  const validConditions = rules.conditions.filter(isConditionValid);
  
  if (validConditions.length === 0) {
    return true;
  }

  const conditionResults = validConditions.map(evaluateCondition);

  switch (rules.logic) {
    case "show_if_any":
      return conditionResults.some((result) => result);
    case "show_if_all":
      return conditionResults.every((result) => result);
    case "hide_if_any":
      return !conditionResults.some((result) => result);
    case "hide_if_all":
      return !conditionResults.every((result) => result);
    default:
      return true;
  }
}

export function selectVariant(variants: AbTestVariant[]): AbTestVariant {
  const totalPercentage = variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
  const random = Math.random() * totalPercentage;
  
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.trafficPercentage;
    if (random <= cumulative) {
      return variant;
    }
  }
  
  return variants[0];
}
