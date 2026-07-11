export type NetworkCredential = {
  id: string;
  client_id: string;
  ssid: string;
  username: string | null;
  device_name: string | null;
  ip_address: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  has_wifi_password: boolean;   // password SSID/WiFi
  has_password: boolean;        // password perangkat/router
  company_name?: string;
};

export type CctvSystem = {
  id: string;
  client_id: string;
  nvr_brand: string;
  channel_count: number;
  username: string | null;
  ip_address: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  has_password: boolean;
  company_name?: string;
};
