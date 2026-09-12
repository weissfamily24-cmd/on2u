export type Category = 'Fränkisch' | 'Café' | 'Italienisch' | 'Bar' | 'Imbiss' | string;

export interface MenuItem { id: string; name: string; description?: string; priceCents: number; currency: 'EUR' | 'ALL'; }

export interface MenuConfirmation {
  id: string; placeId: string; by: 'owner' | 'guest'; visitId?: string;
  pricesMatch: boolean; createdAt: string; // ISO
}

export interface Place {
  id: string; name: string; category: Category; lat: number; lng: number; address: string;
  rating: number; distanceLabel?: string; caption?: string;
  menu: MenuItem[]; confirmations: MenuConfirmation[];
}

export interface Visit { id: string; placeId: string; userId: string; qrToken: string; createdAt: string; }

export interface Review {
  id: string; visitId: string; hearts: 1 | 2 | 3 | 4 | 5; tags: string[]; videoUrl?: string; createdAt: string;
}
