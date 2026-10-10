import { z } from 'zod';
import { sixMonthPeriod } from '../server/reporting-period.js';

export const DEFAULT_REFERENCE_DATE = '2026-10-10';
export const DEMO_SEED = 20261010;

const places = ['Amberbrook', 'Cedarvale', 'Willowmere', 'Silverhaven', 'Maplecrest', 'Oakbridge', 'Pinewick', 'Meadowgate', 'Birchstone', 'Coralridge', 'Fernhill', 'Laurelfield', 'Elmstead', 'Rosewater', 'Juniper Bay'];
// Curated identities keep names distinct; their positions retain existing codes and contacts.
const customerNames = [
  'Acorn Letterpress Workshop', 'Aster Creative Studio', 'Bluefin Cold Chain', 'Copperleaf Architecture', 'Dovetail Furniture Works',
  'Evergrove Learning Centre', 'Fable Publishing House', 'Granite Engineering', 'Harbour Textiles', 'Indigo Travel Collective',
  'Jasmine Paper Company', 'Kestrel Logistics', 'Larkspur Dental Studio', 'Mossgate Accounting Partners', 'Northcanvas Design Office',
  'Orchard Wellness Clinic', 'Pebble Ceramics', 'Quill Legal Associates', 'Riverbend Food Company', 'Saffron Advisory',
  'Thistle Marine Supplies', 'Umber Printworks', 'Velvet Event Studio', 'Wren Surveyors', 'Yarrow Garden Centre',
  'Zephyr Apparel', 'Almond Bakery', 'Bramble Photography', 'Cobalt Electronics', 'Dahlia Metalworks',
  'Ember Outdoor Supply', 'Finch Bookshop', 'Garnet Insurance Advisory', 'Hearth Kitchen Studio', 'Ivory Florists',
  'Jade Rehabilitation Centre', 'Kite Training Academy', 'Linen Interiors', 'Marigold Catering', 'Nectar Beekeeping Supplies',
  'Opal Freight Services', 'Parchment Editorial Studio', 'Quartz Geotechnics', 'Russet Packaging', 'Sage Procurement',
  'Tamarind Hospitality', 'Ultramarine Desk Research', 'Verbena Housewares', 'Walnut Footwear', 'Yonder Construction',
  'Zinnia Toy Workshop', 'Apricot Nutrition Centre', 'Bellwether Precision Tools', 'Cairn Landscape Studio', 'Driftwood Tours',
  'Eider Safety Supplies', 'Fennel Spice Company', 'Ginkgo Shipping Agency', 'Hazel Milling', 'Inkpetal Stationery',
  'Juniper Business Services', 'Kingfisher Diagnostics', 'Lantern Theatre Workshop', 'Mallow Childcare Centre', 'Nightjar Instruments',
  'Ocher Stoneworks', 'Peregrine Software Studio', 'Rainlace Curtain Makers', 'Sorrel Agronomy', 'Turnstone Technical Consulting',
  'Upland Water Systems', 'Violet Restoration', 'Wheatfield Community Pharmacy', 'Yellowkite Music School', 'Zircon Optical Studio',
  'Anvil Fabrication', 'Baysilk Tailoring House', 'Clover Veterinary Clinic', 'Dune Renewable Systems', 'Elm Sound Studio',
  'Foxglove Cartography', 'Gullwing Bicycle Workshop', 'Honeycomb Confectionery', 'Iris Jewellery Studio', 'Jute Export House',
  'Knoll Documentation Services', 'Lime Produce Trading', 'Moonwhistle Animation Studio', 'Nettle Herbal Goods', 'Olive Exhibition Design',
  'Poppy Transport Services', 'Reedvault Records Management', 'Suncrest Occupational Therapy', 'Teal Office Supplies', 'Urbanwattle Planning Studio',
  'Vineglass Laboratory Supplies', 'Woodlark Instrument Repair', 'Yarn Craft Store', 'Zest Food Processing', 'Ash Gift Packaging',
  'Brass Mechanical Services', 'Cloudberry Pastry House', 'Dogwood Media Studio', 'Echo Language School', 'Flint Homewares',
  'Goldenrod Irrigation Services', 'Hawthorn Publishing', 'Inkwell Career Advisory', 'Jasper Marine Engineering', 'Kalmia Seed Merchants',
  'Lotus Lighting Studio', 'Myrtle Retail Solutions', 'Nutmeg Restaurant Supply', 'Osprey Document Services', 'Petal Sign Makers',
  'Redwood Recruitment', 'Silverbriar Tax Advisory', 'Tern Mobility Services', 'Ume Tea Company', 'Vervain Fitness Studio',
  'Wildrose Joinery', 'Yew Boat Repair', 'Zodiac Planetarium Supplies', 'Auburn Translation', 'Brookchant Music Production',
  'Cypress Auto Workshop', 'Dewpoint Pantry Foods', 'Elder Assistive Devices', 'Fieldglass Quality Inspection', 'Grebe Ecology Consulting',
  'Hyacinth Hotel Supplies', 'Ironbloom Industrial Design', 'Jackdaw Press Agency', 'Kelp Aquaculture Services', 'Lupin Geological Consulting',
  'Magnolia Uniform Makers', 'Nightingale Care Services', 'Terracotta Ceramic Supply', 'Pineharvest Farm Equipment', 'Robin Civil Engineering',
  'Seagrass Interior Studio', 'Topaz Embroidery', 'Umbrella Visitor Services', 'Valleyplaid Textile Trading', 'Windflower Learning Resources',
  'Xylem Horticulture', 'Yucca Landscape Supply', 'Zebraslate Educational Publishing', 'Arbor Acoustic Consulting', 'Beryl Equipment Leasing'
];

// Prices are INR minor units. Descriptions describe fictional, unbranded offerings.
const catalog = [
  ['Business Laptop 14-inch', '16 GB memory and 512 GB SSD for everyday office work.', 6250000],
  ['Business Laptop 15-inch', '16 GB memory and 1 TB SSD for larger workspaces.', 7450000],
  ['Compact Office Desktop', 'Small-form desktop with 16 GB memory and 512 GB SSD.', 4850000],
  ['Mini Workstation', '32 GB memory and 1 TB SSD for design and analysis.', 8950000],
  ['24-inch IPS Monitor', 'Full HD display with adjustable stand.', 1450000],
  ['27-inch QHD Monitor', 'High-resolution display for detailed document work.', 2450000],
  ['Wireless Keyboard and Mouse', 'Quiet keyboard and ergonomic wireless mouse bundle.', 285000],
  ['USB Wired Keyboard', 'Full-size keyboard for shared office desks.', 95000],
  ['Ergonomic Wireless Mouse', 'Adjustable sensitivity with rechargeable battery.', 185000],
  ['USB-C Docking Station', 'Dual display, Ethernet and peripheral connectivity.', 895000],
  ['HD Conference Webcam', '1080p camera with privacy shutter.', 395000],
  ['USB Conference Speakerphone', 'Tabletop audio for small meeting rooms.', 1250000],
  ['Noise-reducing USB Headset', 'Wired headset with microphone for client calls.', 425000],
  ['Monochrome Laser Printer', 'Duplex printing for routine business documents.', 1850000],
  ['Multifunction Document Printer', 'Print, scan and copy with network connectivity.', 2850000],
  ['Desktop Document Scanner', 'Automatic feeder for digitising office files.', 2250000],
  ['Wi-Fi 6 Business Router', 'Dual-band router for small office networks.', 895000],
  ['8-port Gigabit Switch', 'Unmanaged desktop switch for wired devices.', 395000],
  ['16-port Managed Switch', 'Network segmentation and traffic management.', 1450000],
  ['Ceiling Wireless Access Point', 'Business wireless coverage with PoE support.', 1050000],
  ['Cat6 Network Cable 10 m', 'Pre-terminated cable for office network connections.', 85000],
  ['Cat6 Cable Box 100 m', 'Bulk cable for structured network installation.', 695000],
  ['650 VA Desktop UPS', 'Backup power for a desktop and monitor.', 425000],
  ['1200 VA Office UPS', 'Backup power for small shared workstations.', 895000],
  ['1 TB External SSD', 'Portable storage for working files and backups.', 795000],
  ['2 TB Backup Hard Drive', 'External storage for scheduled office backups.', 685000],
  ['64 GB USB Storage Drive', 'Portable transfer media for non-sensitive files.', 95000],
  ['Six-way Surge Protector', 'Protected power distribution for office desks.', 145000],
  ['Adjustable Laptop Stand', 'Aluminium stand for comfortable desk positioning.', 245000],
  ['Monitor Desk Arm', 'Single-monitor arm with adjustable height and reach.', 395000],
  ['Workstation Installation', 'Install and configure one office workstation.', 250000, 'service'],
  ['Operating System Setup', 'Configure a customer-supplied licensed operating system.', 180000, 'service'],
  ['Office Application Setup', 'Install customer-supplied licensed productivity software.', 150000, 'service'],
  ['Office Network Installation', 'Configure router, switch and up to eight endpoints.', 1250000, 'service'],
  ['Wireless Site Configuration', 'Configure access points and basic wireless coverage.', 650000, 'service'],
  ['Printer and Scanner Setup', 'Connect and configure one network print/scan device.', 180000, 'service'],
  ['Backup Configuration', 'Configure backup schedule and perform a restore check.', 450000, 'service'],
  ['Device Health Check', 'Inspect one workstation and document maintenance needs.', 120000, 'service'],
  ['Quarterly IT Maintenance Visit', 'Scheduled onsite maintenance for a small office.', 950000, 'service'],
  ['Staff Technology Training', 'Two-hour session on office tools and safe device use.', 750000, 'service']
];

export function professionalPlan(referenceDate = DEFAULT_REFERENCE_DATE, seed = DEMO_SEED) {
  z.iso.date().parse(referenceDate);
  const period = sixMonthPeriod(referenceDate.slice(0, 7));
  let value = seed >>> 0;
  const random = max => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value % max; };
  const customers = customerNames.map((name, i) => ({
    code: `FORMA-C-${String(i + 1).padStart(3, '0')}`,
    name, email: `office@${places[Math.floor(i / 10)].toLowerCase().replaceAll(' ', '-')}-${i % 10 + 1}.example.test`, phone: ''
  }));
  const products = catalog.map(([name, description, price, type = 'product'], i) => ({
    sku: `FORMA-${type === 'service' ? 'S' : 'P'}-${String(i + 1).padStart(3, '0')}`, name, description, price, type, reorderLevel: type === 'service' ? 0 : 5
  }));
  const orders = [];
  const counts = [24, 28, 31, 35, 38, 44];
  for (const [m, month] of period.months.entries()) {
    const maxDay = m === 5 ? Math.max(1, Number(referenceDate.slice(8)) - 1) : 26;
    for (let n = 0; n < counts[m]; n++) {
      const i = orders.length;
      const indices = new Set([random(30)]);
      while (indices.size < 2) indices.add(random(30));
      if (i % 3 !== 0) indices.add(30 + random(10));
      const items = [...indices].map(product => ({ product, quantity: product < 30 ? 1 + random(4) : 1 }));
      const total = items.reduce((sum, item) => sum + products[item.product].price * item.quantity, 0);
      const day = 1 + Math.floor(n * maxDay / counts[m]);
      const createdAt = new Date(`${month}-${String(day).padStart(2, '0')}T09:${String(n % 60).padStart(2, '0')}:00+05:30`);
      orders.push({ customer: (i * 37) % 150, items, total, paid: i % 5 === 0 ? 0 : i % 5 < 3 ? Math.floor(total / 2) : total, status: i % 4 === 0 ? 'confirmed' : 'fulfilled', createdAt });
    }
  }
  const demand = products.map(() => 0);
  for (const order of orders) for (const item of order.items) if (products[item.product].type === 'product') demand[item.product] += item.quantity;
  const opening = demand.map((quantity, i) => products[i].type === 'service' ? 0 : quantity + (i % 7 === 0 ? 3 : 12 + i % 15));
  return { referenceDate, seed, period, customers, products, orders, opening };
}
