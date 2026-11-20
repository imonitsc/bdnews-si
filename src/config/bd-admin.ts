// BDSI: Bangladesh's 8 divisions and 64 districts.
//
// `name` is the current official English spelling; `geo` is the name used in the
// boundary file (geoBoundaries / BBS-OCHA 2015, which predates the 2018 spellings);
// `aliases` and `bn` are spellings seen in English and Bangla headlines, used only
// to match news to districts (the interface stays English).

export const BD_DIVISIONS = [
  'Barishal', 'Chattogram', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet',
] as const;
export type BdDivision = typeof BD_DIVISIONS[number];

export interface BdDistrict {
  id: string;
  name: string;
  division: BdDivision;
  /** Name in the boundary file, when it differs from `name`. */
  geo?: string;
  aliases?: readonly string[];
  bn: readonly string[];
}

export const BD_DISTRICTS: readonly BdDistrict[] = [
  // Barishal division
  { id: 'barguna', name: 'Barguna', division: 'Barishal', bn: ['বরগুনা'] },
  { id: 'barishal', name: 'Barishal', division: 'Barishal', geo: 'Barisal', aliases: ['Barisal'], bn: ['বরিশাল'] },
  { id: 'bhola', name: 'Bhola', division: 'Barishal', bn: ['ভোলা'] },
  { id: 'jhalokathi', name: 'Jhalokathi', division: 'Barishal', geo: 'Jhalokati', aliases: ['Jhalokati', 'Jhalakathi'], bn: ['ঝালকাঠি'] },
  { id: 'patuakhali', name: 'Patuakhali', division: 'Barishal', bn: ['পটুয়াখালী'] },
  { id: 'pirojpur', name: 'Pirojpur', division: 'Barishal', bn: ['পিরোজপুর'] },
  // Chattogram division
  { id: 'bandarban', name: 'Bandarban', division: 'Chattogram', bn: ['বান্দরবান'] },
  { id: 'brahmanbaria', name: 'Brahmanbaria', division: 'Chattogram', geo: 'Brahamanbaria', aliases: ["B'baria", 'Brahamanbaria'], bn: ['ব্রাহ্মণবাড়িয়া'] },
  { id: 'chandpur', name: 'Chandpur', division: 'Chattogram', bn: ['চাঁদপুর'] },
  { id: 'chattogram', name: 'Chattogram', division: 'Chattogram', geo: 'Chittagong', aliases: ['Chittagong', 'Ctg'], bn: ['চট্টগ্রাম'] },
  { id: 'cumilla', name: 'Cumilla', division: 'Chattogram', geo: 'Comilla', aliases: ['Comilla'], bn: ['কুমিল্লা'] },
  { id: 'coxs-bazar', name: "Cox's Bazar", division: 'Chattogram', aliases: ['Coxs Bazar', 'Cox’s Bazar', 'Coxsbazar'], bn: ['কক্সবাজার'] },
  { id: 'feni', name: 'Feni', division: 'Chattogram', bn: ['ফেনী'] },
  { id: 'khagrachhari', name: 'Khagrachhari', division: 'Chattogram', aliases: ['Khagrachari'], bn: ['খাগড়াছড়ি'] },
  { id: 'lakshmipur', name: 'Lakshmipur', division: 'Chattogram', aliases: ['Laxmipur'], bn: ['লক্ষ্মীপুর'] },
  { id: 'noakhali', name: 'Noakhali', division: 'Chattogram', bn: ['নোয়াখালী'] },
  { id: 'rangamati', name: 'Rangamati', division: 'Chattogram', bn: ['রাঙ্গামাটি', 'রাঙামাটি'] },
  // Dhaka division
  { id: 'dhaka', name: 'Dhaka', division: 'Dhaka', bn: ['ঢাকা'] },
  { id: 'faridpur', name: 'Faridpur', division: 'Dhaka', bn: ['ফরিদপুর'] },
  { id: 'gazipur', name: 'Gazipur', division: 'Dhaka', bn: ['গাজীপুর'] },
  { id: 'gopalganj', name: 'Gopalganj', division: 'Dhaka', bn: ['গোপালগঞ্জ'] },
  { id: 'kishoreganj', name: 'Kishoreganj', division: 'Dhaka', bn: ['কিশোরগঞ্জ'] },
  { id: 'madaripur', name: 'Madaripur', division: 'Dhaka', bn: ['মাদারীপুর'] },
  { id: 'manikganj', name: 'Manikganj', division: 'Dhaka', bn: ['মানিকগঞ্জ'] },
  { id: 'munshiganj', name: 'Munshiganj', division: 'Dhaka', bn: ['মুন্সীগঞ্জ'] },
  { id: 'narayanganj', name: 'Narayanganj', division: 'Dhaka', bn: ['নারায়ণগঞ্জ'] },
  { id: 'narsingdi', name: 'Narsingdi', division: 'Dhaka', bn: ['নরসিংদী'] },
  { id: 'rajbari', name: 'Rajbari', division: 'Dhaka', bn: ['রাজবাড়ী'] },
  { id: 'shariatpur', name: 'Shariatpur', division: 'Dhaka', bn: ['শরীয়তপুর'] },
  { id: 'tangail', name: 'Tangail', division: 'Dhaka', bn: ['টাঙ্গাইল'] },
  // Khulna division
  { id: 'bagerhat', name: 'Bagerhat', division: 'Khulna', bn: ['বাগেরহাট'] },
  { id: 'chuadanga', name: 'Chuadanga', division: 'Khulna', bn: ['চুয়াডাঙ্গা'] },
  { id: 'jashore', name: 'Jashore', division: 'Khulna', geo: 'Jessore', aliases: ['Jessore'], bn: ['যশোর'] },
  { id: 'jhenaidah', name: 'Jhenaidah', division: 'Khulna', bn: ['ঝিনাইদহ'] },
  { id: 'khulna', name: 'Khulna', division: 'Khulna', bn: ['খুলনা'] },
  { id: 'kushtia', name: 'Kushtia', division: 'Khulna', bn: ['কুষ্টিয়া'] },
  { id: 'magura', name: 'Magura', division: 'Khulna', bn: ['মাগুরা'] },
  { id: 'meherpur', name: 'Meherpur', division: 'Khulna', bn: ['মেহেরপুর'] },
  { id: 'narail', name: 'Narail', division: 'Khulna', bn: ['নড়াইল'] },
  { id: 'satkhira', name: 'Satkhira', division: 'Khulna', bn: ['সাতক্ষীরা'] },
  // Mymensingh division
  { id: 'jamalpur', name: 'Jamalpur', division: 'Mymensingh', bn: ['জামালপুর'] },
  { id: 'mymensingh', name: 'Mymensingh', division: 'Mymensingh', bn: ['ময়মনসিংহ'] },
  { id: 'netrokona', name: 'Netrokona', division: 'Mymensingh', geo: 'Netrakona', aliases: ['Netrakona'], bn: ['নেত্রকোনা'] },
  { id: 'sherpur', name: 'Sherpur', division: 'Mymensingh', bn: ['শেরপুর'] },
  // Rajshahi division
  { id: 'bogura', name: 'Bogura', division: 'Rajshahi', geo: 'Bogra', aliases: ['Bogra'], bn: ['বগুড়া'] },
  { id: 'chapai-nawabganj', name: 'Chapai Nawabganj', division: 'Rajshahi', geo: 'Nawabganj', aliases: ['Chapainawabganj', 'Chapai-Nawabganj'], bn: ['চাঁপাইনবাবগঞ্জ', 'চাঁপাই নবাবগঞ্জ'] },
  { id: 'joypurhat', name: 'Joypurhat', division: 'Rajshahi', bn: ['জয়পুরহাট'] },
  { id: 'naogaon', name: 'Naogaon', division: 'Rajshahi', bn: ['নওগাঁ'] },
  { id: 'natore', name: 'Natore', division: 'Rajshahi', bn: ['নাটোর'] },
  { id: 'pabna', name: 'Pabna', division: 'Rajshahi', bn: ['পাবনা'] },
  { id: 'rajshahi', name: 'Rajshahi', division: 'Rajshahi', bn: ['রাজশাহী'] },
  { id: 'sirajganj', name: 'Sirajganj', division: 'Rajshahi', bn: ['সিরাজগঞ্জ'] },
  // Rangpur division
  { id: 'dinajpur', name: 'Dinajpur', division: 'Rangpur', bn: ['দিনাজপুর'] },
  { id: 'gaibandha', name: 'Gaibandha', division: 'Rangpur', bn: ['গাইবান্ধা'] },
  { id: 'kurigram', name: 'Kurigram', division: 'Rangpur', bn: ['কুড়িগ্রাম'] },
  { id: 'lalmonirhat', name: 'Lalmonirhat', division: 'Rangpur', bn: ['লালমনিরহাট'] },
  { id: 'nilphamari', name: 'Nilphamari', division: 'Rangpur', bn: ['নীলফামারী'] },
  { id: 'panchagarh', name: 'Panchagarh', division: 'Rangpur', bn: ['পঞ্চগড়'] },
  { id: 'rangpur', name: 'Rangpur', division: 'Rangpur', bn: ['রংপুর'] },
  { id: 'thakurgaon', name: 'Thakurgaon', division: 'Rangpur', bn: ['ঠাকুরগাঁও'] },
  // Sylhet division
  { id: 'habiganj', name: 'Habiganj', division: 'Sylhet', bn: ['হবিগঞ্জ'] },
  { id: 'moulvibazar', name: 'Moulvibazar', division: 'Sylhet', geo: 'Maulvibazar', aliases: ['Maulvibazar'], bn: ['মৌলভীবাজার'] },
  { id: 'sunamganj', name: 'Sunamganj', division: 'Sylhet', bn: ['সুনামগঞ্জ'] },
  { id: 'sylhet', name: 'Sylhet', division: 'Sylhet', bn: ['সিলেট'] },
];
