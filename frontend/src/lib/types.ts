/** Shapes returned by the public houseboat endpoints. Keep in sync with
 *  backend HouseboatsService selects until we extract a shared package. */

export interface HouseboatListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string | null;
  createdAt: string;
  routes: { route: { name: string; region: string | null } }[];
  _count: { reviews: number };
}

export interface CabinDetail {
  id: string;
  name: string;
  gridRow: number | null;
  gridCol: number | null;
  category: {
    name: string;
    isAc: boolean;
    baseCapacity: number;
    facilities: string | null;
  };
}

export interface DeckDetail {
  id: string;
  name: string;
  position: number;
  cabins: CabinDetail[];
}

export interface HouseboatDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  safetyFeatures: string | null;
  foodMenu: string | null;
  childPolicy: unknown;
  decks: DeckDetail[];
  routes: { route: { name: string; region: string | null } }[];
}
