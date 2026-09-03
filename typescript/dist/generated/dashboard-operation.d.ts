export type OperationKey = string;
/**
 * Authoring-only SQL. Bind parameters use exact, case-sensitive {{parameter_name}} placeholders.
 */
export type OperationSql = string;
export type DashboardParameterDeclaration = BooleanParameter | IntegerParameter | NumberParameter | DateParameter | TimestampParameter | EnumParameter | UuidParameter | OperationValuesParameter | ArrayParameter;
export type DashboardDateValue = string;
export type DashboardTimestampValue = string;
export type DashboardEnumValue = string;
export type FieldName = string;
export type ArrayParameterItem = {
    type: "boolean";
} | {
    type: "integer";
    minimum?: number;
    maximum?: number;
} | {
    type: "number";
    minimum?: number;
    maximum?: number;
} | {
    type: "date";
} | {
    type: "timestamp";
} | {
    type: "enum";
    /**
     * @minItems 1
     */
    values: DashboardEnumValue[];
} | {
    type: "uuid";
};
/**
 * Complete authoring-only dashboard operation declaration. Viewer contracts must never expose its SQL or datasource id.
 */
export interface DashboardOperationDeclaration {
    key: OperationKey;
    datasource_id: string;
    sql: OperationSql;
    parameters: OperationParameters;
    result_schema?: OperationResultSchema;
}
/**
 * At most 64 typed bind parameters. A declaration without a default is required at execution.
 */
export interface OperationParameters {
    [k: string]: DashboardParameterDeclaration;
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
export interface OperationResultSchema {
    /**
     * @minItems 1
     * @maxItems 100
     */
    columns: OperationResultColumn[];
}
export interface OperationResultColumn {
    name: FieldName;
    type: string;
}
export type DashboardOperationPutBody = Omit<DashboardOperationDeclaration, "key">;
//# sourceMappingURL=dashboard-operation.d.ts.map