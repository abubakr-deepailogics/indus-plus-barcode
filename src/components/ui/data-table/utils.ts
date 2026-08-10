import { FilterFn } from "@tanstack/react-table";

export interface FilterItem {
  id: string; // columnId
  operator: string;
  value: string;
}

export interface CustomFilterValue {
  columnId: string;
  operator: string;
  value: string;
}

export const operators = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

export const advancedFilterFn: FilterFn<any> = (row, columnId, filterValue: CustomFilterValue) => {
  if (!filterValue) return true;
  const { operator, value } = filterValue;
  const cellValue = row.getValue(columnId);

  // Handle empty / not empty checks first (they do not require a typed value)
  if (operator === "isEmpty") {
    return cellValue === undefined || cellValue === null || cellValue === "";
  }
  if (operator === "isNotEmpty") {
    return cellValue !== undefined && cellValue !== null && cellValue !== "";
  }

  // If value is empty, don't filter out the row yet
  if (value === undefined || value === null || value === "") return true;

  const stringCellValue = String(cellValue).toLowerCase();
  const stringValue = String(value).toLowerCase();

  switch (operator) {
    case "contains":
      return stringCellValue.includes(stringValue);
    case "equals":
      return stringCellValue === stringValue;
    case "startsWith":
      return stringCellValue.startsWith(stringValue);
    case "endsWith":
      return stringCellValue.endsWith(stringValue);
    default:
      return true;
  }
};
