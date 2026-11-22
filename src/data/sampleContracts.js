/**
 * Fictional demo procurement contracts for 1-click demo mode (T12).
 * Every person, employee ID, email, and phone number below is invented.
 * Prices are calibrated against src/data/seedBenchmarks.json:
 *   1. School IT: critical (+130%) and moderate (+45%) markups
 *   2. Clinic medical: critical (+120%, +100%) and moderate (+50%) markups
 *   3. Office & classroom: control sample, every price within the fair range
 *      (largest deviation +15%), so the audit should flag nothing
 */
export const SAMPLE_CONTRACTS = [
  {
    id: 'it-infrastructure',
    shortLabel: 'School IT',
    title: 'Public school IT procurement',
    text: `Public School IT Infrastructure Procurement
Contract No. PO-2026-001234 · District Education Office

Commitment Officer: Margaret Ellison, NIP 198203142010
Approved by: Mr. Thomas Reyes (Employee ID: EMP-48213)
Internal contact: t.reyes@district-edu.gov / +1 (555) 013-2244

Line items
1. Standard Student Laptop 14-inch (Intel Core i3, 8GB RAM, 256GB SSD) - Qty: 500 - Unit price: $1,210.00
2. 24-inch Monitor (1080p IPS) - Qty: 120 - Unit price: $232.00
3. Enterprise Wi-Fi 6 Access Point (ceiling mount) - Qty: 40 - Unit price: $185.00
4. 1500VA Uninterruptible Power Supply (UPS) - Qty: 20 - Unit price: $215.00
5. Monochrome Laser Office Printer (duplex) - Qty: 12 - Unit price: $290.00

Total contract value: $648,020.00
Delivery questions go to Ms. Ellison before 15 December 2026.`,
  },
  {
    id: 'medical-emergency',
    shortLabel: 'Clinic medical',
    title: 'Regional clinic medical supply tender',
    text: `Regional Clinic Medical Supply Tender
Contract No. PO-2026-004891 · Metropolitan Health Department

Prepared by: Dr. Elena Vance (Employee ID: EMP-77412)
Authorized by: Mr. David Chen, NIP 197911042008
Internal contact: e.vance@metrohealth-dept.gov / +1 (555) 019-8821

Line items
1. Infrared Thermometer (non-contact, medical grade) - Qty: 400 - Unit price: $77.00
2. Surgical Masks (Box of 50) - Qty: 2000 - Unit price: $24.00
3. Multi-Parameter Patient Monitor (12-inch ICU display) - Qty: 15 - Unit price: $2,400.00
4. Digital Upper-Arm Blood Pressure Monitor (clinical cuff) - Qty: 80 - Unit price: $68.00
5. Nitrile Examination Gloves (Box of 100) - Qty: 600 - Unit price: $15.00

Total contract value: $129,240.00
Cold-chain verification handled by Dr. Vance before 20 December 2026.`,
  },
  {
    id: 'office-classroom',
    shortLabel: 'Office & classroom',
    title: 'Municipal office & classroom upgrade',
    text: `Municipal Office & Classroom Modernization
Contract No. PO-2026-007310 · Civic Operations Bureau

Issued by: Ms. Priya Patel (Employee ID: EMP-31904)
Signed by: Mr. Samuel Brooks, NIP 198506212012
Internal contact: p.patel@civic-ops.gov / +1 (555) 014-6630

Line items
1. Ergonomic Office Chair (lumbar mesh, adjustable arms) - Qty: 150 - Unit price: $333.50
2. 65-inch Smart Interactive Board (4K touch display) - Qty: 18 - Unit price: $2,060.00
3. Student Desk & Chair Set (steel frame) - Qty: 250 - Unit price: $145.00
4. Electric Height-Adjustable Standing Desk (dual motor) - Qty: 30 - Unit price: $460.00
5. A4 Copy Paper (Case of 5 Reams) - Qty: 200 - Unit price: $36.00

Total contract value: $144,355.00
Site installation coordinated with Ms. Patel before 28 December 2026.`,
  },
]
