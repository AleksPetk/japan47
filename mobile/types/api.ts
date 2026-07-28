export type FieldErrors = Record<string, string | string[]>;

export type UserSummary = {
  id: number | null;
  display_name: string;
  profile_image_url: string | null;
};

export type Region = {
  id: number;
  name: string;
  label: string;
  description: string;
  image_url: string | null;
  display_order: number;
  average_rating: number | null;
  prefecture_count: number;
  published_place_count: number;
  prefectures?: Prefecture[];
  top_prefecture?: Prefecture | null;
  popular_places?: Place[];
};

export type Prefecture = {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  display_order: number;
  average_rating: number | null;
  published_place_count: number;
  region: Region;
  places?: Place[];
};

export type GalleryImage = {
  id: number;
  image_url: string;
  thumbnail_url: string | null;
  caption: string;
  display_order: number;
};

export type Review = {
  id: number;
  place_id: number;
  place_name: string;
  place_slug: string;
  prefecture_name: string;
  author: UserSummary;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  helpful_count: number;
  is_helpful: boolean;
};

export type ModerationRevision = {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string;
  prefecture: Prefecture;
  name: string;
  description: string;
  image_url: string | null;
  city: string;
  google_maps_url: string;
  official_website: string;
  travel_tips: string;
  best_season: string;
  latitude: string | number | null;
  longitude: string | number | null;
  gallery_images: GalleryImage[];
};

export type DeletionRequest = {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
};

export type Place = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  city: string;
  best_season: 'spring' | 'summer' | 'autumn' | 'winter' | 'year_round';
  status: 'pending' | 'published' | 'rejected';
  is_platform_managed: boolean;
  created_at: string;
  updated_at: string;
  average_rating: number | null;
  review_count: number;
  prefecture: Prefecture;
  author: UserSummary;
  can_edit: boolean;
  is_favorite: boolean;
  is_visited: boolean;
  google_maps_url?: string;
  official_website?: string;
  travel_tips?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  gallery_images?: GalleryImage[];
  reviews?: Review[];
  related_places?: Place[];
  nearby_places?: Place[];
  rating_distribution?: Record<string, number>;
  latest_revision?: ModerationRevision | null;
  deletion_request?: DeletionRequest | null;
};

export type BadgeProgress = {
  name: string;
  filename: string;
  minimum_points?: number;
  progress_percent?: number;
  next_name?: string | null;
  points_until_next?: number;
};

export type Profile = {
  id: number;
  username?: string;
  email?: string;
  email_verified?: boolean;
  nickname: string;
  display_name: string;
  profile_image_url: string | null;
  joined_at: string;
  stats: {
    points: number;
    published_place_count: number;
    review_count: number;
    favorite_count?: number;
    visited_count?: number;
    prefectures_visited?: number;
    prefecture_coverage_percent?: number;
    badge: BadgeProgress;
  };
  places: Place[];
  reviews: Review[];
  is_owner: boolean;
  follower_count: number;
  following_count: number;
  is_following: boolean;
  favorites: Place[];
  recent_activity: { type: 'place' | 'review'; label: string; date: string }[];
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  page?: number;
  pages?: number;
};

export type HomeData = {
  stats: { regions: number; prefectures: number; places: number; contributors: number };
  latest_places: Place[];
  top_places: Place[];
  top_prefectures: Prefecture[];
  top_regions: Region[];
  top_contributors: (UserSummary & { stats: { points: number; badge: BadgeProgress } })[];
};

export type Favorite = { id: number; place: Place; created_at: string };
export type VisitedPlace = { id: number; place: Place; visited_on: string | null; notes: string; created_at: string };
export type Collection = { id: number; name: string; description: string; is_public: boolean; places: Place[]; created_at: string; updated_at: string };
export type ItineraryStop = { id: number; place: Place; day: number; position: number; notes: string };
export type Itinerary = { id: number; name: string; start_date: string | null; is_public: boolean; stops: ItineraryStop[]; created_at: string; updated_at: string };
