export const validateRequest = (
  schema: any,
  values: any,
  options = {
    abortEarly: false,
    stripUnknown: true,
  }
) => {
  return schema.validate(values, options);
};

export const isExcelFile = (file: Express.Multer.File): boolean => {
  return file && file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
};

export const filterDuplicate = (
  values: any[],
  startCount: number = 1
): { value: string; rowNumbers: number[] }[] => {
  const result: { value: string; rowNumbers: number[] }[] = [];
  const duplicates: Map<string, number[]> = new Map();

  values.forEach((value, index) => {
    const rowIndex = index + startCount;
    const existingRowNumbers = duplicates.get(value) || [];
    duplicates.set(value, [...existingRowNumbers, rowIndex]);
  });

  duplicates.forEach((rowNumbers, value) => {
    if (rowNumbers.length > 1) {
      result.push({ value, rowNumbers });
    }
  });

  return result;
};

export const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
