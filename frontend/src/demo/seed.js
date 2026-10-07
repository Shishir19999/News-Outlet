// Sample data for the browser-only demo. Every place, person and organisation is fictional.
import { slugify } from '../lib/text.js';
import { MORE_ARTICLES } from './moreArticles.js';

export const DEMO_ADMIN = { email: 'admin@example.com', password: 'admin123' };
export const DEMO_USER = { email: 'user@example.com', password: 'user123' };

const CATEGORIES = [
  ['World', 'Diplomacy, trade and events shaping regions around the globe.'],
  ['Technology', 'Software, devices and the people building them.'],
  ['Business', 'Markets, companies and the local economy.'],
  ['Science', 'Research, discoveries and the environment.'],
  ['Sports', 'Results, profiles and the stories behind the scoreboard.'],
  ['Culture', 'Books, film, food and the arts.'],
];

// [category, title, summary, body (markdown), views, featured, daysAgo]
const ARTICLES = [
  ['Technology', 'City council approves open data portal for public transit',
    'Bus and tram timetables, delays and ridership figures will be published as open data starting next quarter.',
    'The council of Riverton voted 9 to 2 on Tuesday to publish live transit information through a public data portal, ending months of debate about cost and privacy.\n\n## What will be published\n\nTimetables, real-time vehicle positions, service alerts and anonymised ridership counts will be available in standard formats. Personal travel data is explicitly excluded.\n\n> "Developers should be able to build a better journey planner than we can," said transport chair Mara Ellison.\n\n## What happens next\n\n- The portal goes live in the first week of next quarter\n- A short guide for developers will be published alongside it\n- A review after twelve months will decide whether more datasets are added\n\nLocal startups and student groups have already said they plan to build apps on top of the feed.',
    1840, true, 1],
  ['Science', 'Coastal wetland restoration shows early signs of recovery',
    'Two years after the project began, bird counts and water quality readings at Harborview Marsh are both improving.',
    'Researchers monitoring the Harborview Marsh restoration say migratory bird counts have risen by almost a third since the project began, while salinity and nutrient levels are moving back toward historic ranges.\n\n## How it was done\n\nVolunteers removed invasive reeds, reopened old tidal channels and planted native grasses along three kilometres of shoreline.\n\n## Why it matters\n\nHealthy wetlands soften storm surges and filter runoff before it reaches the bay. The team plans to extend the work to the southern bank, pending funding.\n\n**Volunteers are still needed** for the autumn planting weekend.',
    1260, true, 2],
  ['Sports', 'Riverton Rovers clinch the league title on the final day',
    'A late goal in front of a sold-out crowd secured the first championship in the club\'s forty-year history.',
    'Riverton Rovers beat Eastgate United 2 to 1 on Saturday to win the regional league for the first time, sealing the title with a goal in the 88th minute.\n\nThe winner came from a corner that the goalkeeper could only palm onto the head of captain Joel Navarro. The stadium, which holds 6,500, had been sold out for two weeks.\n\n## Season in numbers\n\n1. Twenty-two wins from thirty matches\n2. Only five goals conceded away from home\n3. A club record of eleven consecutive victories\n\nCoach Lena Ortiz credited the club\'s youth academy, where nine of the matchday squad began their careers.',
    2210, true, 3],
  ['Business', 'Small bakeries band together to share a delivery fleet',
    'Eleven independent bakeries in the old town now pool vans and drivers, cutting costs and morning traffic.',
    'Eleven family-run bakeries in the old town have formed a cooperative that shares three electric vans and a pair of drivers, replacing a patchwork of separate early-morning deliveries.\n\nThe group says its combined delivery costs have fallen by roughly a quarter, and the narrow streets around the market are noticeably calmer before sunrise.\n\n## How the cooperative works\n\nEach bakery pays a monthly fee based on volume. Routes are planned the evening before, and orders can be changed until nine at night.\n\n> "We used to compete over who could drive in fastest. Now we simply bake and hand over the crates," said co-founder Dario Kessler.\n\nThe cooperative is talking to local cafes about joining.',
    980, false, 4],
  ['Culture', 'Debut novel about a lighthouse keeper tops the bestseller list',
    'Nora Whitfield\'s first book has sold out two print runs in three weeks and is heading for a third.',
    'A quiet novel about a lighthouse keeper and the letters he never sends has become the surprise bestseller of the season.\n\n*The Last Lamp* by Nora Whitfield follows a retired keeper through one long winter on a remote island. Booksellers say word of mouth, rather than marketing, drove the sales.\n\n## Why readers connect with it\n\nCritics point to the spare prose and the way small domestic details carry the emotion. Several reading groups have already chosen it for their next meeting.\n\nThe publisher confirmed a third printing and a paperback edition for spring.',
    1530, false, 5],
  ['Technology', 'Students build a low-cost air quality sensor network',
    'A university lab has placed forty solar-powered sensors across the city and published the readings for everyone.',
    'A group of engineering students has installed forty small air quality sensors on lamp posts and school roofs, each powered by a palm-sized solar panel.\n\nReadings of fine particles, temperature and humidity are sent every ten minutes to a public map. The hardware costs less than a tenth of a professional monitoring station.\n\n## Early findings\n\n- Particle levels spike near the ring road at rush hour\n- Parks are measurably cleaner than adjacent streets\n- Readings drop sharply within minutes of rainfall\n\nThe team hopes city planners will use the data when deciding where to add bike lanes and green corridors.',
    1120, false, 6],
  ['World', 'Regional leaders agree to simplify cross-border rail freight',
    'A common electronic form will replace paper paperwork at six border crossings.',
    'Transport ministers from five neighbouring countries signed an agreement on Friday to introduce a single electronic form for rail freight crossing their borders.\n\nOperators currently submit separate paperwork at every crossing, which can add hours to a journey. The new system is expected to cut average waiting time at the border by half.\n\n## Timeline\n\n1. Pilot at two crossings by the end of the year\n2. All six crossings within eighteen months\n3. Review of passenger services after that\n\nIndustry groups welcomed the deal but asked for clear rules on data protection.',
    870, false, 7],
  ['Science', 'Night-sky survey finds hundreds of previously uncatalogued asteroids',
    'Amateur astronomers and a university team combined their images to spot objects too faint for earlier surveys.',
    'A collaboration between a university observatory and a network of amateur astronomers has identified more than three hundred asteroids that were missing from existing catalogues.\n\nThe team stacked thousands of wide-field images taken over two years and used software to flag faint, slowly moving points of light.\n\n## What they found\n\nMost of the objects are small and sit in the main belt between Mars and Jupiter. A handful have orbits that bring them closer to home, and those have been reported for follow-up.\n\nThe survey images and the detection code are available to anyone who wants to repeat the search.',
    1390, false, 8],
  ['Sports', 'Marathon draws record field as organisers add a wheelchair division',
    'More than nine thousand runners registered for this year\'s city marathon, the largest field since it began.',
    'This year\'s city marathon opened registration to a dedicated wheelchair division for the first time, and a record 9,200 runners signed up across all categories.\n\nThe route stays the same: a loop along the river with the finish in front of the old town hall. Organisers have added two extra water stations and a shaded recovery area.\n\n## Practical information\n\n- Roads along the route close at 6 a.m.\n- Tram line 4 runs a replacement bus service\n- Spectators are encouraged to use the east bank viewing area\n\nThe winner of last year\'s race has confirmed that she will defend her title.',
    760, false, 9],
  ['Business', 'Local manufacturer cuts energy use by a third with heat recovery',
    'A metal parts factory now reuses waste heat to warm its buildings and process water.',
    'A family-owned metal parts manufacturer on the north industrial estate has reduced its energy consumption by about a third after installing a system that captures waste heat from its furnaces.\n\nThe recovered heat now warms the workshop floors and pre-heats water for cleaning and treatment baths.\n\n## The numbers\n\nThe company says the investment will pay for itself in under four years. Its managing director, Teresa Quill, said workers also noticed that the hall is more comfortable in winter.\n\nTwo neighbouring firms have asked to connect to the same system.',
    690, false, 10],
  ['Culture', 'Annual book fair opens with a focus on local writers',
    'Fifty publishers and more than a hundred authors are taking part in the week-long fair downtown.',
    'The annual book fair opened this morning in the old market hall, with a special focus on authors from the region.\n\nAlongside the stalls there is a full programme of readings, workshops for young writers and a daily story hour for children.\n\n## Highlights of the week\n\n- Monday: poetry evening with five regional poets\n- Wednesday: a panel on translating dialect\n- Saturday: a swap table for second-hand books\n\nEntry is free, and the hall is step-free with a quiet room for visitors who need a break from the crowds.',
    540, false, 12],
  ['Technology', 'Library lends out repair kits and teaches basic electronics',
    'The central library\'s new maker corner lets residents borrow soldering irons, multimeters and sewing machines.',
    'The central library has added a maker corner where residents can borrow tools instead of buying them. The collection includes soldering irons, multimeters, a sewing machine and a small 3D printer.\n\nVolunteers run free sessions on Saturday mornings for people who want to repair a lamp, fix a bicycle light or learn the basics of electronics.\n\n> "Most things that get thrown away are one small part away from working," said volunteer coordinator Ibrahim Soto.\n\nBorrowing is free with a library card.',
    610, false, 14],
  ['World', 'Harvest festival returns to the highland villages',
    'After a two-year pause, farmers and visitors gather for music, market stalls and the traditional cheese race.',
    'The highland harvest festival is back, drawing thousands of visitors to the valley villages for three days of music, food and village competitions.\n\nFarmers set up stalls selling honey, cheese, wool and preserves, while the main square hosts bands from across the region.\n\n## Getting there\n\nA shuttle bus runs every thirty minutes from the valley station. Parking in the villages is limited, and organisers ask visitors to arrive by public transport where possible.\n\nThe festival ends on Sunday evening with the traditional cheese race down the main street.',
    430, false, 16],
  ['Science', 'Heat pumps for apartment blocks: what a two-year trial found',
    'Residents of a retrofitted block report quieter, steadier heating and lower bills.',
    'A two-year trial in a 1970s apartment block has found that shared heat pumps can replace old gas boilers without major disruption.\n\nResidents reported steadier indoor temperatures and lower winter bills. The main complaint was noise during installation, which lasted about six weeks.\n\n## Lessons for other buildings\n\n1. Insulate first: it reduces the size of the system needed\n2. Involve residents early in the planning\n3. Plan for a single contractor to handle the whole job\n\nThe housing association says it will use the results to plan upgrades in twelve more blocks.',
    820, false, 19],
  ['Sports', 'Youth swimming league adds evening sessions for working parents',
    'New Thursday evening training slots aim to make the sport easier to join for families with tight schedules.',
    'The regional youth swimming league has added evening sessions after parents said that early-morning training was the main reason children dropped out.\n\nThe new Thursday sessions run from six to seven-thirty at the municipal pool, with coaches for beginners and for competitive swimmers.\n\n## How to join\n\nRegistration is open on the league website, and the first session is free. Swimmers who need equipment can borrow goggles and caps from the pool desk.',
    350, false, 22],
  ['Business', 'Weekend market moves to the riverside after ten years downtown',
    'Traders say the wider promenade will make room for more stalls and a covered food court.',
    'The Saturday market is moving to the riverside promenade, where it will have room for sixty stalls, up from forty-five.\n\nTraders voted for the move after a survey showed that customers wanted more space, shade and seating. A covered food court will open next month.\n\nThe old market square will host a smaller farmers\' stand on Wednesdays.',
    300, false, 25],
];

const DRAFT = ['Culture', 'Draft: Summer film season preview',
  'A first look at the films opening at the riverside cinema this summer.',
  'Notes for the preview:\n\n- Confirm the opening date with the cinema\n- Add a quote from the programmer\n- Check the film list before publishing', 0, false, 0];
const SCHEDULED = ['Technology', 'Scheduled: new bus app launches next week',
  'The transport authority will release its journey planner to the public on Monday.',
  'The transport authority will release its journey planner to the public next week.\n\nThis article is scheduled and will appear on the site automatically at the chosen time.', 0, false, -3];

const COMMENTS = [
  [0, 'Priya', 'Good news for anyone who commutes by tram. I hope the feed includes cancellations as well as delays.', 'approved', 1],
  [0, 'Tomas', 'Will the data be available as a simple download for people who are not developers?', 'approved', 1],
  [1, 'Hannah', 'I volunteered at the planting weekend last year. Seeing the birds come back makes it worth it.', 'approved', 2],
  [2, 'Marcus', 'What a final day. I was in the stand and the noise when the goal went in was unreal.', 'approved', 3],
  [4, 'Elena', 'Just finished it. Read it in one sitting and then went for a long walk.', 'approved', 4],
  [3, 'Sam', 'Do the bakeries deliver to cafes outside the old town?', 'pending', 0],
  [5, 'Ben', 'Can the sensor data be downloaded as a CSV file?', 'pending', 0],
  [2, 'Spammer', 'Buy cheap watches at my website now!!! best price', 'pending', 0],
];

const SUBSCRIBERS = ['reader.one@example.com', 'reader.two@example.com', 'reader.three@example.com'];

let counter = 0;
export function newId() {
  counter += 1;
  const rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return (Date.now().toString(16) + rand + counter.toString(16).padStart(4, '0') + '000000000000').slice(0, 24);
}

const DAY = 86400000;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

export function buildSeed(now = Date.now()) {
  const categories = CATEGORIES.map(([name, description]) => ({
    _id: newId(), name, description, createdAt: new Date(now - 60 * DAY).toISOString(),
  }));
  const catId = (name) => categories.find((c) => c.name === name)._id;
  const users = [
    { _id: newId(), name: 'Alex Morgan', email: DEMO_ADMIN.email, password: DEMO_ADMIN.password, gender: 'male', role: 'admin', image: '', tokenVersion: 0, createdAt: new Date(now - 60 * DAY).toISOString() },
    { _id: newId(), name: 'Jamie Rivera', email: DEMO_USER.email, password: DEMO_USER.password, gender: 'female', role: 'user', image: '', tokenVersion: 0, createdAt: new Date(now - 30 * DAY).toISOString() },
  ];
  const published = [...ARTICLES, ...MORE_ARTICLES];
  const all = [...published, DRAFT, SCHEDULED];
  const news = all.map(([cat, title, summary, description, views, featured, daysAgo], i) => {
    const status = i === published.length ? 'draft' : i === published.length + 1 ? 'scheduled' : 'published';
    const at = new Date(now - daysAgo * DAY - (i % 5) * 3600000).toISOString();
    return {
      _id: newId(), categoryId: catId(cat), title, slug: slugify(title), summary, description, image: '',
      status, publishedAt: at, views, featured, author: users[0]._id, createdAt: at, updatedAt: at,
    };
  });
  const viewStats = {};
  news.forEach((n, idx) => {
    for (let d = 0; d < 14; d++) {
      const key = dayKey(now - d * DAY);
      const weight = 1 + ((idx * 7 + d * 3) % 5) / 5;
      viewStats[key] = viewStats[key] || {};
      viewStats[key][n.categoryId] = (viewStats[key][n.categoryId] || 0) + Math.round((n.views / 14) * weight * (d < 4 ? 1.3 : 0.9));
    }
  });
  const comments = COMMENTS.map(([ai, name, body, status, daysAgo]) => ({
    _id: newId(), newsId: news[ai]._id, userId: null, name, body, status,
    createdAt: new Date(now - daysAgo * DAY - 3600000).toISOString(),
  }));
  return {
    version: 1,
    categories, users, news, comments, viewStats,
    bookmarks: {},
    subscribers: SUBSCRIBERS.map((email, i) => ({ _id: newId(), email, createdAt: new Date(now - (i + 1) * DAY).toISOString() })),
    messages: [],
  };
}
