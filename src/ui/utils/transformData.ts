import type { WindData } from "../api/client";

export interface TableResult {
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export function transformWindData(raw: WindData): TableResult {
  const { codes, fields, times, data } = raw;

  const numCodes  = codes?.length  ?? 0;
  const numFields = fields?.length ?? 0;
  const numTimes  = times?.length  ?? 0;

  // tdays: only times[], no codes/fields
  if (numTimes > 0 && numFields === 0 && numCodes === 0) {
    return {
      columns: ["date"],
      rows: times.map((t) => ({ date: t })),
    };
  }

  // wset / wss / wsq: no time axis, rows = codes
  if (numTimes <= 1 && numCodes > 0 && numFields > 0) {
    const columns = ["code", ...fields.map((f) => f.toLowerCase())];
    const rows = codes.map((code, ci) => {
      const row: Record<string, string | number | null> = { code };
      fields.forEach((field, fi) => {
        row[field.toLowerCase()] = data[fi]?.[ci] ?? null;
      });
      return row;
    });
    return { columns, rows };
  }

  // wsd / edb single code: rows = times
  if (numCodes === 1 && numTimes > 0 && numFields > 0) {
    const columns = ["date", ...fields.map((f) => f.toLowerCase())];
    const rows = times.map((time, ti) => {
      const row: Record<string, string | number | null> = { date: time };
      fields.forEach((field, fi) => {
        row[field.toLowerCase()] = data[fi]?.[ti] ?? null;
      });
      return row;
    });
    return { columns, rows };
  }

  // wsd multi-code: rows = times, columns = field_code pairs
  // WindPy interleaving: data[fi][ti * numCodes + ci]
  if (numCodes > 1 && numTimes > 0 && numFields > 0) {
    const columns = ["date"];
    fields.forEach((field) =>
      codes.forEach((code) => columns.push(`${field.toLowerCase()}_${code}`))
    );
    const rows = times.map((time, ti) => {
      const row: Record<string, string | number | null> = { date: time };
      fields.forEach((field, fi) => {
        codes.forEach((code, ci) => {
          const colKey = `${field.toLowerCase()}_${code}`;
          row[colKey] = data[fi]?.[ti * numCodes + ci] ?? null;
        });
      });
      return row;
    });
    return { columns, rows };
  }

  return { columns: [], rows: [] };
}
