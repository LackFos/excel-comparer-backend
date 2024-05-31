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

export const filterDuplicate = (
  array: any[],
  countStart: number = 1
): {
  column: string;
  rowNumbers: number[];
}[] => {
  const productMap: { [key: string]: number[] } = {};

  array.forEach((value, index) => {
    const rowIndex = index + countStart;

    if (productMap[value]) {
      productMap[value].push(rowIndex);
    } else {
      productMap[value] = [rowIndex];
    }
  });

  const result: {
    column: any;
    rowNumbers: number[];
  }[] = [];

  for (const key in productMap) {
    if (productMap[key].length > 1) {
      result.push({
        column: key,
        rowNumbers: productMap[key],
      });
    }
  }

  return result;
};
