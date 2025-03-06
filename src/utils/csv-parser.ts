import stream from 'stream';
import csv from 'csv-parser';

type DataObject = {
  [key: string]: string;
};

const transformKeys = (obj: DataObject): DataObject => {
  const result: DataObject = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let tempKey = key.toLowerCase();
      const snakeCaseKey = tempKey
        .replace(/[.\s-]/g, '_')
        .replace(/_+$/g, '');
      result[snakeCaseKey] = obj[key];
    }
  }

  return result;
};

export default function (buffer: Buffer): Promise<DataObject[]> {
  return new Promise((resolve, reject) => {
    const results: DataObject[] = [];
    const readableStream = new stream.Readable();

    readableStream.push(buffer);
    readableStream.push(null);

    readableStream
      .pipe(csv())
      .on('data', (data) => {
        const transformedData = transformKeys(data);
        results.push(transformedData);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}
