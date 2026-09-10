/**
 * MachineCare Platform - Reusable Custom Fields Renderer
 * Renders configurable custom fields defined for any entity without hardcoding columns.
 */

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface CustomFieldDefinition {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required?: boolean;
  options?: string[];
}

interface CustomFieldsRendererProps {
  fields: CustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  disabled?: boolean;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
}) => {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        Custom Fields
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => {
          const val = values[f.field_key] ?? "";
          if (f.field_type === "boolean") {
            return (
              <div key={f.id} className="flex items-center space-x-2">
                <Switch
                  id={f.field_key}
                  checked={Boolean(val)}
                  onCheckedChange={(checked) => onChange(f.field_key, checked)}
                  disabled={disabled}
                />
                <Label htmlFor={f.field_key}>{f.field_label}</Label>
              </div>
            );
          }

          return (
            <div key={f.id} className="space-y-1">
              <Label htmlFor={f.field_key}>
                {f.field_label} {f.is_required && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id={f.field_key}
                type={f.field_type === "number" || f.field_type === "decimal" ? "number" : "text"}
                value={val}
                onChange={(e) => onChange(f.field_key, e.target.value)}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
