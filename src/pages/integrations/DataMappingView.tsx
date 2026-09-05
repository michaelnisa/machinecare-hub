import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sliders, Play, Plus, Trash2, ArrowRight, CheckCircle2, RotateCw } from "lucide-react";
import { integrationsService } from "@/services/integrationsService";
import type { FieldMappingRule, TransformType } from "@/types/integrations";
import { toast } from "sonner";

export function DataMappingView() {
  const [selectedEntity, setSelectedEntity] = useState<string>("part");
  const [selectedERP, setSelectedERP] = useState<string>("odoo");

  // Editable rules state
  const [rules, setRules] = useState<FieldMappingRule[]>([
    { source_field: "default_code", target_field: "part_number", transform_type: "direct", is_required: true },
    { source_field: "name", target_field: "name", transform_type: "direct", is_required: true },
    { source_field: "qty_available", target_field: "available_quantity", transform_type: "direct", default_value: 0 },
    { source_field: "uom_name", target_field: "unit", transform_type: "direct", default_value: "PCS" },
    { source_field: "standard_price", target_field: "unit_cost", transform_type: "direct", default_value: 0 },
    {
      source_field: "status_text",
      target_field: "status",
      transform_type: "enum_map",
      transform_config: { mapping: { "available": "active", "draft": "pending" } }
    },
  ]);

  // Sample data for preview (Section 16)
  const [sourceSampleJson, setSourceSampleJson] = useState<string>(
    JSON.stringify(
      {
        default_code: "P-001",
        name: "Cat Oil Filter 1R-0716",
        qty_available: 24,
        uom_name: "PCS",
        standard_price: 45000,
        status_text: "available",
      },
      null,
      2
    )
  );

  const [transformedResult, setTransformedResult] = useState<Record<string, any> | null>(null);

  const handleTestMapping = () => {
    try {
      const parsedSource = JSON.parse(sourceSampleJson);
      const result = integrationsService.testMappingPreview(parsedSource, rules);
      setTransformedResult(result);
      toast.success("Mapping transformation evaluated successfully!");
    } catch (e: any) {
      toast.error(`Invalid JSON source data: ${e.message}`);
    }
  };

  const handleAddRule = () => {
    setRules([
      ...rules,
      { source_field: "", target_field: "", transform_type: "direct", is_required: false }
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, idx) => idx !== index));
  };

  const handleUpdateRule = (index: number, key: keyof FieldMappingRule, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [key]: value };
    setRules(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Field Mapping & Data Transformation Engine</h2>
          <p className="text-xs text-muted-foreground">
            Map external ERP fields to standard MachineCare Canonical attributes without altering core code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedERP} onValueChange={setSelectedERP}>
            <SelectTrigger className="w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="odoo">Odoo JSON-2</SelectItem>
              <SelectItem value="sap_business_one">SAP Business One</SelectItem>
              <SelectItem value="dynamics_365">Microsoft Dynamics 365</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger className="w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asset">Asset (Equipment)</SelectItem>
              <SelectItem value="part">Part & Spares</SelectItem>
              <SelectItem value="inventory">Inventory Quantities</SelectItem>
              <SelectItem value="production_order">Production Order</SelectItem>
              <SelectItem value="purchase_request">Purchase Request</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Mapping Rules Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Active Rules: {selectedEntity.toUpperCase()}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Transform rules applied on each incoming record during ingestion.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleAddRule} className="text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Rule
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="grid grid-cols-12 gap-2 p-2.5 bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase">
                  <div className="col-span-4">Source ERP Field</div>
                  <div className="col-span-1 text-center">→</div>
                  <div className="col-span-4">Canonical Field</div>
                  <div className="col-span-2">Transform Type</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {rules.map((rule, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-2.5 items-center text-xs">
                    <div className="col-span-4">
                      <Input
                        value={rule.source_field}
                        onChange={(e) => handleUpdateRule(idx, "source_field", e.target.value)}
                        placeholder="e.g. default_code"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-1 text-center text-muted-foreground">
                      <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                    </div>
                    <div className="col-span-4">
                      <Input
                        value={rule.target_field}
                        onChange={(e) => handleUpdateRule(idx, "target_field", e.target.value)}
                        placeholder="e.g. part_number"
                        className="h-8 text-xs font-mono text-primary font-semibold"
                      />
                    </div>
                    <div className="col-span-2">
                      <Select
                        value={rule.transform_type}
                        onValueChange={(val: TransformType) => handleUpdateRule(idx, "transform_type", val)}
                      >
                        <SelectTrigger className="h-8 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="rename">Rename</SelectItem>
                          <SelectItem value="enum_map">Enum Map</SelectItem>
                          <SelectItem value="unit_convert">Unit Convert</SelectItem>
                          <SelectItem value="constant">Constant</SelectItem>
                          <SelectItem value="formula">Formula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRule(idx)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview (Section 16) (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Play className="h-4 w-4 text-emerald-500" /> Interactive Data Preview
                </CardTitle>
                <Button size="sm" onClick={handleTestMapping} className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Play className="h-3 w-3" /> Test Mapping
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Source Record (ERP Format)</span>
                  <Badge variant="outline" className="text-[10px] font-mono">Input JSON</Badge>
                </div>
                <textarea
                  value={sourceSampleJson}
                  onChange={(e) => setSourceSampleJson(e.target.value)}
                  rows={7}
                  className="w-full text-xs font-mono p-2.5 rounded bg-muted/20 border border-border resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="text-center text-muted-foreground text-xs">
                ↓ Evaluated against {rules.length} Mapping Rules ↓
              </div>

              <div>
                <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Canonical Model (MachineCare)</span>
                  <Badge className="bg-primary/10 text-primary text-[10px] font-mono">Standardized Output</Badge>
                </div>
                <div className="w-full min-h-[140px] text-xs font-mono p-2.5 rounded bg-background border border-border overflow-x-auto">
                  {transformedResult ? (
                    <pre className="text-emerald-600 dark:text-emerald-400">
                      {JSON.stringify(transformedResult, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Click "Test Mapping" above to preview transformed canonical JSON...
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default DataMappingView;
