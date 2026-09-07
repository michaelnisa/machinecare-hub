import { EventRule, ConnectedEvent } from "@/types/connected-data";

/**
 * PHASE 5: VISUAL RULE BUILDER & EVENTS EVALUATION ENGINE
 * Evaluates real-time telemetry points against condition rules and triggers automated actions.
 */

export interface RuleEvaluationResult {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  severity: "INFO" | "WARNING" | "CRITICAL";
  parameter_key: string;
  current_value: number;
  threshold_value: number;
  operator: string;
  message: string;
  dispatched_actions: string[];
}

export class RuleEngine {
  /**
   * Evaluates whether a telemetry parameter value breaches a specific rule condition
   */
  public static evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case ">":
        return value > threshold;
      case ">=":
        return value >= threshold;
      case "<":
        return value < threshold;
      case "<=":
        return value <= threshold;
      case "==":
      case "=":
        return value === threshold;
      case "!=":
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Evaluates a single rule against a parameter value and returns simulation / execution result
   */
  public static evaluateRule(
    rule: EventRule,
    currentValue: number,
    assetName = "CAT 6040 Mining Shovel"
  ): RuleEvaluationResult {
    const isTriggered = this.evaluateCondition(currentValue, rule.operator, rule.threshold);
    const actions: string[] = [];

    if (isTriggered) {
      if (rule.actions.create_event) actions.push("Create In-App Event");
      if (rule.actions.send_notification) actions.push("Push Notification Dispatch");
      if (rule.actions.send_email) actions.push("Email Alert Sent");
      if (rule.actions.trigger_webhook) actions.push(`Webhook POST to Endpoint`);
      if (rule.actions.create_work_order) actions.push("Auto-Generate Maintenance Work Order");
    }

    const severity =
      rule.threshold > 100 || rule.operator === ">" && currentValue >= rule.threshold * 1.1
        ? "CRITICAL"
        : "WARNING";

    return {
      rule_id: rule.id,
      rule_name: rule.name,
      triggered: isTriggered,
      severity: severity as "INFO" | "WARNING" | "CRITICAL",
      parameter_key: rule.parameter_key,
      current_value: currentValue,
      threshold_value: rule.threshold,
      operator: rule.operator,
      message: isTriggered
        ? `Rule "${rule.name}" triggered: ${rule.parameter_key} is ${currentValue} ${rule.unit} (${rule.operator} ${rule.threshold} ${rule.unit}) on ${assetName}`
        : `Normal: ${rule.parameter_key} (${currentValue} ${rule.unit}) does not breach threshold (${rule.operator} ${rule.threshold} ${rule.unit})`,
      dispatched_actions: actions,
    };
  }

  /**
   * Generates a new ConnectedEvent from a triggered rule
   */
  public static createEventFromRule(
    rule: EventRule,
    currentValue: number,
    assetId: string,
    assetName: string
  ): ConnectedEvent {
    const evalRes = this.evaluateRule(rule, currentValue, assetName);

    return {
      id: `evt-${Date.now()}`,
      asset_id: assetId,
      asset_name: assetName,
      event_code: `EVT-${rule.parameter_key.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      rule_id: rule.id,
      severity: evalRes.severity,
      parameter_key: rule.parameter_key,
      triggered_value: currentValue,
      threshold_value: rule.threshold,
      description: evalRes.message,
      status: "ACTIVE",
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
}
