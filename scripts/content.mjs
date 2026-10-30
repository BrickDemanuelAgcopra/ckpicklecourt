// Club copy shared by seed.mjs (fresh installs) and update-content.mjs (pushes it to a live DB).
// Policy text: lines starting with "• " render as bullets on the site.

export const LOCATION = "Purok 4, South Poblacion, Medina, Misamis Oriental (near Grace Christian School)";
export const MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Grace+Christian+School+South+Poblacion+Medina+Misamis+Oriental";
export const FACEBOOK = "https://www.facebook.com/share/19mDvhXA7J/";

export const COURTS = [
  { name: "Court 1", kind: "outdoor", sort: 1 },
  { name: "Court 2", kind: "outdoor", sort: 2 },
];

export const RATE_BANDS = [
  { name: "Daytime", start_hour: 8, end_hour: 16, price: 150, sort: 1 },
  { name: "Nighttime", start_hour: 16, end_hour: 23, price: 200, sort: 2 },
];

export const content = {
  locationText: LOCATION,
  mapsUrl: MAPS_URL,
  facebookPage: FACEBOOK,
  openingHoursText: "Open 8:00 AM - 11:00 PM daily",
  heroFacts: [
    { icon: "calendar", text: "Open daily, 8:00 AM - 11:00 PM" },
    { icon: "grid", text: "" },
    { icon: "pin", text: "" },
  ],
  motto: "Play hard. Play fair. Clean as you go. Respect the court.",
  quickRules: [
    "Pay before you play",
    "10-minute grace period, then the slot goes to walk-ins",
    "Cancel at least 3 hours ahead",
    "Non-marking court shoes only",
    "Clean as you go",
  ],
  courtDetails: [
    { id: "courts", title: "Courts", text: "Two outdoor pickleball courts." },
    { id: "lighting", title: "Lighting", text: "Lit for night games until 11:00 PM." },
    { id: "hours", title: "Operating Hours", text: "Monday - Sunday | 8:00 A.M. - 11:00 P.M." },
    { id: "last-booking", title: "Last Booking Time", text: "10:00 P.M." },
    { id: "rentals", title: "Rentals", text: "Paddles and balls are available for rent, but stocks are limited, so bringing your own is best. A valid ID is required." },
  ],
  policies: [
    {
      id: "booking",
      title: "Booking & Payment",
      text: [
        "• Pay before you play. Your slot is only confirmed once payment is received.",
        "• Each 1-hour slot includes 5 minutes for warm-up and clean-up.",
        "• We hold your court for 10 minutes. After that it counts as a no-show and the court may be given to walk-ins.",
        "• Need to cancel? Let us know at least 3 hours before your slot. Late cancellations and no-shows are charged 50% of the slot.",
        "• Payments are non-refundable, but you can rebook within 24 hours. (Rain is the exception, see the Rain Policy below.)",
      ].join("\n"),
    },
    {
      id: "hours-rates",
      title: "Court Hours & Rates",
      text: [
        "• Open daily, 8:00 AM - 11:00 PM. The last booking starts at 10:00 PM.",
        "• Daytime (8:00 AM - 4:00 PM): ₱150 per hour",
        "• Nighttime (4:00 PM - 11:00 PM): ₱200 per hour",
      ].join("\n"),
    },
    {
      id: "dress-code",
      title: "Dress Code & Gear",
      text: [
        "• Non-marking athletic court shoes and proper sportswear are required. No slippers or street shoes, please.",
        "• Shirts on at all times.",
        "• Please bring your own paddle and balls. Rentals are available but limited.",
      ].join("\n"),
    },
    {
      id: "claygo",
      title: "Court Care: Clean As You Go",
      text: [
        "• Clean As You Go is mandatory. Leave the court the way you'd like to find it.",
        "• All trash goes in the designated bins.",
        "• Take your empty bottles, used grip tape and towels with you.",
        "• Spot a broken net, a faulty light or a crack in the court? Tell our staff right away, and please don't try to fix it yourself.",
      ].join("\n"),
    },
    {
      id: "safety",
      title: "Game & Safety",
      text: [
        "• Keep coaching and cheering at a level that doesn't disturb players on the other court.",
        "• Please don't sit or lean on the net.",
        "• If you get hurt, stop playing right away. A first aid kit is available at the counter.",
      ].join("\n"),
    },
    {
      id: "rain",
      title: "Rain Policy",
      text: [
        "Our courts are outdoors. If rain makes the court unplayable or slippery, we'll refund or rebook your slot:",
        "• Rain starts within the first 15 minutes of play: full refund or a free rebook.",
        "• Rain starts after the first 15 minutes: 50% refund, or a free 30-minute rebook.",
        "• Our staff will decide when play needs to stop for safety.",
        "• No play during heavy rain. A wet court is a slip hazard.",
        "• If you choose to keep playing in light rain, no refund applies.",
      ].join("\n"),
    },
    {
      id: "behavior",
      title: "Behavior & Ban Policy",
      text: [
        "• Zero tolerance for fighting, cursing at other players, and throwing or abusing paddles. Violations may lead to a ban.",
        "• Players who are drunk or under the influence will be refused entry.",
        "• No speakers or music without staff permission.",
      ].join("\n"),
    },
    {
      id: "kids",
      title: "Kids & Guests",
      text: "• Children under 12 must have a guardian with them inside the court premises, not just waiting outside.",
    },
    {
      id: "rentals",
      title: "Rentals, Loss & Damage",
      text: [
        "• A valid ID is required for all rentals (paddles, balls and shoes).",
        "• Rentals are for your booked time only.",
        "• Please keep an eye on your belongings. We are not liable for lost phones, wallets, watches or other valuables.",
      ].join("\n"),
    },
    {
      id: "media",
      title: "Photos & Videos",
      text: [
        "• We sometimes take photos and videos at the court for our Facebook page.",
        "• Prefer not to be featured? Just let our staff know before you play.",
      ].join("\n"),
    },
    {
      id: "final",
      title: "Final Rule",
      text: "• Management reserves the right to refuse service or stop any game that breaks these rules.",
    },
  ],
  faqs: [
    { q: "How do I book a court?", a: "Pick a date and tap the open hours you want, enter your details, pay by scanning the QR code, then upload your receipt. We'll confirm your booking once we've checked it." },
    { q: "Do I need to pay in advance?", a: "Yes, we're strictly pay before you play. After choosing your slots you have a few minutes to pay and upload your receipt before the hold is released." },
    { q: "How much does it cost?", a: "Daytime (8:00 AM - 4:00 PM) is ₱150 per hour and nighttime (4:00 PM - 11:00 PM) is ₱200 per hour, per court." },
    { q: "Can I cancel or reschedule?", a: "Please cancel at least 3 hours before your slot. Late cancellations and no-shows are charged 50% of the slot. Payments are non-refundable, but you can rebook within 24 hours." },
    { q: "What if I'm running late?", a: "We hold your court for 10 minutes. After that the booking counts as a no-show and the court may be given to walk-ins." },
    { q: "What happens if it rains?", a: "If rain starts within the first 15 minutes of play, you get a full refund or a free rebook. After 15 minutes, it's a 50% refund or a free 30-minute rebook. Staff decide when play stops for safety." },
    { q: "What should I wear?", a: "Non-marking athletic court shoes and proper sportswear. No slippers, street shoes or playing shirtless." },
    { q: "Can I rent a paddle?", a: "Yes, paddles and balls are available for rent, but stocks are limited, so bringing your own is best. A valid ID is required for all rentals." },
    { q: "Can kids play?", a: "Of course! Children under 12 just need a guardian with them inside the court premises." },
    { q: "Where are you located?", a: "Purok 4, South Poblacion, Medina, Misamis Oriental, near Grace Christian School." },
  ],
};
