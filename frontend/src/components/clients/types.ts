export type Client = {
  id: number;
  name: string;
  phone: string;
  type?: string;
  notes: string | null;
  is_active: boolean;
  can_delete?: boolean;
  created_at?: string;
};

export type ClientCreatePayload = {
  name: string;
  phone: string;
  type: string;
  notes: string | null;
  is_active: boolean;
};

export type ClientUpdatePayload = ClientCreatePayload;
