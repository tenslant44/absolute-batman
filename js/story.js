// Story chapters, missions, and cutscene scripts.
// Shots: at = anchor name; cam/look/move are offsets from that anchor.

export const CHAPTERS = [
  {
    id: 'ch1', title: 'I. Gotham Bleeds', at: 'street',
    pop: { walkers: 34, grandmaRate: 0.55, jayRate: 1, litterRate: 0, slowRate: 0, whistleRate: 0, funeral: false, pledge: false, grass: false, carts: false, houses: false },
    obj: { crime: 'jaywalk', count: 3, text: 'Execute 3 grandmas who step off the curb' },
    hints: ['Grandmas with a red ◆ have committed their crime. Press E near them for a takedown.', 'Q or right-click toggles Detective Vision.', 'Press 1-0 or scroll to switch gadgets: batarangs, gel, grapple, freeze, mallet, chainsaw...'],
    intro: [
      { at: 'street', cam: [30, 45, 30], look: [0, 0, 0], move: [18, 38, 10], fx: 'thunder', lines: [
        ['', 'GOTHAM CITY. 2:14 AM. RAINING, OBVIOUSLY.'],
      ] },
      { at: 'street', cam: [4, 3.2, 4], look: [0, 1.8, 0], move: [3, 2.6, 3], bat: [0, 0, 0.8], lines: [
        ['BATMAN', 'Gotham. Eleven million souls. Eleven million suspects.'],
        ['BATMAN', 'They think crime is bank robbery. Murder. Arson.'],
        ['BATMAN', 'Crime is a grandmother placing one orthopedic shoe on unmarked asphalt.'],
      ] },
      { at: 'street', cam: [-3, 2, 2], look: [0, 1.8, 0], bat: [0, 0, 0.8], lines: [
        ['ALFRED (RADIO)', 'Master Wayne, the Joker has escaped Arkham. Again.'],
        ['BATMAN', 'Not now, Alfred. There\'s an old woman on 5th Street who looks... curb-curious.'],
        ['ALFRED (RADIO)', 'Sir, she is ninety-one.'],
        ['BATMAN', 'Then she\'s had ninety-one years to learn.'],
      ] },
    ],
    outro: [
      { at: 'street', cam: [5, 1.4, 3], look: [0, 1.6, 0], bat: [0, 0, 0.5], fx: 'thunder', lines: [
        ['BATMAN', 'Three toes. Three verdicts.'],
        ['ALFRED (RADIO)', 'Sir, the news is calling it "The Crosswalk Massacre."'],
        ['BATMAN', 'Good. Let them be afraid of the paint.'],
      ] },
    ],
  },
  {
    id: 'ch2', title: 'II. Pledge of Violence', at: 'plaza',
    pop: { walkers: 14, funeral: false, grass: false, carts: false, houses: false, pledgeCount: 15, pledgeBad: 4, jayRate: 0, litterRate: 0, slowRate: 0.05, whistleRate: 0 },
    obj: { crime: 'pledge', count: 4, text: 'Beat every Rotary Club member who stays seated' },
    hints: ['Minor crimes get a beating, not death. Batman has standards.'],
    intro: [
      { at: 'plaza', cam: [0, 14, 22], look: [0, 8, 0], move: [0, 6, 18], lines: [
        ['', 'GOTHAM CITY HALL. THE ROTARY CLUB\'S MIDNIGHT FLAG APPRECIATION.'],
        ['MAYOR', 'Please rise for the Pledge of Allegiance.'],
      ] },
      { at: 'plaza', cam: [-4, 2, 13], look: [0, 1, 10], lines: [
        ['ROTARY MEMBER', '...my knees, Gerald. You know my knees.'],
      ] },
      { at: 'plaza', cam: [3, 3, 4], look: [0, 1.9, 0], bat: [0, 0, 3.14], fx: 'thunder', lines: [
        ['BATMAN', 'Some of them are still sitting.'],
        ['BATMAN', 'I won\'t kill them. Not for this. I\'m not a monster.'],
        ['BATMAN', 'I\'ll just make sure they never sit comfortably again.'],
      ] },
    ],
    outro: [
      { at: 'plaza', cam: [4, 2, 12], look: [0, 1, 10], bat: [0, 9, 3.14], lines: [
        ['COMMISSIONER GORDON (RADIO)', 'Batman. Four Rotary members are in the ICU.'],
        ['BATMAN', 'They\'ll stand next time.'],
        ['COMMISSIONER GORDON (RADIO)', 'One of them is in a wheelchair!'],
        ['BATMAN', '...Then he should have stood harder.'],
      ] },
    ],
  },
  {
    id: 'ch3', title: 'III. Dry Eyes', at: 'funeral',
    pop: { walkers: 10, funeralBad: 4, pledge: false, grass: false, carts: false, houses: false, jayRate: 0, litterRate: 0, slowRate: 0, whistleRate: 0 },
    obj: { crime: 'funeral', count: 4, text: 'Kill the mourners who are not crying' },
    hints: ['Mourners with tears are innocent. Mourners with smirks are not.'],
    intro: [
      { at: 'funeral', cam: [16, 10, 16], look: [2, 0, 0], move: [9, 5, 10], fx: 'thunder', lines: [
        ['', 'GOTHAM CEMETERY. THE FUNERAL OF EDNA PEMBERTON, 91.'],
        ['PRIEST', 'Edna was taken from us too soon. By a... large man. In a bat costume.'],
      ] },
      { at: 'funeral', cam: [6, 1.6, 4], look: [2, 1.4, 0], lines: [
        ['MOURNER', '*sob* She baked for the whole block...'],
        ['OTHER MOURNER', 'Honestly? Her cookies were dry. Kind of like my eyes right now.'],
      ] },
      { at: 'funeral', cam: [-10, 2.5, 12], look: [-12, 2, 16], bat: [-12, 16, 2.4], lines: [
        ['BATMAN', 'A woman is dead. And some of them aren\'t even crying.'],
        ['ALFRED (RADIO)', 'Sir, you are the reason she is dead.'],
        ['BATMAN', 'Which makes it personal.'],
      ] },
    ],
    outro: [
      { at: 'funeral', cam: [7, 2, 7], look: [2, 0.5, 0], bat: [4, 3, -2], lines: [
        ['PRIEST', '...we\'re going to need more graves.'],
        ['BATMAN', 'Now everyone is crying. That\'s called closure.'],
      ] },
    ],
  },
  {
    id: 'ch4', title: 'IV. Domestic Terror', at: 'houses',
    pop: { walkers: 12, funeral: false, pledge: false, grass: false, carts: false, lazyRate: 0.75, allHouses: true, jayRate: 0, litterRate: 0 },
    obj: { crime: 'chores', count: 3, text: 'Execute men lounging while their partners do the chores' },
    hints: ['The ones on the porch chairs. Look at them. Just LOOK at them.'],
    intro: [
      { at: 'houses', cam: [0, 18, 34], look: [0, 0, 0], move: [0, 10, 26], lines: [
        ['', 'THE SUBURBS OF EAST GOTHAM. 3:40 AM. WHY ARE THEY SWEEPING AT 3:40 AM? DON\'T ASK.'],
      ] },
      { at: 'houses', cam: [-2, 2, 1.5], look: [0, 1.8, 0], bat: [0, 0, 0], lines: [
        ['ALFRED (RADIO)', 'Sir, may I remind you I have ironed your capes for forty years.'],
        ['BATMAN', 'And I noticed, Alfred. Every single time.'],
        ['BATMAN', 'These men have not noticed anything. Not the dishes. Not the laundry.'],
        ['BATMAN', 'Tonight, they\'ll notice me.'],
      ] },
    ],
    outro: [
      { at: 'houses', cam: [3, 1.7, 3], look: [0, 1.6, 0], bat: [0, 0, 0.6], lines: [
        ['WIDOW', 'You... you killed my husband!'],
        ['BATMAN', 'You\'re welcome. Now finish sweeping.'],
      ] },
    ],
  },
  {
    id: 'ch5', title: 'V. Clean Up Aisle Five', at: 'market',
    pop: { walkers: 14, funeral: false, pledge: false, houses: false, grass: false, cartCount: 7, cartRate: 0.7, litterRate: 0.2, jayRate: 0.3 },
    obj: { crime: 'cart', count: 3, text: 'Kill shoppers who abandon their carts' },
    hints: ['The corral is RIGHT THERE. They walk past it. They KNOW.'],
    intro: [
      { at: 'market', cam: [-14, 6, 18], look: [8, 0, -1], move: [-6, 4, 14], lines: [
        ['', 'GOTHAM MART. 24 HOURS. NO SOUL.'],
        ['BATMAN', 'The cart corral. Thirty feet away. Clearly labeled.'],
        ['BATMAN', 'The ultimate test of human decency. No law forces you. No one will praise you.'],
        ['BATMAN', 'I will praise you. And I will end those who fail.'],
      ] },
    ],
    outro: [
      { at: 'market', cam: [4, 2, 6], look: [0, 1, 0], bat: [0, 4, 3.14], fx: 'thunder', lines: [
        ['ALFRED (RADIO)', 'Sir... the Joker. He\'s taken City Hall. He has hostages.'],
        ['BATMAN', 'Hostages. Fine. Whatever.'],
        ['ALFRED (RADIO)', 'He also, reportedly, is wearing white socks.'],
        ['BATMAN', '...It\'s October.'],
      ] },
    ],
  },
  {
    id: 'ch6', title: 'VI. The Clown Prince of Socks', at: 'plaza', boss: true,
    pop: { walkers: 6, funeral: false, pledge: false, houses: false, grass: false, carts: false, jayRate: 0.5, litterRate: 0, slowRate: 0 },
    obj: { crime: 'joker', count: 1, text: 'Kill the Joker (and his tediously criminal henchmen)' },
    hints: ['Punch the Joker to weaken him, then press E.'],
    intro: [
      { at: 'plaza', cam: [0, 3, 16], look: [0, 1.5, 4], move: [0, 2.2, 11], fx: 'thunder', lines: [
        ['THE JOKER', 'BATSY! Welcome to my little party! I\'ve rigged the reservoir, poisoned the orphanage—'],
        ['BATMAN', 'I don\'t care.'],
        ['THE JOKER', '...Come again?'],
        ['BATMAN', 'Mass murder is for the police. I handle the REAL crime.'],
        ['BATMAN', 'White socks. After Labor Day.'],
        ['THE JOKER', '...Batsy. I\'ve killed hundreds of people and even I think you need help.'],
        ['BATMAN', 'Get him.'],
        ['THE JOKER', 'There\'s nobody else here—'],
      ] },
    ],
    outro: [
      { at: 'plaza', cam: [5, 2.2, 9], look: [0, 1.5, 5], bat: [0, 4, 0.2], actors: [{ kind: 'gordon', p: [1.2, 6.8], face: Math.PI - 0.3 }], lines: [
        ['COMMISSIONER GORDON', 'It\'s over. The Joker\'s gone. Gotham is... quiet.'],
        ['COMMISSIONER GORDON', 'There\'s no crime left, Batman. There\'s barely anyone left.'],
        ['BATMAN', 'Commissioner. You\'re parked in a fire lane.'],
        ['COMMISSIONER GORDON', '...Oh no.'],
      ] },
      { at: 'plaza', cam: [0, 30, 1], look: [0, 0, 0], move: [0, 60, 1], fx: 'gore', lines: [
        ['', 'GOTHAM CITY. POPULATION: 1.'],
      ] },
      { at: 'street', cam: [2, 1.2, 2], look: [0, 1.6, 0], bat: [0, 0, 0.8], fx: 'thunder', lines: [
        ['BATMAN', 'Finally. A city without crime.'],
        ['BATMAN', '...'],
        ['BATMAN', 'I didn\'t use the crosswalk to get here.'],
        ['', 'THE END. JUSTICE APPLIES TO EVERYONE.'],
      ] },
    ],
  },
];

export const MISSIONS = [
  { id: 'm1', title: 'Crosswalk Crusade', desc: 'Execute 6 jaywalking grandmas.', at: 'street', time: 180,
    pop: { walkers: 40, grandmaRate: 0.5, jayRate: 1, funeral: false, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'jaywalk', count: 6 } },
  { id: 'm2', title: 'Grief Police', desc: 'Kill every dry-eyed mourner. Spare the criers.', at: 'funeral', time: 90, clean: true,
    pop: { walkers: 8, funeralBad: 5, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'funeral', count: 5 } },
  { id: 'm3', title: 'Pledge or Perish', desc: 'Beat 5 seated patriots. Nobody dies. Probably.', at: 'plaza', time: 90, clean: true,
    pop: { walkers: 8, pledgeCount: 15, pledgeBad: 5, funeral: false, houses: false, grass: false, carts: false }, obj: { crime: 'pledge', count: 5 } },
  { id: 'm4', title: 'Chore Wars', desc: 'Execute 5 lazy porch loungers.', at: 'houses', time: 150,
    pop: { walkers: 12, lazyRate: 0.8, allHouses: true, funeral: false, pledge: false, grass: false, carts: false }, obj: { crime: 'chores', count: 5 } },
  { id: 'm5', title: 'Keep Off The Grass', desc: 'Beat 6 people standing on the park lawn.', at: 'park', time: 120,
    pop: { walkers: 12, grassCount: 8, funeral: false, pledge: false, houses: false, carts: false }, obj: { crime: 'grass', count: 6 } },
  { id: 'm6', title: 'Litter Box', desc: 'Kill 4 people who drop gum wrappers.', at: 'street', time: 180,
    pop: { walkers: 40, litterRate: 0.3, jayRate: 0, funeral: false, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'litter', count: 4 } },
  { id: 'm7', title: 'Aisle of Judgment', desc: 'Kill 4 shopping cart abandoners.', at: 'market', time: 150,
    pop: { walkers: 10, cartCount: 8, cartRate: 0.6, funeral: false, pledge: false, houses: false, grass: false }, obj: { crime: 'cart', count: 4 } },
  { id: 'm8', title: 'Zero Tolerance', desc: 'Punish 20 crimes of any kind. The city is yours.', at: 'plaza', time: 300,
    pop: { walkers: 50 }, obj: { crime: null, count: 20 } },
  { id: 'm9', title: 'Real Criminals (Boring)', desc: 'Survive 3 waves of armed thugs.', at: 'plaza', time: 240,
    pop: { walkers: 10, funeral: false, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'robbery', count: 15 }, waves: [4, 5, 6] },
  { id: 'm10', title: 'Head Hunter', desc: 'Decapitate 5 criminals. Batarangs to the neck work wonders.', at: 'street', time: 200, item: 'batarang',
    pop: { walkers: 45, litterRate: 0.2, slowRate: 0.15, whistleRate: 0.1 }, obj: { crime: null, count: 5, method: ['decap', 'spine'], res: 'killed' } },
  { id: 'm11', title: 'Cold Case', desc: 'Shatter 6 frozen criminals. Freeze, then kick.', at: 'plaza', time: 200, item: 'freeze',
    pop: { walkers: 30, pledgeBad: 5 }, obj: { crime: null, count: 6, method: ['shatter'] } },
  { id: 'm12', title: 'Gel Fireworks', desc: 'Detonate 8 criminals with Explosive Gel.', at: 'street', time: 200, item: 'gel',
    pop: { walkers: 55, litterRate: 0.2, jayRate: 1, grandmaRate: 0.35 }, obj: { crime: null, count: 8, method: ['explode'] } },
  { id: 'm13', title: 'Flat Earth Society', desc: 'Flatten 5 criminals with the Bat-Mallet.', at: 'houses', time: 180, item: 'mallet',
    pop: { walkers: 20, lazyRate: 0.8, allHouses: true }, obj: { crime: null, count: 5, method: ['crush'] } },
  { id: 'm14', title: 'Crematorium', desc: 'Cremate 5 dry-eyed mourners. Ashes to ashes.', at: 'funeral', time: 150, item: 'flamer',
    pop: { walkers: 8, funeralBad: 6, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'funeral', count: 5, method: ['ash'] } },
  { id: 'm15', title: 'Chainsaw Chores', desc: 'Bisect 5 lazy husbands. They were always half the man.', at: 'houses', time: 180, item: 'chainsaw',
    pop: { walkers: 12, lazyRate: 0.85, allHouses: true, funeral: false, pledge: false, grass: false, carts: false }, obj: { crime: 'chores', count: 5, method: ['halve', 'gib'] } },
  { id: 'm16', title: 'Batarang Sniper', desc: 'Kill 5 jaywalkers with the Batarang equipped.', at: 'street', time: 200, item: 'batarang',
    pop: { walkers: 45, grandmaRate: 0.5, jayRate: 1, funeral: false, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'jaywalk', count: 5, item: 'batarang' } },
  { id: 'm17', title: 'Measured Response', desc: 'Beat 8 minor offenders. Kill no one who doesn\'t deserve it.', at: 'park', time: 240, clean: true,
    pop: { walkers: 40, grassCount: 8, slowRate: 0.15, whistleRate: 0.15, litterRate: 0, jayRate: 0 }, obj: { crime: null, count: 8, res: 'beaten' } },
  { id: 'm18', title: 'Rush Hour', desc: 'Punish 30 crimes in 3 minutes. Every tool. No mercy.', at: 'plaza', time: 180,
    pop: { walkers: 60, litterRate: 0.2, slowRate: 0.12, whistleRate: 0.1 }, obj: { crime: null, count: 30 } },
  { id: 'm19', title: 'Arkham Night', desc: 'Survive 4 escalating waves of thugs.', at: 'market', time: 300,
    pop: { walkers: 6, funeral: false, pledge: false, houses: false, grass: false, carts: false }, obj: { crime: 'robbery', count: 33 }, waves: [5, 8, 9, 11] },
  { id: 'm20', title: 'Total Variety', desc: 'Kill criminals 6 different ways (any 6 death types).', at: 'plaza', time: 300,
    pop: { walkers: 55, litterRate: 0.2, jayRate: 1 }, obj: { crime: null, count: 99, variety: 6 } },
];
