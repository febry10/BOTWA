declare module 'node-webpmux' {
  export class Image {
    exif: Buffer | null;
    load(source: Buffer | string): Promise<void>;
    save(path: string | null): Promise<Buffer>;
  }
  const webpmux: { Image: typeof Image };
  export default webpmux;
}
