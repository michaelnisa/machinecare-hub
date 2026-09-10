/**
 * MachineCare Inventory Domain Module
 */

export interface Part {
  id: string;
  part_number: string;
  name: string;
  unit: string;
  quantity_on_hand: number;
  quantity_reserved?: number;
  unit_cost?: number;
}
