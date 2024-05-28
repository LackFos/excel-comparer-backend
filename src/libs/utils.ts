import { xlsxFileMimetype } from "./const";

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

export const checkExcelValidity = (file: Express.Multer.File): boolean => {
  return file.mimetype === xlsxFileMimetype;
};

export const filterDuplicate = (array: any[], countStart: number = 1): Map<string, number[]> => {
  const productMap: Map<string, number[]> = new Map();

  array.forEach((value, index) => {
    const rowCounts = productMap.get(value);
    if (rowCounts) {
      rowCounts.push(countStart + index);
    } else {
      productMap.set(value, [index + countStart]);
    }
  });

  for (const [key, value] of productMap) {
    if (value.length <= 1) {
      productMap.delete(key);
    }
  }

  return productMap;
};
