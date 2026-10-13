import {MangaFormat} from "../../_models/manga-format";

export interface BookInfo {
  seriesName: string;
  bookTitle: string;
  seriesFormat: MangaFormat;
  seriesId: number;
  libraryId: number;
  volumeId: number;
}
