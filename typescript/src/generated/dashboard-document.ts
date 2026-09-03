// Generated from gluonDB/gluondb_front@5e05307bb90cb07f71a250cf17c1429d41d8f28a. Do not edit.

export type DashboardParameterDeclaration =
  | BooleanParameter
  | IntegerParameter
  | NumberParameter
  | DateParameter
  | TimestampParameter
  | EnumParameter
  | UuidParameter
  | OperationValuesParameter
  | ArrayParameter;
export type DashboardDateValue = string;
export type DashboardTimestampValue = string;
export type DashboardEnumValue = string;
export type OperationKey = string;
export type FieldName = string;
export type ArrayParameterItem =
  | {
      type: "boolean";
    }
  | {
      type: "integer";
      minimum?: number;
      maximum?: number;
    }
  | {
      type: "number";
      minimum?: number;
      maximum?: number;
    }
  | {
      type: "date";
    }
  | {
      type: "timestamp";
    }
  | {
      type: "enum";
      /**
       * @minItems 1
       */
      values: DashboardEnumValue[];
    }
  | {
      type: "uuid";
    };
export type DashboardBlock =
  | MetricBlock
  | TableBlock
  | LineChartBlock
  | BarChartBlock
  | AreaChartBlock
  | PieChartBlock
  | JsonViewerBlock
  | TextBlock
  | DividerBlock
  | SpacerBlock
  | FilterControlBlock;
export type BlockId = string;
export type DisplayText = string;
export type ParameterName = string;

/**
 * GluonDB dashboard document, schema version 1.
 */
export interface DashboardDocumentV1 {
  schema_version: 1;
  theme: "light" | "dark" | "system";
  parameters: {
    [k: string]: DashboardParameterDeclaration;
  };
  layout: DashboardLayout;
  blocks: DashboardBlock[];
}
export interface BooleanParameter {
  type: "boolean";
  default?: boolean;
}
export interface IntegerParameter {
  type: "integer";
  minimum?: number;
  maximum?: number;
  default?: number;
}
export interface NumberParameter {
  type: "number";
  minimum?: number;
  maximum?: number;
  default?: number;
}
export interface DateParameter {
  type: "date";
  default?: DashboardDateValue;
}
export interface TimestampParameter {
  type: "timestamp";
  default?: DashboardTimestampValue;
}
export interface EnumParameter {
  type: "enum";
  /**
   * @minItems 1
   */
  values: DashboardEnumValue[];
  default?: DashboardEnumValue;
}
export interface UuidParameter {
  type: "uuid";
  default?: string;
}
/**
 * A string parameter whose legal values come from a bounded options operation.
 */
export interface OperationValuesParameter {
  type: "operation_values";
  options_operation: OperationKey;
  mapping: OperationValuesMapping;
}
/**
 * `value` selects the accepted string; `label_fields` are joined in order with `separator`, defaulting to " · ".
 */
export interface OperationValuesMapping {
  value: FieldName;
  /**
   * @minItems 1
   * @maxItems 4
   */
  label_fields: FieldName[];
  separator?: string;
}
export interface ArrayParameter {
  type: "array";
  items: ArrayParameterItem;
  min_items?: number;
  max_items: number;
  default?: (boolean | number | string)[];
}
export interface DashboardLayout {
  type: "grid";
  columns: 12;
  gap: number;
}
export interface MetricBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "metric";
  mapping: MetricMapping;
}
export interface BlockPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface MetricMapping {
  value: FieldName;
  label?: FieldName;
  trend?: FieldName;
}
export interface TableBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "table";
  mapping: TableMapping;
}
export interface TableMapping {
  /**
   * @minItems 1
   * @maxItems 100
   */
  columns: TableColumnMapping[];
}
export interface TableColumnMapping {
  field: FieldName;
  label?: DisplayText;
}
export interface LineChartBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "line_chart";
  mapping: CartesianMapping;
}
export interface CartesianMapping {
  x: FieldName;
  /**
   * @minItems 1
   * @maxItems 20
   */
  y: FieldName[];
  series?: FieldName;
}
export interface BarChartBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "bar_chart";
  mapping: CartesianMapping;
}
export interface AreaChartBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "area_chart";
  mapping: CartesianMapping;
}
export interface PieChartBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "pie_chart";
  variant: "pie" | "donut";
  mapping: PieMapping;
}
export interface PieMapping {
  label: FieldName;
  value: FieldName;
}
export interface JsonViewerBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  operation: OperationKey;
  type: "json_viewer";
  mapping: JsonViewerMapping;
}
/**
 * Selects an optional field from the first result row; omission displays the whole row.
 */
export interface JsonViewerMapping {
  field?: FieldName;
}
export interface TextBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  type: "text";
  format: "plain" | "markdown";
  content: string;
}
export interface DividerBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  type: "divider";
  style?: "solid" | "dashed" | "dotted";
}
export interface SpacerBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  type: "spacer";
}
export interface FilterControlBlock {
  id: BlockId;
  position: BlockPosition;
  title?: DisplayText;
  type: "filter_control";
  parameter: ParameterName;
  control: "auto" | "select" | "multi_select" | "date" | "date_range" | "toggle" | "number";
}
