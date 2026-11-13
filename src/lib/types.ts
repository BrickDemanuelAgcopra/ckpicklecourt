export type HeroFact = { icon: "calendar" | "grid" | "pin" | "clock"; text: string };
export type TitledText = { id: string; title: string; text: string };
export type Faq = { q: string; a: string };

export type PaymentAccount = { bankName: string; accountName: string; accountNumber: string; qrUrl: string };

export type SiteConfig = {
  courtName: string;
  tagline: string;
  logoUrl: string;
  currencySymbol: string;
  locationText: string;
  mapsUrl: string;
  contactNumber: string;
  emailAddress: string;
  facebookPage: string;
  openingHoursText: string;
  slotMinutes: number;
  bookingWindowDays: number;
  bookingFee: number;
  bookingFeePerHour: boolean;
  paymentWindowMinutes: number;
  partialPaymentEnabled: boolean;
  partialPaymentPercent: number;
  emailSendingEnabled: boolean;
  adminEmail: string;
  payment: PaymentAccount;
  /** Optional second wallet shown as a tab at checkout (e.g. Maya). Hidden when it has no QR. */
  paymentAlt?: PaymentAccount;
  /** Optional third wallet tab (e.g. GoTyme). Hidden when it has no QR. */
  paymentAlt2?: PaymentAccount;
  gallery: string[];
  heroFacts: HeroFact[];
  courtDetails: TitledText[];
  policies: TitledText[];
  faqs: Faq[];
  /** Short reminders shown beside the booking summary. */
  quickRules?: string[];
  motto?: string;
  slotColors: Record<string, { background?: string; text?: string }>;
  showRateSeparators: boolean;
};

export type Court = { id: number; name: string; kind: string; available: boolean; sort: number };
export type RateBand = { id: number; name: string; start_hour: number; end_hour: number; price: number; days: number[]; sort: number };
export type Equipment = { id: number; slug: string; name: string; unit: string; price: number; inventory_total: number; active: boolean };

export type SlotStatus = "open" | "booked" | "pending" | "passed" | "closed" | "open_play" | "promo" | "unavailable";

export type GridCell = {
  courtId: number;
  hour: number;
  status: SlotStatus;
  price: number;
  label?: string; // e.g. initials for booked
  /** Open Play session covering this cell. */
  sessionId?: number;
};

/** What a guest needs to see before joining an Open Play session. */
export type OpenPlayPublic = {
  id: number;
  courtId: number;
  courtName: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  pricePerPlayer: number;
  capacity: number;
  joined: number;
  note: string | null;
};

export type GridBand = { id: number; name: string; startHour: number; endHour: number; price: number; hours: number[] };

export type DayGrid = {
  date: string; // YYYY-MM-DD
  courts: Court[];
  bands: GridBand[];
  cells: GridCell[];
  openPlay: OpenPlayPublic[];
};

export type BookingStatus =
  | "awaiting_payment"
  | "pending"
  | "confirmed"
  | "balance_due"
  | "declined"
  | "cancelled"
  | "expired";

export type BookingRow = {
  id: string;
  confirmation_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string;
  status: BookingStatus;
  subtotal: string;
  equipment_total: string;
  booking_fee: string;
  total: string;
  partial_payment: boolean;
  partial_percent: number | null;
  receipt_path: string | null;
  admin_note: string | null;
  hold_expires_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  source: "online" | "admin";
  open_play_session_id: number | null;
  players: number | null;
  created_at: string;
};

/** The session an Open Play booking joined. */
export type BookingOpenPlay = { session_id: number; court_name: string; date: string; start_hour: number; end_hour: number; price_per_player: string; players: number };

export type BookingSlotRow = { court_id: number; court_name: string; date: string; hour: number; price: string };
export type BookingEquipmentRow = { equipment_id: number; name: string; unit: string; qty: number; unit_price: string };

export type PaymentMethod = "gcash" | "maya" | "gotyme" | "cash" | "bank" | "other";
export type PaymentRow = { id: number; amount: string; method: PaymentMethod; reference: string | null; note: string | null; received_at: string; recorded_by: string };

export type BookingDetail = BookingRow & { slots: BookingSlotRow[]; equipment: BookingEquipmentRow[]; payments: PaymentRow[]; paid: number; open_play: BookingOpenPlay | null };
