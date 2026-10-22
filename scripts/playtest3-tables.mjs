// Geometry only; all table text comes from the user's PDF.
const s=(page,column,top,bottom,rows)=>({page,column,top,bottom,rows});
export const REF_TABLES_V3=[
  ['Travel Encounters',100,[s(1,0,206,335,8)]],
  ['Combat Terrain',10,[s(1,0,355,578,4),s(1,1,36,364,6)]],
  ['Any Monster Encounter',10,[s(1,1,525,611,5)]],
  ['Monster Outdoor Behaviors',100,[s(2,0,49,347,10)]],
  ['Merchant Sales',100,[s(3,1,49,404,20)]],
  ['Merchant Guards',100,[s(4,0,49,236,12)]],
  ['Miasma-Touched Humans',100,[s(4,1,49,593,37)]],
  ['Miasma-Touched Encounters',100,[s(5,0,49,611,5),s(5,1,36,609,5),s(6,0,36,609,5),s(6,1,36,598,5),s(7,0,36,210,2)]],
  ['Travelers',100,[s(8,0,49,565,35)]],
  ['Traveler Encounters',10,[s(8,1,49,568,5),s(9,0,36,447,5)]],
  ['Traveler Rewards',6,[s(9,1,49,215,6)]],
  ['Coastal Animal Encounters',10,[s(10,0,49,207,10)]],
  ['Cold Climate Animal Encounters',10,[s(10,0,226,385,10)]],
  ['Desert Animal Encounters',100,[s(10,1,49,279,15)]],
  ['Forest Animal Encounters',100,[s(10,1,298,610,20)]],
  ['Grassland Animal Encounters',100,[s(11,0,49,361,20)]],
  ['Hill/Mountain Animal Encounters',100,[s(11,1,49,361,20)]],
  ['Marsh/Swamp Animal Encounters',10,[s(11,1,380,549,10)]],
  ['Wild Animal Reaction',100,[s(12,0,49,571,6),s(12,1,36,501,5),s(13,0,36,433,4)]],
  ['Minor Treasures',100,[s(13,1,49,608,38),s(14,0,36,609,39),s(14,1,36,405,24)]],
  ['Major Treasures',100,[s(15,0,49,604,37),s(15,1,36,599,36),s(16,0,36,416,24)]],
  ["What's the Art Object?",10,[s(16,1,49,207,10)]],
  ["What's the Gem?",100,[s(16,1,228,600,25)]],
  ["What's the Lore Book Expertise?",100,[s(17,0,49,178,8)]],
  ["What's the Spellbook Specialty?",6,[s(17,0,198,299,6)]],
  ["What's the Ammunition?",6,[s(17,0,318,362,2)]],
  ["What's the Enchanted Item?",6,[s(17,1,109,167,3)]],
  ["What's the Armor?",6,[s(17,1,186,259,4)]],
  ["What's the Melee Weapon?",100,[s(17,1,278,522,16)]],
  ["What's the Ranged Weapon?",6,[s(17,1,541,600,3)]],
  ['Light Armor Materials',100,[s(18,0,49,150,6)]],
  ['Metal Weapon/Armor Materials',100,[s(18,0,169,270,6)]],
  ['Ranged Weapon Materials',100,[s(18,0,289,390,6)]],
  ['Shield Enchantments',100,[s(18,0,410,525,7)]],
  ['Armor Suit Enchantments',100,[s(18,1,49,307,17)]],
  ['Ranged Weapon Enchantments',100,[s(18,1,326,599,18)]],
  ['Melee Weapon Enchantments',100,[s(19,0,49,336,19)]],
  // Bestiary tables. Named "<type> Dungeon Encounters", as the Any Monster
  // Encounter results and the Playtest 2 tables refer to them.
  ['Angel Dungeon Encounters',100,[s(40,1,100,470,24)]],
  ['Blood Dungeon Encounters',100,[s(46,1,45,530,24)]],
  ['Demon Dungeon Encounters',100,[s(51,1,100,470,24)]],
  ['Plant Dungeon Encounters',100,[s(58,1,100,470,24)]],
  ['Undead Dungeon Encounters',100,[s(63,1,100,470,24)]]
];
export const RULES_TABLES_V3=[['Miasma Effects',[s(28,0,49,607,4),s(28,1,36,451,3)]]];
// Rolled as 1d100 + spell rank, so results run to 105.
export const RULES_BACKLASHES_V3=['Backlashes',105,[s(32,0,110,520,5),s(32,1,30,555,10),s(33,0,30,600,7),s(33,1,30,585,6),
  s(34,0,30,580,6),s(34,1,30,605,9),s(35,0,30,580,11),s(35,1,30,125,1)]];
