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

export const isExcelFile = (file: Express.Multer.File): boolean => {
  return file && file.mimetype === xlsxFileMimetype;
};

export const filterDuplicate = (
  array: any[],
  countStart: number = 1
): {
  value: string;
  numbers: number[];
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
    value: any;
    numbers: number[];
  }[] = [];

  for (const key in productMap) {
    if (productMap[key].length > 1) {
      result.push({
        value: key,
        numbers: productMap[key],
      });
    }
  }

  return result;
};

export const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
