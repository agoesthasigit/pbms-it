export type AssetPhoto = {
  id: string;
  asset_id: string;
  storage_path: string;
  file_size: number;    // byte
  sort_order: number;
  created_at: string;
  // diisi di runtime (bukan kolom db):
  signed_url?: string;
};

export const MAX_PHOTOS_PER_ASSET = 2;
