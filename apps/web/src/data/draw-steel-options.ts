// =============================================================================
// Draw Steel Character Creation Options
// Extracted from game_rules/Rules/ markdown files
// =============================================================================

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface AncestryOption {
  name: string;
  description: string;
  signatureTrait: { name: string; description: string };
  purchasableTraits: { name: string; cost: number; description: string }[];
  size: string;
  speed?: number;
  staminaBonus?: number;
  ancestryPoints: number;
}

export interface CultureEnvironment {
  name: string;
  skillOptions: string;
}

export interface CultureOrganization {
  name: string;
  skillOptions: string;
}

export interface CultureUpbringing {
  name: string;
  skillOptions: string;
}

export interface CareerOption {
  name: string;
  skills: string;
  languages?: string;
  renown?: number;
  wealth?: number;
  projectPoints?: number;
}

export interface ClassOption {
  name: string;
  description: string;
  heroicResource: string;
  keyCharacteristic: string;
  startingStamina: number;
  staminaPerLevel: number;
  recoveries: number;
  subclasses: string[];
  characteristicArrays: string[];
}

export interface KitOption {
  name: string;
  description: string;
  armor: string;
  weapon: string;
  staminaBonus: number;
  speedBonus: number;
  stabilityBonus: number;
  meleeDamageBonus: string;
  rangedDamageBonus: string;
}

// -----------------------------------------------------------------------------
// Ancestries
// -----------------------------------------------------------------------------

export const ANCESTRIES: AncestryOption[] = [
  {
    name: 'Devil',
    description:
      'Humanoids with red or blue skin from the Seven Cities of Hell. Each devil is born with a hellmark — horns, a tail, cloven hooves, a forked tongue, fanged incisors, or wings.',
    signatureTrait: {
      name: 'Silver Tongue',
      description:
        'Your innate magic lets you twist how words are perceived. You gain one interpersonal skill and an edge on tests to discover NPC motivations and pitfalls during negotiation.',
    },
    purchasableTraits: [
      {
        name: 'Barbed Tail',
        cost: 1,
        description:
          'Once per round when you make a melee strike, deal extra damage equal to your highest characteristic score.',
      },
      {
        name: 'Beast Legs',
        cost: 1,
        description: 'Your powerful legs give you speed 6.',
      },
      {
        name: 'Glowing Eyes',
        cost: 1,
        description:
          'When you take damage from a creature, use a triggered action to deal that creature 1d10 + level psychic damage.',
      },
      {
        name: 'Hellsight',
        cost: 1,
        description:
          'You see through darkness, fog, and obscuring effects. No bane on strikes against creatures with concealment.',
      },
      {
        name: 'Impressive Horns',
        cost: 2,
        description: 'Whenever you make a saving throw, you succeed on a roll of 5 or higher.',
      },
      {
        name: 'Prehensile Tail',
        cost: 2,
        description: 'Your prehensile tail prevents you from being flanked.',
      },
      {
        name: 'Wings',
        cost: 2,
        description:
          'You can fly for rounds equal to your Might score before falling. Damage weakness 5 while flying at 3rd level or lower.',
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Dragon Knight',
    description:
      "Created through the ritual of Dracogenesis, dragon knights (draconians) are descendants of the Dragon Phalanx. They possess hardened scales and carry the legacy of Good King Omund's greatest knights.",
    signatureTrait: {
      name: 'Wyrmplate',
      description:
        'Your hardened scales grant damage immunity equal to your level to one damage type: acid, cold, corruption, fire, lightning, or poison. You can change the type after a respite.',
    },
    purchasableTraits: [
      {
        name: 'Draconian Guard',
        cost: 1,
        description:
          'When you or an adjacent creature takes strike damage, use a triggered action to reduce damage by your level.',
      },
      {
        name: 'Draconian Pride',
        cost: 2,
        description:
          'Signature ability: a 1-burst roar that deals damage and pushes enemies (Power Roll + Might or Presence).',
      },
      {
        name: 'Dragon Breath',
        cost: 2,
        description:
          'Signature ability: a 3-cube breath weapon dealing typed damage (acid, cold, corruption, fire, lightning, or poison).',
      },
      {
        name: 'Prismatic Scales',
        cost: 1,
        description:
          'Select one Wyrmplate damage immunity type; you always have this immunity in addition to your Wyrmplate immunity.',
      },
      {
        name: 'Remember Your Oath',
        cost: 1,
        description:
          'As a maneuver, recite your oath. Until start of next turn, saving throws succeed on 4 or higher.',
      },
      {
        name: 'Wings',
        cost: 2,
        description:
          'You can fly for rounds equal to your Might score before falling. Damage weakness 5 while flying at 3rd level or lower.',
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Dwarf',
    description:
      'Possessed of stone-infused flesh making them denser than other humanoids. Children of the elder god Ord, dwarves are savvy engineers and technologists who inherited lore from the extinct steel dwarves.',
    signatureTrait: {
      name: 'Runic Carving',
      description:
        'Carve a rune onto your skin (10 min) choosing Detection (sense creatures/objects within 20 squares), Light (shed light 10 squares), or Voice (telepathic communication within 1 mile). One rune at a time.',
    },
    purchasableTraits: [
      {
        name: 'Great Fortitude',
        cost: 2,
        description: "You can't be made weakened.",
      },
      {
        name: 'Grounded',
        cost: 1,
        description: '+1 bonus to stability.',
      },
      {
        name: 'Spark Off Your Skin',
        cost: 2,
        description: '+6 bonus to Stamina, increasing by 6 at 4th, 7th, and 10th levels.',
      },
      {
        name: 'Stand Tough',
        cost: 1,
        description:
          'Might score treated as 1 higher for resisting potencies. Edge on Might tests to resist environmental effects or creature abilities.',
      },
      {
        name: 'Stone Singer',
        cost: 1,
        description:
          'Spend 1 uninterrupted hour singing to reshape unworked mundane stone within 3 squares.',
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Hakaan',
    description:
      'Descended from a tribe of giants in upper Vanigar, hakaan traded some of their size and strength for the ability to see the future — though they can only foresee their own dramatic death (the Doomsight).',
    signatureTrait: {
      name: 'Big!',
      description: 'Your size is 1L, reflecting your giant forebears.',
    },
    purchasableTraits: [
      {
        name: 'All Is a Feather',
        cost: 1,
        description: 'Edge on tests to lift and haul heavy objects.',
      },
      {
        name: 'Doomsight',
        cost: 2,
        description:
          'Predetermine a death encounter. While doomed, auto tier 3 on tests and ability rolls, and you cannot die until encounter ends. You then die permanently.',
      },
      {
        name: 'Forceful',
        cost: 1,
        description: 'Whenever you force move a creature or object, distance gains +1.',
      },
      {
        name: 'Great Fortitude',
        cost: 2,
        description: "You can't be made weakened.",
      },
      {
        name: 'Stand Tough',
        cost: 1,
        description:
          'Might score treated as 1 higher for resisting potencies. Edge on Might tests to resist environmental effects or creature abilities.',
      },
    ],
    size: '1L',
    ancestryPoints: 3,
  },
  {
    name: 'High Elf',
    description:
      'Children of the solar celestials, high elves are long-lived beings who built their civilization among fallen celestial sky cities. They value art, beauty, lore, and knowledge above all.',
    signatureTrait: {
      name: 'High Elf Glamor',
      description:
        'A magic glamor makes you appear interesting and engaging, granting an edge on Presence tests using Flirt or Persuade. You appear slightly different to each creature but always as yourself.',
    },
    purchasableTraits: [
      {
        name: 'Glamor of Terror',
        cost: 2,
        description:
          'When you take damage from a creature, use a triggered action to make them frightened of you until end of their next turn.',
      },
      {
        name: 'Graceful Retreat',
        cost: 1,
        description: '+1 bonus to shift distance when you Disengage.',
      },
      {
        name: 'High Senses',
        cost: 1,
        description: 'Edge on tests to notice threats.',
      },
      {
        name: 'Otherworldly Grace',
        cost: 2,
        description: 'Saving throws succeed on a roll of 5 or higher.',
      },
      {
        name: 'Revisit Memory',
        cost: 1,
        description: 'Edge on tests to recall lore.',
      },
      {
        name: 'Unstoppable Mind',
        cost: 2,
        description: "You can't be made dazed.",
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Human',
    description:
      'Humans belong to the world in a unique way — they can sense the supernatural and the presence of deathless. Their grip on magic is light, and their short lives drive them to leave the world better than they found it.',
    signatureTrait: {
      name: 'Detect the Supernatural',
      description:
        'As a maneuver, detect supernatural objects, undead, constructs, or creatures from another world within 5 squares until end of next turn, even without line of effect.',
    },
    purchasableTraits: [
      {
        name: "Can't Take Hold",
        cost: 1,
        description:
          'Ignore temporary difficult terrain from magic/psionic abilities. Reduce magic/psionic forced movement by 1.',
      },
      {
        name: 'Determination',
        cost: 2,
        description:
          'Use a maneuver to immediately end frightened, slowed, or weakened on yourself.',
      },
      {
        name: 'Perseverance',
        cost: 1,
        description: 'Edge on Endurance skill tests. When slowed, speed reduced to 3 instead of 2.',
      },
      {
        name: 'Resist the Unnatural',
        cost: 1,
        description: 'When you take typed damage, use a triggered action to take half damage.',
      },
      {
        name: 'Staying Power',
        cost: 2,
        description: 'Increase your Recoveries by 2.',
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Memonek',
    description:
      'Native to Axiom, the Plane of Uttermost Law, memonek have silicone bodies and ordered minds. When descending to the lower planes, they experience worldsickness — uncontrollable emotions.',
    signatureTrait: {
      name: 'Fall Lightly / Lightweight',
      description:
        'Fall Lightly: Reduce fall distance by 2 squares. Lightweight: When force moved, treat your size as one smaller.',
    },
    purchasableTraits: [
      {
        name: 'I Am Law',
        cost: 1,
        description: "Enemies can't move through your space unless you allow it.",
      },
      {
        name: 'Keeper of Order',
        cost: 2,
        description:
          'Once per round, when you or an adjacent creature makes a power roll, remove an edge/bane or reduce double edge/bane.',
      },
      {
        name: 'Lightning Nimbleness',
        cost: 2,
        description: 'Your speed is 7.',
      },
      {
        name: 'Nonstop',
        cost: 2,
        description: "You can't be made slowed.",
      },
      {
        name: 'Systematic Mind',
        cost: 1,
        description:
          'Edge on tests to parse schematics, maps, and systematic documents. Treat unknown languages as if you know a related language.',
      },
      {
        name: 'Unphased',
        cost: 1,
        description: "You can't be made surprised.",
      },
      {
        name: 'Useful Emotion',
        cost: 1,
        description: 'At the start of any combat, you gain 1 surge.',
      },
    ],
    size: '1M',
    ancestryPoints: 4,
  },
  {
    name: 'Orc',
    description:
      'The fifth speaking people, orcs have a fire within that causes their veins to glow when blood is drawn. Peace-loving by nature, they channel unfettered anger into martial prowess when battle demands it.',
    signatureTrait: {
      name: 'Relentless',
      description:
        'When damage leaves you dying, make a free strike against any creature. If that strike reduces the target to 0 Stamina, spend a Recovery.',
    },
    purchasableTraits: [
      {
        name: 'Bloodfire Rush',
        cost: 1,
        description:
          'First time each combat round you take damage, gain +2 speed until end of round.',
      },
      {
        name: 'Glowing Recovery',
        cost: 2,
        description: 'When you use Catch Breath, spend as many Recoveries as you like.',
      },
      {
        name: 'Grounded',
        cost: 1,
        description: '+1 bonus to stability.',
      },
      {
        name: 'Nonstop',
        cost: 2,
        description: "You can't be made slowed.",
      },
      {
        name: 'Passionate Artisan',
        cost: 1,
        description:
          'Choose two crafting skills. Gain +2 bonus to project rolls using those skills.',
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Polder',
    description:
      'Short (averaging 3.5 feet), numerous, and diverse, polders live among humans and share their culture. Their ability to shadowmeld gives them a reputation as excellent spies, thieves, and chefs.',
    signatureTrait: {
      name: 'Shadowmeld / Small!',
      description:
        'Shadowmeld: As a maneuver, flatten into a shadow on a wall or floor, becoming hidden. Strikes and searches against you take a bane. Size is 1S.',
    },
    purchasableTraits: [
      {
        name: 'Corruption Immunity',
        cost: 1,
        description: 'Corruption immunity equal to your level + 2.',
      },
      {
        name: 'Fearless',
        cost: 2,
        description: "You can't be made frightened.",
      },
      {
        name: 'Graceful Retreat',
        cost: 1,
        description: '+1 bonus to shift distance when you Disengage.',
      },
      {
        name: 'Nimblestep',
        cost: 2,
        description: 'Ignore difficult terrain effects and move at full speed while sneaking.',
      },
      {
        name: 'Polder Geist',
        cost: 1,
        description:
          'At start of turn, if no enemy has line of effect or you are hidden/concealed, gain +3 speed until end of turn.',
      },
      {
        name: 'Reactive Tumble',
        cost: 1,
        description: 'When force moved, use a free triggered action to shift 1 square after.',
      },
    ],
    size: '1S',
    ancestryPoints: 4,
  },
  {
    name: 'Revenant',
    description:
      'The dead who rise through unjust death and burning desire for vengeance. Unlike zombies, revenants retain all memories and personality from life and need no food, water, or air.',
    signatureTrait: {
      name: 'Former Life / Tough But Withered',
      description:
        'Choose a previous ancestry for your size (speed 5). Immunity to cold, corruption, lightning, and poison equal to level, but fire weakness 5. Cannot suffocate or need food/water. Become inert instead of dying (revive after 12 hours).',
    },
    purchasableTraits: [
      {
        name: 'Bloodless',
        cost: 2,
        description: "You can't be made bleeding, even while dying.",
      },
      {
        name: 'Previous Life: 1 Point',
        cost: 1,
        description:
          'Select a 1-point purchased trait from your previous ancestry. Can take multiple times.',
      },
      {
        name: 'Previous Life: 2 Points',
        cost: 2,
        description: 'Select a 2-point purchased trait from your previous ancestry.',
      },
      {
        name: 'Undead Influence',
        cost: 1,
        description: 'Edge on Reason, Intuition, and Presence tests to interact with undead.',
      },
      {
        name: 'Vengeance Mark',
        cost: 2,
        description:
          'Place magic sigils on creatures within 10 squares. Always know their direction. Signature ability: Detonate Sigil for damage and slide.',
      },
    ],
    size: 'Varies (based on former ancestry)',
    speed: 5,
    ancestryPoints: 2,
  },
  {
    name: 'Time Raider',
    description:
      "The kuran'zoi, originally servants of the synliroi, liberated themselves and became nomads of the timescape. They have crystalline eyes, two sets of arms, and are extraordinarily rare in Orden.",
    signatureTrait: {
      name: 'Psychic Scar',
      description:
        'Your mind is a formidable defense. You have psychic immunity equal to your level.',
    },
    purchasableTraits: [
      {
        name: 'Beyondsight',
        cost: 1,
        description:
          'As a maneuver, see through mundane obstructions 1 square thick or less, but lose vision within 1 square.',
      },
      {
        name: 'Foresight',
        cost: 1,
        description:
          'Know location of concealed (non-hidden) creatures within 20. Negate bane on strikes against them. Triggered action to impose bane on incoming strikes.',
      },
      {
        name: 'Four-Armed Athletics',
        cost: 1,
        description: 'Edge on Climb, Gymnastics, or Swim tests when using all arms.',
      },
      {
        name: 'Four-Armed Martial Arts',
        cost: 2,
        description:
          'Target one additional adjacent creature with Grab or Knockback. Can have two creatures grabbed at once.',
      },
      {
        name: 'Psionic Gift',
        cost: 2,
        description:
          'Choose a signature psionic ability: Concussive Slam (ranged damage + push/prone), Psionic Bolt (psychic damage + slide), or Minor Acceleration (speed boost to self or ally).',
      },
      {
        name: 'Unstoppable Mind',
        cost: 2,
        description: "You can't be made dazed.",
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
  {
    name: 'Wode Elf',
    description:
      'Children of the sylvan celestials and masters of the elf-haunted wodes. Their natural glamor lets them mask their presence, making them excel at guerrilla warfare and urban combat.',
    signatureTrait: {
      name: 'Wode Elf Glamor',
      description:
        'Magically alter your appearance to blend with surroundings. Edge on hide/sneak tests, and searches against you while hidden take a bane.',
    },
    purchasableTraits: [
      {
        name: 'Forest Walk',
        cost: 1,
        description: 'You can shift into and while within difficult terrain.',
      },
      {
        name: 'Quick and Brutal',
        cost: 1,
        description:
          'On a critical hit, gain an additional main action and move action instead of just a main action.',
      },
      {
        name: 'Otherworldly Grace',
        cost: 2,
        description: 'Saving throws succeed on a roll of 5 or higher.',
      },
      {
        name: 'Revisit Memory',
        cost: 1,
        description: 'Edge on tests to recall lore.',
      },
      {
        name: 'Swift',
        cost: 1,
        description: 'You have speed 6.',
      },
      {
        name: 'The Wode Defends',
        cost: 2,
        description:
          'Signature ability: ranged 10 strike that deals damage and can slow or restrain the target (Power Roll + Might or Agility).',
      },
    ],
    size: '1M',
    ancestryPoints: 3,
  },
];

// -----------------------------------------------------------------------------
// Culture: Environments
// -----------------------------------------------------------------------------

export const CULTURE_ENVIRONMENTS: CultureEnvironment[] = [
  {
    name: 'Nomadic',
    skillOptions: 'One skill from the exploration or interpersonal skill groups',
  },
  {
    name: 'Rural',
    skillOptions: 'One skill from the crafting or lore skill groups',
  },
  {
    name: 'Urban',
    skillOptions: 'One skill from the interpersonal or intrigue skill groups',
  },
  {
    name: 'Wilderness',
    skillOptions: 'One skill from the crafting or exploration skill groups',
  },
  {
    name: 'Secluded',
    skillOptions: 'One skill from the interpersonal or lore skill groups',
  },
];

// -----------------------------------------------------------------------------
// Culture: Organizations
// -----------------------------------------------------------------------------

export const CULTURE_ORGANIZATIONS: CultureOrganization[] = [
  {
    name: 'Bureaucratic',
    skillOptions: 'One skill from the interpersonal or intrigue skill groups',
  },
  {
    name: 'Communal',
    skillOptions: 'One skill from the crafting or exploration skill groups',
  },
];

// -----------------------------------------------------------------------------
// Culture: Upbringings
// -----------------------------------------------------------------------------

export const CULTURE_UPBRINGINGS: CultureUpbringing[] = [
  {
    name: 'Academic',
    skillOptions: 'One skill from the lore skill group',
  },
  {
    name: 'Creative',
    skillOptions:
      'The Music or Perform skill (interpersonal), or one skill from the crafting group',
  },
  {
    name: 'Labor',
    skillOptions:
      'Blacksmithing (crafting), Handle Animals (interpersonal), or a skill from the exploration group',
  },
  {
    name: 'Lawless',
    skillOptions: 'One skill from the intrigue skill group',
  },
  {
    name: 'Martial',
    skillOptions:
      'Blacksmithing or Fletching (crafting); Climb, Endurance, or Ride (exploration); Intimidate (interpersonal); Alertness or Track (intrigue); Monsters or Strategy (lore)',
  },
  {
    name: 'Noble',
    skillOptions: 'One skill from the interpersonal skill group',
  },
];

// -----------------------------------------------------------------------------
// Careers
// -----------------------------------------------------------------------------

export const CAREERS: CareerOption[] = [
  {
    name: 'Agent',
    skills: 'Sneak (intrigue), plus one interpersonal skill and one other intrigue skill',
    languages: '2 languages',
  },
  {
    name: 'Aristocrat',
    skills: 'One interpersonal skill and one lore skill',
    languages: '1 language',
    renown: 1,
    wealth: 1,
  },
  {
    name: 'Artisan',
    skills: 'Two skills from the crafting skill group',
    languages: '1 language',
    projectPoints: 240,
  },
  {
    name: 'Beggar',
    skills: 'Rumors (lore), plus one exploration skill and one interpersonal skill',
    languages: '2 languages',
  },
  {
    name: 'Criminal',
    skills: 'Criminal Underworld (lore), plus two skills from the intrigue group',
    languages: '1 language',
    projectPoints: 120,
  },
  {
    name: 'Disciple',
    skills: 'Religion (lore), plus two more lore skills',
    projectPoints: 240,
  },
  {
    name: 'Explorer',
    skills: 'Navigate (exploration), plus two more exploration skills',
    languages: '2 languages',
  },
  {
    name: 'Farmer',
    skills: 'Handle Animals (interpersonal), plus two exploration skills',
    languages: '1 language',
    projectPoints: 120,
  },
  {
    name: 'Gladiator',
    skills: 'Two skills from the exploration skill group',
    languages: '1 language',
    renown: 2,
  },
  {
    name: 'Laborer',
    skills: 'Endurance (exploration), plus two skills from crafting or exploration',
    languages: '1 language',
    projectPoints: 120,
  },
  {
    name: "Mage's Apprentice",
    skills: 'Magic (lore), plus two other lore skills',
    languages: '1 language',
    renown: 1,
  },
  {
    name: 'Performer',
    skills: 'Music or Perform (interpersonal), plus two more interpersonal skills',
    renown: 2,
  },
  {
    name: 'Politician',
    skills: 'Two skills from the interpersonal skill group',
    languages: '1 language',
    renown: 1,
    wealth: 1,
  },
  {
    name: 'Sage',
    skills: 'Two skills from the lore skill group',
    languages: '1 language',
    projectPoints: 240,
  },
  {
    name: 'Sailor',
    skills: 'Swim (exploration), plus two more exploration skills',
    languages: '2 languages',
  },
  {
    name: 'Soldier',
    skills: 'One exploration skill and one intrigue skill',
    languages: '2 languages',
    renown: 1,
  },
  {
    name: 'Warden',
    skills: 'Nature (lore), plus one exploration skill and one intrigue skill',
    languages: '1 language',
    projectPoints: 120,
  },
  {
    name: 'Watch Officer',
    skills: 'Alertness (intrigue), plus two more intrigue skills',
    languages: '2 languages',
  },
];

// -----------------------------------------------------------------------------
// Classes
// -----------------------------------------------------------------------------

export const CLASSES: ClassOption[] = [
  {
    name: 'Censor',
    description:
      'A divine warrior who carries the power of the gods, armed with wrath and sent to censor heretics, demons, and deathless. At your best against the strongest foes, your judgment terrifies enemies and hurls them across the battlefield.',
    heroicResource: 'Wrath',
    keyCharacteristic: 'Might and Presence',
    startingStamina: 21,
    staminaPerLevel: 9,
    recoveries: 12,
    subclasses: ['Exorcist', 'Oracle', 'Paragon'],
    characteristicArrays: [
      'Might 2, Presence 2, then 2/-1/-1',
      'Might 2, Presence 2, then 1/1/-1',
      'Might 2, Presence 2, then 1/0/0',
    ],
  },
  {
    name: 'Conduit',
    description:
      'A vessel for divine power who heals and buffs allies while debuffing and smiting foes with divine magic. The spark of divinity within you shines, filling enemies with awe.',
    heroicResource: 'Piety',
    keyCharacteristic: 'Intuition',
    startingStamina: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    subclasses: ['(Domain-based: choose 2 domains from your deity)'],
    characteristicArrays: [
      'Intuition 2, then 2/2/-1/-1',
      'Intuition 2, then 2/1/1/-1',
      'Intuition 2, then 2/1/0/0',
      'Intuition 2, then 1/1/1/0',
    ],
  },
  {
    name: 'Elementalist',
    description:
      'A master of the seven elements (air, earth, fire, water, green, rot, void) who uses magic to destroy, create, and warp the world. Unleash wrath across fields of foes, debilitate enemies, and manipulate terrain.',
    heroicResource: 'Essence',
    keyCharacteristic: 'Reason',
    startingStamina: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    subclasses: ['Earth', 'Fire', 'Green', 'Void'],
    characteristicArrays: [
      'Reason 2, then 2/2/-1/-1',
      'Reason 2, then 2/1/1/-1',
      'Reason 2, then 2/1/0/0',
      'Reason 2, then 1/1/1/0',
    ],
  },
  {
    name: 'Fury',
    description:
      'An unleashed force of nature channeling primordial chaos into martial prowess. Devastate foes with overwhelming might, hurl yourself and enemies around the battlefield, and grow stronger as ferocity increases.',
    heroicResource: 'Ferocity',
    keyCharacteristic: 'Might and Agility',
    startingStamina: 21,
    staminaPerLevel: 9,
    recoveries: 10,
    subclasses: ['Berserker', 'Reaver', 'Stormwight'],
    characteristicArrays: [
      'Might 2, Agility 2, then 2/-1/-1',
      'Might 2, Agility 2, then 1/1/-1',
      'Might 2, Agility 2, then 1/0/0',
    ],
  },
  {
    name: 'Null',
    description:
      'An unarmed psionic warrior who strives for perfect discipline over mind and body. Dampens and absorbs magic and psionics, requiring no weapons or tools. An enemy of the supernatural.',
    heroicResource: 'Discipline',
    keyCharacteristic: 'Agility and Intuition',
    startingStamina: 21,
    staminaPerLevel: 9,
    recoveries: 8,
    subclasses: ['Chronokinetic', 'Cryokinetic', 'Metakinetic'],
    characteristicArrays: [
      'Agility 2, Intuition 2, then 2/-1/-1',
      'Agility 2, Intuition 2, then 1/1/-1',
      'Agility 2, Intuition 2, then 1/0/0',
    ],
  },
  {
    name: 'Shadow',
    description:
      'A master of subtlety trained at a secret college, specializing in alchemy, illusion, or shadow-magics. Deal significant damage, move swiftly, evade hazards, and fade from notice in combat. Possesses more skills than any other hero.',
    heroicResource: 'Insight',
    keyCharacteristic: 'Agility',
    startingStamina: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    subclasses: [
      'College of Black Ash',
      'College of Caustic Alchemy',
      'College of the Harlequin Mask',
    ],
    characteristicArrays: [
      'Agility 2, then 2/2/-1/-1',
      'Agility 2, then 2/1/1/-1',
      'Agility 2, then 2/1/0/0',
      'Agility 2, then 1/1/1/0',
    ],
  },
  {
    name: 'Tactician',
    description:
      'A strategist, defender, and leader who leads allies into battle with commands that inspire faster movement and more precise strikes. Heals allies, grants increased damage, and leaves enemies struggling to respond.',
    heroicResource: 'Focus',
    keyCharacteristic: 'Might and Reason',
    startingStamina: 21,
    staminaPerLevel: 9,
    recoveries: 10,
    subclasses: ['Insurgent', 'Mastermind', 'Vanguard'],
    characteristicArrays: [
      'Might 2, Reason 2, then 2/-1/-1',
      'Might 2, Reason 2, then 1/1/-1',
      'Might 2, Reason 2, then 1/0/0',
    ],
  },
  {
    name: 'Talent',
    description:
      "A master of psionics who can move and change matter, time, gravity, the laws of physics, or other creatures' minds. Limited only by the strength of your mind, but every manifestation carries a risk of self-harm.",
    heroicResource: 'Clarity',
    keyCharacteristic: 'Reason and Presence',
    startingStamina: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    subclasses: ['Chronopathy', 'Telekinesis', 'Telepathy'],
    characteristicArrays: [
      'Reason 2, Presence 2, then 2/-1/-1',
      'Reason 2, Presence 2, then 1/1/-1',
      'Reason 2, Presence 2, then 1/0/0',
    ],
  },
  {
    name: 'Troubadour',
    description:
      'A performer who finds energy in the drama of everyday life and draws spectacle from any situation. You chase drama, taking to the world stage not intending to die but to find out if you are truly alive.',
    heroicResource: 'Drama',
    keyCharacteristic: 'Agility and Presence',
    startingStamina: 18,
    staminaPerLevel: 6,
    recoveries: 8,
    subclasses: ['Auteur', 'Duelist', 'Virtuoso'],
    characteristicArrays: [
      'Agility 2, Presence 2, then 2/-1/-1',
      'Agility 2, Presence 2, then 1/1/-1',
      'Agility 2, Presence 2, then 1/0/0',
    ],
  },
];

// -----------------------------------------------------------------------------
// Kits
// -----------------------------------------------------------------------------

export const KITS: KitOption[] = [
  {
    name: 'Arcane Archer',
    description:
      'Combines magic and ranged strikes. No armor keeps you mobile, and magic makes your arrows explode to devastate foes.',
    armor: 'None',
    weapon: 'Bow',
    staminaBonus: 0,
    speedBonus: 1,
    stabilityBonus: 0,
    meleeDamageBonus: '-',
    rangedDamageBonus: '+2/+2/+2',
  },
  {
    name: 'Battlemind',
    description:
      'Harnesses psionics with light armor. Makes you harder to move and your foes easier to push around.',
    armor: 'Light',
    weapon: 'Medium',
    staminaBonus: 3,
    speedBonus: 2,
    stabilityBonus: 1,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Cloak and Dagger',
    description:
      'Throwable light weapons and light armor concealed by a cloak. More mobile with effective short-range strikes.',
    armor: 'Light',
    weapon: 'Light',
    staminaBonus: 3,
    speedBonus: 2,
    stabilityBonus: 0,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '+1/+1/+1',
  },
  {
    name: 'Dual Wielder',
    description:
      'Excel at using two weapons at once. Maximizes the power of each weapon, making you a whirling dealer of death.',
    armor: 'Medium',
    weapon: 'Light + Medium',
    staminaBonus: 6,
    speedBonus: 2,
    stabilityBonus: 0,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Guisarmier',
    description:
      'Polearm fighting with extended reach while protected by sturdy armor. The ultimate halberd, longspear, or glaive fighter.',
    armor: 'Medium',
    weapon: 'Polearm',
    staminaBonus: 6,
    speedBonus: 0,
    stabilityBonus: 1,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Martial Artist',
    description:
      'Fast and unencumbered by weapons or armor. Quick, focused unarmed strikes make you the ultimate skirmisher.',
    armor: 'None',
    weapon: 'Unarmed strikes',
    staminaBonus: 3,
    speedBonus: 3,
    stabilityBonus: 0,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Mountain',
    description:
      "Heavy armor and heavy weapon to stand strong against foes, quickly demolishing them when it's your turn to strike.",
    armor: 'Heavy',
    weapon: 'Heavy',
    staminaBonus: 9,
    speedBonus: 0,
    stabilityBonus: 2,
    meleeDamageBonus: '+0/+0/+4',
    rangedDamageBonus: '-',
  },
  {
    name: 'Panther',
    description:
      'Good balance of protection, speed, and damage through focused body and mind preparation, not armor. Fast and mobile with a heavy weapon.',
    armor: 'None',
    weapon: 'Heavy',
    staminaBonus: 6,
    speedBonus: 1,
    stabilityBonus: 1,
    meleeDamageBonus: '+0/+0/+4',
    rangedDamageBonus: '-',
  },
  {
    name: 'Pugilist',
    description:
      'A brawler/boxer fighting style with boosted Stamina and damage while floating like a butterfly. Tough and strong with fists.',
    armor: 'None',
    weapon: 'Unarmed strikes',
    staminaBonus: 6,
    speedBonus: 2,
    stabilityBonus: 1,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '-',
  },
  {
    name: 'Raider',
    description:
      'Protected with shield and light armor while maintaining full mobility. Run around the battlefield like a Viking warrior.',
    armor: 'Light + Shield',
    weapon: 'Light',
    staminaBonus: 6,
    speedBonus: 1,
    stabilityBonus: 0,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '+1/+1/+1',
  },
  {
    name: 'Ranger',
    description:
      'Medium armor and weapons for every challenge. Easily switch between melee and ranged combat with balanced offense and defense.',
    armor: 'Medium',
    weapon: 'Bow + Medium',
    staminaBonus: 6,
    speedBonus: 1,
    stabilityBonus: 0,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '+1/+1/+1',
  },
  {
    name: 'Rapid-Fire',
    description:
      'Shoot as many arrows as possible into nearby enemies. Pepper foes before they can counterattack.',
    armor: 'Light',
    weapon: 'Bow',
    staminaBonus: 3,
    speedBonus: 1,
    stabilityBonus: 0,
    meleeDamageBonus: '-',
    rangedDamageBonus: '+2/+2/+2',
  },
  {
    name: 'Retiarius',
    description:
      'A lightly armored warrior with a net and trident. Tie up your foe with ensnaring weapons and poke them to death.',
    armor: 'Light',
    weapon: 'Ensnaring + Polearm',
    staminaBonus: 3,
    speedBonus: 1,
    stabilityBonus: 0,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Shining Armor',
    description:
      'The most protection a kit can afford. Sword, shield, and heavy armor for the prototypical knight.',
    armor: 'Heavy + Shield',
    weapon: 'Medium',
    staminaBonus: 12,
    speedBonus: 0,
    stabilityBonus: 1,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Sniper',
    description:
      'Take down enemies from afar. Lurk behind trees or down tunnels, picking off enemies with a bow as they approach.',
    armor: 'None',
    weapon: 'Bow',
    staminaBonus: 0,
    speedBonus: 1,
    stabilityBonus: 0,
    meleeDamageBonus: '-',
    rangedDamageBonus: '+0/+0/+4',
  },
  {
    name: 'Spellsword',
    description:
      "Combines melee strikes and magic. A warrior who doesn't have to choose between the incantation and the blade.",
    armor: 'Light + Shield',
    weapon: 'Medium',
    staminaBonus: 6,
    speedBonus: 1,
    stabilityBonus: 1,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Stick and Robe',
    description:
      'A simple reach weapon (often a quarterstaff) with light armor for high mobility, maximizing weapon length.',
    armor: 'Light',
    weapon: 'Polearm',
    staminaBonus: 3,
    speedBonus: 2,
    stabilityBonus: 0,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '-',
  },
  {
    name: 'Swashbuckler',
    description: 'Mobile with high melee damage. A great kit for master duelists.',
    armor: 'Light',
    weapon: 'Medium',
    staminaBonus: 3,
    speedBonus: 3,
    stabilityBonus: 0,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Sword and Board',
    description:
      'A shield as part of your offensive arsenal. Protect yourself while controlling the battlefield with medium armor.',
    armor: 'Medium + Shield',
    weapon: 'Medium',
    staminaBonus: 9,
    speedBonus: 0,
    stabilityBonus: 1,
    meleeDamageBonus: '+2/+2/+2',
    rangedDamageBonus: '-',
  },
  {
    name: 'Warrior Priest',
    description:
      'Imbues divine power into your weapon. Wade into the fray without fear thanks to heavy armor and the divine.',
    armor: 'Heavy',
    weapon: 'Light',
    staminaBonus: 9,
    speedBonus: 1,
    stabilityBonus: 1,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '-',
  },
  {
    name: 'Whirlwind',
    description:
      'Effective use of whips for mobility, damage, and reach. A fast-moving warrior who lashes foes with a chain or whip.',
    armor: 'None',
    weapon: 'Whip',
    staminaBonus: 0,
    speedBonus: 3,
    stabilityBonus: 0,
    meleeDamageBonus: '+1/+1/+1',
    rangedDamageBonus: '-',
  },
];

// -----------------------------------------------------------------------------
// Complications
// -----------------------------------------------------------------------------

export const COMPLICATIONS: string[] = [
  'Advanced Studies',
  'Amnesia',
  'Animal Form',
  'Antihero',
  'Artifact Bonded',
  'Bereaved',
  'Betrothed',
  'Chaos Touched',
  'Chosen One',
  'Consuming Interest',
  'Corrupted Mentor',
  'Coward',
  'Crash Landed',
  'Cult Victim',
  'Cursed Weapon',
  'Curse of Caution',
  'Curse of Immortality',
  'Curse of Misfortune',
  'Curse of Poverty',
  'Curse of Punishment',
  'Curse of Stone',
  'Disgraced',
  'Dragon Dreams',
  'Elemental Inside',
  'Evanesceria',
  'Exile',
  'Fallen Immortal',
  'Famous Relative',
  'Feytouched',
  'Fiery Ideal',
  'Fire and Chaos',
  'Following in the Footsteps',
  'Forbidden Romance',
  'Frostheart',
  'Getting Too Old for This',
  'Gnoll Mauled',
  'Greening',
  'Grifter',
  'Grounded',
  'Guilty Conscience',
  'Hawk Rider',
  'Host Body',
  'Hunted',
  'Hunter',
  'Indebted',
  'Infernal Contract But Like Bad',
  'Infernal Contract',
  'Ivory Tower',
  'Lifebonded',
  'Lightning Soul',
  'Loner',
  'Lost in Time',
  'Lost Your Head',
  'Lucky',
  'Master Chef',
  'Meddling Butler',
  'Medium',
  'Medusa Blood',
  'Misunderstood',
  'Mundane',
  'Outlaw',
  'Pirate',
  'Preacher',
  'Primordial Sickness',
  'Prisoner of the Synlirii',
  'Promising Apprentice',
  'Psychic Eruption',
  'Raised by Beasts',
  'Refugee',
  'Rival',
  'Rogue Talent',
  'Runaway',
  'Searching for a Cure',
  'Secret Identity',
  'Secret Twin',
  'Self Taught',
  'Sewer Folk',
  'Shadow Born',
  'Shared Spirit',
  'Shattered Legacy',
  'Shipwrecked',
  'Siblings Shield',
  'Silent Sentinel',
  'Slight Case of Lycanthropy',
  'Stolen Face',
  'Strange Inheritance',
  'Stripped of Rank',
  'Thrill Seeker',
  'Vampire Scion',
  'Voice in Your Head',
  'Vow of Duty',
  'Vow of Honesty',
  'Waking Dreams',
  'Ward',
  'War Dog Collar',
  'War of Assassins',
  'Waterborn',
  'Wodewalker',
  'Wrathful Spirit',
  'Wrongly Imprisoned',
];

// -----------------------------------------------------------------------------
// Languages
// -----------------------------------------------------------------------------

export const LANGUAGES: string[] = [
  'Anjali',
  'Caelian',
  'Filliaric',
  'Hyrallic',
  'Kalliak',
  'Khelt',
  'High Kuric',
  'Low Kuric',
  'Mindspeech',
  'Szetch',
  'Tholl',
  'Urollialic',
  'Variac',
  'Vastariax',
  'Vhoric',
  'Yllyric',
  "Za'hariax",
];
